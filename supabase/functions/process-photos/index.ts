// Edge Function для обработки фотографий после импорта
// Скачивает фотографии, сжимает их и сохраняет в Storage и БД

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface PhotoProcessingRequest {
  photo_id: string;
  user_id: string;
  url: string;
  photo_url: string;
  operation_id: string | null;
}

// Параметры сжатия
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.8; // 80%
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Определяет размеры изображения из заголовков JPEG/PNG
 */
function getImageDimensions(imageBytes: Uint8Array, mimeType: string): { width: number; height: number } {
  let width = 0;
  let height = 0;

  try {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      // JPEG: ищем SOF маркер (0xFF 0xC0, 0xFF 0xC1, 0xFF 0xC2, etc.)
      for (let i = 0; i < imageBytes.length - 8; i++) {
        if (imageBytes[i] === 0xFF && (imageBytes[i + 1] >= 0xC0 && imageBytes[i + 1] <= 0xC3)) {
          height = (imageBytes[i + 5] << 8) | imageBytes[i + 6];
          width = (imageBytes[i + 7] << 8) | imageBytes[i + 8];
          break;
        }
      }
    } else if (mimeType.includes('png')) {
      // PNG: размеры в байтах 16-23 (после сигнатуры PNG)
      if (imageBytes.length >= 24) {
        width = (imageBytes[16] << 24) | (imageBytes[17] << 16) | (imageBytes[18] << 8) | imageBytes[19];
        height = (imageBytes[20] << 24) | (imageBytes[21] << 16) | (imageBytes[22] << 8) | imageBytes[23];
      }
    }
  } catch (error) {
    console.warn('Failed to read image dimensions:', error);
  }

  return { width, height };
}

/**
 * Сжимает изображение используя базовую обработку
 * В Deno Edge Functions используем упрощенный подход
 * Для production рекомендуется использовать библиотеку magick-wasm для реального сжатия
 */
