-- Add song_name column to practice_sessions (upload-only flow)
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS song_name TEXT;

-- Backfill from video_title for existing sessions
UPDATE public.practice_sessions
  SET song_name = video_title
  WHERE song_name IS NULL AND video_title IS NOT NULL;

-- Backfill with placeholder for sessions with no title
UPDATE public.practice_sessions
  SET song_name = 'Session ' || SUBSTRING(id::text, 1, 8)
  WHERE song_name IS NULL;
  #

-- Index for grouping queries
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_song
  ON public.practice_sessions(user_id, song_name);
