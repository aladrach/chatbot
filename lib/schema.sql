-- Chat Analytics Table
CREATE TABLE IF NOT EXISTS chat_analytics (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  response_time INTEGER, -- in milliseconds
  has_error BOOLEAN DEFAULT false,
  is_unanswered BOOLEAN DEFAULT false, -- Track out-of-domain or unanswered questions
  skip_reason TEXT, -- Store the skip reason (e.g., OUT_OF_DOMAIN_QUERY_IGNORED)
  sources_count INTEGER DEFAULT 0,
  related_questions_count INTEGER DEFAULT 0,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_session_id ON chat_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON chat_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_has_error ON chat_analytics(has_error);
CREATE INDEX IF NOT EXISTS idx_is_unanswered ON chat_analytics(is_unanswered);
CREATE INDEX IF NOT EXISTS idx_question_text ON chat_analytics USING gin(to_tsvector('english', question));

-- Optional: Add a table for session tracking
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  first_interaction TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_interaction TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  total_questions INTEGER DEFAULT 0,
  user_agent TEXT,
  referrer TEXT
);

-- Bot Load Tracking (for interaction rate calculation)
CREATE TABLE IF NOT EXISTS bot_loads (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  referrer TEXT,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bot loads
CREATE INDEX IF NOT EXISTS idx_bot_loads_session_id ON bot_loads(session_id);
CREATE INDEX IF NOT EXISTS idx_bot_loads_timestamp ON bot_loads(timestamp);

