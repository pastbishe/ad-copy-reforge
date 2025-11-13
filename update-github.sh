#!/bin/bash

echo "========================================"
echo "Обновление репозитория на GitHub"
echo "========================================"
echo ""

# Проверка наличия Git
if ! command -v git &> /dev/null; then
    echo "[ОШИБКА] Git не установлен!"
    echo ""
    echo "Пожалуйста, установите Git:"
    echo "  macOS: brew install git"
    echo "  Linux: sudo apt-get install git"
    echo ""
    exit 1
fi

echo "[OK] Git найден"
echo ""

# Переход в папку проекта
cd "$(dirname "$0")"
echo "Текущая папка: $(pwd)"
echo ""

# Проверка, инициализирован ли репозиторий
if [ ! -d .git ]; then
    echo "Инициализация git репозитория..."
    git init
    echo "[OK] Репозиторий инициализирован"
    echo ""
fi

# Проверка remote
if ! git remote get-url origin &> /dev/null; then
    echo "Настройка remote репозитория..."
    git remote add origin https://github.com/pastbishe/ad-copy-reforge.git
    echo "[OK] Remote добавлен"
    echo ""
else
    echo "Проверка remote..."
    git remote set-url origin https://github.com/pastbishe/ad-copy-reforge.git
    echo "[OK] Remote настроен"
    echo ""
fi

# Добавление всех файлов
echo "Добавление файлов..."
git add .
echo "[OK] Файлы добавлены"
echo ""

# Проверка статуса
echo "Текущий статус:"
git status --short
echo ""

# Создание коммита
echo "Создание коммита..."
git commit -m "Update project: improved README, gitignore, and setup instructions"
if [ $? -ne 0 ]; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] Нет изменений для коммита или коммит не создан"
    echo ""
else
    echo "[OK] Коммит создан"
    echo ""
fi

# Переименование ветки в main (если нужно)
git branch -M main 2>/dev/null

# Загрузка на GitHub
echo "Загрузка на GitHub..."
echo ""
echo "ВНИМАНИЕ: Если это первый push, может потребоваться авторизация!"
echo "Используйте Personal Access Token вместо пароля."
echo ""
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "[УСПЕХ] Проект успешно обновлен на GitHub!"
    echo "========================================"
    echo ""
    echo "Репозиторий: https://github.com/pastbishe/ad-copy-reforge"
    echo ""
else
    echo ""
    echo "========================================"
    echo "[ОШИБКА] Не удалось загрузить на GitHub"
    echo "========================================"
    echo ""
    echo "Возможные причины:"
    echo "1. Нет авторизации - используйте Personal Access Token"
    echo "2. Нет прав на запись в репозиторий"
    echo "3. Проблемы с сетью"
    echo ""
    echo "Попробуйте выполнить команду вручную:"
    echo "  git push -u origin main"
    echo ""
fi

