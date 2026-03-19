-- =====================================================
-- Cancellation System Migration
-- Adds fields to booking_requests to support cancellations
-- =====================================================

-- 1. Add cancellation-related fields to booking_requests
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS canceled_by TEXT,
ADD COLUMN IF NOT EXISTS cancellation_type TEXT CHECK (cancellation_type IN ('free', 'late')),
ADD COLUMN IF NOT EXISTS canceled_dates JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- 2. Update the status CHECK constraint to include 'canceled'
-- Note: This removes and recreates the constraint if it exists
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_status_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_status_check
CHECK (status IN ('pending', 'accepted', 'completed', 'canceled', 'declined'));
