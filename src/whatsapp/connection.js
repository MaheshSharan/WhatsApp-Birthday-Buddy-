const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');

class WhatsAppConnection {
    constructor() {
        this.sock = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.authPath = './auth_info_baileys';
        this.isSetupMode = process.argv.includes('--setup');
        this.messageHandlers = new Set();
    }

    async prepareAuth() {
        await fs.ensureDir(this.authPath);
        
        // Check for compressed auth files
        const files = await fs.readdir(this.authPath);
        for (const file of files) {
            if (file.endsWith('.gz')) {
                const originalPath = path.join(this.authPath, file.slice(0, -3));
                const compressedPath = path.join(this.authPath, file);
                const compressed = await fs.readFile(compressedPath);
                const decompressed = zlib.gunzipSync(compressed);
                await fs.writeFile(originalPath, decompressed);
                if (!this.isSetupMode) {
                    await fs.remove(compressedPath);
                }
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
        if (!this.sock) {
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

    async connect() {
        try {
            await this.prepareAuth();
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

            // Create socket with QR code display enabled
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false
            });

            // Return a promise that resolves when connection is successful
            return new Promise((resolve, reject) => {
                let credentialsUpdated = false;

                // Handle credential updates
                this.sock.ev.on('creds.update', async () => {
                    await saveCreds();
                    credentialsUpdated = true;
                    
                    // If we're connected and credentials are updated, we can resolve
                    if (this.sock?.user && credentialsUpdated) {
                        resolve(this.sock);
                    }
                });

                this.sock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect } = update;

                    if (connection === 'close') {
                        const shouldReconnect = (lastDisconnect?.error instanceof Boom) ? 
                            lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
                        
                        if (shouldReconnect && this.retryCount < this.maxRetries) {
                            this.retryCount++;
                            console.log(`Connection closed. Retry attempt ${this.retryCount}/${this.maxRetries}`);
                            await this.connect();
                        } else if (this.retryCount >= this.maxRetries) {
                            const error = new Error('Max retry attempts reached. Please check your connection and restart the bot.');
                            console.error(error);
                            reject(error);
                        }
                    } else if (connection === 'open') {
                        console.log('Connected to WhatsApp');
                        this.retryCount = 0;

                        // If we're connected and credentials are updated, we can resolve
                        if (this.sock?.user && credentialsUpdated) {
                            resolve(this.sock);
                        }
                    }
                });

                // Set a timeout in case the connection takes too long
                setTimeout(() => {
                    if (!this.sock?.user) {
                        reject(new Error('Connection timeout. Please try again.'));
                    }
                }, 60000); // 60 second timeout
            });
        } catch (error) {
            console.error('Error in connect:', error);
            throw error;
        }
    }
}

// Export singleton instance
const whatsapp = new WhatsAppConnection();
module.exports = whatsapp;
