import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LogOut, ChevronLeft, ChevronRight, Plus, X, Menu, User, Flame, Moon, History, Upload, Trash2, ZoomIn, ZoomOut, RotateCcw, Link as LinkIcon } from "lucide-react";
import { SnakeGame } from "@/components/SnakeGame";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { AnimatedSlider } from "@/components/AnimatedSlider";
import { PhotoHistoryModal, type PhotoHistoryItem } from "@/components/PhotoHistoryModal";
import { DEFAULT_SLIDER_ANIMATION } from "@/config/sliderAnimations";

// Ленивая загрузка тяжелого компонента ColorBends
const ColorBends = lazy(() => import("@/components/ColorBends"));
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { 
  compressImage, 
  validateImageQuality, 
  uploadImageToSupabase, 
  savePhotoToDatabase,
  getUserPhotos,
  fetchImageWithRetry,
  type CompressedImage,
  type ImageValidationResult 
} from "@/lib/imageUtils";
import { 
  getScrapeJob,
  startScrapingJobSimple,
  savePhotoImport,
  updatePhotoImport,
  getUrlHistory,
  generateOperationNumber,
  deleteCompetitorPhoto,
  waitForScrapeJobCompletion,
  checkAndUpdateScrapeJobStatus,
  getUserCompetitorPhotos,
  getCompletedPhotoImports,
  type UrlHistoryItem
} from "@/lib/scrapingUtils";
import { 
  checkExistingGeneration,
  createGenerationRecord,
  startGeneration,
  createScrapedPhotoId,
  getUserPhotoUrl,
  type GenerationRequest
} from "@/lib/generationUtils";
import { GenerationProgress } from "@/components/GenerationProgress";
type StudioState = "empty" | "loading" | "active";


// Тип для хранения фотографии с ID из базы данных
type ScrapedPhotoWithId = {
  file: File;
  url?: string; // Оригинальный URL фотографии из Storage (для использования в Edge Function)
  dbId?: number; // ID из таблицы competitor_photos
  source?: 'competitor' | 'user' | 'upload'; // Источник фотографии
};

// Функция для извлечения чистого имени файла из URL или file_name
const getCleanFileName = (fileNameOrUrl: string | undefined | null): string => {
  if (!fileNameOrUrl) return "";
  
  try {
    // Если это URL, извлекаем имя файла
    if (fileNameOrUrl.includes('http://') || fileNameOrUrl.includes('https://')) {
      const url = new URL(fileNameOrUrl);
      const pathname = url.pathname;
      // Извлекаем имя файла из пути
      const fileName = pathname.split('/').pop() || '';
      // Убираем query параметры если они есть в имени файла
      return fileName.split('?')[0];
    }
    
    // Если это уже имя файла, но содержит query параметры
    if (fileNameOrUrl.includes('?')) {
      return fileNameOrUrl.split('?')[0];
    }
    
    return fileNameOrUrl;
  } catch (error) {
    // Если не удалось распарсить как URL, просто убираем query параметры
    return fileNameOrUrl.split('?')[0];
  }
};

