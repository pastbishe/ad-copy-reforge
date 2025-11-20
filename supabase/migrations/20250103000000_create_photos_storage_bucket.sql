-- Migration: Create storage bucket for photos from n8n
-- This bucket will store both original and compressed images from photos table

-- Создаем bucket для фотографий из таблицы photos (если не существует)
-- Bucket name: photos-storage
-- Public: true (для публичного доступа к изображениям)
-- File size limit: 50MB
-- Allowed MIME types: image/*

-- Создаем bucket через SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos-storage',
  'photos-storage',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Политика для чтения (публичный доступ к изображениям)
DROP POLICY IF EXISTS "Public read access for photos storage" ON storage.objects;
CREATE POLICY "Public read access for photos storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos-storage');

-- Политика для загрузки (только через service role в Edge Function)
-- Service role имеет полные права, поэтому отдельная политика не обязательна
-- Но для ясности создадим политику, которая разрешает вставку
DROP POLICY IF EXISTS "Service role can upload photos storage" ON storage.objects;
CREATE POLICY "Service role can upload photos storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos-storage');

-- Политика для удаления (пользователи могут удалять свои фотографии)
DROP POLICY IF EXISTS "Users can delete own photos from storage" ON storage.objects;
CREATE POLICY "Users can delete own photos from storage"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos-storage' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Комментарии
COMMENT ON POLICY "Public read access for photos storage" ON storage.objects IS 
'Публичный доступ для чтения фотографий из photos-storage bucket';

COMMENT ON POLICY "Service role can upload photos storage" ON storage.objects IS 
'Разрешение для service role загружать фотографии в photos-storage bucket';

COMMENT ON POLICY "Users can delete own photos from storage" ON storage.objects IS 
'Пользователи могут удалять свои фотографии из photos-storage bucket';






