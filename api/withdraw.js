// api/withdraw.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { account_number, bank_code, amount } = req.body;

    if (!account_number || !bank_code || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Create recipient
    const recipientResponse = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: "User Withdrawal",
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const recipientData = await recipientResponse.json();

    if (!recipientData.status) {
      return res.status(400).json({ error: "Recipient creation failed", details: recipientData });
    }

    const recipient_code = recipientData.data.recipient_code;

    // 2️⃣ Transfer money
    const transferResponse = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // Paystack expects kobo
        recipient: recipient_code,
        reason: "User withdrawal",
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferData.status) {
      return res.status(400).json({ error: "Transfer failed", details: transferData });
    }

    return res.status(200).json({ message: "Withdrawal successful", data: transferData.data });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
