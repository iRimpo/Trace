-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================
-- If your dashboard is missing: song names, Trace time, body-part scores,
-- or grouping by song, run this entire script once. It is idempotent
-- (safe to run multiple times).

-- 1. Progress tracking (region_scores, practiced_at, user_progress view)
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS region_scores JSONB,
  ADD COLUMN IF NOT EXISTS practiced_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE VIEW public.user_progress AS
  SELECT
    user_id,
    COUNT(*)::int AS total_sessions,
    ROUND(AVG(sync_score)::numeric, 1) AS avg_score,
    MAX(sync_score) AS best_score,
    COUNT(DISTINCT DATE(COALESCE(practiced_at, created_at)))::int AS practice_days
  FROM public.practice_sessions
  WHERE sync_score IS NOT NULL
  GROUP BY user_id;

-- 2. Allow session-only flow (no video row) + video_title
ALTER TABLE public.practice_sessions
  ALTER COLUMN video_id DROP NOT NULL;

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS video_source TEXT,
  ADD COLUMN IF NOT EXISTS video_title  TEXT;

-- 3. Dashboard insights (thumbnail_url on sessions, body_part_feedback)
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS body_part_feedback JSONB,
  ADD COLUMN IF NOT EXISTS movement_quality JSONB;

-- 4. Song name (grouping by song, upload-only flow)
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS song_name TEXT;

UPDATE public.practice_sessions
  SET song_name = video_title
  WHERE song_name IS NULL AND video_title IS NOT NULL;

UPDATE public.practice_sessions
  SET song_name = 'Session ' || SUBSTRING(id::text, 1, 8)
  WHERE song_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_song
  ON public.practice_sessions(user_id, song_name);

-- 5. Activation codes, user profiles, product events, surveys (run 006 migration or this block)
-- Activation codes
CREATE TABLE IF NOT EXISTS public.activation_codes (
  code TEXT PRIMARY KEY,
  label TEXT,
  max_uses INT,
  uses_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.activation_codes (code, label, max_uses)
VALUES ('KOSMOS', 'Kosmos cohort', NULL), ('AFX', 'AFX beta group', NULL), ('PCN50', 'PCN50 cohort', NULL)
ON CONFLICT (code) DO NOTHING;

-- User profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  activation_code TEXT REFERENCES public.activation_codes(code),
  is_activated BOOLEAN NOT NULL DEFAULT false,
  first_session_at TIMESTAMPTZ,
  last_session_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Product events
CREATE TABLE IF NOT EXISTS public.product_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  properties JSONB DEFAULT '{}'::jsonb,
  source TEXT,
  session_id UUID
);
CREATE INDEX IF NOT EXISTS idx_product_events_user_time ON public.product_events(user_id, event_time);
CREATE INDEX IF NOT EXISTS idx_product_events_name_time ON public.product_events(event_name, event_time);
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own or anonymous events" ON public.product_events;
CREATE POLICY "Users can insert own or anonymous events" ON public.product_events FOR INSERT
  WITH CHECK (user_id = auth.uid() OR (user_id IS NULL AND auth.uid() IS NULL));

-- Survey responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_text TEXT,
  answer_numeric INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_type ON public.survey_responses(user_id, survey_type);
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own survey responses" ON public.survey_responses;
CREATE POLICY "Users can view own survey responses" ON public.survey_responses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own survey responses" ON public.survey_responses;
CREATE POLICY "Users can insert own survey responses" ON public.survey_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grandfather existing users
INSERT INTO public.user_profiles (user_id, is_activated)
SELECT id, true FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Done. Refresh your dashboard; you should see song names, Trace time, and body-part stats.
