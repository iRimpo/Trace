-- ============================================
-- Trace: Progress Tracking – Schema Additions
-- ============================================

-- Add region_scores and practiced_at to practice_sessions
ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS region_scores JSONB,
  ADD COLUMN IF NOT EXISTS practiced_at TIMESTAMPTZ DEFAULT now();

-- Aggregate stats view for user progress
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
