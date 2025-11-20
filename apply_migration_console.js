// Скрипт для применения миграции через консоль браузера на странице Supabase Dashboard
// Откройте консоль (F12) на странице https://supabase.com/dashboard/project/ticugdxpzglbpymvfnyj/sql/new
// И выполните этот код

(async function applyMigration() {
  const migrationSQL = `-- Migration: Add DELETE policy for competitor_photos table
-- This allows users to delete their own competitor photos

drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);`;

  console.log('🔧 Попытка применения миграции...');
  
  // Пробуем найти текстовое поле SQL редактора
  const sqlEditor = document.querySelector('textarea, [contenteditable="true"], .monaco-editor textarea');
  
  if (sqlEditor) {
    // Если это textarea
    if (sqlEditor.tagName === 'TEXTAREA') {
      sqlEditor.value = migrationSQL;
      sqlEditor.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('✅ SQL вставлен в редактор. Нажмите Run или Ctrl+Enter для выполнения.');
    } else {
      // Если это contenteditable
      sqlEditor.textContent = migrationSQL;
      sqlEditor.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('✅ SQL вставлен в редактор. Нажмите Run или Ctrl+Enter для выполнения.');
    }
    
    // Пробуем найти кнопку Run
    const runButton = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent.toLowerCase().includes('run') || 
      btn.textContent.toLowerCase().includes('выполнить') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('run')
    );
    
    if (runButton) {
      console.log('✅ Кнопка Run найдена. Вы можете нажать её или использовать Ctrl+Enter.');
    }
  } else {
    console.log('⚠️  SQL редактор не найден автоматически.');
    console.log('📋 Скопируйте следующий SQL и вставьте вручную:');
    console.log('='.repeat(70));
    console.log(migrationSQL);
    console.log('='.repeat(70));
    
    // Копируем в буфер обмена
    if (navigator.clipboard) {
      navigator.clipboard.writeText(migrationSQL).then(() => {
        console.log('✅ SQL скопирован в буфер обмена!');
      }).catch(() => {
        console.log('⚠️  Не удалось скопировать автоматически. Скопируйте вручную.');
      });
    }
  }
})();

