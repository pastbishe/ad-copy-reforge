-- Migration: Add image data fields to user_photos table
-- This migration adds fields to store base64 image data directly in the table
-- instead of using storage bucket

-- Добавляем поля для хранения данных изображений в base64
ALTER TABLE public.user_photos 
ADD COLUMN IF NOT EXISTS original_data TEXT,
ADD COLUMN IF NOT EXISTS compressed_data TEXT;

-- Комментарии к полям
COMMENT ON COLUMN public.user_photos.original_data IS 'Base64 encoded original image data';
COMMENT ON COLUMN public.user_photos.compressed_data IS 'Base64 encoded compressed image data';

