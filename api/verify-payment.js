// api/verify-payment.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ error: "Missing payment reference" });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      return res.status(400).json({ error: "Verification failed", details: data });
    }

    // ✅ Here you would update Firebase user balance
    // Example: update database with data.data.amount / 100

    return res.status(200).json({
      message: "Payment verified",
      data: data.data,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
