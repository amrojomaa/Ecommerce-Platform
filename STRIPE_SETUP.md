# Stripe Payment Setup Guide

## Quick Setup

1. **Get your Stripe API keys:**
   - Sign up at [Stripe](https://stripe.com) (free account)
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
   - Copy your **Secret key** (starts with `sk_test_` for test mode)
   - Copy your **Publishable key** (starts with `pk_test_` for test mode)

2. **Create a `.env` file** in the project root (`c:\fastapi_practice\.env`):
   ```env
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
   ```

3. **Update frontend environment** (`front_end\.env`):
   ```env
   REACT_APP_API_BASE_URL=http://localhost:8000
   REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
   ```

4. **Restart your servers:**
   - Restart FastAPI backend
   - Restart React frontend (if running)

## Getting Stripe API Keys

### Step 1: Create a Stripe Account
1. Go to [https://stripe.com](https://stripe.com)
2. Click "Sign up" (free account)
3. Complete the registration

### Step 2: Get Test API Keys
1. After logging in, you'll be in **Test mode** by default (toggle in top right)
2. Go to **Developers** → **API keys**
3. You'll see:
   - **Publishable key** (starts with `pk_test_`) - Use this in frontend
   - **Secret key** (starts with `sk_test_`) - Click "Reveal" to see it, use in backend

### Step 3: Configure Your Application

**Backend (`.env` file in project root):**
```env
STRIPE_SECRET_KEY=sk_test_51Q...your_actual_key_here
```

**Frontend (`front_end\.env` file):**
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51Q...your_actual_key_here
```

## Test Mode vs Live Mode

- **Test Mode**: Use `sk_test_` and `pk_test_` keys
  - No real charges
  - Use test card numbers (see below)
  - Perfect for development

- **Live Mode**: Use `sk_live_` and `pk_live_` keys
  - Real charges
  - Only use after thorough testing
  - Requires account verification

## Test Card Numbers

Use these test card numbers in your payment form:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

For all test cards:
- **Expiry**: Any future date (e.g., `12/34`)
- **CVC**: Any 3 digits (e.g., `123`)
- **ZIP**: Any 5 digits (e.g., `12345`)

## Troubleshooting

### Error: "Invalid API Key provided"
- Make sure your `.env` file is in the correct location
- Check that the key starts with `sk_test_` (test mode) or `sk_live_` (live mode)
- Restart your FastAPI server after adding the key
- Make sure there are no extra spaces or quotes around the key

### Error: "No such payment_intent"
- Make sure you're using the same Stripe account for both keys
- Check that the payment intent ID matches

### Payment form not loading
- Check that `REACT_APP_STRIPE_PUBLISHABLE_KEY` is set in `front_end\.env`
- Restart your React development server
- Check browser console for errors

## Security Notes

⚠️ **IMPORTANT:**
- Never commit your `.env` file to git (it should be in `.gitignore`)
- Never expose your Secret key in frontend code
- Use test keys for development, live keys only in production
- Keep your Secret key secure - it can be used to make charges

## Example .env File Structure

**Backend `.env` (project root):**
```env
# Database
DATABASE_URL=postgresql://postgres:admin@localhost/fastapi

# Stripe
STRIPE_SECRET_KEY=sk_test_51Q...your_key_here

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
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_51Q...your_key_here
```

## Need Help?

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Dashboard](https://dashboard.stripe.com)
