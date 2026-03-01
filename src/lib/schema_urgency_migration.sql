-- Migration: Add urgency_sent column to subscriptions
-- Run this in your Supabase SQL editor

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS urgency_sent boolean DEFAULT false;
