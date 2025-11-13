-- ============================================
-- БЫСТРОЕ ИСПРАВЛЕНИЕ: Убрать NOT NULL с photo_url
-- ============================================
-- Скопируйте и выполните этот SQL в Supabase SQL Editor
-- Это решит ошибку: "null value in column "photo_url" violates not-null constraint"

-- Убираем ограничение NOT NULL с колонки photo_url
ALTER TABLE public.photos ALTER COLUMN photo_url DROP NOT NULL;

-- Проверка: убедимся, что колонка теперь nullable
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'photos' 
  AND column_name = 'photo_url';

-- Если вы видите is_nullable = 'YES', значит исправление сработало!

