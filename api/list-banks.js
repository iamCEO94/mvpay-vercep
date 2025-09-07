// api/list-banks.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      return res.status(400).json({ error: "Failed to fetch banks", details: data });
    }

    return res.status(200).json(data.data); // returns bank list
  } catch (error) {
    console.error("Bank list error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
