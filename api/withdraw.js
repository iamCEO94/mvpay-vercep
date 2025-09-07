// pages/api/withdraw.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }

  const { uid, amount, bankCode, accountNumber } = req.body;

  if (!uid || !amount || !bankCode || !accountNumber) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  // Optional: you can validate amount here (min/max)
  if (amount < 100) {
    return res.status(400).json({ success: false, message: "Minimum withdrawal is ₦100." });
  }

  try {
    // ===== Simulate Paystack transfer =====
    // Later, replace this with real Paystack transfer API integration:
    // Example with fetch:
    // const response = await fetch("https://api.paystack.co/transfer", { ... });

    console.log(`User ${uid} withdrawing ₦${amount} to account ${accountNumber} at bank ${bankCode}`);

    // Simulate success
    return res.status(200).json({ success: true, message: "Withdrawal initiated successfully (simulated)." });

  } catch (err) {
    console.error("Withdrawal error:", err);
    return res.status(500).json({ success: false, message: "Could not connect to MVPay withdrawal server. Try again later." });
  }
}
