-- Table for tracking photo import operations
-- Stores information about competitor ad link imports

-- Создаем таблицу, если её нет
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,  -- ссылка, которую вставляет пользователь
  photo_url text,  -- URL фото, которое заполнит n8n (может быть null)
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  operation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Добавляем колонки, если их нет (для случаев, когда таблица уже существует)
do $$
begin
  -- Добавляем url (ссылка пользователя), если её нет
  if not exists (select 1 from information_schema.columns 
                 where table_schema = 'public' 
                 and table_name = 'photos' 
                 and column_name = 'url') then
    alter table public.photos add column url text not null default '';
  end if;
  
  -- Добавляем photo_url (URL фото от n8n), если её нет
  if not exists (select 1 from information_schema.columns 
                 where table_schema = 'public' 
                 and table_name = 'photos' 
                 and column_name = 'photo_url') then
    alter table public.photos add column photo_url text;
  end if;
  
  -- Если колонка photo_url существует, но имеет NOT NULL, делаем её nullable
  if exists (select 1 from information_schema.columns 
             where table_schema = 'public' 
             and table_name = 'photos' 
             and column_name = 'photo_url'
             and is_nullable = 'NO') then
    alter table public.photos alter column photo_url drop not null;
  end if;
  
  -- Добавляем status, если её нет
  if not exists (select 1 from information_schema.columns 
                 where table_schema = 'public' 
                 and table_name = 'photos' 
                 and column_name = 'status') then
    alter table public.photos add column status text not null default 'pending';
    alter table public.photos add constraint photos_status_check 
      check (status in ('pending', 'processing', 'completed', 'failed'));
  end if;
  
  -- Добавляем operation_id, если её нет
  if not exists (select 1 from information_schema.columns 
                 where table_schema = 'public' 
                 and table_name = 'photos' 
                 and column_name = 'operation_id') then
    alter table public.photos add column operation_id uuid;
  end if;
  
  -- Добавляем updated_at, если её нет
  if not exists (select 1 from information_schema.columns 
                 where table_schema = 'public' 
                 and table_name = 'photos' 
                 and column_name = 'updated_at') then
    alter table public.photos add column updated_at timestamptz not null default now();
  end if;
end $$;

create index if not exists idx_photos_user_id on public.photos(user_id);
create index if not exists idx_photos_status on public.photos(status);
create index if not exists idx_photos_operation_id on public.photos(operation_id);

alter table public.photos enable row level security;

drop policy if exists "Users can select own photos" on public.photos;
create policy "Users can select own photos"
  on public.photos for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own photos" on public.photos;
create policy "Users can insert own photos"
  on public.photos for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own photos" on public.photos;
create policy "Users can update own photos"
  on public.photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_photos_updated_at
  before update on public.photos
  for each row
  execute function update_updated_at_column();

