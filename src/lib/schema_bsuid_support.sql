-- Migration: Add BSUID support for Meta WhatsApp usernames feature (March 31, 2026)
-- BSUIDs (Business-Scoped User IDs) will replace phone numbers for users who enable WhatsApp usernames.
-- This column stores the BSUID as a fallback identifier when phone number is not available.

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS bsuid_user_id TEXT DEFAULT NULL;

-- Index to speed up BSUID lookups in the webhook
CREATE INDEX IF NOT EXISTS idx_chats_bsuid_user_id ON public.chats (bsuid_user_id)
  WHERE bsuid_user_id IS NOT NULL;
