-- ============================================
-- Trace: Dashboard insights – body part feedback & movement quality
-- ============================================

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS body_part_feedback JSONB,
  ADD COLUMN IF NOT EXISTS movement_quality JSONB;

COMMENT ON COLUMN public.practice_sessions.body_part_feedback IS 'Per-body-part status and message: { "chest": { "status": "needs_work"|"close"|"good", "message": "..." }, ... }';
COMMENT ON COLUMN public.practice_sessions.movement_quality IS 'Scores 0-100: { "sharpness", "fluidity", "timing", "isolation", "power" }';
