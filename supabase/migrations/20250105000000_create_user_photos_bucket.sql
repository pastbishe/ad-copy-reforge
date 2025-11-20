-- Migration: Create storage bucket for user-uploaded photos
-- This bucket will store both original and compressed images uploaded by users

-- Создаем bucket для фотографий пользователей (если не существует)
-- Bucket name: user-photos
-- Public: true (для публичного доступа к изображениям)
-- File size limit: 50MB
-- Allowed MIME types: image/*

-- Создаем или обновляем bucket через SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp', 'image/svg+xml'],
  public = true,
  file_size_limit = 52428800;

-- Политика для чтения (публичный доступ к изображениям)
DROP POLICY IF EXISTS "Public read access for user photos" ON storage.objects;
CREATE POLICY "Public read access for user photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-photos');

-- Политика для загрузки (пользователи могут загружать свои фотографии)
DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Политика для обновления (пользователи могут обновлять свои фотографии)
DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Политика для удаления (пользователи могут удалять свои фотографии)
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
