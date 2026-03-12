# Email Configuration Guide

## Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** and add your email credentials:
   ```env
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   FROM_EMAIL=your-email@gmail.com
   ```

3. **Restart your FastAPI server** for changes to take effect.

## Gmail Setup (Recommended for Testing)

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification if not already enabled

### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Other (Custom name)"
3. Enter "FastAPI App" as the name
4. Click "Generate"
5. Copy the 16-character password (spaces don't matter)

### Step 3: Configure .env File
```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # The app password from step 2
FROM_EMAIL=your-email@gmail.com
```

**Important:** Use the App Password, NOT your regular Gmail password!

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
FROM_EMAIL=your-email@outlook.com
```

### Yahoo Mail
```env
SMTP_SERVER=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USERNAME=your-email@yahoo.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@yahoo.com
```

### Custom SMTP Server
```env
SMTP_SERVER=mail.yourdomain.com
SMTP_PORT=587
SMTP_USERNAME=your-email@yourdomain.com
SMTP_PASSWORD=your-password
FROM_EMAIL=your-email@yourdomain.com
```

## Testing Email Configuration

1. Start your FastAPI server
2. Sign up a new user
3. Check the console - you should see:
   - ✅ "Email sent successfully" (or similar)
   - ❌ No "SMTP credentials not configured" warning
4. Check the user's email inbox for the verification code

## Troubleshooting

### "Authentication failed" error
- **Gmail**: Make sure you're using an App Password, not your regular password
- **Other providers**: Check if you need to enable "Less secure app access" or use an app password

### "Connection refused" error
- Check your firewall settings
- Verify SMTP_PORT is correct (usually 587 for TLS)
- Some networks block SMTP ports - try a different network

### Email not received
- Check spam/junk folder
- Verify the email address is correct
- Check server logs for error messages
- Make sure SMTP credentials are correct

## Security Notes

- **Never commit `.env` file to git** - it contains sensitive credentials
- Use App Passwords instead of regular passwords when possible
- For production, consider using email services like:
  - SendGrid
  - Mailgun
  - Amazon SES
  - Postmark

## Development Mode

If you don't want to configure email for development:
- The verification code will be shown in the console
- The code will also be displayed on the verification page
- You can still test the verification flow
