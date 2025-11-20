# Применение миграции для создания bucket user-photos

## Проблема
Ошибка: "Ошибка загрузки в хранилище. Проверьте подключение к интернету."

Это означает, что bucket `user-photos` не существует или не настроены правильные политики RLS.

## ⚡ Быстрое исправление (2 минуты)

### Вариант 1: Через Supabase Dashboard (Рекомендуется)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj)
2. Перейдите в **SQL Editor** (левое меню → SQL Editor)
3. Скопируйте и выполните SQL из файла `supabase/migrations/20250105000000_create_user_photos_bucket.sql`
4. Нажмите **Run** (или Ctrl+Enter)
5. Обновите страницу приложения (Ctrl+F5)

### Вариант 2: Через скрипт (если есть SERVICE_ROLE_KEY)

Если у вас есть SERVICE_ROLE_KEY, запустите:

```bash
# Windows PowerShell
$env:SERVICE_ROLE_KEY="ваш_service_role_ключ"
node apply_user_photos_bucket_with_service_key.js

# Linux/Mac
export SERVICE_ROLE_KEY="ваш_service_role_ключ"
node apply_user_photos_bucket_with_service_key.js
```

## SQL для выполнения

```sql
-- Migration: Create storage bucket for user-uploaded photos
-- This bucket will store both original and compressed images uploaded by users

-- Создаем bucket для фотографий пользователей (если не существует)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp']
)
ON CONFLICT (id) DO NOTHING;

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
```

## Проверка

После применения миграции:

1. Обновите страницу в браузере (Ctrl+F5 или Cmd+Shift+R)
2. Попробуйте снова загрузить фотографию
3. Ошибка должна исчезнуть

## Структура bucket

После применения миграции bucket `user-photos` будет содержать:

- **Публичный доступ** для чтения всех фотографий
- **Политики RLS** для загрузки, обновления и удаления только своих фотографий
- **Лимит размера файла**: 50MB
- **Поддерживаемые форматы**: JPEG, PNG, WEBP, GIF, BMP

Фотографии будут храниться в структуре: `{userId}/originals/{filename}` и `{userId}/compressed/{filename}`






