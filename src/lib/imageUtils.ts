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
 * Определяет правильный MIME тип изображения на основе расширения файла
 */
function getMimeTypeFromExtension(fileName: string, fallbackType?: string): string {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[extension] || fallbackType || 'image/jpeg';
}

/**
 * Исправляет MIME тип файла, если он неправильный
 */
function correctMimeType(file: File): string {
  let mimeType = file.type;
  if (!mimeType || !mimeType.startsWith('image/') || mimeType === 'application/json') {
    mimeType = getMimeTypeFromExtension(file.name, file.type);
    if (mimeType !== file.type) {
      console.log(`Исправляем MIME тип: ${file.type} -> ${mimeType}`);
    }
  }
  return mimeType;
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

  // Исправляем MIME тип, если он неправильный
  const correctedMimeType = correctMimeType(file);

  // Проверяем, что файл является изображением
  // Проверяем как MIME-тип, так и расширение файла
  const isImageByMime = correctedMimeType.startsWith('image/');
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const fileName = file.name.toLowerCase();
  const hasImageExtension = imageExtensions.some(ext => fileName.endsWith(ext));
  
  if (!isImageByMime && !hasImageExtension) {
    throw new Error('Файл не является изображением. Поддерживаются форматы: JPG, PNG, GIF, WEBP, BMP, SVG');
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Не удалось создать контекст canvas для обработки изображения'));
      return;
    }
    
    const img = new Image();
    let objectUrl: string | null = null;

    // Очистка URL объекта при завершении
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        // Проверяем, что изображение загрузилось корректно
        if (img.width === 0 || img.height === 0) {
          cleanup();
          reject(new Error('Изображение имеет нулевые размеры'));
          return;
        }

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
        ctx.drawImage(img, 0, 0, width, height);

        // Конвертируем в blob с заданным качеством
        canvas.toBlob(
          (blob) => {
            cleanup();
            
            if (!blob) {
              reject(new Error('Не удалось сжать изображение. Возможно, формат не поддерживается.'));
              return;
            }

            // Если файл все еще слишком большой, уменьшаем качество
            if (blob.size > maxFileSize && quality > 0.1) {
              compressImage(file, { ...options, quality: quality - 0.1 })
                .then(resolve)
                .catch(reject);
              return;
            }

            // Создаем новый File объект с правильным MIME типом
            const compressedFile = new File([blob], file.name, {
              type: correctedMimeType,
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
          correctedMimeType,
          quality
        );
      } catch (error) {
        cleanup();
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error('Неизвестная ошибка при обработке изображения'));
        }
      }
    };

    img.onerror = (event) => {
      cleanup();
      console.error('Image load error:', event);
      reject(new Error('Не удалось загрузить изображение. Возможно, файл поврежден или имеет неподдерживаемый формат.'));
    };
    
    try {
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    } catch (error) {
      cleanup();
      reject(new Error('Не удалось создать URL для изображения'));
    }
  });
}

/**
 * Валидирует качество изображения
 */
export async function validateImageQuality(file: File): Promise<ImageValidationResult> {
  // Проверяем, что файл является изображением
  // Проверяем как MIME-тип, так и расширение файла
  const isImageByMime = file.type.startsWith('image/');
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const fileName = file.name.toLowerCase();
  const hasImageExtension = imageExtensions.some(ext => fileName.endsWith(ext));
  
  if (!isImageByMime && !hasImageExtension) {
    return {
      isValid: false,
      qualityScore: 0,
      issues: ['Файл не является изображением. Поддерживаются форматы: JPG, PNG, GIF, WEBP, BMP, SVG'],
      dimensions: { width: 0, height: 0 }
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    let objectUrl: string | null = null;

    // Очистка URL объекта при завершении
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
    
    img.onload = () => {
      try {
        const issues: string[] = [];
        let qualityScore = 1;

        // Проверяем, что изображение загрузилось корректно
        if (img.width === 0 || img.height === 0) {
          cleanup();
          resolve({
            isValid: false,
            qualityScore: 0,
            issues: ['Изображение имеет нулевые размеры'],
            dimensions: { width: 0, height: 0 }
          });
          return;
        }

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
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = Math.min(img.width, 500); // Ограничиваем размер для производительности
            canvas.height = Math.min(img.height, 500);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
              const sharpness = calculateSharpness(imageData);
              // Только предупреждаем о очень размытых изображениях, но не блокируем
              if (sharpness < 0.05) {
                issues.push('Изображение может быть размытым');
                qualityScore -= 0.1;
              }
            }
          }
        } catch (canvasError) {
          // Игнорируем ошибки canvas, они не критичны
          console.warn('Ошибка при проверке качества через canvas:', canvasError);
        }

        qualityScore = Math.max(0, Math.min(1, qualityScore));

        // Снижаем минимальный порог качества
        cleanup();
        resolve({
          isValid: issues.length === 0 && qualityScore > 0.1,
          qualityScore,
          issues,
          dimensions: { width: img.width, height: img.height }
        });
      } catch (error) {
        cleanup();
        console.error('Ошибка при валидации изображения:', error);
        resolve({
          isValid: false,
          qualityScore: 0,
          issues: ['Ошибка при проверке изображения'],
          dimensions: { width: 0, height: 0 }
        });
      }
    };

    img.onerror = (event) => {
      cleanup();
      console.error('Image validation error:', event);
      resolve({
        isValid: false,
        qualityScore: 0,
        issues: ['Не удалось загрузить изображение. Возможно, файл поврежден.'],
        dimensions: { width: 0, height: 0 }
      });
    };

    try {
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    } catch (error) {
      cleanup();
      resolve({
        isValid: false,
        qualityScore: 0,
        issues: ['Не удалось создать URL для изображения'],
        dimensions: { width: 0, height: 0 }
      });
    }
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
/**
 * Конвертирует File в base64 строку
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Убираем префикс "data:image/...;base64,"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Создает data URL из base64 и mime type
 */
