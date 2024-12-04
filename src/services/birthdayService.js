const cron = require('node-cron');
const db = require('../database/db');
const config = require('../config/config');
const { formatDate } = require('../utils/validators');
const aiService = require('./aiService');

class BirthdayService {
    constructor(whatsappClient) {
        this.whatsapp = whatsappClient;
        this.scheduler = null;
    }

    // Initialize birthday scheduler
    initializeScheduler() {
        // Check for birthdays every day at midnight
        this.scheduler = cron.schedule('0 0 * * *', async () => {
            try {
                await this.sendBirthdayWishes();
            } catch (error) {
                console.error('Error in birthday scheduler:', error);
            }
        }, {
            timezone: config.birthdayWish.timezone
        });

        console.log('Birthday scheduler initialized');
    }

    // Send birthday wishes
    async sendBirthdayWishes() {
        try {
            // Get today's birthdays
            const todaysBirthdays = await db.getUpcomingBirthdays(0);
            console.log(`Found ${todaysBirthdays.length} birthdays for today`);

            for (const birthday of todaysBirthdays) {
                try {
                    // Generate AI birthday wish
                    const wish = await aiService.generateBirthdayWish(birthday.name);
                    await this.whatsapp.sendTextMessage(birthday.phone_number, wish);
                    console.log(`Birthday wish sent to ${birthday.name} (${birthday.phone_number})`);
                    
                    // Add small delay between messages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Error sending wish to ${birthday.name}:`, error);
                    // Send fallback wish if AI fails
                    const fallbackWish = `🎉 Happy Birthday ${birthday.name}! 🎂 Wishing you a fantastic day! 🎈✨`;
                    await this.whatsapp.sendTextMessage(birthday.phone_number, fallbackWish);
                }
            }
        } catch (error) {
            console.error('Error in sendBirthdayWishes:', error);
        }
    }

    // Add birthday
    async addBirthday(name, birthDate, phoneNumber) {
        try {
            const formattedDate = formatDate(birthDate);
            await db.addBirthday(name, formattedDate, phoneNumber);
            
            // Generate AI confirmation message
            try {
                const message = await aiService.processQuery(
                    `Generate a brief, friendly confirmation message for setting a birthday reminder for ${name} on ${formattedDate}`
                );
                await this.whatsapp.sendTextMessage(phoneNumber, message);
            } catch (error) {
                // Fallback message if AI fails
                await this.whatsapp.sendTextMessage(phoneNumber, 
                    `✅ Birthday reminder set for ${name} on ${formattedDate}`
                );
            }
            
            return true;
        } catch (error) {
            console.error('Error adding birthday:', error);
            throw error;
        }
    }

    // Remove birthday
    async removeBirthday(phoneNumber) {
        try {
            const success = await db.removeBirthday(phoneNumber);
            if (success) {
                const message = '✅ Your birthday reminder has been removed';
                await this.whatsapp.sendTextMessage(phoneNumber, message);
            }
            return success;
        } catch (error) {
            console.error('Error removing birthday:', error);
            throw error;
        }
    }

    // Update birthday
    async updateBirthday(name, birthDate, phoneNumber) {
        try {
            const formattedDate = formatDate(birthDate);
            const success = await db.updateBirthday(name, formattedDate, phoneNumber);
            
            if (success) {
                const message = `✅ Birthday reminder updated for ${name} to ${formattedDate}`;
                await this.whatsapp.sendTextMessage(phoneNumber, message);
            }
            
            return success;
        } catch (error) {
            console.error('Error updating birthday:', error);
            throw error;
        }
    }

    // List birthdays
    async listBirthdays() {
        try {
            return await db.listBirthdays();
        } catch (error) {
            console.error('Error listing birthdays:', error);
            throw error;
        }
    }

    // Search birthdays
    async searchBirthday(searchTerm) {
        try {
            return await db.searchBirthday(searchTerm);
        } catch (error) {
            console.error('Error searching birthdays:', error);
            throw error;
        }
    }

    // Get upcoming birthdays
    async getUpcomingBirthdays(days = 7) {
        try {
            const upcomingBirthdays = await db.getUpcomingBirthdays(days);
            return upcomingBirthdays.map(birthday => ({
                ...birthday,
                daysUntil: days
            }));
        } catch (error) {
            console.error('Error getting upcoming birthdays:', error);
            throw error;
        }
    }

    // Stop scheduler
    stopScheduler() {
        if (this.scheduler) {
            this.scheduler.stop();
            console.log('Birthday scheduler stopped');
        }
    }
}

module.exports = BirthdayService;
