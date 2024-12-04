const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const logger = require('pino')({ level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' });
const messageHandler = require('./messageHandler');

class WhatsAppConnection {
    constructor() {
        this.sock = null;
        this.qr = null;
        this.isConnected = false;
        this.messageHandler = messageHandler;
        this.authPath = process.env.NODE_ENV === 'production' 
            ? path.join('/opt/render/project/src/', 'auth_info_baileys')
            : path.join(__dirname, '..', '..', 'auth_info_baileys');
        
        // Create auth directory if it doesn't exist
        if (!fs.existsSync(this.authPath)) {
            fs.mkdirSync(this.authPath, { recursive: true });
        }

        // Setup express for QR code endpoint
        if (process.env.NODE_ENV === 'production') {
            this.setupQREndpoint();
        }
    }

    setupQREndpoint() {
        const app = express();
        const port = process.env.PORT || 3000;

        app.get('/', (req, res) => {
            res.send('WhatsApp Bot is running!');
        });

        app.get('/qr', async (req, res) => {
            if (this.isConnected) {
                return res.send('Bot is already connected!');
            }
            if (!this.qr) {
                return res.send('QR Code not generated yet. Please wait and refresh.');
            }
            try {
                const qrImage = await qrcode.toDataURL(this.qr);
                res.send(`<html><body><h1>Scan QR Code</h1><img src="${qrImage}"></body></html>`);
            } catch (error) {
                res.status(500).send('Error generating QR code');
            }
        });

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    }

    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: process.env.NODE_ENV !== 'production',
                browser: Browsers.ubuntu('Chrome'),
                logger,
                syncFullHistory: true
            });

            this.sock = sock;
            this.messageHandler.sock = sock;

            return new Promise((resolve, reject) => {
                let connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('Connection timeout after 60 seconds'));
                    }
                }, 60000);

                // Handle connection updates
                sock.ev.on('connection.update', async (update) => {
                    const { connection, lastDisconnect, qr } = update;

                    if (qr) {
                        this.qr = qr;
                        console.log('QR Code received. Scan it to authenticate!');
                    }

                    if (connection === 'close') {
                        const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                        console.log('Connection closed due to ', lastDisconnect?.error?.message || 'unknown reason', ', reconnecting ', shouldReconnect);
                        
                        if (shouldReconnect) {
                            await this.connect();
                        }
                    } else if (connection === 'open') {
                        clearTimeout(connectionTimeout);
                        console.log('Connected successfully!');
                        this.isConnected = true;
                        this.qr = null;
                        resolve(sock);
                    }
                });

                // Handle messages
                sock.ev.on('messages.upsert', async ({ messages, type }) => {
                    if (type === 'notify') {
                        for (const message of messages) {
                            try {
                                await this.messageHandler.handleMessage(message);
                            } catch (error) {
                                console.error('Error handling message:', error);
                            }
                        }
                    }
                });

                // Handle credentials update
                sock.ev.on('creds.update', saveCreds);
            });
        } catch (error) {
            console.error('Error in connect:', error);
            throw error;
        }
    }

    async sendMessage(jid, content) {
        if (!this.isConnected || !this.sock) {
            throw new Error('WhatsApp is not connected');
        }
        try {
            await this.sock.sendMessage(jid, content);
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}

module.exports = WhatsAppConnection;
