const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupBot() {
    console.log('\n🤖 WhatsApp Birthday Bot Setup Wizard 🎂\n');

    console.log('\n📦 Installing dependencies...');
    await new Promise((resolve, reject) => {
        exec('npm install', (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Error installing dependencies:', error);
                reject(error);
                return;
            }
            console.log('✅ Dependencies installed successfully\n');
            resolve();
        });
    });

    console.log('🔄 Starting bot for initial setup...');
    console.log('📱 Please scan the QR code when it appears...\n');

    // Import the WhatsApp connection directly
    const whatsapp = require('./src/whatsapp/connection');
    
    try {
        // Connect to WhatsApp and wait for authentication
        const sock = await whatsapp.connect();
        
        if (!sock?.user) {
            throw new Error('Failed to authenticate with WhatsApp');
        }

        console.log('\n✅ Authentication successful!');
        console.log(`📱 Connected as: ${sock.user.name || sock.user.id}`);
        
        console.log('\n🎉 Setup completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Push the entire auth_info_baileys folder to your private repository');
        console.log('2. Deploy your bot using the instructions in DEPLOYMENT.md');
        
    } catch (error) {
        console.error('\n❌ Error during setup:', error);
    } finally {
        // Ensure we exit cleanly
        setTimeout(() => {
            rl.close();
            process.exit(0);
        }, 1000);
    }
}

setupBot().catch(console.error);
