import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Плагин для установки разрешающего CSP в режиме разработки
// В режиме разработки разрешаем все для работы Vite HMR
const cspPlugin = () => ({
  name: 'csp-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      // Устанавливаем разрешающий CSP заголовок только для HTML документов
      // В режиме разработки разрешаем unsafe-eval для Vite HMR
      if (_req.url === '/' || _req.url?.endsWith('.html') || (!_req.url?.includes('.') && _req.url !== '/favicon.ico')) {
        res.setHeader('Content-Security-Policy', 
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "script-src * 'unsafe-inline' 'unsafe-eval'; " +
          "connect-src * ws: wss:; " +
          "img-src * data: blob:; " +
          "style-src * 'unsafe-inline'; " +
          "font-src * data:;"
        );
      }
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      // Включаем Hot Module Replacement для мгновенного обновления
      overlay: true,
    },
    // Настройки для автообновления
    watch: {
      // Интервал проверки изменений файлов (в миллисекундах)
      interval: 5000, // 5 секунд
      // Включаем polling для более надежного отслеживания изменений
      usePolling: true,
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    mode === "development" && cspPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
