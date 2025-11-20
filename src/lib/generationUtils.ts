/**
 * Утилиты для работы с генерацией объединенных фотографий
 */

import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/lib/networkUtils';

export interface GeneratedPhoto {
  id: string;
  user_id: string;
  scraped_photo_id: string;
  user_photo_id: string;
  generated_urls: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationRequest {
  scraped_photo_url: string;
  scraped_photo_id: string;
  user_photo_id: string;
  user_photo_url: string;
}

export interface GenerationResult {
  id: string;
  generated_urls: string[];
  status: 'completed' | 'processing' | 'failed';
  error_message?: string;
}

/**
 * Проверяет, была ли уже сгенерирована комбинация фото
 */
export async function checkExistingGeneration(
  userId: string,
  scrapedPhotoId: string,
  userPhotoId: string
): Promise<GeneratedPhoto | null> {
  const { data, error } = await supabase
    .from('generated_photos')
    .select('*')
    .eq('user_id', userId)
    .eq('scraped_photo_id', scrapedPhotoId)
    .eq('user_photo_id', userPhotoId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Ошибка проверки существующей генерации:', error);
    return null;
  }

  return data;
}

/**
 * Создает запись о генерации в БД
 */
export async function createGenerationRecord(
  userId: string,
  scrapedPhotoId: string,
  userPhotoId: string
): Promise<GeneratedPhoto> {
  const { data, error } = await supabase
    .from('generated_photos')
    .insert({
      user_id: userId,
      scraped_photo_id: scrapedPhotoId,
      user_photo_id: userPhotoId,
      status: 'pending',
      generated_urls: []
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Ошибка создания записи генерации: ${error.message}`);
  }

  return data;
}

/**
 * Запускает генерацию через Edge Function
 */
export async function startGeneration(
  request: GenerationRequest
): Promise<GenerationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Пользователь не авторизован');
  }

  const { data, error } = await supabase.functions.invoke('generate-merged-photos', {
    body: {
      scraped_photo_url: request.scraped_photo_url,
      scraped_photo_id: request.scraped_photo_id,
      user_photo_id: request.user_photo_id,
      user_photo_url: request.user_photo_url
    }
  });

  if (error) {
    throw new Error(`Ошибка запуска генерации: ${error.message}`);
  }

  return data;
}

/**
 * Получает статус генерации
 */
export async function getGenerationStatus(
  generationId: string
): Promise<GeneratedPhoto | null> {
  const { data, error } = await supabase
    .from('generated_photos')
    .select('*')
    .eq('id', generationId)
    .single();

  if (error) {
    console.error('Ошибка получения статуса генерации:', error);
    return null;
  }

  return data;
}

/**
 * Получает все генерации пользователя
 */
export async function getUserGenerations(
  userId: string,
  limit: number = 50
): Promise<GeneratedPhoto[]> {
  const { data, error } = await supabase
    .from('generated_photos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Ошибка получения генераций пользователя:', error);
    return [];
  }

  return data || [];
}

/**
 * Удаляет генерацию
 */
export async function deleteGeneration(
  generationId: string,
  userId: string
): Promise<boolean> {
  // Сначала получаем URLs для удаления из storage
  const { data: generation } = await supabase
    .from('generated_photos')
    .select('generated_urls')
    .eq('id', generationId)
    .eq('user_id', userId)
    .single();

  if (generation && generation.generated_urls) {
    // Удаляем файлы из storage
    for (const url of generation.generated_urls) {
      try {
        // Извлекаем путь из URL
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.findIndex(part => part === 'generated-results');
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage
            .from('generated-results')
            .remove([filePath]);
        }
      } catch (error) {
        console.error('Ошибка удаления файла из storage:', error);
      }
    }
  }

  // Удаляем запись из БД
  const { error } = await supabase
    .from('generated_photos')
    .delete()
    .eq('id', generationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Ошибка удаления генерации:', error);
    return false;
  }

  return true;
}

/**
 * Получает URL фото пользователя по ID
 */
export async function getUserPhotoUrl(userPhotoId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_photos')
    .select('original_url, compressed_url')
    .eq('id', userPhotoId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.original_url || data.compressed_url || null;
}

/**
 * Создает уникальный ID для скрапленного фото
 * Использует URL или hash файла
 */
export function createScrapedPhotoId(photoUrl: string | File): string {
  if (photoUrl instanceof File) {
    // Для File используем имя + размер + дата модификации
    return `${photoUrl.name}_${photoUrl.size}_${photoUrl.lastModified}`;
  }
  // Для URL используем сам URL или его hash
  return photoUrl;
}

