# WhatsApp Birthday Buddy 

A WhatsApp bot that helps you remember and celebrate birthdays! Never miss wishing your friends and family on their special day.

## Features

- Automatic birthday reminders
- Easy WhatsApp login via QR code
- Persistent authentication
- Birthday management commands
- Web interface for QR code scanning

## Prerequisites

- Node.js >= 16.0.0
- A WhatsApp account
- Internet connection

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=production
DB_PATH=/opt/render/project/src/database/birthday.db
BOT_PREFIX=@smartbot
OWNER_NUMBER=your_whatsapp_number
```

## Deployment on Render

1. Fork this repository to your GitHub account

2. Create a new Web Service on Render:
   - Connect your GitHub repository
   - Select the branch to deploy
   - Choose Node.js as the runtime
   - Set build command: `npm install`
   - Set start command: `npm start`

3. Add Environment Variables:
   - Go to the "Environment" tab
   - Add all required environment variables from the `.env` section

4. Configure Disk Storage:
   - Under "Disk", create a new disk
   - Mount path: `/opt/render/project/src/database`
   - Size: 1GB (or as needed)

5. Deploy the service:
   - Click "Create Web Service"
   - Wait for the deployment to complete

6. Access the QR Code:
   - Visit your service URL to see the QR code
   - Scan with WhatsApp to authenticate

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-birthday-bot.git
cd whatsapp-birthday-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create and configure `.env` file

4. Start the development server:
```bash
npm run dev
```

## Commands

- `@smartbot add [name] [date]` - Add a birthday
- `@smartbot list` - List all birthdays
- `@smartbot remove [name]` - Remove a birthday
- `@smartbot help` - Show help message

## Support

For issues and feature requests, please create an issue in the GitHub repository.

## License

ISC License
