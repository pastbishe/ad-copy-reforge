import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
