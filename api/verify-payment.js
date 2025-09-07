import admin from "firebase-admin";
import fetch from "node-fetch";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }

  const { uid, amount } = req.body;
  if (!uid || !amount) return res.status(400).json({ success: false, message: "Missing fields." });

  try {
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ success: false, message: "User not found." });

    const userData = userSnap.data();
    const currentBalance = userData.balance || 0;
    const newBalance = currentBalance + Number(amount);

    await userRef.update({ balance: newBalance });

    // Optional: create a Paystack charge if needed here

    await db.collection("transactions").add({
      uid,
      type: "recharge",
      amount: Number(amount),
      status: "success",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      success: true,
      message: `Recharge of ₦${amount} successful.`,
      newBalance,
      accountNumber: "CopyableAccount1234" // replace with actual if Paystack provides it
    });

  } catch (err) {
    console.error("Recharge error:", err);
    return res.status(500).json({ success: false, message: "Could not process recharge. Try again later." });
  }
}
