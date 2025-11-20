import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link as LinkIcon, History, Menu, X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox as UICheckbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SnakeGame } from "@/components/SnakeGame";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  savePhotoImport,
  updatePhotoImport,
  startScrapingJobSimple,
  getUserCompetitorPhotos,
  getUnprocessedCompletedPhotoImports,
  getUrlHistory,
  waitForScrapeJobCompletion,
  checkAndUpdateScrapeJobStatus,
  generateOperationNumber,
  generateOperationId,
  type UrlHistoryItem,
  type ScrapeJob
} from "@/lib/scrapingUtils";
import { handleNetworkError } from "@/lib/networkUtils";
import { getUserPhotos, fetchImageWithRetry } from "@/lib/imageUtils";
import { ArrowLeft } from "lucide-react";
import { PhotoHistoryModal, type PhotoHistoryItem } from "@/components/PhotoHistoryModal";

// Тип для хранения фотографии с ID из базы данных
type ScrapedPhotoWithId = {
  file: File;
  url?: string; // Оригинальный URL фотографии из Storage (для использования в Edge Function)
  dbId?: string; // ID из таблицы photos
  source?: 'competitor' | 'user' | 'upload'; // Источник фотографии
};

const StudioEmpty = () => {
  const [url, setUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [isCheckingPhotos, setIsCheckingPhotos] = useState(true);
  const [urlHistory, setUrlHistory] = useState<UrlHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hoveredUrlId, setHoveredUrlId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [scrapedPhotos, setScrapedPhotos] = useState<ScrapedPhotoWithId[]>([]); // Выбранные фотографии
  const [currentScrapedPhotoIndex, setCurrentScrapedPhotoIndex] = useState(0);
  const [selectedScrapedPhotos, setSelectedScrapedPhotos] = useState<Set<number>>(new Set());
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [showPhotoHistory, setShowPhotoHistory] = useState(false);
  const [competitorZoom, setCompetitorZoom] = useState(100);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // URL webhook n8n для импорта ссылки рекламы конкурента
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_SCRAPING_WEBHOOK_URL || '';

  // Функция для загрузки фотографий конкурентов из задания скрапинга
  // Теперь проверяет таблицу photos вместо competitor_photos
  const loadCompetitorPhotosForJob = async (jobId: string, photoId: string) => {
    try {
      console.log('loadCompetitorPhotosForJob: начинаем проверку, jobId:', jobId, 'photoId:', photoId);
      
      // Проверяем и обновляем статус задания
      let status: 'running' | 'done' | 'error';
      try {
        status = await checkAndUpdateScrapeJobStatus(jobId);
        console.log('loadCompetitorPhotosForJob: статус задания:', status);
      } catch (statusError) {
        console.error('Ошибка проверки статуса задания:', statusError);
        // Продолжаем, даже если не удалось проверить статус
        status = 'running';
      }
      
      // Если статус еще 'running', ждем завершения
      if (status === 'running') {
        toast({
          title: t("scrapingStarted") || "Скрапинг запущен!",
          description: t("waitingForCompletion") || "Ожидаем завершения скрапинга...",
        });
        
        // Ждем завершения задания с обновлением прогресса
        // Оптимизировано: проверяем каждую секунду, максимум 30 секунд (n8n завершает за ~16 секунд)
        let finalStatus: 'done' | 'error';
        try {
          finalStatus = await waitForScrapeJobCompletion(jobId, {
            maxAttempts: 30, // До 30 секунд (30 * 1 секунда)
            delay: 1000, // Проверяем каждую секунду для быстрой реакции
            onProgress: (attempt, maxAttempts) => {
              const progressPercent = 20 + Math.floor((attempt / maxAttempts) * 50); // От 20% до 70%
              setProgress(progressPercent);
            }
          });
        } catch (waitError) {
          console.error('Ошибка ожидания завершения задания:', waitError);
          finalStatus = 'error';
        }
        
        if (finalStatus === 'error') {
          // Проверяем, может быть задание все-таки завершилось, но статус не обновился
          try {
            const currentStatus = await checkAndUpdateScrapeJobStatus(jobId);
            if (currentStatus === 'done') {
              console.log('Задание завершено, продолжаем обработку');
              status = 'done';
            } else {
              throw new Error('Скрапинг не завершился в течение ожидаемого времени. Попробуйте проверить статус позже.');
            }
          } catch (checkError) {
            console.error('Ошибка проверки статуса после таймаута:', checkError);
            toast({
              title: t("error") || "Ошибка",
              description: t("scrapingTakesLonger") || "Скрапинг занимает больше времени, чем ожидалось. Вы будете перенаправлены в студию, где сможете проверить статус позже.",
              variant: "destructive",
            });
            setIsLoading(false);
            setProgress(0);
            // Редиректим на студию, чтобы пользователь мог проверить статус позже
            navigate('/studio', { 
              replace: true,
              state: { 
                autoLoaded: true
              } 
            });
            return;
          }
        } else {
          status = finalStatus;
        }
      } else if (status === 'error') {
        toast({
          title: t("error") || "Ошибка",
          description: t("scrapingError") || "Произошла ошибка при скрапинге",
          variant: "destructive",
        });
        setIsLoading(false);
        setProgress(0);
        return;
      }
      
      // После завершения задания ждем, пока N8N обновит запись со статусом 'completed' и photo_url
      // Используем real-time подписку для мгновенной реакции на появление записи со статусом completed
      console.log('loadCompetitorPhotosForJob: задание завершено (статус:', status, '), ждем обновления записи в photos таблице через real-time, photoId:', photoId);
      setProgress(70);
      
      // Функция для ожидания завершения записи через real-time подписку (без polling)
      const waitForPhotoRecord = async (timeout: number = 60000): Promise<{ id: string; photo_url: string; status: string } | null> => {
        // 1 минута таймаут (60000 мс)
        return new Promise((resolve) => {
          let isResolved = false;
          let channel: ReturnType<typeof supabase.channel> | null = null;
          let timeoutId: NodeJS.Timeout | null = null;
          let fallbackCheckInterval: NodeJS.Timeout | null = null;
          
          const cleanup = () => {
            if (channel) {
              console.log('loadCompetitorPhotosForJob: отписываемся от канала');
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
            if (fallbackCheckInterval) {
              clearInterval(fallbackCheckInterval);
              fallbackCheckInterval = null;
            }
          };
          
          const resolveOnce = (value: { id: string; photo_url: string; status: string } | null) => {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              resolve(value);
            }
          };
          
          // Функция для проверки записи в БД (используется только как fallback)
          const checkPhotoRecord = async (): Promise<boolean> => {
            try {
              const { data, error } = await supabase
                .from('photos')
                .select('id, photo_url, status')
                .eq('id', photoId)
                .single();
              
              if (!error && data && data.status === 'completed' && data.photo_url && data.photo_url.trim().length > 0) {
                console.log('loadCompetitorPhotosForJob: найдена завершенная запись через fallback проверку');
                resolveOnce({
                  id: data.id,
                  photo_url: data.photo_url,
                  status: data.status
                });
                return true;
              }
              return false;
            } catch (checkError) {
              console.error('Ошибка проверки записи:', checkError);
              return false;
            }
          };
          
          // Сначала проверяем текущее состояние записи
          checkPhotoRecord().then((found) => {
            if (found) {
              // Запись уже готова, выходим
              return;
            }
            
            // Если не найдено, создаем real-time подписку
            console.log('loadCompetitorPhotosForJob: создаем real-time подписку для photoId:', photoId);
            channel = supabase
              .channel(`photo-completed-${photoId}-${Date.now()}`)
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'photos',
                  filter: `id=eq.${photoId}`,
                },
                (payload) => {
                  console.log('loadCompetitorPhotosForJob: получено событие UPDATE:', payload);
                  
                  const newRecord = payload.new as { id: string; status: string; photo_url: string | null };
                  
                  // Проверяем, что запись завершена и имеет photo_url
                  if (newRecord.status === 'completed' && newRecord.photo_url && newRecord.photo_url.trim().length > 0) {
                    console.log('loadCompetitorPhotosForJob: найдена завершенная запись через real-time');
                    resolveOnce({
                      id: newRecord.id,
                      photo_url: newRecord.photo_url,
                      status: newRecord.status
                    });
                  }
                }
              )
              .subscribe((subscribeStatus) => {
                console.log('loadCompetitorPhotosForJob: статус подписки:', subscribeStatus);
                
                if (subscribeStatus === 'SUBSCRIBED') {
                  console.log('loadCompetitorPhotosForJob: подписка активна, ждем обновления...');
                  setProgress(70);
                  
                  // Fallback проверка только каждые 30 секунд (на случай если real-time пропустит событие)
                  // Это намного реже, чем было (5 секунд), так как real-time должен работать
                  fallbackCheckInterval = setInterval(() => {
                    if (!isResolved) {
                      checkPhotoRecord();
                    }
                  }, 30000); // Проверяем раз в 30 секунд как fallback
                } else if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT' || subscribeStatus === 'CLOSED') {
                  console.warn('loadCompetitorPhotosForJob: ошибка подписки, используем fallback проверку. Статус:', subscribeStatus);
                  // Если real-time не работает, используем более частую проверку (но все равно реже, чем было)
                  if (!fallbackCheckInterval) {
                    fallbackCheckInterval = setInterval(() => {
                      if (!isResolved) {
                        checkPhotoRecord();
                      }
                    }, 10000); // Проверяем раз в 10 секунд при отсутствии real-time (было 3 секунды)
                  }
                }
              });
          }).catch((error) => {
            console.error('loadCompetitorPhotosForJob: ошибка начальной проверки:', error);
            // При ошибке используем fallback проверку
            if (!fallbackCheckInterval) {
              fallbackCheckInterval = setInterval(() => {
                if (!isResolved) {
                  checkPhotoRecord();
                }
              }, 10000);
            }
          });
          
          // Устанавливаем таймаут
          timeoutId = setTimeout(() => {
            console.log('loadCompetitorPhotosForJob: таймаут, запись не обновлена');
            // Финальная проверка перед таймаутом
            checkPhotoRecord().then((found) => {
              if (!found) {
                resolveOnce(null);
              }
            });
          }, timeout);
        });
      };
      
      // Ждем обновления записи через real-time подписку
      const photoRecord = await waitForPhotoRecord();
      
      if (!photoRecord || !photoRecord.photo_url) {
        toast({
          title: t("warning") || "Предупреждение",
          description: t("photosStillProcessing") || "Фотографии ещё обрабатываются. Вы будете перенаправлены в студию, когда они будут готовы.",
        });
        // Редиректим на студию - фотографии будут обработаны Edge Function
        console.log('loadCompetitorPhotosForJob: редирект на /studio (фотографии еще обрабатываются)');
        setProgress(100);
        setIsLoading(false);
        // Используем replace: true, чтобы не оставлять историю с экраном загрузки
        navigate('/studio', { 
          replace: true,
          state: { 
            autoLoaded: true
          } 
        });
        return;
      }
      
      // Извлекаем URL из photo_url (может быть JSON массив, разделенные запятыми, или одна строка)
      const extractPhotoUrls = (photoUrl: string): string[] => {
        if (!photoUrl || photoUrl.trim().length === 0) {
          return [];
        }
        
        try {
          // Пытаемся распарсить как JSON (массив URL)
          const parsed = JSON.parse(photoUrl);
          if (Array.isArray(parsed)) {
            return parsed.filter((url): url is string => typeof url === 'string' && url.length > 0).map(url => url.trim());
          } else if (typeof parsed === 'string') {
            return [parsed.trim()];
          }
        } catch {
          // Если не JSON, проверяем, разделены ли URL запятыми
          const urls = photoUrl.split(',').map(url => url.trim()).filter(url => url.length > 0);
          if (urls.length > 0) {
            return urls;
          } else {
            // Если не удалось распарсить, используем как есть
            return [photoUrl.trim()];
          }
        }
        
        return [];
      };
      
      const photoUrls = extractPhotoUrls(photoRecord.photo_url);
      // Ограничиваем количество фотографий до 15
      const limitedPhotoUrls = photoUrls.slice(0, 15);
      console.log('loadCompetitorPhotosForJob: извлечено URL:', photoUrls.length, '(ограничено до', limitedPhotoUrls.length, ')');
      
      if (limitedPhotoUrls.length > 0) {
        // Обновляем прогресс - начинаем скачивание фотографий
        setProgress(80);
        console.log('loadCompetitorPhotosForJob: начинаем скачивание фотографий по URL');
        
        // Скачиваем фотографии по URL и проверяем их доступность
        const downloadedPhotos: ScrapedPhotoWithId[] = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < limitedPhotoUrls.length; i++) {
          const photoUrl = limitedPhotoUrls[i];
          try {
            console.log(`loadCompetitorPhotosForJob: скачиваем фотографию ${i + 1}/${limitedPhotoUrls.length}:`, photoUrl);
            
            // Обновляем прогресс для каждой фотографии
            const progressPercent = 80 + Math.floor((i / limitedPhotoUrls.length) * 15); // От 80% до 95%
            setProgress(progressPercent);
            
            // Скачиваем фотографию с повторными попытками
            const response = await fetchImageWithRetry(photoUrl, {
              timeout: 30000,
              maxRetries: 3,
              retryDelay: 1000
            });
            
            if (!response.ok) {
              console.error(`Ошибка загрузки ${photoUrl}: ${response.status}`);
              errorCount++;
              continue;
            }
            
            const blob = await response.blob();
            
            // Проверяем, что это изображение
            if (!blob.type.startsWith('image/')) {
              console.error(`Файл ${photoUrl} не является изображением:`, blob.type);
              errorCount++;
              continue;
            }
            
            // Извлекаем имя файла из URL
            const urlParts = photoUrl.split('/');
            let fileName = urlParts[urlParts.length - 1] || `photo-${Date.now()}-${i}.jpg`;
            // Убираем query параметры из имени файла
            fileName = fileName.split('?')[0];
            // Если нет расширения, добавляем по типу blob
            if (!fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              const extension = blob.type.split('/')[1] || 'jpg';
              fileName = `${fileName}.${extension}`;
            }
            
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
            
            downloadedPhotos.push({
              file,
              source: 'competitor'
            });
            
            successCount++;
            console.log(`loadCompetitorPhotosForJob: успешно скачана фотография ${i + 1}/${limitedPhotoUrls.length}`);
          } catch (error) {
            console.error(`Ошибка обработки ${photoUrl}:`, error);
            errorCount++;
          }
        }
        
        // Финальный прогресс
        setProgress(95);
        
        if (downloadedPhotos.length > 0) {
          console.log(`loadCompetitorPhotosForJob: успешно скачано ${downloadedPhotos.length} из ${limitedPhotoUrls.length} фотографий`);
          
          toast({
            title: t("success") || "Успешно",
            description: `${t("successfullyScraped") || "Успешно собрано"} ${downloadedPhotos.length} ${t("competitorAdsCount") || "реклам"}`,
          });
          
          // Фотографии скачаны и готовы к показу
          // Теперь редиректим на /studio - фотографии будут загружены через loadPhotosDirectlyFromPhotosTable
          console.log('loadCompetitorPhotosForJob: редирект на /studio (скачано фотографий:', downloadedPhotos.length, ')');
          setProgress(100);
          setIsLoading(false);
          
          // Используем replace: true, чтобы не оставлять историю с экраном загрузки
          navigate('/studio', { 
            replace: true,
            state: { 
              autoLoaded: true,
              photoCount: downloadedPhotos.length
            } 
          });
        } else {
          // Не удалось скачать ни одной фотографии
          console.error('loadCompetitorPhotosForJob: не удалось скачать ни одной фотографии');
          toast({
            title: t("warning") || "Предупреждение",
            description: t("photosStillProcessing") || "Фотографии ещё обрабатываются. Вы будете перенаправлены в студию, когда они будут готовы.",
          });
          setProgress(100);
          setIsLoading(false);
          // Все равно редиректим на студию - там можно будет проверить статус позже
          navigate('/studio', { 
            replace: true,
            state: { 
              autoLoaded: true
            } 
          });
        }
      } else {
        toast({
          title: t("warning") || "Предупреждение",
          description: t("photosStillProcessing") || "Фотографии ещё обрабатываются. Вы будете перенаправлены в студию, когда они будут готовы.",
        });
        // Все равно редиректим на студию
        console.log('loadCompetitorPhotosForJob: редирект на /studio (нет URL фотографий)');
        setProgress(100);
        setIsLoading(false);
        // Используем replace: true, чтобы не оставлять историю с экраном загрузки
        navigate('/studio', { 
          replace: true,
          state: { 
            autoLoaded: true
          } 
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки фотографий задания:', error);
      toast({
        title: t("error") || "Ошибка",
        description: t("failedToLoadCompetitorPhotos") || "Не удалось загрузить фотографии конкурентов",
        variant: "destructive",
      });
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleImport = useCallback(async () => {
    if (!url) return;
    
    // Проверяем авторизацию пользователя
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (!isDemoUserLocal && !user) {
      toast({
        title: t("authRequired") || "Требуется авторизация",
        description: t("authRequiredDesc") || "Пожалуйста, войдите в систему",
        variant: "destructive",
      });
      return;
    }

    // Для демо-пользователей используем старую логику
    if (isDemoUserLocal || !N8N_WEBHOOK_URL) {
      setProgress(0);
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + 5;
        });
      }, 250);

      setTimeout(() => {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
          // Сброс всех промптов и настроек при импорте новых фотографий
          localStorage.removeItem("studio_general_prompt");
          localStorage.removeItem("studio_ads_data");
          
          // Редиректим на /studio после успешного импорта
          navigate('/studio', { 
            state: { 
              autoLoaded: true
            } 
          });
          
          toast({
            title: t("adsImported"),
            description: t("adsImportedDesc") || "Рекламы импортированы",
          });
        }, 500);
      }, 5000);
      return;
    }

    // Для авторизованных пользователей вызываем вебхук N8N
    setIsLoading(true);
    setProgress(0);
    
    try {
      const userId = user?.id;
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }

      // Генерируем уникальный номер операции (читаемый формат для n8n)
      console.log('=== НАЧАЛО ИМПОРТА ===');
      console.log('URL для импорта:', url);
      console.log('User ID:', userId);
      
      const operationNumber = generateOperationNumber();
      
      console.log('=== СГЕНЕРИРОВАН НОМЕР ОПЕРАЦИИ ===');
      console.log('Номер операции (для n8n):', operationNumber);

      // ВАЖНО: Сначала создаем запись в photos ДО вызова вебхука
      // Это нужно, чтобы n8n мог обновить эту запись после скрапинга
      let photoId: string;
      try {
        const { data: tempPhoto, error: tempError } = await supabase
          .from('photos')
          .insert({
            user_id: userId,
            url: url,
            photo_url: null,
            status: 'pending',
          })
          .select('id')
          .single();
        
        if (tempError || !tempPhoto) {
          throw new Error(`Ошибка создания записи в photos: ${tempError?.message || 'Неизвестная ошибка'}`);
        }
        
        photoId = tempPhoto.id;
        console.log('Создана запись в photos ДО вызова вебхука, photoId:', photoId);
      } catch (createError) {
        console.error('Ошибка создания записи в photos:', createError);
        throw createError;
      }

      // Теперь запускаем скрапинг через упрощенный webhook с номером операции
      // Передаем photoId, чтобы n8n мог обновить правильную запись
      console.log('=== ВЫЗОВ ВЕБХУКА ===');
      console.log('Передаем номер операции в startScrapingJobSimple:', operationNumber);
      console.log('Передаем photoId в startScrapingJobSimple:', photoId);
      
      setProgress(10);
      
      let job: ScrapeJob;
      try {
        job = await startScrapingJobSimple(url, userId, N8N_WEBHOOK_URL, operationNumber, photoId);
        console.log('Вебхук вернул job:', job);
        console.log('Job ID (будет использован как operation_id):', job.id);
      } catch (webhookError: any) {
        console.error('Ошибка вызова webhook:', webhookError);
        
        // Проверяем тип ошибки и даем понятное сообщение
        let errorMessage = 'Не удалось запустить скрапинг';
        if (webhookError?.message?.includes('timeout') || webhookError?.name === 'TimeoutError') {
          errorMessage = 'Сервер не отвечает. Проверьте подключение к интернету и попробуйте позже.';
        } else if (webhookError?.message?.includes('Failed to fetch') || webhookError?.message?.includes('Network')) {
          errorMessage = 'Проблема с подключением к серверу. Проверьте интернет-соединение.';
        } else if (webhookError?.message) {
          errorMessage = webhookError.message;
        }
        
        throw new Error(errorMessage);
      }
      
      // Обновляем запись в photos с job.id как operation_id
      const { error: updateError } = await supabase
        .from('photos')
        .update({
          operation_id: job.id,
          status: 'processing'
        })
        .eq('id', photoId);
      
      if (updateError) {
        console.error('Ошибка обновления записи в photos:', updateError);
        // Не бросаем ошибку, так как запись уже создана и вебхук уже вызван
      } else {
        console.log('Запись обновлена, photoId:', photoId, 'operation_id:', job.id);
      }
      
      // Обновляем прогресс
      setProgress(20);
      
      toast({
        title: t("scrapingStarted") || "Скрапинг запущен!",
        description: t("scrapingStartedDesc") || "Мы собираем рекламы конкурентов. Это может занять несколько минут.",
      });

      // Загружаем фотографии из задания скрапинга
      // Функция loadCompetitorPhotosForJob будет ждать завершения задания и проверять статус
      // N8N обновит статус на 'completed' когда фотографии будут готовы
      console.log('handleImport: вызываем loadCompetitorPhotosForJob, job.id:', job.id, 'photoId:', photoId);
      try {
        await loadCompetitorPhotosForJob(job.id, photoId);
        console.log('handleImport: loadCompetitorPhotosForJob завершена');
      } catch (loadError: any) {
        console.error('Ошибка загрузки фотографий:', loadError);
        // Если это не критическая ошибка, просто редиректим на студию
        // Там пользователь сможет проверить статус позже
        if (loadError?.message?.includes('таймаут') || loadError?.message?.includes('timeout')) {
          toast({
            title: t("warning") || "Предупреждение",
            description: t("scrapingTakesLonger") || "Скрапинг запущен, но обработка занимает больше времени, чем ожидалось. Вы будете перенаправлены в студию, где сможете проверить статус позже.",
          });
          navigate('/studio', { 
            replace: true,
            state: { 
              autoLoaded: true
            } 
          });
          return;
        }
        throw loadError;
      }
      
    } catch (error) {
      console.error('Ошибка запуска скрапинга:', error);
      
      // Обновляем статус записи в photos на failed при ошибке
      try {
        const userId = user?.id;
        if (userId) {
          // Находим последнюю запись для этого пользователя и URL
          const { data: photos, error: fetchError } = await supabase
            .from('photos')
            .select('id')
            .eq('user_id', userId)
            .eq('url', url)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (!fetchError && photos) {
            await updatePhotoImport(photos.id, 'failed');
          }
        }
      } catch (updateError) {
        console.error('Ошибка обновления статуса записи:', updateError);
      }
      
      // Получаем понятное сообщение об ошибке
      const { message: userMessage } = handleNetworkError(error);
      
      toast({
        title: t("error") || "Ошибка",
        description: userMessage || (error instanceof Error ? error.message : t("scrapingError") || "Не удалось запустить скрапинг"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [url, user, toast, t, N8N_WEBHOOK_URL, navigate]);

  // Проверяем, есть ли URL конкурента в состоянии навигации
  useEffect(() => {
    const competitorUrl = location.state?.competitorUrl;
    
    if (competitorUrl) {
      setUrl(competitorUrl);
      // Автоматически запускаем импорт
      setTimeout(() => {
        handleImport();
      }, 500);
    }
  }, [location.state, handleImport]);

  // Обработка импорта из query string (когда переходим с параметром import)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const importUrlParam = searchParams.get("import");
    
    if (importUrlParam) {
      setUrl(importUrlParam);
      // Очищаем параметр из URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate]);

  // Обработка события импорта из Header
  useEffect(() => {
    const handleImportEvent = (event: CustomEvent<{ url: string }>) => {
      const importUrl = event.detail.url;
      if (importUrl) {
        setUrl(importUrl);
        // Автоматически запускаем импорт
        setTimeout(() => {
          handleImport();
        }, 100);
      }
    };

    window.addEventListener("import-link", handleImportEvent as EventListener);
    
    return () => {
      window.removeEventListener("import-link", handleImportEvent as EventListener);
    };
  }, [handleImport]);

  // Загружаем историю ссылок
  useEffect(() => {
    const loadUrlHistory = async () => {
      const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
      if (isDemoUserLocal || !user) {
        return;
      }

      setIsLoadingHistory(true);
      try {
        const history = await getUrlHistory(user.id, 20);
        setUrlHistory(history);
      } catch (error) {
        console.error('Ошибка загрузки истории ссылок:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadUrlHistory();
  }, [user]);

  // Обработчик выбора фотографии из истории
  const handleSelectFromHistory = async (photo: PhotoHistoryItem) => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    
    if (isDemoUserLocal) {
      toast({
        title: t("demoMode"),
        description: t("demoModeDesc"),
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Загружаем изображение по URL
      const response = await fetch(photo.compressed_url || photo.original_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      const file = new File([blob], photo.file_name, { type: mimeType });
      const photoUrl = photo.compressed_url || photo.original_url;
      
      // Добавляем в scrapedPhotos
      setScrapedPhotos(prev => {
        const newPhoto: ScrapedPhotoWithId = {
          file,
          url: photoUrl, // Сохраняем оригинальный URL для использования в Edge Function
          dbId: photo.id,
          source: (photo.source === 'competitor' || photo.type === 'competitor') ? 'competitor' : 'user'
        };
        const newPhotos = [...prev, newPhoto];
        setCurrentScrapedPhotoIndex(newPhotos.length - 1);
        return newPhotos;
      });
      
      setShowPhotoHistory(false);
      
      toast({
        title: t("photoSelected") || "Фотография выбрана",
        description: `"${photo.file_name}" ${t("photoAddedToProject") || "добавлена в проект"}`,
      });
    } catch (error) {
      console.error('Ошибка загрузки фотографии:', error);
      toast({
        title: t("error"),
        description: t("failedToLoadPhoto"),
        variant: "destructive",
      });
    }
  };

  // Обработчик выбора/снятия выбора фотографии
  const handleTogglePhotoSelection = (index: number) => {
    setSelectedScrapedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Выбрать все фотографии
  const handleSelectAllPhotos = () => {
    if (selectedScrapedPhotos.size === scrapedPhotos.length) {
      setSelectedScrapedPhotos(new Set());
    } else {
      setSelectedScrapedPhotos(new Set(scrapedPhotos.map((_, index) => index)));
    }
  };

  // Освобождаем URL объектов при размонтировании или изменении фотографий
  useEffect(() => {
    return () => {
      // URL объекты будут автоматически освобождены при размонтировании компонента
      // React автоматически обрабатывает это
    };
  }, [scrapedPhotos]);

  // Проверяем наличие фотографий пользователя при загрузке страницы
  useEffect(() => {
    const checkUserPhotos = async () => {
      const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
      if (isDemoUserLocal || !user) {
        setIsCheckingPhotos(false);
        return;
      }

      try {
        // Проверяем фотографии пользователя
        const userPhotos = await getUserPhotos(user.id, 1);
        // Проверяем фотографии конкурентов
        const competitorPhotos = await getUserCompetitorPhotos(user.id, 1);
        
        // Если есть хотя бы один тип фотографий, показываем кнопку возврата
        if (userPhotos.length > 0 || competitorPhotos.length > 0) {
          setHasPhotos(true);
        }
      } catch (error) {
        console.error('Ошибка проверки фотографий:', error);
      } finally {
        setIsCheckingPhotos(false);
      }
    };

    checkUserPhotos();
  }, [user]);

  // Периодическая проверка завершенных импортов ТОЛЬКО после успешного импорта
  // Автоматический редирект происходит только если пользователь только что загрузил новые фотографии
  // Если пользователь просто зашел на empty и у него уже есть фотографии, он остается на empty

  // Показываем состояние загрузки
  if (isLoading || progress > 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-8"
            >
              <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
            
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              {t("scrapingCompetitorAds")}
            </h2>
            
            <div className="w-full max-w-md mx-auto mb-3">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-primary"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </motion.div>
        </main>
      </div>
    );
  }

  // Если есть выбранные фотографии, показываем интерфейс редактирования
  if (scrapedPhotos.length > 0) {
    return (
      <div className="min-h-screen flex flex-col relative" style={{ 
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)'
      }}>
        {/* ЗМЕЙКА НА ВСЮ СТРАНИЦУ */}
        <SnakeGame />

        <div className="flex-1 flex relative overflow-hidden z-10">
          {/* Левая панель с фотографиями */}
          <motion.div
            initial={false}
            animate={{ width: isLeftPanelOpen ? "clamp(13rem, 18vw, 16rem)" : "clamp(2.5rem, 3vw, 2.75rem)" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onMouseEnter={() => setIsLeftPanelOpen(true)}
            onMouseLeave={() => setIsLeftPanelOpen(false)}
            className="bg-card border-r border-border overflow-hidden relative z-10"
          >
            {!isLeftPanelOpen && (
              <div className="h-full flex items-center justify-center">
                <Menu style={{ width: "clamp(1.125rem, 1.5vw, 1.25rem)", height: "clamp(1.125rem, 1.5vw, 1.25rem)" }} className="text-muted-foreground" />
              </div>
            )}
            
            <AnimatePresence>
              {isLeftPanelOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="h-full flex flex-col"
                >
                  <div style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }} className="flex items-center justify-between gap-2">
                    <label 
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[role="checkbox"]') || target.closest('button') || target.tagName === 'BUTTON') {
                          return;
                        }
                        handleSelectAllPhotos();
                      }}
                    >
                      <UICheckbox
                        checked={scrapedPhotos.length > 0 && selectedScrapedPhotos.size === scrapedPhotos.length}
                        onCheckedChange={handleSelectAllPhotos}
                        className="shrink-0"
                      />
                      <h3 style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-semibold text-foreground">
                        {t("scrapedPhotos") || "Scraped Photos"} ({scrapedPhotos.length})
                      </h3>
                    </label>
                  </div>
                  
                  <div style={{ padding: "0 clamp(0.75rem, 1.5vw, 1rem) clamp(0.75rem, 1.5vw, 1rem)" }} className="flex-1 overflow-y-auto">
                    {scrapedPhotos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <p style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="text-muted-foreground">
                          {t("noScrapedPhotos") || "No scraped photos"}
                        </p>
                        <p style={{ fontSize: "clamp(0.625rem, 0.75vw, 0.7rem)" }} className="text-muted-foreground mt-2">
                          {t("scrapePhotosToSeeThemHere") || "Start scraping to see photos here"}
                        </p>
                      </div>
                    ) : (
                      <div style={{ gap: "clamp(0.5rem, 1vh, 0.75rem)" }} className="flex flex-col">
                        {scrapedPhotos.map((item, index) => {
                          const isCurrentlyDisplayed = currentScrapedPhotoIndex === index;
                          const isSelected = selectedScrapedPhotos.has(index);
                          const photoUrl = URL.createObjectURL(item.file);
                          
                          return (
                            <motion.div
                              key={`scraped-${index}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ 
                                opacity: 1, 
                                y: 0,
                                scale: isCurrentlyDisplayed ? 1.05 : 1
                              }}
                              transition={{ 
                                duration: 0.3,
                                delay: index * 0.05
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              style={{ padding: "clamp(0.375rem, 0.8vw, 0.5rem)" }}
                              className={`rounded-lg transition-all duration-300 relative cursor-pointer ${
                                isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50 shadow-lg shadow-primary/20" : 
                                isSelected ? "border-2 border-primary bg-primary/20" : 
                                "border-2 border-transparent hover:bg-accent/30"
                              }`}
                              onClick={() => {
                                setCurrentScrapedPhotoIndex(index);
                              }}
                            >
                              <div className="relative">
                                <img
                                  src={photoUrl}
                                  alt={item.file.name || `Scraped Photo ${index + 1}`}
                                  className="w-full aspect-square object-cover rounded mb-2 pointer-events-none"
                                />
                                <div className="absolute top-2 left-2">
                                  <UICheckbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleTogglePhotoSelection(index)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-background/80 backdrop-blur-sm"
                                  />
                                </div>
                              </div>
                              <p style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="font-medium text-foreground pointer-events-none truncate">
                                {item.file.name || `Scraped Photo ${index + 1}`}
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Кнопка История внизу панели */}
                  <div style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }} className="border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPhotoHistory(true)}
                      className="w-full"
                      style={{ 
                        fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)",
                        height: "clamp(2rem, 3vh, 2.5rem)",
                        padding: "clamp(0.25rem, 0.5vw, 0.375rem)"
                      }}
                    >
                      <History style={{ width: "clamp(0.875rem, 1.2vw, 1rem)", height: "clamp(0.875rem, 1.2vw, 1rem)" }} className="mr-2" />
                      {t("history") || "History"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Центральная область для отображения фотографии */}
          <div className="flex-1 flex items-center justify-center relative">
            <div 
              className="w-full h-full flex items-center justify-center relative cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const centerX = rect.width / 2;
                
                if (clickX < centerX && currentScrapedPhotoIndex > 0) {
                  setCurrentScrapedPhotoIndex(prev => prev - 1);
                } else if (clickX > centerX && currentScrapedPhotoIndex < scrapedPhotos.length - 1) {
                  setCurrentScrapedPhotoIndex(prev => prev + 1);
                }
              }}
              onMouseEnter={() => setIsHoveringImage(true)}
              onMouseLeave={() => setIsHoveringImage(false)}
            >
              <motion.div 
                style={{ 
                  width: "100%",
                  height: "100%"
                }}
                className="relative flex items-center justify-center p-4"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {/* Информация о фотографии */}
                {scrapedPhotos[currentScrapedPhotoIndex] && (
                  <div 
                    style={{ 
                      top: "clamp(0.5rem, 1vh, 0.75rem)", 
                      left: "clamp(0.5rem, 1vw, 0.75rem)",
                      padding: "clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.375rem, 0.75vw, 0.5rem)"
                    }} 
                    className="absolute z-10 bg-black/20 backdrop-blur-sm rounded-md border border-white/10"
                  >
                    <p style={{ fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)" }} className="font-medium text-white/90 truncate max-w-[200px]">
                      {scrapedPhotos[currentScrapedPhotoIndex].file.name || `Photo ${currentScrapedPhotoIndex + 1}`}
                    </p>
                    <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/70 mt-0.5">
                      {currentScrapedPhotoIndex + 1} / {scrapedPhotos.length}
                    </p>
                    <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/60 mt-0.5">
                      🔍 {competitorZoom}%
                    </p>
                  </div>
                )}

                {/* Фотография */}
                <AnimatePresence mode="wait">
                  {scrapedPhotos[currentScrapedPhotoIndex] ? (
                    <motion.img
                      key={`scraped-${currentScrapedPhotoIndex}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      src={URL.createObjectURL(scrapedPhotos[currentScrapedPhotoIndex].file)}
                      alt={scrapedPhotos[currentScrapedPhotoIndex].file.name || `Photo ${currentScrapedPhotoIndex + 1}`}
                      className="w-full h-full object-contain rounded-lg shadow-2xl"
                      style={{
                        transform: `scale(${competitorZoom / 100})`,
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>{t("noScrapedPhotos") || "No scraped photos"}</p>
                    </div>
                  )}
                </AnimatePresence>

                {/* Кнопки масштабирования */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setCompetitorZoom(prev => Math.min(300, prev + 25))}
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-accent"
                    disabled={competitorZoom >= 300}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setCompetitorZoom(prev => Math.max(25, prev - 25))}
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-accent"
                    disabled={competitorZoom <= 25}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setCompetitorZoom(100)}
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-accent"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Кнопки навигации */}
                <AnimatePresence>
                  {isHoveringImage && currentScrapedPhotoIndex > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{ 
                        left: "clamp(0.75rem, 2vw, 1rem)",
                        width: "clamp(3rem, 4vw, 4rem)",
                        height: "clamp(3rem, 4vw, 4rem)"
                      }}
                      className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border z-30 pointer-events-none"
                    >
                      <ChevronLeft style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                    </motion.div>
                  )}

                  {isHoveringImage && currentScrapedPhotoIndex < scrapedPhotos.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      style={{ 
                        right: "clamp(0.75rem, 2vw, 1rem)",
                        width: "clamp(3rem, 4vw, 4rem)",
                        height: "clamp(3rem, 4vw, 4rem)"
                      }}
                      className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border z-30 pointer-events-none"
                    >
                      <ChevronRight style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Photo History Modal */}
        <PhotoHistoryModal
          isOpen={showPhotoHistory}
          onClose={() => setShowPhotoHistory(false)}
          onSelectPhoto={handleSelectFromHistory}
          userPhotos={[]}
          isLoading={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ 
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)'
    }}>
      {/* ЗМЕЙКА НА ВСЮ СТРАНИЦУ */}
      <SnakeGame />

      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          {/* Кнопка возврата в Studio, если есть фотографии */}
          {!isCheckingPhotos && hasPhotos && (
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              onClick={() => navigate('/studio')}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mb-6 w-full font-medium")}
              style={{ 
                height: "clamp(2.5rem, 4vh, 3rem)",
                fontSize: "clamp(0.875rem, 1.2vw, 1rem)"
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <ArrowLeft style={{ width: "clamp(1rem, 1.5vw, 1.25rem)", height: "clamp(1rem, 1.5vw, 1.25rem)" }} />
                <span>{t("backToStudio")}</span>
              </div>
            </motion.button>
          )}
          
          <h1 className="text-4xl font-bold mb-8 text-foreground">
            {t("importAds")} 🚀✨
          </h1>
          
          <Input
            type="text"
            placeholder="https://facebook.com/ads/library/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              const pastedText = e.clipboardData.getData('text/plain');
              // Разбиваем на строки и извлекаем первый валидный URL
              const lines = pastedText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
              // Ищем первую строку, которая выглядит как URL
              const urlPattern = /^https?:\/\/.+/i;
              const foundUrl = lines.find(line => urlPattern.test(line));
              // Если нашли URL, используем его, иначе берем первую непустую строку
              const cleanedUrl = foundUrl || lines[0] || pastedText.trim();
              setUrl(cleanedUrl);
            }}
            className="h-14 text-base mb-6 bg-card border-border text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          />
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">{t("or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Select
            value={url || undefined}
            onValueChange={async (value) => {
              if (value && value !== "none") {
                setUrl(value);
                // Автоматически загружаем фотографии для выбранной ссылки
                const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
                if (!isDemoUserLocal && user) {
                  // Навигируем в Studio с выбранной ссылкой
                  navigate('/studio', {
                    state: {
                      selectedUrl: value
                    }
                  });
                }
              }
            }}
          >
            <SelectTrigger className="h-12 mb-6 bg-card border-border text-foreground">
              <SelectValue placeholder={t("chooseFromHistory") || "Choose from history"} />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {isLoadingHistory ? (
                <SelectItem value="loading" disabled className="text-foreground">
                  {t("loading") || "Loading..."}
                </SelectItem>
              ) : urlHistory.length === 0 ? (
                <SelectItem value="none" className="text-foreground">
                  {t("noPreviousImports") || "No previous imports"}
                </SelectItem>
              ) : (
                urlHistory.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.source_url}
                    className="text-foreground relative"
                    onMouseEnter={(e) => {
                      if (item.first_photo) {
                        setHoveredUrlId(item.id);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;
                        const popupWidth = 320; // max-w-xs = 20rem = 320px
                        const popupHeight = 300; // approximate height
                        
                        // Позиционируем справа от элемента, если есть место
                        let x = rect.right + 10;
                        let y = rect.top;
                        
                        // Если не помещается справа, показываем слева
                        if (x + popupWidth > viewportWidth) {
                          x = rect.left - popupWidth - 10;
                        }
                        
                        // Если не помещается снизу, сдвигаем вверх
                        if (y + popupHeight > viewportHeight) {
                          y = viewportHeight - popupHeight - 10;
                        }
                        
                        // Если не помещается сверху, показываем снизу
                        if (y < 0) {
                          y = rect.bottom + 10;
                        }
                        
                        setHoverPosition({ x, y });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredUrlId(null);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="truncate flex-1">{item.source_url}</span>
                      {item.first_photo && (
                        <span className="text-xs text-muted-foreground">📷</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Всплывающее окно с фотографией при наведении */}
          <AnimatePresence>
            {hoveredUrlId && (() => {
              const item = urlHistory.find(i => i.id === hoveredUrlId);
              if (!item?.first_photo) return null;
              
              return (
                <motion.div
                  key={hoveredUrlId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'fixed',
                    left: `${hoverPosition.x}px`,
                    top: `${hoverPosition.y}px`,
                    zIndex: 1000,
                    pointerEvents: 'none'
                  }}
                  className="bg-card border border-border rounded-lg shadow-xl p-2 max-w-xs"
                >
                  <img
                    src={item.first_photo.storage_url}
                    alt={item.first_photo.file_name || "Scraped photo"}
                    className="w-full h-auto rounded object-cover max-h-64"
                  />
                  {item.first_photo.file_name && (
                    <p className="text-xs text-muted-foreground mt-2 truncate">
                      {item.first_photo.file_name}
                    </p>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>

          <motion.button
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full h-14 text-base font-medium relative overflow-visible mb-4")}
            onClick={handleImport}
            disabled={!url}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-center gap-2 w-full">
              <motion.div
                style={{ display: 'inline-flex', willChange: 'transform' }}
                animate={{
                  rotate: 360
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              >
                <LinkIcon className="w-5 h-5" />
              </motion.div>
              <motion.span
                style={{ display: 'inline-block', willChange: 'opacity' }}
                animate={{
                  opacity: [1, 0.8, 1]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                {t("import")}
              </motion.span>
            </div>
          </motion.button>

          {/* Кнопка для открытия истории фотографий */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowPhotoHistory(true)}
            className="w-full h-14 text-base font-medium"
          >
            <History className="w-5 h-5 mr-2" />
            {t("photoHistory") || "Photo History"}
          </Button>
        </motion.div>
      </main>

      {/* Photo History Modal */}
      <PhotoHistoryModal
        isOpen={showPhotoHistory}
        onClose={() => setShowPhotoHistory(false)}
        onSelectPhoto={handleSelectFromHistory}
        userPhotos={[]}
        isLoading={false}
      />
    </div>
  );
};

export default StudioEmpty;

