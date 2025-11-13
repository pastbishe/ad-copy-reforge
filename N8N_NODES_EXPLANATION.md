# Подробное объяснение узлов n8n для скрапинга

## Что такое узлы в n8n?

**Узлы (Nodes)** в n8n - это отдельные блоки, которые выполняют определенную задачу. Каждый узел имеет вход (для получения данных) и выход (для передачи данных дальше).

---

## Полная структура Workflow

```
[Webhook] → [HTML Scraper / HTTP Request] → [Split In Batches] → [Function Node: Загрузка фото] → [Function Node: Обновление статуса]
```

---

## 1. Webhook Node (Входной узел)

**Что делает:** Принимает запрос от вашего сайта

**Настройки:**
- **HTTP Method**: `POST`
- **Path**: `/scrape-competitor`
- **Response Mode**: `Respond When Last Node Finishes`

**Что получает:**
```json
{
  "userId": "uuid-пользователя",
  "jobId": "uuid-задания",
  "sourceUrl": "https://facebook.com/ads/library/...",
  "scrapeJobId": "uuid-задания"
}
```

**Зачем нужен:** Это точка входа - когда пользователь нажимает кнопку на сайте, запрос приходит сюда.

---

## 2. Узлы для скрапинга (HTML Scraper / HTTP Request)

**Что делает:** Получает HTML страницы и извлекает URL изображений

### Вариант A: HTML Scraper Node

**Если вы скрапите обычную веб-страницу:**

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
3. Результат:
   ```json
   {
     "image_urls": [
       "https://example.com/image1.jpg",
       "https://example.com/image2.jpg"
     ]
   }
   ```

### Вариант B: HTTP Request Node + Code Node

**Если вам нужно сделать запрос и обработать JSON:**

1. Добавьте **HTTP Request** node
   - **Method**: `GET`
   - **URL**: `{{ $json.sourceUrl }}`
   
2. Добавьте **Code** node для обработки ответа:
   ```javascript
   const html = $input.item.json.body;
   const imageUrls = [];
   
   // Используйте регулярные выражения или парсер
   const imgRegex = /<img[^>]+src="([^"]+)"/gi;
   let match;
   while ((match = imgRegex.exec(html)) !== null) {
     imageUrls.push(match[1]);
   }
   
   return [{
     json: {
       images: imageUrls.map(url => ({
         url: url,
         filename: url.split('/').pop()
       })),
       userId: $input.item.json.userId,
       jobId: $input.item.json.jobId,
       sourceUrl: $input.item.json.sourceUrl
     }
   }];
   ```

### Вариант C: Playwright / Browser Automation

**Если нужен браузер для JavaScript-сайтов:**

1. Добавьте **Playwright** node
2. Настройте действия:
   - Открыть страницу
   - Подождать загрузки
   - Извлечь изображения

---

## 3. Split In Batches Node (Опционально)

**Что делает:** Разбивает массив изображений на отдельные элементы для обработки по одному

**Настройки:**
- **Batch Size**: `1` (обрабатывать по одному изображению)
- **Options** → **Keep Only Set Fields**: `false`

**Зачем нужен:** Если у вас массив из 10 изображений, этот узел создаст 10 отдельных элементов для обработки.

---

## 4. Function Node: Загрузка фото в Supabase

**Что делает:** Загружает каждое изображение в Supabase Storage и сохраняет в БД

**Добавьте Function Node** и вставьте этот код:

