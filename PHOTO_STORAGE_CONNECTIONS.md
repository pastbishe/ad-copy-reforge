# Связь между местами хранения фотографий

## Обзор

В системе существует несколько мест хранения фотографий, которые связаны между собой через базу данных и Storage buckets. Этот документ описывает структуру и связи между ними.

## Структура хранения

### 1. Таблицы базы данных

#### `photos` - Импортированные фотографии через n8n
**Назначение:** Отслеживание импорта ссылок на рекламу конкурентов

**Структура:**
- `id` (UUID) - уникальный идентификатор
- `user_id` (UUID) - пользователь, который импортировал ссылку
- `url` (TEXT) - ссылка, которую вставил пользователь (например, ссылка на Facebook/Instagram рекламу)
- `photo_url` (TEXT) - URL фотографий, заполняется n8n после обработки (может быть JSON массив, разделенные запятыми, или одна строка)
- `status` (TEXT) - статус: 'pending', 'processing', 'completed', 'failed'
- `operation_id` (UUID) - ID операции для связи с n8n
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Уникальное ограничение:** `(user_id, url)` - предотвращает дубликаты импортов

**Связь с Storage:**
- После обработки n8n, фотографии сохраняются в bucket `photos-storage`
- URL фотографий в `photo_url` указывают на файлы в `photos-storage` bucket

---

#### `user_photos` - Фотографии, загруженные пользователем
**Назначение:** Хранение фотографий, загруженных пользователем напрямую

**Структура:**
- `id` (UUID) - уникальный идентификатор
- `user_id` (UUID) - пользователь
- `original_url` (TEXT) - URL оригинального изображения в Storage
- `compressed_url` (TEXT) - URL сжатой версии в Storage
- `file_name` (TEXT) - имя файла
- `file_size` (BIGINT) - размер файла
- `mime_type` (TEXT) - тип файла
- `width`, `height` (INTEGER) - размеры изображения
- `quality_score` (NUMERIC) - оценка качества
- `is_valid` (BOOLEAN) - валидность фотографии
- `original_data` (TEXT) - Base64 оригинального изображения (опционально)
- `compressed_data` (TEXT) - Base64 сжатого изображения (опционально)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Связь с Storage:**
- Фотографии хранятся в bucket `user-photos`
- Структура: `user-photos/{user_id}/originals/{file_name}` и `user-photos/{user_id}/compressed/{file_name}`

---

#### `competitor_photos` - Фотографии конкурентов, найденные скрапером
**Назначение:** Хранение фотографий, найденных скрапером при анализе страниц конкурентов

**Структура:**
- `id` (BIGSERIAL) - уникальный идентификатор
- `user_id` (UUID) - пользователь
- `job_id` (UUID) - связь с `scrape_jobs` (задание скрапинга)
- `source_url` (TEXT) - страница, где найдено изображение
- `original_image_url` (TEXT) - оригинальный внешний URL изображения
- `storage_url` (TEXT) - публичный URL в Supabase Storage
- `file_name` (TEXT) - имя файла
- `file_size` (BIGINT) - размер файла
- `mime_type` (TEXT) - тип файла
- `width`, `height` (INTEGER) - размеры изображения
- `created_at` (TIMESTAMPTZ)

**Уникальное ограничение:** `(user_id, job_id, original_image_url)`

**Связь с Storage:**
- Фотографии хранятся в bucket `competitor-photos`
- `storage_url` указывает на файл в этом bucket

---

### 2. Storage Buckets

#### `photos-storage`
**Назначение:** Хранение фотографий из таблицы `photos` (импортированные через n8n)

**Структура:**
- Публичный доступ для чтения
- Лимит размера файла: 50MB
- Разрешенные типы: image/jpeg, image/png, image/webp, image/gif, image/jpg

**Связь:**
- Фотографии обрабатываются Edge Function `process-photos`
- URL фотографий сохраняются в `photos.photo_url`
- Используется для отображения в "Scraped Photos" (левая панель)

---

#### `user-photos`
**Назначение:** Хранение фотографий, загруженных пользователем

**Структура:**
- Публичный доступ для чтения
- Лимит размера файла: 50MB
- Разрешенные типы: image/jpeg, image/png, image/webp, image/gif, image/jpg, image/bmp, image/svg+xml
- Структура папок: `{user_id}/originals/` и `{user_id}/compressed/`

**Связь:**
- URL сохраняются в `user_photos.original_url` и `user_photos.compressed_url`
- Используется для отображения в "Photo History" → "Uploaded Photos"

---

#### `competitor-photos`
**Назначение:** Хранение фотографий конкурентов, найденных скрапером

**Структура:**
- Публичный доступ для чтения
- Лимит размера файла: 50MB
- Разрешенные типы: image/jpeg, image/png, image/webp, image/gif

**Связь:**
- URL сохраняются в `competitor_photos.storage_url`
- Используется для отображения в "Photo History" → "Imported Photos"

---

## Связи в интерфейсе

### Левая панель "Scraped Photos"
**Источник данных:**
- Таблица `photos` со статусом `'completed'`
- Извлекаются URL из поля `photo_url` (может быть JSON массив, разделенные запятыми, или одна строка)
- Фотографии загружаются из bucket `photos-storage` по этим URL
- Отображаются как `ScrapedPhotoWithId[]` в компоненте `Studio.tsx` и `StudioEmpty.tsx`

**Особенности:**
- Длинные числовые имена файлов (например, `581523888_71726781140418...`) - это имена файлов из `photos-storage` bucket
- Фотографии могут быть выбраны и добавлены в студию для работы

---

