# Исправление структуры таблицы photos

## Что делает этот скрипт

SQL скрипт `fix_photos_table.sql` автоматически:
1. ✅ Проверяет, существует ли таблица `photos`
2. ✅ Создает таблицу, если её нет
3. ✅ Проверяет каждую колонку и добавляет недостающие
4. ✅ Исправляет ограничение NOT NULL на колонке `photo_url` (делает её nullable)
5. ✅ Создает индексы
6. ✅ Настраивает RLS (Row Level Security)
7. ✅ Создает триггер для обновления `updated_at`

## Как выполнить

### Шаг 1: Откройте Supabase Dashboard

1. Перейдите на [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor**

### Шаг 2: Выполните SQL скрипт

1. Откройте файл `fix_photos_table.sql` в проекте
2. Скопируйте весь SQL код
3. Вставьте в SQL Editor в Supabase
4. Нажмите **Run** (или Ctrl+Enter)

### Шаг 3: Проверьте результат

После выполнения вы увидите список всех колонок таблицы `photos`:

```
column_name  | data_type | is_nullable | column_default
-------------|-----------|-------------|---------------
id           | uuid      | NO          | gen_random_uuid()
user_id      | uuid      | NO          | 
url          | text      | NO          | 
photo_url    | text      | YES         | 
status       | text      | NO          | 'pending'
operation_id | uuid      | YES         | 
created_at   | timestamptz | NO        | now()
updated_at   | timestamptz | NO        | now()
```

**Важно:** Убедитесь, что `photo_url` имеет `is_nullable = YES` (разрешены NULL значения)

### Шаг 4: Обновите страницу

1. Обновите страницу в браузере (Ctrl+F5 или Cmd+Shift+R)
2. Попробуйте снова импортировать ссылку
3. Ошибка должна исчезнуть!

## Ожидаемая структура таблицы

После выполнения скрипта таблица `photos` должна содержать:

| Колонка | Тип | Nullable | Описание |
|---------|-----|----------|----------|
| `id` | uuid | NO | Уникальный ID записи |
| `user_id` | uuid | NO | ID пользователя |
| `url` | text | NO | Ссылка, которую вставляет пользователь |
| `photo_url` | text | **YES** | URL фото от n8n (может быть NULL) |
| `status` | text | NO | Статус: 'pending', 'processing', 'completed', 'failed' |
| `operation_id` | uuid | YES | ID операции из scrape_jobs |
| `created_at` | timestamptz | NO | Дата создания |
| `updated_at` | timestamptz | NO | Дата обновления |

## Если что-то пошло не так

Если после выполнения скрипта ошибка все еще появляется:

1. Проверьте, что `photo_url` имеет `is_nullable = YES`
2. Выполните этот SQL для проверки:

```sql
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'photos'
ORDER BY ordinal_position;
```

3. Если `photo_url` все еще `is_nullable = NO`, выполните:

```sql
ALTER TABLE public.photos ALTER COLUMN photo_url DROP NOT NULL;
```




