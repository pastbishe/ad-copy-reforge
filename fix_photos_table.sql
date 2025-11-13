-- Проверка и исправление структуры таблицы photos
-- Этот SQL проверяет существующие колонки и добавляет недостающие

-- Сначала проверим, существует ли таблица
DO $$
BEGIN
  -- Создаем таблицу, если её нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos') THEN
    CREATE TABLE public.photos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      url text NOT NULL,
      photo_url text,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      operation_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    RAISE NOTICE 'Таблица photos создана';
  ELSE
    RAISE NOTICE 'Таблица photos уже существует';
  END IF;
END $$;

-- Добавляем недостающие колонки
DO $$
BEGIN
  -- Добавляем id, если его нет (маловероятно, но на всякий случай)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'id') THEN
    ALTER TABLE public.photos ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
    RAISE NOTICE 'Добавлена колонка id';
  END IF;

  -- Добавляем user_id, если его нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'user_id') THEN
    ALTER TABLE public.photos ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Добавлена колонка user_id';
  END IF;

  -- Добавляем url, если его нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'url') THEN
    ALTER TABLE public.photos ADD COLUMN url text NOT NULL DEFAULT '';
    RAISE NOTICE 'Добавлена колонка url';
  END IF;

  -- Добавляем photo_url, если его нет, или делаем nullable
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'photo_url') THEN
    ALTER TABLE public.photos ADD COLUMN photo_url text;
    RAISE NOTICE 'Добавлена колонка photo_url';
  ELSE
    -- Если колонка существует, но имеет NOT NULL, делаем её nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'photos' 
               AND column_name = 'photo_url'
               AND is_nullable = 'NO') THEN
      ALTER TABLE public.photos ALTER COLUMN photo_url DROP NOT NULL;
      RAISE NOTICE 'Колонка photo_url теперь nullable';
    END IF;
  END IF;

  -- Добавляем status, если его нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'status') THEN
    ALTER TABLE public.photos ADD COLUMN status text NOT NULL DEFAULT 'pending';
    ALTER TABLE public.photos ADD CONSTRAINT photos_status_check 
      CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
    RAISE NOTICE 'Добавлена колонка status';
  END IF;

  -- Добавляем operation_id, если его нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'operation_id') THEN
    ALTER TABLE public.photos ADD COLUMN operation_id uuid;
    RAISE NOTICE 'Добавлена колонка operation_id';
  END IF;

  -- Добавляем created_at, если его нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'created_at') THEN
    ALTER TABLE public.photos ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE 'Добавлена колонка created_at';
  END IF;

  -- Добавляем updated_at, если его нет
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'photos' 
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.photos ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE 'Добавлена колонка updated_at';
  END IF;
END $$;

-- Создаем индексы, если их нет
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON public.photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_operation_id ON public.photos(operation_id);

-- Включаем RLS
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Создаем политики RLS
DROP POLICY IF EXISTS "Users can select own photos" ON public.photos;
CREATE POLICY "Users can select own photos"
  ON public.photos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own photos" ON public.photos;
CREATE POLICY "Users can insert own photos"
  ON public.photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own photos" ON public.photos;
CREATE POLICY "Users can update own photos"
  ON public.photos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Создаем функцию для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для обновления updated_at
DROP TRIGGER IF EXISTS update_photos_updated_at ON public.photos;
CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Проверка структуры таблицы после исправления
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'photos'
ORDER BY ordinal_position;

