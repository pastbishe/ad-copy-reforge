# Исправление ошибки дубликатов в n8n workflow

## Проблема

При попытке вставить данные в таблицу `photos` через n8n возникает ошибка:
```
duplicate key value violates unique constraint "photos_user_id_url_unique"
```

Это происходит потому, что в таблице `photos` есть уникальное ограничение на комбинацию `(user_id, url)`, которое предотвращает создание дубликатов.

## Решение

Вместо простого **INSERT** нужно использовать **UPSERT** (INSERT ... ON CONFLICT DO UPDATE). Это позволит:
- Создавать новую запись, если её ещё нет
- Обновлять существующую запись, если она уже есть

## Инструкция для n8n

### ⚡ Быстрое решение (если параметры не настраиваются)

Если у вас ошибка **"there is no parameter $1"**, используйте этот SQL запрос с прямой подстановкой значений:

```sql
INSERT INTO public.photos (user_id, url, photo_url, status, operation_id)
VALUES (
  '{{ $('Merge4').item.json.body.userId }}',
  '{{ $('Merge4').item.json.body.sourceUrl }}',
  '{{ $('Merge4').item.json.imageUrls }}',
  'completed',
  '{{ $('Merge4').item.json.body.operationNumber }}'
)
ON CONFLICT (user_id, url) 
DO UPDATE SET 
  photo_url = EXCLUDED.photo_url,
  status = EXCLUDED.status,
  operation_id = EXCLUDED.operation_id,
  updated_at = NOW()
RETURNING id;
```

Просто скопируйте этот запрос в поле **Query** узла "Execute a SQL query" и убедитесь, что в секции **Options** ничего не указано (или удалите все параметры, если они есть).

### Вариант 1: Использование PostgreSQL узла с UPSERT

1. Откройте узел **"Insert rows in a table"** в вашем workflow
2. В настройках узла найдите параметр **"Operation"**
3. Если доступна опция **"Upsert"** или **"Insert or Update"**, выберите её
4. В поле **"Conflict Target"** или **"On Conflict"** укажите: `user_id,url`
5. Настройте маппинг полей как обычно

### Вариант 2: Использование PostgreSQL узла с SQL запросом (Execute Query)

Если в вашем PostgreSQL узле нет опции UPSERT, используйте **PostgreSQL** узел с операцией **"Execute Query"**:

1. Добавьте узел **PostgreSQL**
2. Выберите операцию **"Execute Query"**
3. В поле **Query** вставьте следующий SQL:

```sql
INSERT INTO public.photos (user_id, url, photo_url, status, operation_id)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, url) 
DO UPDATE SET 
  photo_url = EXCLUDED.photo_url,
  status = EXCLUDED.status,
  operation_id = EXCLUDED.operation_id,
  updated_at = NOW()
RETURNING id;
```

4. **ВАЖНО:** В секции **"Options"** (внизу под запросом) нажмите **"Add Option"** и добавьте параметры:
   
   Нажмите кнопку **"Add Option"** или **"Add Parameter"** и создайте 5 параметров:
   
   - **Parameter Name:** `$1` или `1` (в зависимости от версии n8n)
     **Value:** `{{ $('Merge4').item.json.body.userId }}`
   
   - **Parameter Name:** `$2` или `2`
     **Value:** `{{ $('Merge4').item.json.body.sourceUrl }}`
   
   - **Parameter Name:** `$3` или `3`
     **Value:** `{{ $('Merge4').item.json.imageUrls }}`
   
   - **Parameter Name:** `$4` или `4`
     **Value:** `completed`
   
   - **Parameter Name:** `$5` или `5`
     **Value:** `{{ $('Merge4').item.json.body.operationNumber }}`

   **Примечание:** В некоторых версиях n8n параметры могут называться просто `1`, `2`, `3`, `4`, `5` без знака доллара, или может быть формат в виде массива. Проверьте документацию вашей версии n8n.

5. **Альтернативный способ (если параметры не работают):** Используйте прямой SQL с подстановкой значений через выражения n8n:

```sql
INSERT INTO public.photos (user_id, url, photo_url, status, operation_id)
VALUES (
  '{{ $('Merge4').item.json.body.userId }}',
  '{{ $('Merge4').item.json.body.sourceUrl }}',
  '{{ $('Merge4').item.json.imageUrls }}',
  'completed',
  '{{ $('Merge4').item.json.body.operationNumber }}'
)
ON CONFLICT (user_id, url) 
DO UPDATE SET 
  photo_url = EXCLUDED.photo_url,
  status = EXCLUDED.status,
  operation_id = EXCLUDED.operation_id,
  updated_at = NOW()
RETURNING id;
```

   ⚠️ **Внимание:** Этот способ менее безопасен с точки зрения SQL-инъекций, но работает, если параметры не настраиваются. Убедитесь, что значения из `Merge4` надежны.

### Вариант 3: Использование HTTP Request к Supabase REST API

Используйте **HTTP Request** узел с методом **POST** и заголовком `Prefer: resolution=merge-duplicates`:

**URL:** `https://YOUR_SUPABASE_URL/rest/v1/photos`

**Method:** `POST`

**Headers:**
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
apikey: YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
Prefer: resolution=merge-duplicates
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "user_id": "{{ $('Merge4').item.json.body.userId }}",
  "url": "{{ $('Merge4').item.json.body.sourceUrl }}",
  "photo_url": "{{ $('Merge4').item.json.imageUrls }}",
  "status": "completed",
  "operation_id": "{{ $('Merge4').item.json.body.operationNumber }}"
}
```

**Важно:** Supabase REST API автоматически обрабатывает UPSERT при использовании заголовка `Prefer: resolution=merge-duplicates`, но для этого нужно указать конфликтующие колонки в URL или использовать другой подход.

### Вариант 4: Использование Supabase Edge Function

Создайте Edge Function, которая будет обрабатывать UPSERT:

```typescript
// supabase/functions/upsert-photo/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { userId, url, photoUrl, status, operationId } = await req.json();

  // Используем upsert
  const { data, error } = await supabase
    .from('photos')
    .upsert({
      user_id: userId,
      url: url,
      photo_url: photoUrl,
      status: status || 'completed',
      operation_id: operationId
    }, {
      onConflict: 'user_id,url'
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
```

Затем в n8n используйте **HTTP Request** узел для вызова этой функции.

## Рекомендуемое решение

**Рекомендуется использовать Вариант 1** (если доступен) или **Вариант 4** (Edge Function), так как они наиболее надежны и соответствуют архитектуре приложения.

## Проверка

После применения исправления:
1. Запустите workflow с данными, которые ранее вызывали ошибку
2. Убедитесь, что запись либо создается, либо обновляется без ошибок
3. Проверьте в базе данных, что дубликаты не создаются

