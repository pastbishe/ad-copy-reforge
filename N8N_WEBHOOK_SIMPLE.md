# Вебхук n8n для скрапинга конкурентов (упрощенная версия)

## Описание

Этот вебхук принимает только два параметра:
- **sourceUrl** - ссылка на рекламу конкурента
- **userId** - ID пользователя

Внутри workflow автоматически создается jobId и запускается процесс скрапинга.

---

## Настройка Webhook Node в n8n

### Шаг 1: Создайте Webhook Node

1. Откройте ваш n8n workflow
2. Добавьте **Webhook** node
3. Настройте:
   - **HTTP Method**: `POST`
   - **Path**: `/scrape-competitor-simple` (или любой другой путь)
   - **Response Mode**: `Respond When Last Node Finishes`
   - **Authentication**: `None` (или настройте по необходимости)

### Шаг 2: Скопируйте Production URL

После настройки webhook node скопируйте **Production URL** - это будет ваш webhook URL для использования в приложении.

**Production URL:**
```
https://n8n.praitech.io/webhook/scrape-competitor-simple
```

---

## Структура данных, которые получает Webhook

Webhook ожидает следующий JSON в теле POST запроса:

```json
{
  "sourceUrl": "https://facebook.com/ads/library/...",
  "userId": "uuid-пользователя",
  "operationNumber": "OP-20250117-123456",
  "photoId": "uuid-записи-в-photos"
}
```

**Важно:**
- `photoId` - ID записи в таблице `photos`, которая была создана ДО вызова вебхука
- n8n должен обновить эту запись после скрапинга, установив `photo_url` и `status = 'completed'`
- Это необходимо для того, чтобы триггер в БД сработал и вызвал Edge Function для обработки фотографий

### Пример запроса:

```bash
curl -X POST https://n8n.praitech.io/webhook/scrape-competitor-simple \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=RU&q=nike",
    "userId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

### Тестовый пример для пользователя pastbishe:

**⚠️ Важно:** Перед использованием получите `userId` по username `pastbishe`.

#### Как получить userId:

**Через SQL запрос в Supabase:**
```sql
SELECT id FROM profiles WHERE username = 'pastbishe';
```

**Через API:**
```bash
curl -X GET 'https://ticugdxpzglbpymvfnyj.supabase.co/rest/v1/profiles?username=eq.pastbishe&select=id' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

#### Пример запроса с реальной ссылкой Facebook Ads Library:

```bash
curl -X POST https://n8n.praitech.io/webhook/scrape-competitor-simple \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=PL&id=506689925025090&is_targeted_country=false&media_type=image_and_meme&search_type=page&view_all_page_id=183869772601",
    "userId": "ВАШ_USER_ID_ЗДЕСЬ"
  }'
```

**Замените `ВАШ_USER_ID_ЗДЕСЬ` на реальный userId пользователя pastbishe.**

---

## Структура Workflow

```
[Webhook] → [Function: Создать Job] → [Скрапинг] → [Function: Загрузка фото] → [Function: Обновление статуса]
```

---

## Узел 1: Function Node - Создание Job

**Цель:** Создать запись в таблице `scrape_jobs` и получить `jobId`

**Код для Function Node:**

```javascript
// ⚠️ ВАЖНО: Замените YOUR_SERVICE_ROLE_KEY на ваш Service Role Key!
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';

// Получаем данные из webhook
const webhookData = $input.item.json;
const userId = webhookData.userId;
const sourceUrl = webhookData.sourceUrl;
const operationNumber = webhookData.operationNumber;
const photoId = webhookData.photoId; // ID записи в таблице photos

// Валидация
if (!userId || !sourceUrl) {
  throw new Error('Missing required fields: userId and sourceUrl are required');
}

// Создаем запись в БД
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
  const errorText = await dbResponse.text();
  console.error(`Failed to create job: ${errorText}`);
  throw new Error(`Failed to create job: ${dbResponse.status}`);
}

const jobData = await dbResponse.json();
const jobId = Array.isArray(jobData) ? jobData[0].id : jobData.id;

// Возвращаем данные для следующих узлов
return [{
  json: {
    userId: userId,
    jobId: jobId,
    sourceUrl: sourceUrl,
    scrapeJobId: jobId,
    operationNumber: operationNumber, // Передаем номер операции
    photoId: photoId, // ВАЖНО: Передаем photoId для обновления таблицы photos
    // Передаем исходные данные дальше
    ...webhookData
  }
}];
```

---

## Узел 2: Скрапинг (HTML Scraper / HTTP Request)

После создания job, добавьте узлы для скрапинга страницы конкурента.

**Вариант A: HTTP Request Node**

