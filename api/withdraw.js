// pages/api/withdraw.js
export default async function handler(req, res) {
  // Allow frontend from any origin (if needed)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }

  const { uid, amount, bankName, accountNumber } = req.body;

  if (!uid || !amount || !bankName || !accountNumber) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  if (amount < 100) {
    return res.status(400).json({ success: false, message: "Minimum withdrawal is ₦100." });
  }

  if (accountNumber.length !== 10) {
    return res.status(400).json({ success: false, message: "Account number must be 10 digits." });
  }

  try {
    // ===== Simulate withdrawal (replace with Paystack API later) =====
    console.log(`User ${uid} withdrawing ₦${amount} to ${bankName} (${accountNumber})`);

    return res.status(200).json({
      success: true,
      message: `Withdrawal of ₦${amount} to ${bankName} (${accountNumber}) initiated successfully.`
    });

  } catch (err) {
    console.error("Withdrawal error:", err);
    return res.status(500).json({
      success: false,
      message: "Could not connect to MVPay withdrawal server. Try again later."
    });
  }
}