function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export async function uploadImageToSupabase(
  file: File,
  bucketName: string = 'user-photos',
  folder: string = 'originals',
  userId?: string,
  photoId?: string // ID существующей записи для обновления
): Promise<{ url: string; id?: string }> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  // Получаем текущего пользователя, если userId не передан
  if (!userId) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error('Ошибка проверки авторизации. Войдите в систему заново.');
    }
    if (!session?.user) {
      throw new Error('Пользователь не авторизован. Войдите в систему.');
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

  // Исправляем MIME тип, если он неправильный
  const contentType = correctMimeType(file);

  console.log('Converting file to base64:', {
    originalName: file.name,
    sanitizedName: sanitizedFileName,
    userId: userId,
    photoId: photoId,
    folder: folder,
    fileSize: file.size,
    originalMimeType: file.type,
    correctedMimeType: contentType
  });

  try {
    // Конвертируем файл в base64
    const base64Data = await fileToBase64(file);
    const dataUrl = base64ToDataUrl(base64Data, contentType);

    if (photoId) {
      // Обновляем существующую запись (для сжатого файла)
      const updateData: any = {
        compressed_url: dataUrl,
        compressed_data: base64Data
      };

      const { data, error } = await supabase
        .from('user_photos')
        .update(updateData)
        .eq('id', photoId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        throw new Error(`Ошибка обновления фотографии: ${error.message}`);
      }

      if (!data) {
        throw new Error('Не удалось обновить фотографию в базе данных');
      }

      console.log('Compressed image updated in database:', data.id);
      return { url: dataUrl, id: data.id };
    } else {
      // Создаем новую запись (для оригинального файла)
      const insertData: any = {
        user_id: userId,
        file_name: fileName,
        file_size: file.size,
        mime_type: contentType,
        original_url: dataUrl,
        original_data: base64Data,
        is_valid: true
      };

      const { data, error } = await supabase
        .from('user_photos')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', {
          message: error.message,
          error: error,
          userId,
          fileSize: file.size,
          contentType: contentType,
          originalFileType: file.type
        });
        
        // Более понятные сообщения об ошибках
        let errorMessage = error.message;
        
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          errorMessage = 'Файл с таким именем уже существует';
        } else if (error.message.includes('permission') || error.message.includes('policy') || error.message.includes('RLS')) {
          errorMessage = 'Нет прав для загрузки файла. Проверьте авторизацию.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Ошибка сети при загрузке. Проверьте подключение к интернету.';
        } else if (error.message.includes('foreign key') || error.message.includes('constraint')) {
          errorMessage = 'Ошибка связи с базой данных. Попробуйте еще раз.';
        }
        
        throw new Error(`Ошибка загрузки: ${errorMessage}`);
      }

      if (!data) {
        throw new Error('Не удалось сохранить фотографию в базу данных');
      }

      console.log('Upload successful, saved to database:', data.id);
      return { url: dataUrl, id: data.id };
    }
  } catch (error: any) {
    console.error('Error uploading image:', error);
    throw error;
  }
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
    
    // Более понятные сообщения об ошибках
    let errorMessage = error.message;
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      errorMessage = 'Фотография с таким именем уже существует';
    } else if (error.message.includes('permission') || error.message.includes('policy') || error.message.includes('RLS')) {
      errorMessage = 'Нет прав для сохранения. Проверьте авторизацию.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Ошибка сети при сохранении. Проверьте подключение к интернету.';
    } else if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      errorMessage = 'Ошибка связи с базой данных. Попробуйте еще раз.';
    }
    
    throw new Error(`Ошибка сохранения в базу данных: ${errorMessage}`);
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

  // Обрабатываем данные: если есть base64, создаем data URL
  const processedData = (data || []).map((photo: any) => {
    // Если есть compressed_data, используем его для compressed_url
    if (photo.compressed_data && photo.mime_type) {
      photo.compressed_url = base64ToDataUrl(photo.compressed_data, photo.mime_type);
    }
    // Если есть original_data, используем его для original_url
    if (photo.original_data && photo.mime_type) {
      photo.original_url = base64ToDataUrl(photo.original_data, photo.mime_type);
    }
    return photo;
  });

  return processedData;
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

  // Функция для извлечения пути из URL
  const extractPath = (url: string): string | null => {
    // Обрабатываем публичные URL: /storage/v1/object/public/user-photos/userId/folder/fileName
    // И подписанные URL: /storage/v1/object/sign/user-photos/userId/folder/fileName
    const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/user-photos\/(.+)$/);
    if (match) {
      return match[1].split('?')[0]; // userId/folder/fileName (убираем query параметры)
    }
    // Fallback для старого формата: /storage/v1/object/userId/folder/fileName
    const urlParts = url.split('/storage/v1/object/')[1];
    if (urlParts) {
      const pathParts = urlParts.split('/');
      // Пропускаем "public" или "sign" и "user-photos" если они есть
      let startIndex = 0;
      if (pathParts[0] === 'public' || pathParts[0] === 'sign') {
        startIndex = 2; // Пропускаем "public"/"sign" и "user-photos"
      }
      if (startIndex < pathParts.length - 2) {
        const userIdFromPath = pathParts[startIndex];
        const folder = pathParts[startIndex + 1];
        const fileName = pathParts[startIndex + 2].split('?')[0]; // Убираем query параметры
        return `${userIdFromPath}/${folder}/${fileName}`;
      }
    }
    return null;
  };

  // Удаляем из Storage
  const pathsToDelete: string[] = [];
  
  if (photo.original_url) {
    const path = extractPath(photo.original_url);
    if (path) {
      pathsToDelete.push(path);
    }
  }

  if (photo.compressed_url) {
    const path = extractPath(photo.compressed_url);
    if (path && !pathsToDelete.includes(path)) {
      pathsToDelete.push(path);
    }
  }

  // Удаляем все файлы из Storage
  if (pathsToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('user-photos')
      .remove(pathsToDelete);

    if (storageError) {
      console.error('Ошибка удаления из Storage:', storageError);
      // Продолжаем удаление из БД даже если Storage удаление не удалось
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

/**
 * Удаляет все фотографии пользователя из базы данных и Storage
 */
export async function deleteAllUserPhotos(userId: string): Promise<number> {
  const { supabase } = await import('@/integrations/supabase/client');

  // Сначала получаем все фотографии пользователя
  const { data: photos, error: fetchError } = await supabase
    .from('user_photos')
    .select('id, original_url, compressed_url')
    .eq('user_id', userId);

  if (fetchError) {
    throw new Error(`Ошибка получения фотографий: ${fetchError.message}`);
  }

  if (!photos || photos.length === 0) {
    return 0;
  }

  const deletedCount = photos.length;
  const pathsToDelete: string[] = [];

  // Собираем все пути для удаления из Storage
  for (const photo of photos) {
    const extractPath = (url: string): string | null => {
      // Обрабатываем публичные URL: /storage/v1/object/public/user-photos/userId/folder/fileName
      // И подписанные URL: /storage/v1/object/sign/user-photos/userId/folder/fileName
      const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/user-photos\/(.+)$/);
      if (match) {
        return match[1]; // userId/folder/fileName
      }
      // Fallback для старого формата: /storage/v1/object/userId/folder/fileName
      const urlParts = url.split('/storage/v1/object/')[1];
      if (urlParts) {
        const pathParts = urlParts.split('/');
        // Пропускаем "public" или "sign" и "user-photos" если они есть
        let startIndex = 0;
        if (pathParts[0] === 'public' || pathParts[0] === 'sign') {
          startIndex = 2; // Пропускаем "public"/"sign" и "user-photos"
        }
        if (startIndex < pathParts.length - 2) {
          const userIdFromPath = pathParts[startIndex];
          const folder = pathParts[startIndex + 1];
          const fileName = pathParts[startIndex + 2];
          return `${userIdFromPath}/${folder}/${fileName}`;
        }
      }
      return null;
    };

    if (photo.original_url) {
      const path = extractPath(photo.original_url);
      if (path && !pathsToDelete.includes(path)) {
        pathsToDelete.push(path);
      }
    }

    if (photo.compressed_url) {
      const path = extractPath(photo.compressed_url);
      if (path && !pathsToDelete.includes(path)) {
        pathsToDelete.push(path);
      }
    }
  }

  // Удаляем из Storage
  if (pathsToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('user-photos')
      .remove(pathsToDelete);

    if (storageError) {
      console.error('Ошибка удаления из Storage:', storageError);
      // Продолжаем удаление из БД даже если Storage удаление не удалось
    }
  }

  // Удаляем из базы данных
  const { error: deleteError } = await supabase
    .from('user_photos')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Ошибка удаления из базы данных: ${deleteError.message}`);
  }

  return deletedCount;
}
