# WhatsApp Birthday Bot Deployment Guide

## Initial Setup

### Step 1: Fork and Clone
1. Fork this repository to your GitHub account
2. **Important**: Make your forked repository **private** to protect your WhatsApp session
3. Clone your forked repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/WhatsApp-Birthday-Bot.git
   cd WhatsApp-Birthday-Bot
   ```

### Step 2: Local Setup
1. Run the setup script:
   ```bash
   node setup.js
   ```
   This will:
   - Install dependencies
   - Start the bot for initial authentication

2. When the QR code appears in terminal:
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices
   - Click "Link a Device"
   - Scan the QR code shown in your terminal
3. Wait for the "Authentication successful!" message

### Step 3: Commit Auth Files
1. After successful authentication, commit the entire auth_info_baileys folder:
   ```bash
   git add auth_info_baileys/
   git commit -m "Add authentication files"
   git push origin main
   ```

## Deployment to Render

### Step 1: Connect to Render
1. Go to [render.com](https://render.com)
2. Sign up/Login with your GitHub account
3. Click "New +" and select "Web Service"
4. Find and select your private WhatsApp-Birthday-Bot repository

### Step 2: Configure Web Service
1. Fill in the following details:
   - **Name**: `whatsapp-birthday-bot` (or any name you prefer)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: Free plan is fine

2. Add Environment Variables:
   - `NODE_ENV`: production
   - `BOT_PREFIX`: Your preferred prefix
   - `OWNER_NUMBER`: Your WhatsApp number
   - `HUGGINGFACE_API_KEY`: Your HuggingFace API key
   - `REMOVE_BG_API_KEY`: Your Remove.bg API key

3. Select Instance Type:
   - Free tier is sufficient for basic usage

4. Click "Create Web Service"

### Step 3: Verify Deployment
1. Wait for the deployment to complete
2. Check the logs for any errors
3. Test the bot by sending `!help` to your WhatsApp number

## Post-Deployment

### Monitoring
- Access the health check endpoint: `https://your-app-url/health`
- Monitor logs in Render dashboard
- Check WhatsApp connection status

### Troubleshooting

#### Bot Disconnects
1. Check Render logs for errors
2. Verify environment variables
3. Ensure auth files are properly committed

#### Auth Issues
1. Run setup script locally again
2. Commit new auth files
3. Redeploy on Render

#### Performance Issues
1. Monitor memory usage via health endpoint
2. Check Render resource limits
3. Consider upgrading to paid tier if needed

## Troubleshooting

### Bot Not Responding
1. Check Render logs for any errors
2. Verify that your repository is private
3. Make sure the `auth_info_baileys` folder was properly pushed to GitHub
4. If needed, run setup locally again and push fresh auth files

### Connection Issues
1. The bot might take a few minutes to start after deployment
2. If it doesn't connect after 5 minutes:
   - Check if your WhatsApp is connected to the internet
   - Verify in WhatsApp > Linked Devices if the session is still active
   - If session is lost, run setup locally again and push new auth files

## Security Notes

1. Keep your forked repository private
2. Never commit unencrypted auth files
3. Regularly rotate API keys
4. Monitor suspicious activities

## Maintenance

### Regular Updates
1. Pull latest changes from main repository
2. Test locally before deploying
3. Update dependencies regularly

### Backup
1. Regularly backup auth files
2. Export important data
3. Keep deployment configuration documented

## Important Notes
- Keep your repository **private** to protect your WhatsApp session
- Don't share your `auth_info_baileys` folder with anyone
- The bot needs to be connected to the internet to work
- You can only use the bot with one WhatsApp number at a time

## Need Help?

- Check the troubleshooting guide
- Review Render logs
- Open an issue on GitHub
- Contact the maintainers

Remember to always test changes locally before deploying to production!
