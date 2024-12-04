const config = require('../config/config');
const { ValidationError, CommandError } = require('../utils/errors');
const { validateDate, validatePhoneNumber } = require('../utils/validators');

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.commandValidators = new Map();
        this.sock = null;
        this.initializeValidators();
    }

    setSocket(sock) {
        this.sock = sock;
    }

    initializeValidators() {
        // Add Birthday Command Validators
        this.commandValidators.set(config.bot.commands.addBirthday, this.validateAddBirthday);
        this.commandValidators.set(config.bot.commands.removeBirthday, this.validateRemoveBirthday);
        this.commandValidators.set(config.bot.commands.updateBirthday, this.validateUpdateBirthday);
        this.commandValidators.set(config.bot.commands.searchBirthday, this.validateSearchBirthday);
    }

    // Command parsing
    parseCommand(messageContent) {
        if (!messageContent || typeof messageContent !== 'string') {
            return null;
        }

        try {
            const [command, ...rawArgs] = messageContent.split('.');
            const args = rawArgs.join('.').split(',').map(arg => arg.trim());

            return {
                command: command.toLowerCase(),
                args: args.filter(arg => arg !== '')
            };
        } catch (error) {
            throw new CommandError('Invalid command format');
        }
    }

    // Command registration
    registerCommand(command, handler) {
        this.commands.set(command, handler);
    }

    // Command execution
    async executeCommand(messageContent, message) {
        try {
            if (!this.sock) {
                console.error('Socket not initialized in CommandHandler');
                return false;
            }

            const parsedCommand = this.parseCommand(messageContent);
            if (!parsedCommand) return false;

            const { command, args } = parsedCommand;
            const handler = this.commands.get(command);

            if (!handler) {
                console.log('No handler found for command:', command); // Debug log
                return false;
            }

            // Validate command arguments if validator exists
            const validator = this.commandValidators.get(command);
            if (validator) {
                validator(args);
            }

            // Execute command
            await handler(message, args);
            return true;

        } catch (error) {
            console.error('Command execution error:', error); // Debug log
            if (message?.key?.remoteJid) {
                const errorMessage = error instanceof ValidationError || error instanceof CommandError
                    ? error.message
                    : 'An error occurred while executing the command';
                
                await this.sock.sendMessage(message.key.remoteJid, {
                    text: `❌ ${errorMessage}`
                });
            }
            return true;
        }
    }

    // Validation methods
    validateAddBirthday(args) {
        if (args.length !== 3) {
            throw new ValidationError('Required format: name, dd/mm/yyyy, phoneNumber');
        }

        const [name, birthDate, phoneNumber] = args;

        if (!name || name.length < 2) {
            throw new ValidationError('Name must be at least 2 characters long');
        }

        if (!validateDate(birthDate)) {
            throw new ValidationError('Invalid date format. Use dd/mm/yyyy');
        }

        if (!validatePhoneNumber(phoneNumber)) {
            throw new ValidationError('Invalid phone number format');
        }
    }

    validateRemoveBirthday(args) {
        if (args.length !== 1) {
            throw new ValidationError('Required format: phoneNumber');
        }

        const [phoneNumber] = args;
        if (!validatePhoneNumber(phoneNumber)) {
            throw new ValidationError('Invalid phone number format');
        }
    }

    validateUpdateBirthday(args) {
        if (args.length !== 3) {
            throw new ValidationError('Required format: name, dd/mm/yyyy, phoneNumber');
        }

        const [name, birthDate, phoneNumber] = args;

        if (!name || name.length < 2) {
            throw new ValidationError('Name must be at least 2 characters long');
        }

        if (!validateDate(birthDate)) {
            throw new ValidationError('Invalid date format. Use dd/mm/yyyy');
        }

        if (!validatePhoneNumber(phoneNumber)) {
            throw new ValidationError('Invalid phone number format');
        }
    }

    validateSearchBirthday(args) {
        if (args.length !== 1) {
            throw new ValidationError('Required format: searchTerm');
        }

        const [searchTerm] = args;
        if (!searchTerm || searchTerm.length < 2) {
            throw new ValidationError('Search term must be at least 2 characters long');
        }
    }
}

module.exports = new CommandHandler();
