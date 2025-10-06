-- Migration: Add sources and related questions data
-- This adds columns to store the actual sources and related questions

ALTER TABLE chat_analytics 
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS related_questions JSONB DEFAULT '[]';

-- Add index for JSONB columns for better query performance
CREATE INDEX IF NOT EXISTS idx_sources ON chat_analytics USING gin(sources);
CREATE INDEX IF NOT EXISTS idx_related_questions ON chat_analytics USING gin(related_questions);

-- Update the schema comment
COMMENT ON COLUMN chat_analytics.sources IS 'Array of source objects with title and uri';
COMMENT ON COLUMN chat_analytics.related_questions IS 'Array of related question strings';

