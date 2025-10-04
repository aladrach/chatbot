# Analytics Dashboard Setup Guide

## Quick Start

### 1. Set Up Neon Database

1. Go to [neon.tech](https://neon.tech) and create an account
2. Create a new project
3. Copy your connection string from the dashboard
   - It looks like: `postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

### 2. Initialize the Database

1. Open your Neon SQL Editor (in the Neon Console)
2. Copy and paste the entire contents of `lib/schema.sql`
3. Click "Run" to execute the SQL
4. You should see a success message confirming the tables were created

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
DATABASE_URL=postgresql://your-actual-connection-string-here
ANALYTICS_USERNAME=admin
ANALYTICS_PASSWORD=YourSecurePassword123!
```

**Important**: Choose a strong password for `ANALYTICS_PASSWORD`!

### 4. Test Locally

```bash
yarn dev
```

Then:
1. Go to `http://localhost:3000` and ask a few questions
2. Go to `http://localhost:3000/analytics`
3. Login with your credentials (username: admin, password: what you set)
4. You should see the analytics dashboard with your test data!

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Go to Vercel Dashboard → Import Project
3. Select your repository
4. Add Environment Variables:
   - `DATABASE_URL` = your Neon connection string
   - `ANALYTICS_USERNAME` = admin
   - `ANALYTICS_PASSWORD` = your secure password
5. Deploy!

### 6. Access Production Analytics

Visit: `https://your-app.vercel.app/analytics`

## What's Tracked

The system automatically tracks every chat interaction:

- ✅ Question text
- ✅ Answer text
- ✅ Response time (milliseconds)
- ✅ Error status
- ✅ Number of sources provided
- ✅ Number of related questions
- ✅ Session ID (unique per user)
- ✅ User agent
- ✅ Referrer

## Analytics Dashboard Features

### Summary Cards
- Total Interactions
- Average Response Time
- Error Rate
- Average Sources per Response

### Charts & Visualizations
- **Top Questions**: Most frequently asked questions with counts
- **Topic Distribution**: Auto-categorized into topics:
  - Authentication
  - Data & Database
  - API
  - Dashboards
  - Security
  - Integration
  - Performance
  - Troubleshooting
  - General

### Engagement Tracking
- Daily interactions
- Unique sessions per day
- Date range filters (7 days, 30 days, all time)

## Troubleshooting

### Can't connect to database
- Verify `DATABASE_URL` is correct
- Make sure it includes `?sslmode=require`
- Check your Neon project is active

### No data showing up
- Ask some questions in the chatbot first
- Check browser console for errors
- Verify the tracking API is working: `/api/analytics/track`

### Can't login to analytics
- Double-check `ANALYTICS_USERNAME` and `ANALYTICS_PASSWORD` in env vars
- Try a fresh browser session (clear cookies)
- In Vercel, make sure env vars are saved and redeployed

### Database schema errors
- Make sure you ran ALL the SQL from `lib/schema.sql`
- Check that both tables (`chat_analytics` and `chat_sessions`) were created
- Verify indexes were created

## Security Notes

- ✅ Uses HTTP Basic Authentication
- ✅ Password is never stored in code
- ✅ Credentials checked on every request
- ⚠️ Use a strong password
- ⚠️ Never commit `.env.local` to git
- ⚠️ Always use HTTPS in production (Vercel does this automatically)

## Architecture

```
User asks question
    ↓
/api/chat/stream (tracks metrics)
    ↓
/api/analytics/track (async, non-blocking)
    ↓
Neon PostgreSQL Database
    ↓
/analytics page (password-protected)
    ↓
/api/analytics/data (with auth check)
    ↓
Display charts & metrics
```

## Support

If you need help:
1. Check the console logs for errors
2. Verify all environment variables are set
3. Test the database connection in Neon Console
4. Make sure the SQL schema was executed successfully

Happy tracking! 📊

