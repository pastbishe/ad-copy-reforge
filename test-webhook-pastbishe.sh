#!/bin/bash

# Тестовый скрипт для вебхука n8n
# Пользователь: pastbishe
# Ссылка: https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=PL&id=506689925025090&is_targeted_country=false&media_type=image_and_meme&search_type=page&view_all_page_id=183869772601

# ⚠️ ВАЖНО: Замените YOUR_USER_ID на реальный userId пользователя pastbishe
# Получите userId через SQL: SELECT id FROM profiles WHERE username = 'pastbishe';

USER_ID="ВАШ_USER_ID_ЗДЕСЬ"
WEBHOOK_URL="https://n8n.praitech.io/webhook/scrape-competitor-simple"
SOURCE_URL="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=PL&id=506689925025090&is_targeted_country=false&media_type=image_and_meme&search_type=page&view_all_page_id=183869772601"

if [ "$USER_ID" = "ВАШ_USER_ID_ЗДЕСЬ" ]; then
  echo "❌ Ошибка: Замените YOUR_USER_ID на реальный userId пользователя pastbishe"
  echo "Получите userId через SQL запрос:"
  echo "  SELECT id FROM profiles WHERE username = 'pastbishe';"
  exit 1
fi

echo "🚀 Отправка запроса в вебхук n8n..."
echo "📋 URL: $SOURCE_URL"
echo "👤 User ID: $USER_ID"
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"sourceUrl\": \"$SOURCE_URL\",
    \"userId\": \"$USER_ID\"
  }" \
  -w "\n\n📊 HTTP Status: %{http_code}\n"

echo ""
echo "✅ Запрос отправлен!"

