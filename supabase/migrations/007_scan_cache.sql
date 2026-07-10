-- ============================================
-- Trace: Scan cache — choreo timelines cached per video identity + segment
-- Link-sourced scans (YouTube/TikTok) are shared across all users;
-- upload-sourced scans are private to their owner.
-- ============================================

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

-- One row per (identity, segment, version, owner). Postgres treats NULLs as
-- distinct in unique constraints, so shared rows (owner_id null) need
-- coalesce-based uniqueness via an index instead.
create unique index if not exists scan_cache_key_idx
  on public.scan_cache (
    video_identity, segment_start, segment_end, scan_version,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists scan_cache_lookup_idx
  on public.scan_cache (video_identity, scan_version);

alter table public.scan_cache enable row level security;

create policy "link scans readable by all authed users"
  on public.scan_cache for select
  using (
    auth.role() = 'authenticated'
    and (not is_upload or owner_id = auth.uid())
  );

create policy "users insert own or shared link scans"
  on public.scan_cache for insert
  with check (
    (is_upload and owner_id = auth.uid())
    or (not is_upload and (owner_id is null or owner_id = auth.uid()))
  );

-- Sessions can now record which segment of the video was practiced
alter table public.practice_sessions
  add column if not exists segment_start numeric(8,1),
  add column if not exists segment_end   numeric(8,1);
