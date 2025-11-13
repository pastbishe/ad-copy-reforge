import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SnakeGame } from "@/components/SnakeGame";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  savePhotoImport,
  updatePhotoImport,
  getCompetitorPhotos,
  startScrapingJobSimple,
  getUserCompetitorPhotos,
  getUnprocessedCompletedPhotoImports,
  getUrlHistory,
  waitForScrapeJobCompletion,
  checkAndUpdateScrapeJobStatus,
  type UrlHistoryItem
} from "@/lib/scrapingUtils";
import { handleNetworkError } from "@/lib/networkUtils";
import { getUserPhotos } from "@/lib/imageUtils";
import { ArrowLeft } from "lucide-react";

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
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // URL webhook n8n для импорта ссылки рекламы конкурента
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_SCRAPING_WEBHOOK_URL || '';

  // Функция для загрузки фотографий конкурентов из задания скрапинга
  const loadCompetitorPhotosForJob = async (jobId: string) => {
    try {
      // Проверяем и обновляем статус задания
      let status: 'running' | 'done' | 'error';
      try {
        status = await checkAndUpdateScrapeJobStatus(jobId);
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
        let finalStatus: 'done' | 'error';
        try {
          finalStatus = await waitForScrapeJobCompletion(jobId, {
            maxAttempts: 60, // До 3 минут (60 * 3 секунды)
            delay: 3000, // Проверяем каждые 3 секунды
            onProgress: (attempt, maxAttempts) => {
              const progressPercent = 50 + Math.floor((attempt / maxAttempts) * 40); // От 50% до 90%
              setProgress(progressPercent);
            }
          });
        } catch (waitError) {
          console.error('Ошибка ожидания завершения задания:', waitError);
          finalStatus = 'error';
        }
        
        if (finalStatus === 'error') {
          toast({
            title: t("error") || "Ошибка",
            description: t("scrapingError") || "Произошла ошибка при скрапинге",
            variant: "destructive",
          });
          setIsLoading(false);
          setProgress(0);
          return;
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
      
      // После завершения проверяем фотографии
      let photos;
      try {
        photos = await getCompetitorPhotos(jobId);
      } catch (photosError) {
        console.error('Ошибка получения фотографий:', photosError);
        toast({
          title: t("error") || "Ошибка",
          description: "Не удалось загрузить фотографии конкурентов",
          variant: "destructive",
        });
        setIsLoading(false);
        setProgress(0);
        return;
      }
      
      if (photos.length > 0) {
        toast({
          title: t("success"),
          description: `${t("successfullyScraped")} ${photos.length} ${t("competitorAdsCount")}`,
        });
        // Редиректим на /studio после успешной загрузки
        setProgress(100);
        navigate('/studio', { 
          state: { 
            scrapeJobId: jobId,
            autoLoaded: true
          } 
        });
      } else {
        toast({
          title: t("warning"),
          description: "Фотографии еще не загружены. Пожалуйста, подождите.",
        });
        setIsLoading(false);
        setProgress(0);
      }
    } catch (error) {
      console.error('Ошибка загрузки фотографий задания:', error);
      toast({
        title: t("error"),
        description: "Не удалось загрузить фотографии конкурентов",
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

      // Сохраняем запись об импорте в таблицу photos
      const photoId = await savePhotoImport(userId, url, 'pending');

      // Запускаем скрапинг через упрощенный webhook
      const job = await startScrapingJobSimple(url, userId, N8N_WEBHOOK_URL);
      
      // Обновляем запись в photos с operation_id и статусом processing
      await updatePhotoImport(photoId, 'processing', job.id);
      
      // Обновляем прогресс
      setProgress(50);
      
      toast({
        title: t("scrapingStarted") || "Скрапинг запущен!",
        description: t("scrapingStartedDesc") || "Мы собираем рекламы конкурентов. Это может занять несколько минут.",
      });

      // Загружаем фотографии из задания скрапинга
      // Функция loadCompetitorPhotosForJob будет ждать завершения задания и проверять статус
      await loadCompetitorPhotosForJob(job.id);
      
      // Обновляем статус записи в photos на completed только после успешного завершения
      // (loadCompetitorPhotosForJob уже проверила, что задание завершено и есть фотографии)
      await updatePhotoImport(photoId, 'completed');
      
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
            onValueChange={(value) => {
              if (value && value !== "none") {
                setUrl(value);
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
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full h-14 text-base font-medium relative overflow-visible")}
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
        </motion.div>
      </main>
    </div>
  );
};

export default StudioEmpty;

