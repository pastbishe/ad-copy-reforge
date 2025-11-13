// Скрипт для проверки структуры таблицы photos в Supabase
const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

async function checkPhotosTable() {
  try {
    // Проверяем структуру таблицы через information_schema
    const query = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'photos'
      ORDER BY ordinal_position;
    `;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql: query })
    });

    if (!response.ok) {
      // Если RPC не доступен, попробуем через прямой запрос
      console.log('RPC not available, trying alternative method...');
      return await checkViaDirectQuery();
    }

    const data = await response.json();
    console.log('Current columns in photos table:');
    console.table(data);
    return data;
  } catch (error) {
    console.error('Error checking table:', error);
    return await checkViaDirectQuery();
  }
}

async function checkViaDirectQuery() {
  // Альтернативный способ - через PostgREST
  // Но нам нужен другой подход - создадим SQL миграцию на основе ожидаемой структуры
  console.log('Using expected structure to create migration...');
  return null;
}

checkPhotosTable();




