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
 * Проверяет статус задания и автоматически обновляет его на 'done', если есть фотографии
 */
export async function checkAndUpdateScrapeJobStatus(jobId: string): Promise<'running' | 'done' | 'error'> {
  try {
    const job = await getScrapeJob(jobId);
    
    if (!job) {
      console.warn(`Задание с ID ${jobId} не найдено`);
      return 'error';
    }

    // Если статус уже не 'running', возвращаем текущий статус
    if (job.status !== 'running') {
      return job.status;
    }

    // Проверяем, есть ли фотографии для этого задания
    try {
      const photos = await getCompetitorPhotos(jobId);
      
      // Если есть фотографии, обновляем статус на 'done'
      if (photos.length > 0) {
        const { error: updateError } = await supabase
          .from('scrape_jobs')
          .update({ 
            status: 'done',
            finished_at: new Date().toISOString()
          })
          .eq('id', jobId);

        if (updateError) {
          console.error('Ошибка обновления статуса задания:', updateError);
          return job.status; // Возвращаем текущий статус при ошибке
        }

        return 'done';
      }
    } catch (photosError) {
      console.error('Ошибка получения фотографий для задания:', photosError);
      // Продолжаем с текущим статусом, если не удалось получить фотографии
    }

    return 'running';
  } catch (error) {
    console.error('Ошибка проверки статуса задания:', error);
    // Возвращаем 'error' при любой ошибке
    return 'error';
  }
}

/**
 * Ожидает завершения задания скрапинга (пока статус не станет 'done' или 'error')
 * Использует real-time подписку Supabase вместо polling для уменьшения количества запросов
 */
