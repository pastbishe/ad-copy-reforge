// Скрипт для применения миграции создания bucket user-photos
// Этот скрипт можно запустить в Node.js или в консоли браузера

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

const migrationSQL = `
-- Migration: Create storage bucket for user-uploaded photos
-- This bucket will store both original and compressed images uploaded by users

-- Создаем bucket для фотографий пользователей (если не существует)
-- Bucket name: user-photos
-- Public: true (для публичного доступа к изображениям)
-- File size limit: 50MB
-- Allowed MIME types: image/*

-- Создаем bucket через SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-photos',
  'user-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp']
)
ON CONFLICT (id) DO NOTHING;

-- Политика для чтения (публичный доступ к изображениям)
DROP POLICY IF EXISTS "Public read access for user photos" ON storage.objects;
CREATE POLICY "Public read access for user photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-photos');

-- Политика для загрузки (пользователи могут загружать свои фотографии)
DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Политика для обновления (пользователи могут обновлять свои фотографии)
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

-- Политика для удаления (пользователи могут удалять свои фотографии)
DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
`;

async function applyMigration() {
  console.log('🔄 Попытка применения миграции для создания bucket user-photos...\n');

  // Пробуем выполнить SQL через Supabase REST API
  // Для выполнения DDL нужен service_role key, но попробуем через anon key
  try {
    // Пробуем через RPC функцию, если она существует
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
      const errorText = await response.text();
      console.log(`⚠️  Не удалось применить автоматически (${response.status})`);
      console.log(`   Причина: ${errorText}\n`);
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

// Если запускается в браузере
if (typeof window !== 'undefined') {
  window.applyUserPhotosBucketMigration = applyMigration;
  console.log('✅ Функция applyUserPhotosBucketMigration() доступна. Вызовите её в консоли.');
  applyMigration();
}

// Если запускается в Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyMigration, migrationSQL };
  
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
}






