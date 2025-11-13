import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X, Trash2, Upload, AlertCircle, CheckCircle, Image as ImageIcon, RefreshCw, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { getUserPhotos, deleteUserPhoto } from '@/lib/imageUtils';
import { getCombinedPhotoHistory, deleteCompetitorPhoto, deletePhotoImport } from '@/lib/scrapingUtils';
import { supabase } from '@/integrations/supabase/client';

export interface PhotoHistoryItem {
  id: string;
  original_url: string;
  compressed_url?: string;
  file_name: string;
  file_size: number;
  width?: number;
  height?: number;
  quality_score?: number;
  is_valid: boolean;
  created_at: string;
  source?: 'user' | 'competitor';
  type?: 'user' | 'competitor';
}

interface PhotoHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: (photo: PhotoHistoryItem) => void;
  userPhotos?: PhotoHistoryItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const PhotoHistoryModal: React.FC<PhotoHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectPhoto,
  userPhotos = [],
  isLoading = false,
  onRefresh
}) => {
  const [photos, setPhotos] = useState<PhotoHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'user' | 'competitor'>('all');
  const { toast } = useToast();
  const { t } = useLanguage();

  // Обновляем фотографии при изменении userPhotos
  // Если userPhotos переданы через props, помечаем их как загруженные пользователем
  useEffect(() => {
    if (userPhotos.length > 0) {
      const photosWithSource = userPhotos.map(photo => ({
        ...photo,
        source: photo.source || 'user',
        type: photo.type || 'user'
      }));
      setPhotos(photosWithSource);
    }
  }, [userPhotos]);

  // Загружаем фотографии при открытии модального окна, если не переданы извне
  useEffect(() => {
    if (isOpen && userPhotos.length === 0) {
      loadPhotos();
    }
  }, [isOpen, userPhotos.length]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      
      // Проверяем, является ли пользователь демо-пользователем
      const isDemoUser = localStorage.getItem("demo_user") === "true";
      
      if (isDemoUser) {
        // Для демо-пользователей показываем пустой список
        setPhotos([]);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast({
          title: t("error"),
          description: t("authRequired"),
          variant: "destructive",
        });
        return;
      }

      // Загружаем объединенную историю (user_photos + competitor_photos)
      const combinedPhotos = await getCombinedPhotoHistory(session.user.id, 50);
      setPhotos(combinedPhotos);
    } catch (error) {
      console.error('Ошибка загрузки фотографий:', error);
      toast({
        title: t("error"),
        description: t("failedToLoadPhoto"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      setDeletingId(photoId);
      
      // Находим фотографию, чтобы определить её тип
      const photo = photos.find(p => p.id === photoId);
      if (!photo) {
        throw new Error('Фотография не найдена');
      }

      // Определяем тип фотографии и вызываем соответствующую функцию удаления
      if (photo.source === 'user' || photo.type === 'user') {
        // Фотография из user_photos
        await deleteUserPhoto(photoId);
      } else if (photo.source === 'competitor' || photo.type === 'competitor') {
        // Проверяем, является ли это импортированной фотографией из таблицы photos
        // Импортированные фотографии имеют ID в формате `${importItem.id}-${photoUrl}`
        if (photoId.includes('-') && photoId.split('-').length > 1) {
          // Это импортированная фотография из таблицы photos
          // Извлекаем UUID из составного ID (часть до первого дефиса после UUID)
          const uuidMatch = photoId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (uuidMatch) {
            const actualId = uuidMatch[1];
            await deletePhotoImport(actualId);
          } else {
            // Если не удалось извлечь UUID, пытаемся удалить как competitor_photo
            // Проверяем, является ли ID числом (competitor_photos использует bigserial)
            const numericId = parseInt(photoId, 10);
            if (!isNaN(numericId)) {
              await deleteCompetitorPhoto(numericId);
            } else {
              throw new Error('Неверный формат ID фотографии');
            }
          }
        } else {
          // Это фотография из competitor_photos (ID - число)
          const numericId = parseInt(photoId, 10);
          if (isNaN(numericId)) {
            throw new Error('Неверный формат ID фотографии конкурента');
          }
          await deleteCompetitorPhoto(numericId);
        }
      } else {
        // По умолчанию пытаемся удалить как user_photo
        await deleteUserPhoto(photoId);
      }
      
      setPhotos(prev => prev.filter(photo => photo.id !== photoId));
      
      // Обновляем список в родительском компоненте
      if (onRefresh) {
        onRefresh();
      }
      
      toast({
        title: t("success"),
        description: t("photoDeleted"),
      });
    } catch (error) {
      console.error('Ошибка удаления фотографии:', error);
      toast({
        title: t("error"),
        description: t("failedToDeletePhoto") || "Не удалось удалить фотографию",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getQualityColor = (score?: number): string => {
    if (!score) return 'text-gray-500';
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getQualityText = (score?: number): string => {
    if (!score) return t("unknown");
    if (score >= 0.8) return t("excellent");
    if (score >= 0.6) return t("good");
    if (score >= 0.4) return t("satisfactory");
    return t("poor");
  };

  // Разделяем фотографии по источникам
  const { userPhotos: userPhotosList, competitorPhotos: competitorPhotosList } = useMemo(() => {
    const user = photos.filter(photo => photo.source === 'user' || photo.type === 'user');
    const competitor = photos.filter(photo => photo.source === 'competitor' || photo.type === 'competitor');
    return { userPhotos: user, competitorPhotos: competitor };
  }, [photos]);

  // Фильтруем фотографии по выбранной вкладке
  const filteredPhotos = useMemo(() => {
    switch (activeTab) {
      case 'user':
        return userPhotosList;
      case 'competitor':
        return competitorPhotosList;
      default:
        return photos;
    }
  }, [activeTab, photos, userPhotosList, competitorPhotosList]);

  // Сбрасываем вкладку и выбранные фотографии при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setActiveTab('all');
      setSelectedPhotos(new Set());
    }
  }, [isOpen]);

  // Обработчик выбора/снятия выбора фотографии
  const handleTogglePhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // Выбрать все фотографии в текущей вкладке
  const handleSelectAll = () => {
    if (selectedPhotos.size === filteredPhotos.length) {
      // Снять выбор со всех
      setSelectedPhotos(new Set());
    } else {
      // Выбрать все
      setSelectedPhotos(new Set(filteredPhotos.map(photo => photo.id)));
    }
  };

  // Удалить выбранные фотографии
  const handleDeleteSelected = async () => {
    if (selectedPhotos.size === 0) return;

    const selectedArray = Array.from(selectedPhotos);
    setDeletingIds(new Set(selectedArray));

    try {
      // Удаляем фотографии по одной, определяя тип каждой
      const deletePromises = selectedArray.map(async (photoId) => {
        const photo = photos.find(p => p.id === photoId);
        if (!photo) {
          throw new Error(`Фотография с ID ${photoId} не найдена`);
        }

        if (photo.source === 'user' || photo.type === 'user') {
          // Фотография из user_photos
          await deleteUserPhoto(photoId);
        } else if (photo.source === 'competitor' || photo.type === 'competitor') {
          // Проверяем, является ли это импортированной фотографией из таблицы photos
          if (photoId.includes('-') && photoId.split('-').length > 1) {
            // Это импортированная фотография из таблицы photos
            const uuidMatch = photoId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (uuidMatch) {
              const actualId = uuidMatch[1];
              await deletePhotoImport(actualId);
            } else {
              // Если не удалось извлечь UUID, пытаемся удалить как competitor_photo
              const numericId = parseInt(photoId, 10);
              if (!isNaN(numericId)) {
                await deleteCompetitorPhoto(numericId);
              } else {
                throw new Error(`Неверный формат ID фотографии: ${photoId}`);
              }
            }
          } else {
            // Это фотография из competitor_photos (ID - число)
            const numericId = parseInt(photoId, 10);
            if (isNaN(numericId)) {
              throw new Error(`Неверный формат ID фотографии конкурента: ${photoId}`);
            }
            await deleteCompetitorPhoto(numericId);
          }
        } else {
          // По умолчанию пытаемся удалить как user_photo
          await deleteUserPhoto(photoId);
        }
      });

      await Promise.all(deletePromises);

      // Удаляем из списка
      setPhotos(prev => prev.filter(photo => !selectedPhotos.has(photo.id)));
      
      // Очищаем выбор
      setSelectedPhotos(new Set());

      // Обновляем список в родительском компоненте
      if (onRefresh) {
        onRefresh();
      }

      toast({
        title: t("success"),
        description: `${selectedArray.length} ${t("photoDeleted")}`,
      });
    } catch (error) {
      console.error('Ошибка удаления фотографий:', error);
      toast({
        title: t("error"),
        description: t("failedToDeletePhotos") || "Не удалось удалить фотографии",
        variant: "destructive",
      });
    } finally {
      setDeletingIds(new Set());
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-primary/10 to-secondary/10">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ImageIcon className="w-6 h-6" />
                {t("photoHistory")}
              </h2>
              <p className="text-muted-foreground mt-1">
                {t("photoHistoryDesc")}
              </p>
            </div>
            <div className="flex gap-2">
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  className="hover:bg-accent"
                  disabled={loading || isLoading}
                >
                  <RefreshCw className={`w-5 h-5 ${(loading || isLoading) ? 'animate-spin' : ''}`} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-accent"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading || isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">{t("loadingPhotos")}</span>
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {localStorage.getItem("demo_user") === "true" ? t("demoMode") : t("historyEmpty")}
                </h3>
                <p className="text-muted-foreground">
                  {localStorage.getItem("demo_user") === "true" 
                    ? t("demoModeDesc") 
                    : t("historyEmptyDesc")
                  }
                </p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'user' | 'competitor')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="all" className="flex items-center gap-2 text-xs sm:text-sm">
                    <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{t("allPhotos")}</span>
                    <span className="flex-shrink-0">({photos.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="user" className="flex items-center gap-2 text-xs sm:text-sm">
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{t("uploadedPhotos")}</span>
                    <span className="flex-shrink-0">({userPhotosList.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="competitor" className="flex items-center gap-2 text-xs sm:text-sm">
                    <LinkIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{t("importedPhotos")}</span>
                    <span className="flex-shrink-0">({competitorPhotosList.length})</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  {/* Панель действий с выбором и удалением */}
                  {filteredPhotos.length > 0 && (
                    <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg border border-border">
                      <label 
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={(e) => {
                          // Если клик был на чекбоксе, не обрабатываем здесь (он обработается через onCheckedChange)
                          const target = e.target as HTMLElement;
                          if (target.closest('[role="checkbox"]') || target.closest('button') || target.tagName === 'BUTTON') {
                            return;
                          }
                          handleSelectAll();
                        }}
                      >
                        <Checkbox
                          checked={selectedPhotos.size > 0 && selectedPhotos.size === filteredPhotos.length}
                          onCheckedChange={handleSelectAll}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span className="text-sm text-foreground font-medium">
                          {selectedPhotos.size > 0 
                            ? `${t("selected")}: ${selectedPhotos.size} / ${filteredPhotos.length}`
                            : t("selectAll")
                          }
                        </span>
                      </label>
                      {selectedPhotos.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteSelected}
                          disabled={deletingIds.size > 0}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("deletePhoto")} ({selectedPhotos.size})
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {filteredPhotos.length === 0 ? (
                    <div className="text-center py-12">
                      <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {activeTab === 'user' 
                          ? t("noUploadedPhotos")
                          : activeTab === 'competitor'
                          ? t("noImportedPhotos")
                          : t("historyEmpty")
                        }
                      </h3>
                      <p className="text-muted-foreground">
                        {activeTab === 'user'
                          ? t("noUploadedPhotosDesc")
                          : activeTab === 'competitor'
                          ? t("noImportedPhotosDesc")
                          : t("historyEmptyDesc")
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredPhotos.map((photo) => {
                        const isSelected = selectedPhotos.has(photo.id);
                        const isDeleting = deletingId === photo.id || deletingIds.has(photo.id);
                        
                        return (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group relative bg-background border-2 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer ${
                      isSelected 
                        ? 'border-primary bg-primary/10 shadow-lg' 
                        : 'border-border hover:border-primary/50'
                    } ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => handleTogglePhoto(photo.id)}
                  >
                    {/* Checkbox */}
                    <div className="absolute top-2 right-2 z-20">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleTogglePhoto(photo.id)}
                        className="bg-background/90 backdrop-blur-sm border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* Image */}
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={photo.compressed_url || photo.original_url}
                        alt={photo.file_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = photo.original_url;
                        }}
                      />
                      
                      {/* Source indicator */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {(photo.source === 'competitor' || photo.type === 'competitor') && (
                          <div className="flex items-center gap-1 bg-blue-500/90 text-white px-2 py-1 rounded-full text-xs">
                            <LinkIcon className="w-3 h-3" />
                            <span>{t("imported")}</span>
                          </div>
                        )}
                        {(photo.source === 'user' || photo.type === 'user') && (
                          <div className="flex items-center gap-1 bg-purple-500/90 text-white px-2 py-1 rounded-full text-xs">
                            <Upload className="w-3 h-3" />
                            <span>{t("uploaded")}</span>
                          </div>
                        )}
                        {/* Quality indicator */}
                        {photo.is_valid ? (
                          <div className="flex items-center gap-1 bg-green-500/90 text-white px-2 py-1 rounded-full text-xs">
                            <CheckCircle className="w-3 h-3" />
                            <span className={getQualityColor(photo.quality_score)}>
                              {getQualityText(photo.quality_score)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-red-500/90 text-white px-2 py-1 rounded-full text-xs">
                            <AlertCircle className="w-3 h-3" />
                            <span>{t("invalid")}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPhoto(photo);
                          }}
                          className="bg-primary hover:bg-primary/90 text-white"
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          {t("selectPhoto")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id);
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className="font-medium text-foreground text-sm truncate mb-1">
                        {photo.file_name}
                      </h4>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>{t("size")}:</span>
                          <span>{formatFileSize(photo.file_size)}</span>
                        </div>
                        {photo.width && photo.height && (
                          <div className="flex justify-between">
                            <span>{t("resolution")}:</span>
                            <span>{photo.width}×{photo.height}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>{t("date")}:</span>
                          <span>{formatDate(photo.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
            <div className="text-sm text-muted-foreground flex gap-4">
              {photos.length > 0 && (
                <>
                  <span>{t("photosFound")}: {photos.length}</span>
                  {userPhotosList.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      {userPhotosList.length} {t("uploaded")}
                    </span>
                  )}
                  {competitorPhotosList.length > 0 && (
                    <span className="flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" />
                      {competitorPhotosList.length} {t("imported")}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("close")}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
