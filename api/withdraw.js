const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const crypto = require('crypto'); // Used to generate a random transfer code

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
// This is the essential part that fixes the "Failed to fetch" error.
app.use(cors());

// Enable the app to parse JSON body from the frontend
app.use(express.json());

// ---
// This is your secure backend endpoint for withdrawals.
// A real implementation would use Paystack's secret key here.
// ---

app.post('/withdraw', (req, res) => {
    // In a real application, you would validate the user's details and
    // make a secure API call to Paystack here.
    const { account_number, bank_name, amount } = req.body;

    if (!account_number || !bank_name || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // --- Placeholder for your Paystack Secret Key logic ---
    // Example using the Paystack Node.js library:
    // const Paystack = require('paystack-node');
    // const paystack = new Paystack('YOUR_SECRET_KEY', 'development');
    //
    // try {
    //      const response = await paystack.transfer.initiate({
    //          source: 'balance', // or 'your_wallet'
    //          amount: amount,
    //          recipient: 'your_recipient_code', // You would get this from Paystack's API
    //          reason: 'Withdrawal from account'
    //      });
    //      res.status(200).json({ transfer_code: response.data.transfer_code });
    // } catch (error) {
    //      console.error("Paystack API Error:", error.response.data);
    //      return res.status(500).json({ error: error.response.data.message });
    // }
    // --- End of placeholder ---

    // For this demonstration, we'll just simulate a successful response
    // by generating a unique transfer code.
    const transferCode = crypto.randomBytes(16).toString('hex');
    console.log(`Simulating withdrawal for ${account_number} (${bank_name}), amount: NGN${amount}`);
    
    // Send a success response back to the frontend
    res.status(200).json({
        message: 'Withdrawal request received.',
        transfer_code: transferCode
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Withdrawal backend is running on http://localhost:${PORT}`);
    console.log('---');
    console.log('Remember to add your Paystack secret key logic and deploy this to Vercel.');
    console.log('---');
});
