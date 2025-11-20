// Скрипт для применения миграции создания bucket user-photos с SERVICE_ROLE_KEY
// Использование: SERVICE_ROLE_KEY="ваш_ключ" node apply_user_photos_bucket_with_service_key.js

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: SERVICE_ROLE_KEY не установлен!');
  console.log('\n📋 Инструкция:');
  console.log('1. Получите SERVICE_ROLE_KEY из Supabase Dashboard:');
  console.log('   Settings → API → service_role (secret)');
  console.log('2. Запустите скрипт с ключом:');
  console.log('   Windows: $env:SERVICE_ROLE_KEY="ваш_ключ"; node apply_user_photos_bucket_with_service_key.js');
  console.log('   Linux/Mac: export SERVICE_ROLE_KEY="ваш_ключ"; node apply_user_photos_bucket_with_service_key.js');
  console.log('\nИли выполните SQL вручную через Supabase Dashboard SQL Editor');
  process.exit(1);
}

const migrationSQL = `
-- Migration: Create storage bucket for user-uploaded photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for user photos" ON storage.objects;
CREATE POLICY "Public read access for user photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-photos');

DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
`;

async function applyMigration() {
  console.log('🔄 Применение миграции для создания bucket user-photos...\n');

  try {
    // Пробуем выполнить SQL через Supabase Management API
    // Используем прямой SQL запрос через REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Миграция успешно применена!');
      console.log('✅ Bucket user-photos создан с необходимыми политиками\n');
      return true;
    } else {
      // Если RPC не доступен, пробуем через прямой SQL запрос к PostgREST
      console.log(`⚠️  RPC exec_sql не доступен (${response.status}), пробуем альтернативный метод...\n`);
      
      // Пробуем выполнить SQL через прямой запрос к PostgREST
      // Но для DDL команд нужен специальный endpoint
      const directResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: migrationSQL })
      });

      if (directResponse.ok) {
        console.log('✅ Миграция успешно применена через прямой запрос!');
        return true;
      } else {
        const errorText = await directResponse.text();
        console.log(`⚠️  Не удалось применить автоматически (${directResponse.status})`);
        console.log(`   Причина: ${errorText}\n`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Ошибка: ${error.message}\n`);
  }

  // Если автоматическое применение не удалось, выводим SQL для ручного выполнения
  console.log('📝 Выполните следующий SQL в Supabase Dashboard SQL Editor:\n');
  console.log('─'.repeat(70));
  console.log(migrationSQL.trim());
  console.log('─'.repeat(70));
  console.log('\n📋 Инструкция:');
  console.log('1. Откройте https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj');
  console.log('2. Перейдите в SQL Editor (левое меню → SQL Editor)');
  console.log('3. Вставьте SQL выше');
  console.log('4. Нажмите Run (или Ctrl+Enter)');
  console.log('5. Обновите страницу приложения (Ctrl+F5)\n');

  return false;
}

applyMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Готово! Bucket user-photos создан. Теперь можно загружать фотографии.');
      process.exit(0);
    } else {
      console.log('💡 Выполните SQL вручную, как указано выше.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });






