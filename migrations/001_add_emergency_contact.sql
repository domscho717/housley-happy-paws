-- Add emergency contact fields to profiles table
-- This migration adds the ability for clients to store emergency contact information

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
