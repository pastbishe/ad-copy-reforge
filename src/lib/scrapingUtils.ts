/**
 * Утилиты для работы с скрапингом конкурентов
 */

import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/lib/networkUtils';

export interface ScrapeJob {
  id: string;
  user_id: string;
  source_url: string;
  status: 'running' | 'done' | 'error';
  idempotency_key?: string;
  started_at: string;
  finished_at?: string;
  error?: string;
}

export interface CompetitorPhoto {
  id: number;
  user_id: string;
  job_id: string;
  source_url: string;
  original_image_url: string;
  storage_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  created_at: string;
}

/**
 * Создает новое задание скрапинга и запускает n8n workflow
 */
export async function startScrapingJob(
  sourceUrl: string,
  userId: string,
  n8nWebhookUrl?: string
): Promise<ScrapeJob> {
  // Создаем запись в БД
  const { data: jobData, error: insertError } = await supabase
    .from('scrape_jobs')
    .insert({
      user_id: userId,
      source_url: sourceUrl,
      status: 'running',
      idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Ошибка создания задания: ${insertError.message}`);
  }

  // Запускаем n8n workflow через webhook
  if (n8nWebhookUrl) {
    try {
      const webhookResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          jobId: jobData.id,
          sourceUrl: sourceUrl,
          scrapeJobId: jobData.id
        })
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('Ошибка запуска n8n workflow:', errorText);
        // Обновляем статус на error
        await supabase
          .from('scrape_jobs')
          .update({ status: 'error', error: 'Failed to start n8n workflow' })
          .eq('id', jobData.id);
      }
    } catch (error) {
      console.error('Ошибка вызова n8n webhook:', error);
      // Обновляем статус на error
      await supabase
        .from('scrape_jobs')
        .update({ 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
        .eq('id', jobData.id);
    }
  }

  return jobData;
}

/**
 * Получает статус задания скрапинга
 */
export async function getScrapeJob(jobId: string): Promise<ScrapeJob | null> {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Ошибка получения задания: ${error.message}`);
  }

  return data;
}

/**
 * Получает все задания скрапинга пользователя
 */
export async function getUserScrapeJobs(userId: string): Promise<ScrapeJob[]> {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Ошибка получения заданий: ${error.message}`);
  }

  return data || [];
}

/**
 * Получает фотографии конкурентов для задания
 */
export async function getCompetitorPhotos(jobId: string): Promise<CompetitorPhoto[]> {
  const { data, error } = await supabase
    .from('competitor_photos')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Ошибка получения фотографий: ${error.message}`);
  }

  return data || [];
}

/**
 * Получает все фотографии конкурентов пользователя
 */
export async function getUserCompetitorPhotos(userId: string, limit: number = 100): Promise<CompetitorPhoto[]> {
  const { data, error } = await supabase
    .from('competitor_photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Ошибка получения фотографий: ${error.message}`);
  }

  return data || [];
}

/**
 * Удаляет запись из таблицы photos (импортированные фотографии)
 */
export async function deletePhotoImport(photoId: string): Promise<void> {
  // Удаляем из базы данных
  const { error: deleteError } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    throw new Error(`Ошибка удаления из базы данных: ${deleteError.message}`);
  }
}

/**
 * Удаляет фотографию конкурента из базы данных и Storage
 */
export async function deleteCompetitorPhoto(photoId: number): Promise<void> {
  // Сначала получаем данные фотографии
  const { data: photo, error: fetchError } = await supabase
    .from('competitor_photos')
    .select('storage_url')
    .eq('id', photoId)
    .single();

  if (fetchError) {
    throw new Error(`Ошибка получения фотографии: ${fetchError.message}`);
  }

  // Удаляем из Storage, если есть storage_url
  if (photo.storage_url) {
    try {
      // Извлекаем путь из URL (убираем домен и bucket)
      // Формат: https://[project].supabase.co/storage/v1/object/public/competitor-photos/[path]
      const urlParts = photo.storage_url.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        const fullPath = urlParts[1];
        // Убираем имя bucket из пути (competitor-photos/)
        const pathWithoutBucket = fullPath.replace(/^competitor-photos\//, '');
        const { error: storageError } = await supabase.storage
          .from('competitor-photos')
          .remove([pathWithoutBucket]);

        if (storageError) {
          console.error('Ошибка удаления из Storage:', storageError);
          // Продолжаем удаление из БД даже если Storage удаление не удалось
        }
      }
    } catch (error) {
      console.error('Ошибка при удалении из Storage:', error);
      // Продолжаем удаление из БД даже если Storage удаление не удалось
    }
  }

  // Удаляем из базы данных
  const { error: deleteError } = await supabase
    .from('competitor_photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    throw new Error(`Ошибка удаления из базы данных: ${deleteError.message}`);
  }
}

