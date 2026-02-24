# Google OAuth Setup Guide

## Quick Setup

1. **Get your Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Copy your **Client ID**

2. **Create/Update `.env` file** in the project root (`c:\fastapi_practice\.env`):
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
   ```

3. **Update frontend environment** (`front_end\.env`):
   ```env
   REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
   ```

4. **Install backend dependencies:**
   ```bash
   pip install google-auth google-auth-oauthlib google-auth-httplib2
   ```
   Or install from requirements.txt:
   ```bash
   pip install -r requirements.txt
   ```

5. **Update database schema:**
   The user model has been updated to support OAuth. You need to add the new columns:
   - `provider` (default: 'email')
   - `google_id` (nullable, unique)
   - `password` is now nullable (for OAuth users)

   If using SQLAlchemy migrations, create a migration. Otherwise, you can manually add the columns:
   ```sql
   ALTER TABLE users ADD COLUMN provider VARCHAR NOT NULL DEFAULT 'email';
   ALTER TABLE users ADD COLUMN google_id VARCHAR UNIQUE;
   ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
   ```

6. **Restart your servers:**
   - Restart FastAPI backend
   - Restart React frontend (if running)

## Detailed Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "FastAPI E-commerce")
4. Click "Create"

### Step 2: Enable Google+ API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API" or "Google Identity"
3. Click on it and click **Enable**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in the required fields:
     - App name: Your app name
     - User support email: Your email
     - Developer contact: Your email
   - Click **Save and Continue**
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (your email) if in testing mode
   - Click **Save and Continue**

4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: Your app name
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `http://localhost:5173` (if using Vite)
     - Your production URL (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000` (for development)
     - Your production URL (for production)
   - Click **Create**

5. Copy your **Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)

### Step 4: Configure Backend

Create or update `.env` file in the project root:

```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

### Step 5: Configure Frontend

Create or update `front_end\.env` file:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

### Step 6: Update Database Schema

The user model has been updated with:
- `provider` field (default: 'email')
- `google_id` field (nullable, unique)
- `password` field is now nullable

**Option 1: Using Alembic (Recommended)**
```bash
# Generate migration
alembic revision --autogenerate -m "Add OAuth support to users"

# Apply migration
alembic upgrade head
```

**Option 2: Manual SQL**
```sql
-- Add provider column
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR NOT NULL DEFAULT 'email';

-- Add google_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR UNIQUE;

-- Make password nullable
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
```

**Option 3: Drop and recreate (Development only)**
If you're in development and don't have important data:
```python
# In Python shell or script
from app.database import engine
from app import models

models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)
```

## How It Works

1. **User clicks "Continue with Google"** on Login or Signup page
2. **Google OAuth popup** opens for user authentication
3. **Google returns access token** to frontend
4. **Frontend sends token** to backend `/auth/google` endpoint
5. **Backend verifies token** with Google
6. **Backend creates/updates user** in database:
   - If user exists (by email or google_id): Updates and logs in
   - If new user: Creates account and logs in
7. **Backend returns JWT token** to frontend
8. **Frontend stores token** and user is logged in

## Features

- ✅ **Seamless signup/login**: One-click authentication
- ✅ **Auto-verification**: OAuth users are automatically verified
- ✅ **Account linking**: If user signs up with email first, then uses Google with same email, accounts are linked
- ✅ **No password required**: OAuth users don't need passwords
- ✅ **Secure**: Uses Google's OAuth 2.0 protocol

## Troubleshooting

### Error: "Google OAuth not configured"
- Make sure `GOOGLE_CLIENT_ID` is set in your `.env` file
- Restart your FastAPI server after adding the environment variable
- Check that the variable name is exactly `GOOGLE_CLIENT_ID`

### Error: "Invalid Google token"
- Make sure you're using the correct Client ID
- Check that the token hasn't expired
- Verify that Google+ API is enabled in Google Cloud Console

### Google button not showing
- Check that `REACT_APP_GOOGLE_CLIENT_ID` is set in `front_end\.env`
- Restart your React development server
- Check browser console for errors
- Verify the Client ID is correct

### CORS errors
- Make sure your authorized JavaScript origins include your frontend URL
- Check that redirect URIs are configured correctly
- Verify the Client ID matches in both frontend and backend

### Database errors
- Make sure you've updated the database schema
- Check that `provider` column exists with default value 'email'
- Verify `google_id` column is unique
- Ensure `password` column allows NULL values

## Security Notes

⚠️ **IMPORTANT:**
- Never commit your `.env` file to git (it should be in `.gitignore`)
- Keep your Google Client ID secure
- Use different Client IDs for development and production
- Always verify tokens on the backend (never trust frontend tokens)
- OAuth users are automatically verified (no email verification needed)

## Example .env Files

**Backend `.env` (project root):**
```env
# Database
DATABASE_URL=postgresql://postgres:admin@localhost/fastapi

# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com

# Stripe (if using)
STRIPE_SECRET_KEY=sk_test_...

# Email (optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
```

**Frontend `.env` (`front_end` directory):**
```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Testing

1. Start your backend server:
   ```bash
   uvicorn app.main:app --reload
   ```

2. Start your frontend server:
   ```bash
   cd front_end
   npm start
   ```

3. Navigate to Login or Signup page
4. Click "Continue with Google"
5. Sign in with your Google account
6. You should be automatically logged in

## Need Help?

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [React OAuth Google Library](https://www.npmjs.com/package/@react-oauth/google)
