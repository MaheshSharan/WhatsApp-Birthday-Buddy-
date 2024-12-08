require('dotenv').config();
const path = require('path');

module.exports = {
    tempDir: path.join(__dirname, '../../temp'),
    defaults: {
        maxSize: 2 * 1024 * 1024, // 2MB
        quality: 80,
        maxDuration: 10, // seconds
        dimensions: {
            width: 512,
            height: 512
        },
        author: 'Mahe'
    },
    supported: {
        image: ['jpg', 'jpeg', 'png', 'webp'],
        video: ['mp4', 'gif']
    },
    removeBg: {
        apiKey: process.env.REMOVE_BG_API_KEY
    }
};
