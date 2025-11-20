// Edge Function для применения миграции DELETE policy
// Использование: вызывается через HTTP запрос с service_role key

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
    // Получаем service_role key из секретов или заголовков
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                          req.headers.get('x-service-role-key')
    
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Service Role Key не предоставлен' }),
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

    // SQL для создания DELETE policy
    const sql = `
      drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
      create policy "Users can delete own competitor_photos"
        on public.competitor_photos for delete
        using (auth.uid() = user_id);
    `

    // Выполняем SQL через Supabase
    // Используем rpc функцию exec_sql, если она существует
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Если rpc не доступен, пробуем через прямой SQL запрос
      // Но Supabase JS клиент не поддерживает прямой SQL, поэтому используем fetch
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
        throw new Error(`Failed to execute SQL: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'DELETE policy успешно создана',
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
        message: 'DELETE policy успешно создана',
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