1. Добавьте **HTTP Request** node
2. Настройки:
   - **Method**: `GET`
   - **URL**: `{{ $json.sourceUrl }}`
   - **Response Format**: `JSON` или `String` (в зависимости от формата ответа)

**Вариант B: HTML Scraper Node**

1. Добавьте **HTML Scraper** node
2. Настройки:
   - **Operation**: `Extract HTML`
   - **Source**: Из предыдущего узла (URL)
   - **Extract Fields**:
     ```
     image_urls:
       selector: img
       attribute: src
     ```

**Важно:** После скрапинга вы должны получить массив изображений в следующем формате:

```json
{
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "filename": "image1.jpg"
    },
    {
      "url": "https://example.com/image2.jpg"
    }
  ],
  "userId": "uuid-пользователя",
  "jobId": "uuid-задания",
  "sourceUrl": "https://facebook.com/ads/library/..."
}
```

---

## Узел 3: Function Node - Загрузка фотографий

**Код для Function Node:**

```javascript
// ⚠️ ВАЖНО: Замените YOUR_SERVICE_ROLE_KEY на ваш Service Role Key!
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';
const BUCKET_NAME = 'user-photos';

// Получаем данные из предыдущего узла
const items = $input.all();
const results = [];

// Получаем базовые данные (userId, jobId, sourceUrl, photoId)
const firstItem = items[0].json;
const userId = firstItem.userId || items.find(item => item.json.userId)?.json.userId;
const jobId = firstItem.jobId || items.find(item => item.json.jobId)?.json.jobId;
const sourceUrl = firstItem.sourceUrl || items.find(item => item.json.sourceUrl)?.json.sourceUrl;
const photoId = firstItem.photoId || items.find(item => item.json.photoId)?.json.photoId; // ВАЖНО: для обновления таблицы photos

if (!userId || !jobId) {
  throw new Error('Missing userId or jobId');
}

// Получаем массив изображений
let images = [];
if (firstItem.images && Array.isArray(firstItem.images)) {
  images = firstItem.images;
} else if (firstItem.image_urls && Array.isArray(firstItem.image_urls)) {
  images = firstItem.image_urls.map(url => ({ url }));
} else {
  // Если изображения в отдельных элементах
  images = items
    .filter(item => item.json.url || item.json.image_url)
    .map(item => ({
      url: item.json.url || item.json.image_url,
      filename: item.json.filename
    }));
}

if (images.length === 0) {
  console.log('No images found to process');
  return [{
    json: {
      success: false,
      error: 'No images found',
      userId: userId,
      jobId: jobId
    }
  }];
}

// Обрабатываем каждое изображение
for (const image of images) {
  try {
    const imageUrl = image.url || image;
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.log('Skipping invalid image:', image);
      continue;
    }
    
    // Генерируем имя файла
    const originalFilename = image.filename || imageUrl.split('/').pop() || 'image.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    const filename = `${timestamp}-${random}-${sanitizedFilename}`;
    
    // Путь в Storage: userId/competitor/photos/filename
    const filePath = `${userId}/competitor/photos/${filename}`;
    
    // Загружаем изображение по URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageUrl} - Status: ${imageResponse.status}`);
      results.push({
        json: {
          success: false,
          error: `HTTP ${imageResponse.status}`,
          url: imageUrl
        }
      });
      continue;
    }
    
    // Получаем бинарные данные изображения
    const imageBuffer = await imageResponse.arrayBuffer();
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const fileSize = imageBuffer.byteLength;
    
    // Загружаем в Supabase Storage
    const storageUploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`;
    const uploadResponse = await fetch(storageUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': mimeType
      },
      body: imageBuffer
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`Storage upload failed for ${imageUrl}:`, errorText);
      results.push({
        json: {
          success: false,
          error: `Upload failed: ${uploadResponse.status}`,
          url: imageUrl
        }
      });
      continue;
    }
    
    // Формируем публичный URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
    
    // Сохраняем в БД (таблица competitor_photos)
    const dbUrl = `${SUPABASE_URL}/rest/v1/competitor_photos`;
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
        job_id: jobId,
        source_url: sourceUrl || imageUrl,
        original_image_url: imageUrl,
        storage_url: publicUrl,
        file_name: filename,
        file_size: fileSize,
        mime_type: mimeType
      })
    });
    
    if (!dbResponse.ok) {
      const errorText = await dbResponse.text();
      console.error(`Database insert failed for ${imageUrl}:`, errorText);
      results.push({
        json: {
          success: false,
          error: `DB insert failed: ${dbResponse.status}`,
          url: imageUrl
        }
      });
      continue;
    }
    
    const dbData = await dbResponse.json();
    
    // Успешно обработано
    results.push({
      json: {
        success: true,
        photo: Array.isArray(dbData) ? dbData[0] : dbData,
        storageUrl: publicUrl,
        filename: filename,
        imageUrl: imageUrl,
        userId: userId,
        jobId: jobId,
        photoId: photoId // ВАЖНО: передаем photoId для обновления таблицы photos
      }
    });
    
  } catch (error) {
    console.error(`Error processing image ${image.url || image}:`, error);
    results.push({
      json: {
        success: false,
        error: error.message || 'Unknown error',
        url: image.url || image
      }
    });
  }
}

// Возвращаем результаты обработки
return results.length > 0 ? results : [{
  json: {
    success: false,
    error: 'No images processed',
    userId: userId,
    jobId: jobId
  }
}];
```

