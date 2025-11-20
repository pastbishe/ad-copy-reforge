// Прямое применение миграции через Supabase REST API
// Этот скрипт можно запустить в Node.js или в консоли браузера

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

const migrationSQL = `
drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);
`;

async function applyMigrationDirect() {
  console.log('Попытка применения миграции через Supabase REST API...');
  
  // Пробуем применить через PostgREST RPC, если есть функция для выполнения SQL
  // Но обычно это требует service_role ключ
  
  // Альтернативный способ - через прямой HTTP запрос к PostgREST
  // Но для выполнения произвольного SQL нужен service_role
  
  console.log('\n⚠️  Автоматическое применение через REST API требует service_role ключ.');
  console.log('📋 Примените миграцию вручную через Supabase Dashboard:\n');
  console.log('1. Откройте: https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj/sql/new');
  console.log('2. Скопируйте и выполните следующий SQL:\n');
  console.log('='.repeat(70));
  console.log(migrationSQL);
  console.log('='.repeat(70));
  
  // Показываем SQL для копирования
  return migrationSQL;
}

// Если запускается в браузере
if (typeof window !== 'undefined') {
  window.applyMigration = applyMigrationDirect;
  console.log('✅ Функция applyMigration() доступна. Вызовите её в консоли.');
}

// Если запускается в Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyMigrationDirect, migrationSQL };
}

// Автоматический запуск
applyMigrationDirect();

