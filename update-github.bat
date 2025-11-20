@echo off
echo ========================================
echo Обновление репозитория на GitHub
echo ========================================
echo.

REM Проверка наличия Git
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Git не установлен!
    echo.
    echo Пожалуйста, установите Git:
    echo 1. Скачайте с https://git-scm.com/download/win
    echo 2. Установите Git
    echo 3. Перезапустите этот скрипт
    echo.
    pause
    exit /b 1
)

echo [OK] Git найден
echo.

REM Переход в папку проекта
cd /d "%~dp0"
echo Текущая папка: %CD%
echo.

REM Проверка, инициализирован ли репозиторий
if not exist .git (
    echo Инициализация git репозитория...
    git init
    echo [OK] Репозиторий инициализирован
    echo.
)

REM Проверка remote
git remote get-url origin >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Настройка remote репозитория...
    git remote add origin https://github.com/pastbishe/ad-copy-reforge.git
    echo [OK] Remote добавлен
    echo.
) else (
    echo Проверка remote...
    git remote set-url origin https://github.com/pastbishe/ad-copy-reforge.git
    echo [OK] Remote настроен
    echo.
)

REM Добавление всех файлов
echo Добавление файлов...
git add .
echo [OK] Файлы добавлены
echo.

REM Проверка статуса
echo Текущий статус:
git status --short
echo.

REM Создание коммита
echo Создание коммита...
git commit -m "Update project: improved README, gitignore, and setup instructions"
if %ERRORLEVEL% NEQ 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Нет изменений для коммита или коммит не создан
    echo.
) else (
    echo [OK] Коммит создан
    echo.
)

REM Переименование ветки в main (если нужно)
git branch -M main 2>nul

REM Загрузка на GitHub
echo Загрузка на GitHub...
echo.
echo ВНИМАНИЕ: Если это первый push, может потребоваться авторизация!
echo Используйте Personal Access Token вместо пароля.
echo.
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [УСПЕХ] Проект успешно обновлен на GitHub!
    echo ========================================
    echo.
    echo Репозиторий: https://github.com/pastbishe/ad-copy-reforge
    echo.
) else (
    echo.
    echo ========================================
    echo [ОШИБКА] Не удалось загрузить на GitHub
    echo ========================================
    echo.
    echo Возможные причины:
    echo 1. Нет авторизации - используйте Personal Access Token
    echo 2. Нет прав на запись в репозиторий
    echo 3. Проблемы с сетью
    echo.
    echo Попробуйте выполнить команду вручную:
    echo   git push -u origin main
    echo.
)

pause