---

## Узел 4: Function Node - Обновление таблицы photos

**ВАЖНО:** Этот узел должен быть ДО обновления статуса задания. Он обновляет таблицу `photos` с URL фотографий.

**Код для Function Node:**

```javascript
// ⚠️ ВАЖНО: Замените YOUR_SERVICE_ROLE_KEY на ваш Service Role Key!
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';

// Получаем все результаты обработки
const items = $input.all();

// Получаем photoId из первого элемента (должен быть передан из webhook)
const firstItem = items[0].json;
const photoId = firstItem.photoId || 
                items.find(item => item.json.photoId)?.json.photoId;

if (!photoId) {
  console.warn('photoId не найден - пропускаем обновление таблицы photos');
  // Продолжаем выполнение, но без обновления photos
  return items;
}

// Собираем все URL успешно загруженных фотографий
const successfulPhotos = items.filter(item => item.json.success === true);
const photoUrls = successfulPhotos
  .map(item => item.json.storageUrl || item.json.publicUrl)
  .filter(url => url && typeof url === 'string');

if (photoUrls.length === 0) {
  console.warn('Нет URL фотографий для обновления таблицы photos');
  // Продолжаем выполнение
  return items;
}

// Объединяем URL через запятую (или можно использовать JSON массив)
const photoUrlString = photoUrls.join(',');

// Обновляем запись в таблице photos
const updatePhotosUrl = `${SUPABASE_URL}/rest/v1/photos?id=eq.${photoId}`;
const updatePhotosResponse = await fetch(updatePhotosUrl, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    photo_url: photoUrlString,
    status: 'completed',
    updated_at: new Date().toISOString()
  })
});

if (!updatePhotosResponse.ok) {
  const errorText = await updatePhotosResponse.text();
  console.error('Failed to update photos table:', errorText);
  // Не бросаем ошибку, продолжаем выполнение
} else {
  console.log(`Successfully updated photos table for photoId: ${photoId}`);
}

// Возвращаем данные для следующего узла
return items;
```

---

## Узел 5: Function Node - Обновление статуса задания

**Код для Function Node:**

```javascript
// ⚠️ ВАЖНО: Замените YOUR_SERVICE_ROLE_KEY на ваш Service Role Key!
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';

// Получаем все результаты обработки
const items = $input.all();

// Получаем jobId из первого элемента (должен быть во всех)
const jobId = items.find(item => item.json.jobId)?.json.jobId || 
              items[0].json.jobId;

if (!jobId) {
  throw new Error('Missing jobId - cannot update status');
}

// Считаем успешно и неуспешно загруженные фотографии
const successfulPhotos = items.filter(item => item.json.success === true);
const failedPhotos = items.filter(item => item.json.success === false);

const totalPhotos = items.length;
const photosUploaded = successfulPhotos.length;

// Определяем статус
let status = 'done';
let errorMessage = null;

if (failedPhotos.length === totalPhotos && totalPhotos > 0) {
  // Все фотографии не загрузились - ошибка
  status = 'error';
  errorMessage = `All ${totalPhotos} photos failed to upload`;
} else if (failedPhotos.length > 0) {
  // Часть фотографий не загрузилась - всё равно done, но с предупреждением
  status = 'done';
  errorMessage = `Warning: ${failedPhotos.length} out of ${totalPhotos} photos failed`;
} else if (totalPhotos === 0) {
  // Нет фотографий для обработки
  status = 'error';
  errorMessage = 'No images found to process';
}

// Обновляем статус задания в БД
const updateUrl = `${SUPABASE_URL}/rest/v1/scrape_jobs?id=eq.${jobId}`;
const updateResponse = await fetch(updateUrl, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    status: status,
    finished_at: new Date().toISOString(),
    error: errorMessage
  })
});

if (!updateResponse.ok) {
  const errorText = await updateResponse.text();
  console.error('Failed to update job status:', errorText);
  throw new Error(`Failed to update status: ${updateResponse.status}`);
}

// Возвращаем результат
return [{
  json: {
    success: status === 'done',
    jobId: jobId,
    status: status,
    photosUploaded: photosUploaded,
    photosFailed: failedPhotos.length,
    totalPhotos: totalPhotos,
    message: status === 'done' 
      ? `Successfully uploaded ${photosUploaded} photos`
      : errorMessage
  }
}];
```

