# Настройка обработки фотографий после импорта

## Обзор

После импорта ссылки на сайт через вебхук, система автоматически обрабатывает фотографии:
1. Скачивает фотографии по URL из таблицы `photos`
2. Сжимает фотографии (проверка размера, оптимизация)
3. Сохраняет оригиналы в Storage (bucket `competitor-photos`)
4. Сохраняет сжатые версии в Storage
5. Сохраняет информацию в таблицу `competitor_photos`

## Структура данных

### Таблица `competitor_photos`

Добавлены новые поля:
- `operation_id` (UUID) - связь с `photos.operation_id`
- `photo_urls` (TEXT) - все URL фотографий через запятую
- `original_storage_url` (TEXT) - URL оригинального изображения в Storage

### Таблица `photos`

После импорта N8N обновляет:
- `photo_url` - URL фотографий (может быть JSON массив, разделенные запятыми, или одна строка)
- `status` - меняется на `'completed'`

## Установка

### 1. Применить миграции

```bash
# Применить миграции в Supabase
supabase migration up
```

Или через Supabase Dashboard:
1. Откройте SQL Editor
2. Выполните миграции по порядку:
   - `20250102000000_update_competitor_photos.sql`
   - `20250102000001_create_photo_processing_trigger.sql`
   - `20250102000002_create_competitor_photos_bucket.sql`

### 2. Создать Storage Bucket

В Supabase Dashboard:
1. Перейдите в Storage
2. Создайте новый bucket:
   - **Name**: `competitor-photos`
   - **Public**: `true`
   - **File size limit**: `50MB`
   - **Allowed MIME types**: `image/*`

### 3. Развернуть Edge Function

```bash
# Установить Supabase CLI (если еще не установлен)
npm install -g supabase

# Войти в Supabase
supabase login

# Связать проект
supabase link --project-ref ticugdxpzglbpymvfnyj

# Развернуть Edge Function
supabase functions deploy process-photos
```

### 4. Настроить переменные окружения

В Supabase Dashboard:
1. Перейдите в Project Settings → Edge Functions
2. Добавьте секреты:
   - `SUPABASE_URL` - уже установлен автоматически
   - `SUPABASE_SERVICE_ROLE_KEY` - уже установлен автоматически

### 5. Настроить Database Function

В Supabase Dashboard → SQL Editor выполните:

```sql
-- Установить Service Role Key для триггера (опционально)
-- Это можно сделать через Supabase Secrets или переменные окружения
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

**Важно**: Service Role Key должен быть защищен. Используйте Supabase Secrets для хранения.

## Как это работает

### Процесс обработки

1. **Импорт ссылки**: Пользователь импортирует ссылку через интерфейс
2. **Сохранение в БД**: Создается запись в таблице `photos` со статусом `'pending'`
3. **Вебхук N8N**: Вызывается вебхук N8N для скрапинга
4. **Обновление photos**: N8N обновляет `photo_url` и `status = 'completed'`
5. **Триггер**: Database trigger вызывает Edge Function
6. **Обработка**: Edge Function скачивает, сжимает и сохраняет фотографии
7. **Сохранение**: Информация сохраняется в `competitor_photos`

### Database Trigger

Триггер `trigger_process_photos_after_import` срабатывает при:
- Обновлении записи в таблице `photos`
- Изменении статуса на `'completed'`
- Заполнении поля `photo_url`

### Edge Function

Edge Function `process-photos`:
- Принимает данные о фотографиях
- Скачивает изображения по URL
- Сохраняет оригиналы в `competitor-photos/originals/`
- Сохраняет сжатые версии в `competitor-photos/compressed/`
- Сохраняет метаданные в таблицу `competitor_photos`

## Параметры сжатия

Текущие настройки:
- **Максимальный размер файла**: 10MB
- **Максимальные размеры**: 1200x1200px
- **Качество**: 70%

**Примечание**: В текущей версии используется базовое сжатие. Для production рекомендуется добавить библиотеку для обработки изображений (например, sharp через npm).

## Проверка работы

### Тестирование триггера

```sql
-- Обновить запись в photos для тестирования
UPDATE photos
SET 
  photo_url = 'https://example.com/image1.jpg,https://example.com/image2.jpg',
  status = 'completed'
WHERE id = 'YOUR_PHOTO_ID';
```

### Проверка логов Edge Function

В Supabase Dashboard:
1. Перейдите в Edge Functions → `process-photos`
2. Откройте вкладку Logs
3. Проверьте выполнение функции

### Проверка Storage

1. Перейдите в Storage → `competitor-photos`
2. Проверьте наличие папок:
   - `{user_id}/originals/` - оригинальные изображения
   - `{user_id}/compressed/` - сжатые изображения

### Проверка таблицы competitor_photos

```sql
SELECT * FROM competitor_photos 
WHERE operation_id = 'YOUR_OPERATION_ID'
ORDER BY created_at DESC;
```

## Устранение неполадок

### Триггер не срабатывает

1. Проверьте, что триггер создан:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_process_photos_after_import';
   ```

2. Проверьте, что pg_net расширение установлено:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

3. Если pg_net не установлен, установите его:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

### Edge Function не вызывается

1. Проверьте логи в Supabase Dashboard
2. Проверьте, что Service Role Key установлен правильно
3. Проверьте URL Edge Function в триггере

### Ошибки загрузки изображений

1. Проверьте, что bucket `competitor-photos` создан
2. Проверьте права доступа к bucket
3. Проверьте, что URL изображений доступны

## Улучшения для production

1. **Добавить библиотеку для сжатия изображений**:
   - Использовать sharp или другую библиотеку через npm
   - Реальное изменение размеров и качества

2. **Добавить обработку ошибок**:
   - Retry логика для скачивания
   - Очередь для обработки больших объемов

3. **Мониторинг**:
   - Логирование всех операций
   - Метрики производительности

4. **Оптимизация**:
   - Параллельная обработка нескольких изображений
   - Кэширование результатов

