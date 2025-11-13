-- Быстрое исправление: сделать колонку photo_url nullable
-- Выполните этот SQL в Supabase SQL Editor

-- Простое решение: убираем ограничение NOT NULL с колонки photo_url
ALTER TABLE public.photos ALTER COLUMN photo_url DROP NOT NULL;

-- Если колонка photo_url не существует, создаем её как nullable
-- (Этот код выполнится только если колонки нет, благодаря IF NOT EXISTS в миграции)

