const config = require('../config/config');
const db = require('../database/db');
const { formatPhoneNumber, formatDate } = require('../utils/validators');
const aiService = require('../services/aiService');
const fs = require('fs').promises;

class MessageHandler {
    constructor() {
        this.sock = null;
        this.birthdayCommands = new Map([
            ['addBD', this.handleAddBirthday.bind(this)],
            ['removeBD', this.handleRemoveBirthday.bind(this)],
            ['listBD', this.handleListBirthdays.bind(this)],
            ['AFK', this.handleAfkEnable.bind(this)],
            ['AFKOFF', this.handleAfkDisable.bind(this)],
            ['status', this.handleStatus.bind(this)]
        ]);
        this.ownerNumber = process.env.OWNER_NUMBER || '';
        this.db = new db();
        this.initStartTime();
    }

    async initStartTime() {
        try {
            // Try to get existing start time
            const startTime = await this.db.getStartTime();
            if (!startTime) {
                // If no start time exists, set it
                await this.db.setStartTime(Date.now());
            }
        } catch (error) {
            console.error('Error initializing start time:', error);
        }
    }

    // Set the socket connection
    setSocket(sock) {
        this.sock = sock;
    }

    initializeCommands() {
        // Initialize birthday commands with their handlers (all lowercase)
        this.birthdayCommands.set(config.bot.commands.addBirthday.toLowerCase(), this.handleAddBirthday.bind(this));
        this.birthdayCommands.set(config.bot.commands.removeBirthday.toLowerCase(), this.handleRemoveBirthday.bind(this));
        this.birthdayCommands.set(config.bot.commands.updateBirthday.toLowerCase(), this.handleUpdateBirthday.bind(this));
        this.birthdayCommands.set(config.bot.commands.listBirthdays.toLowerCase(), this.handleListBirthdays.bind(this));
        this.birthdayCommands.set(config.bot.commands.searchBirthday.toLowerCase(), this.handleSearchBirthday.bind(this));
        this.birthdayCommands.set(config.bot.commands.importBirthdays.toLowerCase(), this.handleImportBirthdays.bind(this));
    }

