-- Soft-delete support for borrower_profiles
-- Run this in the Supabase SQL Editor

-- Add is_archived and archived_at columns (idempotent)
ALTER TABLE borrower_profiles
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE borrower_profiles
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill existing rows
UPDATE borrower_profiles SET is_archived = FALSE WHERE is_archived IS NULL;