async function compressImage(
  imageBytes: Uint8Array,
  mimeType: string
): Promise<{ compressed: Uint8Array; width: number; height: number; finalMimeType: string }> {
  // Определяем размеры изображения
  const { width: originalWidth, height: originalHeight } = getImageDimensions(imageBytes, mimeType);
  
  // Если не удалось определить размеры, используем значения по умолчанию
  const width = originalWidth || MAX_WIDTH;
  const height = originalHeight || MAX_HEIGHT;
  
  // Проверяем, нужно ли изменять размер
  const needsResize = width > MAX_WIDTH || height > MAX_HEIGHT;
  
  // Базовая проверка размера файла
  if (!needsResize && imageBytes.length <= MAX_FILE_SIZE) {
    // Если файл уже достаточно маленький и размеры в норме, возвращаем как есть
    return {
      compressed: imageBytes,
      width,
      height,
      finalMimeType: mimeType.includes('webp') ? 'image/webp' : 'image/jpeg'
    };
  }
  
  // Если файл слишком большой или размеры превышают лимиты
  // В production здесь должна быть реальная обработка через библиотеку magick-wasm
  // Пока возвращаем оригинал с предупреждением
  // TODO: Добавить реальное сжатие через magick-wasm или другую библиотеку
  console.warn(`Image needs compression: size=${imageBytes.length} bytes, dimensions=${width}x${height}`);
  
  // Для упрощения возвращаем оригинал, но в production нужно добавить реальное сжатие
  return {
    compressed: imageBytes,
    width,
    height,
    finalMimeType: mimeType.includes('webp') ? 'image/webp' : 'image/jpeg'
  };
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: PhotoProcessingRequest = await req.json();
    const { photo_id, user_id, url, photo_url, operation_id } = body;

    if (!photo_id || !user_id || !url || !photo_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: photo_id, user_id, url, photo_url are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (operation_id !== null && operation_id !== undefined && operation_id.trim() === '') {
      return new Response(
        JSON.stringify({ error: "operation_id cannot be empty string, use null instead" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing photos for photo_id: ${photo_id}, operation: ${operation_id || 'N/A'}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Парсим photo_url (может быть JSON массив, разделенные запятыми, или одна строка)
    const extractPhotoUrls = (photoUrl: string): string[] => {
      if (!photoUrl || photoUrl.trim().length === 0) {
        return [];
      }

      try {
        const parsed = JSON.parse(photoUrl);
        if (Array.isArray(parsed)) {
          return parsed.filter((url): url is string => typeof url === 'string' && url.length > 0).map(url => url.trim());
        } else if (typeof parsed === 'string') {
          return [parsed.trim()];
        }
      } catch {
        const urls = photoUrl.split(',').map(url => url.trim()).filter(url => url.length > 0);
        if (urls.length > 0) {
          return urls;
        } else {
          return [photoUrl.trim()];
        }
      }

      return [];
    };

    const photoUrls = extractPhotoUrls(photo_url);
    // Ограничиваем количество фотографий до 15
    const limitedPhotoUrls = photoUrls.slice(0, 15);
    console.log(`Found ${photoUrls.length} photo URLs to process (limited to ${limitedPhotoUrls.length})`);

    if (limitedPhotoUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No photo URLs found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Определяем, нужно ли сжимать фотографии
    // Сжимаем только если фотографий <= 10 И размер файла >= 2MB
    // Это снижает нагрузку при большом количестве фотографий
    const shouldCompress = limitedPhotoUrls.length <= 10;
    console.log(`Compression decision: ${shouldCompress ? 'enabled' : 'disabled'} (${limitedPhotoUrls.length} photos)`);

    // Обрабатываем каждую фотографию
    const processedPhotos: Array<{
      original_image_url: string;
      storage_url: string;
      original_storage_url: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      width: number;
      height: number;
    }> = [];

    for (const photoUrl of limitedPhotoUrls) {
      try {
        console.log(`Processing photo: ${photoUrl}`);

        // Скачиваем изображение
        const imageResponse = await fetch(photoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!imageResponse.ok) {
          console.error(`Failed to download image: ${photoUrl}, status: ${imageResponse.status}`);
          continue;
        }

        const imageBlob = await imageResponse.blob();
        const imageArrayBuffer = await imageBlob.arrayBuffer();
        const imageBytes = new Uint8Array(imageArrayBuffer);

        // Определяем MIME тип
        const mimeType = imageBlob.type || imageResponse.headers.get('content-type') || 'image/jpeg';
        const originalExtension = mimeType.split('/')[1] || 'jpg';

        // Генерируем имя файла для оригинала
        const originalFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${originalExtension}`;
        const originalPath = `${user_id}/originals/${originalFileName}`;

        // Загружаем оригинал в Storage (photos-storage bucket)
        const { data: originalUpload, error: originalError } = await supabase.storage
          .from('photos-storage')
          .upload(originalPath, imageBytes, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false
          });

        if (originalError) {
          console.error(`Failed to upload original: ${originalError.message}`);
          continue;
        }

        // Получаем публичный URL для оригинала
        const { data: originalUrlData } = supabase.storage
          .from('photos-storage')
          .getPublicUrl(originalPath);

        const originalStorageUrl = originalUrlData.publicUrl;

        // Определяем размеры изображения для метаданных
        const { width, height } = getImageDimensions(imageBytes, mimeType);

        // Решаем, нужно ли сжимать это конкретное изображение
        // Сжимаем только если:
        // 1. Общее количество фотографий <= 10 (shouldCompress)
        // 2. Размер файла >= 2MB
        const fileSizeMB = imageBytes.length / (1024 * 1024);
        const shouldCompressThis = shouldCompress && fileSizeMB >= 2;
        
        let storageUrl: string;
        let finalFileName: string;
        let finalFileSize: number;
        let finalMimeType: string;

        if (shouldCompressThis) {
          console.log(`Compressing photo: ${photoUrl} (${fileSizeMB.toFixed(2)}MB)`);
          // Сжимаем изображение
          const { compressed, width: compWidth, height: compHeight, finalMimeType: compMimeType } = await compressImage(imageBytes, mimeType);
          
          // Определяем расширение для сжатого файла (предпочитаем WebP, fallback на JPEG)
          const compressedExtension = compMimeType.includes('webp') ? 'webp' : 'jpg';
          const compressedFileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${compressedExtension}`;
          const compressedPath = `${user_id}/compressed/${compressedFileName}`;

          // Загружаем сжатую версию в Storage
          const { data: compressedUpload, error: compressedError } = await supabase.storage
            .from('photos-storage')
            .upload(compressedPath, compressed, {
              contentType: compMimeType,
              cacheControl: '3600',
              upsert: false
            });

          if (compressedError) {
            console.error(`Failed to upload compressed: ${compressedError.message}, using original`);
            // Если не удалось загрузить сжатую версию, используем оригинал
            storageUrl = originalStorageUrl;
            finalFileName = originalFileName;
            finalFileSize = imageBytes.length;
            finalMimeType = mimeType;
          } else {
            // Получаем публичный URL для сжатой версии
            const { data: compressedUrlData } = supabase.storage
              .from('photos-storage')
              .getPublicUrl(compressedPath);

            storageUrl = compressedUrlData.publicUrl;
            finalFileName = compressedFileName;
            finalFileSize = compressed.length;
            finalMimeType = compMimeType;
          }
        } else {
          // Пропускаем сжатие - используем оригинал
          console.log(`Skipping compression for photo: ${photoUrl} (${fileSizeMB.toFixed(2)}MB, total photos: ${limitedPhotoUrls.length})`);
          storageUrl = originalStorageUrl;
          finalFileName = originalFileName;
          finalFileSize = imageBytes.length;
          finalMimeType = mimeType;
        }

        processedPhotos.push({
          original_image_url: photoUrl,
          storage_url: storageUrl,
          original_storage_url: originalStorageUrl,
          file_name: finalFileName,
          file_size: finalFileSize,
          mime_type: finalMimeType,
          width: width || 0,
          height: height || 0
        });

        console.log(`Successfully processed photo: ${photoUrl}, final size: ${finalFileSize} bytes`);
      } catch (error) {
        console.error(`Error processing photo ${photoUrl}:`, error);
        // Продолжаем обработку остальных фотографий
      }
    }

    if (processedPhotos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to process any photos" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Обновляем таблицу photos с URL сжатых версий
    // Используем первую успешно обработанную фотографию как основную
    const mainPhoto = processedPhotos[0];
    const allStorageUrls = processedPhotos.map(p => p.storage_url).join(',');

    // Обновляем запись в таблице photos
    const { data: updatedPhoto, error: updateError } = await supabase
      .from('photos')
      .update({
        photo_url: allStorageUrls, // URL сжатых версий через запятую
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', photo_id)
      .select()
      .single();

    if (updateError) {
      console.error(`Failed to update photos table: ${updateError.message}`);
      return new Response(
        JSON.stringify({ error: `Failed to update photos: ${updateError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully processed ${processedPhotos.length} photos for photo_id: ${photo_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedPhotos.length,
        photo_id: photo_id,
        storage_urls: processedPhotos.map(p => p.storage_url)
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-photos function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
