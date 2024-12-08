const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.securityLogPath = path.join(this.logDir, 'security.log');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('Error creating log directory:', error);
        }
    }

    async logSecurity(type, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            ...data
        };

        try {
            const logLine = JSON.stringify(logEntry) + '\n';
            await fs.appendFile(this.securityLogPath, logLine);
        } catch (error) {
            console.error('Error writing security log:', error);
        }
    }

    async logSuspiciousNumber(number, messageContent, context = {}) {
        await this.logSecurity('SUSPICIOUS_NUMBER', {
            number,
            messageContent,
            ...context
        });
    }

    async logInvalidAccess(number, command, context = {}) {
        await this.logSecurity('INVALID_ACCESS', {
            number,
            command,
            ...context
        });
    }
}

module.exports = new Logger();
