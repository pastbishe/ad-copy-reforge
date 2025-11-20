import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Trash2, Image as ImageIcon, Calendar, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getUserGenerations, deleteGeneration, type GeneratedPhoto } from '@/lib/generationUtils';
import { supabase } from '@/integrations/supabase/client';

const History = () => {
  const [generations, setGenerations] = useState<GeneratedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadGenerations();
    }
  }, [user]);

  const loadGenerations = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const data = await getUserGenerations(user.id);
      setGenerations(data);
    } catch (error) {
      console.error('Ошибка загрузки генераций:', error);
      toast({
        title: t("error") || "Ошибка",
        description: t("failedToLoadGenerations") || "Не удалось загрузить историю генераций",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (generationId: string) => {
    if (!user) return;

    try {
      setDeletingId(generationId);
      const success = await deleteGeneration(generationId, user.id);
      
      if (success) {
        setGenerations(prev => prev.filter(g => g.id !== generationId));
        toast({
          title: t("deleted") || "Удалено",
          description: t("generationDeleted") || "Генерация удалена",
        });
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Ошибка удаления генерации:', error);
      toast({
        title: t("error") || "Ошибка",
        description: t("failedToDeleteGeneration") || "Не удалось удалить генерацию",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (url: string, variant: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated_variant_${variant}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t("downloadStarted") || "Загрузка началась",
      description: t("downloadStartedDesc") || "Ваше изображение загружается",
    });
  };

  // Получаем информацию о скрапленном фото и пользовательском фото
  const getPhotoInfo = async (generation: GeneratedPhoto) => {
    try {
      // Получаем информацию о пользовательском фото
      const { data: userPhoto } = await supabase
        .from('user_photos')
        .select('file_name, original_url')
        .eq('id', generation.user_photo_id)
        .single();

      return {
        userPhotoName: userPhoto?.file_name || 'Unknown',
        userPhotoUrl: userPhoto?.original_url || null
      };
    } catch (error) {
      console.error('Ошибка получения информации о фото:', error);
      return {
        userPhotoName: 'Unknown',
        userPhotoUrl: null
      };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t("loading") || "Загрузка..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">{t("generationHistory") || "История генераций"}</h1>
          </div>
        </div>

        {generations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-2">
                {t("noGenerations") || "Нет генераций"}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {t("noGenerationsDesc") || "Вы еще не создали ни одной объединенной фотографии"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generations.map((generation) => (
              <GenerationCard
                key={generation.id}
                generation={generation}
                onDelete={handleDelete}
                onDownload={handleDownload}
                isDeleting={deletingId === generation.id}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface GenerationCardProps {
  generation: GeneratedPhoto;
  onDelete: (id: string) => void;
  onDownload: (url: string, variant: number) => void;
  isDeleting: boolean;
  t: (key: string) => string | undefined;
}

const GenerationCard: React.FC<GenerationCardProps> = ({
  generation,
  onDelete,
  onDownload,
  isDeleting,
  t
}) => {
  const [photoInfo, setPhotoInfo] = useState<{ userPhotoName: string; userPhotoUrl: string | null } | null>(null);

  useEffect(() => {
    const loadPhotoInfo = async () => {
      try {
        const { data: userPhoto } = await supabase
          .from('user_photos')
          .select('file_name, original_url')
          .eq('id', generation.user_photo_id)
          .single();

        setPhotoInfo({
          userPhotoName: userPhoto?.file_name || 'Unknown',
          userPhotoUrl: userPhoto?.original_url || null
        });
      } catch (error) {
        console.error('Ошибка загрузки информации о фото:', error);
        setPhotoInfo({
          userPhotoName: 'Unknown',
          userPhotoUrl: null
        });
      }
    };

    loadPhotoInfo();
  }, [generation.user_photo_id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-1">
                {t("generation") || "Генерация"}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 text-xs">
                <Calendar className="w-3 h-3" />
                {formatDate(generation.created_at)}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(generation.id)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {generation.status === 'completed' && generation.generated_urls.length > 0 ? (
            <div className="space-y-4">
              {/* Информация о фото */}
              {photoInfo && (
                <div className="text-xs text-muted-foreground">
                  <p className="truncate">
                    {t("userPhoto") || "Ваше фото"}: {photoInfo.userPhotoName}
                  </p>
                </div>
              )}

              {/* Grid с вариантами */}
              <div className="grid grid-cols-3 gap-2">
                {generation.generated_urls.map((url, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative group aspect-square rounded-lg overflow-hidden border"
                  >
                    <img
                      src={url}
                      alt={`Variant ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDownload(url, index + 1)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {t("download") || "Скачать"}
                      </Button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {t("variant") || "Вариант"} {index + 1}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : generation.status === 'processing' ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("processing") || "Обработка..."}
                </p>
              </div>
            </div>
          ) : generation.status === 'failed' ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-sm text-destructive mb-2">
                  {t("generationFailed") || "Генерация не удалась"}
                </p>
                {generation.error_message && (
                  <p className="text-xs text-muted-foreground">
                    {generation.error_message}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                {t("pending") || "Ожидание..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default History;

