# Инструкция по деплою на Vercel

## Автоматический деплой (Рекомендуется)

### Шаг 1: Подготовка Git репозитория

Если у вас еще нет Git репозитория, инициализируйте его:

```bash
cd /Users/macbookair/Desktop/adcopy/ad-copy-reforge
git init
git add .
git commit -m "Initial commit"
```

### Шаг 2: Загрузите код на GitHub

1. Создайте новый репозиторий на GitHub (не инициализируйте его с README)
2. Выполните команды:

```bash
git remote add origin https://github.com/ВАШ_USERNAME/ВАШ_РЕПОЗИТОРИЙ.git
git branch -M main
git push -u origin main
```

### Шаг 3: Деплой на Vercel

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub аккаунт
3. Нажмите "Add New Project"
4. Выберите ваш репозиторий
5. Vercel автоматически определит настройки (Vite)
6. Нажмите "Deploy"

**Готово!** Vercel автоматически создаст URL вида `https://ваш-проект.vercel.app`

## Автоматические обновления

После настройки, каждый раз когда вы делаете `git push`, Vercel автоматически:
- Соберет новую версию
- Задеплоит её на ваш URL
- Обновление займет ~1-2 минуты

## Альтернатива: Vercel CLI (для быстрого деплоя)

Если вы хотите задеплоить без GitHub:

```bash
# Установите Vercel CLI
npm i -g vercel

# Войдите в аккаунт
vercel login

# Задеплойте проект
vercel
```

## Полезные ссылки

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)

## Текущий проект Lovable

Ваш проект также доступен через Lovable:
https://lovable.dev/projects/3b27ed93-d97c-42fb-8e0d-285832d1d66d

Для публикации через Lovable: Share -> Publish


