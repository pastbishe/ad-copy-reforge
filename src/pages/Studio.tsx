import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, LogOut, ChevronLeft, ChevronRight, Plus, X, Menu, User, Sun, Moon, Monitor, History, Upload, Trash2, ZoomIn, ZoomOut, RotateCcw, Link as LinkIcon } from "lucide-react";
import { SnakeGame } from "@/components/SnakeGame";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { AnimatedSlider } from "@/components/AnimatedSlider";
import { PhotoHistoryModal, type PhotoHistoryItem } from "@/components/PhotoHistoryModal";
import ColorBends from "@/components/ColorBends";
import { DEFAULT_SLIDER_ANIMATION } from "@/config/sliderAnimations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type CompressedImage,
  type ImageValidationResult 
} from "@/lib/imageUtils";
import { 
  getScrapeJob,
  startScrapingJobSimple,
  savePhotoImport,
  updatePhotoImport,
  getUnprocessedCompletedPhotoImports,
  getCompletedPhotoImports,
  markPhotoImportAsProcessed,
  isPhotoUrlAlreadyProcessed,
  batchCheckPhotoUrlsAlreadyProcessed,
  getUrlHistory,
  getUserCompetitorPhotos,
  deleteCompetitorPhoto,
  type UrlHistoryItem
} from "@/lib/scrapingUtils";
type StudioState = "empty" | "loading" | "active";

