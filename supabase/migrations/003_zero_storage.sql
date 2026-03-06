-- ============================================
-- Trace: Zero-Storage Architecture
-- ============================================

-- Track video source on videos table
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS video_source TEXT DEFAULT 'youtube';

-- Allow upload sessions with no linked videos record
ALTER TABLE public.practice_sessions
  ALTER COLUMN video_id DROP NOT NULL;

-- Store source info directly on sessions (for upload sessions without a videos record)
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS video_source TEXT,
  ADD COLUMN IF NOT EXISTS video_title  TEXT;
