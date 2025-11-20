-- Migration: Add DELETE policy for user_photos table
-- This allows users to delete their own uploaded photos

-- Включаем RLS, если он не включен
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

-- Удаляем старую политику DELETE, если она существует
DROP POLICY IF EXISTS "Users can delete own user_photos" ON public.user_photos;

-- Создаем политику DELETE
CREATE POLICY "Users can delete own user_photos"
ON public.user_photos FOR DELETE
USING (auth.uid() = user_id);

