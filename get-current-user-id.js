// Скрипт для получения userId текущего залогиненного пользователя
// Запустите этот код в консоли браузера на странице https://ad-copy-reforge-2t2ja6rgp-pastbishes-projects.vercel.app

// Скопируйте и вставьте этот код в консоль браузера (F12 -> Console)

const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";

async function getCurrentUserId() {
  try {
    // Ищем токен в localStorage
    const storageKey = Object.keys(localStorage).find(key => 
      key.includes('supabase.auth.token') || key.includes('sb-')
    );
    
    if (!storageKey) {
      console.error('❌ Не найден токен авторизации. Убедитесь, что вы залогинены на сайте.');
      return null;
    }
    
    const authData = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const accessToken = authData?.currentSession?.access_token || authData?.access_token;
    
    if (!accessToken) {
      console.error('❌ Не найден access token. Убедитесь, что вы залогинены.');
      return null;
    }
    
    // Получаем информацию о пользователе
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const userData = await response.json();
    
    if (!userData || !userData.id) {
      console.error('❌ Не удалось получить данные пользователя');
      return null;
    }
    
    const userId = userData.id;
    
    // Получаем username из профиля
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    
    let username = 'не установлен';
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      if (profileData && profileData.length > 0 && profileData[0].username) {
        username = profileData[0].username;
      }
    }
    
    console.log('\n✅ ============================================');
    console.log('✅ USER ID НАЙДЕН!');
    console.log('✅ ============================================');
    console.log('🆔 User ID:', userId);
    console.log('👤 Username:', username);
    console.log('📧 Email:', userData.email || 'не указан');
    console.log('✅ ============================================');
    console.log('\n🎯 СКОПИРУЙТЕ ЭТОТ USER ID:');
    console.log(userId);
    console.log('\n✅ ============================================\n');
    
    // Копируем в буфер обмена (если доступно)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(userId).then(() => {
        console.log('✅ User ID скопирован в буфер обмена!');
      }).catch(err => {
        console.log('⚠️ Не удалось скопировать в буфер обмена');
      });
    }
    
    return userId;
    
  } catch (error) {
    console.error('❌ Ошибка получения userId:', error);
    return null;
  }
}

// Запускаем функцию
getCurrentUserId();

