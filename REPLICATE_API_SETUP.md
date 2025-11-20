# Настройка Replicate API для генерации изображений

## Что такое Replicate API?

Replicate - это платформа для запуска ML моделей в облаке. Мы используем её для генерации объединенных фотографий через Stable Diffusion XL.

## Пошаговая инструкция

### Шаг 1: Получить API ключ Replicate

1. **Зарегистрируйтесь на Replicate:**
   - Перейдите на https://replicate.com
   - Нажмите "Sign Up" и создайте аккаунт (можно через GitHub/Google)

2. **Получите API токен:**
   - После регистрации перейдите в **Account Settings**
   - Или напрямую: https://replicate.com/account/api-tokens
   - Нажмите **"Create token"**
   - Скопируйте токен (он показывается только один раз!)
   - Формат токена: `r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Проверьте баланс:**
   - Replicate работает по pay-as-you-go модели
   - Убедитесь, что у вас есть средства на счету
   - Обычно есть бесплатный стартовый кредит

---

### Шаг 2: Установить ключ в Supabase

#### Способ 1: Через Supabase Dashboard (РЕКОМЕНДУЕТСЯ)

1. **Откройте Supabase Dashboard:**
   - Перейдите на https://supabase.com/dashboard
   - Войдите в свой аккаунт

2. **Выберите проект:**
   - Найдите проект с ID: `ticugdxpzglbpymvfnyj`
   - Или выберите нужный проект из списка

3. **Перейдите в настройки Edge Functions:**
   - В левом меню: **Settings** (⚙️)
   - Выберите **Edge Functions**
   - Найдите раздел **"Secrets"** или **"Environment Variables"**

4. **Добавьте секрет:**
   - Нажмите **"Add new secret"** или **"New secret"**
   - **Name**: `REPLICATE_API_TOKEN` (точно так, без пробелов)
   - **Value**: вставьте ваш токен из Replicate (начинается с `r8_`)
   - Нажмите **"Save"** или **"Add secret"**

5. **Проверьте:**
   - Секрет должен появиться в списке
   - Убедитесь, что имя точно `REPLICATE_API_TOKEN`

#### Способ 2: Через Supabase CLI

Если у вас установлен Supabase CLI:

```bash
# Установите Supabase CLI (если еще не установлен)
npm install -g supabase

# Войдите в Supabase
supabase login

# Свяжите проект
supabase link --project-ref ticugdxpzglbpymvfnyj

# Установите секрет
supabase secrets set REPLICATE_API_TOKEN=ваш_токен_здесь

# Проверьте, что секрет установлен
supabase secrets list
```

**Важно:** Замените `ваш_токен_здесь` на реальный токен из Replicate!

---

### Шаг 3: Развернуть Edge Function (если еще не развернут)

**Что это значит?** Edge Function - это код, который работает на сервере Supabase и генерирует изображения. Его нужно "загрузить" на сервер один раз.

**Нужно ли это делать?** 
- ✅ **ДА**, если вы только что создали Edge Function и он еще не развернут
- ❌ **НЕТ**, если Edge Function уже развернут и работает

**Как проверить, развернут ли он?**
1. Откройте Supabase Dashboard
2. Перейдите в **Edge Functions** (в левом меню)
3. Если видите функцию `generate-merged-photos` в списке - она уже развернута ✅
4. Если не видите - нужно развернуть (см. ниже)

**Как развернуть (если нужно):**

**Вариант 1: Через Supabase CLI (если используете командную строку)**
```bash
# Установите Supabase CLI (если еще не установлен)
npm install -g supabase

# Войдите в Supabase
supabase login

# Свяжите проект
supabase link --project-ref ticugdxpzglbpymvfnyj

# Разверните функцию
supabase functions deploy generate-merged-photos
```

**Вариант 2: Через Supabase Dashboard**
1. Откройте Supabase Dashboard
2. Перейдите в **Edge Functions**
3. Нажмите **"Deploy"** или **"New Function"**
4. Выберите папку `supabase/functions/generate-merged-photos`
5. Нажмите **"Deploy"**

**Важно:** После развертывания функция автоматически получит доступ к секрету `REPLICATE_API_TOKEN`, который вы установили в Шаге 2.

---

### Шаг 4: Проверить работу

1. **Откройте Studio в вашем приложении**
2. **Загрузите скрапленное фото** (через импорт ссылки)
3. **Загрузите ваше фото** (через кнопку "Add Product")
4. **Выберите оба фото** (чекбоксы)
5. **Нажмите "Сгенерировать объединенные"**
6. **Проверьте консоль браузера** на наличие ошибок

Если видите ошибку `REPLICATE_API_TOKEN not configured` - значит секрет не установлен или установлен неправильно.

---

## Стоимость использования Replicate

- **Stable Diffusion XL**: ~$0.003-0.01 за изображение
- **3 варианта**: ~$0.01-0.03 за генерацию
- Есть бесплатный стартовый кредит для новых пользователей

**Совет:** Начните с небольшой суммы ($5-10) для тестирования.

---

## Альтернативные API (если Replicate не подходит)

Если хотите использовать другой сервис, можно заменить в `supabase/functions/generate-merged-photos/index.ts`:

- **OpenAI DALL-E**: `https://api.openai.com/v1/images/edits`
- **Stability AI**: `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image`
- **Midjourney API** (через сторонние сервисы)

---

## Устранение проблем

### Ошибка: "REPLICATE_API_TOKEN not configured"
- Проверьте, что секрет установлен в Supabase Dashboard
- Убедитесь, что имя секрета точно `REPLICATE_API_TOKEN` (без пробелов)
- Перезапустите Edge Function после добавления секрета

### Ошибка: "Invalid API token"
- Проверьте, что токен скопирован полностью (начинается с `r8_`)
- Убедитесь, что токен активен в Replicate Dashboard
- Проверьте баланс на счету Replicate

### Ошибка: "Generation timeout"
- Генерация может занять 30-120 секунд
- Проверьте логи Edge Function в Supabase Dashboard
- Убедитесь, что модель доступна на Replicate

---

## Где найти логи Edge Function?

1. Supabase Dashboard → **Edge Functions**
2. Выберите функцию `generate-merged-photos`
3. Перейдите на вкладку **"Logs"**
4. Там будут все ошибки и отладочная информация

---

## Дополнительная информация

- **Replicate Docs**: https://replicate.com/docs
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Stable Diffusion XL**: https://replicate.com/stability-ai/sdxl

