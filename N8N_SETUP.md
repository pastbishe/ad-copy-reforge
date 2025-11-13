# Инструкция по настройке n8n Workflow для скрапинга конкурентов

## Что я сделал в коде

✅ Создал `src/lib/scrapingUtils.ts` с функциями для работы со скрапингом
✅ Обновил `src/pages/ImportCompetitor.tsx` - теперь кнопка запускает реальный скрапинг
✅ Обновил `src/pages/Studio.tsx` - загружает фотографии конкурентов из БД
✅ Обновил `src/components/PhotoHistoryModal.tsx` - показывает объединенную историю (ваши фото + фото конкурентов)

## Что нужно сделать вам

### Шаг 1: Получить Supabase Service Role Key

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите ваш проект
3. Перейдите в **Settings** → **API**
4. Найдите **Service Role Key** (секретный ключ)
5. Скопируйте его и сохраните в безопасном месте

**Важно:** Service Role Key обходит RLS (Row Level Security), поэтому держите его в секрете!

---

### Шаг 2: Настроить переменную окружения в проекте

Создайте файл `.env.local` в корне проекта `ad-copy-reforge/`:

```env
VITE_N8N_SCRAPING_WEBHOOK_URL=https://ваш-n8n-инстанс.com/webhook/scrape-competitor
```

**Пример:**
```env
VITE_N8N_SCRAPING_WEBHOOK_URL=https://n8n.example.com/webhook/abc123-def456-ghi789
```

После создания файла перезапустите dev сервер.

---

### Шаг 3: Создать n8n Workflow

#### 3.1 Создайте новый workflow

1. Откройте ваш n8n инстанс
2. Нажмите **"Workflows"** → **"New Workflow"**
3. Назовите workflow: `Scrape Competitor Ads`

#### 3.2 Добавьте Webhook Node

1. Перетащите **Webhook** node на canvas
2. Настройте:
   - **HTTP Method**: `POST`
   - **Path**: `/scrape-competitor` (или любой другой путь)
   - **Response Mode**: `Respond When Last Node Finishes`
3. Скопируйте **Production URL** - это будет ваш webhook URL
4. Включите workflow (toggle справа вверху)

#### 3.3 Добавьте узлы для скрапинга

После webhook добавьте ваши узлы для скрапинга сайта (HTML Scraper, HTTP Request, и т.д.)

**Важно:** После скрапинга вы должны получить массив объектов с URL изображений:
```json
{
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "filename": "image1.jpg" // опционально
    },
    {
      "url": "https://example.com/image2.jpg"
    }
  ]
}
```

#### 3.4 Добавьте Function Node для обработки каждого изображения

Создайте **Function Node** с таким кодом:

```javascript
// Настройки Supabase
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // ⚠️ Замените на ваш Service Role Key
const BUCKET_NAME = 'user-photos';

// Получаем данные из предыдущего узла
const items = $input.all();
const results = [];

// Получаем данные из webhook
const webhookData = items[0].json;
const userId = webhookData.userId;
const jobId = webhookData.jobId;
const sourceUrl = webhookData.sourceUrl;
const images = webhookData.images || [];

for (const image of images) {
  try {
    const imageUrl = image.url;
    
    // Генерируем имя файла
    const originalFilename = image.filename || imageUrl.split('/').pop() || 'image.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    const filename = `${timestamp}-${random}-${sanitizedFilename}`;
    const filePath = `${userId}/competitor/photos/${filename}`;
    
    // Загружаем изображение
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image: ${imageUrl}`);
      continue;
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const fileSize = imageBuffer.byteLength;
    
    // Загружаем в Supabase Storage
    const storageUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`;
    const uploadResponse = await fetch(storageUrl, {
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
      console.error(`Storage upload failed: ${errorText}`);
      continue;
    }
    
    // Формируем публичный URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
    
    // Получаем размеры изображения (опционально)
    // Можно использовать библиотеку для чтения метаданных
    let width, height;
    try {
      // Простой способ получить размеры через Image
      const img = new Image();
      const blob = new Blob([imageBuffer], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      // В n8n это может не работать, можно пропустить или использовать другую библиотеку
      width = null;
      height = null;
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      width = null;
      height = null;
    }
    
    // Сохраняем в БД
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
        source_url: sourceUrl,
        original_image_url: imageUrl,
        storage_url: publicUrl,
        file_name: filename,
        file_size: fileSize,
        mime_type: mimeType,
        width: width,
        height: height
      })
    });
    
    if (!dbResponse.ok) {
      const errorText = await dbResponse.text();
      console.error(`Database insert failed: ${errorText}`);
      continue;
    }
    
    const dbData = await dbResponse.json();
    
    results.push({
      json: {
        success: true,
        photo: dbData[0] || dbData,
        storageUrl: publicUrl,
        filename: filename
      }
    });
    
  } catch (error) {
    console.error(`Error processing image ${image.url}:`, error);
    results.push({
      json: {
        success: false,
        error: error.message,
        url: image.url
      }
    });
  }
}

return results;
```

