#!/usr/bin/env node

// Скрипт для получения userId по username через Supabase API
// Использование: node get-user-id-by-username.js pastbishe

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

async function getUserIdByUsername(username) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${username}&select=id,username,email`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const user = data[0];
      console.log('\n✅ Пользователь найден:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👤 Username:', user.username);
      console.log('🆔 User ID:', user.id);
      if (user.email) {
        console.log('📧 Email:', user.email);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n🎯 СКОПИРУЙТЕ ЭТОТ USER ID:');
      console.log(user.id);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      return user.id;
    } else {
      console.error(`❌ Пользователь с username "${username}" не найден`);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка получения userId:', error.message);
    return null;
  }
}

// Получаем username из аргументов командной строки
const username = process.argv[2] || 'pastbishe';

if (!username) {
  console.error('Использование: node get-user-id-by-username.js <username>');
  console.error('Пример: node get-user-id-by-username.js pastbishe');
  process.exit(1);
}

getUserIdByUsername(username).then(userId => {
  if (userId) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

