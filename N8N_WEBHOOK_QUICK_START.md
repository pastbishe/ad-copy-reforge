# Быстрый старт: Упрощенный вебхук n8n

## Что нужно

Вебхук в n8n, который принимает только:
- **sourceUrl** - ссылка на рекламу конкурента
- **userId** - ID пользователя

## Настройка в n8n

### 1. Создайте Webhook Node

1. Откройте n8n workflow
2. Добавьте **Webhook** node
3. Настройте:
   - **HTTP Method**: `POST`
   - **Path**: `/scrape-competitor-simple` (или любой другой)
   - **Response Mode**: `Respond When Last Node Finishes`
4. Скопируйте **Production URL**

### 2. Добавьте Function Node для создания Job

```javascript
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';

const webhookData = $input.item.json;
const userId = webhookData.userId;
const sourceUrl = webhookData.sourceUrl;

if (!userId || !sourceUrl) {
  throw new Error('Missing required fields: userId and sourceUrl');
}

// Создаем job в БД
const dbUrl = `${SUPABASE_URL}/rest/v1/scrape_jobs`;
const dbResponse = await fetch(dbUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    user_id: userId,
    source_url: sourceUrl,
    status: 'running',
    idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`
  })
});

if (!dbResponse.ok) {
  throw new Error(`Failed to create job: ${dbResponse.status}`);
}

const jobData = await dbResponse.json();
const jobId = Array.isArray(jobData) ? jobData[0].id : jobData.id;

return [{
  json: {
    userId: userId,
    jobId: jobId,
    sourceUrl: sourceUrl,
    scrapeJobId: jobId
  }
}];
```

### 3. Добавьте узлы для скрапинга

После создания job добавьте узлы для:
- Скрапинга страницы (HTTP Request / HTML Scraper)
- Извлечения URL изображений
- Загрузки фотографий в Supabase
- Обновления статуса задания

**Полная инструкция:** См. `N8N_WEBHOOK_SIMPLE.md`

## Использование в коде

### Вариант 1: Использовать упрощенную функцию

```typescript
import { startScrapingJobSimple } from '@/lib/scrapingUtils';

const job = await startScrapingJobSimple(
  'https://facebook.com/ads/library/...',
  userId,
  'https://n8n.praitech.io/webhook/scrape-competitor-simple'
);
```

### Вариант 2: Обновить существующий код

В `ImportCompetitor.tsx` можно использовать:

```typescript
import { startScrapingJobSimple } from '@/lib/scrapingUtils';

// Использовать упрощенный вебхук
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_SCRAPING_WEBHOOK_URL || '';

const job = await startScrapingJobSimple(url, userId, N8N_WEBHOOK_URL);
```

## Переменные окружения

Добавьте в `.env.local`:

```env
VITE_N8N_SCRAPING_WEBHOOK_URL=https://n8n.praitech.io/webhook/scrape-competitor-simple
```

**Production URL:**
```
https://n8n.praitech.io/webhook/scrape-competitor-simple
```

## Пример запроса

### Базовый пример

```bash
curl -X POST https://n8n.praitech.io/webhook/scrape-competitor-simple \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=RU&q=nike",
    "userId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

### Тестовый пример для пользователя pastbishe

**⚠️ Важно:** Перед использованием получите `userId` по username. 

#### Как получить userId по username:

1. **Через Supabase Dashboard:**
   - Откройте таблицу `profiles`
   - Найдите строку с `username = 'pastbishe'`
   - Скопируйте значение поля `id` (это и есть userId)

2. **Через SQL запрос в Supabase:**
   ```sql
   SELECT id FROM profiles WHERE username = 'pastbishe';
   ```

3. **Через API:**
   ```bash
   curl -X GET 'https://ticugdxpzglbpymvfnyj.supabase.co/rest/v1/profiles?username=eq.pastbishe&select=id' \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

#### Пример запроса с реальной ссылкой:

```bash
curl -X POST https://n8n.praitech.io/webhook/scrape-competitor-simple \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=PL&id=506689925025090&is_targeted_country=false&media_type=image_and_meme&search_type=page&view_all_page_id=183869772601",
    "userId": "ВАШ_USER_ID_ЗДЕСЬ"
  }'
```

**Замените `ВАШ_USER_ID_ЗДЕСЬ` на реальный userId пользователя pastbishe.**

## Структура данных

**Входные данные (POST запрос):**
```json
{
  "sourceUrl": "https://facebook.com/ads/library/...",
  "userId": "uuid-пользователя"
}
```

**Выходные данные (опционально):**
```json
{
  "jobId": "uuid-задания",
  "success": true,
  "message": "Job created successfully"
}
```

## Документация

- **Полная инструкция:** `N8N_WEBHOOK_SIMPLE.md`
- **Объяснение узлов:** `N8N_NODES_EXPLANATION.md`
- **Настройка workflow:** `N8N_SETUP.md`

---

Готово! Теперь у вас есть упрощенный вебхук для работы с n8n.


