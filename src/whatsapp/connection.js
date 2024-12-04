const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const logger = require('pino')();

class WhatsAppConnection {
    constructor() {
        this.sock = null;
        this.qr = null;
        this.isConnected = false;
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
            console.log(`Server running on port ${port}. Visit /qr to scan QR code.`);
        });
    }

    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: process.env.NODE_ENV !== 'production',
                browser: Browsers.ubuntu('Chrome'),
                logger: logger
            });

            // Handle QR code for production
            if (process.env.NODE_ENV === 'production') {
                this.sock.ev.on('connection.update', ({ qr }) => {
                    if (qr) {
                        this.qr = qr;
                        console.log('New QR code generated. Visit /qr to scan.');
                    }
                });
            }

            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
            
            return this.sock;
        } catch (error) {
            console.error('Error in connect:', error);
            throw error;
        }
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to:', lastDisconnect?.error, '\nReconnecting:', shouldReconnect);
            
            if (shouldReconnect) {
                this.connect();
            }
        } else if (connection === 'open') {
            console.log('Connected successfully!');
            this.isConnected = true;
            this.qr = null; // Clear QR code after successful connection
        }
    }
}

module.exports = WhatsAppConnection;
