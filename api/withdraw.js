import admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  const firebaseCred = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(firebaseCred)
  });
}

const db = admin.firestore();

// Tiered withdrawal amounts (₦)
const withdrawalTiers = [
  1000, 5000, 15000, 35000, 65000, 90000,
  150000, 220000, 500000, 800000, 1200000, 2000000, 5000000
];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Use POST" });

  try {
    const { uid, amount, bankName, accountNumber, accountHolderName, bankCode } = req.body;

    if (!uid || !amount || !bankName || !accountNumber || !accountHolderName || !bankCode) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const numAmount = Number(amount);
    if (!withdrawalTiers.includes(numAmount)) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal amount." });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found." });

    const userData = userSnap.data();
    const balance = userData.balance || 0;
    if (numAmount > balance) return res.status(400).json({ success: false, message: "Insufficient balance." });

    let recipient_code = userData.paystackRecipientCode || null;

    // Create Paystack recipient if not exists
    if (!recipient_code) {
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
      if (!recipientData.status) return res.status(500).json({ success: false, message: recipientData.message });

      recipient_code = recipientData.data.recipient_code;
      await userRef.update({ paystackRecipientCode: recipient_code });
    }

    // Make transfer via Paystack
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        source: "balance",
        reason: `MVPay withdrawal for ${uid}`,
        amount: numAmount * 100, // kobo
        recipient: recipient_code,
        currency: "NGN"
      })
    });

    const transferData = await transferRes.json();
    if (!transferData.status) return res.status(500).json({ success: false, message: transferData.message });

    // Update user balance
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

    return res.status(200).json({ success: true, message: `Withdrawal of ₦${numAmount} successful.`, newBalance });

  } catch (err) {
    console.error("Withdraw error:", err);
    return res.status(500).json({ success: false, message: "Could not connect to MVPay withdrawal server." });
  }
}
