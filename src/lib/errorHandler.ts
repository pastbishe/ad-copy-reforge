/**
 * Глобальная обработка ошибок для приложения
 * Логирует все ошибки и предотвращает полное падение приложения
 */

import { handleNetworkError, isRetryableError } from './networkUtils';

interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  source: 'unhandledRejection' | 'error' | 'react' | 'network';
  url?: string;
  userAgent?: string;
  userId?: string;
  userMessage?: string;
  isRetryable?: boolean;
}

class ErrorHandler {
  private maxLogs = 50;
  private logs: ErrorLog[] = [];

  constructor() {
    this.setupGlobalHandlers();
  }

  /**
   * Настройка глобальных обработчиков ошибок
   */
  private setupGlobalHandlers() {
    // Обработка необработанных ошибок
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        source: 'error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Обработка необработанных промисов
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      this.handleError({
        message: error?.message || 'Unhandled promise rejection',
        stack: error?.stack,
        source: 'unhandledRejection',
      });
      
      // Предотвращаем вывод ошибки в консоль браузера
      event.preventDefault();
    });

    // Обработка ошибок загрузки ресурсов
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        if (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK') {
          this.handleError({
            message: `Failed to load resource: ${(target as HTMLImageElement).src || (target as HTMLLinkElement).href}`,
            source: 'network',
          });
        }
      }
    }, true);
  }

  /**
   * Обработка ошибки
   */
  private handleError(error: {
    message: string;
    stack?: string;
    source: ErrorLog['source'];
    filename?: string;
    lineno?: number;
    colno?: number;
  }) {
    // Обрабатываем сетевые ошибки специальным образом
    const networkErrorInfo = handleNetworkError(error);
    const isNetwork = isRetryableError(error);
    
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      source: isNetwork ? 'network' : error.source,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userMessage: networkErrorInfo.message,
      isRetryable: networkErrorInfo.isRetryable,
    };

    // Получаем userId из localStorage если доступен
    try {
      const session = localStorage.getItem('sb-ticugdxpzglbpymvfnyj-auth-token');
      if (session) {
        const parsed = JSON.parse(session);
        errorLog.userId = parsed?.user?.id;
      }
    } catch {
      // Игнорируем ошибки парсинга
    }

    // Логируем в консоль для разработки
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorHandler caught:', errorLog);
    }

    // Сохраняем в память
    this.logs.push(errorLog);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Сохраняем в localStorage
    this.saveToLocalStorage(errorLog);

    // Не выбрасываем ошибку дальше, чтобы не падало приложение
    return true;
  }

  /**
   * Сохранение ошибки в localStorage
   */
  private saveToLocalStorage(errorLog: ErrorLog) {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('appErrorLogs') || '[]');
      existingLogs.push(errorLog);
      
      // Храним только последние 50 ошибок
      const recentLogs = existingLogs.slice(-this.maxLogs);
      localStorage.setItem('appErrorLogs', JSON.stringify(recentLogs));
    } catch (error) {
      console.error('Failed to save error to localStorage:', error);
    }
  }

  /**
   * Получить все логи ошибок
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Получить логи из localStorage
   */
  getStoredLogs(): ErrorLog[] {
    try {
      return JSON.parse(localStorage.getItem('appErrorLogs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Очистить логи
   */
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('appErrorLogs');
  }

  /**
   * Логировать ошибку вручную
   */
  logError(message: string, error?: Error, source: ErrorLog['source'] = 'react') {
    this.handleError({
      message,
      stack: error?.stack,
      source,
    });
  }
}

// Создаем единственный экземпляр обработчика ошибок
export const errorHandler = new ErrorHandler();

// Экспортируем функцию для ручного логирования
export const logError = (message: string, error?: Error) => {
  errorHandler.logError(message, error);
};

