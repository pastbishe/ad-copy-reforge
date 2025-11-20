// Скрипт для применения миграции DELETE policy для competitor_photos
// Использование: node scripts/apply-delete-policy.js [SERVICE_ROLE_KEY]

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";

// Получаем service_role key из аргументов или переменной окружения
const SERVICE_ROLE_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: Service Role Key не указан!');
  console.log('\nИспользование:');
  console.log('  node scripts/apply-delete-policy.js YOUR_SERVICE_ROLE_KEY');
  console.log('\nИли установите переменную окружения:');
  console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="your-key"');
  console.log('  node scripts/apply-delete-policy.js');
  console.log('\nКак получить Service Role Key:');
  console.log('  1. Откройте https://supabase.com/dashboard');
  console.log('  2. Выберите ваш проект');
  console.log('  3. Перейдите в Settings → API');
  console.log('  4. Скопируйте Service Role Key (секретный ключ)');
  process.exit(1);
}

const SQL = `
-- Migration: Add DELETE policy for competitor_photos table
-- This allows users to delete their own competitor photos

drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);
`;

async function applyMigration() {
  try {
    console.log('🔄 Применение миграции DELETE policy для competitor_photos...\n');

    // Используем Supabase REST API для выполнения SQL
    // Для выполнения DDL команд используем Management API через REST
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql: SQL })
    });

    if (!response.ok) {
      // Если RPC не доступен, попробуем альтернативный способ через прямой SQL
      console.log('⚠️  RPC exec_sql не доступен, пробуем альтернативный метод...\n');
      return await applyViaDirectSQL();
    }

    const result = await response.json();
    console.log('✅ Миграция успешно применена!');
    console.log('✅ DELETE policy для competitor_photos создана');
    console.log('\nТеперь пользователи могут удалять свои фотографии конкурентов.');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    console.log('\nПопробуем альтернативный метод...\n');
    return await applyViaDirectSQL();
  }
}

async function applyViaDirectSQL() {
  // Пробуем выполнить SQL через прямой HTTP запрос к Supabase
  // Используем Management API endpoint для выполнения SQL
  try {
    console.log('🔄 Пробуем выполнить SQL через прямой запрос...\n');
    
    // Пробуем использовать Supabase REST API для выполнения SQL
    // Для этого нужен специальный endpoint или RPC функция
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: SQL })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Миграция успешно применена через REST API!');
      return true;
    } else {
      const errorText = await response.text();
      console.log(`⚠️  REST API вернул ошибку: ${response.status}`);
      console.log(`   ${errorText}\n`);
    }
  } catch (error) {
    console.log(`⚠️  Ошибка при выполнении через REST API: ${error.message}\n`);
  }

  // Если автоматическое выполнение не удалось, выводим инструкции
  console.log('📝 Для применения миграции выполните SQL в Supabase Dashboard:\n');
  console.log('1. Откройте https://supabase.com/dashboard');
  console.log('2. Выберите ваш проект');
  console.log('3. Перейдите в SQL Editor');
  console.log('4. Скопируйте и выполните следующий SQL:\n');
  console.log('─'.repeat(60));
  console.log(SQL);
  console.log('─'.repeat(60));
  console.log('\nИли используйте Supabase CLI:');
  console.log('  supabase db push\n');
  
  return false;
}

// Запускаем миграцию
applyMigration()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });

