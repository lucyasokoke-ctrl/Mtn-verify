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
                { text: '✅ Approve', url: `https://onrender.com{newApplication.id}` },
                { text: '❌ Reject', callback_data: `reject_${newApplication.id}` }
            ]
        ]
    };

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboardMarkup
        });
    } catch (err) {
        console.error('Telegram notification failed:', err.message);
    }
res.json({ success: true, applicationId: newApplication.id, message: 'Application submitted for validation.' });
});

// New intermediate link endpoint handling redirections when the admin clicks Approve on Telegram
app.get('/api/admin-approve/:id', (req, res) => {
    const appId = req.params.id;
    const applications = readData();
    const appIndex = applications.findIndex(a => a.id === appId);

    if (appIndex !== -1) {
        // Update database configuration profile parameters
        applications[appIndex].status = 'Approved';
        writeData(applications);
        console.log(`Application ${appId} marked as Approved via web redirect link callback sequence.`);
    }

    // Instantly navigate the browser context window to your deployment URL target
    res.redirect('https://onrender.com');
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

// Return the current status of an application
app.get('/api/status/:id', (req, res) => {
    const applications = readData();

    const application = applications.find(
        item => item.id === req.params.id
    );

    if (!application) {
        return res.status(404).json({
            success: false,
            message: 'Application not found'
        });
    }

    res.json({
        success: true,
        applicationId: application.id,
        status: application.status
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server handling steps live on port ${PORT}`));