const Studio = () => {
  const [url, setUrl] = useState("");
  const [studioState, setStudioState] = useState<StudioState>("empty");
  const [progress, setProgress] = useState(0);
  const [currentUserPhotoIndex, setCurrentUserPhotoIndex] = useState(0);
  const [currentScrapedPhotoIndex, setCurrentScrapedPhotoIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState<'competitor' | 'split'>('competitor');
  const [competitorZoom, setCompetitorZoom] = useState(100);
  const [userPhotoZoom, setUserPhotoZoom] = useState(100);
  const [userPhotoPrompts, setUserPhotoPrompts] = useState<Record<number, string>>({});
  const [userPhotoSettings, setUserPhotoSettings] = useState<Record<number, { brightness: number; contrast: number; saturation: number }>>({});
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const [uploadedProducts, setUploadedProducts] = useState<File[]>([]);
  const [scrapedPhotos, setScrapedPhotos] = useState<ScrapedPhotoWithId[]>([]); // Photos from scraping (left side)
  const [selectedScrapedPhotos, setSelectedScrapedPhotos] = useState<Set<number>>(new Set()); // Selected photo indices
  const [selectedUserPhotos, setSelectedUserPhotos] = useState<Set<string>>(new Set()); // Selected user photo IDs
  const [userPhotos, setUserPhotos] = useState<PhotoHistoryItem[]>([]);
  const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'completed'>('idle');
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [generatedResults, setGeneratedResults] = useState<string[]>([]);
  const [promptText, setPromptText] = useState("");
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [isHoveringUserPhoto, setIsHoveringUserPhoto] = useState(false);
  const [isDraggingOverUserPhoto, setIsDraggingOverUserPhoto] = useState(false);
  const [showIndividualPrompt, setShowIndividualPrompt] = useState(false);
  const [showPhotoHistory, setShowPhotoHistory] = useState(false);
  const [showScrapedPhotoHistory, setShowScrapedPhotoHistory] = useState(false);
  const [scrapedPhotoHistory, setScrapedPhotoHistory] = useState<PhotoHistoryItem[]>([]);
  const [isLoadingScrapedPhotoHistory, setIsLoadingScrapedPhotoHistory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [urlHistory, setUrlHistory] = useState<UrlHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hoveredUrlId, setHoveredUrlId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null); // Текущая выбранная ссылка для фильтрации фотографий
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snakeEnabled, setSnakeEnabled] = useState(() => {
    const saved = localStorage.getItem("snake_enabled");
    return saved === null ? true : saved === "true";
  });

  // Настройка анимации ползунков (можно изменить в будущем)
  const [sliderAnimationType] = useState(DEFAULT_SLIDER_ANIMATION);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLeftImageHidden, setIsLeftImageHidden] = useState(false);
  const [isRightImageHidden, setIsRightImageHidden] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});
  const [imageFallbackUrls, setImageFallbackUrls] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const { user, isDemoUser, signOut } = useAuth();

  const toggleSnake = (checked: boolean) => {
    setSnakeEnabled(checked);
    localStorage.setItem("snake_enabled", String(checked));
    // Не перезагружаем страницу, просто обновляем состояние
  };

  // Создаем список выбранных фотографий для отображения на экране
  // Если выбраны фотографии - показываем только их, иначе показываем все
  const displayedScrapedPhotos = useMemo(() => {
    if (selectedScrapedPhotos.size === 0) {
      // Если ничего не выбрано, показываем все фотографии
      return scrapedPhotos.map((item, index) => ({ photo: item.file, originalIndex: index, item }));
    }
    // Показываем только выбранные фотографии
    const selectedIndices = Array.from(selectedScrapedPhotos).sort((a, b) => a - b);
    return selectedIndices.map(originalIndex => ({
      photo: scrapedPhotos[originalIndex].file,
      originalIndex,
      item: scrapedPhotos[originalIndex]
    }));
  }, [scrapedPhotos, selectedScrapedPhotos]);

  // Маппинг между индексом в displayedScrapedPhotos и оригинальным индексом
  const getOriginalIndex = useCallback((displayIndex: number): number => {
    return displayedScrapedPhotos[displayIndex]?.originalIndex ?? displayIndex;
  }, [displayedScrapedPhotos]);

  // Фильтруем userPhotos, оставляя только фотографии, загруженные с устройства
  // (URL должен указывать на Supabase Storage)
  const uploadedUserPhotos = useMemo(() => {
    // Все фотографии из user_photos были загружены пользователем с устройства
    // Принимаем все фотографии, которые имеют URL (base64 data URL или Supabase Storage URL)
    return userPhotos.filter(photo => {
      const photoUrl = photo.original_url || photo.compressed_url || '';
      // Принимаем все фотографии с URL - это могут быть:
      // 1. Base64 data URL (data:image/...) - сохранены в БД как base64
      // 2. Supabase Storage URL - сохранены в Storage bucket
      // 3. Любые другие валидные URL
      return photoUrl && photoUrl.length > 0;
    });
  }, [userPhotos]);

  // Загружаем фотографии пользователя при инициализации
  const loadUserPhotos = useCallback(async () => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return;
    
    try {
      setIsLoadingPhotos(true);
      const photos = await getUserPhotos(user.id, 50);
      setUserPhotos(photos);
    } catch (error) {
      console.error('Ошибка загрузки фотографий пользователя:', error);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [user]);

  // ПРОСТОЕ РЕШЕНИЕ: Загружаем фотографии напрямую из таблицы photos
  // Фильтруем по выбранной ссылке (selectedUrl), если она установлена
  const loadPhotosDirectlyFromPhotosTable = useCallback(async (filterUrl?: string | null) => {
    if (!user) {
      console.log('loadPhotosDirectlyFromPhotosTable: пользователь не авторизован');
      return;
    }
    
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal) {
      console.log('loadPhotosDirectlyFromPhotosTable: демо-пользователь, пропускаем');
      return;
    }
    
    try {
      const urlToFilter = filterUrl !== undefined ? filterUrl : selectedUrl;
      console.log('loadPhotosDirectlyFromPhotosTable: начинаем загрузку фотографий, фильтр по URL:', urlToFilter);
      
      // Строим запрос с фильтрацией по URL, если он указан
      // Показываем фотографии со статусом 'completed' или 'processing', если у них есть photo_url
      let query = supabase
        .from('photos')
        .select('id, photo_url, url, created_at, status')
        .eq('user_id', user.id)
        .in('status', ['completed', 'processing'])
        .not('photo_url', 'is', null);
      
      // Если указан URL для фильтрации, фильтруем по нему
      if (urlToFilter) {
        query = query.eq('url', urlToFilter);
      }
      
      // Получаем завершенные импорты с photo_url, отсортированные по дате
      const { data: photos, error } = await query
        .order('created_at', { ascending: false })
        .limit(1); // Берем последний импорт для выбранной ссылки
      
      if (error) {
        console.error('Ошибка загрузки фотографий:', error);
        return;
      }
      
      if (!photos || photos.length === 0) {
        console.log('loadPhotosDirectlyFromPhotosTable: нет завершенных импортов с фотографиями для URL:', urlToFilter);
        // Если нет фотографий для выбранной ссылки, очищаем список
        setScrapedPhotos([]);
        return;
      }
      
      // Берем последний импорт для выбранной ссылки
      const lastImport = photos[0];
      if (!lastImport.photo_url) {
        console.log('loadPhotosDirectlyFromPhotosTable: photo_url пустой');
        return;
      }
      
      // Извлекаем URL фотографий
      const extractPhotoUrls = (photoUrl: string): string[] => {
        if (!photoUrl || photoUrl.trim().length === 0) return [];
        
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
      
      const photoUrls = extractPhotoUrls(lastImport.photo_url);
      const limitedPhotoUrls = photoUrls.slice(0, 15);
      
      if (limitedPhotoUrls.length === 0) {
        console.log('loadPhotosDirectlyFromPhotosTable: не удалось извлечь URL фотографий');
        return;
      }
      
      console.log('loadPhotosDirectlyFromPhotosTable: найдено фотографий:', limitedPhotoUrls.length);
      
      // Скачиваем фотографии и показываем их напрямую
      const photoFiles: ScrapedPhotoWithId[] = [];
      
      for (const photoUrl of limitedPhotoUrls) {
        try {
          console.log('loadPhotosDirectlyFromPhotosTable: скачиваем фотографию:', photoUrl);
          
          const response = await fetch(photoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            console.error(`Ошибка загрузки ${photoUrl}: ${response.status}`);
            continue;
          }
          
          const blob = await response.blob();
          const fileName = photoUrl.split('/').pop() || `photo-${Date.now()}.jpg`;
          const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          
          photoFiles.push({
            file,
            source: 'competitor'
          });
        } catch (error) {
          console.error(`Ошибка обработки ${photoUrl}:`, error);
        }
      }
      
      if (photoFiles.length > 0) {
        console.log('loadPhotosDirectlyFromPhotosTable: успешно загружено фотографий:', photoFiles.length);
        setScrapedPhotos(photoFiles);
        setStudioState('active');
        setDisplayMode('competitor');
        setCurrentScrapedPhotoIndex(0);
        
        toast({
          title: t("success") || "Успешно",
          description: `Загружено ${photoFiles.length} фотографий`,
        });
      } else {
        console.log('loadPhotosDirectlyFromPhotosTable: не удалось загрузить ни одной фотографии');
      }
    } catch (error) {
      console.error('Ошибка загрузки фотографий из photos таблицы:', error);
    }
  }, [user, toast, t, selectedUrl]);

  // Функция для скачивания фотографий по URL и добавления в студию
  const downloadAndAddPhotosToStudio = async (photoUrls: string[]) => {
    if (!user) {
      console.log('downloadAndAddPhotosToStudio: пользователь не авторизован');
      return;
    }
    
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal) {
      console.log('downloadAndAddPhotosToStudio: демо-пользователь, пропускаем');
      return;
    }

    console.log('downloadAndAddPhotosToStudio: начинаем обработку', photoUrls.length, 'URL');
    const processedFiles: File[] = [];
    const errors: string[] = [];
    const skipped: string[] = [];

    for (const photoUrl of photoUrls) {
      try {
        console.log('downloadAndAddPhotosToStudio: обработка URL:', photoUrl);
        
        // Проверяем, не была ли уже загружена эта фотография
        const alreadyProcessed = await isPhotoUrlAlreadyProcessed(user.id, photoUrl);
        if (alreadyProcessed) {
          console.log(`downloadAndAddPhotosToStudio: фотография уже была загружена, пропускаем: ${photoUrl}`);
          skipped.push(photoUrl);
          continue;
        }

        console.log('downloadAndAddPhotosToStudio: скачиваем изображение:', photoUrl);
        
        // Проверяем, что URL валидный
        if (!photoUrl || !photoUrl.startsWith('http')) {
          console.error('downloadAndAddPhotosToStudio: невалидный URL:', photoUrl);
          errors.push(`${photoUrl}: Невалидный URL`);
          continue;
        }
        
        // Скачиваем изображение с таймаутом и повторными попытками
        const response = await fetchImageWithRetry(photoUrl, {
          timeout: 60000, // 60 секунд для внешних URL (может быть медленнее)
          maxRetries: 3,
          retryDelay: 2000 // 2 секунды между попытками для внешних URL
        });
        
        console.log('downloadAndAddPhotosToStudio: изображение скачано, размер:', response.headers.get('content-length'));

        const blob = await response.blob();
        const contentType = blob.type || 'image/jpeg';
        const fileName = photoUrl.split('/').pop() || `photo-${Date.now()}.jpg`;
        
        // Создаем File объект из blob
        const file = new File([blob], fileName, { type: contentType });

        // Валидация качества изображения
        const validation = await validateImageQuality(file);
        
        if (!validation.isValid) {
          console.warn(`Предупреждение для ${fileName}:`, validation.issues.join(', '));
        }

        // Сжатие изображения
        const compressed = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.7,
          maxFileSize: 10 * 1024 * 1024 // 10MB
        });

        // Загрузка в таблицу (создает запись с оригиналом)
        const originalResult = await uploadImageToSupabase(
          compressed.originalFile,
          'user-photos',
          'originals',
          user.id
        );
        const originalUrl = originalResult.url;

        // Обновляем запись сжатым файлом, если есть ID
        let compressedUrl = originalUrl;
        if (originalResult.id) {
          const compressedResult = await uploadImageToSupabase(
            compressed.file,
            'user-photos',
            'compressed',
            user.id,
            originalResult.id
          );
          compressedUrl = compressedResult.url;

          // Обновляем запись с метаданными
          const { supabase } = await import('@/integrations/supabase/client');
          await supabase
            .from('user_photos')
            .update({
              width: validation.dimensions.width,
              height: validation.dimensions.height,
              quality_score: validation.qualityScore,
              is_valid: validation.isValid
            })
            .eq('id', originalResult.id)
            .eq('user_id', user.id);
        }

        // Добавляем файл в студию
        processedFiles.push(compressed.file);
      } catch (error) {
        console.error(`Ошибка обработки фотографии ${photoUrl}:`, error);
        errors.push(`${photoUrl}: ${error instanceof Error ? error.message : 'Ошибка обработки'}`);
      }
    }

    // Добавляем обработанные файлы в студию (scraped photos go to left side)
    console.log('downloadAndAddPhotosToStudio: обработано файлов:', processedFiles.length);
    console.log('downloadAndAddPhotosToStudio: пропущено (уже загружено):', skipped.length);
    console.log('downloadAndAddPhotosToStudio: ошибок:', errors.length);
    
    if (errors.length > 0) {
      console.error('downloadAndAddPhotosToStudio: ошибки:', errors);
    }
    
    if (processedFiles.length > 0) {
      console.log('downloadAndAddPhotosToStudio: добавляем', processedFiles.length, 'файлов в scrapedPhotos');
      setScrapedPhotos(prev => {
        const newPhotos: ScrapedPhotoWithId[] = processedFiles.map(file => ({
          file,
          source: 'upload'
        }));
        const updated = [...prev, ...newPhotos];
        console.log('downloadAndAddPhotosToStudio: всего фотографий в scrapedPhotos:', updated.length);
        
        // Переключаемся в режим разделенного экрана при загрузке скрапленных фотографий
        if (prev.length === 0 && (uploadedProducts.length > 0 || uploadedUserPhotos.length > 0)) {
          setDisplayMode('split');
          setCurrentScrapedPhotoIndex(0);
        }
        
        // Переводим студию в активное состояние, если есть загруженные фотографии
        // (состояние также устанавливается в processCompletedPhotoImports, но это дополнительная проверка)
        if (newPhotos.length > 0) {
          setStudioState(prev => prev !== "active" ? "active" : prev);
        }
        
        return newPhotos;
      });
    } else {
      console.log('downloadAndAddPhotosToStudio: нет файлов для добавления в студию');
    }
    
    // Обновляем список фотографий пользователя
    await loadUserPhotos();
    
    const successMessage = processedFiles.length > 0 
      ? `${t("successfullyUploaded") || "Успешно загружено"} ${processedFiles.length} ${t("files") || "файлов"}`
      : '';
    const skippedMessage = skipped.length > 0
      ? `${skipped.length} ${t("alreadyExists") || "уже были загружены ранее"}`
      : '';
    
    const description = [successMessage, skippedMessage].filter(Boolean).join('. ');
    
    if (description) {
      toast({
        title: t("uploadComplete"),
        description: description,
      });
    }
    
    if (errors.length > 0) {
      toast({
        title: t("uploadWarning"),
        description: `${t("someFilesFailed")}: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`,
        variant: "destructive",
      });
    }
  };

  // URL webhook n8n для импорта ссылки рекламы конкурента
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_SCRAPING_WEBHOOK_URL || '';

  // Функция для ожидания и загрузки фотографий из таблицы photos
  // Использует real-time подписку для мгновенной реакции на появление записи со статусом completed
  // Фильтрует фотографии по выбранной ссылке (selectedUrl)
  const waitAndLoadPhotosFromPhotosTable = async (photoId: string, importUrl: string, timeout: number = 180000) => {
    // 3 минуты таймаут (180000 мс)
    const initialDelay = 2000; // 2 секунды перед подпиской (даем N8N время начать обработку)
    
    if (!user) {
      console.error('waitAndLoadPhotosFromPhotosTable: пользователь не авторизован');
      return false;
    }
    
    // Ждем перед подпиской, чтобы дать N8N время начать обработку
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    setProgress(55); // Обновляем прогресс после начальной задержки
    
    // Функция для извлечения URL из photo_url (поддерживает запятую, JSON массив, одну строку)
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
    
    // Функция для обработки завершенной записи - ПРОСТОЕ РЕШЕНИЕ: показываем фотографии напрямую
    const processCompletedRecord = async (record: { id: string; photo_url: string | null }) => {
      if (!record.photo_url) {
        console.warn('waitAndLoadPhotosFromPhotosTable: запись без photo_url');
        return false;
      }
      
      console.log('waitAndLoadPhotosFromPhotosTable: найдена запись со статусом completed:', record.id);
      console.log('waitAndLoadPhotosFromPhotosTable: photo_url:', record.photo_url);
      
      // Извлекаем URL фотографий
      const photoUrls = extractPhotoUrls(record.photo_url);
      
      // Ограничиваем количество фотографий до 15
      const limitedPhotoUrls = photoUrls.slice(0, 15);
      
      if (limitedPhotoUrls.length > 0) {
        console.log('waitAndLoadPhotosFromPhotosTable: извлечено URL:', photoUrls.length, '(ограничено до', limitedPhotoUrls.length, ')');
        console.log('waitAndLoadPhotosFromPhotosTable: URL:', limitedPhotoUrls);
        
        // ПРОСТОЕ РЕШЕНИЕ: Скачиваем фотографии и показываем их напрямую без обработки
        setProgress(90);
        
        const photoFiles: ScrapedPhotoWithId[] = [];
        
        for (const photoUrl of limitedPhotoUrls) {
          try {
            console.log('Скачиваем фотографию:', photoUrl);
            
            const response = await fetch(photoUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            if (!response.ok) {
              console.error(`Ошибка загрузки ${photoUrl}: ${response.status}`);
              continue;
            }
            
            const blob = await response.blob();
            const fileName = photoUrl.split('/').pop() || `photo-${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
            
            photoFiles.push({
              file,
              source: 'competitor'
            });
          } catch (error) {
            console.error(`Ошибка обработки ${photoUrl}:`, error);
          }
        }
        
        if (photoFiles.length > 0) {
          setScrapedPhotos(photoFiles);
          setStudioState('active');
          setDisplayMode('competitor');
          setCurrentScrapedPhotoIndex(0);
          
          setProgress(100);
          
          toast({
            title: t("adsImported") || "Рекламы импортированы",
            description: `${photoFiles.length} ${t("files") || "файлов"} ${t("successfullyUploaded") || "успешно загружено"}`,
          });
          
          return true;
        } else {
          console.warn('waitAndLoadPhotosFromPhotosTable: не удалось загрузить ни одной фотографии');
          return false;
        }
      } else {
        console.warn('waitAndLoadPhotosFromPhotosTable: не удалось извлечь URL из photo_url');
        return false;
      }
    };
    
    return new Promise<boolean>((resolve) => {
      let isResolved = false;
      let channel: ReturnType<typeof supabase.channel> | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      
      const cleanup = () => {
        if (channel) {
          console.log('waitAndLoadPhotosFromPhotosTable: отписываемся от канала');
          channel.unsubscribe();
          channel = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      const resolveOnce = (value: boolean) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(value);
        }
      };
      
      // Создаем real-time подписку на изменения таблицы photos
      console.log('waitAndLoadPhotosFromPhotosTable: создаем real-time подписку для user_id:', user.id);
      channel = supabase
        .channel(`photos-completed-${photoId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'photos',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('waitAndLoadPhotosFromPhotosTable: получено событие UPDATE:', payload);
            
            const newRecord = payload.new as { id: string; status: string; photo_url: string | null; user_id: string; url?: string };
            
            // Проверяем, что это наша запись с правильным URL
            if (
              newRecord.status === 'completed' &&
              newRecord.photo_url &&
              newRecord.photo_url.trim().length > 0 &&
              newRecord.id === photoId &&
              newRecord.user_id === user.id
            ) {
              // Дополнительно проверяем, что URL записи соответствует импортированной ссылке
              if (newRecord.url && newRecord.url === importUrl) {
                console.log('waitAndLoadPhotosFromPhotosTable: найдена завершенная запись через real-time для URL:', importUrl);
                
                const success = await processCompletedRecord(newRecord);
                resolveOnce(success);
              } else {
                console.log('waitAndLoadPhotosFromPhotosTable: запись не соответствует выбранной ссылке, пропускаем');
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('waitAndLoadPhotosFromPhotosTable: статус подписки:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log('waitAndLoadPhotosFromPhotosTable: подписка активна, ждем обновления...');
            setProgress(60);
            
            // Также проверяем текущее состояние записи (на случай, если она уже completed)
            supabase
              .from('photos')
              .select('id, photo_url, status, url')
              .eq('id', photoId)
              .single()
              .then(({ data, error }) => {
                if (!error && data && data.status === 'completed' && data.photo_url) {
                  // Проверяем, что URL записи соответствует импортированной ссылке
                  if (data.url && data.url === importUrl) {
                    console.log('waitAndLoadPhotosFromPhotosTable: запись уже completed, обрабатываем сразу для URL:', importUrl);
                    processCompletedRecord(data).then(resolveOnce);
                  } else {
                    console.log('waitAndLoadPhotosFromPhotosTable: запись не соответствует выбранной ссылке, пропускаем');
                  }
                }
              });
          }
        });
      
      // Устанавливаем таймаут
      timeoutId = setTimeout(() => {
        console.log('waitAndLoadPhotosFromPhotosTable: таймаут, переводим в активное состояние');
        setProgress(100);
        setStudioState('active');
        toast({
          title: t("warning") || "Предупреждение",
          description: "Фотографии еще не загружены. Они появятся автоматически, когда будут готовы.",
        });
        resolveOnce(false);
      }, timeout);
    });
  };

  // Функция для загрузки истории ссылок
  const loadUrlHistory = useCallback(async () => {
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
  }, [user]);

  // Функция для загрузки фотографий по выбранной ссылке из истории
  const loadPhotosForUrl = useCallback(async (urlToLoad: string) => {
    if (!user) {
      console.log('loadPhotosForUrl: пользователь не авторизован');
      return;
    }
    
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal) {
      console.log('loadPhotosForUrl: демо-пользователь, пропускаем');
      return;
    }
    
    console.log('loadPhotosForUrl: загружаем фотографии для URL:', urlToLoad);
    
    // Устанавливаем выбранную ссылку
    setSelectedUrl(urlToLoad);
    
    // Очищаем старые фотографии
    setScrapedPhotos([]);
    
    // Загружаем фотографии для выбранной ссылки
    await loadPhotosDirectlyFromPhotosTable(urlToLoad);
  }, [user, loadPhotosDirectlyFromPhotosTable]);

  const handleImport = useCallback(async (importUrlParam?: string) => {
    const urlToImport = importUrlParam || url;
    console.log('handleImport вызван, url:', urlToImport);
    console.log('N8N_WEBHOOK_URL:', N8N_WEBHOOK_URL);
    
    if (!urlToImport) {
      console.warn('handleImport: url пустой, выход');
      return;
    }
    
    // Проверяем авторизацию пользователя
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    console.log('isDemoUserLocal:', isDemoUserLocal, 'user:', user);
    
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
      console.log('Используется демо-логика или N8N_WEBHOOK_URL не установлен');
      // Очищаем старые скрапленные фотографии при начале нового импорта
      setScrapedPhotos([]);
      // Устанавливаем выбранную ссылку для фильтрации фотографий
      setSelectedUrl(urlToImport);
      setStudioState("loading");
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
          setPromptText("");
          
          setStudioState("active");
          toast({
            title: t("adsImported"),
            description: t("adsImportedDesc") || "Рекламы импортированы",
          });
        }, 500);
      }, 5000);
      return;
    }

    // Для авторизованных пользователей вызываем вебхук N8N
    console.log('Начинаем импорт для авторизованного пользователя');
    // Очищаем старые скрапленные фотографии при начале нового импорта
    setScrapedPhotos([]);
    // Устанавливаем выбранную ссылку для фильтрации фотографий
    setSelectedUrl(urlToImport);
    setIsLoadingPhotos(true);
    setStudioState("loading");
    setProgress(0);
    
    try {
      const userId = user?.id;
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }

      // Генерируем уникальный номер операции (читаемый формат для n8n)
      const operationNumber = generateOperationNumber();
      console.log('Сгенерирован номер операции:', operationNumber);

      // ВАЖНО: Сначала создаем запись в photos ДО вызова вебхука
      // Это нужно, чтобы n8n мог обновить эту запись после скрапинга
      // Создаем временную запись с operationNumber, которую n8n сможет найти и обновить
      let photoId: string;
      try {
        // Создаем запись с operationNumber в качестве временного идентификатора
        // n8n должен использовать operationNumber для поиска и обновления этой записи
        const { data: tempPhoto, error: tempError } = await supabase
          .from('photos')
          .insert({
            user_id: userId,
            url: urlToImport,
            photo_url: null,
            status: 'pending',
            // Временно сохраняем operationNumber в operation_id (n8n должен его использовать)
            // После получения job.id обновим operation_id
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
      console.log('Отправляем запрос на вебхук:', N8N_WEBHOOK_URL);
      setProgress(20);
      
      // Запускаем скрапинг через упрощенный webhook с номером операции и photoId
      const job = await startScrapingJobSimple(urlToImport, userId, N8N_WEBHOOK_URL, operationNumber, photoId);
      console.log('Вебхук ответил, job:', job);
      console.log('Job ID (будет использован как operation_id):', job.id);
      
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
      
      // Обновляем прогресс после получения ответа от вебхука
      setProgress(40);
      
      // Обновляем прогресс
      setProgress(50);
      
      toast({
        title: t("scrapingStarted") || "Скрапинг запущен!",
        description: t("scrapingStartedDesc") || "Мы собираем рекламы конкурентов. Это может занять несколько минут.",
      });

      // Ждем, пока N8N обновит таблицу photos с photo_url
      // N8N должен обновить запись, установив photo_url и status = 'completed'
      // Передаем URL для фильтрации фотографий
      await waitAndLoadPhotosFromPhotosTable(photoId, urlToImport);
      
      // Обновляем прогресс до 100%
      setProgress(100);
      
      // Обновляем историю ссылок после успешного импорта
      await loadUrlHistory();
      
      // Добавляем небольшую задержку, чтобы пользователь увидел завершение загрузки
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Состояние уже установлено в waitAndLoadPhotosFromPhotosTable
      
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
            .eq('url', urlToImport)
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
      
      setStudioState("empty");
      
      // Получаем понятное сообщение об ошибке
      const { handleNetworkError } = await import("@/lib/networkUtils");
      const { message: userMessage } = handleNetworkError(error);
      
      toast({
        title: t("error") || "Ошибка",
        description: userMessage || (error instanceof Error ? error.message : t("scrapingError") || "Не удалось запустить скрапинг"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [url, user, toast, t, N8N_WEBHOOK_URL, setStudioState, setProgress, setPromptText, setIsLoadingPhotos, supabase, navigate, loadUrlHistory]);

  // Проверяем, есть ли URL конкурента или scrapeJobId в состоянии навигации
  useEffect(() => {
    const competitorUrl = location.state?.competitorUrl;
    const scrapeJobId = location.state?.scrapeJobId;
    const autoLoaded = location.state?.autoLoaded;
    const hasCompletedImports = location.state?.hasCompletedImports;
    const selectedUrlFromState = location.state?.selectedUrl;
    
    if (competitorUrl) {
      setUrl(competitorUrl);
      // Автоматически запускаем импорт
      setTimeout(() => {
        handleImport(competitorUrl);
      }, 500);
    }
    
    // Если выбрана ссылка из истории, загружаем фотографии для неё
    if (selectedUrlFromState && user) {
      console.log('Studio: загружаем фотографии для выбранной ссылки из истории:', selectedUrlFromState);
      loadPhotosForUrl(selectedUrlFromState);
      // Очищаем состояние навигации, чтобы не обрабатывать повторно
      navigate(location.pathname, { replace: true, state: {} });
    }
    
    // Убрали логику работы с scrape_jobs, так как используем только таблицу photos
    
    // Если фотографии были автоматически загружены, загружаем их из таблицы photos
    if (autoLoaded && user && !selectedUrlFromState) {
      // Загружаем фотографии напрямую из таблицы photos
      loadPhotosDirectlyFromPhotosTable();
      // Очищаем состояние навигации, чтобы не обрабатывать повторно
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, user, handleImport, navigate, loadPhotosDirectlyFromPhotosTable, loadPhotosForUrl]);

  // Обработка импорта из query string (когда переходим с параметром import)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const importUrlParam = searchParams.get("import");
    
    if (importUrlParam) {
      setUrl(importUrlParam);
      // Устанавливаем состояние empty, чтобы показать форму импорта
      setStudioState("empty");
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
          handleImport(importUrl);
        }, 100);
      }
    };

    window.addEventListener("import-link", handleImportEvent as EventListener);
    
    return () => {
      window.removeEventListener("import-link", handleImportEvent as EventListener);
    };
  }, [handleImport]);

  // Загружаем фотографии пользователя при инициализации
  useEffect(() => {
    if (user) {
      loadUserPhotos();
    }
  }, [user, loadUserPhotos]);

  // Проверяем наличие фотографий конкурентов при загрузке Studio
  // Вся обработка импортов происходит на странице StudioEmpty, здесь только проверяем состояние
  useEffect(() => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return;
    
    // Просто проверяем, есть ли фотографии в scrapedPhotos
    if (scrapedPhotos.length > 0) {
      setStudioState("active");
    } else {
      setStudioState("empty");
    }
  }, [user, scrapedPhotos.length]);

  // Загружаем скрапленные фотографии из таблицы photos при инициализации
  // Используем тот же источник данных, что и для истории
  const loadScrapedPhotosFromDatabase = useCallback(async () => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return;
    
    try {
      console.log('loadScrapedPhotosFromDatabase: начинаем загрузку скрапленных фотографий');
      
      // Получаем все завершенные импорты из таблицы photos (как в loadScrapedPhotoHistory)
      const completedImports = await getCompletedPhotoImports(user.id);
      
      if (!completedImports || completedImports.length === 0) {
        console.log('loadScrapedPhotosFromDatabase: нет завершенных импортов');
        return;
      }
      
      // Извлекаем все URL фотографий из всех импортов
      const allPhotoUrls: string[] = [];
      
      for (const importItem of completedImports) {
        if (!importItem.photo_url) continue;
        
        // Извлекаем URL фотографий (может быть строка, JSON массив или разделенные запятыми)
        let photoUrls: string[] = [];
        
        try {
          const parsed = JSON.parse(importItem.photo_url);
          if (Array.isArray(parsed)) {
            photoUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0);
          } else if (typeof parsed === 'string') {
            photoUrls = [parsed.trim()];
          }
        } catch {
          // Если не JSON, проверяем, разделены ли URL запятыми
          const urls = importItem.photo_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
          if (urls.length > 0) {
            photoUrls = urls;
          } else {
            photoUrls = [importItem.photo_url.trim()];
          }
        }
        
        allPhotoUrls.push(...photoUrls);
      }
      
      // Берем последние 15 фотографий
      const limitedPhotoUrls = allPhotoUrls.slice(0, 15);
      
      if (limitedPhotoUrls.length === 0) {
        console.log('loadScrapedPhotosFromDatabase: не удалось извлечь URL фотографий');
        return;
      }
      
      console.log('loadScrapedPhotosFromDatabase: найдено фотографий:', limitedPhotoUrls.length);
      
      // Преобразуем URL в File объекты
      const photoFiles: ScrapedPhotoWithId[] = [];
      
      for (const photoUrl of limitedPhotoUrls) {
        try {
          console.log('loadScrapedPhotosFromDatabase: скачиваем фотографию:', photoUrl);
          
          const response = await fetch(photoUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            console.error(`Ошибка загрузки ${photoUrl}: ${response.status}`);
            continue;
          }
          
          const blob = await response.blob();
          const fileName = photoUrl.split('/').pop() || `photo-${Date.now()}.jpg`;
          const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          
          photoFiles.push({
            file,
            url: photoUrl, // Сохраняем оригинальный URL для использования в Edge Function
            source: 'competitor'
          });
        } catch (error) {
          console.error(`Ошибка обработки фотографии ${photoUrl}:`, error);
        }
      }
      
      if (photoFiles.length > 0) {
        console.log('loadScrapedPhotosFromDatabase: загружено фотографий:', photoFiles.length);
        setScrapedPhotos(photoFiles);
        setCurrentScrapedPhotoIndex(0);
        // Если есть скрапленные фотографии, переключаемся в активное состояние
        setStudioState(prev => prev === 'empty' ? 'active' : prev);
      }
    } catch (error) {
      console.error('Ошибка загрузки скрапленных фотографий:', error);
    }
  }, [user]);

  // Загружаем фотографии пользователя при изменении пользователя
  useEffect(() => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (user && !isDemoUserLocal) {
      loadUserPhotos();
      // Загружаем скрапленные фотографии при входе пользователя только если их еще нет
      // Это предотвращает перезагрузку при каждом изменении user
      if (scrapedPhotos.length === 0) {
        loadScrapedPhotosFromDatabase();
      }
    }
  }, [user, loadScrapedPhotosFromDatabase, scrapedPhotos.length]);

  // Автоматически переключаемся в режим split и активируем студию, если есть загруженные фотографии пользователя
  useEffect(() => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return;

    const totalUserPhotos = uploadedProducts.length + uploadedUserPhotos.length;
    
    if (totalUserPhotos > 0) {
      // Если есть загруженные фотографии пользователя, переключаемся в режим split
      if (displayMode !== 'split') {
        setDisplayMode('split');
      }
      
      // Активируем студию, если она еще не активна
      if (studioState !== 'active') {
        setStudioState('active');
      }
      
      // Показываем правую панель, если она скрыта
      if (!isRightPanelVisible) {
        setIsRightPanelVisible(true);
      }
      
      // Устанавливаем индекс на первую фотографию, если текущий индекс невалиден
      if (currentUserPhotoIndex >= totalUserPhotos) {
        setCurrentUserPhotoIndex(0);
      }
    }
  }, [uploadedProducts.length, uploadedUserPhotos.length, user, displayMode, studioState, currentUserPhotoIndex, isRightPanelVisible]);

  // Загружаем историю ссылок при загрузке компонента
  useEffect(() => {
    loadUrlHistory();
  }, [loadUrlHistory]);



  // Загрузка из localStorage
  useEffect(() => {
    if (studioState === "active") {
      const savedGeneralPrompt = localStorage.getItem("studio_general_prompt");
      
      if (savedGeneralPrompt) {
        setPromptText(savedGeneralPrompt);
      }
    }
  }, [studioState]);

  // Сохранение общего промпта
  useEffect(() => {
    if (studioState === "active") {
      localStorage.setItem("studio_general_prompt", promptText);
    }
  }, [promptText, studioState]);

  const updateUserPhotoPrompt = (photoIndex: number, prompt: string) => {
    setUserPhotoPrompts(prev => ({ ...prev, [photoIndex]: prompt }));
  };

  const updateUserPhotoSettings = (photoIndex: number, setting: 'brightness' | 'contrast' | 'saturation', value: number) => {
    setUserPhotoSettings(prev => ({
      ...prev,
      [photoIndex]: {
        ...prev[photoIndex],
        brightness: 100,
        contrast: 100,
        saturation: 100,
        [setting]: value
      }
    }));
  };

  // Обработка ошибок загрузки изображений
  const handleImageError = (photoId: string, photo: PhotoHistoryItem, event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = event.currentTarget;
    const currentSrc = img.src;
    const fallbackUrl = imageFallbackUrls[photoId];
    
    // Если уже пытались загрузить original_url, помечаем как ошибку
    if (fallbackUrl === photo.original_url || (currentSrc.includes(photo.original_url || '') && photo.original_url)) {
      console.error(`Ошибка загрузки изображения ${photoId}: не удалось загрузить ни compressed_url, ни original_url`);
      setImageLoadErrors(prev => ({ ...prev, [photoId]: true }));
      toast({
        title: t("imageLoadError") || "Ошибка загрузки изображения",
        description: t("imageLoadErrorDesc") || "Не удалось загрузить изображение. Возможно, ссылка устарела или недоступна.",
        variant: "destructive",
      });
      return;
    }
    
    // Если compressed_url не загрузился, пробуем original_url
    const compressedUrl = photo.compressed_url || '';
    const originalUrl = photo.original_url || '';
    
    if (originalUrl && originalUrl !== compressedUrl && 
        (currentSrc.includes(compressedUrl) || !fallbackUrl)) {
      console.log(`Пробуем загрузить original_url для изображения ${photoId}`);
      setImageFallbackUrls(prev => ({ ...prev, [photoId]: originalUrl }));
      img.src = originalUrl;
    } else {
      // Если original_url тоже не загрузился или его нет, помечаем как ошибку
      console.error(`Ошибка загрузки изображения ${photoId}`);
      setImageLoadErrors(prev => ({ ...prev, [photoId]: true }));
      toast({
        title: t("imageLoadError") || "Ошибка загрузки изображения",
        description: t("imageLoadErrorDesc") || "Не удалось загрузить изображение. Возможно, ссылка устарела или недоступна.",
        variant: "destructive",
      });
    }
  };

  // Получение URL изображения с учетом fallback
  const getImageUrl = (photo: PhotoHistoryItem): string => {
    const fallbackUrl = imageFallbackUrls[photo.id];
    if (fallbackUrl) {
      return fallbackUrl;
    }
    return photo.compressed_url || photo.original_url || '';
  };

  // Обработка выбора пользовательских фото для генерации
  const handleToggleUserPhotoSelection = (photoId: string) => {
    setSelectedUserPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        // Разрешаем выбрать только одно пользовательское фото
        newSet.clear();
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // Обработка выбора скрапленных фото для генерации (только одно)
  const handleToggleScrapedPhotoSelection = (index: number) => {
    setSelectedScrapedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        // Разрешаем выбрать только одно скрапленное фото
        newSet.clear();
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Запуск генерации объединенных фотографий
  const handleStartGeneration = async () => {
    if (!user) {
      toast({
        title: t("authRequired") || "Требуется авторизация",
        description: t("authRequiredDesc") || "Пожалуйста, войдите в систему",
        variant: "destructive",
      });
      return;
    }

    // Проверяем, что выбрано ровно одно скрапленное фото и одно пользовательское
    if (selectedScrapedPhotos.size !== 1 || selectedUserPhotos.size !== 1) {
      toast({
        title: t("selectionRequired") || "Требуется выбор",
        description: t("selectOneScrapedAndOneUserPhoto") || "Выберите одно скрапленное фото и одно ваше фото",
        variant: "destructive",
      });
      return;
    }

    const scrapedIndex = Array.from(selectedScrapedPhotos)[0];
    const userPhotoIdOrTemp = Array.from(selectedUserPhotos)[0];
    const scrapedPhoto = scrapedPhotos[scrapedIndex];

    if (!scrapedPhoto) {
      toast({
        title: t("error") || "Ошибка",
        description: t("scrapedPhotoNotFound") || "Скрапленное фото не найдено",
        variant: "destructive",
      });
      return;
    }

    try {
      setGenerationState('generating');

      let userPhotoId: string;
      let userPhotoUrl: string;

      // Проверяем, является ли это временным ID (uploadedProducts)
      if (userPhotoIdOrTemp.startsWith('uploaded-')) {
        // Находим файл в uploadedProducts
        const tempIdParts = userPhotoIdOrTemp.split('-');
        const fileName = tempIdParts.slice(1, -2).join('-');
        const fileSize = parseInt(tempIdParts[tempIdParts.length - 2]);
        const lastModified = parseInt(tempIdParts[tempIdParts.length - 1]);
        
        const uploadedFile = uploadedProducts.find(
          f => f.name === fileName && f.size === fileSize && f.lastModified === lastModified
        );

        if (!uploadedFile) {
          throw new Error(t("userPhotoNotFound") || "Пользовательское фото не найдено");
        }

        // Загружаем файл в Supabase и получаем ID
        toast({
          title: t("uploading") || "Загрузка",
          description: t("uploadingPhotoForGeneration") || "Загружаем фото для генерации...",
        });

        const validation = await validateImageQuality(uploadedFile);
        const compressed = await compressImage(uploadedFile, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.7,
          maxFileSize: 10 * 1024 * 1024
        });

        const originalResult = await uploadImageToSupabase(
          compressed.originalFile,
          'user-photos',
          'originals',
          user.id
        );

        if (!originalResult.id) {
          throw new Error(t("failedToUploadPhoto") || "Не удалось загрузить фото");
        }

        userPhotoId = originalResult.id;
        userPhotoUrl = originalResult.url;

        // Обновляем запись сжатым файлом
        const compressedResult = await uploadImageToSupabase(
          compressed.file,
          'user-photos',
          'compressed',
          user.id,
          originalResult.id
        );

        if (compressedResult.url) {
          userPhotoUrl = compressedResult.url;
        }

        // Обновляем метаданные
        await supabase
          .from('user_photos')
          .update({
            width: validation.dimensions.width,
            height: validation.dimensions.height,
            quality_score: validation.qualityScore,
            is_valid: validation.isValid
          })
          .eq('id', originalResult.id)
          .eq('user_id', user.id);

        // Обновляем список фотографий пользователя
        await loadUserPhotos();
      } else {
        // Это ID из БД (uploadedUserPhotos)
        userPhotoId = userPhotoIdOrTemp;
        const url = await getUserPhotoUrl(userPhotoId);
        if (!url) {
          throw new Error(t("userPhotoNotFound") || "Пользовательское фото не найдено");
        }
        userPhotoUrl = url;
      }

      // Создаем ID для скрапленного фото
      const scrapedPhotoId = createScrapedPhotoId(scrapedPhoto.file);
      // Используем сохраненный URL или создаем blob URL как fallback
      const scrapedPhotoUrl = scrapedPhoto.url || URL.createObjectURL(scrapedPhoto.file);

      // Проверяем, есть ли уже генерация для этой комбинации
      const existing = await checkExistingGeneration(user.id, scrapedPhotoId, userPhotoId);
      
      if (existing && existing.status === 'completed' && existing.generated_urls.length === 3) {
        // Используем существующие результаты
        setCurrentGenerationId(existing.id);
        setGeneratedResults(existing.generated_urls);
        setGenerationState('completed');
        toast({
          title: t("generationFound") || "Генерация найдена",
          description: t("usingExistingGeneration") || "Используем ранее созданную генерацию",
        });
        return;
      }

      // Создаем запись о генерации
      const generation = await createGenerationRecord(user.id, scrapedPhotoId, userPhotoId);
      setCurrentGenerationId(generation.id);

      // Запускаем генерацию
      const request: GenerationRequest = {
        scraped_photo_url: scrapedPhotoUrl,
        scraped_photo_id: scrapedPhotoId,
        user_photo_id: userPhotoId,
        user_photo_url: userPhotoUrl
      };

      await startGeneration(request);

      // GenerationProgress компонент будет polling статус
    } catch (error) {
      console.error('Ошибка запуска генерации:', error);
      setGenerationState('idle');
      setCurrentGenerationId(null);
      toast({
        title: t("error") || "Ошибка",
        description: error instanceof Error ? error.message : t("generationError") || "Не удалось запустить генерацию",
        variant: "destructive",
      });
    }
  };

  // Обработка завершения генерации
  const handleGenerationComplete = (generatedUrls: string[]) => {
    setGeneratedResults(generatedUrls);
    setGenerationState('completed');
    toast({
      title: t("generationCompleted") || "Генерация завершена",
      description: t("threeVariantsGenerated") || "Создано 3 варианта объединенных фотографий",
    });
  };

  // Обработка ошибки генерации
  const handleGenerationError = (error: string) => {
    setGenerationState('idle');
    setCurrentGenerationId(null);
    toast({
      title: t("generationFailed") || "Генерация не удалась",
      description: error,
      variant: "destructive",
    });
  };

  // Сброс состояния генерации
  const handleResetGeneration = () => {
    setGenerationState('idle');
    setCurrentGenerationId(null);
    setGeneratedResults([]);
    setSelectedScrapedPhotos(new Set());
    setSelectedUserPhotos(new Set());
  };

  // Управление индексом текущей фотографии из Supabase
  useEffect(() => {
    if (currentPhotoIndex >= userPhotos.length && userPhotos.length > 0) {
      setCurrentPhotoIndex(userPhotos.length - 1);
    }
  }, [currentPhotoIndex, userPhotos.length]);

  // Сброс ошибок загрузки при смене фотографии
  useEffect(() => {
    if (userPhotos[currentPhotoIndex]) {
      const photoId = userPhotos[currentPhotoIndex].id;
      // Сбрасываем ошибку для текущей фотографии при смене
      setImageLoadErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[photoId];
        return newErrors;
      });
    }
  }, [currentPhotoIndex, userPhotos]);


  useEffect(() => {
    if (studioState !== "active") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (displayMode === 'split' && (scrapedPhotos.length > 0 || uploadedProducts.length > 0 || uploadedUserPhotos.length > 0)) {
        // В режиме разделенного экрана используем разные клавиши для навигации
        if (e.key === "ArrowLeft") {
          if (e.shiftKey) {
            // Shift + Left для навигации по фотографиям пользователя
            const totalUserPhotos = uploadedProducts.length + uploadedUserPhotos.length;
            if (currentUserPhotoIndex > 0) {
              setCurrentUserPhotoIndex(prev => prev - 1);
            }
          } else if (currentScrapedPhotoIndex > 0) {
            // Left для навигации по скрапленным фотографиям
            setCurrentScrapedPhotoIndex(prev => prev - 1);
          }
        } else if (e.key === "ArrowRight") {
          if (e.shiftKey) {
            // Shift + Right для навигации по фотографиям пользователя
            const totalUserPhotos = uploadedProducts.length + uploadedUserPhotos.length;
            if (currentUserPhotoIndex < totalUserPhotos - 1) {
              setCurrentUserPhotoIndex(prev => prev + 1);
            }
          } else if (currentScrapedPhotoIndex < displayedScrapedPhotos.length - 1) {
            // Right для навигации по скрапленным фотографиям
            setCurrentScrapedPhotoIndex(prev => prev + 1);
          }
        }
      } else {
        // Обычная навигация по скрапленным фотографиям
        if (e.key === "ArrowLeft" && currentScrapedPhotoIndex > 0) {
          setCurrentScrapedPhotoIndex(prev => prev - 1);
        } else if (e.key === "ArrowRight" && currentScrapedPhotoIndex < displayedScrapedPhotos.length - 1) {
          setCurrentScrapedPhotoIndex(prev => prev + 1);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -25 : 25;
        
        if (displayMode === 'split' && (displayedScrapedPhotos.length > 0 || uploadedProducts.length > 0 || uploadedUserPhotos.length > 0)) {
          // В режиме разделенного экрана масштабируем обе части одновременно
          setCompetitorZoom(prev => Math.max(25, Math.min(300, prev + delta)));
          setUserPhotoZoom(prev => Math.max(25, Math.min(300, prev + delta)));
        } else {
          // В обычном режиме масштабируем только скрапленные фотографии
          setCompetitorZoom(prev => Math.max(25, Math.min(300, prev + delta)));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [studioState, currentScrapedPhotoIndex, currentUserPhotoIndex, uploadedUserPhotos.length, displayMode, uploadedProducts.length, displayedScrapedPhotos.length]);

  const handleLogout = async () => {
    await signOut();
    toast({
      title: t("loggedOut"),
      description: t("loggedOutDesc"),
    });
    navigate("/");
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (isUploading) return;
    
    setIsUploading(true);
    
    try {
      // Проверяем, является ли пользователь демо-пользователем
      const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
      
      console.log('Upload context:', {
        isDemoUserLocal,
        user: user?.id,
        userEmail: user?.email,
        sessionExists: !!user
      });
      
      if (!isDemoUserLocal && !user) {
        toast({
          title: t("authRequired"),
          description: t("authRequiredDesc"),
          variant: "destructive",
        });
        return;
      }

      const processedFiles: File[] = [];
      const errors: string[] = [];

      for (const file of acceptedFiles) {
        try {
          console.log('Processing file:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          });

          // Более мягкая валидация качества изображения
          const validation = await validateImageQuality(file);
          
          // Принимаем все изображения, но показываем предупреждения
          if (!validation.isValid) {
            console.warn(`Предупреждение для ${file.name}:`, validation.issues.join(', '));
            // Не блокируем загрузку, только логируем предупреждение
          }

          // Сжатие изображения с более мягкими настройками
          const compressed = await compressImage(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.7,
            maxFileSize: 10 * 1024 * 1024 // 10MB
          });

          let originalUrl: string;
          let compressedUrl: string;

          if (isDemoUserLocal) {
            // Для демо-пользователей создаем локальные URL
            originalUrl = URL.createObjectURL(compressed.originalFile);
            compressedUrl = URL.createObjectURL(compressed.file);
          } else {
            // Загрузка оригинального файла в таблицу (создает запись)
            const originalResult = await uploadImageToSupabase(
              compressed.originalFile,
              'user-photos',
              'originals',
              user.id
            );
            originalUrl = originalResult.url;

            // Обновляем запись сжатым файлом, если есть ID
            if (originalResult.id) {
              const compressedResult = await uploadImageToSupabase(
                compressed.file,
                'user-photos',
                'compressed',
                user.id,
                originalResult.id
              );
              compressedUrl = compressedResult.url;

              // Обновляем запись с метаданными
              const { supabase } = await import('@/integrations/supabase/client');
              await supabase
                .from('user_photos')
                .update({
                  width: validation.dimensions.width,
                  height: validation.dimensions.height,
                  quality_score: validation.qualityScore,
                  is_valid: validation.isValid
                })
                .eq('id', originalResult.id)
                .eq('user_id', user.id);
            } else {
              compressedUrl = originalUrl; // Fallback
            }
            
            // Обновляем список фотографий пользователя
            await loadUserPhotos();
          }

          processedFiles.push(compressed.file);
        } catch (error) {
          console.error('Ошибка обработки файла:', error);
          
          // Получаем более конкретное сообщение об ошибке
          let errorMessage = 'Ошибка обработки';
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
          // Переводим некоторые распространенные ошибки на русский
          if (errorMessage.includes('Failed to load image') || errorMessage.includes('Не удалось загрузить изображение')) {
            errorMessage = 'Не удалось загрузить изображение. Возможно, файл поврежден или имеет неподдерживаемый формат.';
          } else if (errorMessage.includes('Ошибка загрузки:')) {
            // Извлекаем конкретное сообщение об ошибке после двоеточия
            const specificError = errorMessage.split('Ошибка загрузки:')[1]?.trim();
            if (specificError) {
              errorMessage = specificError;
            } else {
              errorMessage = 'Ошибка загрузки в хранилище. Проверьте подключение к интернету.';
            }
          } else if (errorMessage.includes('Ошибка сохранения в базу данных')) {
            errorMessage = 'Ошибка сохранения в базу данных. Попробуйте еще раз.';
          } else if (errorMessage.includes('Не удалось сжать изображение')) {
            errorMessage = 'Не удалось обработать изображение. Попробуйте другой файл.';
          }
          
          errors.push(`${file.name}: ${errorMessage}`);
        }
      }

      if (processedFiles.length > 0) {
        setUploadedProducts(prev => [...prev, ...processedFiles]);
        
        // Переключаемся в режим разделенного экрана при загрузке наших фотографий
        if (uploadedProducts.length === 0) {
          setDisplayMode('split');
          setCurrentUserPhotoIndex(0);
        }
        
        toast({
          title: t("uploadComplete"),
          description: `${t("successfullyUploaded")} ${processedFiles.length} ${t("filesFrom")} ${acceptedFiles.length} ${t("files")}`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: t("uploadWarning"),
          description: `${t("someFilesFailed")}: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      toast({
        title: t("error"),
        description: t("uploadErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    }
  });

  // Отдельный dropzone для плавающей панели
  const { getRootProps: getFloatRootProps, getInputProps: getFloatInputProps, isDragActive: isFloatDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    }
  });

  const removeProduct = (index: number) => {
    setUploadedProducts(prev => {
      const newProducts = prev.filter((_, i) => i !== index);
      
      // Если удалили все наши фотографии, переключаемся обратно в режим конкурента
      if (newProducts.length === 0) {
        setDisplayMode('competitor');
        setCurrentUserPhotoIndex(0);
      } else if (index <= currentUserPhotoIndex && currentUserPhotoIndex > 0) {
        // Корректируем индекс текущей фотографии пользователя
        setCurrentUserPhotoIndex(prev => Math.max(0, prev - 1));
      }
      
      return newProducts;
    });
  };

  const handleGenerate = () => {
    toast({
      title: t("generatingVariants"),
      description: t("aiCreatingVariations"),
    });
  };

  const handleSelectFromHistory = async (photo: any) => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    
    if (isDemoUserLocal) {
      // Для демо-пользователей просто показываем сообщение
      toast({
        title: t("demoMode"),
        description: t("demoModeDesc"),
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Определяем источник фотографии
      const isCompetitorPhoto = photo.source === 'competitor' || photo.type === 'competitor';
      
      // Загружаем изображение по URL
      const response = await fetch(photo.compressed_url || photo.original_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      const file = new File([blob], photo.file_name, { type: mimeType });
      
      if (isCompetitorPhoto) {
        // Добавляем в scrapedPhotos для фотографий конкурентов
        setScrapedPhotos(prev => {
          const newPhoto: ScrapedPhotoWithId = {
            file,
            dbId: (photo as any).id,
            source: 'competitor' as const
          };
          const newPhotos = [...prev, newPhoto];
          setCurrentScrapedPhotoIndex(newPhotos.length - 1);
          return newPhotos;
        });
      } else {
        // Добавляем в uploadedProducts для загруженных пользователем фотографий
        setUploadedProducts(prev => [...prev, file]);
        
        // Переключаемся в режим разделенного экрана при добавлении наших фотографий
        if (uploadedProducts.length === 0) {
          setDisplayMode('split');
          setCurrentUserPhotoIndex(0);
          // Показываем правое изображение (фотографию пользователя), если оно скрыто
          if (isRightImageHidden) {
            setIsRightImageHidden(false);
          }
        }
      }
      
      setShowPhotoHistory(false);
      setShowScrapedPhotoHistory(false);
      
      toast({
        title: t("photoSelected"),
        description: `"${photo.file_name}" ${t("photoAddedToProject")}`,
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

  // Загружаем историю скрапленных фотографий из таблицы photos
  const loadScrapedPhotoHistory = async () => {
    if (!user || isDemoUser) {
      toast({
        title: t("error"),
        description: t("authRequired"),
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoadingScrapedPhotoHistory(true);
      // Получаем все завершенные импорты из таблицы photos
      const completedImports = await getCompletedPhotoImports(user.id);
      
      // Преобразуем в PhotoHistoryItem
      const historyItems: PhotoHistoryItem[] = [];
      
      for (const importItem of completedImports) {
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
          const urls = importItem.photo_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
          if (urls.length > 0) {
            photoUrls = urls;
          } else {
            photoUrls = [importItem.photo_url];
          }
        }
        
        // Создаем PhotoHistoryItem для каждого URL
        for (const photoUrl of photoUrls) {
          const fileName = photoUrl.split('/').pop() || `photo-${importItem.id}`;
          historyItems.push({
            id: `${importItem.id}-${photoUrl}`,
            original_url: photoUrl,
            compressed_url: photoUrl,
            file_name: fileName,
            file_size: 0,
            width: undefined,
            height: undefined,
            quality_score: undefined,
            is_valid: true,
            created_at: new Date().toISOString(),
          });
        }
      }

      setScrapedPhotoHistory(historyItems);
    } catch (error) {
      console.error('Ошибка загрузки истории скрапленных фотографий:', error);
      toast({
        title: t("error"),
        description: t("failedToLoadPhoto"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingScrapedPhotoHistory(false);
    }
  };

  // Обработчик открытия истории скрапленных фотографий
  const handleScrapedPhotoHistoryOpen = () => {
    setShowScrapedPhotoHistory(true);
    // Всегда загружаем историю при открытии модального окна для получения актуальных данных
    if (user && !isDemoUser) {
      loadScrapedPhotoHistory();
    }
  };

  // Обработчик открытия истории фотографий пользователя
  const handlePhotoHistoryOpen = () => {
    setShowPhotoHistory(true);
    // Всегда загружаем историю при открытии модального окна для получения актуальных данных
    if (user && !isDemoUser) {
      loadUserPhotos();
    }
  };

  // Обработчик выбора фотографии из истории скрапинга (теперь использует общий обработчик)
  const handleSelectFromScrapedHistory = handleSelectFromHistory;

  // Обработчик выбора/снятия выбора фотографии (старая версия для удаления - оставляем для совместимости)
  const handleTogglePhotoSelection = (index: number) => {
    handleToggleScrapedPhotoSelection(index);
  };

  // Обработчик удаления выбранных фотографий
  const handleDeleteSelectedPhotos = async () => {
    if (selectedScrapedPhotos.size === 0) return;

    const deletedCount = selectedScrapedPhotos.size;
    const indicesToDelete = Array.from(selectedScrapedPhotos);
    
    // Собираем ID фотографий для удаления из базы данных
    const photosToDelete = indicesToDelete
      .map(index => scrapedPhotos[index])
      .filter(photo => photo.dbId && photo.source === 'competitor')
      .map(photo => photo.dbId!);

    try {
      // Удаляем из базы данных
      if (photosToDelete.length > 0) {
        const deletePromises = photosToDelete.map(id => deleteCompetitorPhoto(id));
        await Promise.all(deletePromises);
      }

      // Удаляем выбранные фотографии из массива
      setScrapedPhotos(prev => {
        const sortedIndices = indicesToDelete.sort((a, b) => b - a);
        const newPhotos = [...prev];
        
        // Удаляем в обратном порядке, чтобы индексы не сдвигались
        sortedIndices.forEach(index => {
          newPhotos.splice(index, 1);
        });

        // Обновляем текущий индекс, если он был удален
        if (currentScrapedPhotoIndex >= prev.length - deletedCount) {
          const newIndex = Math.max(0, prev.length - deletedCount - 1);
          setCurrentScrapedPhotoIndex(newIndex);
        } else {
          // Пересчитываем индекс с учетом удаленных элементов
          let newIndex = currentScrapedPhotoIndex;
          sortedIndices.forEach(index => {
            if (index < currentScrapedPhotoIndex) {
              newIndex--;
            }
          });
          setCurrentScrapedPhotoIndex(Math.max(0, newIndex));
        }

        return newPhotos;
      });

      // Очищаем выбор
      setSelectedScrapedPhotos(new Set());

      toast({
        title: t("photosDeleted") || "Фотографии удалены",
        description: t("selectedPhotosDeleted") || `Удалено фотографий: ${deletedCount}`,
      });
    } catch (error) {
      console.error('Ошибка удаления фотографий:', error);
      toast({
        title: t("error") || "Ошибка",
        description: t("failedToDeletePhotos") || "Не удалось удалить фотографии",
        variant: "destructive",
      });
    }
  };

  // Обработчик выбора всех фотографий
  const handleSelectAllPhotos = () => {
    if (selectedScrapedPhotos.size === scrapedPhotos.length) {
      // Если все выбраны, снимаем выбор
      setSelectedScrapedPhotos(new Set());
    } else {
      // Выбираем все
      setSelectedScrapedPhotos(new Set(scrapedPhotos.map((_, index) => index)));
    }
  };

  // Очищаем невалидные выборы при изменении списка фотографий
  useEffect(() => {
    setSelectedScrapedPhotos(prev => {
      const validIndices = new Set<number>();
      prev.forEach(index => {
        if (index >= 0 && index < scrapedPhotos.length) {
          validIndices.add(index);
        }
      });
      return validIndices;
    });
  }, [scrapedPhotos.length]);

  // Сбрасываем индекс при изменении списка отображаемых фотографий
  useEffect(() => {
    if (displayedScrapedPhotos.length === 0) {
      setCurrentScrapedPhotoIndex(0);
    } else if (currentScrapedPhotoIndex >= displayedScrapedPhotos.length) {
      // Если индекс выходит за границы, устанавливаем последний доступный индекс
      setCurrentScrapedPhotoIndex(Math.max(0, displayedScrapedPhotos.length - 1));
    }
  }, [displayedScrapedPhotos.length, currentScrapedPhotoIndex]);

  // Автоматически устанавливаем режим split и показываем фотографию пользователя при загрузке, если есть загруженные фотографии
  useEffect(() => {
    const totalUserPhotos = uploadedProducts.length + uploadedUserPhotos.length;
    if (totalUserPhotos > 0 && displayMode !== 'split') {
      setDisplayMode('split');
      setIsRightImageHidden(false);
      setCurrentUserPhotoIndex(0);
    }
  }, [uploadedProducts.length, uploadedUserPhotos.length, displayMode]);

  if (studioState === "loading") {
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
              <Loader2 className="w-16 h-16 mx-auto animate-spin text-foreground" />
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

  const toggleTheme = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
        <ColorBends 
          className="absolute inset-0"
          colors={effectiveTheme === 'light' 
            ? ['#a8b5ff', '#b8a5ff', '#ffb3f0', '#8cc5ff'] 
            : ['#667eea', '#764ba2', '#f093fb', '#4facfe']
          }
          speed={0.2}
          frequency={1}
          warpStrength={1}
          mouseInfluence={1}
          parallax={0.5}
          transparent={true}
        />
      </Suspense>
      <div className={`absolute inset-0 backdrop-blur-sm z-[1] ${
        effectiveTheme === 'light' ? 'bg-white/40' : 'bg-black/75'
      }`} />
      <header style={{ height: "clamp(3.5rem, 5vh, 4rem)" }} className="bg-card border-b border-border flex items-center justify-between px-[clamp(1rem,3vw,1.5rem)] flex-shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <AnimatedLogo />
          <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-md border border-border hidden md:flex">
            <Checkbox 
              id="snake-toggle" 
              checked={snakeEnabled}
              onCheckedChange={toggleSnake}
            />
            <label 
              htmlFor="snake-toggle" 
              className="text-sm text-foreground cursor-pointer select-none"
              style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }}
              title={t("enableSnake")}
            >
              🐍
            </label>
          </div>
        </div>
        
        <div className="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)]">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger 
              style={{ width: "clamp(7rem, 10vw, 8.125rem)" }} 
              className="bg-secondary border-border text-foreground cursor-pointer"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="en" className="text-foreground hover:bg-accent">English</SelectItem>
              <SelectItem value="ru" className="text-foreground hover:bg-accent">Русский</SelectItem>
              <SelectItem value="de" className="text-foreground hover:bg-accent">Deutsch</SelectItem>
              <SelectItem value="pl" className="text-foreground hover:bg-accent">Polski</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" />
            <Switch 
              checked={effectiveTheme === "dark"} 
              onCheckedChange={toggleTheme}
              aria-label={t("theme")}
            />
            <Moon className="w-4 h-4" />
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-foreground hover:bg-accent relative overflow-visible"
            style={{ width: "clamp(2.25rem, 3vw, 2.5rem)", height: "clamp(2.25rem, 3vw, 2.5rem)" }}
            title={t("importLink") || "Import Link"}
            onClick={() => navigate('/studio/empty')}
          >
            <div 
              style={{
                animation: 'rotateIcon 5s linear infinite',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'clamp(1rem, 1.2vw, 1.25rem)',
                height: 'clamp(1rem, 1.2vw, 1.25rem)',
                transformOrigin: 'center center',
                willChange: 'transform'
              }}
            >
              <LinkIcon style={{ width: "clamp(1rem, 1.2vw, 1.25rem)", height: "clamp(1rem, 1.2vw, 1.25rem)" }} />
            </div>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-foreground hover:bg-accent"
            style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)", padding: "clamp(0.375rem, 0.8vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)" }}
          >
            <LogOut style={{ width: "clamp(1rem, 1.2vw, 1.25rem)", height: "clamp(1rem, 1.2vw, 1.25rem)" }} className="mr-2" />
            {t("logout")}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-foreground hover:bg-accent"
            style={{ width: "clamp(2.25rem, 3vw, 2.5rem)", height: "clamp(2.25rem, 3vw, 2.5rem)" }}
            onClick={() => navigate("/profile")}
            title={t("profile")}
          >
            <User style={{ width: "clamp(1.125rem, 1.5vw, 1.25rem)", height: "clamp(1.125rem, 1.5vw, 1.25rem)" }} />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden z-10">
          <motion.div
            data-scraped-photos-area
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
                      // Если клик был на чекбоксе, не обрабатываем здесь (он обработается через onCheckedChange)
                      const target = e.target as HTMLElement;
                      if (target.closest('[role="checkbox"]') || target.closest('button') || target.tagName === 'BUTTON') {
                        return;
                      }
                      handleSelectAllPhotos();
                    }}
                  >
                    <Checkbox
                      checked={scrapedPhotos.length > 0 && selectedScrapedPhotos.size === scrapedPhotos.length}
                      onCheckedChange={handleSelectAllPhotos}
                      className="shrink-0"
                    />
                    <h3 style={{ fontSize: "clamp(0.875rem, 1vw, 0.95rem)" }} className="font-semibold text-foreground">
                      {t("scrapedPhotos") || "Фотографии после скрапинга"} ({scrapedPhotos.length})
                    </h3>
                  </label>
                  {selectedScrapedPhotos.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelectedPhotos}
                      className="shrink-0"
                      style={{ 
                        fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)",
                        height: "clamp(1.75rem, 2.5vh, 2rem)",
                        padding: "clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.5rem, 1vw, 0.75rem)"
                      }}
                    >
                      <Trash2 style={{ width: "clamp(0.75rem, 1vw, 0.875rem)", height: "clamp(0.75rem, 1vw, 0.875rem)" }} className="mr-1" />
                      {t("delete") || "Удалить"} ({selectedScrapedPhotos.size})
                    </Button>
                  )}
                </div>
                
                <div style={{ padding: "0 clamp(0.75rem, 1.5vw, 1rem) clamp(0.75rem, 1.5vw, 1rem)" }} className="flex-1 overflow-y-auto">
                  {scrapedPhotos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <p style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="text-muted-foreground">
                        {t("noScrapedPhotos") || "Нет скрапленных фотографий"}
                      </p>
                      <p style={{ fontSize: "clamp(0.625rem, 0.75vw, 0.7rem)" }} className="text-muted-foreground mt-2">
                        {t("scrapePhotosToSeeThemHere") || "Запустите скрапинг, чтобы увидеть фотографии здесь"}
                      </p>
                    </div>
                  ) : (
                    <div style={{ gap: "clamp(0.5rem, 1vh, 0.75rem)" }} className="flex flex-col">
                      {scrapedPhotos.map((item, index) => {
                        // Проверяем, отображается ли эта фотография сейчас на экране
                        const isCurrentlyDisplayed = displayedScrapedPhotos[currentScrapedPhotoIndex]?.originalIndex === index;
                        const isSelected = selectedScrapedPhotos.has(index);
                        const photoUrl = URL.createObjectURL(item.file);
                        
                        return (
                          <motion.div
                            key={`scraped-${index}`}
                            data-scraped-photo-item
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
                            onClick={(e) => {
                              // Останавливаем всплытие события, чтобы не закрывать модальные окна и не сбрасывать состояние
                              e.stopPropagation();
                              
                              // Не обрабатываем клик, если кликнули на чекбокс
                              if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
                                return;
                              }
                              
                              // Сохраняем все состояния ДО любых изменений
                              const totalUserPhotos = uploadedProducts.length + uploadedUserPhotos.length;
                              const savedUserPhotoIndex = totalUserPhotos > 0 ? currentUserPhotoIndex : 0;
                              const savedIsRightPanelVisible = isRightPanelVisible;
                              const savedShowPhotoHistory = showPhotoHistory;
                              const savedShowScrapedPhotoHistory = showScrapedPhotoHistory;
                              const savedIsRightImageHidden = isRightImageHidden;
                              
                              // Активируем режим split, если он еще не активен
                              if (displayMode !== 'split') {
                                setDisplayMode('split');
                              }
                              
                              // Показываем левое изображение, если оно скрыто
                              if (isLeftImageHidden) {
                                setIsLeftImageHidden(false);
                              }
                              
                              // КРИТИЧЕСКИ ВАЖНО: Сохраняем видимость правой части (фотографии пользователя)
                              // Если есть загруженные фотографии, правая часть ДОЛЖНА быть видима
                              // Если правая часть была видима до клика, она ДОЛЖНА остаться видимой
                              // Используем flushSync для синхронного обновления, чтобы предотвратить сброс состояния
                              if (totalUserPhotos > 0 || !savedIsRightImageHidden) {
                                flushSync(() => {
                                  setIsRightImageHidden(false);
                                });
                              }
                              
                              // КРИТИЧЕСКИ ВАЖНО: Открываем панель СРАЗУ, если она была открыта или есть фотографии
                              // Это предотвращает её закрытие при клике
                              if (savedIsRightPanelVisible || totalUserPhotos > 0) {
                                flushSync(() => {
                                  setIsRightPanelVisible(true);
                                });
                              }
                              // Находим индекс этой фотографии в displayedScrapedPhotos
                              const displayIndex = displayedScrapedPhotos.findIndex(item => item.originalIndex === index);
                              if (displayIndex !== -1) {
                                setCurrentScrapedPhotoIndex(displayIndex);
                              } else {
                                // Если фотография не в списке отображаемых, устанавливаем индекс 0
                                setCurrentScrapedPhotoIndex(0);
                              }
                              // Восстанавливаем индекс пользовательской фотографии, если есть загруженные фотографии
                              if (totalUserPhotos > 0 && savedUserPhotoIndex < totalUserPhotos) {
                                setCurrentUserPhotoIndex(savedUserPhotoIndex);
                              }
                              
                              // Восстанавливаем состояние модального окна истории фотографий
                              // Используем setTimeout для восстановления после обработки всех обновлений
                              setTimeout(() => {
                                // Восстанавливаем видимость правой части (фотографии пользователя) - дополнительная гарантия
                                if (totalUserPhotos > 0 || !savedIsRightImageHidden) {
                                  setIsRightImageHidden(false);
                                }
                                // Восстанавливаем видимость панели с Add Product и History - дополнительная гарантия
                                if (savedIsRightPanelVisible || totalUserPhotos > 0) {
                                  setIsRightPanelVisible(true);
                                }
                                // Восстанавливаем состояние модального окна истории фотографий
                                if (savedShowPhotoHistory) {
                                  setShowPhotoHistory(true);
                                }
                                if (savedShowScrapedPhotoHistory) {
                                  setShowScrapedPhotoHistory(true);
                                }
                              }, 100);
                              // Показываем уведомление о выборе фотографии (необязательно, можно убрать если слишком навязчиво)
                              // toast({
                              //   title: t("photoSelected") || "Фотография выбрана",
                              //   description: t("photoSelectedForEditing") || "Фотография отображается в центре для редактирования",
                              // });
                            }}
                          >
                            <div className="relative">
                              <img
                                src={photoUrl}
                                alt={item.file.name || `Scraped Photo ${index + 1}`}
                                className="w-full aspect-square object-cover rounded mb-2 pointer-events-none"
                              />
                              <div className="absolute top-2 left-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleScrapedPhotoSelection(index)}
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
                    onClick={handleScrapedPhotoHistoryOpen}
                    className="w-full"
                    style={{ 
                      fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)",
                      height: "clamp(2rem, 3vh, 2.5rem)",
                      padding: "clamp(0.25rem, 0.5vw, 0.375rem)"
                    }}
                  >
                    <History style={{ width: "clamp(0.875rem, 1.2vw, 1rem)", height: "clamp(0.875rem, 1.2vw, 1rem)" }} className="mr-2" />
                    {t("history") || "История"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex-1 flex items-center justify-center relative">
          {displayMode === 'split' && (scrapedPhotos.length > 0 || uploadedProducts.length > 0 || uploadedUserPhotos.length > 0) ? (
            // Режим разделенного экрана
            <div className="w-full h-full flex gap-4 p-4 relative">
              {/* Кнопка восстановления изображений */}
              {(isLeftImageHidden || isRightImageHidden) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsLeftImageHidden(false);
                    setIsRightImageHidden(false);
                  }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-sm hover:bg-accent"
                  title="Восстановить изображения"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Восстановить
                </Button>
              )}
              {/* Левая часть - скрапленные фотографии (только после скрапинга) */}
              {!isLeftImageHidden && (
              <div 
                className={`flex-1 flex items-center justify-center relative cursor-pointer ${isRightImageHidden ? 'flex-[1_1_100%]' : ''}`}
                onClick={(e) => {
                  // Определяем, в какой части кликнули для навигации
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const centerX = rect.width / 2;
                  
                  if (clickX < centerX && currentScrapedPhotoIndex > 0) {
                    // Клик в левой части - предыдущая фотография
                    setCurrentScrapedPhotoIndex(prev => prev - 1);
                  } else if (clickX > centerX && currentScrapedPhotoIndex < displayedScrapedPhotos.length - 1) {
                    // Клик в правой части - следующая фотография
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
                  className="relative flex items-center justify-center"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {/* Кнопка закрытия */}
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLeftImageHidden(true);
                    }}
                    className="absolute top-2 left-2 h-6 w-6 bg-background/80 backdrop-blur-sm hover:bg-destructive/80 text-foreground hover:text-destructive-foreground z-50 rounded-full"
                    title="Закрыть фотографию"
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  {/* Информация о скрапленной фотографии */}
                  {displayedScrapedPhotos[currentScrapedPhotoIndex] && (
                    <div 
                      style={{ 
                        top: "clamp(0.5rem, 1vh, 0.75rem)", 
                        left: "clamp(0.5rem, 1vw, 0.75rem)",
                        padding: "clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.375rem, 0.75vw, 0.5rem)"
                      }} 
                      className="absolute z-10 bg-black/20 backdrop-blur-sm rounded-md border border-white/10"
                    >
                      <p style={{ fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)" }} className="font-medium text-white/90 truncate max-w-[200px]">
                        {displayedScrapedPhotos[currentScrapedPhotoIndex].photo.name || `Photo ${currentScrapedPhotoIndex + 1}`}
                      </p>
                      <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/70 mt-0.5">
                        {currentScrapedPhotoIndex + 1} / {displayedScrapedPhotos.length}
                        {selectedScrapedPhotos.size > 0 && (
                          <span className="text-white/50 ml-1">
                            ({selectedScrapedPhotos.size} {t("selected") || "выбрано"})
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/60 mt-0.5">
                        🔍 {competitorZoom}%
                      </p>
                    </div>
                  )}

                  {/* Скрапленная фотография */}
                  <AnimatePresence mode="wait">
                    {displayedScrapedPhotos[currentScrapedPhotoIndex] ? (
                      <motion.img
                        key={`scraped-${displayedScrapedPhotos[currentScrapedPhotoIndex].originalIndex}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        src={URL.createObjectURL(displayedScrapedPhotos[currentScrapedPhotoIndex].photo)}
                        alt={displayedScrapedPhotos[currentScrapedPhotoIndex].photo.name || `Photo ${currentScrapedPhotoIndex + 1}`}
                        className="w-full h-full object-contain rounded-lg shadow-2xl"
                        style={{
                          transform: `scale(${competitorZoom / 100})`,
                          transition: 'transform 0.3s ease'
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>
                          {selectedScrapedPhotos.size > 0 
                            ? (t("noSelectedPhotos") || "Нет выбранных фотографий для отображения")
                            : (t("noScrapedPhotos") || "Нет скрапленных фотографий")
                          }
                        </p>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Кнопки масштабирования для фотографий конкурента */}
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

                  {/* Кнопки навигации для скрапленных фотографий */}
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

                    {isHoveringImage && currentScrapedPhotoIndex < displayedScrapedPhotos.length - 1 && (
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
              )}

              {/* Правая часть - фотографии пользователя (из истории и загруженные вручную) */}
              {(() => {
                // Объединяем uploadedProducts и uploadedUserPhotos для отображения
                const totalUserPhotos = uploadedProducts.length + uploadedUserPhotos.length;
                const isFromUploadedProducts = currentUserPhotoIndex < uploadedProducts.length;
                const historyIndex = currentUserPhotoIndex - uploadedProducts.length;
                
                return (
              !isRightImageHidden && (
              <div 
                data-user-photo-area
                className={`flex-1 flex items-center justify-center relative cursor-pointer transition-all duration-300 ${
                  isDraggingOverUserPhoto ? 'bg-primary/20 border-2 border-primary border-dashed' : ''
                } ${isLeftImageHidden ? 'flex-[1_1_100%]' : ''}`}
                onClick={(e) => {
                  // Определяем, в какой части кликнули для навигации
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const centerX = rect.width / 2;
                  
                  if (clickX < centerX && currentUserPhotoIndex > 0) {
                    // Клик в левой части - предыдущая фотография
                    setCurrentUserPhotoIndex(prev => prev - 1);
                  } else if (clickX > centerX && currentUserPhotoIndex < totalUserPhotos - 1) {
                    // Клик в правой части - следующая фотография
                    setCurrentUserPhotoIndex(prev => prev + 1);
                  }
                }}
                onMouseEnter={() => {
                  setIsHoveringUserPhoto(true);
                  // Открываем панель с Add Product и History при наведении на область фотографии пользователя
                  setIsRightPanelVisible(true);
                }}
                onMouseLeave={() => {
                  setIsHoveringUserPhoto(false);
                  // Не закрываем панель сразу, чтобы она не закрывалась при клике на скрапленные фотографии
                  // Панель закроется только если курсор действительно покинул область
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOverUserPhoto(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Проверяем, что мы действительно покинули элемент
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsDraggingOverUserPhoto(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOverUserPhoto(false);
                  
                  const files = Array.from(e.dataTransfer.files);
                  const imageFiles = files.filter(file => file.type.startsWith('image/'));
                  
                  if (imageFiles.length > 0) {
                    // Используем существующую функцию onDrop для обработки файлов
                    onDrop(imageFiles);
                  }
                }}
              >
                <motion.div 
                  style={{ 
                    width: "100%",
                    height: "100%"
                  }}
                  className="relative flex items-center justify-center"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {/* Кнопка закрытия */}
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRightImageHidden(true);
                    }}
                    className="absolute top-2 left-2 h-6 w-6 bg-background/80 backdrop-blur-sm hover:bg-destructive/80 text-foreground hover:text-destructive-foreground z-50 rounded-full"
                    title="Закрыть фотографию"
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  {/* Информация о фотографии пользователя */}
                  <div 
                    style={{ 
                      top: "clamp(0.5rem, 1vh, 0.75rem)", 
                      left: "clamp(0.5rem, 1vw, 0.75rem)",
                      padding: "clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.375rem, 0.75vw, 0.5rem)"
                    }} 
                    className="absolute z-10 bg-black/20 backdrop-blur-sm rounded-md border border-white/10"
                  >
                    <p style={{ fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)" }} className="font-medium text-white/90">
                      {isFromUploadedProducts 
                        ? uploadedProducts[currentUserPhotoIndex]?.name 
                        : uploadedUserPhotos[historyIndex]?.file_name || `Photo ${historyIndex + 1}`}
                    </p>
                    <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/70 mt-0.5">
                      {currentUserPhotoIndex + 1} / {totalUserPhotos}
                    </p>
                    <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/60 mt-0.5">
                      🔍 {userPhotoZoom}%
                    </p>
                  </div>

                  {/* Фотография пользователя (из uploadedProducts или userPhotos) */}
                  <AnimatePresence mode="wait">
                    {isFromUploadedProducts && uploadedProducts[currentUserPhotoIndex] ? (
                      <motion.img
                        key={`user-photo-uploaded-${currentUserPhotoIndex}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        src={URL.createObjectURL(uploadedProducts[currentUserPhotoIndex])}
                        alt={uploadedProducts[currentUserPhotoIndex].name}
                        className="w-full h-full object-contain rounded-lg shadow-2xl"
                        style={{
                          transform: `scale(${userPhotoZoom / 100})`,
                          transition: 'transform 0.3s ease'
                        }}
                      />
                    ) : uploadedUserPhotos[historyIndex] ? (
                      imageLoadErrors[uploadedUserPhotos[historyIndex].id] ? (
                        <motion.div
                          key={`error-${uploadedUserPhotos[historyIndex].id}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-destructive/50"
                        >
                          <div className="text-destructive mb-4">
                            <X className="h-12 w-12" />
                          </div>
                          <p className="text-destructive font-semibold text-sm mb-2">
                            {t("imageLoadError") || "Ошибка загрузки"}
                          </p>
                          <p className="text-muted-foreground text-xs text-center px-4">
                            {t("imageLoadErrorDesc") || "Не удалось загрузить изображение"}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setImageLoadErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors[uploadedUserPhotos[historyIndex].id];
                                return newErrors;
                              });
                              setImageFallbackUrls(prev => {
                                const newUrls = { ...prev };
                                delete newUrls[uploadedUserPhotos[historyIndex].id];
                                return newUrls;
                              });
                            }}
                          >
                            {t("retry") || "Повторить"}
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.img
                          key={`user-photo-history-${historyIndex}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          src={getImageUrl(uploadedUserPhotos[historyIndex])}
                          alt={uploadedUserPhotos[historyIndex].file_name || `Photo ${historyIndex + 1}`}
                          className="w-full h-full object-contain rounded-lg shadow-2xl"
                          style={{
                            transform: `scale(${userPhotoZoom / 100})`,
                            transition: 'transform 0.3s ease'
                          }}
                          onError={(e) => handleImageError(uploadedUserPhotos[historyIndex].id, uploadedUserPhotos[historyIndex], e)}
                        />
                      )
                    ) : totalUserPhotos === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>{t("noUserPhotos") || "Нет фотографий пользователя"}</p>
                      </div>
                    ) : null}
                  </AnimatePresence>

                  {/* Кнопка палитры для редактирования фотографии */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowIndividualPrompt(true)}
                    style={{
                      bottom: "clamp(8rem, 12vh, 10rem)",
                      right: "clamp(1rem, 2vw, 1.5rem)"

                    }}
                    className={`absolute bg-secondary/80 hover:bg-secondary text-foreground rounded-full shadow-md z-40 transition-all border border-border ${
                      showIndividualPrompt ? "ring-2 ring-primary/20 bg-secondary" : ""
                    }`}
                    title="Промпт и настройки для этой фотографии"
                  >
                    <div style={{ padding: "clamp(0.625rem, 1.2vw, 0.875rem)" }} className="flex items-center gap-2">
                      <span style={{ fontSize: "clamp(1.125rem, 1.8vw, 1.375rem)" }}>🎨</span>
                    </div>
                  </motion.button>

                  {/* Кнопки масштабирования для наших фотографий */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setUserPhotoZoom(prev => Math.min(300, prev + 25))}
                      className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-accent"
                      disabled={userPhotoZoom >= 300}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setUserPhotoZoom(prev => Math.max(25, prev - 25))}
                      className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-accent"
                      disabled={userPhotoZoom <= 25}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setUserPhotoZoom(100)}
                      className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-accent"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Индикатор перетаскивания */}
                  <AnimatePresence>
                    {isDraggingOverUserPhoto && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-lg flex items-center justify-center z-50"
                      >
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center">
                            <Upload className="w-8 h-8 text-primary" />
                          </div>
                          <p className="text-primary font-medium text-lg">
                            {t("dropPhotosHere") || "Drop photos here"}
                          </p>
                          <p className="text-primary/70 text-sm mt-2">
                            {t("dragPhotosFromOtherWindows") || "Drag photos from other windows"}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Кнопка Add Product при наведении */}
                  <AnimatePresence>
                    {isHoveringUserPhoto && !isDraggingOverUserPhoto && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                          bottom: "clamp(1rem, 2vh, 1.5rem)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          boxShadow: "0 8px 25px rgba(102, 126, 234, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                        }}
                        className="absolute text-white rounded-full z-40 transition-all duration-300 overflow-hidden group"
                        onClick={() => {
                          // Открываем диалог выбора файла
                          fileInputRef.current?.click();
                        }}
                        title={t("addProduct")}
                      >
                        <div style={{ padding: "clamp(0.625rem, 1.2vw, 0.875rem)" }} className="flex items-center gap-2 relative z-10">
                          <motion.div
                            animate={{ rotate: [0, 90, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Plus style={{ width: "clamp(1rem, 1.5vw, 1.25rem)", height: "clamp(1rem, 1.5vw, 1.25rem)" }} />
                          </motion.div>
                          <span style={{ fontSize: "clamp(0.75rem, 1vw, 0.875rem)" }} className="font-medium">
                            {t("addProduct")}
                          </span>
                        </div>
                        
                        {/* Анимированный фон при наведении */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-amber-700 to-pink-500 opacity-0 group-hover:opacity-100"
                          initial={{ x: "-100%" }}
                          whileHover={{ x: "0%" }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                        />
                        
                        {/* Блестящий эффект */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {/* Кнопки навигации для наших фотографий */}
                  <AnimatePresence>
                    {isHoveringUserPhoto && !isDraggingOverUserPhoto && currentUserPhotoIndex > 0 && (
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

                    {isHoveringUserPhoto && !isDraggingOverUserPhoto && currentUserPhotoIndex < totalUserPhotos - 1 && (
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
              )
              );
              })()}
            </div>
          ) : (
            // Обычный режим отображения фотографий из Supabase
            <motion.div 
              style={{ 
                width: "clamp(60%, 75vw, 80%)",
                height: "clamp(70%, 85vh, 90%)"
              }}
              className="relative flex items-center justify-center"
              onMouseEnter={() => setIsHoveringImage(true)}
              onMouseLeave={() => setIsHoveringImage(false)}
              onClick={(e) => {
                // Определяем, в какой части кликнули для навигации
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const centerX = rect.width / 2;
                
                if (clickX < centerX && currentPhotoIndex > 0) {
                  // Клик в левой части - предыдущая фотография
                  setCurrentPhotoIndex(prev => prev - 1);
                } else if (clickX > centerX && currentPhotoIndex < userPhotos.length - 1) {
                  // Клик в правой части - следующая фотография
                  setCurrentPhotoIndex(prev => prev + 1);
                }
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
            {userPhotos[currentPhotoIndex] && (
              <div 
                style={{ 
                  top: "clamp(0.5rem, 1vh, 0.75rem)", 
                  left: "clamp(0.5rem, 1vw, 0.75rem)",
                  padding: "clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.375rem, 0.75vw, 0.5rem)"
                }} 
                className="absolute z-10 bg-black/20 backdrop-blur-sm rounded-md border border-white/10"
              >
                <p style={{ fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)" }} className="font-medium text-white/90 truncate max-w-[200px]">
                  {userPhotos[currentPhotoIndex].file_name || `Photo ${currentPhotoIndex + 1}`}
                </p>
                <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/70 mt-0.5">
                  {currentPhotoIndex + 1} / {userPhotos.length}
                </p>
                <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-white/60 mt-0.5">
                  🔍 {competitorZoom}%
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {userPhotos[currentPhotoIndex] && (
                imageLoadErrors[userPhotos[currentPhotoIndex].id] ? (
                  <motion.div
                    key={`error-${userPhotos[currentPhotoIndex].id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-destructive/50"
                  >
                    <div className="text-destructive mb-4">
                      <X className="h-16 w-16" />
                    </div>
                    <p className="text-destructive font-semibold text-lg mb-2">
                      {t("imageLoadError") || "Ошибка загрузки изображения"}
                    </p>
                    <p className="text-muted-foreground text-sm text-center px-4">
                      {t("imageLoadErrorDesc") || "Не удалось загрузить изображение. Возможно, ссылка устарела или недоступна."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setImageLoadErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors[userPhotos[currentPhotoIndex].id];
                          return newErrors;
                        });
                        setImageFallbackUrls(prev => {
                          const newUrls = { ...prev };
                          delete newUrls[userPhotos[currentPhotoIndex].id];
                          return newUrls;
                        });
                      }}
                    >
                      {t("retry") || "Повторить"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.img
                    key={userPhotos[currentPhotoIndex].id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    src={getImageUrl(userPhotos[currentPhotoIndex])}
                    alt={userPhotos[currentPhotoIndex].file_name || `Photo ${currentPhotoIndex + 1}`}
                    className="w-full h-full object-contain rounded-lg shadow-2xl"
                    style={{
                      transform: `scale(${competitorZoom / 100})`,
                      transition: 'transform 0.3s ease'
                    }}
                    onError={(e) => handleImageError(userPhotos[currentPhotoIndex].id, userPhotos[currentPhotoIndex], e)}
                  />
                )
              )}
            </AnimatePresence>

            {/* Кнопки масштабирования для обычного режима */}
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

            <div 
              className="absolute right-0 top-0 w-[20%] h-full z-20"
              onMouseEnter={() => setIsRightPanelVisible(true)}
              onMouseLeave={() => setIsRightPanelVisible(false)}
            />

            <AnimatePresence>
              {isHoveringImage && currentPhotoIndex > 0 && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  whileHover={{ scale: 1.1 }}
                  style={{ 
                    left: "clamp(0.75rem, 2vw, 1rem)",
                    width: "clamp(3rem, 4vw, 4rem)",
                    height: "clamp(3rem, 4vw, 4rem)"
                  }}
                  className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border hover:bg-accent z-30"
                  onClick={() => setCurrentPhotoIndex(prev => prev - 1)}
                >
                  <ChevronLeft style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                </motion.button>
              )}

              {isHoveringImage && currentPhotoIndex < userPhotos.length - 1 && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  whileHover={{ scale: 1.1 }}
                  style={{ 
                    right: "clamp(0.75rem, 2vw, 1rem)",
                    width: "clamp(3rem, 4vw, 4rem)",
                    height: "clamp(3rem, 4vw, 4rem)"
                  }}
                  className="absolute top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground shadow-lg transition-all duration-300 border-2 border-border hover:bg-accent z-30"
                  onClick={() => setCurrentPhotoIndex(prev => prev + 1)}
                >
                  <ChevronRight style={{ width: "clamp(1.5rem, 2vw, 2rem)", height: "clamp(1.5rem, 2vw, 2rem)" }} />
                </motion.button>
              )}
            </AnimatePresence>

            <motion.div
              style={{
                bottom: "clamp(8rem, 12vh, 10rem)",
                right: "clamp(1rem, 2vw, 1.5rem)"
              }}
              className={`absolute bg-secondary/80 text-foreground rounded-full shadow-md z-40 transition-all border border-border ${
                showIndividualPrompt ? "ring-2 ring-primary/20 bg-secondary" : ""
              }`}
              title="Промпт и настройки для этой фотографии"
            >
              <div style={{ padding: "clamp(0.625rem, 1.2vw, 0.875rem)" }} className="flex items-center gap-2 pointer-events-none">
                <motion.span 
                  style={{ fontSize: "clamp(1.125rem, 1.8vw, 1.375rem)" }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowIndividualPrompt(!showIndividualPrompt);
                  }}
                  className="cursor-pointer pointer-events-auto"
                >
                  🎨
                </motion.span>
              </div>
            </motion.div>

            <AnimatePresence>
              {showIndividualPrompt && (
                <>
                  {/* Полноэкранный режим редактирования */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center"
                    onClick={() => setShowIndividualPrompt(false)}
                  >
                    {/* Контейнер для фото и редактора */}
                    <div 
                      className="relative w-full h-full max-w-7xl max-h-[90vh] flex gap-6 p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Фотография - левая часть */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="relative w-full h-full max-w-4xl">
                          {displayMode === 'split' && uploadedProducts.length > 0 ? (
                            // Редактирование наших фотографий
                            <>
                              <img
                                src={URL.createObjectURL(uploadedProducts[currentUserPhotoIndex])}
                                alt={uploadedProducts[currentUserPhotoIndex].name}
                                className="w-full h-full object-contain rounded-lg shadow-2xl"
                                style={{
                                  transform: `scale(${userPhotoZoom / 100})`,
                                  transition: 'transform 0.3s ease'
                                }}
                              />
                              
                              {/* Информация о нашей фотографии */}
                              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg">
                                <p className="text-sm font-medium">{uploadedProducts[currentUserPhotoIndex].name}</p>
                                <p className="text-xs text-gray-300">
                                  {(uploadedProducts[currentUserPhotoIndex].size / 1024 / 1024).toFixed(1)} MB
                                </p>
                                <p className="text-xs text-gray-300">
                                  {currentUserPhotoIndex + 1} / {uploadedProducts.length}
                                </p>
                              </div>
                            </>
                          ) : (
                            // Редактирование фотографий из Supabase
                            <>
                              {userPhotos[currentPhotoIndex] && (
                                <>
                                  {imageLoadErrors[userPhotos[currentPhotoIndex].id] ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-destructive/50">
                                      <div className="text-destructive mb-4">
                                        <X className="h-12 w-12" />
                                      </div>
                                      <p className="text-destructive font-semibold text-sm mb-2">
                                        {t("imageLoadError") || "Ошибка загрузки"}
                                      </p>
                                      <p className="text-muted-foreground text-xs text-center px-4">
                                        {t("imageLoadErrorDesc") || "Не удалось загрузить изображение"}
                                      </p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => {
                                          setImageLoadErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors[userPhotos[currentPhotoIndex].id];
                                            return newErrors;
                                          });
                                          setImageFallbackUrls(prev => {
                                            const newUrls = { ...prev };
                                            delete newUrls[userPhotos[currentPhotoIndex].id];
                                            return newUrls;
                                          });
                                        }}
                                      >
                                        {t("retry") || "Повторить"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <img
                                      src={getImageUrl(userPhotos[currentPhotoIndex])}
                                      alt={userPhotos[currentPhotoIndex].file_name || `Photo ${currentPhotoIndex + 1}`}
                                      className="w-full h-full object-contain rounded-lg shadow-2xl"
                                      style={{
                                        transform: `scale(${competitorZoom / 100})`,
                                        transition: 'transform 0.3s ease'
                                      }}
                                      onError={(e) => handleImageError(userPhotos[currentPhotoIndex].id, userPhotos[currentPhotoIndex], e)}
                                    />
                                  )}
                                  
                                  {/* Информация о фото из Supabase */}
                                  <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg">
                                    <p className="text-sm font-medium">{getCleanFileName(userPhotos[currentPhotoIndex].file_name) || `Photo ${currentPhotoIndex + 1}`}</p>
                                    <p className="text-xs text-gray-300">
                                      {new Date(userPhotos[currentPhotoIndex].created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Редактор - правая часть */}
                      <motion.div
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 50, opacity: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="w-80 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden"
                      >
                        <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-secondary/10">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                              <span className="text-xl">🎨</span>
                              <span>{t("photoEditor")}</span>
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowIndividualPrompt(false)}
                              className="hover:bg-accent h-8 w-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {displayMode === 'split' && uploadedProducts.length > 0 
                              ? `${uploadedProducts[currentUserPhotoIndex].name} • ${(uploadedProducts[currentUserPhotoIndex].size / 1024 / 1024).toFixed(1)} MB`
                              : userPhotos[currentPhotoIndex] 
                                ? `${getCleanFileName(userPhotos[currentPhotoIndex].file_name) || `Photo ${currentPhotoIndex + 1}`} • ${new Date(userPhotos[currentPhotoIndex].created_at).toLocaleDateString()}`
                                : ""
                            }
                          </p>
                        </div>

                        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
                          <div className="mb-4">
                            <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                              <span>✍️</span>
                              {t("promptForThisPhoto")}
                            </label>
                            <textarea
                              placeholder={t("describeChangesForPhoto")}
                              value={displayMode === 'split' && uploadedProducts.length > 0 
                                ? (userPhotoPrompts[currentUserPhotoIndex] || "")
                                : ""
                              }
                              onChange={(e) => {
                                if (displayMode === 'split' && uploadedProducts.length > 0) {
                                  updateUserPhotoPrompt(currentUserPhotoIndex, e.target.value);
                                }
                              }}
                              className="w-full min-h-[100px] p-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm"
                            />
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs text-muted-foreground">
                                {(displayMode === 'split' && uploadedProducts.length > 0 
                                  ? (userPhotoPrompts[currentUserPhotoIndex] || "")
                                  : ""
                                ).length} {t("characters")}
                              </span>
                              {(displayMode === 'split' && uploadedProducts.length > 0 
                                ? (userPhotoPrompts[currentUserPhotoIndex] || "")
                                : ""
                              ).length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (displayMode === 'split' && uploadedProducts.length > 0) {
                                      updateUserPhotoPrompt(currentUserPhotoIndex, "");
                                    }
                                  }}
                                  className="text-xs h-7 px-2"
                                >
                                  {t("clear")}
                                </Button>
                              )}
                            </div>
                          </div>

                          {displayMode === 'split' && uploadedProducts.length > 0 && (
                            <div className="space-y-4">
                              <h5 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                                <span>⚙️</span>
                                {t("imageSettings")}
                              </h5>

                              <div className="space-y-4">
                                <AnimatedSlider
                                  value={userPhotoSettings[currentUserPhotoIndex]?.brightness || 100}
                                  onChange={(value) => {
                                    updateUserPhotoSettings(currentUserPhotoIndex, 'brightness', value);
                                  }}
                                  min={50}
                                  max={150}
                                  label={t("brightness")}
                                  icon="☀️"
                                  animationType={sliderAnimationType}
                                />

                                <AnimatedSlider
                                  value={userPhotoSettings[currentUserPhotoIndex]?.contrast || 100}
                                  onChange={(value) => {
                                    updateUserPhotoSettings(currentUserPhotoIndex, 'contrast', value);
                                  }}
                                  min={50}
                                  max={150}
                                  label={t("contrast")}
                                  icon="◐"
                                  animationType={sliderAnimationType}
                                />

                                <AnimatedSlider
                                  value={userPhotoSettings[currentUserPhotoIndex]?.saturation || 100}
                                  onChange={(value) => {
                                    updateUserPhotoSettings(currentUserPhotoIndex, 'saturation', value);
                                  }}
                                  min={0}
                                  max={200}
                                  label={t("saturation")}
                                  icon="🎨"
                                  animationType={sliderAnimationType}
                                />
                              </div>

                              <div className="flex gap-2 mt-6">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    updateUserPhotoSettings(currentUserPhotoIndex, 'brightness', 100);
                                    updateUserPhotoSettings(currentUserPhotoIndex, 'contrast', 100);
                                    updateUserPhotoSettings(currentUserPhotoIndex, 'saturation', 100);
                                  }}
                                  className="flex-1"
                                >
                                  🔄 {t("reset")}
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => setShowIndividualPrompt(false)}
                                  className="flex-1"
                                >
                                  ✅ {t("done")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Плавающая панель с Add Product и History - всегда видна */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ 
                width: "clamp(5rem, 12vw, 9rem)",
                right: "clamp(0.5rem, 1.5vw, 1rem)",
                top: "clamp(0.5rem, 1.5vh, 1rem)",
                padding: "clamp(0.4rem, 0.8vw, 0.6rem)"
              }}
              className="absolute bg-card/95 border-2 border-border backdrop-blur-sm shadow-2xl rounded-xl overflow-hidden z-40 flex flex-col gap-2"
            >
              {/* Кнопка Add Product */}
              <div
                {...getFloatRootProps()}
                className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                  isFloatDragActive 
                    ? "border-primary bg-accent/20" 
                    : "border-border hover:border-primary/50 hover:bg-accent/10"
                } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{
                  height: "clamp(3rem, 6vh, 4rem)",
                  padding: "clamp(0.25rem, 0.4vw, 0.375rem)"
                }}
              >
                <input {...getFloatInputProps({ id: 'dropzone-input-float', name: 'dropzoneFileFloat' })} disabled={isUploading} />
                {isUploading ? (
                  <Loader2 
                    style={{ 
                      width: "clamp(1.25rem, 3vw, 1.5rem)", 
                      height: "clamp(1.25rem, 3vw, 1.5rem)" 
                    }}
                    className="text-muted-foreground animate-spin" 
                  />
                ) : (
                  <Plus 
                    style={{ 
                      width: "clamp(1.25rem, 3vw, 1.5rem)", 
                      height: "clamp(1.25rem, 3vw, 1.5rem)" 
                    }}
                    className="text-muted-foreground opacity-60 group-hover:scale-110 group-hover:opacity-90 transition-all" 
                  />
                )}
                <p style={{ fontSize: "clamp(0.5rem, 0.7vw, 0.625rem)" }} className="text-muted-foreground text-center mt-1 font-medium px-1">
                  {isUploading ? t("uploading") : (isFloatDragActive ? t("dropHere") : t("addProduct"))}
                </p>
              </div>
              
              {/* Кнопка History */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePhotoHistoryOpen}
                className="w-full"
                style={{ 
                  fontSize: "clamp(0.5rem, 0.7vw, 0.625rem)",
                  height: "clamp(1.5rem, 3vh, 2rem)",
                  padding: "clamp(0.25rem, 0.4vw, 0.375rem)"
                }}
              >
                <History style={{ width: "clamp(0.75rem, 1.5vw, 1rem)", height: "clamp(0.75rem, 1.5vw, 1rem)" }} className="mr-1" />
                {t("history")} {userPhotos.length > 0 && `(${userPhotos.length})`}
              </Button>
            </motion.div>

          </motion.div>
          )}
        </div>

        <motion.div
          initial={false}
          animate={{ width: isRightPanelOpen ? "clamp(14rem, 18vw, 18rem)" : "clamp(2.5rem, 3vw, 2.75rem)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          onMouseEnter={() => setIsRightPanelOpen(true)}
          onMouseLeave={() => setIsRightPanelOpen(false)}
          className="bg-card border-l border-border overflow-hidden relative z-10"
        >
          {!isRightPanelOpen && (
            <div className="h-full flex items-center justify-center">
              <Menu style={{ width: "clamp(1.125rem, 1.5vw, 1.25rem)", height: "clamp(1.125rem, 1.5vw, 1.25rem)" }} className="text-muted-foreground" />
            </div>
          )}
          
          <AnimatePresence>
            {isRightPanelOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ padding: "clamp(0.5rem, 1vw, 0.75rem)" }}
                className="h-full flex flex-col gap-3"
              >

                <div>
                  <h3 style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="font-medium text-foreground mb-2 flex items-center gap-1.5">
                    <span className="text-base">✨</span>
                    {t("enterPrompt")}
                  </h3>

                  <div className="bg-accent/10 border border-border/50 rounded-md p-2 mb-2">
                    <p style={{ fontSize: "clamp(0.625rem, 0.75vw, 0.7rem)" }} className="text-muted-foreground">
                      {t("toAllPhotos")}
                    </p>
                    {displayMode === 'split' && uploadedProducts.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-muted-foreground">
                          ⌨️ {t("navigationHint")}: ← → для конкурента, Shift + ← → для наших фото
                        </p>
                        <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-muted-foreground">
                          🔍 Ctrl + колесо мыши для масштабирования
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mb-2">
                    <textarea
                      placeholder={t("describeChanges")}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="w-full min-h-[60px] p-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none text-xs"
                    />
                    <div className="flex justify-between items-center mt-1">
                      {promptText.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {promptText.length}
                        </span>
                      )}
                      {promptText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPromptText("")}
                          className="text-xs h-5 px-2"
                        >
                          {t("clear")}
                        </Button>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleGenerate}
                    className="w-full h-7 text-xs"
                    disabled={!promptText}
                  >
                    <span className="mr-1.5 text-sm">✨</span>
                    {t("generate")}
                  </Button>

                  {/* Кнопка генерации объединенных фотографий */}
                  {selectedScrapedPhotos.size === 1 && selectedUserPhotos.size === 1 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartGeneration}
                      className="w-full h-7 text-xs mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      disabled={generationState === 'generating'}
                    >
                      {generationState === 'generating' ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          {t("generating") || "Генерируем..."}
                        </>
                      ) : (
                        <>
                          <span className="mr-1.5 text-sm">🎨</span>
                          {t("generateMerged") || "Сгенерировать объединенные"}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Кнопка Add Product */}
                <div className="mt-2">
                  <motion.div
                    className="relative"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Открываем диалог выбора файла
                        fileInputRef.current?.click();
                      }}
                      className="w-full relative overflow-hidden group"
                      style={{ 
                        fontSize: "clamp(0.325rem, 0.5vw, 0.45rem)",
                        height: "clamp(1.25rem, 2.5vh, 1.75rem)",
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        border: "none",
                        color: "white",
                        boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)"
                      }}
                    >
                      <div className="flex items-center justify-center gap-1.5 relative z-10">
                        <motion.div
                          animate={{ rotate: [0, 90, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Plus className="w-3 h-3" />
                        </motion.div>
                        <span className="font-medium">{t("addProduct")}</span>
                      </div>
                      
                      {/* Анимированный фон */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-amber-700 to-pink-500 opacity-0 group-hover:opacity-100"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "0%" }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                      
                      {/* Блестящий эффект */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      />
                    </Button>
                  </motion.div>
                </div>

                {/* Таблица с фотографиями пользователя */}
                <div className="mt-2 flex-1 overflow-hidden flex flex-col">
                  <h3 style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.875rem)" }} className="font-semibold text-foreground mb-2">
                    {t("uploadedPhotos") || "Загруженные фотографии"} ({uploadedProducts.length + uploadedUserPhotos.length})
                  </h3>
                  
                  <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ gap: "clamp(0.375rem, 0.6vw, 0.5rem)" }}>
                    {isLoadingPhotos ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin text-muted-foreground" style={{ width: "clamp(1rem, 1.5vw, 1.25rem)", height: "clamp(1rem, 1.5vw, 1.25rem)" }} />
                      </div>
                    ) : uploadedProducts.length === 0 && uploadedUserPhotos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-2">
                        <p style={{ fontSize: "clamp(0.625rem, 0.75vw, 0.7rem)" }} className="text-muted-foreground">
                          {t("noPhotos") || "Нет фотографий"}
                        </p>
                        <p style={{ fontSize: "clamp(0.5rem, 0.65vw, 0.625rem)" }} className="text-muted-foreground mt-1">
                          {t("uploadPhotosToSeeThemHere") || "Загрузите фотографии, чтобы увидеть их здесь"}
                        </p>
                      </div>
                    ) : (
                      <div style={{ gap: "clamp(0.375rem, 0.6vw, 0.5rem)" }} className="flex flex-col">
                        {/* Загруженные пользователем фотографии с устройства (uploadedProducts) */}
                        {uploadedProducts.map((photo, index) => {
                          const totalIndex = index;
                          const isCurrentlyDisplayed = displayMode === 'split' 
                            ? totalIndex === currentUserPhotoIndex 
                            : false;
                          // Используем временный ID на основе имени файла и размера
                          const tempId = `uploaded-${photo.name}-${photo.size}-${photo.lastModified}`;
                          const isSelected = selectedUserPhotos.has(tempId);
                          const photoUrl = URL.createObjectURL(photo);
                          
                          return (
                            <motion.div
                              key={`uploaded-${index}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ 
                                duration: 0.3,
                                delay: index * 0.03
                              }}
                              whileHover={{ scale: 1.02 }}
                              style={{ padding: "clamp(0.25rem, 0.5vw, 0.375rem)" }}
                              className={`rounded-lg transition-all duration-300 relative cursor-pointer ${
                                isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50" : 
                                isSelected ? "border-2 border-primary bg-primary/20" :
                                "border-2 border-transparent hover:bg-accent/30"
                              }`}
                              onClick={() => {
                                // Выбираем эту фотографию
                                setDisplayMode('split');
                                setCurrentUserPhotoIndex(index);
                              }}
                            >
                              <div className="relative">
                                <img
                                  src={photoUrl}
                                  alt={photo.name || `Uploaded Photo ${index + 1}`}
                                  className="w-full aspect-square object-cover rounded mb-1 pointer-events-none"
                                />
                                <div className="absolute top-2 left-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleUserPhotoSelection(tempId)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-background/80 backdrop-blur-sm"
                                  />
                                </div>
                              </div>
                              <p style={{ fontSize: "clamp(0.625rem, 0.75vw, 0.7rem)" }} className="font-medium text-foreground pointer-events-none truncate">
                                {photo.name || `Photo ${index + 1}`}
                              </p>
                            </motion.div>
                          );
                        })}
                        
                        {/* Фотографии из истории, загруженные с устройства (uploadedUserPhotos из user_photos таблицы) */}
                        {uploadedUserPhotos.map((photo, index) => {
                          const totalIndex = uploadedProducts.length + index;
                          const isCurrentlyDisplayed = displayMode === 'split' 
                            ? totalIndex === currentUserPhotoIndex 
                            : index === currentPhotoIndex;
                          const isSelected = selectedUserPhotos.has(photo.id);
                          const photoUrl = getImageUrl(photo);
                          
                          return (
                            <motion.div
                              key={photo.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ 
                                duration: 0.3,
                                delay: (uploadedProducts.length + index) * 0.03
                              }}
                              whileHover={{ scale: 1.02 }}
                              style={{ padding: "clamp(0.25rem, 0.5vw, 0.375rem)" }}
                              className={`rounded-lg transition-all duration-300 relative cursor-pointer ${
                                isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50" : 
                                isSelected ? "border-2 border-primary bg-primary/20" :
                                "border-2 border-transparent hover:bg-accent/30"
                              }`}
                              onClick={() => {
                                // Выбираем эту фотографию (используем totalIndex, так как это общий индекс для всех загруженных фотографий)
                                setDisplayMode('split');
                                setCurrentUserPhotoIndex(totalIndex);
                              }}
                            >
                              <div className="relative">
                                <img
                                  src={photoUrl}
                                  alt={photo.file_name || `Photo ${index + 1}`}
                                  className="w-full aspect-square object-cover rounded mb-1 pointer-events-none"
                                  onError={(e) => handleImageError(photo.id, photo, e)}
                                />
                                <div className="absolute top-2 left-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleUserPhotoSelection(photo.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-background/80 backdrop-blur-sm"
                                  />
                                </div>
                              </div>
                              <p style={{ fontSize: "clamp(0.625rem, 0.75vw, 0.7rem)" }} className="font-medium text-foreground pointer-events-none truncate">
                                {photo.file_name || `Photo ${index + 1}`}
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Кнопка History внизу панели */}
                <div style={{ padding: "clamp(0.75rem, 1.5vw, 1rem)" }} className="border-t border-border mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoHistoryOpen}
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

      </div>

      {/* Hidden file input for Add Product button */}
      <input
        id="file-upload-input"
        name="fileUpload"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const fileArray = Array.from(files);
            onDrop(fileArray);
          }
          // Reset input value to allow selecting the same file again
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
      />

      {/* Photo History Modal - объединенная история с вкладками */}
      <PhotoHistoryModal
        isOpen={showPhotoHistory || showScrapedPhotoHistory}
        onClose={() => {
          setShowPhotoHistory(false);
          setShowScrapedPhotoHistory(false);
        }}
        onSelectPhoto={handleSelectFromHistory}
        userPhotos={[]} // Пустой массив, чтобы модальное окно само загружало объединенную историю
        isLoading={isLoadingPhotos || isLoadingScrapedPhotoHistory}
        onRefresh={() => {
          loadUserPhotos();
          loadScrapedPhotoHistory();
        }}
      />

      {/* Generation Progress Modal */}
      <AnimatePresence>
        {(generationState === 'generating' || generationState === 'completed') && currentGenerationId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => {
              if (generationState === 'completed') {
                handleResetGeneration();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <GenerationProgress
                generationId={currentGenerationId}
                onComplete={handleGenerationComplete}
                onError={handleGenerationError}
                onCancel={() => {
                  if (generationState === 'generating') {
                    handleResetGeneration();
                  }
                }}
              />
              {generationState === 'completed' && generatedResults.length > 0 && (
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleResetGeneration}
                  >
                    {t("close") || "Закрыть"}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      // TODO: Переход к редактированию выбранного варианта
                      handleResetGeneration();
                    }}
                  >
                    {t("selectBest") || "Выбрать лучший"}
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Studio;