---

## Использование в приложении

### Обновление функции отправки

Обновите функцию `startScrapingJob` в `src/lib/scrapingUtils.ts` или создайте новую функцию:

```typescript
export async function startScrapingJobSimple(
  sourceUrl: string,
  userId: string,
  n8nWebhookUrl?: string
): Promise<ScrapeJob> {
  if (!n8nWebhookUrl) {
    throw new Error('N8N webhook URL is required');
  }

  // Отправляем запрос в n8n webhook
  try {
    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceUrl: sourceUrl,
        userId: userId
      })
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      throw new Error(`Webhook error: ${webhookResponse.status} - ${errorText}`);
    }

    const result = await webhookResponse.json();
    
    // Получаем jobId из результата или ждем создания job
    // Если webhook сразу возвращает jobId, используем его
    if (result.jobId) {
      // Получаем данные job из БД
      const { data: jobData, error } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('id', result.jobId)
        .single();
      
      if (error) {
        throw new Error(`Error fetching job: ${error.message}`);
      }
      
      return jobData;
    }
    
    // Если webhook не возвращает jobId сразу, создаем job локально
    // и webhook обновит его позже
    const { data: jobData, error: insertError } = await supabase
      .from('scrape_jobs')
      .insert({
        user_id: userId,
        source_url: sourceUrl,
        status: 'running',
        idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Ошибка создания задания: ${insertError.message}`);
    }

    return jobData;
    
  } catch (error) {
    console.error('Ошибка вызова n8n webhook:', error);
    throw error;
  }
}
```

---

## Переменные окружения

Добавьте в `.env.local`:

```env
VITE_N8N_SCRAPING_WEBHOOK_URL=https://n8n.praitech.io/webhook/scrape-competitor-simple
```

---

## Пример полного Workflow

```
┌─────────────┐
│   Webhook   │  ← Принимает { sourceUrl, userId }
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Function   │  ← Создает job в БД, получает jobId
│ Create Job  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ HTTP Request│  ← Загружает HTML страницы
│ или Scraper │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Code Node  │  ← Извлекает URL изображений (опционально)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Function   │  ← Загружает каждое фото в Supabase
│ Upload Photos│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Function   │  ← Обновляет статус задания
│ Update Status│
└─────────────┘
```

---

## Тестирование

### 1. Тест через curl

**Базовый пример:**
```bash
curl -X POST https://n8n.praitech.io/webhook/scrape-competitor-simple \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=RU&q=nike",
    "userId": "ваш-uuid-пользователя"
  }'
```

**Тестовый пример для пользователя pastbishe:**
```bash
curl -X POST https://n8n.praitech.io/webhook/scrape-competitor-simple \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=PL&id=506689925025090&is_targeted_country=false&media_type=image_and_meme&search_type=page&view_all_page_id=183869772601",
    "userId": "ВАШ_USER_ID_ЗДЕСЬ"
  }'
```

**⚠️ Не забудьте:** Замените `ВАШ_USER_ID_ЗДЕСЬ` на реальный userId пользователя pastbishe (получите через SQL: `SELECT id FROM profiles WHERE username = 'pastbishe';`)

### 2. Тест через приложение

1. Откройте страницу `/import`
2. Введите URL конкурента
3. Нажмите "Import & Analyze"
4. Проверьте статус скрапинга
5. После завершения проверьте фотографии в Studio

---

## Безопасность

⚠️ **ВАЖНО:**

1. **Service Role Key** - секретный ключ, обходит RLS
2. **Не храните его в коде** - используйте переменные окружения в n8n (Credentials)
3. **Используйте HTTPS** для webhook URL
4. **Добавьте аутентификацию** в webhook node, если нужно (например, Query Auth или Header Auth)

---

## Устранение проблем

### Webhook не отвечает

1. Проверьте, что workflow включен в n8n
2. Проверьте URL webhook в `.env.local`
3. Проверьте логи в n8n (Executions)

### Job не создается

1. Проверьте Service Role Key в первом Function Node
2. Проверьте права доступа к таблице `scrape_jobs`
3. Проверьте логи в Supabase Dashboard

### Фотографии не загружаются

1. Проверьте Service Role Key в узле загрузки фото
2. Проверьте права доступа к bucket `user-photos`
3. Проверьте логи в Supabase Dashboard

---

Готово! Теперь у вас есть упрощенный вебхук, который принимает только `sourceUrl` и `userId`.


