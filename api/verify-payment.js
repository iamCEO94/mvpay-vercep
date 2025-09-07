import admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Firebase Admin
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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Use POST" });

  try {
    const { reference, uid, amount } = req.body;
    if (!reference || !uid || !amount) return res.status(400).json({ success: false, message: "Missing fields." });

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });

    const verifyData = await verifyRes.json();
    if (!verifyData.status) return res.status(400).json({ success: false, message: verifyData.message });

    if (verifyData.data.status !== "success") return res.status(400).json({ success: false, message: "Payment not successful." });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const currentBalance = userSnap.exists ? userSnap.data().balance || 0 : 0;
    const newBalance = currentBalance + Number(amount);

    await userRef.update({ balance: newBalance });

    await db.collection("transactions").add({
      uid,
      type: "recharge",
      amount: Number(amount),
      reference,
      status: "success",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, message: "Payment verified successfully.", newBalance });

  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ success: false, message: "Could not connect to Paystack verification server." });
  }
}