// Тип для хранения фотографии с ID из базы данных
type ScrapedPhotoWithId = {
  file: File;
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
  const [userPhotos, setUserPhotos] = useState<PhotoHistoryItem[]>([]);
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
  const [hasShownFirstEntryNotification, setHasShownFirstEntryNotification] = useState(false);
  const [urlHistory, setUrlHistory] = useState<UrlHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hoveredUrlId, setHoveredUrlId] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
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
    return userPhotos.filter(photo => {
      const photoUrl = photo.original_url || photo.compressed_url || '';
      // Проверяем, что URL указывает на Supabase Storage (загружено с устройства)
      return photoUrl && (
        photoUrl.includes('/storage/v1/object/public/') || 
        photoUrl.includes('supabase.co/storage')
      );
    });
  }, [userPhotos]);

  // Загружаем фотографии пользователя при инициализации
  const loadUserPhotos = async () => {
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
  };

  // Функция для загрузки всех фотографий из Supabase Storage в раздел Scraped Photos
  const loadPhotosFromSupabaseStorage = useCallback(async () => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return;

    try {
      console.log('loadPhotosFromSupabaseStorage: начинаем загрузку фотографий из Supabase Storage');
      
      // Получаем фотографии конкурентов из таблицы competitor_photos
      const competitorPhotos = await getUserCompetitorPhotos(user.id, 100);
      console.log('loadPhotosFromSupabaseStorage: найдено фотографий конкурентов:', competitorPhotos.length);

      // Получаем фотографии пользователя из таблицы user_photos
      const userPhotosFromDb = await getUserPhotos(user.id, 100);
      console.log('loadPhotosFromSupabaseStorage: найдено фотографий пользователя:', userPhotosFromDb.length);

      // Собираем все URL из Supabase Storage
      const storageUrls: Array<{ url: string; name: string; dbId?: number; source?: 'competitor' | 'user' }> = [];

      // Добавляем фотографии конкурентов (storage_url)
      for (const photo of competitorPhotos) {
        if (photo.storage_url) {
          storageUrls.push({
            url: photo.storage_url,
            name: photo.file_name || `competitor-photo-${photo.id}`,
            dbId: photo.id,
            source: 'competitor'
          });
        }
      }

      // Добавляем фотографии пользователя, которые хранятся в Supabase Storage
      // Проверяем, что URL указывает на Supabase Storage (содержит /storage/v1/object/public/)
      for (const photo of userPhotosFromDb) {
        const photoUrl = photo.original_url || photo.compressed_url;
        if (photoUrl && (photoUrl.includes('/storage/v1/object/public/') || photoUrl.includes('supabase.co/storage'))) {
          storageUrls.push({
            url: photoUrl,
            name: photo.file_name || `user-photo-${photo.id}`
          });
        }
      }

      console.log('loadPhotosFromSupabaseStorage: всего URL из Supabase Storage:', storageUrls.length);

      if (storageUrls.length === 0) {
        console.log('loadPhotosFromSupabaseStorage: нет фотографий для загрузки');
        return;
      }

      // Загружаем фотографии и конвертируем в File объекты
      const loadedFiles: ScrapedPhotoWithId[] = [];
      
      // Получаем уже загруженные URL из scrapedPhotos, чтобы избежать дубликатов
      // Используем имя файла для проверки дубликатов
      const existingFileNames = new Set<string>();
      setScrapedPhotos(prev => {
        prev.forEach(item => {
          existingFileNames.add(item.file.name);
        });
        return prev;
      });

      for (const { url, name, dbId, source } of storageUrls) {
        try {
          // Определяем имя файла для проверки дубликатов
          const urlExtension = url.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = name.includes('.') ? name : `${name}.${urlExtension}`;
          
          // Проверяем, не загружена ли уже эта фотография по имени файла
          if (existingFileNames.has(fileName)) {
            console.log('loadPhotosFromSupabaseStorage: фотография уже загружена, пропускаем:', fileName);
            continue;
          }

          console.log('loadPhotosFromSupabaseStorage: загружаем фотографию:', url);
          
          // Загружаем изображение
          const response = await fetch(url);
          if (!response.ok) {
            console.error(`loadPhotosFromSupabaseStorage: ошибка загрузки ${url}: ${response.status}`);
            continue;
          }

          // Получаем blob
          const blob = await response.blob();
          
          // Определяем расширение файла из URL или из content-type
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          let extension = urlExtension;
          if (contentType.includes('png')) extension = 'png';
          else if (contentType.includes('gif')) extension = 'gif';
          else if (contentType.includes('webp')) extension = 'webp';
          else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';

          // Создаем File объект
          const finalFileName = name.includes('.') ? name : `${name}.${extension}`;
          const file = new File([blob], finalFileName, { type: contentType });
          
          loadedFiles.push({
            file,
            dbId,
            source: source || 'competitor'
          });
          existingFileNames.add(finalFileName);
          
          console.log('loadPhotosFromSupabaseStorage: фотография загружена:', finalFileName);
        } catch (error) {
          console.error(`loadPhotosFromSupabaseStorage: ошибка обработки ${url}:`, error);
        }
      }

      console.log('loadPhotosFromSupabaseStorage: загружено файлов:', loadedFiles.length);

      // Добавляем загруженные файлы в scrapedPhotos
      if (loadedFiles.length > 0) {
        setScrapedPhotos(prev => {
          // Фильтруем дубликаты по имени файла
          const existingNames = new Set(prev.map(item => item.file.name));
          const newFiles = loadedFiles.filter(item => !existingNames.has(item.file.name));
          const updated = [...prev, ...newFiles];
          console.log('loadPhotosFromSupabaseStorage: всего фотографий в scrapedPhotos:', updated.length);
          
          // Если есть загруженные фотографии, переводим студию в активное состояние
          if (prev.length === 0 && newFiles.length > 0) {
            setStudioState("active");
          }
          
          return updated;
        });
      }
    } catch (error) {
      console.error('loadPhotosFromSupabaseStorage: ошибка загрузки фотографий из Supabase Storage:', error);
    }
  }, [user]);

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
        // Скачиваем изображение
        const response = await fetch(photoUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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

        // Загрузка в Supabase Storage
        const originalUrl = await uploadImageToSupabase(
          compressed.originalFile,
          'user-photos',
          'originals',
          user.id
        );

        const compressedUrl = await uploadImageToSupabase(
          compressed.file,
          'user-photos',
          'compressed',
          user.id
        );

        // Сохранение в базу данных
        await savePhotoToDatabase({
          userId: user.id,
          originalUrl,
          compressedUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          width: validation.dimensions.width,
          height: validation.dimensions.height,
          qualityScore: validation.qualityScore,
          isValid: validation.isValid
        });

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

  // Функция для проверки и обработки завершенных импортов
  const processCompletedPhotoImports = useCallback(async (shouldRedirect: boolean = false, showNotification: boolean = false): Promise<boolean> => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return false;

    try {
      // Получаем все незагруженные завершенные импорты
      const completedImports = await getUnprocessedCompletedPhotoImports(user.id);
      
      console.log('processCompletedPhotoImports: найдено завершенных импортов:', completedImports.length);
      
      if (completedImports.length === 0) {
        console.log('processCompletedPhotoImports: нет завершенных импортов для обработки');
        return false;
      }

      // Извлекаем все photo_url из завершенных импортов
      // photo_url может быть строкой с одним URL, JSON-массивом URL, или разделенными запятыми URL
      const photoUrls: string[] = [];
      const allExtractedUrls: string[] = [];
      
      for (const importItem of completedImports) {
        if (!importItem.photo_url) {
          console.log('processCompletedPhotoImports: пропущен импорт без photo_url:', importItem.id);
          continue;
        }
        
        console.log('processCompletedPhotoImports: обработка импорта:', importItem.id, 'photo_url:', importItem.photo_url);
        
        try {
          // Пытаемся распарсить как JSON (массив URL)
          const parsed = JSON.parse(importItem.photo_url);
          if (Array.isArray(parsed)) {
            const validUrls = parsed.filter((url): url is string => typeof url === 'string' && url.length > 0);
            console.log('processCompletedPhotoImports: распарсен JSON массив, найдено URL:', validUrls.length);
            allExtractedUrls.push(...validUrls);
          } else if (typeof parsed === 'string') {
            console.log('processCompletedPhotoImports: распарсен JSON строка');
            allExtractedUrls.push(parsed);
          }
        } catch {
          // Если не JSON, проверяем, разделены ли URL запятыми
          const urls = importItem.photo_url.split(',').map(url => url.trim()).filter(url => url.length > 0);
          if (urls.length > 1) {
            console.log('processCompletedPhotoImports: найдено URL через запятую:', urls.length);
            allExtractedUrls.push(...urls);
          } else if (urls.length === 1) {
            console.log('processCompletedPhotoImports: найден один URL');
            allExtractedUrls.push(urls[0]);
          } else {
            // Если не удалось распарсить, используем как есть
            console.log('processCompletedPhotoImports: используем photo_url как есть');
            allExtractedUrls.push(importItem.photo_url);
          }
        }
      }
      
      // Фильтруем дубликаты через батч-проверку (оптимизированная версия)
      console.log('processCompletedPhotoImports: проверяем дубликаты для', allExtractedUrls.length, 'URL');
      if (allExtractedUrls.length > 0) {
        const processedUrls = await batchCheckPhotoUrlsAlreadyProcessed(user.id, allExtractedUrls);
        for (const url of allExtractedUrls) {
          if (!processedUrls.has(url.trim())) {
            photoUrls.push(url);
          } else {
            console.log('processCompletedPhotoImports: URL уже был обработан, пропускаем:', url);
          }
        }
      }

      console.log('processCompletedPhotoImports: всего извлечено URL:', photoUrls.length);
      console.log('processCompletedPhotoImports: URL:', photoUrls);

      if (photoUrls.length === 0) {
        console.log('processCompletedPhotoImports: нет URL для загрузки');
        return false;
      }

      // Скачиваем и добавляем фотографии в студию
      console.log('processCompletedPhotoImports: начинаем загрузку фотографий...');
      await downloadAndAddPhotosToStudio(photoUrls);
      console.log('processCompletedPhotoImports: фотографии загружены');

      // Отмечаем все импорты как обработанные
      for (const importItem of completedImports) {
        try {
          await markPhotoImportAsProcessed(importItem.id);
          console.log('processCompletedPhotoImports: импорт отмечен как обработанный:', importItem.id);
        } catch (error) {
          console.error(`Ошибка отметки импорта ${importItem.id}:`, error);
        }
      }

      // Переводим студию в активное состояние
      setStudioState("active");
      
      // Перенаправляем на студию, если нужно и мы не на странице студии
      if (shouldRedirect && location.pathname !== '/studio') {
        navigate('/studio', { 
          state: { 
            autoLoaded: true,
            photoCount: photoUrls.length 
          } 
        });
      }

      // Показываем уведомление только если это первый вход и флаг установлен
      if (showNotification && !hasShownFirstEntryNotification) {
        const photoCount = photoUrls.length;
        
        // Формируем текст уведомления в зависимости от языка
        let notificationText = "";
        if (language === "ru") {
          // Русский: "Загружена 1 фотография", "Загружено 2-4 фотографии" или "Загружено X фотографий"
          if (photoCount === 1) {
            notificationText = t("photoLoaded");
          } else if (photoCount >= 2 && photoCount <= 4) {
            notificationText = t("photosLoaded2to4").replace("{count}", photoCount.toString());
          } else {
            notificationText = t("photosLoaded").replace("{count}", photoCount.toString());
          }
        } else {
          // Английский, немецкий, польский: "1 photo loaded" или "X photos loaded"
          const photoWord = photoCount === 1 ? t("photoLoaded") : t("photosLoaded");
          notificationText = `${photoCount} ${photoWord}`;
        }
        
        toast({
          title: notificationText,
          className: "toast-wave-animation",
        });
        
        setHasShownFirstEntryNotification(true);
      }

      return true;
    } catch (error) {
      console.error('Ошибка обработки завершенных импортов:', error);
      return false;
    }
  }, [user, language, t, toast, navigate, location.pathname, setStudioState, setHasShownFirstEntryNotification, downloadAndAddPhotosToStudio, loadUserPhotos]);

  // URL webhook n8n для импорта ссылки рекламы конкурента
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_SCRAPING_WEBHOOK_URL || '';

  // Функция для ожидания и загрузки фотографий из таблицы photos
  const waitAndLoadPhotosFromPhotosTable = async (photoId: string, maxAttempts: number = 30) => {
    const delay = 8000; // 8 секунд между попытками (увеличено для N8N)
    const initialDelay = 10000; // 10 секунд перед первой проверкой (даем N8N время начать обработку)
    
    // Ждем перед первой проверкой, чтобы дать N8N время начать обработку
    await new Promise(resolve => setTimeout(resolve, initialDelay));
    setProgress(55); // Обновляем прогресс после начальной задержки
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Проверяем, обновил ли N8N запись в таблице photos
      const completedImports = await getUnprocessedCompletedPhotoImports(user!.id);
      const currentImport = completedImports.find(imp => imp.id === photoId);
      
      if (currentImport && currentImport.photo_url) {
        // N8N обновил photo_url, обрабатываем импорт
        await processCompletedPhotoImports(false, false);
        setProgress(100);
        setStudioState('active');
        return true;
      }
      
      // Обновляем прогресс
      setProgress(55 + (attempt / maxAttempts) * 40); // Прогресс от 55% до 95%
      
      // Ждем перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Если после всех попыток фотографий нет, переводим в активное состояние
    setProgress(100);
    setStudioState('active');
    toast({
      title: t("warning"),
      description: "Фотографии еще не загружены. Они появятся автоматически, когда будут готовы.",
    });
    return false;
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
    setIsLoadingPhotos(true);
    setStudioState("loading");
    setProgress(0);
    
    try {
      const userId = user?.id;
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }

      console.log('Сохраняем запись об импорте в таблицу photos');
      // Сохраняем запись об импорте в таблицу photos
      const photoId = await savePhotoImport(userId, urlToImport, 'pending');
      console.log('Запись сохранена, photoId:', photoId);
      
      // Обновляем прогресс после сохранения записи
      setProgress(10);

      console.log('Отправляем запрос на вебхук:', N8N_WEBHOOK_URL);
      // Обновляем прогресс перед отправкой запроса
      setProgress(20);
      
      // Запускаем скрапинг через упрощенный webhook
      const job = await startScrapingJobSimple(urlToImport, userId, N8N_WEBHOOK_URL);
      console.log('Вебхук ответил, job:', job);
      
      // Обновляем прогресс после получения ответа от вебхука
      setProgress(40);
      
      // Обновляем запись в photos с operation_id и статусом processing
      await updatePhotoImport(photoId, 'processing', job.id);
      
      // Обновляем прогресс
      setProgress(50);
      
      toast({
        title: t("scrapingStarted") || "Скрапинг запущен!",
        description: t("scrapingStartedDesc") || "Мы собираем рекламы конкурентов. Это может занять несколько минут.",
      });

      // Ждем, пока N8N обновит таблицу photos с photo_url
      // N8N должен обновить запись, установив photo_url и status = 'completed'
      await waitAndLoadPhotosFromPhotosTable(photoId);
      
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
  }, [url, user, toast, t, N8N_WEBHOOK_URL, processCompletedPhotoImports, setStudioState, setProgress, setPromptText, setIsLoadingPhotos, supabase, navigate, loadUrlHistory]);

  // Проверяем, есть ли URL конкурента или scrapeJobId в состоянии навигации
  useEffect(() => {
    const competitorUrl = location.state?.competitorUrl;
    const scrapeJobId = location.state?.scrapeJobId;
    const autoLoaded = location.state?.autoLoaded;
    const hasCompletedImports = location.state?.hasCompletedImports;
    
    if (competitorUrl) {
      setUrl(competitorUrl);
      // Автоматически запускаем импорт
      setTimeout(() => {
        handleImport(competitorUrl);
      }, 500);
    }
    
    // Убрали логику работы с scrape_jobs, так как используем только таблицу photos
    
    // Если есть завершенные импорты, обрабатываем их сразу
    if (hasCompletedImports && user) {
      // Обрабатываем завершенные импорты без уведомления и редиректа
      processCompletedPhotoImports(false, false);
    }
    
    // Если фотографии были автоматически загружены, переводим студию в активное состояние
    if (autoLoaded && user) {
      setStudioState("active");
      // Очищаем состояние навигации, чтобы не обрабатывать повторно
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, user, handleImport, setStudioState, navigate, processCompletedPhotoImports]);

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

  // Проверяем наличие фотографий конкурентов при загрузке Studio
  useEffect(() => {
    const checkCompetitorPhotos = async () => {
      const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
      if (isDemoUserLocal || !user) return;
      
      // Если уже есть загруженные фотографии в студии, не проверяем
      if (scrapedPhotos.length > 0) {
        setStudioState("active");
        return;
      }
      
      try {
        // Загружаем фотографии из Supabase Storage
        await loadPhotosFromSupabaseStorage();
        
        // Проверяем завершенные импорты из таблицы photos
        const hasCompletedImports = await processCompletedPhotoImports(false, false);
        
        // Если есть завершенные импорты, переводим в активное состояние
        // (loadPhotosFromSupabaseStorage уже установит состояние в "active", если есть загруженные файлы)
        if (hasCompletedImports) {
          setStudioState("active");
        } else {
          // Проверяем, есть ли фотографии в scrapedPhotos после загрузки
          // Даем небольшое время на обновление состояния
          setTimeout(() => {
            setScrapedPhotos(current => {
              if (current.length > 0) {
                setStudioState("active");
              } else {
                setStudioState("empty");
              }
              return current;
            });
          }, 200);
        }
      } catch (error) {
        console.error('Ошибка проверки фотографий конкурентов:', error);
        // При ошибке остаемся в состоянии empty (форма импорта будет показана)
        setStudioState("empty");
      }
    };
    
    // Проверяем только при загрузке страницы или изменении пользователя
    // Не проверяем при изменении scrapedPhotos, чтобы избежать бесконечных циклов
    checkCompetitorPhotos();
  }, [user, location.pathname, navigate, loadPhotosFromSupabaseStorage]);

  // Загружаем фотографии пользователя при изменении пользователя
  useEffect(() => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (user && !isDemoUserLocal) {
      // Сбрасываем флаг при смене пользователя, чтобы уведомление показывалось для каждого пользователя
      setHasShownFirstEntryNotification(false);
      loadUserPhotos();
      // Загружаем фотографии из Supabase Storage
      loadPhotosFromSupabaseStorage();
      // Проверяем завершенные импорты при загрузке страницы (первый вход)
      // Показываем уведомление только при первом входе в студию
      processCompletedPhotoImports(false, true);
    }
  }, [user, loadPhotosFromSupabaseStorage]);

  // Загружаем историю ссылок при загрузке компонента
  useEffect(() => {
    loadUrlHistory();
  }, [loadUrlHistory]);

  // Периодическая проверка завершенных импортов (каждые 12 секунд)
  // Проверяем на всех страницах, чтобы загружать фотографии сразу после того, как n8n их добавит
  // Используем useRef для отслеживания последнего времени проверки, чтобы избежать дубликатов
  useEffect(() => {
    const isDemoUserLocal = localStorage.getItem("demo_user") === "true";
    if (isDemoUserLocal || !user) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Предотвращаем множественные одновременные вызовы
      if (isProcessingRef.current) {
        console.log('processCompletedPhotoImports: уже выполняется, пропускаем');
        return;
      }
      
      // Проверяем, прошло ли достаточно времени с последней проверки (минимум 10 секунд)
      if (now - lastCheckTimeRef.current < 10000) {
        console.log('processCompletedPhotoImports: слишком рано для следующей проверки');
        return;
      }
      
      lastCheckTimeRef.current = now;
      isProcessingRef.current = true;
      
      // Загружаем фотографии из Supabase Storage
      loadPhotosFromSupabaseStorage()
        .then(() => {
          // При периодической проверке не показываем уведомление и не редиректим
          return processCompletedPhotoImports(false, false);
        })
        .finally(() => {
          isProcessingRef.current = false;
        });
    }, 12000); // Проверяем каждые 12 секунд для более быстрой реакции

    return () => clearInterval(interval);
  }, [user, processCompletedPhotoImports, loadPhotosFromSupabaseStorage]);


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
            // Загрузка оригинального файла в Supabase
            originalUrl = await uploadImageToSupabase(
              compressed.originalFile,
              'user-photos',
              'originals',
              user.id
            );

            // Загрузка сжатого файла в Supabase
            compressedUrl = await uploadImageToSupabase(
              compressed.file,
              'user-photos',
              'compressed',
              user.id
            );
          }

          // Сохранение в базу данных только для авторизованных пользователей
          if (!isDemoUserLocal && user) {
            await savePhotoToDatabase({
              userId: user.id,
              originalUrl,
              compressedUrl,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              width: validation.dimensions.width,
              height: validation.dimensions.height,
              qualityScore: validation.qualityScore,
              isValid: validation.isValid
            });
            
            // Обновляем список фотографий пользователя
            await loadUserPhotos();
          }

          processedFiles.push(compressed.file);
        } catch (error) {
          console.error('Ошибка обработки файла:', error);
          errors.push(`${file.name}: Ошибка обработки`);
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

  // Обновляем PhotoHistoryModal для передачи фотографий пользователя
  const handlePhotoHistoryOpen = () => {
    setShowPhotoHistory(true);
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

  // Обработчик выбора фотографии из истории скрапинга (теперь использует общий обработчик)
  const handleSelectFromScrapedHistory = handleSelectFromHistory;

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

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="w-4 h-4" />;
    if (theme === "dark") return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
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
      <div className={`absolute inset-0 backdrop-blur-sm z-[1] ${
        effectiveTheme === 'light' ? 'bg-white/40' : 'bg-black/75'
      }`} />
      <header style={{ height: "clamp(3.5rem, 5vh, 4rem)" }} className="bg-card border-b border-border flex items-center justify-between px-[clamp(1rem,3vw,1.5rem)] flex-shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <AnimatedLogo />
        </div>
        
        <div className="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)]">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger style={{ width: "clamp(7rem, 10vw, 8.125rem)" }} className="bg-secondary border-border text-foreground cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="en" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇬🇧</span>
                  <span>English</span>
                </div>
              </SelectItem>
              <SelectItem value="ru" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇷🇺</span>
                  <span>Русский</span>
                </div>
              </SelectItem>
              <SelectItem value="de" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇩🇪</span>
                  <span>Deutsch</span>
                </div>
              </SelectItem>
              <SelectItem value="pl" className="text-foreground hover:bg-accent">
                <div className="flex items-center">
                  <span className="text-lg mr-2">🇵🇱</span>
                  <span>Polski</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger style={{ width: "clamp(6.5rem, 9vw, 7.5rem)" }} className="bg-secondary border-border text-foreground cursor-pointer">
              <div className="flex items-center gap-2">
                {getThemeIcon()}
                <span className="capitalize">{theme}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="light" className="text-foreground hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  {t("light")}
                </div>
              </SelectItem>
              <SelectItem value="dark" className="text-foreground hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  {t("dark")}
                </div>
              </SelectItem>
              <SelectItem value="system" className="text-foreground hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  {t("system")}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
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
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ 
                              duration: 0.3,
                              delay: index * 0.05
                            }}
                            whileHover={{ scale: 1.02 }}
                            style={{ padding: "clamp(0.375rem, 0.8vw, 0.5rem)" }}
                            className={`rounded-lg transition-all duration-300 relative cursor-pointer ${
                              isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50" : 
                              isSelected ? "border-2 border-primary bg-primary/20" : 
                              "border-2 border-transparent hover:bg-accent/30"
                            }`}
                            onClick={(e) => {
                              // Не обрабатываем клик, если кликнули на чекбокс
                              if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
                                return;
                              }
                              // Находим индекс этой фотографии в displayedScrapedPhotos
                              const displayIndex = displayedScrapedPhotos.findIndex(item => item.originalIndex === index);
                              if (displayIndex !== -1) {
                                setCurrentScrapedPhotoIndex(displayIndex);
                              } else {
                                // Если фотография не в списке отображаемых, устанавливаем индекс 0
                                setCurrentScrapedPhotoIndex(0);
                              }
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
          {displayMode === 'split' && (scrapedPhotos.length > 0 || uploadedProducts.length > 0 || userPhotos.length > 0) ? (
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
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
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
                onMouseEnter={() => setIsHoveringUserPhoto(true)}
                onMouseLeave={() => setIsHoveringUserPhoto(false)}
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
                          className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100"
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

            <AnimatePresence>
              {isRightPanelVisible && (
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 50, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onMouseEnter={() => setIsRightPanelVisible(true)}
                  onMouseLeave={() => setIsRightPanelVisible(false)}
                  style={{ 
                    width: "clamp(5rem, 12vw, 9rem)",
                    height: "clamp(5rem, 12vw, 9rem)",
                    right: "clamp(0.5rem, 1.5vw, 1rem)",
                    top: "clamp(0.5rem, 1.5vh, 1rem)",
                    padding: "clamp(0.4rem, 0.8vw, 0.6rem)"
                  }}
                  className="absolute bg-card/95 border-2 border-border flex flex-col backdrop-blur-sm shadow-2xl rounded-xl overflow-hidden z-40"
                >
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div
                      {...getRootProps()}
                      className={`flex-1 w-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                        isDragActive 
                          ? "border-primary bg-accent/20" 
                          : "border-border hover:border-primary/50 hover:bg-accent/10"
                      } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input {...getInputProps({ id: 'dropzone-input', name: 'dropzoneFile' })} disabled={isUploading} />
                      {isUploading ? (
                        <Loader2 
                          style={{ 
                            width: "clamp(1.5rem, 4vw, 2rem)", 
                            height: "clamp(1.5rem, 4vw, 2rem)" 
                          }}
                          className="text-muted-foreground animate-spin" 
                        />
                      ) : (
                        <Plus 
                          style={{ 
                            width: "clamp(1.5rem, 4vw, 2rem)", 
                            height: "clamp(1.5rem, 4vw, 2rem)" 
                          }}
                          className="text-muted-foreground opacity-60 group-hover:scale-110 group-hover:opacity-90 transition-all" 
                        />
                      )}
                      <p style={{ fontSize: "clamp(0.625rem, 0.8vw, 0.75rem)" }} className="text-muted-foreground text-center mt-1 font-medium px-1">
                        {isUploading ? t("uploading") : (isDragActive ? t("dropHere") : t("addProduct"))}
                      </p>
                    </div>
                    
                    <div className="w-full flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePhotoHistoryOpen}
                        className="flex-1"
                        style={{ 
                          fontSize: "clamp(0.5rem, 0.7vw, 0.625rem)",
                          height: "clamp(1.25rem, 2.5vh, 1.5rem)",
                          padding: "clamp(0.125rem, 0.3vw, 0.25rem)"
                        }}
                      >
                        <History style={{ width: "clamp(0.75rem, 1.5vw, 1rem)", height: "clamp(0.75rem, 1.5vw, 1rem)" }} className="mr-1" />
                        {t("history")} {userPhotos.length > 0 && `(${userPhotos.length})`}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                        className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100"
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
                                isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50" : "border-2 border-transparent hover:bg-accent/30"
                              }`}
                              onClick={() => {
                                // Открываем модальное окно с выбором фотографий
                                handlePhotoHistoryOpen();
                              }}
                            >
                              <img
                                src={photoUrl}
                                alt={photo.name || `Uploaded Photo ${index + 1}`}
                                className="w-full aspect-square object-cover rounded mb-1 pointer-events-none"
                              />
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
                                isCurrentlyDisplayed ? "border-2 border-primary bg-accent/50" : "border-2 border-transparent hover:bg-accent/30"
                              }`}
                              onClick={() => {
                                // Открываем модальное окно с выбором фотографий
                                handlePhotoHistoryOpen();
                              }}
                            >
                              <img
                                src={photoUrl}
                                alt={photo.file_name || `Photo ${index + 1}`}
                                className="w-full aspect-square object-cover rounded mb-1 pointer-events-none"
                                onError={(e) => handleImageError(photo.id, photo, e)}
                              />
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
    </div>
  );
};

export default Studio;