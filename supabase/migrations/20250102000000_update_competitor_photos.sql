-- Migration: Add operation_id and photo_urls to competitor_photos table
-- This allows linking competitor_photos to photos table operations
-- and storing all photo URLs in a single record

-- Add operation_id column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'competitor_photos' 
    and column_name = 'operation_id'
  ) then
    alter table public.competitor_photos 
    add column operation_id uuid;
    
    -- Add index for faster lookups
    create index if not exists idx_comp_photos_operation_id 
    on public.competitor_photos(operation_id);
  end if;
end $$;

-- Add photo_urls column if it doesn't exist (stores all URLs comma-separated)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'competitor_photos' 
    and column_name = 'photo_urls'
  ) then
    alter table public.competitor_photos 
    add column photo_urls text;
  end if;
end $$;

-- Add original_storage_url column for storing original (uncompressed) images
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'competitor_photos' 
    and column_name = 'original_storage_url'
  ) then
    alter table public.competitor_photos 
    add column original_storage_url text;
  end if;
end $$;

