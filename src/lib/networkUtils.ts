/**
 * Утилиты для обработки сетевых ошибок и retry логики
 */

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 секунда
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['Failed to fetch', 'NetworkError', 'Network request failed'],
};

/**
 * Проверяет, является ли ошибка сетевой и может ли быть повторена
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message || error.toString() || '';
  const errorName = error.name || '';

  // Проверяем типичные сетевые ошибки
  const networkErrors = [
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_CONNECTION_RESET',
  ];

  const isNetworkError = networkErrors.some(
    (err) => errorMessage.includes(err) || errorName.includes(err)
  );

  // Проверяем ошибки таймаута (они могут быть повторены)
  const isTimeoutError = 
    errorMessage.includes('timeout') || 
    errorMessage.includes('TIMED_OUT') ||
    errorMessage.includes('превысил') ||
    errorName === 'TimeoutError' ||
    errorName === 'AbortError';

  // Проверяем статус коды
  const status = error.status || error.statusCode || error.code;
  const isRetryableStatus = status && [408, 429, 500, 502, 503, 504].includes(status);

  return isNetworkError || isTimeoutError || isRetryableStatus || false;
}

/**
 * Получает понятное сообщение об ошибке для пользователя
 */
export function getErrorMessage(error: any): string {
  if (!error) return 'Произошла неизвестная ошибка';

  const errorMessage = error.message || error.toString() || '';
  const errorName = error.name || '';

  // Сетевые ошибки
  if (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('Network request failed')
  ) {
    return 'Проблема с подключением к интернету. Проверьте ваше интернет-соединение и попробуйте снова.';
  }

  // Ошибки таймаута
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMED_OUT')) {
    return 'Превышено время ожидания ответа. Сервер не отвечает. Попробуйте позже.';
  }

  // Ошибки авторизации
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    return 'Ошибка авторизации. Пожалуйста, войдите в систему снова.';
  }

  // Ошибки доступа
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return 'У вас нет доступа к этому ресурсу.';
  }

  // Ошибки не найдено
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return 'Запрашиваемый ресурс не найден.';
  }

  // Ошибки сервера
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return 'Ошибка на сервере. Мы уже работаем над её исправлением. Попробуйте позже.';
  }

  // Ошибки Supabase
  if (errorMessage.includes('JWT') || errorMessage.includes('token')) {
    return 'Ошибка авторизации. Пожалуйста, войдите в систему снова.';
  }

  // Если есть понятное сообщение, возвращаем его
  if (errorMessage && !errorMessage.includes('Error:') && errorMessage.length < 200) {
    return errorMessage;
  }

  // Дефолтное сообщение
  return 'Произошла ошибка при выполнении запроса. Попробуйте обновить страницу.';
}

/**
 * Выполняет функцию с retry логикой
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Если это последняя попытка или ошибка не может быть повторена, выбрасываем ошибку
      if (attempt >= opts.maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Ждем перед следующей попыткой (exponential backoff)
      const delay = opts.retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
    }
  }

  throw lastError;
}

/**
 * Обертка для fetch с retry логикой и улучшенной обработкой ошибок
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 секунд таймаут

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Если ответ не успешен, проверяем, нужно ли повторять
      if (!response.ok) {
        const error: any = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;

        // Если статус код указывает на временную ошибку, пробуем повторить
        if (retryOptions.retryableStatuses?.includes(response.status) || 
            [500, 502, 503, 504].includes(response.status)) {
          throw error;
        }

        // Для других ошибок сразу выбрасываем
        throw error;
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Если это ошибка таймаута или отмены, пробуем повторить
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        const timeoutError: any = new Error('Request timeout');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }

      throw error;
    }
  }, retryOptions);
}

/**
 * Обрабатывает ошибку и возвращает понятное сообщение для пользователя
 */
export function handleNetworkError(error: any): { message: string; isRetryable: boolean } {
  const isRetryable = isRetryableError(error);
  const message = getErrorMessage(error);

  // Логируем ошибку для отладки
  if (process.env.NODE_ENV === 'development') {
    console.error('Network error:', {
      error,
      message: error?.message,
      name: error?.name,
      status: error?.status,
      isRetryable,
    });
  }

  return { message, isRetryable };
}

