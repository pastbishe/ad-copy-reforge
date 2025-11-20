// Edge Function для применения миграции создания bucket user-photos
// Использование: вызывается через HTTP запрос

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Получаем service_role key из секретов
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service Role Key не настроен в секретах Edge Function' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://ticugdxpzglbpymvfnyj.supabase.co'
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // SQL для создания bucket и политик
    const sql = `
      -- Создаем bucket для фотографий пользователей
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'user-photos',
        'user-photos',
        true,
        52428800,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg', 'image/bmp']
      )
      ON CONFLICT (id) DO NOTHING;

      -- Политика для чтения
      DROP POLICY IF EXISTS "Public read access for user photos" ON storage.objects;
      CREATE POLICY "Public read access for user photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'user-photos');

      -- Политика для загрузки
      DROP POLICY IF EXISTS "Users can upload own photos" ON storage.objects;
      CREATE POLICY "Users can upload own photos"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );

      -- Политика для обновления
      DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
      CREATE POLICY "Users can update own photos"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );

      -- Политика для удаления
      DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
      CREATE POLICY "Users can delete own photos"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
    `

    // Выполняем SQL через Supabase
    // Используем прямой SQL запрос через PostgREST
    // Для выполнения DDL нужен прямой доступ к базе данных
    // Пробуем использовать RPC функцию exec_sql, если она существует
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Если RPC не доступен, используем прямой SQL запрос через fetch
      // Но Supabase JS клиент не поддерживает прямой SQL, поэтому используем fetch с service_role
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: sql })
      })

      if (!response.ok) {
        const errorText = await response.text()
        // Если RPC не доступен, возвращаем SQL для ручного выполнения
        return new Response(
          JSON.stringify({ 
            error: 'RPC exec_sql не доступен',
            message: 'Выполните SQL вручную через Supabase Dashboard SQL Editor',
            sql: sql.trim()
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const result = await response.json()
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Bucket user-photos успешно создан с необходимыми политиками',
          result 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bucket user-photos успешно создан с необходимыми политиками',
        data 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Для применения миграции выполните SQL в Supabase Dashboard SQL Editor'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})






