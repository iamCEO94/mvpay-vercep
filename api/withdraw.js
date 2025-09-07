import fetch from "node-fetch";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { uid, amount, accountNumber, bankCode } = req.body;

    if (!uid || !amount || !accountNumber || !bankCode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const userData = userDoc.data();
    if ((userData.balance || 0) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Step 1: Create transfer recipient
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
      return res.status(400).json({ error: "Failed to create recipient", details: recipientData.message });
    }

    const recipientCode = recipientData.data.recipient_code;

    // Step 2: Initiate transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // convert to kobo
        recipient: recipientCode,
        reason: "User withdrawal",
      }),
    });

    const transferData = await transferRes.json();
    if (!transferData.status) {
      return res.status(400).json({ error: "Transfer failed", details: transferData.message });
    }

    // Step 3: Deduct balance
    await userRef.update({
      balance: userData.balance - amount,
      totalWithdraw: (userData.totalWithdraw || 0) + amount,
    });

    return res.json({ success: true, message: "Withdrawal initiated", data: transferData.data });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
