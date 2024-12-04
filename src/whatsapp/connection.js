const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const logger = require('pino')();
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
                logger
            });

            this.sock = sock;
            this.messageHandler.sock = sock;

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qr = qr;
                    console.log('QR Code received. Scan it to authenticate!');
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                    
                    if (shouldReconnect) {
                        await this.connect();
                    }
                } else if (connection === 'open') {
                    console.log('Connected successfully!');
                    this.isConnected = true;
                    this.qr = null;
                }
            });

            // Handle messages
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type === 'notify') {
                    for (const message of messages) {
                        await this.messageHandler.handleMessage(message);
                    }
                }
            });

            // Handle credentials update
            sock.ev.on('creds.update', saveCreds);

            return sock;
        } catch (error) {
            console.error('Error in connect:', error);
            throw error;
        }
    }

    async sendMessage(jid, content) {
        try {
            await this.sock.sendMessage(jid, content);
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}

module.exports = WhatsAppConnection;
