-- Migration: Create storage bucket for competitor photos
-- This bucket will store both original and compressed images

-- Создаем bucket для фотографий конкурентов (если не существует)
-- Примечание: В Supabase Storage buckets создаются через Dashboard или API
-- Этот файл служит документацией о необходимом bucket

-- Bucket name: competitor-photos
-- Public: true (для публичного доступа к изображениям)
-- File size limit: 50MB
-- Allowed MIME types: image/*

-- Для создания bucket через SQL (если расширение storage доступно):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'competitor-photos',
--   'competitor-photos',
--   true,
--   52428800, -- 50MB
--   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Создаем политики RLS для bucket (если нужно)
-- Пользователи могут читать свои фотографии
-- Пользователи могут загружать фотографии (через Edge Function с service role)

-- Политика для чтения (публичный доступ к изображениям)
-- CREATE POLICY "Public read access for competitor photos"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'competitor-photos');

-- Политика для загрузки (только через service role в Edge Function)
-- CREATE POLICY "Service role can upload competitor photos"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'competitor-photos');