    async handleMessage(message) {
        try {
            if (!this.sock) {
                console.error('Socket not initialized in MessageHandler');
                return;
            }

            if (!message || !message.message) return;

            // Extract the message content
            const messageContent = message.message?.conversation || 
                                 message.message?.extendedTextMessage?.text || 
                                 message.message?.imageMessage?.caption || '';

            if (!messageContent) return;

            // Get the remote JID (sender's ID)
            const remoteJid = message.key?.remoteJid;
            if (!remoteJid) return;

            const senderNumber = message.key.remoteJid.split('@')[0];
            const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            
            // Check if this is a command
            if (messageText.startsWith('@smartbot ')) {
                const [command, ...args] = messageText.slice(10).split('.');
                const handler = this.birthdayCommands.get(command);
                
                if (handler) {
                    console.log('Found birthday command handler');
                    await handler(message, args);
                    return;
                }
            }

            // If sender is owner and not a command, disable AFK
            if (senderNumber === this.ownerNumber && !messageText.startsWith('@smartbot')) {
                const wasAfk = await this.db.isAfk();
                if (wasAfk) {
                    await this.db.disableAfk();
                    // Notify only in owner's chat
                    await this.sock.sendMessage(this.ownerNumber + '@s.whatsapp.net', {
                        text: '🌅 AFK mode automatically disabled.'
                    });
                }
                return;
            }

            // Check if owner is AFK and this is not the owner
            if (senderNumber !== this.ownerNumber) {
                const ownerAfk = await this.db.isAfk();
                if (ownerAfk) {
                    // Don't reply to business/promotional messages
                    if (message.key.remoteJid.includes('business') || 
                        messageText.toLowerCase().includes('offer') || 
                        messageText.toLowerCase().includes('discount') ||
                        messageText.toLowerCase().includes('sale')) {
                        return;
                    }

                    // Send AFK response
                    await this.sock.sendMessage(message.key.remoteJid, {
                        text: '🌙 Master is AFK, I will make sure your message reaches them.'
                    });
                }
            }

            // If it's a command
            if (messageContent.startsWith(config.bot.prefix)) {
                // Get quoted message if exists
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedText = quotedMessage?.conversation || 
                                 quotedMessage?.extendedTextMessage?.text || 
                                 quotedMessage?.imageMessage?.caption || '';

                // Extract command and arguments
                const fullCommand = messageContent.slice(config.bot.prefix.length).trim();
                const [commandName, ...args] = fullCommand.split(/[.,]/).map(part => part.trim());
                const lowerCommandName = commandName.toLowerCase();
                
                console.log('Processing command:', lowerCommandName); // Debug log

                // Check if it's a birthday command
                const handler = this.birthdayCommands.get(lowerCommandName);
                
                if (handler) {
                    console.log('Found birthday command handler'); // Debug log
                    try {
                        // Handle CSV file import specially
                        if (lowerCommandName === config.bot.commands.importBirthdays.toLowerCase()) {
                            await this.sock.sendMessage(remoteJid, {
                                text: '📝 To import birthdays:\n' +
                                     '1. Create a CSV file with columns: name, birthdate, phone\n' +
                                     '2. Send the CSV file\n' +
                                     '3. Reply to the CSV file with "@smartbot importBD"'
                            });
                            return;
                        }

                        // Execute the birthday command
                        await handler(message, args);
                    } catch (error) {
                        console.error('Birthday command error:', error);
                        await this.sock.sendMessage(remoteJid, {
                            text: `❌ Error: ${error.message}`
                        });
                    }
                    return;
                } else {
                    console.log('No birthday command handler found, treating as AI query'); // Debug log
                }

                // If not a birthday command, handle as AI query
                let response;
                if (quotedText) {
                    console.log('Processing quoted message:', quotedText);
                    response = await aiService.processQuery(quotedText);
                } else {
                    // If no quoted message, use the command text as query
                    const query = fullCommand;
                    response = await aiService.processQuery(query);
                }

                // Edit the original message
                await this.sock.sendMessage(remoteJid, { 
                    edit: message.key,
                    text: response,
                    quoted: quotedMessage ? message.message.extendedTextMessage.contextInfo : undefined
                });
            }
        } catch (error) {
            console.error('Error in message handler:', error);
            if (message?.key?.remoteJid) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    text: '❌ Sorry, there was an error processing your message. Error: ' + error.message
                });
            }
        }
    }

    async handleAddBirthday(message) {
        if (!message?.key?.remoteJid) return;

        try {
            const commandText = message.message.conversation || message.message.extendedTextMessage?.text || '';
            const match = commandText.match(/addBD\.(.*),(.*),(.*)$/);
            
            if (!match) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: '❌ Invalid format! Use: @smartbot addBD.Name,DD/MM/YYYY,+PhoneNumber'
                });
                return;
            }

            const [, name, birthDate, phoneNumber] = match.map(item => item.trim());
            
            // Validate date format
            const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
            if (!dateRegex.test(birthDate)) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: '❌ Invalid date format! Use DD/MM/YYYY'
                });
                return;
            }

            // Validate phone number format
            const phoneRegex = /^\+\d{1,3}\d{10}$/;
            if (!phoneRegex.test(phoneNumber)) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: '❌ Invalid phone number! Use international format (e.g., +916376197377)'
                });
                return;
            }

            // Validate date is not in future
            const [day, month, year] = birthDate.split('/').map(Number);
            const birthDateObj = new Date(year, month - 1, day); // month is 0-based
            if (birthDateObj > new Date()) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: '❌ Birth date cannot be in the future!'
                });
                return;
            }

            await this.db.addBirthday(name, birthDate, phoneNumber);
            
            // Calculate days until next birthday
            const today = new Date();
            const nextBirthday = new Date(today.getFullYear(), month - 1, day);
            if (nextBirthday < today) {
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }
            const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
            
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: `✅ Birthday added successfully!\nName: ${name}\nDate: ${birthDate}\nPhone: ${phoneNumber}\n\n${daysUntil === 0 ? "🎉 It's their birthday today!" : `🗓️ ${daysUntil} days until their next birthday!`}`
            });
        } catch (error) {
            // Handle duplicate phone number error
            if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed: birthdays.phone_number')) {
                console.log(`Attempted to add duplicate phone number: ${phoneNumber}`);
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: `❌ This phone number is already registered!\n\nUse @smartbot listBD to see existing entries\nOr use @smartbot removeBD.+PhoneNumber to remove the existing entry.`
                });
                return;
            }
            
            // Log other errors with a cleaner message
            console.error('Birthday addition error:', error.message);
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleRemoveBirthday(message, args) {
        if (!message?.key?.remoteJid) return;
        
        try {
            const [phoneNumber] = args;
            const formattedPhone = formatPhoneNumber(phoneNumber);

            await this.db.removeBirthday(formattedPhone);
            
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `✅ Birthday removed successfully for ${formattedPhone}`
            });
        } catch (error) {
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleUpdateBirthday(message, args) {
        if (!message?.key?.remoteJid) return;
        
        try {
            const [name, birthDate, phoneNumber] = args;
            const formattedPhone = formatPhoneNumber(phoneNumber);
            const formattedDate = formatDate(birthDate);

            await this.db.updateBirthday(name, formattedDate, formattedPhone);
            
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `✅ Birthday updated successfully!\nName: ${name}\nDate: ${formattedDate}\nPhone: ${formattedPhone}`
            });
        } catch (error) {
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleListBirthdays(message) {
        if (!message?.key?.remoteJid) return;
        
        try {
            const birthdays = await this.db.listBirthdays();
            
            if (!birthdays || birthdays.length === 0) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    text: '📅 No birthdays found!\n\n' +
                         'To add a birthday, use:\n' +
                         '@smartbot addBD.Name,DD/MM/YYYY,+PhoneNumber\n\n' +
                         'Example:\n' +
                         '@smartbot addBD.John Doe,01/01/1990,+1234567890'
                });
                return;
            }

            const birthdayList = birthdays
                .map(b => {
                    // Format the date to be more readable
                    const date = new Date(b.birth_date);
                    const formattedDate = date.toLocaleDateString('en-US', {
                        day: '2-digit',
                        month: '2-digit'
                    });
                    return `📌 ${b.name} - ${formattedDate} (${b.phone_number})`;
                })
                .join('\n');

            await this.sock.sendMessage(message.key.remoteJid, {
                text: `📅 Birthday List:\n${birthdayList}`
            });
        } catch (error) {
            console.error('Error listing birthdays:', error);
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleSearchBirthday(message, args) {
        if (!message?.key?.remoteJid) return;
        
        try {
            const [searchTerm] = args;
            const results = await this.db.searchBirthday(searchTerm);
            
            if (results.length === 0) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    text: `🔍 No birthdays found for "${searchTerm}"`
                });
                return;
            }

            const resultList = results.map(b => 
                `📌 ${b.name} - ${b.birthDate} (${b.phoneNumber})`
            ).join('\n');

            await this.sock.sendMessage(message.key.remoteJid, {
                text: `🔍 Search Results:\n${resultList}`
            });
        } catch (error) {
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleImportBirthdays(message) {
        if (!message?.key?.remoteJid) return;
        
        try {
            // Check if there's a CSV file attached
            const csvFile = message.message?.documentMessage;
            if (!csvFile) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    text: '❌ Please attach a CSV file with the following columns: name, birthdate, phone'
                });
                return;
            }

            // Download the CSV file
            const buffer = await this.sock.downloadMediaMessage(message);
            const tempPath = './temp_import.csv';
            
            // Save the buffer to a temporary file
            await fs.promises.writeFile(tempPath, buffer);

            // Import the birthdays
            const bulkImporter = require('../utils/bulkImport');
            const result = await bulkImporter.importFromCSV(tempPath);

            // Delete the temporary file
            await fs.promises.unlink(tempPath);

            // Send result message
            const resultMessage = `✅ Import completed!\n` +
                `Successfully imported: ${result.success}\n` +
                `Failed to import: ${result.failed}\n\n` +
                (result.errors.length > 0 ? 
                    `Errors:\n${result.errors.map(e => `- Row: ${JSON.stringify(e.record)}\n  Error: ${e.error}`).join('\n')}`
                    : '');

            await this.sock.sendMessage(message.key.remoteJid, {
                text: resultMessage
            });
        } catch (error) {
            await this.sock.sendMessage(message.key.remoteJid, {
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleAfkEnable(message) {
        if (!message?.key?.remoteJid) return;
        
        try {
            const senderNumber = message.key.remoteJid.split('@')[0];
            
            // Only owner can set AFK
            if (senderNumber !== this.ownerNumber) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: '❌ Only the bot owner can use AFK commands'
                });
                return;
            }

            await this.db.setAfk();
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: '🌙 AFK mode enabled. I will respond to messages on your behalf.'
            });
        } catch (error) {
            console.error('AFK enable error:', error.message);
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: `❌ Error: ${error.message}`
            });
        }
    }

    async handleAfkDisable(message) {
        if (!message?.key?.remoteJid) return;
        
        try {
            const senderNumber = message.key.remoteJid.split('@')[0];
            
            // Only owner can disable AFK
            if (senderNumber !== this.ownerNumber) {
                await this.sock.sendMessage(message.key.remoteJid, {
                    edit: message.key,
                    text: '❌ Only the bot owner can use AFK commands'
                });
                return;
            }

            await this.db.disableAfk();
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: '🌅 AFK mode disabled. Welcome back!'
            });
        } catch (error) {
            console.error('AFK disable error:', error.message);
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: `❌ Error: ${error.message}`
            });
        }
    }

    // Get formatted uptime
    async getUptime() {
        try {
            const startTime = await this.db.getStartTime();
            if (!startTime) return '0m'; // Fallback if no start time

            const uptime = Date.now() - startTime;
            const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
            const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
            
            let uptimeStr = '';
            if (days > 0) uptimeStr += `${days}d `;
            if (hours > 0) uptimeStr += `${hours}h `;
            uptimeStr += `${minutes}m`;
            
            return uptimeStr;
        } catch (error) {
            console.error('Error getting uptime:', error);
            return 'Error calculating uptime';
        }
    }

    // Get month name from number
    getMonthName(month) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[parseInt(month) - 1];
    }

    // Handle status command
    async handleStatus(message) {
        if (!message?.key?.remoteJid) return;

        try {
            // Get birthday statistics
            const stats = await this.db.getBirthdayStats();
            
            // Get AFK status
            const afkStatus = await this.db.isAfk();
            
            // Format month distribution
            const monthDistribution = stats.byMonth
                .map(m => `${this.getMonthName(m.month)}: ${m.count} 👤`)
                .join('\n');

            const statusMessage = `🤖 *WhatsApp Birthday Bot Status*\n\n` +
                `⏱️ Uptime: ${await this.getUptime()}\n` +
                `📊 Statistics:\n` +
                `├ Total Birthdays: ${stats.total} 🎂\n` +
                `├ Upcoming (7 days): ${stats.upcoming} 🎯\n` +
                `└ AFK Status: ${afkStatus ? '🌙 Enabled' : '🌅 Disabled'}\n\n` +
                `📅 Birthday Distribution:\n${monthDistribution}\n\n` +
                `🔧 System Info:\n` +
                `├ Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n` +
                `└ Node Version: ${process.version}`;

            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: statusMessage
            });
        } catch (error) {
            console.error('Status error:', error.message);
            await this.sock.sendMessage(message.key.remoteJid, {
                edit: message.key,
                text: `❌ Error getting status: ${error.message}`
            });
        }
    }
}

module.exports = new MessageHandler();
