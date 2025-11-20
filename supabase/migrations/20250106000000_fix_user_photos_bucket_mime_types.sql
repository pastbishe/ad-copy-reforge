-- Migration: Fix user-photos bucket allowed_mime_types
-- This migration updates the allowed_mime_types for the user-photos bucket
-- to ensure image/jpeg and other image types are properly allowed

-- Обновляем allowed_mime_types для существующего bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp', 'image/svg+xml']
WHERE id = 'user-photos';

-- Если bucket не существует, создаем его
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp', 'image/svg+xml'];

