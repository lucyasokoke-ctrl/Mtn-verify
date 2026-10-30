const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
// Render automatically handles deployment ports using process.env.PORT variables
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'applications.json');

// --- ENTER TELEGRAM TELEMETRY CREDENTIALS HERE ---
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const TELEGRAM_CHAT_ID = 'YOUR_CHAT_ID_HERE';

app.use(cors());
app.use(express.json());

// FIXED: Native pipeline layer configuration to automatically server index.html on root path requests
app.use(express.static(__dirname));

app.post('/api/apply', async (req, res) => {
    const { loanType, loanAmount, loanTerm, purpose, employmentStatus, annualIncome } = req.body;

    if (!loanType || !loanAmount || !loanTerm || !purpose || !employmentStatus || !annualIncome) {
        return res.status(400).json({ success: false, message: "Missing forms required attributes properties." });
    }

    const trackId = "MOMO-" + Math.floor(100000 + Math.random() * 900000);
    const timestamp = new Date().toISOString();

    const applicationRecord = {
        trackId,
        timestamp,
        details: { loanType, loanAmount, loanTerm, purpose, employmentStatus, annualIncome }
    };

    let currentData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
        } catch (e) {
            console.error("Failed handling database array file parsing execution:", e);
        }
    }
    currentData.push(applicationRecord);
    fs.writeFileSync(DATA_FILE, JSON.stringify(currentData, null, 4), 'utf8');

    const telegramMessage = 
`🔔 *New Loan Application Received*
---------------------------------------
*Track ID:* \`${trackId}\`
*Timestamp:* ${timestamp}

*Loan Details:*
• Type: ${loanType}
• Amount: ZMW ${Number(loanAmount).toLocaleString()}
• Term: ${loanTerm} Months
• Purpose: _${purpose}_

*Applicant Profile:*
• Employment: ${employmentStatus}
• Annual Income: ZMW ${Number(annualIncome).toLocaleString()}
---------------------------------------`;

    try {
        // FIXED: Restructured syntax structure using proper backticks and API endpoint subdirectories
        const telegramUrl = `https://telegram.org{TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: telegramMessage,
                parse_mode: 'Markdown'
            })
        });

        const telegramResponseData = await response.json();
        
        if (!telegramResponseData.ok) {
            console.error("Telegram API interface refused transmission handler:", telegramResponseData);
            return res.status(502).json({ success: false, message: "Local JSON updated, but Telegram broadcast channel execution timed out." });
        }

        return res.status(201).json({ success: true, trackId });
    } catch (error) {
        console.error("Network interface error connecting outwards towards Telegram:", error);
        return res.status(500).json({ success: false, message: "Internal application handler parsing error context exception." });
    }
});

app.listen(PORT, () => console.log(`Active server monitoring port runtime channel running at port: ${PORT}`));