/**
 * Получает объединенную историю фотографий пользователя (user_photos + competitor_photos)
 */
export async function getCombinedPhotoHistory(userId: string, limit: number = 50): Promise<any[]> {
  // Получаем user_photos
  const { data: userPhotos, error: userPhotosError } = await supabase
    .from('user_photos')
    .select('*')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Получаем competitor_photos
  const { data: competitorPhotos, error: competitorPhotosError } = await supabase
    .from('competitor_photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Получаем импортированные фотографии из таблицы photos
  const { data: importedPhotos, error: importedPhotosError } = await supabase
    .from('photos')
    .select('id, photo_url, url, created_at, updated_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('photo_url', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit * 2); // Получаем больше, так как один импорт может содержать несколько фотографий

  if (userPhotosError) {
    console.error('Ошибка получения user_photos:', userPhotosError);
  }
  if (competitorPhotosError) {
    console.error('Ошибка получения competitor_photos:', competitorPhotosError);
  }
  if (importedPhotosError) {
    console.error('Ошибка получения импортированных фотографий:', importedPhotosError);
  }

  // Обрабатываем импортированные фотографии
  const importedPhotoItems: any[] = [];
  if (importedPhotos) {
    for (const importItem of importedPhotos) {
      if (!importItem.photo_url) continue;
      
      // Извлекаем URL фотографий (может быть строка, JSON массив или разделенные запятыми)
      let photoUrls: string[] = [];
      
      try {
        const parsed = JSON.parse(importItem.photo_url);
        if (Array.isArray(parsed)) {
          photoUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0);
        } else if (typeof parsed === 'string') {
          photoUrls = [parsed];
        }
      } catch {
        // Если не JSON, проверяем, разделены ли URL запятыми
        const urls = importItem.photo_url.split(',').map((url: string) => url.trim()).filter((url: string) => url.length > 0);
        if (urls.length > 0) {
          photoUrls = urls;
        } else {
          photoUrls = [importItem.photo_url];
        }
      }
      
      // Создаем PhotoHistoryItem для каждого URL
      for (const photoUrl of photoUrls) {
        const fileName = photoUrl.split('/').pop() || `photo-${importItem.id}`;
        importedPhotoItems.push({
          id: `${importItem.id}-${photoUrl}`,
          original_url: photoUrl,
          compressed_url: photoUrl,
          url: photoUrl,
          file_name: fileName,
          file_size: 0,
          width: undefined,
          height: undefined,
          quality_score: undefined,
          is_valid: true,
          created_at: importItem.created_at || importItem.updated_at || new Date().toISOString(),
          source: 'competitor',
          type: 'competitor'
        });
      }
    }
  }

  // Объединяем и сортируем по дате
  const allPhotos = [
    ...(userPhotos || []).map((photo: any) => ({
      ...photo,
      url: photo.original_url || photo.compressed_url,
      source: 'user',
      type: 'user'
    })),
    ...(competitorPhotos || []).map((photo: any) => ({
      ...photo,
      url: photo.storage_url,
      source: 'competitor',
      type: 'competitor',
      // Адаптируем под формат PhotoHistoryItem
      original_url: photo.storage_url,
      compressed_url: photo.storage_url,
      file_name: photo.file_name || 'competitor-image',
      is_valid: true
    })),
    ...importedPhotoItems
  ];

  // Сортируем по дате создания
  return allPhotos.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  }).slice(0, limit);
}

/**
 * Упрощенная функция для запуска скрапинга через n8n webhook
 * Используется, когда webhook сам создает job в БД
 */
