# Исправление ошибки CORS для generate-merged-photos

## Проблема

При попытке вызвать Edge Function `generate-merged-photos` возникает ошибка:
```
Access to fetch at 'https://ticugdxpzglbpymvfnyj.supabase.co/functions/v1/generate-merged-photos' 
from origin 'http://localhost:8080' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## Решение

Я уже исправил код Edge Function, добавив правильные CORS заголовки. Теперь нужно **развернуть обновленную версию функции**.

## Шаги для исправления

### 1. Убедитесь, что код обновлен

Файл `supabase/functions/generate-merged-photos/index.ts` уже содержит исправления:
- Добавлен `Access-Control-Allow-Methods`
- Добавлен `Access-Control-Max-Age`
- OPTIONS запрос теперь возвращает статус 200

### 2. Разверните обновленную функцию

**Вариант A: Через Supabase CLI (РЕКОМЕНДУЕТСЯ)**

```bash
# Убедитесь, что вы в корне проекта
cd ad-copy-reforge-main

# Если еще не связаны с проектом
supabase link --project-ref ticugdxpzglbpymvfnyj

# Разверните функцию
supabase functions deploy generate-merged-photos
```

**Вариант B: Через Supabase Dashboard**

1. Откройте https://supabase.com/dashboard
2. Выберите проект
3. Перейдите в **Edge Functions**
4. Найдите функцию `generate-merged-photos`
5. Нажмите на неё, чтобы открыть редактор
6. Скопируйте весь код из `supabase/functions/generate-merged-photos/index.ts`
7. Вставьте в редактор в Dashboard
8. Нажмите **"Deploy function"** (зеленая кнопка внизу)

### 3. Проверьте, что секрет установлен

Убедитесь, что `REPLICATE_API_TOKEN` установлен в Secrets:
1. Edge Functions → **Secrets**
2. Проверьте, что есть секрет `REPLICATE_API_TOKEN`
3. Если нет - добавьте его (см. `REPLICATE_API_SETUP.md`)

### 4. Проверьте работу

1. Откройте приложение в браузере
2. Откройте консоль разработчика (F12)
3. Перейдите на страницу Studio
4. Выберите 2 фото (1 скрапленное + 1 ваше)
5. Нажмите "Сгенерировать объединенные"
6. Проверьте консоль - ошибок CORS быть не должно

## Что было исправлено

**До:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}
```

**После:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

if (req.method === "OPTIONS") {
  return new Response("ok", { 
    status: 200,
    headers: corsHeaders 
  });
}
```

## Если проблема сохраняется

1. **Проверьте логи Edge Function:**
   - Supabase Dashboard → Edge Functions → `generate-merged-photos` → Logs
   - Ищите ошибки в логах

2. **Проверьте авторизацию:**
   - Убедитесь, что пользователь авторизован
   - Проверьте, что токен сессии валиден

3. **Проверьте URL функции:**
   - В консоли браузера проверьте, что URL правильный
   - Должен быть: `https://ticugdxpzglbpymvfnyj.supabase.co/functions/v1/generate-merged-photos`

4. **Очистите кеш браузера:**
   - Нажмите Ctrl+Shift+R (или Cmd+Shift+R на Mac) для жесткой перезагрузки

## Дополнительная информация

- [Supabase Edge Functions CORS](https://supabase.com/docs/guides/functions/cors)
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

