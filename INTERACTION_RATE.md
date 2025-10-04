# Interaction Rate Tracking

## Overview

The interaction rate metric tracks how many users who see the chatbot actually interact with it. This helps you understand:
- **Bot visibility effectiveness** - Are users noticing the bot?
- **Engagement quality** - How compelling is your bot's presence?
- **Conversion funnel** - From page load to first interaction

## How It Works

### What Gets Tracked

1. **Bot Load** - Every time the chatbot component loads on a page
   - Session ID is generated for each unique visitor
   - Tracked once per session
   - Stores: timestamp, session ID, user agent, referrer, page URL

2. **Interactions** - When users ask their first question
   - Links to the same session ID
   - Full conversation tracking

### The Calculation

```
Interaction Rate = (Unique Sessions with Questions / Total Bot Loads) × 100
```

**Example:**
- 1000 bot loads (page views)
- 150 unique users asked questions
- **Interaction Rate = 15%**

## Database Schema

### New Table: `bot_loads`
```sql
CREATE TABLE bot_loads (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Analytics Dashboard

### New Metrics Displayed

#### Primary Metrics (Top Row)
1. **Bot Loads** - Total times the bot was loaded
2. **Interaction Rate** - Percentage of visitors who engaged
3. **Total Questions** - All questions asked
4. **Avg Response Time** - Performance metric

#### Secondary Metrics (Second Row)
5. **Error Rate** - Failed interactions
6. **Avg Sources/Response** - Quality metric
7. **Unique Users** - Distinct users who asked questions

## Implementation Details

### Client-Side Tracking

The `ChatClient` component automatically tracks bot loads on mount:

```typescript
// Track bot load once on mount
useEffect(() => {
  if (!hasTrackedLoadRef.current) {
    hasTrackedLoadRef.current = true;
    
    fetch('/api/analytics/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        timestamp: Date.now(),
        pageUrl: window.location.href,
      }),
    }).catch(err => console.error('Failed to track bot load:', err));
  }
}, []);
```

### Session Management

Each user gets a unique session ID:
```typescript
const sessionIdRef = useRef<string>(
  `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
);
```

This session ID is used for:
- Tracking the initial bot load
- Linking all questions from that session
- Calculating unique interactions

### API Endpoints

**POST `/api/analytics/load`** - Track bot load
- Non-blocking (fire and forget)
- Called once per session
- Stores page context

**POST `/api/analytics/track`** - Track interactions
- Called for each question
- Links to session ID

## Migration Required

Run this SQL in your Neon console:

```sql
-- Create bot loads table
CREATE TABLE IF NOT EXISTS bot_loads (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  referrer TEXT,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bot_loads_session_id ON bot_loads(session_id);
CREATE INDEX IF NOT EXISTS idx_bot_loads_timestamp ON bot_loads(timestamp);
```

Or use the migration file: `lib/migration-add-bot-loads.sql`

## Interpreting the Data

### Good Interaction Rates

- **5-10%** - Typical for passive chatbots
- **15-25%** - Good engagement, visible placement
- **30%+** - Excellent! Users are actively seeking help

### Low Interaction Rates (<5%)

Could indicate:
- Bot is not visible enough
- Users don't understand what the bot does
- Bot placement needs improvement
- Target audience doesn't need assistance

### Improving Interaction Rate

1. **Make it more visible**
   - Larger, more prominent placement
   - Add animations or attention-getters
   - Use contrasting colors

2. **Add clear call-to-action**
   - "Need help? Ask me anything!"
   - Show example questions
   - Add welcome message on load

3. **Optimize placement**
   - Bottom-right corner works best
   - Consider page-specific triggers
   - Test different positions

4. **Reduce friction**
   - Make it easier to start
   - Show it's online/active
   - Quick response preview

## Testing

### Test the Tracking

1. **Clear your session** (open incognito window)
2. Go to `http://localhost:3000`
3. **Don't interact** - just load the page
4. Check analytics - you should see:
   - Bot Loads: +1
   - Interaction Rate: 0% (if no questions yet)

5. **Ask a question**
6. Refresh analytics:
   - Bot Loads: stays same
   - Interaction Rate: 100% (1/1 engaged)
   - Total Questions: +1
   - Unique Users: 1

### Test with Multiple Sessions

1. Open 5 incognito windows
2. Load the chatbot in all 5
3. Ask questions in only 2 of them
4. Expected results:
   - Bot Loads: 5
   - Unique Users: 2
   - Interaction Rate: 40% (2/5)

## Files Changed

- ✅ `lib/schema.sql` - Added bot_loads table
- ✅ `lib/analytics.ts` - Added tracking and calculations
- ✅ `lib/migration-add-bot-loads.sql` - Migration script
- ✅ `app/api/analytics/load/route.ts` - New endpoint
- ✅ `app/analytics/page.tsx` - Updated dashboard UI
- ✅ `components/ChatClient.tsx` - Added load tracking

## Performance Impact

- **Minimal** - Single lightweight POST request on mount
- **Non-blocking** - Won't slow down page load
- **Cached** - Session ID cached in ref, only tracks once
- **Fail-safe** - Errors caught silently, won't break chat

## Next Steps

1. Run the database migration
2. Restart your dev server (if running)
3. Test in incognito mode
4. Monitor the interaction rate in analytics
5. Use insights to optimize bot placement and visibility

Happy tracking! 📊

