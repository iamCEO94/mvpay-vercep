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
    const { reference, uid, amount } = req.body;

    if (!reference || !uid || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const response = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (data.status && data.data.status === "success") {
      const userRef = db.collection("users").doc(uid);
      await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw "User not found";
        const newBalance = (userDoc.data().balance || 0) + Number(amount);
        t.update(userRef, {
          balance: newBalance,
          totalRecharge: (userDoc.data().totalRecharge || 0) + Number(amount),
        });
      });

      return res.json({ success: true, message: "Payment verified" });
    } else {
      return res.status(400).json({ error: "Payment verification failed" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
