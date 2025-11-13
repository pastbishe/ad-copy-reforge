// Скрипт для получения userId текущего пользователя
// Запустите этот скрипт в браузере на странице вашего сайта (в консоли разработчика)

// Вариант 1: Получить userId из текущей сессии Supabase
async function getCurrentUserId() {
  // Если вы на странице сайта, используйте Supabase клиент
  const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";
  
  try {
    // Создаем временный клиент Supabase
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    
    // Получаем текущую сессию
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Ошибка получения сессии:', error);
      return null;
    }
    
    if (!session || !session.user) {
      console.error('Пользователь не авторизован');
      return null;
    }
    
    const userId = session.user.id;
    console.log('✅ Ваш userId:', userId);
    console.log('📋 Email:', session.user.email);
    
    // Получаем профиль для проверки username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, id')
      .eq('id', userId)
      .single();
    
    if (!profileError && profile) {
      console.log('👤 Username:', profile.username || 'не установлен');
    }
    
    return userId;
  } catch (error) {
    console.error('Ошибка:', error);
    return null;
  }
}

// Вариант 2: Получить userId по username через API
async function getUserIdByUsername(username) {
  const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${username}&select=id,username`,
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
      console.log('✅ Найден пользователь:', data[0]);
      return data[0].id;
    } else {
      console.error('❌ Пользователь с username "' + username + '" не найден');
      return null;
    }
  } catch (error) {
    console.error('Ошибка получения userId:', error);
    return null;
  }
}

// Использование:
// 1. Если вы залогинены на сайте, используйте:
//    getCurrentUserId().then(userId => console.log('User ID:', userId));

// 2. Если нужно получить по username:
//    getUserIdByUsername('pastbishe').then(userId => console.log('User ID:', userId));

// Экспортируем функции для использования
if (typeof window !== 'undefined') {
  window.getCurrentUserId = getCurrentUserId;
  window.getUserIdByUsername = getUserIdByUsername;
}

// Автоматически получаем userId при загрузке (если залогинены)
if (typeof window !== 'undefined') {
  getCurrentUserId();
}

