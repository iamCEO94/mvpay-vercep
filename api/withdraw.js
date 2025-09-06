// /api/withdraw.js
import admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { uid, amount, bankCode, accountNumber, accountName } = req.body;

    if (!uid || !amount || !bankCode || !accountNumber || !accountName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Convert amount to kobo
    const koboAmount = amount * 100;

    // Step 1: Initiate transfer recipient
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientRes.json();

    if (!recipientData.status) {
      return res.status(400).json({ error: recipientData.message || "Failed to create recipient" });
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
        amount: koboAmount,
        recipient: recipientCode,
        reason: "User withdrawal",
      }),
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      return res.status(400).json({ error: transferData.message || "Transfer failed" });
    }

    // Step 3: Update Firestore (log withdrawal)
    await db.collection("withdrawals").add({
      uid,
      amount,
      accountNumber,
      bankCode,
      accountName,
      status: "success",
      reference: transferData.data.reference,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: "Withdrawal successful",
      data: transferData.data,
    });
  } catch (error) {
    console.error("Withdrawal error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
