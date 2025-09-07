// pages/api/list-banks.js
export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use GET." });
  }

  const banks = [
    { name: "Access Bank", code: "044" },
    { name: "Citibank", code: "023" },
    { name: "Diamond Bank", code: "063" },
    { name: "Ecobank Nigeria", code: "050" },
    { name: "Fidelity Bank", code: "070" },
    { name: "First Bank of Nigeria", code: "011" },
    { name: "First City Monument Bank (FCMB)", code: "214" },
    { name: "Globus Bank", code: "00103" },
    { name: "Guaranty Trust Bank (GTB)", code: "058" },
    { name: "Heritage Bank", code: "030" },
    { name: "Keystone Bank", code: "082" },
    { name: "Kuda Microfinance Bank", code: "50211" },
    { name: "Moniepoint Microfinance Bank", code: "50515" },
    { name: "OPay (Paycom)", code: "999992" },
    { name: "PalmPay", code: "999991" },
    { name: "Polaris Bank", code: "076" },
    { name: "Providus Bank", code: "101" },
    { name: "Stanbic IBTC Bank", code: "221" },
    { name: "Standard Chartered Bank", code: "068" },
    { name: "Sterling Bank", code: "232" },
    { name: "Suntrust Bank", code: "100" },
    { name: "Union Bank of Nigeria", code: "032" },
    { name: "United Bank for Africa (UBA)", code: "033" },
    { name: "Unity Bank", code: "215" },
    { name: "Wema Bank", code: "035" },
    { name: "Zenith Bank", code: "057" },
  ];

  res.status(200).json({ success: true, banks });
}
