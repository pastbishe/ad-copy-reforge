// Скрипт для применения DELETE политики для competitor_photos
const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

// SQL для применения миграции
const migrationSQL = `
-- Migration: Add DELETE policy for competitor_photos table
-- This allows users to delete their own competitor photos

drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);
`;

async function applyMigration() {
  try {
    console.log('Применение миграции DELETE политики для competitor_photos...');
    
    // Пытаемся применить через RPC функцию exec_sql, если она существует
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql: migrationSQL })
    });

    if (response.ok) {
      console.log('✅ Миграция успешно применена через RPC!');
      return true;
    } else {
      const errorText = await response.text();
      console.log('RPC метод недоступен, используйте SQL Editor в Supabase Dashboard');
      console.log('Ошибка:', errorText);
      console.log('\n📋 Выполните следующий SQL в Supabase SQL Editor:');
      console.log('='.repeat(60));
      console.log(migrationSQL);
      console.log('='.repeat(60));
      return false;
    }
  } catch (error) {
    console.error('Ошибка при применении миграции:', error);
    console.log('\n📋 Выполните следующий SQL в Supabase SQL Editor:');
    console.log('='.repeat(60));
    console.log(migrationSQL);
    console.log('='.repeat(60));
    return false;
  }
}

// Запускаем скрипт
applyMigration().then(success => {
  if (!success) {
    console.log('\n⚠️  Автоматическое применение не удалось.');
    console.log('Пожалуйста, скопируйте SQL выше и выполните его в Supabase Dashboard → SQL Editor');
  }
});

