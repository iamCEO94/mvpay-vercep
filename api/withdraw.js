// api/withdraw.js

const fetch = require("node-fetch");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, bankCode, accountNumber, amount } = req.body;

    if (!userId || !bankCode || !accountNumber || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();

    if (userData.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct balance first
    await userRef.update({
      balance: userData.balance - amount,
    });

    // Create transfer recipient
    const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: userData.name || "User",
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientResponse.json();

    if (!recipientData.status) {
      return res.status(400).json({ error: "Failed to create transfer recipient", details: recipientData });
    }

    const recipientCode = recipientData.data.recipient_code;

    // Initiate transfer
    const transferResponse = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // Paystack expects amount in kobo
        recipient: recipientCode,
        reason: "User withdrawal",
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      // Rollback: add balance back
      await userRef.update({
        balance: userData.balance,
      });
      return res.status(400).json({ error: "Transfer failed", details: transferData });
    }

    return res.status(200).json({
      message: "Withdrawal successful",
      transfer: transferData.data,
    });

  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};
