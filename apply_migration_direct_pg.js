// Применение миграции через прямое подключение к PostgreSQL
const { Client } = require('pg');

// Connection string для Supabase PostgreSQL
// Формат: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
// Пароль можно получить из Supabase Dashboard → Settings → Database → Connection string
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.error('❌ Ошибка: Пароль базы данных не установлен!');
  console.log('\n📋 Инструкция:');
  console.log('1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj');
  console.log('2. Перейдите в Settings → Database');
  console.log('3. Найдите Connection string (URI) или Connection pooling');
  console.log('4. Скопируйте пароль из connection string');
  console.log('5. Запустите скрипт с паролем:');
  console.log('   Windows: $env:SUPABASE_DB_PASSWORD="ваш_пароль"; node apply_migration_direct_pg.js');
  console.log('   Linux/Mac: export SUPABASE_DB_PASSWORD="ваш_пароль"; node apply_migration_direct_pg.js');
  console.log('\nИли выполните SQL вручную через Supabase Dashboard SQL Editor');
  process.exit(1);
}

const connectionString = `postgresql://postgres.ticugdxpzglbpymvfnyj:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

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
  console.log('🔄 Применение миграции через прямое подключение к PostgreSQL...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Подключение к базе данных установлено\n');

    // Выполняем SQL
    console.log('🔄 Выполнение миграции...\n');
    await client.query(migrationSQL);

    console.log('✅ Миграция успешно применена!');
    console.log('✅ Bucket user-photos создан с необходимыми политиками\n');
    console.log('🎉 Готово! Теперь можно загружать фотографии.\n');

    return true;
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    
    if (error.message.includes('password') || error.message.includes('authentication')) {
      console.log('\n💡 Проверьте правильность пароля базы данных.');
      console.log('   Получите его из Supabase Dashboard → Settings → Database\n');
    } else if (error.message.includes('connection') || error.message.includes('timeout')) {
      console.log('\n💡 Проверьте подключение к интернету и доступность Supabase.\n');
    } else {
      console.log('\n💡 Выполните SQL вручную через Supabase Dashboard SQL Editor:\n');
      console.log('─'.repeat(70));
      console.log(migrationSQL.trim());
      console.log('─'.repeat(70));
    }
    
    return false;
  } finally {
    await client.end();
  }
}

applyMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });






