const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    jidDecode
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const logger = pino({ level: 'warn' });
const messageHandler = require('./messageHandler');
const commandHandler = require('../handlers/commandHandler');

// Create store to handle message history
const store = makeInMemoryStore({ logger });
store.readFromFile('./baileys_store.json');
setInterval(() => {
    store.writeToFile('./baileys_store.json');
}, 10000);

class WhatsAppConnection {
    constructor() {
        this.sock = null;
        this.qr = null;
        this.authenticated = false;
        this.messageHandlers = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // Initialize connection
    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
            const { version } = await fetchLatestBaileysVersion();

            // Updated connection configuration
            this.sock = makeWASocket({
                version,
                logger,
                printQRInTerminal: true,
                auth: state,
                browser: ["Chrome (Linux)", "", ""],
                connectTimeoutMs: 60000,
                qrTimeout: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: true,
                markOnlineOnConnect: true,
                syncFullHistory: false,
                generateHighQualityLinkPreview: false,
                getMessage: async () => {
                    return { conversation: 'hello' };
                }
            });

            // Set socket in handlers
            messageHandler.setSocket(this.sock);
            commandHandler.setSocket(this.sock);

            store.bind(this.sock.ev);

            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qr = qr;
                    console.log('\n=========================');
                    console.log('Please scan the QR code above with your WhatsApp mobile app:');
                    console.log('1. Open WhatsApp on your phone');
                    console.log('2. Tap Menu or Settings and select Linked Devices');
                    console.log('3. Tap on "Link a Device"');
                    console.log('4. Point your phone to this screen to capture the QR code');
                    console.log('Note: If scanning fails, try these steps:');
                    console.log('- Make sure you\'re using the latest WhatsApp version');
                    console.log('- Clear your linked devices and try again');
                    console.log('- Restart WhatsApp on your phone');
                    console.log('=========================\n');
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    console.log('Connection closed due to:', lastDisconnect?.error?.output?.payload?.message);
                    
                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                        setTimeout(async () => {
                            await this.connect();
                        }, 5000);
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        // Only clear auth info if logged out
                        console.log('Logged out from WhatsApp. Clearing auth info...');
                        if (fs.existsSync('./auth_info_baileys')) {
                            fs.rmSync('./auth_info_baileys', { recursive: true, force: true });
                        }
                        console.log('Please restart the bot and scan QR code again.');
                        process.exit(1);
                    } else {
                        console.log('Connection closed. Please restart the bot.');
                        process.exit(1);
                    }
                }

                if (connection === 'open') {
                    this.authenticated = true;
                    this.reconnectAttempts = 0;
                    console.log('Connected to WhatsApp');

                    // Send connection notification to the user's own number
                    const userPhoneNumber = this.sock.user.id.split(':')[0];
                    this.sock.sendMessage(`${userPhoneNumber}@s.whatsapp.net`, {
                        text: ' Smart Bot is now connected and ready.🎉' 
                    });
                }
            });

            // Save credentials on update
            this.sock.ev.on('creds.update', saveCreds);

            // Handle messages
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type === 'notify') {
                    for (const message of messages) {
                        try {
                            await messageHandler.handleMessage(message);
                        } catch (error) {
                            console.error('Error in message handler:', error);
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error in connect:', error);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`Retrying connection... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                setTimeout(async () => {
                    await this.connect();
                }, 5000);
            } else {
                console.log('Failed to connect after maximum attempts. Please restart the bot.');
                process.exit(1);
            }
        }
    }

    // Add message handler
    addMessageHandler(handler) {
        this.messageHandlers.add(handler);
    }

    // Remove message handler
    removeMessageHandler(handler) {
        this.messageHandlers.delete(handler);
    }

    // Send text message
    async sendTextMessage(to, text) {
        if (!this.sock || !this.authenticated) {
            throw new Error('WhatsApp is not connected');
        }
        try {
            await this.sock.sendMessage(to, { text });
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }
}

// Export singleton instance
const whatsapp = new WhatsAppConnection();
module.exports = whatsapp;
