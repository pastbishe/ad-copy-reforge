// Edge Function для генерации объединенных фотографий
// Использует AI API (Replicate) для замены продукта на фотографии рекламы

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN") ?? "";

interface GenerationRequest {
  scraped_photo_url: string;
  scraped_photo_id: string;
  user_photo_id: string;
  user_photo_url: string;
}

interface ReplicateResponse {
  id: string;
  status: string;
  output?: string | string[];
  error?: string;
}

/**
 * Скачивает изображение по URL
 */
async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Конвертирует изображение в base64
 */
function imageToBase64(imageBytes: Uint8Array, mimeType: string = 'image/jpeg'): string {
  const base64 = btoa(String.fromCharCode(...imageBytes));
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Генерирует изображение через Replicate API
 * Использует Stable Diffusion XL с ControlNet для image-to-image генерации
 */
async function generateImageWithReplicate(
  baseImage: string, // base64 scraped photo
  productImage: string, // base64 user product photo
  variant: number // 1, 2, or 3 for different variations
): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  // Используем Stable Diffusion XL для image-to-image с заменой продукта
  // Альтернатива: использовать другой model, который поддерживает image-to-image
  const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
  
  // Промпт для замены продукта
  const prompt = "Replace the product in this advertisement with the provided product, keeping the same lighting, angle, background style, and composition. The product should blend seamlessly into the original advertisement. High quality, professional photography, realistic.";

  // Параметры для разных вариантов
  const variantParams = {
    1: { guidance_scale: 7.5, num_inference_steps: 30, strength: 0.75 },
    2: { guidance_scale: 8.0, num_inference_steps: 35, strength: 0.8 },
    3: { guidance_scale: 7.0, num_inference_steps: 25, strength: 0.7 }
  };

  const params = variantParams[variant as keyof typeof variantParams] || variantParams[1];

  // Создаем prediction для image-to-image
  const createResponse = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt: prompt,
        image: baseImage, // Базовое изображение (реклама)
        num_outputs: 1,
        guidance_scale: params.guidance_scale,
        num_inference_steps: params.num_inference_steps,
        strength: params.strength,
        seed: Math.floor(Math.random() * 1000000) + variant * 1000, // Разные seed для вариантов
        // Дополнительный промпт для описания продукта пользователя
        negative_prompt: "blurry, distorted, low quality, watermark, text overlay",
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Replicate API error: ${createResponse.status} - ${errorText}`);
  }

  const prediction: ReplicateResponse = await createResponse.json();
  let predictionId = prediction.id;

  // Polling для получения результата
  const maxAttempts = 120; // 2 минуты максимум
  const pollInterval = 2000; // 2 секунды

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to check prediction status: ${statusResponse.status}`);
    }

    const status: ReplicateResponse = await statusResponse.json();

    if (status.status === "succeeded") {
      if (status.output) {
        const outputUrl = Array.isArray(status.output) ? status.output[0] : status.output;
        if (typeof outputUrl === 'string') {
          return outputUrl;
        }
      }
      throw new Error("Invalid output format from Replicate");
    }

    if (status.status === "failed" || status.status === "canceled") {
      throw new Error(status.error || "Generation failed");
    }

    // Продолжаем polling если статус "starting" или "processing"
  }

  throw new Error("Generation timeout");
}

/**
 * Загружает сгенерированное изображение в Supabase Storage
 */
async function uploadToStorage(
  supabase: any,
  userId: string,
  imageUrl: string,
  variant: number
): Promise<string> {
  // Скачиваем изображение
  const imageBytes = await downloadImage(imageUrl);

  // Генерируем путь
  const timestamp = Date.now();
  const fileName = `${timestamp}_variant_${variant}.jpg`;
  const filePath = `${userId}/generated/${fileName}`;

  // Загружаем в storage
  const { data, error } = await supabase.storage
    .from('generated-results')
    .upload(filePath, imageBytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload to storage: ${error.message}`);
  }

  // Получаем публичный URL
  const { data: urlData } = supabase.storage
    .from('generated-results')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };

  // Handle preflight OPTIONS request first
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GenerationRequest = await req.json();
    const { scraped_photo_url, scraped_photo_id, user_photo_id, user_photo_url } = body;

    if (!scraped_photo_url || !scraped_photo_id || !user_photo_id || !user_photo_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Получаем user_id из user_photo_id
    const { data: userPhoto, error: photoError } = await supabase
      .from('user_photos')
      .select('user_id')
      .eq('id', user_photo_id)
      .single();

    if (photoError || !userPhoto) {
      return new Response(
        JSON.stringify({ error: "User photo not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userPhoto.user_id;

    // Проверяем, есть ли уже генерация для этой комбинации
    const { data: existing } = await supabase
      .from('generated_photos')
      .select('*')
      .eq('user_id', userId)
      .eq('scraped_photo_id', scraped_photo_id)
      .eq('user_photo_id', user_photo_id)
      .eq('status', 'completed')
      .maybeSingle();

    if (existing && existing.generated_urls && existing.generated_urls.length === 3) {
      // Возвращаем существующие результаты
      return new Response(
        JSON.stringify({
          id: existing.id,
          generated_urls: existing.generated_urls,
          status: 'completed'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Создаем или обновляем запись
    let generationId: string;
    if (existing) {
      generationId = existing.id;
      await supabase
        .from('generated_photos')
        .update({ status: 'processing' })
        .eq('id', generationId);
    } else {
      const { data: newGen, error: insertError } = await supabase
        .from('generated_photos')
        .insert({
          user_id: userId,
          scraped_photo_id,
          user_photo_id,
          status: 'processing',
          generated_urls: []
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create generation record: ${insertError.message}`);
      }
      generationId = newGen.id;
    }

    try {
      // Скачиваем изображения
      const scrapedImageBytes = await downloadImage(scraped_photo_url);
      const userImageBytes = await downloadImage(user_photo_url);

      // Конвертируем в base64
      const scrapedBase64 = imageToBase64(scrapedImageBytes);
      const userBase64 = imageToBase64(userImageBytes);

      // Генерируем 3 варианта параллельно
      // Используем промпт с описанием продукта пользователя для лучшей замены
      const generationPromises = [1, 2, 3].map(variant =>
        generateImageWithReplicate(scrapedBase64, userBase64, variant)
          .then(url => uploadToStorage(supabase, userId, url, variant))
          .catch(error => {
            console.error(`Error generating variant ${variant}:`, error);
            throw error;
          })
      );

      const generatedUrls = await Promise.all(generationPromises);

      // Обновляем запись с результатами
      await supabase
        .from('generated_photos')
        .update({
          status: 'completed',
          generated_urls: generatedUrls
        })
        .eq('id', generationId);

      return new Response(
        JSON.stringify({
          id: generationId,
          generated_urls: generatedUrls,
          status: 'completed'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      // Обновляем статус на failed
      await supabase
        .from('generated_photos')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', generationId);

      throw error;
    }
  } catch (error) {
    console.error("Generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

