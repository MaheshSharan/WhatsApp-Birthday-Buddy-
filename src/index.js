require('dotenv').config();
const WhatsAppConnection = require('./whatsapp/connection');
const cron = require('node-cron');
const { scheduleBirthdayJob } = require('./cron/birthdayJob');

async function startBot() {
    try {
        // Connect to WhatsApp
        const whatsappConnection = new WhatsAppConnection();
        const sock = await whatsappConnection.connect();

        // Schedule birthday check job
        cron.schedule('0 0 * * *', () => scheduleBirthdayJob(sock));

        console.log('WhatsApp Birthday Bot started successfully!');
        
        // Send startup notification
        if (process.env.OWNER_NUMBER) {
            await whatsappConnection.sendMessage(
                process.env.OWNER_NUMBER + '@s.whatsapp.net',
                { text: '🤖 WhatsApp Birthday Bot is now online! 🎉' }
            );
        }
    } catch (error) {
        console.error('Error starting bot:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});

// Start the bot
startBot();
