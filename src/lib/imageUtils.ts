/**
 * Утилиты для работы с изображениями: сжатие, валидация качества, загрузка в Supabase
 */

/**
 * Загружает изображение с таймаутом и повторными попытками
 */
export async function fetchImageWithRetry(
  url: string,
  options: {
    timeout?: number; // таймаут в миллисекундах
    maxRetries?: number; // максимальное количество попыток
    retryDelay?: number; // задержка между попытками в миллисекундах
  } = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 секунд по умолчанию
    maxRetries = 3,
    retryDelay = 1000 // 1 секунда между попытками
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Создаем AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          // Используем default cache для баланса между производительностью и актуальностью
          cache: 'default',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
      }
    } catch (error: any) {
      lastError = error;
      const errorMessage = error.message || 'Неизвестная ошибка';
      console.warn(`Попытка ${attempt}/${maxRetries} загрузки ${url} не удалась:`, errorMessage);

      // Если это последняя попытка, выбрасываем ошибку
      if (attempt === maxRetries) {
        console.error(`Все ${maxRetries} попытки загрузки ${url} не удались. Последняя ошибка:`, errorMessage);
        throw error;
      }

      // Ждем перед следующей попыткой (экспоненциальная задержка)
      const delay = retryDelay * Math.pow(2, attempt - 1);
      console.log(`Повторная попытка через ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Этот код не должен выполняться, но TypeScript требует возврат
  throw lastError || new Error('Неизвестная ошибка при загрузке изображения');
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxFileSize?: number; // в байтах
}

export interface ImageValidationResult {
  isValid: boolean;
  qualityScore: number; // 0-1
  issues: string[];
  dimensions: { width: number; height: number };
}

export interface CompressedImage {
  file: File;
  originalFile: File;
  compressionRatio: number;
  qualityScore: number;
}

/**
 * Сжимает изображение с заданными параметрами
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressedImage> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.7,
    maxFileSize = 10 * 1024 * 1024 // 10MB
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Вычисляем новые размеры с сохранением пропорций
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // Устанавливаем размеры canvas
        canvas.width = width;
        canvas.height = height;

        // Рисуем изображение на canvas
        ctx?.drawImage(img, 0, 0, width, height);

        // Конвертируем в blob с заданным качеством
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Не удалось сжать изображение'));
              return;
            }

            // Если файл все еще слишком большой, уменьшаем качество
            if (blob.size > maxFileSize && quality > 0.1) {
              compressImage(file, { ...options, quality: quality - 0.1 })
                .then(resolve)
                .catch(reject);
              return;
            }

            // Создаем новый File объект
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });

            const compressionRatio = blob.size / file.size;
            const qualityScore = calculateQualityScore(img, { width, height });

            resolve({
              file: compressedFile,
              originalFile: file,
              compressionRatio,
              qualityScore
            });
          },
          file.type,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Валидирует качество изображения
 */
export async function validateImageQuality(file: File): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const issues: string[] = [];
      let qualityScore = 1;

      // Более мягкие проверки размеров
      if (img.width < 50 || img.height < 50) {
        issues.push('Изображение слишком маленькое (минимум 50x50px)');
        qualityScore -= 0.3;
      }

      if (img.width > 10000 || img.height > 10000) {
        issues.push('Изображение слишком большое (максимум 10000x10000px)');
        qualityScore -= 0.1;
      }

      // Более мягкие проверки соотношения сторон
      const aspectRatio = img.width / img.height;
      if (aspectRatio < 0.2 || aspectRatio > 5) {
        issues.push('Необычное соотношение сторон');
        qualityScore -= 0.05;
      }

      // Более мягкие проверки размера файла
      if (file.size < 500) { // меньше 500 байт
        issues.push('Файл слишком маленький');
        qualityScore -= 0.2;
      }

      if (file.size > 100 * 1024 * 1024) { // больше 100MB
        issues.push('Файл слишком большой (максимум 100MB)');
        qualityScore -= 0.1;
      }

      // Убираем проверку резкости - принимаем любые изображения
      // Дополнительная проверка качества через canvas (опционально)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.min(img.width, 500); // Ограничиваем размер для производительности
      canvas.height = Math.min(img.height, 500);
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      if (imageData) {
        const sharpness = calculateSharpness(imageData);
        // Только предупреждаем о очень размытых изображениях, но не блокируем
        if (sharpness < 0.05) {
          issues.push('Изображение может быть размытым');
          qualityScore -= 0.1;
        }
      }

      qualityScore = Math.max(0, Math.min(1, qualityScore));

      // Снижаем минимальный порог качества
      resolve({
        isValid: issues.length === 0 && qualityScore > 0.1,
        qualityScore,
        issues,
        dimensions: { width: img.width, height: img.height }
      });
    };

    img.onerror = () => {
      resolve({
        isValid: false,
        qualityScore: 0,
        issues: ['Не удалось загрузить изображение'],
        dimensions: { width: 0, height: 0 }
      });
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Вычисляет оценку качества изображения
 */
function calculateQualityScore(
  img: HTMLImageElement, 
  dimensions: { width: number; height: number }
): number {
  let score = 1;

  // Более мягкий штраф за уменьшение размера
  const sizeReduction = 1 - (dimensions.width * dimensions.height) / (img.width * img.height);
  score -= sizeReduction * 0.1; // Уменьшили штраф с 0.3 до 0.1

  // Бонус за хорошее разрешение (снизили требования)
  const totalPixels = dimensions.width * dimensions.height;
  if (totalPixels > 800 * 600) { // Снизили с 1920*1080 до 800*600
    score += 0.05; // Уменьшили бонус с 0.1 до 0.05
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Вычисляет резкость изображения
 */
function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData;
  let totalGradient = 0;
  let pixelCount = 0;

  // Упрощенный алгоритм для лучшей производительности
  // Проверяем только каждый 4-й пиксель для ускорения
  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const idx = (y * width + x) * 4;
      
      // Простой градиент по X
      const gx = Math.abs(data[idx + 4] - data[idx - 4]);
      
      // Простой градиент по Y  
      const gy = Math.abs(data[idx + width * 4] - data[idx - width * 4]);
      
      const gradient = Math.sqrt(gx * gx + gy * gy);
      totalGradient += gradient;
      pixelCount++;
    }
  }

  return pixelCount > 0 ? totalGradient / pixelCount / 255 : 0;
}

/**
 * Загружает изображение в Supabase Storage
 */
export async function uploadImageToSupabase(
  file: File,
  bucketName: string = 'user-photos',
  folder: string = 'originals',
  userId?: string
): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  // Получаем текущего пользователя, если userId не передан
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Пользователь не авторизован');
    }
    userId = session.user.id;
  }
  
  // Очищаем имя файла от недопустимых символов
  const sanitizeFileName = (fileName: string): string => {
    // Убираем расширение
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const extension = fileName.match(/\.[^/.]+$/)?.[0] || '';
    
    // Заменяем недопустимые символы на подчеркивания
    const sanitizedName = nameWithoutExt
      .replace(/[^a-zA-Z0-9\-_]/g, '_') // Оставляем только буквы, цифры, дефисы и подчеркивания
      .replace(/_+/g, '_') // Заменяем множественные подчеркивания на одно
      .replace(/^_|_$/g, ''); // Убираем подчеркивания в начале и конце
    
    // Если имя стало пустым, используем дефолтное
    const finalName = sanitizedName || 'image';
    
    return `${finalName}${extension}`;
  };
  
  const sanitizedFileName = sanitizeFileName(file.name);
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${sanitizedFileName}`;
  // Используем userId в качестве первой папки для соответствия RLS политикам
  const filePath = `${userId}/${folder}/${fileName}`;

  console.log('Uploading file:', {
    originalName: file.name,
    sanitizedName: sanitizedFileName,
    userId: userId,
    finalPath: filePath,
    fileSize: file.size
  });

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Ошибка загрузки: ${error.message}`);
  }

  // Получаем публичный URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  console.log('Upload successful:', urlData.publicUrl);
  return urlData.publicUrl;
}

/**
 * Сохраняет информацию о фотографии в базу данных
 */
export async function savePhotoToDatabase(photoData: {
  userId: string;
  originalUrl: string;
  compressedUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  qualityScore?: number;
  isValid: boolean;
}): Promise<void> {
  const { supabase } = await import('@/integrations/supabase/client');

  // Преобразуем camelCase в snake_case для соответствия схеме БД
  const dbData = {
    user_id: photoData.userId,
    original_url: photoData.originalUrl,
    compressed_url: photoData.compressedUrl,
    file_name: photoData.fileName,
    file_size: photoData.fileSize,
    mime_type: photoData.mimeType,
    width: photoData.width,
    height: photoData.height,
    quality_score: photoData.qualityScore,
    is_valid: photoData.isValid
  };

  console.log('Saving to database:', dbData);

  const { error } = await supabase
    .from('user_photos')
    .insert([dbData]);

  if (error) {
    console.error('Database save error:', error);
    throw new Error(`Ошибка сохранения в базу данных: ${error.message}`);
  }
}

/**
 * Получает историю фотографий пользователя
 */
export async function getUserPhotos(userId: string, limit: number = 50): Promise<any[]> {
  const { supabase } = await import('@/integrations/supabase/client');

  const { data, error } = await supabase
    .from('user_photos')
    .select('*')
    .eq('user_id', userId)
    .eq('is_valid', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Ошибка получения фотографий: ${error.message}`);
  }

  return data || [];
}

