-- Migration: Add unique constraint on (user_id, url) to prevent duplicate photo imports
-- This ensures that each user can only have one record per URL in the photos table

-- Сначала удаляем возможные дубликаты, оставляя только самую новую запись для каждой комбинации (user_id, url)
-- Это нужно сделать перед добавлением уникального ограничения
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Подсчитываем количество дубликатов
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, url, COUNT(*) as cnt
    FROM public.photos
    GROUP BY user_id, url
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    -- Удаляем дубликаты, оставляя только самую новую запись для каждой комбинации (user_id, url)
    DELETE FROM public.photos
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) as rn
        FROM public.photos
      ) ranked
      WHERE rn > 1
    );
    
    RAISE NOTICE 'удалено дубликатов: %', duplicate_count;
  END IF;
END $$;

-- Добавляем уникальное ограничение на комбинацию (user_id, url)
-- Это предотвратит создание дубликатов на уровне базы данных
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'photos_user_id_url_unique'
    AND conrelid = 'public.photos'::regclass
  ) THEN
    ALTER TABLE public.photos
    ADD CONSTRAINT photos_user_id_url_unique UNIQUE (user_id, url);
    
    RAISE NOTICE 'добавлено уникальное ограничение photos_user_id_url_unique';
  ELSE
    RAISE NOTICE 'уникальное ограничение photos_user_id_url_unique уже существует';
  END IF;
END $$;

-- Создаем индекс для улучшения производительности (уникальное ограничение автоматически создает индекс, но явно указываем)
CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_user_id_url_unique
ON public.photos(user_id, url);
