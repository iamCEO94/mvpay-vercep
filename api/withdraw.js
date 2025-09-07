// pages/api/withdraw.js
import admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

// Tiered withdrawal amounts (₦)
const withdrawalTiers = [
  1000, 5000, 15000, 35000, 65000, 90000, 
  150000, 220000, 500000, 800000, 1200000, 2000000, 5000000
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }

  const { uid, amount, bankName, accountNumber, accountHolderName, bankCode } = req.body;

  if (!uid || !amount || !bankName || !accountNumber || !accountHolderName || !bankCode) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  const numAmount = Number(amount);

  // Check tiered amounts
  if (!withdrawalTiers.includes(numAmount)) {
    return res.status(400).json({
      success: false,
      message: `Withdrawal amount must match allowed tiers: ${withdrawalTiers.join(", ")}`
    });
  }

  try {
    // Get user from Firestore
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found." });

    const userData = userSnap.data();
    const balance = userData.balance || 0;

    // Check balance
    if (numAmount > balance) return res.status(400).json({ success: false, message: "Insufficient balance." });

    // Check if recipient_code exists
    let recipient_code = userData.paystackRecipientCode || null;

    if (!recipient_code) {
      // Create Paystack transfer recipient
      const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "nuban",
          name: accountHolderName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN"
        })
      });

      const recipientData = await recipientRes.json();
      if (!recipientData.status) return res.status(500).json({ success: false, message: `Recipient creation failed: ${recipientData.message}` });

      recipient_code = recipientData.data.recipient_code;

      // Save recipient_code in user data
      await userRef.update({ paystackRecipientCode: recipient_code });
    }

    // Execute Paystack transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "balance",
        reason: `MVPay withdrawal for ${uid}`,
        amount: numAmount * 100, // Paystack uses kobo
        recipient: recipient_code,
        currency: "NGN"
      })
    });

    const transferData = await transferRes.json();
    if (!transferData.status) return res.status(500).json({ success: false, message: `Paystack transfer failed: ${transferData.message}` });

    // Deduct balance after successful transfer
    const newBalance = balance - numAmount;
    await userRef.update({ balance: newBalance });

    // Log transaction
    await db.collection("transactions").add({
      uid,
      type: "withdrawal",
      amount: numAmount,
      bankName,
      accountNumber,
      status: "success",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      message: `Withdrawal of ₦${numAmount} to ${bankName} successful.`,
      newBalance
    });

  } catch (err) {
    console.error("Withdrawal error:", err);
    return res.status(500).json({ success: false, message: "Could not process withdrawal. Try again later." });
  }
}