export async function waitForScrapeJobCompletion(
  jobId: string,
  options: {
    maxAttempts?: number;
    delay?: number;
    onProgress?: (attempt: number, maxAttempts: number) => void;
  } = {}
): Promise<'done' | 'error'> {
  const { maxAttempts = 30, delay = 1000, onProgress } = options;
  const timeout = maxAttempts * delay; // Общий таймаут в миллисекундах

  return new Promise((resolve) => {
    let isResolved = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let progressInterval: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let progressCounter = 0;

    const cleanup = () => {
      if (channel) {
        try {
          channel.unsubscribe();
        } catch (e) {
          console.error('Ошибка отписки от канала:', e);
        }
        channel = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const resolveOnce = (status: 'done' | 'error') => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(status);
      }
    };

    // Сначала проверяем текущий статус
    checkAndUpdateScrapeJobStatus(jobId).then((initialStatus) => {
      if (initialStatus === 'done' || initialStatus === 'error') {
        resolveOnce(initialStatus);
        return;
      }

      // Если статус еще 'running', создаем real-time подписку
      console.log('waitForScrapeJobCompletion: создаем real-time подписку для jobId:', jobId);
      
      channel = supabase
        .channel(`scrape-job-${jobId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'scrape_jobs',
            filter: `id=eq.${jobId}`,
          },
          async (payload) => {
            console.log('waitForScrapeJobCompletion: получено событие UPDATE:', payload);
            
            const newRecord = payload.new as { id: string; status: 'running' | 'done' | 'error' };
            
            // Проверяем статус и наличие фотографий
            if (newRecord.status === 'done' || newRecord.status === 'error') {
              // Дополнительно проверяем через checkAndUpdateScrapeJobStatus для надежности
              const verifiedStatus = await checkAndUpdateScrapeJobStatus(jobId);
              if (verifiedStatus === 'done' || verifiedStatus === 'error') {
                resolveOnce(verifiedStatus);
              }
            }
          }
        )
        .subscribe((subscribeStatus) => {
          console.log('waitForScrapeJobCompletion: статус подписки:', subscribeStatus);
          
          if (subscribeStatus === 'SUBSCRIBED') {
            console.log('waitForScrapeJobCompletion: подписка активна, ждем обновления...');
            
            // Запускаем обновление прогресса (только для UI, не делает запросы)
            if (onProgress) {
              progressInterval = setInterval(() => {
                progressCounter++;
                if (progressCounter <= maxAttempts) {
                  onProgress(progressCounter, maxAttempts);
                }
              }, delay);
            }
            
            // Также запускаем активный polling для быстрой реакции (на случай, если real-time не сработает)
            // Проверяем статус каждую секунду, даже при работающей real-time подписке
            pollingInterval = setInterval(async () => {
              if (isResolved) {
                if (pollingInterval) {
                  clearInterval(pollingInterval);
                  pollingInterval = null;
                }
                return;
              }
              
              try {
                const status = await checkAndUpdateScrapeJobStatus(jobId);
                if (status === 'done' || status === 'error') {
                  resolveOnce(status);
                }
              } catch (pollingError) {
                console.error('Ошибка при активном polling:', pollingError);
                // Продолжаем polling даже при ошибке
              }
            }, delay);
          } else if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT' || subscribeStatus === 'CLOSED') {
            console.warn('waitForScrapeJobCompletion: ошибка подписки, используем fallback polling. Статус:', subscribeStatus);
            // Fallback на polling только если real-time не работает
            cleanup();
            // Используем старую логику polling как fallback
            fallbackPolling();
          }
        });
    }).catch((error) => {
      console.error('waitForScrapeJobCompletion: ошибка начальной проверки, используем fallback polling:', error);
      fallbackPolling();
    });

    // Fallback функция для polling (используется только если real-time не работает)
    const fallbackPolling = async () => {
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (isResolved) break;
          
          try {
            const status = await checkAndUpdateScrapeJobStatus(jobId);
            
            if (status === 'done' || status === 'error') {
              resolveOnce(status);
              return;
            }

            if (onProgress) {
              onProgress(attempt + 1, maxAttempts);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
          } catch (attemptError) {
            console.error(`Ошибка при попытке ${attempt + 1} проверки статуса:`, attemptError);
            if (attempt < maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            resolveOnce('error');
            return;
          }
        }

        // Финальная проверка
        if (!isResolved) {
          try {
            const finalStatus = await checkAndUpdateScrapeJobStatus(jobId);
            resolveOnce(finalStatus === 'done' || finalStatus === 'error' ? finalStatus : 'error');
          } catch (finalError) {
            console.error('Ошибка при финальной проверке статуса:', finalError);
            resolveOnce('error');
          }
        }
      } catch (error) {
        console.error('Критическая ошибка при fallback polling:', error);
        if (!isResolved) {
          resolveOnce('error');
        }
      }
    };

    // Устанавливаем общий таймаут
    timeoutId = setTimeout(() => {
      console.log('waitForScrapeJobCompletion: таймаут, проверяем финальный статус');
      if (!isResolved) {
        checkAndUpdateScrapeJobStatus(jobId).then((finalStatus) => {
          resolveOnce(finalStatus === 'done' || finalStatus === 'error' ? finalStatus : 'error');
        }).catch(() => {
          resolveOnce('error');
        });
      }
    }, timeout);
  });
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
  // Показываем фотографии со статусом 'completed' или 'processing', если у них есть photo_url
  const { data: importedPhotos, error: importedPhotosError } = await supabase
    .from('photos')
    .select('id, photo_url, url, created_at, updated_at, status')
    .eq('user_id', userId)
    .in('status', ['completed', 'processing'])
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

  // Обрабатываем импортированные фотографии из таблицы photos
  // Эти фотографии уже обработаны Edge Function и сохранены в photos-storage bucket
  const importedPhotoItems: any[] = [];
  if (importedPhotos) {
    for (const importItem of importedPhotos) {
      if (!importItem.photo_url) continue;
      
      // Извлекаем URL фотографий (может быть строка, JSON массив или разделенные запятыми)
      // Эти URL указывают на сжатые версии в photos-storage bucket
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
      // URL указывают на сжатые версии в photos-storage bucket
      for (const photoUrl of photoUrls) {
        // Проверяем, что URL указывает на photos-storage bucket
        const isFromStorage = photoUrl.includes('/storage/v1/object/public/photos-storage/') || 
                              photoUrl.includes('photos-storage');
        
        // Извлекаем имя файла из URL
        let fileName = photoUrl.split('/').pop() || `photo-${importItem.id}`;
        // Убираем query параметры из имени файла
        fileName = fileName.split('?')[0];
        
        importedPhotoItems.push({
          id: `${importItem.id}-${photoUrl}`,
          original_url: photoUrl, // Сжатая версия из Storage
          compressed_url: photoUrl, // Сжатая версия из Storage
          url: photoUrl,
          file_name: fileName,
          file_size: 0, // Размер будет определен при загрузке
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
 * Генерирует уникальный номер операции
 * Формат: OP-{timestamp}-{random}
 * Это читаемый номер для отправки в n8n и логирования
 */
export function generateOperationNumber(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OP-${timestamp}-${random}`;
}

/**
 * Генерирует UUID для хранения в базе данных (operation_id)
 */
export function generateOperationId(): string {
  // Используем crypto.randomUUID() если доступен, иначе генерируем UUID v4 вручную
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Упрощенная функция для запуска скрапинга через n8n webhook
 * Используется, когда webhook сам создает job в БД
 */
export async function startScrapingJobSimple(
  sourceUrl: string,
  userId: string,
  n8nWebhookUrl?: string,
  operationNumber?: string,
  photoId?: string
): Promise<ScrapeJob> {
  console.log('startScrapingJobSimple вызван:', { sourceUrl, userId, n8nWebhookUrl, operationNumber, photoId });
  
  if (!n8nWebhookUrl) {
    console.error('N8N webhook URL не установлен');
    throw new Error('N8N webhook URL is required');
  }

  // Проверяем, есть ли уже активный job для этого URL и пользователя
  // Это предотвращает дубликаты вызовов вебхука
  const { data: existingActiveJob } = await supabase
    .from('scrape_jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('source_url', sourceUrl)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingActiveJob) {
    console.log('startScrapingJobSimple: найден активный job, возвращаем его:', existingActiveJob.id);
    return existingActiveJob;
  }

  // Отправляем запрос в n8n webhook с retry логикой
  try {
    // ВСЕГДА генерируем номер операции для каждой операции
    // Если номер не передан, генерируем новый
    const finalOperationNumber = operationNumber ? operationNumber : generateOperationNumber();
    
    // Убеждаемся, что номер операции точно есть
    if (!finalOperationNumber) {
      throw new Error('Не удалось сгенерировать номер операции');
    }
    
    // Формируем body запроса с обязательным полем operationNumber и опциональным photoId
    const requestBody: {
      sourceUrl: string;
      userId: string;
      operationNumber: string;
      photoId?: string;
    } = {
      sourceUrl: sourceUrl,
      userId: userId,
      operationNumber: finalOperationNumber
    };
    
    // Добавляем photoId, если он передан
    if (photoId) {
      requestBody.photoId = photoId;
    }
    
    // Проверяем, что все обязательные поля присутствуют
    if (!requestBody.sourceUrl || !requestBody.userId || !requestBody.operationNumber) {
      console.error('Ошибка: не все обязательные поля присутствуют в requestBody:', requestBody);
      throw new Error('Не все обязательные поля присутствуют в запросе');
    }
    
    console.log('=== ОТПРАВКА ВЕБХУКА ===');
    console.log('URL вебхука:', n8nWebhookUrl);
    console.log('Тело запроса (JSON):', JSON.stringify(requestBody, null, 2));
    console.log('Номер операции:', finalOperationNumber);
    console.log('Проверка body перед отправкой:', {
      hasSourceUrl: !!requestBody.sourceUrl,
      hasUserId: !!requestBody.userId,
      hasOperationNumber: !!requestBody.operationNumber,
      operationNumberValue: requestBody.operationNumber
    });
    
    // Обертываем запрос в retry логику для автоматического повтора при ошибках таймаута
    const webhookResponse = await withRetry(async () => {
      // Создаем AbortController для таймаута
      // Сокращаем таймаут до 30 секунд - если webhook не отвечает за это время, что-то не так
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут
      
      try {
        // Сериализуем body в JSON
        const bodyString = JSON.stringify(requestBody);
        console.log('Отправляем body (строка):', bodyString);
        
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: bodyString,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          const timeoutError: any = new Error('Сервер не отвечает. Запрос превысил 30 секунд. Проверьте подключение к интернету.');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        // Обрабатываем сетевые ошибки
        if (fetchError instanceof Error && (
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('NetworkError') ||
          fetchError.message.includes('Network request failed')
        )) {
          const networkError: any = new Error('Проблема с подключением к серверу. Проверьте интернет-соединение.');
          networkError.name = 'NetworkError';
          throw networkError;
        }
        throw fetchError;
      }
    }, {
      maxRetries: 1, // Максимум 1 повтор (всего 2 попытки) - сократили с 2
      retryDelay: 2000, // 2 секунды задержка между попытками
    });

    console.log('Ответ вебхука получен:', {
      status: webhookResponse.status,
      statusText: webhookResponse.statusText,
      ok: webhookResponse.ok
    });

    if (!webhookResponse.ok) {
      let errorText = '';
      try {
        errorText = await webhookResponse.text();
      } catch (textError) {
        errorText = 'Не удалось прочитать ответ сервера';
      }
      console.error('Ошибка вебхука:', errorText);
      
      // Даем более понятные сообщения в зависимости от статуса
      let errorMessage = `Ошибка сервера (${webhookResponse.status})`;
      if (webhookResponse.status === 404) {
        errorMessage = 'Webhook не найден. Проверьте настройки.';
      } else if (webhookResponse.status === 500 || webhookResponse.status === 502 || webhookResponse.status === 503) {
        errorMessage = 'Сервер временно недоступен. Попробуйте позже.';
      } else if (webhookResponse.status === 400) {
        errorMessage = 'Неверный запрос. Проверьте параметры.';
      } else if (errorText && errorText.length < 200) {
        errorMessage = errorText;
      }
      
      throw new Error(errorMessage);
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
 * Проверяет, есть ли уже запись об импорте для данного URL и пользователя со статусом pending или processing
 */
export async function checkExistingPhotoImport(
  userId: string,
  url: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('photos')
    .select('id')
    .eq('user_id', userId)
    .eq('url', url)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Ошибка проверки существующего импорта:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Сохраняет запись об импорте ссылки в таблицу photos
 * Использует UPSERT для предотвращения дубликатов по (user_id, url)
 */
export async function savePhotoImport(
  userId: string,
  url: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending',
  operationId?: string
): Promise<string> {
  // Если передан operationId, проверяем, нет ли уже записи с таким operation_id
  // Это предотвращает дубликаты для одной и той же операции скрапинга
  if (operationId) {
    const { data: existingByOperationId } = await supabase
      .from('photos')
      .select('id')
      .eq('user_id', userId)
      .eq('operation_id', operationId)
      .maybeSingle();

    if (existingByOperationId) {
      console.log('savePhotoImport: найдена запись с таким operation_id, обновляем её:', existingByOperationId.id);
      await updatePhotoImport(existingByOperationId.id, status);
      return existingByOperationId.id;
    }
  }

  // Используем UPSERT для предотвращения дубликатов по уникальному ограничению (user_id, url)
  // Если запись уже существует, обновляем её, иначе создаем новую
  const insertData = {
    user_id: userId,
    url: url,  // ссылка, которую вставляет пользователь
    photo_url: null,  // будет заполнено n8n
    status: status,
    operation_id: operationId
  };

  // Проверяем, существует ли уже запись с такой комбинацией (user_id, url)
  const { data: existing } = await supabase
    .from('photos')
    .select('id')
    .eq('user_id', userId)
    .eq('url', url)
    .maybeSingle();

  let data;
  let error;

  if (existing) {
    // Обновляем существующую запись
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    };
    if (operationId !== undefined) {
      updateData.operation_id = operationId;
    }
    // Обновляем photo_url только если оно еще не заполнено (null)
    if (insertData.photo_url !== null) {
      updateData.photo_url = insertData.photo_url;
    }

    const result = await supabase
      .from('photos')
      .update(updateData)
      .eq('id', existing.id)
      .select('id')
      .single();
    
    data = result.data;
    error = result.error;
    
    if (!error) {
      console.log('savePhotoImport: обновлена существующая запись:', data.id, 'для URL:', url);
    }
  } else {
    // Создаем новую запись
    const result = await supabase
      .from('photos')
      .insert(insertData)
      .select('id')
      .single();
    
    data = result.data;
    error = result.error;
    
    if (!error) {
      console.log('savePhotoImport: создана новая запись:', data.id, 'для URL:', url, 'operation_id:', operationId);
    }
  }

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

