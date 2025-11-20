-- Migration: Create generated_photos table
-- Stores history of photo generation operations (scraped photo + user photo -> 3 generated variants)

-- Создаем таблицу для хранения истории генераций
CREATE TABLE IF NOT EXISTS public.generated_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scraped_photo_id text NOT NULL, -- ID или URL фото из скрапинга
  user_photo_id uuid NOT NULL REFERENCES public.user_photos(id) ON DELETE CASCADE,
  generated_urls text[] NOT NULL DEFAULT '{}', -- массив из 3 URL сгенерированных вариантов
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_generated_photos_user_id ON public.generated_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_photos_status ON public.generated_photos(status);
CREATE INDEX IF NOT EXISTS idx_generated_photos_user_photo_id ON public.generated_photos(user_photo_id);
-- Составной индекс для проверки уникальности комбинации
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_photos_unique_combination 
  ON public.generated_photos(user_id, scraped_photo_id, user_photo_id);

-- Включаем RLS
ALTER TABLE public.generated_photos ENABLE ROW LEVEL SECURITY;

-- Политика SELECT: пользователи могут видеть только свои генерации
DROP POLICY IF EXISTS "Users can select own generated photos" ON public.generated_photos;
CREATE POLICY "Users can select own generated photos"
  ON public.generated_photos FOR SELECT
  USING (auth.uid() = user_id);

-- Политика INSERT: пользователи могут создавать свои генерации
DROP POLICY IF EXISTS "Users can insert own generated photos" ON public.generated_photos;
CREATE POLICY "Users can insert own generated photos"
  ON public.generated_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Политика UPDATE: пользователи могут обновлять свои генерации
DROP POLICY IF EXISTS "Users can update own generated photos" ON public.generated_photos;
CREATE POLICY "Users can update own generated photos"
  ON public.generated_photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Политика DELETE: пользователи могут удалять свои генерации
DROP POLICY IF EXISTS "Users can delete own generated photos" ON public.generated_photos;
CREATE POLICY "Users can delete own generated photos"
  ON public.generated_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_generated_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_generated_photos_updated_at ON public.generated_photos;
CREATE TRIGGER update_generated_photos_updated_at
  BEFORE UPDATE ON public.generated_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_photos_updated_at();

