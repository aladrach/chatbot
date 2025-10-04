-- Migration to add unanswered questions tracking
-- Run this in your Neon SQL Editor to update the existing table

-- Add new columns for tracking unanswered questions
ALTER TABLE chat_analytics 
ADD COLUMN IF NOT EXISTS is_unanswered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Create index for better query performance on unanswered questions
CREATE INDEX IF NOT EXISTS idx_is_unanswered ON chat_analytics(is_unanswered);

-- Update existing rows to set is_unanswered = false (default value)
-- This is just to ensure data consistency
UPDATE chat_analytics 
SET is_unanswered = false 
WHERE is_unanswered IS NULL;

-- Optional: Set existing records with no answer as potentially unanswered
-- (Uncomment if you want to mark existing no-answer records)
-- UPDATE chat_analytics 
-- SET is_unanswered = true 
-- WHERE answer IS NULL OR answer = '';

