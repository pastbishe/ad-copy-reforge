// Прямое применение миграции через Supabase Management API
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjcyMTIwOSwiZXhwIjoyMDcyMjk3MjA5fQ.k4ja6s4Crazc-ipa9byCBSd9fpiq2E_5pCVoL6l90uI";
const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";

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
    // Пробуем выполнить SQL через Supabase PostgREST с service_role
    // Используем прямой SQL запрос через специальный endpoint
    // Для выполнения DDL через REST API нужно использовать правильный формат
    
    // Разбиваем SQL на отдельные команды
    const sqlCommands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`Выполняем ${sqlCommands.length} SQL команд...\n`);

    // Пробуем выполнить каждую команду отдельно
    for (let i = 0; i < sqlCommands.length; i++) {
      const sql = sqlCommands[i];
      if (!sql || sql.length === 0) continue;

      try {
        // Пробуем через прямой SQL запрос к PostgREST
        // Используем специальный формат для выполнения SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: sql })
        });

        if (response.ok || response.status === 204) {
          console.log(`✅ Команда ${i + 1}/${sqlCommands.length} выполнена`);
        } else {
          const errorText = await response.text();
          console.log(`⚠️  Команда ${i + 1} не выполнена (${response.status}): ${errorText.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`⚠️  Ошибка при выполнении команды ${i + 1}: ${error.message}`);
      }
    }

    // Альтернативный способ - через Management API
    // Используем прямой HTTP запрос к Supabase для выполнения SQL
    console.log('\n🔄 Пробуем альтернативный метод через прямой SQL запрос...\n');
    
    const directResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/vnd.pgjson.object+json',
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (directResponse.ok) {
      console.log('✅ Миграция успешно применена через прямой запрос!');
      return true;
    } else {
      const errorText = await directResponse.text();
      console.log(`⚠️  Прямой запрос не сработал (${directResponse.status}): ${errorText.substring(0, 200)}`);
    }

  } catch (error) {
    console.log(`⚠️  Ошибка: ${error.message}\n`);
  }

  // Если автоматическое применение не удалось, используем Supabase Management API
  console.log('\n🔄 Пробуем через Supabase Management API...\n');
  
  try {
    // Используем правильный endpoint для выполнения SQL через Management API
    // Supabase Management API использует другой формат
    const mgmtResponse = await fetch(`https://api.supabase.com/v1/projects/ticugdxpzglbpymvfnyj/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (mgmtResponse.ok) {
      const result = await mgmtResponse.json();
      console.log('✅ Миграция успешно применена через Management API!');
      console.log('Результат:', result);
      return true;
    } else {
      const errorText = await mgmtResponse.text();
      console.log(`⚠️  Management API вернул ошибку (${mgmtResponse.status}): ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`⚠️  Ошибка Management API: ${error.message}`);
  }

  // Если все методы не сработали, выводим SQL для ручного выполнения
  console.log('\n📝 Автоматическое применение не удалось. Выполните SQL вручную:\n');
  console.log('─'.repeat(70));
  console.log(migrationSQL.trim());
  console.log('─'.repeat(70));
  console.log('\n📋 Инструкция:');
  console.log('1. Откройте https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj/sql/new');
  console.log('2. Вставьте SQL выше');
  console.log('3. Нажмите Run (или Ctrl+Enter)');
  console.log('4. Обновите страницу приложения (Ctrl+F5)\n');

  return false;
}

applyMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Готово! Bucket user-photos создан. Теперь можно загружать фотографии.');
      process.exit(0);
    } else {
      console.log('💡 Выполните SQL вручную через Supabase Dashboard, как указано выше.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });






