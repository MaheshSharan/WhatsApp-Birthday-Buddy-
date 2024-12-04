const cron = require('node-cron');
const db = require('../database/db');
const whatsapp = require('../whatsapp/connection');

// Schedule birthday check at midnight (00:00)
const scheduleBirthdayJob = () => {
    cron.schedule('0 0 * * *', async () => {
        try {
            // Get all birthdays
            const birthdays = await db.listBirthdays();
            const today = new Date();
            const currentMonth = today.getMonth() + 1; // JavaScript months are 0-based
            const currentDay = today.getDate();

            // Filter birthdays for today
            const todaysBirthdays = birthdays.filter(birthday => {
                const birthDate = new Date(birthday.birth_date);
                return birthDate.getDate() === currentDay && 
                       (birthDate.getMonth() + 1) === currentMonth;
            });

            // Send wishes for each birthday
            for (const birthday of todaysBirthdays) {
                try {
                    const message = `🎉 Happy Birthday ${birthday.name}! 🎂\n\nWishing you a fantastic day filled with joy and celebration! 🎈✨`;
                    
                    await whatsapp.sock.sendMessage(birthday.phone_number + '@s.whatsapp.net', {
                        text: message
                    });
                    
                    console.log(`Birthday wish sent to ${birthday.name} (${birthday.phone_number})`);
                } catch (error) {
                    console.error(`Error sending birthday wish to ${birthday.name}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in birthday job:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Set to Indian timezone
    });
};

module.exports = { scheduleBirthdayJob };
