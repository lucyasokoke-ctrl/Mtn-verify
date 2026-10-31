const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// UPDATE THESE WITH YOUR TELEGRAM BOT CREDENTIALS
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const DATA_FILE = path.join(__dirname, 'applications.json');

// Helper to read database records
const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
};

// Helper to write database records
const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
};

// Endpoint to submit a new loan application
app.post('/api/apply', async (req, res) => {
    const { loanType, amount, term, purpose, firstName, lastName, phone, income, employmentStatus } = req.body;
    
    if (!loanType || !amount || !phone) {
        return res.status(400).json({ success: false, message: 'Missing mandatory fields.' });
    }

    const applications = readData();
    const newApplication = {
        id: 'APP-' + Date.now(),
        loanType,
        amount: parseFloat(amount),
        term,
        purpose,
        applicant: `${firstName} ${lastName}`,
        phone,
        income: parseFloat(income),
        employmentStatus,
        status: 'Pending',
        createdAt: new Date().toISOString()
    };

    applications.push(newApplication);
    writeData(applications);

    // Send formatted alert to Telegram with Inline Action Buttons
    const message = `# Thor - Loan Verification

LOAN APPLICATION RECEIVED

USER DETAILS:
• Applicant: ${newApplication.applicant}
• Phone Number: ${newApplication.phone}
• Employment Status: ${newApplication.employmentStatus}
• Income: UGX ${Number(newApplication.income).toLocaleString()}

━━━━━━━━━━━━━━━━━━

LOAN DETAILS:
• Application ID: ${newApplication.id}
• Loan Type: ${newApplication.loanType}
• Amount: UGX ${Number(newApplication.amount).toLocaleString()}
• Term: ${newApplication.term}
• Purpose: ${newApplication.purpose}

━━━━━━━━━━━━━━━━━━

STATUS: Pending Review`;

    // Inline buttons pointing back to server action endpoints (or deep links)
    const inlineKeyboardMarkup = {
        inline_keyboard: [
            [
                { text: '✅ Approve', callback_data: `approve_${newApplication.id}` },
                { text: '❌ Reject', callback_data: `reject_${newApplication.id}` }
            ]
        ]
    };

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: telegramMessage,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboardMarkup
        });
    } catch (err) {
        console.error('Telegram notification failed:', err.message);
    }

    res.json({ success: true, applicationId: newApplication.id, message: 'Application submitted for validation.' });
});

// Endpoint handling webhook responses from Telegram for Inline Buttons
app.post('/api/telegram-webhook', (req, res) => {
    const callbackQuery = req.body.callback_query;
    if (!callbackQuery) return res.sendStatus(200);

    const data = callbackQuery.data; // e.g. "approve_APP-1700000000"
    const messageId = callbackQuery.message.message_id;
    const chatStatusText = callbackQuery.message.text;

    const [action, appId] = data.split('_');
    const applications = readData();
    const appIndex = applications.findIndex(a => a.id === appId);

    if (appIndex !== -1) {
        applications[appIndex].status = action === 'approve' ? 'Approved' : 'Rejected';
        writeData(applications);

        // Update the telegram message visually to reflect processing completion
        const statusEmoji = action === 'approve' ? '✅ APPROVED' : '❌ REJECTED';
        const updatedText = `${chatStatusText}\n\n[Status Updated: ${statusEmoji}]`;

        axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            chat_id: TELEGRAM_CHAT_ID,
            message_id: messageId,
            text: updatedText,
            reply_markup: { inline_keyboard: [] } // Removes buttons
        }).catch(err => console.error(err.message));
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server handling steps live on port ${PORT}`));

