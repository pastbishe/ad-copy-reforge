// Прямое применение миграции через Supabase REST API
// Этот скрипт пытается выполнить SQL напрямую

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

// SQL для создания DELETE policy
const SQL = `
drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);
`;

async function applyMigration() {
  console.log('🔄 Попытка применения миграции DELETE policy...\n');

  // Пробуем выполнить SQL через Supabase REST API
  // Для выполнения DDL нужен service_role key, но попробуем через anon key
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: SQL })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Миграция успешно применена!');
      console.log('✅ DELETE policy для competitor_photos создана\n');
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
  console.log(SQL.trim());
  console.log('─'.repeat(70));
  console.log('\nИнструкция:');
  console.log('1. Откройте https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj');
  console.log('2. Перейдите в SQL Editor (левое меню)');
  console.log('3. Вставьте SQL выше');
  console.log('4. Нажмите Run (или Ctrl+Enter)');
  console.log('5. Обновите страницу приложения (Ctrl+F5)\n');

  return false;
}

applyMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Готово! Теперь можно удалять фотографии.');
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

