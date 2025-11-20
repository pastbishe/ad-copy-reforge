-- Comprehensive migration to fix all DELETE policies for photo tables
-- This ensures users can delete their own photos from all tables

-- ============================================
-- 1. Fix competitor_photos table policies
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.competitor_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policy if it exists (with different possible names)
DROP POLICY IF EXISTS "Users can delete own competitor_photos" ON public.competitor_photos;
DROP POLICY IF EXISTS "users_can_delete_own_competitor_photos" ON public.competitor_photos;

-- Create DELETE policy for competitor_photos
CREATE POLICY "Users can delete own competitor_photos"
ON public.competitor_photos FOR DELETE
USING (auth.uid() = user_id);

-- Ensure SELECT policy exists (needed for deleteCompetitorPhoto to fetch storage_url)
DROP POLICY IF EXISTS "Users can select own competitor_photos" ON public.competitor_photos;
CREATE POLICY "Users can select own competitor_photos"
ON public.competitor_photos FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- 2. Fix photos table policies (imported photos)
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Users can delete own photos" ON public.photos;
DROP POLICY IF EXISTS "users_can_delete_own_photos" ON public.photos;

-- Create DELETE policy for photos
CREATE POLICY "Users can delete own photos"
ON public.photos FOR DELETE
USING (auth.uid() = user_id);

-- Ensure SELECT policy exists
DROP POLICY IF EXISTS "Users can select own photos" ON public.photos;
CREATE POLICY "Users can select own photos"
ON public.photos FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- 3. Fix user_photos table policies
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Users can delete own user_photos" ON public.user_photos;
DROP POLICY IF EXISTS "users_can_delete_own_user_photos" ON public.user_photos;

-- Create DELETE policy for user_photos
CREATE POLICY "Users can delete own user_photos"
ON public.user_photos FOR DELETE
USING (auth.uid() = user_id);

-- Ensure SELECT policy exists
DROP POLICY IF EXISTS "Users can select own user_photos" ON public.user_photos;
CREATE POLICY "Users can select own user_photos"
ON public.user_photos FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON POLICY "Users can delete own competitor_photos" ON public.competitor_photos IS 
'Allows users to delete their own competitor photos. Required for photo deletion functionality.';

COMMENT ON POLICY "Users can delete own photos" ON public.photos IS 
'Allows users to delete their own imported photos. Required for photo deletion functionality.';

COMMENT ON POLICY "Users can delete own user_photos" ON public.user_photos IS 
'Allows users to delete their own uploaded photos. Required for photo deletion functionality.';

