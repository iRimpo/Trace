# Supabase schema and migrations

## If the dashboard is missing data or shows "Session xxx"

Run the consolidated script in the **Supabase SQL Editor**:

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor**.
3. Open the file `RUN_IN_SUPABASE_SQL_EDITOR.sql` in this folder (or copy its contents).
4. Paste into the editor and click **Run**.

This applies all schema changes needed for:

- **Song names** – grouping by song and proper card titles (instead of "Session 36cfd9").
- **Trace time** – time spent in Trace mode stored and shown (e.g. "12 min in Trace").
- **Body-part scores** – region_scores and practiced_at for the progress API and focus areas.
- **Session-only flow** – `video_id` can be null so upload-only sessions work without a `videos` row.

The script is idempotent; safe to run more than once.

## Migrations (for reference)

- `001_create_tables.sql` – Base tables and storage (run first when setting up a new project).
- `002_add_progress_tracking.sql` – region_scores, practiced_at, user_progress view.
- `003_zero_storage.sql` – video_id nullable, video_source, video_title.
- `004_dashboard_insights.sql` – thumbnail_url, body_part_feedback, movement_quality on sessions.
- `005_song_name.sql` – song_name, backfill, index.
- `006_activation_and_metrics.sql` – activation_codes, user_profiles, product_events, survey_responses, grandfather backfill.

If you use `supabase db push` or migrations, you don’t need to run `RUN_IN_SUPABASE_SQL_EDITOR.sql`; it’s for projects where migrations weren’t applied in order.

## Activation & Metrics (006)

After running 006 (or the corresponding block in RUN_IN_SUPABASE_SQL_EDITOR.sql):

- **Activation codes** are seeded. Signup requires a valid invite code.
- **Existing users** are grandfathered (user_profiles created with is_activated=true).
- **Product events** and **survey_responses** tables are ready for analytics.

See docs/METRICS_QUERIES.md for saved SQL queries and the weekly PM checklist.
