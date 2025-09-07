async function initiateWithdraw() {
  const amount = document.getElementById("amount").value;
  const bankName = document.getElementById("bankName").value;
  const accountNumber = document.getElementById("accountNumber").value;

  if (!amount || amount <= 0 || !bankName || !accountNumber) {
    return showMessage("Please fill in all fields correctly", "error");
  }

  try {
    const res = await fetch(`${API_BASE}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: currentUser.uid, amount, bankName, accountNumber })
    });
    const data = await res.json();
    if (data.success) showMessage("Withdrawal initiated successfully!", "success");
    else showMessage(data.message || "Withdrawal failed", "error");
  } catch (err) {
    showMessage("Could not connect to MVPay withdrawal server.", "error");
  }
}
