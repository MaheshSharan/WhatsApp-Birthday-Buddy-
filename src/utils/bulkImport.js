const fs = require('fs');
const csv = require('csv-parse');
const db = require('../database/db');
const { formatPhoneNumber, formatDate } = require('./validators');

class BulkImporter {
    constructor() {
        this.successCount = 0;
        this.failureCount = 0;
        this.errors = [];
    }

    async importFromCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            
            fs.createReadStream(filePath)
                .pipe(csv.parse({ columns: true, trim: true }))
                .on('data', (data) => {
                    results.push(data);
                })
                .on('end', async () => {
                    try {
                        await this.processBirthdays(results);
                        resolve({
                            success: this.successCount,
                            failed: this.failureCount,
                            errors: this.errors
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    async processBirthdays(birthdays) {
        for (const record of birthdays) {
            try {
                const name = record.name?.trim();
                const birthDate = record.birthdate?.trim();
                const phoneNumber = record.phone?.trim();

                if (!name || !birthDate || !phoneNumber) {
                    throw new Error('Missing required fields');
                }

                const formattedPhone = formatPhoneNumber(phoneNumber);
                const formattedDate = formatDate(birthDate);

                await db.addBirthday(name, formattedDate, formattedPhone);
                this.successCount++;
            } catch (error) {
                this.failureCount++;
                this.errors.push({
                    record,
                    error: error.message
                });
            }
        }
    }
}

module.exports = new BulkImporter();