export async function startScrapingJobSimple(
  sourceUrl: string,
  userId: string,
  n8nWebhookUrl?: string
): Promise<ScrapeJob> {
  console.log('startScrapingJobSimple вызван:', { sourceUrl, userId, n8nWebhookUrl });
  
  if (!n8nWebhookUrl) {
    console.error('N8N webhook URL не установлен');
    throw new Error('N8N webhook URL is required');
  }

  // Отправляем запрос в n8n webhook с retry логикой
  try {
    const requestBody = {
      sourceUrl: sourceUrl,
      userId: userId
    };
    
    console.log('Отправляем POST запрос на:', n8nWebhookUrl);
    console.log('Тело запроса:', requestBody);
    
    // Обертываем запрос в retry логику для автоматического повтора при ошибках таймаута
    const webhookResponse = await withRetry(async () => {
      // Создаем AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 секунд таймаут
      
      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          const timeoutError: any = new Error('Webhook request timeout: запрос превысил 60 секунд');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        throw fetchError;
      }
    }, {
      maxRetries: 2, // Максимум 2 повтора (всего 3 попытки)
      retryDelay: 2000, // 2 секунды задержка между попытками
    });

    console.log('Ответ вебхука получен:', {
      status: webhookResponse.status,
      statusText: webhookResponse.statusText,
      ok: webhookResponse.ok
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Ошибка вебхука:', errorText);
      throw new Error(`Webhook error: ${webhookResponse.status} - ${errorText}`);
    }

    const result = await webhookResponse.json();
    
    // Получаем jobId из результата или ждем создания job
    // Если webhook сразу возвращает jobId, используем его
    if (result.jobId) {
      // Получаем данные job из БД
      const { data: jobData, error } = await supabase
        .from('scrape_jobs')
        .select('*')
        .eq('id', result.jobId)
        .single();
      
      if (error) {
        throw new Error(`Error fetching job: ${error.message}`);
      }
      
      return jobData;
    }
    
    // Если webhook не возвращает jobId сразу, проверяем, есть ли уже запись с такой ссылкой
    // Если есть - обновляем её, если нет - создаем новую
    const { data: existingJob } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('source_url', sourceUrl)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      // Обновляем существующую запись - обновляем started_at и статус
      const { data: updatedJob, error: updateError } = await supabase
        .from('scrape_jobs')
        .update({
          started_at: new Date().toISOString(),
          status: 'running',
          idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`
        })
        .eq('id', existingJob.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Ошибка обновления задания: ${updateError.message}`);
      }

      return updatedJob;
    }

    // Если записи нет, создаем новую
    const { data: jobData, error: insertError } = await supabase
      .from('scrape_jobs')
      .insert({
        user_id: userId,
        source_url: sourceUrl,
        status: 'running',
        idempotency_key: `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Ошибка создания задания: ${insertError.message}`);
    }

    return jobData;
    
  } catch (error) {
    console.error('Ошибка запуска скрапинга:', error);
    throw error;
  }
}

/**
 * Сохраняет запись об импорте ссылки в таблицу photos
 */
export async function savePhotoImport(
  userId: string,
  url: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending',
  operationId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('photos')
    .insert({
      user_id: userId,
      url: url,  // ссылка, которую вставляет пользователь
      photo_url: null,  // будет заполнено n8n
      status: status,
      operation_id: operationId
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Ошибка сохранения импорта: ${error.message}`);
  }

  return data.id;
}

/**
 * Обновляет запись об импорте ссылки в таблице photos
 */
export async function updatePhotoImport(
  photoId: string,
  status?: 'pending' | 'processing' | 'completed' | 'failed',
  operationId?: string
): Promise<void> {
  const updateData: any = {};
  if (status !== undefined) {
    updateData.status = status;
  }
  if (operationId !== undefined) {
    updateData.operation_id = operationId;
  }

  const { error } = await supabase
    .from('photos')
    .update(updateData)
    .eq('id', photoId);

  if (error) {
    throw new Error(`Ошибка обновления импорта: ${error.message}`);
  }
}

/**
 * Получает все завершенные импорты фотографий с URL для пользователя
 */
export async function getCompletedPhotoImports(
  userId: string
): Promise<Array<{ id: string; photo_url: string; url: string }>> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, photo_url, url')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('photo_url', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Ошибка получения завершенных импортов: ${error.message}`);
  }

  return (data || []).map(item => ({
    id: item.id,
    photo_url: item.photo_url,
    url: item.url
  }));
}

