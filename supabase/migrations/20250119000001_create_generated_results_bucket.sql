-- Migration: Create storage bucket for generated photo results
-- This bucket will store the 3 generated photo variants from AI generation

-- Создаем bucket для сгенерированных фотографий (если не существует)
-- Bucket name: generated-results
-- Public: true (для публичного доступа к изображениям)
-- File size limit: 50MB
-- Allowed MIME types: image/*

-- Создаем или обновляем bucket через SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-results',
  'generated-results',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  public = true,
  file_size_limit = 52428800;

-- Политика для чтения (публичный доступ к изображениям)
DROP POLICY IF EXISTS "Public read access for generated results" ON storage.objects;
CREATE POLICY "Public read access for generated results"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-results');

-- Политика для загрузки (пользователи могут загружать свои сгенерированные фотографии)
DROP POLICY IF EXISTS "Users can upload own generated results" ON storage.objects;
CREATE POLICY "Users can upload own generated results"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generated-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Политика для обновления (пользователи могут обновлять свои сгенерированные фотографии)
DROP POLICY IF EXISTS "Users can update own generated results" ON storage.objects;
CREATE POLICY "Users can update own generated results"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'generated-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'generated-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Политика для удаления (пользователи могут удалять свои сгенерированные фотографии)
DROP POLICY IF EXISTS "Users can delete own generated results" ON storage.objects;
CREATE POLICY "Users can delete own generated results"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'generated-results' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