### Модальное окно "Photo History"
**Источник данных:**
- Функция `getCombinedPhotoHistory()` объединяет данные из трех источников:
  1. `user_photos` → вкладка "Uploaded Photos"
  2. `competitor_photos` → вкладка "Imported Photos" (частично)
  3. `photos` (со статусом `'completed'`) → вкладка "Imported Photos" (основной источник)

**Процесс объединения:**
```typescript
// 1. Загружаются user_photos из таблицы user_photos
//    → source: 'user', type: 'user'
//    → URL из original_url или compressed_url
//    → Файлы в bucket user-photos

// 2. Загружаются competitor_photos из таблицы competitor_photos
//    → source: 'competitor', type: 'competitor'
//    → URL из storage_url
//    → Файлы в bucket competitor-photos

// 3. Загружаются importedPhotos из таблицы photos
//    → source: 'competitor', type: 'competitor'
//    → URL из photo_url (парсится как JSON/CSV/строка)
//    → Файлы в bucket photos-storage
//    → Создаются PhotoHistoryItem для каждого URL
```

**Вкладки:**
- **"All Photos"** - все фотографии из всех источников, отсортированные по дате
- **"Uploaded Photos"** - только из `user_photos` (bucket `user-photos`)
- **"Imported Photos"** - из `competitor_photos` и `photos` (buckets `competitor-photos` и `photos-storage`)

---

## Поток данных

### Импорт ссылки через n8n:
```
1. Пользователь вставляет URL → сохраняется в photos.url
2. n8n обрабатывает ссылку → находит фотографии
3. Edge Function process-photos:
   - Скачивает фотографии по URL
   - Сжимает их
   - Сохраняет в photos-storage bucket
   - Обновляет photos.photo_url с URL фотографий
   - Устанавливает photos.status = 'completed'
4. UI загружает фотографии из photos-storage по URL из photos.photo_url
5. Отображаются в "Scraped Photos" (левая панель)
```

### Загрузка фотографии пользователем:
```
1. Пользователь загружает файл
2. Файл обрабатывается (сжатие, валидация)
3. Сохраняется в user-photos bucket:
   - Оригинал: user-photos/{user_id}/originals/{file_name}
   - Сжатая версия: user-photos/{user_id}/compressed/{file_name}
4. Создается запись в user_photos:
   - original_url → URL оригинального файла
   - compressed_url → URL сжатого файла
5. Отображается в "Photo History" → "Uploaded Photos"
```

### Скрапинг фотографий конкурентов:
```
1. Пользователь запускает скрапинг через scrape_jobs
2. Скрапер находит фотографии на страницах конкурентов
3. Фотографии скачиваются и сохраняются в competitor-photos bucket
4. Создаются записи в competitor_photos:
   - storage_url → URL файла в competitor-photos bucket
   - original_image_url → оригинальный внешний URL
5. Отображаются в "Photo History" → "Imported Photos"
```

---

## Ключевые связи

### Связь между таблицами и buckets:

| Таблица | Bucket | Поле с URL | Назначение |
|---------|--------|------------|------------|
| `photos` | `photos-storage` | `photo_url` | Импортированные фотографии через n8n |
| `user_photos` | `user-photos` | `original_url`, `compressed_url` | Загруженные пользователем фотографии |
| `competitor_photos` | `competitor-photos` | `storage_url` | Фотографии конкурентов, найденные скрапером |

### Связь в UI:

| UI Компонент | Источник данных | Таблица | Bucket |
|--------------|-----------------|---------|--------|
| "Scraped Photos" (левая панель) | `photos` (status='completed') | `photos` | `photos-storage` |
| "Photo History" → "Uploaded Photos" | `user_photos` | `user_photos` | `user-photos` |
| "Photo History" → "Imported Photos" | `competitor_photos` + `photos` | `competitor_photos`, `photos` | `competitor-photos`, `photos-storage` |
| "Photo History" → "All Photos" | Все три источника | Все три таблицы | Все три bucket |

---

## Важные замечания

1. **Дубликаты:** Таблица `photos` имеет уникальное ограничение `(user_id, url)`, что предотвращает повторный импорт той же ссылки.

2. **Формат photo_url:** Поле `photos.photo_url` может содержать:
   - JSON массив: `["url1", "url2"]`
   - Разделенные запятыми: `"url1,url2,url3"`
   - Одна строка: `"url1"`

3. **Имена файлов:** Длинные числовые имена файлов (например, `581523888_71726781140418...`) - это имена файлов, сгенерированные при сохранении в `photos-storage` bucket.

4. **Объединение истории:** Функция `getCombinedPhotoHistory()` объединяет все три источника и сортирует по дате создания, что позволяет показывать единую историю фотографий пользователя.

5. **Base64 данные:** Таблица `user_photos` может хранить изображения в base64 (поля `original_data` и `compressed_data`), но основное хранилище - это Storage buckets.

---

## Файлы для справки

- `src/lib/scrapingUtils.ts` - функция `getCombinedPhotoHistory()` и работа с таблицей `photos`
- `src/components/PhotoHistoryModal.tsx` - компонент модального окна истории фотографий
- `src/pages/Studio.tsx` - компонент студии с панелью "Scraped Photos"
- `src/pages/StudioEmpty.tsx` - компонент пустой студии
- `supabase/migrations/20250101000000_create_photos_table.sql` - создание таблицы `photos`
- `supabase/migrations/20250103000000_create_photos_storage_bucket.sql` - создание bucket `photos-storage`
- `supabase/migrations/20250105000000_create_user_photos_bucket.sql` - создание bucket `user-photos`
- `supabase/migrations/20251030120000_competitor_content.sql` - создание таблицы `competitor_photos`

