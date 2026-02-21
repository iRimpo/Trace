-- ============================================
-- Trace: Ghost Mirror – Database Setup
-- ============================================

-- 1. VIDEOS TABLE
-- Stores reference dance videos uploaded by users
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  duration integer not null default 0,
  keypoints jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for fast user lookups
create index videos_user_id_idx on public.videos(user_id);

-- RLS: users can only see and manage their own videos
alter table public.videos enable row level security;

create policy "Users can view own videos"
  on public.videos for select
  using (auth.uid() = user_id);

create policy "Users can insert own videos"
  on public.videos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own videos"
  on public.videos for update
  using (auth.uid() = user_id);

create policy "Users can delete own videos"
  on public.videos for delete
  using (auth.uid() = user_id);


-- 2. PRACTICE SESSIONS TABLE
-- Tracks each practice attempt against a reference video
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  trace_time integer not null default 0,
  recording_url text,
  user_keypoints jsonb,
  sync_score integer check (sync_score >= 0 and sync_score <= 100),
  feedback jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes for common queries
create index practice_sessions_user_id_idx on public.practice_sessions(user_id);
create index practice_sessions_video_id_idx on public.practice_sessions(video_id);

-- RLS: users can only see and manage their own sessions
alter table public.practice_sessions enable row level security;

create policy "Users can view own sessions"
  on public.practice_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.practice_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.practice_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.practice_sessions for delete
  using (auth.uid() = user_id);


-- 3. STORAGE BUCKETS
-- dance-videos: stores uploaded reference videos
insert into storage.buckets (id, name, public)
values ('dance-videos', 'dance-videos', false);

-- user-recordings: stores TEST mode recordings
insert into storage.buckets (id, name, public)
values ('user-recordings', 'user-recordings', false);

-- Storage RLS policies for dance-videos
create policy "Users can upload dance videos"
  on storage.objects for insert
  with check (
    bucket_id = 'dance-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view own dance videos"
  on storage.objects for select
  using (
    bucket_id = 'dance-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own dance videos"
  on storage.objects for delete
  using (
    bucket_id = 'dance-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS policies for user-recordings
create policy "Users can upload recordings"
  on storage.objects for insert
  with check (
    bucket_id = 'user-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view own recordings"
  on storage.objects for select
  using (
    bucket_id = 'user-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own recordings"
  on storage.objects for delete
  using (
    bucket_id = 'user-recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
