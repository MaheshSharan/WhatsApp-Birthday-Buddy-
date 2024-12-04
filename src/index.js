require('dotenv').config();
const WhatsAppConnection = require('./whatsapp/connection');
const messageHandler = require('./whatsapp/messageHandler');
const BirthdayService = require('./services/birthdayService');
const db = require('./database/db');
const cron = require('node-cron');
const { scheduleBirthdayJob } = require('./cron/birthdayJob');

let birthdayService;
let whatsappConnection;

async function startBot() {
    try {
        // Connect to WhatsApp
        whatsappConnection = new WhatsAppConnection();
        await whatsappConnection.connect(); // Wait for full connection

        // Initialize birthday service
        birthdayService = new BirthdayService(whatsappConnection);
        birthdayService.initializeScheduler();

        // Schedule birthday check job
        cron.schedule('0 0 * * *', () => scheduleBirthdayJob(whatsappConnection.sock));

        console.log('WhatsApp Birthday Bot started successfully!');
        
        // Send startup notification only after connection is established
        if (process.env.OWNER_NUMBER && whatsappConnection.isConnected) {
            try {
                await whatsappConnection.sendMessage(
                    process.env.OWNER_NUMBER + '@s.whatsapp.net',
                    { text: '🤖 WhatsApp Birthday Bot is now online! 🎉' }
                );
            } catch (error) {
                console.log('Could not send startup notification:', error.message);
                // Don't exit the process, as the bot is still working
            }
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
