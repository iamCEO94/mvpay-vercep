const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const crypto = require('crypto'); // Used to generate a random reference

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
// This is the fix for the "Failed to fetch" error.
app.use(cors());

// Enable the app to parse JSON body from the frontend
app.use(express.json());

// ---

// A simple POST endpoint to handle the payment initialization
app.post('/', (req, res) => {
    // You should use your own logic here to get a unique reference from Paystack's API
    // This is a placeholder reference for demonstration purposes.
    const transactionReference = crypto.randomBytes(16).toString('hex');
    
    // Log the request and the generated reference
    console.log('Received a request from the frontend.');
    console.log('Amount:', req.body.amount);
    console.log('Generated transaction reference:', transactionReference);
    
    // Send back a JSON response to the frontend
    res.status(200).json({
        message: 'Transaction initialized',
        reference: transactionReference
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('---');
    console.log('To test with your frontend, you need to change the BACKEND_URL in your HTML file to:');
    console.log(`http://localhost:${PORT}`);
    console.log('---');
});
