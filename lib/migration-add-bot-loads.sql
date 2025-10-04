-- Migration to add bot load tracking for interaction rate
-- Run this in your Neon SQL Editor to add bot load tracking

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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bot_loads_session_id ON bot_loads(session_id);
CREATE INDEX IF NOT EXISTS idx_bot_loads_timestamp ON bot_loads(timestamp);

