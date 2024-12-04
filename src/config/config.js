require('dotenv').config();

module.exports = {
    // Database Configuration
    database: {
        path: './database/birthday.db'
    },

    // AI Configuration
    ai: {
        apiKey: process.env.HUGGINGFACE_API_KEY,
        model: "Qwen/Qwen2.5-72B-Instruct",
        maxTokens: 2048,
        temperature: 0.7
    },

    // Bot Configuration
    bot: {
        prefix: '@smartbot',
        commands: {
            addBirthday: 'addBD',
            removeBirthday: 'removeBD',
            updateBirthday: 'updateBD',
            listBirthdays: 'listBD',
            searchBirthday: 'searchBD',
            importBirthdays: 'importBD'
        }
    },

    // Birthday Wish Configuration
    birthdayWish: {
        wishTime: '00:00', // 12 AM
        timezone: 'Asia/Kolkata' // Indian timezone
    }
};