/**
 * Получает все незагруженные завершенные импорты фотографий
 * (те, которые еще не были добавлены в студию)
 */
export async function getUnprocessedCompletedPhotoImports(
  userId: string
): Promise<Array<{ id: string; photo_url: string; url: string }>> {
  console.log('getUnprocessedCompletedPhotoImports: запрос для userId:', userId);
  
  // Используем getCompletedPhotoImports, так как колонка processed может не существовать
  // Дубликаты будут отфильтрованы в processCompletedPhotoImports через isPhotoUrlAlreadyProcessed
  console.log('getUnprocessedCompletedPhotoImports: используем getCompletedPhotoImports (колонка processed не используется)');
  const allCompleted = await getCompletedPhotoImports(userId);
  console.log('getUnprocessedCompletedPhotoImports: найдено завершенных импортов:', allCompleted.length);
  return allCompleted;
}

/**
 * Отмечает импорт как обработанный
 */
export async function markPhotoImportAsProcessed(photoId: string): Promise<void> {
  const { error } = await supabase
    .from('photos')
    .update({ processed: true })
    .eq('id', photoId);

  if (error) {
    // Если колонка processed не существует, просто игнорируем ошибку
    if (error.message.includes('column') && error.message.includes('processed')) {
      console.warn('Колонка processed не существует, пропускаем отметку');
      return;
    }
    throw new Error(`Ошибка отметки импорта: ${error.message}`);
  }
}

/**
 * Проверяет, была ли уже загружена фотография с таким URL для пользователя
 * Оптимизированная версия: использует более эффективный запрос с фильтрацией на стороне БД
 */
