import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Image as ImageIcon, Download, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { getGenerationStatus, type GeneratedPhoto } from '@/lib/generationUtils';

interface GenerationProgressProps {
  generationId: string;
  onComplete: (generatedUrls: string[]) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  generationId,
  onComplete,
  onError,
  onCancel
}) => {
  const [status, setStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [progress, setProgress] = useState(0);
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let pollCount = 0;
    const maxPolls = 120; // 2 минуты максимум
    const pollInterval = 2000; // 2 секунды

    const pollStatus = async () => {
      try {
        const generation = await getGenerationStatus(generationId);
        
        if (!generation) {
          setStatus('failed');
          setErrorMessage('Generation record not found');
          onError('Generation record not found');
          return;
        }

        setStatus(generation.status);
        
        if (generation.status === 'completed') {
          setGeneratedUrls(generation.generated_urls || []);
          setProgress(100);
          onComplete(generation.generated_urls || []);
          return;
        }

        if (generation.status === 'failed') {
          setErrorMessage(generation.error_message || 'Generation failed');
          setProgress(0);
          onError(generation.error_message || 'Generation failed');
          return;
        }

        // Обновляем прогресс (симуляция, так как реальный прогресс не доступен)
        if (generation.status === 'processing') {
          const estimatedProgress = Math.min(30 + (pollCount * 2), 90);
          setProgress(estimatedProgress);
        }

        pollCount++;
        if (pollCount >= maxPolls) {
          setStatus('failed');
          setErrorMessage('Generation timeout');
          onError('Generation timeout');
          return;
        }
      } catch (error) {
        console.error('Error polling generation status:', error);
        if (pollCount >= 3) {
          setStatus('failed');
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
          onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    };

    // Начинаем polling
    pollStatus();
    intervalId = setInterval(pollStatus, pollInterval);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [generationId, onComplete, onError]);

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated_variant_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: t("downloadStarted") || "Download started",
      description: t("downloadStartedDesc") || "Your image is being downloaded",
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">
          {t("generatingPhotos") || "Generating Photos"}
        </h2>
      </div>

      {/* Прогресс бар */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {status === 'processing' && (t("processing") || "Processing...")}
            {status === 'completed' && (t("completed") || "Completed!")}
            {status === 'failed' && (t("failed") || "Failed")}
            {status === 'pending' && (t("starting") || "Starting...")}
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Статус индикатор */}
      <AnimatePresence mode="wait">
        {status === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 bg-muted rounded-lg"
          >
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("generatingVariants") || "Generating 3 variants of your merged photo. This may take a minute..."}
            </p>
          </motion.div>
        )}

        {status === 'completed' && generatedUrls.length > 0 && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                {t("generationCompleted") || "Generation completed successfully!"}
              </p>
            </div>

            {/* Grid с результатами */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {generatedUrls.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group rounded-lg overflow-hidden border bg-card"
                >
                  <div className="aspect-square relative">
                    <img
                      src={url}
                      alt={`Generated variant ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDownload(url, index)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {t("download") || "Download"}
                      </Button>
                    </div>
                  </div>
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    {t("variant") || "Variant"} {index + 1}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
          >
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                {t("generationFailed") || "Generation failed"}
              </p>
              {errorMessage && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  {errorMessage}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопка отмены (только во время обработки) */}
      {status === 'processing' && onCancel && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            {t("cancel") || "Cancel"}
          </Button>
        </div>
      )}
    </div>
  );
};