#### 3.5 Обновите статус задания скрапинга

Добавьте еще один **Function Node** для обновления статуса задания:

```javascript
const SUPABASE_URL = 'https://ticugdxpzglbpymvfnyj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY';

const items = $input.all();
const webhookData = items[0].json;
const jobId = webhookData.jobId;

// Считаем успешно загруженные фотографии
const successfulPhotos = items.filter(item => item.json.success === true);

// Обновляем статус задания
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
    status: 'done',
    finished_at: new Date().toISOString()
  })
});

return [{
  json: {
    jobId: jobId,
    photosUploaded: successfulPhotos.length,
    totalPhotos: items.length
  }
}];
```

#### 3.6 Добавьте обработку ошибок

Добавьте **If Node** для обработки ошибок:

```
IF ошибка при загрузке:
  - Обновить статус задания на "error"
  - Записать ошибку в поле error таблицы scrape_jobs
```

---

### Шаг 4: Структура данных для webhook

Webhook должен получать такой JSON:

```json
{
  "userId": "uuid-пользователя",
  "jobId": "uuid-задания-скрапинга",
  "sourceUrl": "https://facebook.com/ads/library/...",
  "scrapeJobId": "uuid-задания-скрапинга"
}
```

После скрапинга ваш workflow должен возвращать:

```json
{
  "success": true,
  "photosUploaded": 10,
  "totalPhotos": 10
}
```

---

### Шаг 5: Тестирование

1. Откройте сайт
2. Войдите в систему
3. Перейдите на страницу `/import`
4. Введите URL конкурента (например, Facebook Ads Library)
5. Нажмите "Import & Analyze"
6. Проверьте статус скрапинга
7. После завершения проверьте, что фотографии появились в Studio

---

## Безопасность

⚠️ **ВАЖНО:**

1. **Service Role Key** - секретный ключ, обходит RLS
2. **Не храните его в коде** - используйте переменные окружения в n8n
3. **Не коммитьте `.env.local`** в git - добавьте в `.gitignore`
4. **Используйте HTTPS** для webhook URL

---

## Устранение проблем

### Фотографии не загружаются

1. Проверьте, что Service Role Key правильный
2. Проверьте права доступа к bucket `user-photos`
3. Проверьте логи в Supabase Dashboard

### Webhook не отвечает

1. Проверьте, что workflow включен в n8n
2. Проверьте URL webhook в `.env.local`
3. Проверьте CORS настройки (если используете)

### Задание остается в статусе "running"

1. Проверьте, что последний узел workflow обновляет статус на "done"
2. Добавьте обработку ошибок в workflow

---

## Дополнительные улучшения

### Оптимизация загрузки

- Используйте параллельную загрузку нескольких изображений
- Добавьте очередь для больших объемов
- Добавьте сжатие изображений перед загрузкой

### Мониторинг

- Добавьте логирование в n8n
- Настройте уведомления об ошибках
- Создайте дашборд для отслеживания заданий

---

Готово! Теперь ваш workflow должен работать.

