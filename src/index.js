require('dotenv').config();
const WhatsAppConnection = require('./whatsapp/connection');
const messageHandler = require('./whatsapp/messageHandler');
const BirthdayService = require('./services/birthdayService');
const db = require('./database/db');
const cron = require('node-cron');
const { scheduleBirthdayJob } = require('./cron/birthdayJob');

let birthdayService;

// Start WhatsApp connection
async function startBot() {
    try {
        // Connect to WhatsApp
        const whatsappConnection = new WhatsAppConnection();
        const sock = await whatsappConnection.connect();

        // Initialize birthday service
        birthdayService = new BirthdayService(whatsappConnection);
        birthdayService.initializeScheduler();

        // Schedule birthday check job
        cron.schedule('0 0 * * *', () => scheduleBirthdayJob(sock));

        // Add message handler
        whatsappConnection.addMessageHandler(messageHandler.handleMessage.bind(messageHandler));

        console.log('WhatsApp Birthday Bot started successfully!');
        
        // Send startup notification
        if (process.env.ADMIN_NUMBER) {
            await whatsappConnection.sendTextMessage(
                process.env.ADMIN_NUMBER,
                '🤖 WhatsApp Birthday Bot is now online! 🎉'
            );
        }

    } catch (error) {
        console.error('Error starting bot:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    try {
        if (birthdayService) {
            birthdayService.stopScheduler();
        }
        await db.close();
        console.log('Bot shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    try {
        if (birthdayService) {
            birthdayService.stopScheduler();
        }
        await db.close();
    } catch (err) {
        console.error('Error during emergency shutdown:', err);
    }
    process.exit(1);
});

// Start the bot
startBot();