```javascript
// ⚠️ ВАЖНО: Замените YOUR_SERVICE_ROLE_KEY на ваш реальный Service Role Key!
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';
const BUCKET_NAME = 'user-photos';

// Получаем данные из предыдущего узла
const items = $input.all();
const results = [];

// Получаем базовые данные (userId, jobId, sourceUrl)
// Эти данные должны быть во всех элементах
const firstItem = items[0].json;
const userId = firstItem.userId || items.find(item => item.json.userId)?.json.userId;
const jobId = firstItem.jobId || items.find(item => item.json.jobId)?.json.jobId;
const sourceUrl = firstItem.sourceUrl || items.find(item => item.json.sourceUrl)?.json.sourceUrl;

if (!userId || !jobId) {
  throw new Error('Missing userId or jobId');
}

// Обрабатываем каждый элемент (каждое изображение)
for (const item of items) {
  const imageData = item.json;
  const imageUrl = imageData.url || imageData.image_url || imageData.imageUrl;
  
  if (!imageUrl) {
    console.log('Skipping item - no image URL found:', imageData);
    continue;
  }
  
  try {
    // Генерируем имя файла
    const originalFilename = imageData.filename || imageUrl.split('/').pop() || 'image.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    // Очищаем имя файла от недопустимых символов
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
        // width и height можно добавить позже, если нужны
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
        imageUrl: imageUrl
      }
    });
    
  } catch (error) {
    console.error(`Error processing image ${imageUrl}:`, error);
    results.push({
      json: {
        success: false,
        error: error.message || 'Unknown error',
        url: imageUrl
      }
    });
  }
}

// Возвращаем результаты обработки
return results;
```

**Что происходит в этом узле:**
1. Получает URL изображения из предыдущего узла
2. Загружает изображение по URL
3. Генерирует уникальное имя файла
4. Загружает в Supabase Storage
5. Сохраняет метаданные в таблицу `competitor_photos`

---

## 5. Function Node: Обновление статуса задания

**Что делает:** Обновляет статус задания скрапинга на "done" или "error"

**Добавьте Function Node** после узла загрузки фото и вставьте:

```javascript
// ⚠️ ВАЖНО: Замените YOUR_SERVICE_ROLE_KEY на ваш реальный Service Role Key!
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

if (failedPhotos.length === totalPhotos) {
  // Все фотографии не загрузились - ошибка
  status = 'error';
  errorMessage = `All ${totalPhotos} photos failed to upload`;
} else if (failedPhotos.length > 0) {
  // Часть фотографий не загрузилась - всё равно done, но с предупреждением
  status = 'done';
  errorMessage = `Warning: ${failedPhotos.length} out of ${totalPhotos} photos failed`;
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

**Что происходит в этом узле:**
1. Получает все результаты загрузки фотографий
2. Считает успешные и неуспешные загрузки
3. Определяет финальный статус (`done` или `error`)
4. Обновляет запись в таблице `scrape_jobs`
5. Возвращает статистику обработки

---

## Визуальная схема Workflow

```
┌─────────────┐
│   Webhook   │  ← Принимает запрос от сайта
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
│  Code Node  │  ← Извлекает URL изображений
│  (Optional) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Split In    │  ← Разбивает на отдельные изображения
│   Batches   │    (опционально)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Function   │  ← Загружает каждое фото в Supabase
│ Node: Upload│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Function   │  ← Обновляет статус задания
│ Node: Status│
└─────────────┘
```

---

## Упрощенная версия (без Split In Batches)

Если вы хотите обработать все изображения в одном Function Node:

```
[Webhook] → [Scraper] → [Function: Upload All + Update Status]
```

В одном Function Node объедините код загрузки фото + код обновления статуса.

---

## Какой вариант выбрать?

### Вариант 1: Split In Batches (рекомендуется)
✅ Легче отлаживать
✅ Можно обрабатывать параллельно
✅ Проще обрабатывать ошибки

### Вариант 2: Один Function Node
✅ Меньше узлов
✅ Проще структура
⚠️ Сложнее отлаживать

---

## Важные моменты

1. **Service Role Key** - добавьте его в **Credentials** в n8n для безопасности:
   - Settings → Credentials → Add Credential
   - Тип: Generic Credential Type
   - Имя: `Supabase Service Role`
   - Затем используйте в коде: `$env.SUPABASE_SERVICE_ROLE_KEY`

2. **Обработка ошибок** - код уже обрабатывает ошибки, но можно добавить:
   - **If Node** для проверки успешности
   - **Error Trigger** для отправки уведомлений

3. **Логирование** - используйте `console.log()` для отладки в Function Nodes

---

## Пример минимального рабочего Workflow

**Минимум узлов для работы:**

1. **Webhook** - принимает данные
2. **HTTP Request** - получает страницу
3. **Code/Function** - извлекает URL изображений и загружает их
4. **Function** - обновляет статус

**Всё остальное опционально!**

---

Готово! Теперь вы понимаете структуру workflow. Если что-то непонятно - спрашивайте!

