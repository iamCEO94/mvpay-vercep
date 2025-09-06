import admin from "firebase-admin";

// Use dynamic import for node-fetch (to fix ESM error)
const fetch = (url, options) => import("node-fetch").then(({ default: fetch }) => fetch(url, options));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse JSON body safely
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { uid, amount, account_number, bank_code } = body;

    if (!uid || !amount || !account_number || !bank_code) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Deduct from user balance in Firestore
    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    if (userData.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct balance
    await userRef.update({
      balance: admin.firestore.FieldValue.increment(-amount),
    });

    // Create Paystack transfer recipient
    const recipientResp = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: userData.name || "MVPay User",
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });
    const recipientData = await recipientResp.json();

    if (!recipientData.status) {
      return res.status(400).json({ error: "Failed to create transfer recipient", details: recipientData });
    }

    const recipient_code = recipientData.data.recipient_code;

    // Initiate transfer
    const transferResp = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // convert to kobo
        recipient: recipient_code,
        reason: "User withdrawal",
      }),
    });
    const transferData = await transferResp.json();

    if (!transferData.status) {
      return res.status(400).json({ error: "Transfer failed", details: transferData });
    }

    return res.status(200).json({ success: true, transfer: transferData.data });

  } catch (error) {
    console.error("Withdraw API error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
}
