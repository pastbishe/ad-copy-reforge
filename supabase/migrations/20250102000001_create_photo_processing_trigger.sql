-- Migration: Create database function and trigger to call Edge Function
-- when photos table is updated with photo_url and status = 'completed'

-- Создаем функцию для вызова Edge Function
-- Использует pg_net расширение для HTTP запросов
create or replace function public.process_photos_after_import()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_function_url text;
  service_role_key text;
  request_body jsonb;
  request_id bigint;
begin
  -- Проверяем, что статус изменился на 'completed' и photo_url заполнен
  if NEW.status = 'completed' 
     and NEW.photo_url is not null 
     and NEW.photo_url != ''
     and (OLD.status != 'completed' or OLD.photo_url is null or OLD.photo_url = '') then
    
    -- Получаем URL Edge Function (дефолтный для Supabase)
    edge_function_url := 'https://ticugdxpzglbpymvfnyj.supabase.co/functions/v1/process-photos';
    
    -- Получаем Service Role Key из секретов (если настроено)
    -- Иначе нужно будет передать через переменную окружения
    service_role_key := current_setting('app.service_role_key', true);
    
    -- Формируем тело запроса
    -- operation_id может быть NULL, передаем его как есть (или null)
    request_body := jsonb_build_object(
      'photo_id', NEW.id::text,
      'user_id', NEW.user_id::text,
      'url', NEW.url,
      'photo_url', NEW.photo_url,
      'operation_id', CASE 
        WHEN NEW.operation_id IS NOT NULL THEN NEW.operation_id::text 
        ELSE NULL 
      END
    );
    
    -- Вызываем Edge Function через pg_net (асинхронно)
    -- pg_net должен быть установлен в Supabase
    begin
      select net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
        )::jsonb,
        body := request_body::text
      ) into request_id;
      
      raise notice 'Photo processing triggered for operation_id: %, request_id: %', NEW.operation_id, request_id;
    exception when others then
      -- Если pg_net не доступно или произошла ошибка, логируем
      raise warning 'Failed to trigger photo processing: %. Photo processing may need to be triggered manually.', SQLERRM;
      -- В production можно добавить fallback механизм (например, через очередь)
    end;
  end if;
  
  return NEW;
end;
$$;

-- Создаем триггер
drop trigger if exists trigger_process_photos_after_import on public.photos;
create trigger trigger_process_photos_after_import
  after update on public.photos
  for each row
  execute function public.process_photos_after_import();

-- Комментарии
comment on function public.process_photos_after_import() is 
'Вызывает Edge Function для обработки фотографий после обновления записи в таблице photos';

comment on trigger trigger_process_photos_after_import on public.photos is 
'Триггер для автоматической обработки фотографий после импорта';