/**
 * Удаляет фотографию из базы данных и Storage
 */
export async function deleteUserPhoto(photoId: string): Promise<void> {
  const { supabase } = await import('@/integrations/supabase/client');

  // Сначала получаем данные фотографии
  const { data: photo, error: fetchError } = await supabase
    .from('user_photos')
    .select('original_url, compressed_url')
    .eq('id', photoId)
    .single();

  if (fetchError) {
    throw new Error(`Ошибка получения фотографии: ${fetchError.message}`);
  }

  // Удаляем из Storage
  if (photo.original_url) {
    // Извлекаем путь из URL (убираем домен и bucket)
    const urlParts = photo.original_url.split('/storage/v1/object/')[1];
    if (urlParts) {
      const pathParts = urlParts.split('/');
      const userId = pathParts[0];
      const folder = pathParts[1];
      const fileName = pathParts[2];
      const fullPath = `${userId}/${folder}/${fileName}`;
      
      await supabase.storage
        .from('user-photos')
        .remove([fullPath]);
    }
  }

  if (photo.compressed_url) {
    // Извлекаем путь из URL (убираем домен и bucket)
    const urlParts = photo.compressed_url.split('/storage/v1/object/')[1];
    if (urlParts) {
      const pathParts = urlParts.split('/');
      const userId = pathParts[0];
      const folder = pathParts[1];
      const fileName = pathParts[2];
      const fullPath = `${userId}/${folder}/${fileName}`;
      
      await supabase.storage
        .from('user-photos')
        .remove([fullPath]);
    }
  }

  // Удаляем из базы данных
  const { error: deleteError } = await supabase
    .from('user_photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    throw new Error(`Ошибка удаления из базы данных: ${deleteError.message}`);
  }
}
