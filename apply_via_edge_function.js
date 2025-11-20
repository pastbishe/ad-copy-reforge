// Применение миграции через Edge Function
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjcyMTIwOSwiZXhwIjoyMDcyMjk3MjA5fQ.k4ja6s4Crazc-ipa9byCBSd9fpiq2E_5pCVoL6l90uI";
const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";

async function applyViaEdgeFunction() {
  console.log('🔄 Попытка применения миграции через Edge Function...\n');

  try {
    // Сначала нужно задеплоить Edge Function, но проще выполнить SQL напрямую
    // Создадим простой скрипт, который откроет браузер с SQL
    
    console.log('📝 Supabase REST API не поддерживает выполнение произвольного SQL.');
    console.log('📝 Для автоматического применения нужен Supabase CLI или прямой доступ к БД.\n');
    console.log('✅ Самый простой способ - выполнить SQL через Supabase Dashboard:\n');
    
    const sql = `
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

    console.log('─'.repeat(70));
    console.log(sql.trim());
    console.log('─'.repeat(70));
    console.log('\n📋 Инструкция:');
    console.log('1. Откройте: https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj/sql/new');
    console.log('2. Скопируйте SQL выше');
    console.log('3. Вставьте в SQL Editor');
    console.log('4. Нажмите Run (или Ctrl+Enter)');
    console.log('5. Обновите страницу приложения (Ctrl+F5)\n');
    
    // Пробуем открыть браузер автоматически (только для Windows)
    try {
      const { exec } = require('child_process');
      exec(`start https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj/sql/new`);
      console.log('🌐 Браузер открыт. Вставьте SQL выше и нажмите Run.\n');
    } catch (e) {
      // Игнорируем ошибки открытия браузера
    }

    return false;
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    return false;
  }
}

applyViaEdgeFunction();






