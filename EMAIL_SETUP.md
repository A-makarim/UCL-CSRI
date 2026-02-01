# Automatic Email Quote Setup

## Overview
The "Send Quote Automatically" button allows users to send property inquiry emails directly from the chat panel without opening Gmail manually.

## Setup Instructions

### 1. Get Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security**
3. Enable **2-Step Verification** (if not already enabled)
4. Go to **App passwords**: https://myaccount.google.com/apppasswords
5. Select app: **Mail**
6. Select device: **Other (Custom name)** → Enter "UCL-CSRI"
7. Click **Generate**
8. Copy the 16-character password (remove spaces)

### 2. Configure .env File

Open `E:\projects\UCL-CSRI\.env` and fill in these variables:

```env
# Gmail configuration for automatic email sending
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
DEFAULT_SELLER_EMAIL=property-seller@example.com
```

**Example:**
```env
GMAIL_USER=john.doe@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
DEFAULT_SELLER_EMAIL=listings@realestate.com
```

### 3. Restart Backend Server

After updating .env, restart the backend:

```powershell
cd E:\projects\UCL-CSRI
node server.cjs
```

## How It Works

1. User clicks a **live property** in Points mode
2. AI chat panel opens with property details
3. User clicks **"Send Quote Automatically"** button
4. Backend sends a professional HTML email via Gmail SMTP
5. Success/error message appears above the button

## Email Template

The email includes:
- Property address
- Price, bedrooms, bathrooms
- Property size (if available)
- Listing URL link
- Professional inquiry message requesting viewing

## Security Notes

- **Never commit .env file to Git** (already in .gitignore)
- Gmail App Password is different from your regular password
- App passwords are specific to applications and more secure
- You can revoke app passwords anytime from Google Account settings

## Troubleshooting

**Error: "Email service not configured"**
- Fill in GMAIL_USER and GMAIL_APP_PASSWORD in .env
- Restart backend server

**Error: "Invalid credentials"**
- Check if 2-Step Verification is enabled
- Generate a new App Password
- Remove spaces from app password

**Error: "Network error"**
- Check if backend is running on http://localhost:3002
- Verify firewall isn't blocking the connection

## Testing

1. Open http://localhost:3001
2. Switch to **Points** → **Live** mode
3. Click any property point
4. Click **"Send Quote Automatically"**
5. Check configured email inbox for sent message
