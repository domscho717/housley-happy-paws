-- =====================================================
-- Migration 002 — add profiles.last_seen_at
-- =====================================================
-- Run this in Supabase > SQL Editor.
--
-- Used by /api/message-notification to decide whether to email the
-- owner when a client sends a message. If the owner has touched the
-- portal within the last 5 minutes, the email is skipped so it
-- doesn't spam her while she's chatting live.
-- =====================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Index makes the "is owner active right now?" lookup cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles (last_seen_at);
