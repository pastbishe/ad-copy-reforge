-- Tables for competitor scraping workflow
-- Creates scrape_jobs and competitor_photos with RLS allowing users to read their own data.

-- scrape_jobs: one job per user trigger (submitting a source URL)
create table if not exists public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  status text not null default 'running' check (status in ('running','done','error')),
  idempotency_key text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create index if not exists idx_scrape_jobs_user_id on public.scrape_jobs(user_id);
create index if not exists idx_scrape_jobs_status on public.scrape_jobs(status);
create unique index if not exists uq_scrape_jobs_idempotency on public.scrape_jobs(idempotency_key) where idempotency_key is not null;

alter table public.scrape_jobs enable row level security;

drop policy if exists "Users can select own scrape_jobs" on public.scrape_jobs;
create policy "Users can select own scrape_jobs"
  on public.scrape_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own scrape_jobs" on public.scrape_jobs;
create policy "Users can insert own scrape_jobs"
  on public.scrape_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own scrape_jobs" on public.scrape_jobs;
create policy "Users can update own scrape_jobs"
  on public.scrape_jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- competitor_photos: images discovered by the scraper for a given job
create table if not exists public.competitor_photos (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.scrape_jobs(id) on delete cascade,
  source_url text not null,              -- page where image was found
  original_image_url text not null,      -- original external image URL
  storage_url text not null,             -- public URL in Supabase Storage
  file_name text,
  file_size bigint,
  mime_type text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique (user_id, job_id, original_image_url)
);

create index if not exists idx_comp_photos_user_id on public.competitor_photos(user_id);
create index if not exists idx_comp_photos_job_id on public.competitor_photos(job_id);

alter table public.competitor_photos enable row level security;

drop policy if exists "Users can select own competitor_photos" on public.competitor_photos;
create policy "Users can select own competitor_photos"
  on public.competitor_photos for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own competitor_photos" on public.competitor_photos;
create policy "Users can insert own competitor_photos"
  on public.competitor_photos for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own competitor_photos" on public.competitor_photos;
create policy "Users can update own competitor_photos"
  on public.competitor_photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


