#!/bin/bash

# Скрипт автоматического деплоя на Vercel при изменении файлов
# Использование: ./auto-deploy.sh

echo "🚀 Автоматический деплой запущен!"
echo "📍 Production URL: https://ad-copy-reforge-2t2ja6rgp-pastbishes-projects.vercel.app"
echo ""
echo "Следим за изменениями в src/..."
echo "Нажмите Ctrl+C для остановки"
echo "---"

cd /Users/macbookair/Desktop/adcopy/ad-copy-reforge

# Счетчик изменений
DEPLOY_COUNT=0

# Функция деплоя
deploy() {
    DEPLOY_COUNT=$((DEPLOY_COUNT + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    echo "⚡️ Обнаружены изменения! Деплой #$DEPLOY_COUNT"
    echo "🕐 Время: $TIMESTAMP"
    
    # Коммитим изменения
    git add .
    git commit -m "Auto-deploy #$DEPLOY_COUNT at $TIMESTAMP" --quiet 2>/dev/null || {
        echo "⚠️  Нет новых изменений для коммита"
        return
    }
    
    # Пушим на GitHub (Vercel автоматически задеплоит)
    echo "📤 Отправка на GitHub..."
    git push origin main --quiet 2>&1 | grep -v "To https://"
    
    if [ $? -eq 0 ]; then
        echo "✅ Успешно! Vercel начал деплой"
        echo "🌐 Изменения появятся через ~1-2 минуты на:"
        echo "   https://ad-copy-reforge-2t2ja6rgp-pastbishes-projects.vercel.app"
        echo ""
        echo "Продолжаем следить за изменениями..."
    else
        echo "❌ Ошибка при отправке"
    fi
    echo "---"
}

# Начальный деплой (если есть несохраненные изменения)
if [[ -n $(git status -s) ]]; then
    echo "📦 Обнаружены несохраненные изменения. Деплоим их сначала..."
    deploy
fi

# Следим за изменениями файлов используя fswatch (встроен в macOS)
if ! command -v fswatch &> /dev/null; then
    echo "⚠️  fswatch не найден. Устанавливаю..."
    # Используем альтернативный способ через встроенные инструменты
    while true; do
        # Сохраняем текущее состояние
        BEFORE=$(find src -type f -exec stat -f "%m" {} \; 2>/dev/null | md5)
        sleep 5
        # Проверяем после паузы
        AFTER=$(find src -type f -exec stat -f "%m" {} \; 2>/dev/null | md5)
        
        if [ "$BEFORE" != "$AFTER" ]; then
            deploy
        fi
    done
else
    # Используем fswatch для мониторинга (более эффективно)
    fswatch -o -r -l 5 src/ | while read change; do
        deploy
    done
fi

