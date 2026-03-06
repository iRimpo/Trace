-- ============================================
-- Trace: Activation codes, user profiles, product events, surveys
-- ============================================

-- 1. ACTIVATION CODES
CREATE TABLE IF NOT EXISTS public.activation_codes (
  code TEXT PRIMARY KEY,
  label TEXT,
  max_uses INT,
  uses_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial codes (idempotent)
INSERT INTO public.activation_codes (code, label, max_uses)
VALUES
  ('KOSMOS', 'Kosmos cohort', NULL),
  ('AFX', 'AFX beta group', NULL),
  ('PCN50', 'PCN50 cohort', NULL)
ON CONFLICT (code) DO NOTHING;

-- 2. USER PROFILES (activation + metadata)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  activation_code TEXT REFERENCES public.activation_codes(code),
  is_activated BOOLEAN NOT NULL DEFAULT false,
  first_session_at TIMESTAMPTZ,
  last_session_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. PRODUCT EVENTS (analytics)
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

CREATE INDEX IF NOT EXISTS idx_product_events_user_time
  ON public.product_events(user_id, event_time);
CREATE INDEX IF NOT EXISTS idx_product_events_name_time
  ON public.product_events(event_name, event_time);

-- RLS: users can insert their own events (user_id = auth.uid() or user_id is null for anonymous)
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own or anonymous events"
  ON public.product_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND auth.uid() IS NULL)
  );

-- 4. SURVEY RESPONSES (PMF, NPS)
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_text TEXT,
  answer_numeric INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_user_type
  ON public.survey_responses(user_id, survey_type);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own survey responses"
  ON public.survey_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own survey responses"
  ON public.survey_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Grandfather existing users (backfill user_profiles for all auth.users)
INSERT INTO public.user_profiles (user_id, is_activated)
SELECT id, true
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles)
ON CONFLICT (user_id) DO NOTHING;
