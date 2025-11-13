# Применение миграции для таблицы photos

## Проблема
Ошибка: "null value in column "photo_url" of relation "photos" violates not-null constraint"

Это означает, что:
1. Таблица `photos` существует, но колонка `photo_url` имеет ограничение NOT NULL
2. Нужно сделать колонку `photo_url` nullable (разрешить NULL значения)

**Быстрое решение:** Выполните SQL из файла `QUICK_FIX.sql` в Supabase SQL Editor

## ⚡ Быстрое исправление (30 секунд)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Скопируйте и выполните этот SQL:

```sql
ALTER TABLE public.photos ALTER COLUMN photo_url DROP NOT NULL;
```

5. Обновите страницу в браузере (Ctrl+F5)
6. Попробуйте снова импортировать ссылку

## Решение

### Вариант 1: Через Supabase Dashboard (Рекомендуется)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Скопируйте содержимое файла `supabase/migrations/20250101000000_create_photos_table.sql`
5. Вставьте SQL в редактор
6. Нажмите **Run** (или Ctrl+Enter)

### Вариант 2: Через Supabase CLI

Если у вас установлен Supabase CLI:

```bash
cd ad-copy-reforge
supabase db push
```

### Вариант 3: Вручную через SQL Editor

Выполните этот SQL в Supabase SQL Editor:

```sql
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

drop trigger if exists update_photos_updated_at on public.photos;
create trigger update_photos_updated_at
  before update on public.photos
  for each row
  execute function update_updated_at_column();
```

## Проверка

После применения миграции:

1. Обновите страницу в браузере (Ctrl+F5 или Cmd+Shift+R)
2. Попробуйте снова импортировать ссылку
3. Ошибка должна исчезнуть

## Структура таблицы

После применения миграции таблица `photos` будет содержать:

- `id` (uuid) - уникальный идентификатор записи
- `user_id` (uuid) - ID пользователя
- `url` (text) - ссылка, которую пользователь вставил (обязательное поле)
- `photo_url` (text, nullable) - URL фото, которое заполнит n8n после скрапинга
- `status` (text) - статус: 'pending', 'processing', 'completed', 'failed'
- `operation_id` (uuid) - ID операции (ID из scrape_jobs)
- `created_at` (timestamptz) - дата создания
- `updated_at` (timestamptz) - дата обновления

