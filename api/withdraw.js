import fetch from "node-fetch";
import admin from "firebase-admin";

// Init Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { uid, amount, bankCode, accountNumber } = req.body;

    if (!uid || !amount || !bankCode || !accountNumber) {
      return res.status(400).json({ success: false, message: "Missing parameters" });
    }

    // Check user balance
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData = userDoc.data();
    if (userData.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    // Create transfer recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: userData.name || "MVPay User",
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });
    const recipientData = await recipientRes.json();

    if (!recipientData.status) {
      return res.status(400).json({ success: false, message: "Failed to create recipient" });
    }

    const recipientCode = recipientData.data.recipient_code;

    // Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        reason: "MVPay withdrawal",
        amount: amount * 100, // in kobo
        recipient: recipientCode,
      }),
    });
    const transferData = await transferRes.json();

    if (!transferData.status) {
      return res.status(400).json({ success: false, message: "Transfer failed" });
    }

    // Update balance
    await userRef.update({
      balance: userData.balance - amount,
      totalWithdraw: (userData.totalWithdraw || 0) + amount,
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal successful. Processing transfer.",
      transfer: transferData.data,
    });

  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({
      success: false,
      message: "⚠️ Could not connect to MVPay withdrawal server. Try again later.",
    });
  }
}
