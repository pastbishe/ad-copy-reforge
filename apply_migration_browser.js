// Скрипт для применения миграции через консоль браузера
// Откройте консоль браузера (F12) на странице Supabase Dashboard и выполните этот код

const migrationSQL = `
-- Migration: Add DELETE policy for competitor_photos table
-- This allows users to delete their own competitor photos

drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);
`;

console.log('📋 SQL для применения миграции:');
console.log('='.repeat(60));
console.log(migrationSQL);
console.log('='.repeat(60));
console.log('\n📝 Инструкция:');
console.log('1. Откройте Supabase Dashboard: https://supabase.com/dashboard');
console.log('2. Выберите ваш проект');
console.log('3. Перейдите в SQL Editor');
console.log('4. Скопируйте SQL выше и выполните его');
console.log('5. Обновите страницу приложения (Ctrl+F5)');

