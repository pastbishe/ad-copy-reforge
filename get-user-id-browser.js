// 🚀 БРАУЗЕРНЫЙ СКРИПТ ДЛЯ ПОЛУЧЕНИЯ USER ID
// 
// ИНСТРУКЦИЯ:
// 1. Откройте ваш сайт в браузере и залогиньтесь
// 2. Откройте консоль разработчика (F12 или Cmd+Option+I)
// 3. Скопируйте и вставьте весь этот код в консоль
// 4. Нажмите Enter
// 5. Скопируйте выведенный userId

(async function() {
  const SUPABASE_URL = "https://ticugdxpzglbpymvfnyj.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3VnZHhwemdsYnB5bXZmbnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MjEyMDksImV4cCI6MjA3MjI5NzIwOX0.pGdJS4Ql5ieOahI0InSMGv1p6sFGGcooUIAvPW_D6K8";
  
  try {
    // Проверяем localStorage для токена
    const storageKey = Object.keys(localStorage).find(key => key.includes('supabase.auth.token'));
    
    if (storageKey) {
      const authData = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const accessToken = authData?.access_token;
      
      if (accessToken) {
        // Получаем информацию о пользователе через токен
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_KEY
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('✅ USER ID НАЙДЕН:');
          console.log('📋 User ID:', userData.id);
          console.log('📧 Email:', userData.email);
          
          // Получаем username из профиля
          const profileResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=username`,
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
              }
            }
          );
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData && profileData.length > 0) {
              console.log('👤 Username:', profileData[0].username || 'не установлен');
            }
          }
          
          console.log('\n🎯 СКОПИРУЙТЕ ЭТОТ USER ID:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(userData.id);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          // Копируем в буфер обмена (если доступно)
          if (navigator.clipboard) {
            navigator.clipboard.writeText(userData.id).then(() => {
              console.log('✅ User ID скопирован в буфер обмена!');
            });
          }
          
          return userData.id;
        }
      }
    }
    
    // Альтернативный способ: через Supabase JS
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Ошибка:', error.message);
      return null;
    }
    
    if (!session || !session.user) {
      console.error('❌ Вы не залогинены. Пожалуйста, войдите в систему.');
      return null;
    }
    
    console.log('✅ USER ID НАЙДЕН:');
    console.log('📋 User ID:', session.user.id);
    console.log('📧 Email:', session.user.email);
    
    // Получаем username
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();
    
    if (profile) {
      console.log('👤 Username:', profile.username || 'не установлен');
    }
    
    console.log('\n🎯 СКОПИРУЙТЕ ЭТОТ USER ID:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(session.user.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Копируем в буфер обмена
    if (navigator.clipboard) {
      navigator.clipboard.writeText(session.user.id).then(() => {
        console.log('✅ User ID скопирован в буфер обмена!');
      });
    }
    
    return session.user.id;
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    console.log('\n💡 Попробуйте другой способ:');
    console.log('1. Откройте DevTools (F12)');
    console.log('2. Перейдите на вкладку Application/Storage');
    console.log('3. Найдите Local Storage -> ваш сайт');
    console.log('4. Найдите ключ с "supabase.auth.token"');
    console.log('5. Скопируйте значение и найдите поле "user.id"');
    return null;
  }
})();

