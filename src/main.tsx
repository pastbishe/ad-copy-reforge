import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Инициализируем глобальную обработку ошибок
import "./lib/errorHandler";

// Проверяем наличие корневого элемента
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found. Make sure there is a div with id='root' in your HTML.");
}

// Создаем корневой элемент React
const root = createRoot(rootElement);

// Рендерим приложение с обработкой ошибок
try {
  root.render(<App />);
} catch (error) {
  console.error("Failed to render app:", error);
  // Показываем сообщение об ошибке пользователю
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; padding: 20px; text-align: center;">
      <h1 style="color: #ef4444; margin-bottom: 16px;">Ошибка загрузки приложения</h1>
      <p style="margin-bottom: 24px;">Пожалуйста, перезагрузите страницу.</p>
      <button onclick="window.location.reload()" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
        Перезагрузить страницу
      </button>
    </div>
  `;
}