export async function isPhotoUrlAlreadyProcessed(
  userId: string,
  photoUrl: string
): Promise<boolean> {
  try {
    // Сначала проверяем точное совпадение - самый быстрый способ
    const { data: exactMatch, error: exactMatchError } = await supabase
      .from('photos')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .eq('photo_url', photoUrl)
      .limit(1)
      .maybeSingle();

    if (exactMatchError) {
      console.error('Ошибка проверки дубликата фотографии (точное совпадение):', exactMatchError);
      // В случае ошибки возвращаем false, чтобы не пропустить фотографию
      return false;
    }

    if (exactMatch) {
      return true;
    }

    // Если точного совпадения нет, проверяем JSON и разделенные запятыми
    // Получаем только завершенные импорты с photo_url (ограничиваем количество для производительности)
    const { data: allPhotos, error: allPhotosError } = await supabase
      .from('photos')
      .select('photo_url')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('photo_url', 'is', null)
      .limit(100); // Ограничиваем количество проверяемых записей

    if (allPhotosError) {
      console.error('Ошибка проверки дубликата фотографии:', allPhotosError);
      // В случае ошибки возвращаем false, чтобы не пропустить фотографию
      return false;
    }

    if (!allPhotos || allPhotos.length === 0) {
      return false;
    }

    // Проверяем каждый photo_url на наличие нашего URL
    for (const photo of allPhotos) {
      if (!photo.photo_url) continue;

      try {
        // Пытаемся распарсить как JSON (массив URL)
        const parsed = JSON.parse(photo.photo_url);
        if (Array.isArray(parsed)) {
          if (parsed.some((url: string) => url === photoUrl || url.trim() === photoUrl)) {
            return true;
          }
        } else if (typeof parsed === 'string' && parsed === photoUrl) {
          return true;
        }
      } catch {
        // Если не JSON, проверяем разделенные запятыми
        const urls = photo.photo_url.split(',').map(url => url.trim());
        if (urls.some(url => url === photoUrl)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Ошибка проверки дубликата фотографии:', error);
    // В случае ошибки возвращаем false, чтобы не пропустить фотографию
    return false;
  }
}

/**
 * Батч-проверка множества URL на дубликаты (оптимизированная версия)
 * Возвращает Set с URL, которые уже были обработаны
 */
export async function batchCheckPhotoUrlsAlreadyProcessed(
  userId: string,
  photoUrls: string[]
): Promise<Set<string>> {
  const processedUrls = new Set<string>();
  
  if (photoUrls.length === 0) {
    return processedUrls;
  }

  try {
    // Получаем все завершенные импорты с photo_url (ограничиваем количество для производительности)
    const { data: allPhotos, error: allPhotosError } = await supabase
      .from('photos')
      .select('photo_url')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('photo_url', 'is', null)
      .limit(200); // Увеличиваем лимит для батч-проверки

    if (allPhotosError) {
      console.error('Ошибка батч-проверки дубликатов фотографий:', allPhotosError);
      // В случае ошибки возвращаем пустой Set, чтобы не пропустить фотографии
      return processedUrls;
    }

    if (!allPhotos || allPhotos.length === 0) {
      return processedUrls;
    }

    // Создаем Set для быстрого поиска
    const urlSet = new Set(photoUrls.map(url => url.trim()));

    // Проверяем каждый photo_url на наличие наших URL
    for (const photo of allPhotos) {
      if (!photo.photo_url) continue;

      try {
        // Пытаемся распарсить как JSON (массив URL)
        const parsed = JSON.parse(photo.photo_url);
        if (Array.isArray(parsed)) {
          parsed.forEach((url: string) => {
            const trimmedUrl = url.trim();
            if (urlSet.has(trimmedUrl)) {
              processedUrls.add(trimmedUrl);
            }
          });
        } else if (typeof parsed === 'string') {
          const trimmedUrl = parsed.trim();
          if (urlSet.has(trimmedUrl)) {
            processedUrls.add(trimmedUrl);
          }
        }
      } catch {
        // Если не JSON, проверяем разделенные запятыми
        const urls = photo.photo_url.split(',').map(url => url.trim());
        urls.forEach(url => {
          if (urlSet.has(url)) {
            processedUrls.add(url);
          }
        });
      }
    }

    return processedUrls;
  } catch (error) {
    console.error('Ошибка батч-проверки дубликатов фотографий:', error);
    // В случае ошибки возвращаем пустой Set, чтобы не пропустить фотографии
    return processedUrls;
  }
}

/**
 * Интерфейс для истории ссылок с фотографией
 */
export interface UrlHistoryItem {
  id: string;
  source_url: string;
  started_at: string;
  status: 'running' | 'done' | 'error';
  first_photo?: {
    storage_url: string;
    file_name?: string;
  };
}

/**
 * Получает историю ссылок пользователя с первой фотографией для каждой ссылки
 * Убирает дубликаты по source_url, оставляя только самую свежую запись
 */
export async function getUrlHistory(userId: string, limit: number = 20): Promise<UrlHistoryItem[]> {
  try {
    // Получаем больше записей, чтобы после удаления дубликатов осталось нужное количество
    const { data: jobs, error: jobsError } = await supabase
      .from('scrape_jobs')
      .select('id, source_url, started_at, status')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit * 3); // Получаем больше записей для фильтрации дубликатов

    if (jobsError) {
      console.error('Ошибка получения истории заданий:', jobsError);
      return [];
    }

    if (!jobs || jobs.length === 0) {
      return [];
    }

    // Убираем дубликаты по source_url, оставляя только самую свежую запись для каждой ссылки
    const uniqueJobsMap = new Map<string, typeof jobs[0]>();
    for (const job of jobs) {
      const existingJob = uniqueJobsMap.get(job.source_url);
      if (!existingJob || new Date(job.started_at) > new Date(existingJob.started_at)) {
        uniqueJobsMap.set(job.source_url, job);
      }
    }

    // Преобразуем Map обратно в массив и сортируем по дате
    const uniqueJobs = Array.from(uniqueJobsMap.values())
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, limit); // Ограничиваем нужным количеством

    // Для каждого задания получаем первую фотографию
    const historyItems: UrlHistoryItem[] = await Promise.all(
      uniqueJobs.map(async (job) => {
        // Получаем первую фотографию для этого задания
        const { data: photos, error: photosError } = await supabase
          .from('competitor_photos')
          .select('storage_url, file_name')
          .eq('job_id', job.id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: job.id,
          source_url: job.source_url,
          started_at: job.started_at,
          status: job.status,
          first_photo: photos && !photosError ? {
            storage_url: photos.storage_url,
            file_name: photos.file_name
          } : undefined
        };
      })
    );

    return historyItems;
  } catch (error) {
    console.error('Ошибка получения истории ссылок:', error);
    return [];
  }
}

