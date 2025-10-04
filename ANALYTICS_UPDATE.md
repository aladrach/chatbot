# Analytics Update - Cookie Login & Unanswered Questions

## New Features

### ✅ 1. Persistent Login with Cookies
- Login session is now saved as a cookie
- Users stay logged in for 7 days
- Automatic re-authentication on page refresh
- Added Logout button in the dashboard

### ✅ 2. Unanswered Questions Tracking
- Tracks questions that couldn't be answered (out of domain)
- Detects `answerSkippedReasons` in API responses
- Shows a dedicated "Out of Domain Questions" section in analytics
- Displays count and last asked timestamp

## Database Migration

**Important**: If you already have the database set up, you need to run the migration.

### Option 1: Run Migration SQL
1. Go to your Neon SQL Editor
2. Copy and paste contents from `lib/migration-add-unanswered.sql`
3. Execute the SQL

### Option 2: Recreate Tables (Fresh Start)
1. Drop the existing table: `DROP TABLE IF EXISTS chat_analytics CASCADE;`
2. Run the full schema from `lib/schema.sql`

## Testing

### Test Cookie Persistence
1. Go to `/analytics` and login
2. Refresh the page
3. You should stay logged in ✅
4. Click "Logout" to clear the session
5. Refresh - you should see the login form again ✅

### Test Unanswered Questions
1. Go to the chatbot at `/`
2. Ask an out-of-domain question like "What is the meaning of life?"
3. The API should return a response with `answerSkippedReasons: ["OUT_OF_DOMAIN_QUERY_IGNORED"]`
4. This will be tracked as an unanswered question
5. Go to `/analytics` and you should see it in the "Out of Domain Questions" section

## API Response Format

The system now detects this response format:

```json
{
  "answer": {
    "answerSkippedReasons": [
      "OUT_OF_DOMAIN_QUERY_IGNORED"
    ],
    "answerText": "A summary could not be generated for your search query. Here are some search results.",
    "relatedQuestions": [...],
    "state": "SUCCEEDED"
  }
}
```

When `answerSkippedReasons` is present, the question is marked as:
- `is_unanswered = true`
- `skip_reason = "OUT_OF_DOMAIN_QUERY_IGNORED"` (or whatever the first reason is)

## Dashboard Changes

### New Section: Out of Domain Questions
- Shows questions that couldn't be answered
- Displays count (how many times asked)
- Shows last timestamp when asked
- Yellow warning styling to highlight these issues

### UI Improvements
- Added Logout button
- Empty state messages for sections with no data
- Better responsive layout

## Security

**Cookie Security:**
- Cookies are set with `SameSite=Strict` flag
- 7-day expiration
- Path restricted to `/`
- No httpOnly (needed for client-side JavaScript access)

**Note**: The credentials are stored base64 encoded in the cookie. For production, consider:
- Using httpOnly cookies with server-side session management
- Implementing proper token-based authentication
- Using secure HTTPS connections (Vercel does this automatically)

## Files Changed

- `app/analytics/page.tsx` - Added cookie persistence and logout
- `lib/analytics.ts` - Added unanswered questions tracking
- `lib/schema.sql` - Updated schema with new columns
- `lib/migration-add-unanswered.sql` - Migration script for existing databases
- `app/api/chat/stream/route.ts` - Detect answerSkippedReasons
- `app/api/analytics/track/route.ts` - Handle new tracking fields

## Troubleshooting

### Not staying logged in?
- Clear your browser cookies
- Make sure cookies are enabled
- Check browser console for errors

### Unanswered questions not showing?
- Run the migration SQL to add the new columns
- Test with an out-of-domain question
- Check API response in browser DevTools
- Verify tracking endpoint is receiving data: `/api/analytics/track`

### Database errors?
- Make sure you ran the migration
- Check column names match the new schema
- Verify indexes were created

## Next Steps

1. Run the database migration
2. Test the cookie login
3. Ask some out-of-domain questions
4. Check the analytics dashboard
5. Monitor the "Out of Domain Questions" to improve chatbot coverage

Happy tracking! 🎉

