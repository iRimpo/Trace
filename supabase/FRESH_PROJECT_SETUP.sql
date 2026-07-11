-- ============================================================
-- Trace: FRESH PROJECT SETUP
-- Paste this entire file into a NEW Supabase project's SQL editor.
-- Creates the complete schema (migrations 001–007 consolidated).
-- Idempotent: safe to re-run.
--
-- (For patching an EXISTING database instead, use
--  RUN_IN_SUPABASE_SQL_EDITOR.sql / individual migrations.)
-- ============================================================

-- ── 1. VIDEOS ───────────────────────────────────────────────
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  duration integer not null default 0,
  keypoints jsonb default '[]'::jsonb,
  video_source text default 'youtube',
  created_at timestamptz not null default now()
);

create index if not exists videos_user_id_idx on public.videos(user_id);

alter table public.videos enable row level security;

drop policy if exists "Users can view own videos" on public.videos;
create policy "Users can view own videos"
  on public.videos for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own videos" on public.videos;
create policy "Users can insert own videos"
  on public.videos for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own videos" on public.videos;
create policy "Users can update own videos"
  on public.videos for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own videos" on public.videos;
create policy "Users can delete own videos"
  on public.videos for delete using (auth.uid() = user_id);

-- ── 2. PRACTICE SESSIONS ────────────────────────────────────
-- video_id nullable: upload/session-only flow has no videos row
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  trace_time integer not null default 0,
  recording_url text,
  user_keypoints jsonb,
  sync_score integer check (sync_score >= 0 and sync_score <= 100),
  feedback jsonb,
  region_scores jsonb,
  practiced_at timestamptz default now(),
  thumbnail_url text,
  body_part_feedback jsonb,
  movement_quality jsonb,
  video_source text,
  video_title text,
  song_name text,
  segment_start numeric(8,1),
  segment_end numeric(8,1),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists practice_sessions_user_id_idx on public.practice_sessions(user_id);
create index if not exists practice_sessions_video_id_idx on public.practice_sessions(video_id);
create index if not exists idx_practice_sessions_user_song on public.practice_sessions(user_id, song_name);

alter table public.practice_sessions enable row level security;

drop policy if exists "Users can view own sessions" on public.practice_sessions;
create policy "Users can view own sessions"
  on public.practice_sessions for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own sessions" on public.practice_sessions;
create policy "Users can insert own sessions"
  on public.practice_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own sessions" on public.practice_sessions;
create policy "Users can update own sessions"
  on public.practice_sessions for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own sessions" on public.practice_sessions;
create policy "Users can delete own sessions"
  on public.practice_sessions for delete using (auth.uid() = user_id);

-- ── 3. PROGRESS VIEW ────────────────────────────────────────
create or replace view public.user_progress as
  select
    user_id,
    count(*)::int as total_sessions,
    round(avg(sync_score)::numeric, 1) as avg_score,
    max(sync_score) as best_score,
    count(distinct date(coalesce(practiced_at, created_at)))::int as practice_days
  from public.practice_sessions
  where sync_score is not null
  group by user_id;

-- ── 4. STORAGE BUCKETS ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('dance-videos', 'dance-videos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('user-recordings', 'user-recordings', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload dance videos" on storage.objects;
create policy "Users can upload dance videos"
  on storage.objects for insert
  with check (bucket_id = 'dance-videos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can view own dance videos" on storage.objects;
create policy "Users can view own dance videos"
  on storage.objects for select
  using (bucket_id = 'dance-videos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own dance videos" on storage.objects;
create policy "Users can delete own dance videos"
  on storage.objects for delete
  using (bucket_id = 'dance-videos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can upload recordings" on storage.objects;
create policy "Users can upload recordings"
  on storage.objects for insert
  with check (bucket_id = 'user-recordings' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can view own recordings" on storage.objects;
create policy "Users can view own recordings"
  on storage.objects for select
  using (bucket_id = 'user-recordings' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own recordings" on storage.objects;
create policy "Users can delete own recordings"
  on storage.objects for delete
  using (bucket_id = 'user-recordings' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── 5. ACTIVATION CODES / PROFILES / EVENTS / SURVEYS ───────
create table if not exists public.activation_codes (
  code text primary key,
  label text,
  max_uses int,
  uses_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.activation_codes (code, label, max_uses)
values
  ('KOSMOS', 'Kosmos cohort', null),
  ('AFX', 'AFX beta group', null),
  ('PCN50', 'PCN50 cohort', null)
on conflict (code) do nothing;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  activation_code text references public.activation_codes(code),
  is_activated boolean not null default false,
  first_session_at timestamptz,
  last_session_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = user_id);

create table if not exists public.product_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  anonymous_id text,
  event_name text not null,
  event_time timestamptz not null default now(),
  properties jsonb default '{}'::jsonb,
  source text,
  session_id uuid
);

create index if not exists idx_product_events_user_time on public.product_events(user_id, event_time);
create index if not exists idx_product_events_name_time on public.product_events(event_name, event_time);

alter table public.product_events enable row level security;

drop policy if exists "Users can insert own or anonymous events" on public.product_events;
create policy "Users can insert own or anonymous events"
  on public.product_events for insert
  with check (user_id = auth.uid() or (user_id is null and auth.uid() is null));

create table if not exists public.survey_responses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  survey_type text not null,
  question text not null,
  answer_text text,
  answer_numeric int,
  created_at timestamptz not null default now()
);

create index if not exists idx_survey_responses_user_type on public.survey_responses(user_id, survey_type);

alter table public.survey_responses enable row level security;

drop policy if exists "Users can view own survey responses" on public.survey_responses;
create policy "Users can view own survey responses"
  on public.survey_responses for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own survey responses" on public.survey_responses;
create policy "Users can insert own survey responses"
  on public.survey_responses for insert with check (auth.uid() = user_id);

-- ── 6. SCAN CACHE (remaster Phase 1) ────────────────────────
create table if not exists public.scan_cache (
  id uuid primary key default gen_random_uuid(),
  video_identity text not null,
  segment_start numeric(8,1) not null default 0,
  segment_end   numeric(8,1) not null default 0,
  scan_version  int not null,
  timeline      jsonb not null,
  is_upload     boolean not null default false,
  owner_id      uuid references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create unique index if not exists scan_cache_key_idx
  on public.scan_cache (
    video_identity, segment_start, segment_end, scan_version,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists scan_cache_lookup_idx
  on public.scan_cache (video_identity, scan_version);

alter table public.scan_cache enable row level security;

drop policy if exists "link scans readable by all authed users" on public.scan_cache;
create policy "link scans readable by all authed users"
  on public.scan_cache for select
  using (auth.role() = 'authenticated' and (not is_upload or owner_id = auth.uid()));

drop policy if exists "users insert own or shared link scans" on public.scan_cache;
create policy "users insert own or shared link scans"
  on public.scan_cache for insert
  with check (
    (is_upload and owner_id = auth.uid())
    or (not is_upload and (owner_id is null or owner_id = auth.uid()))
  );

-- Done. Verify with:
--   select table_name from information_schema.tables where table_schema = 'public';
-- Expect: videos, practice_sessions, activation_codes, user_profiles,
--         product_events, survey_responses, scan_cache
