-- Migration: Add DELETE policy for competitor_photos table
-- This allows users to delete their own competitor photos

drop policy if exists "Users can delete own competitor_photos" on public.competitor_photos;
create policy "Users can delete own competitor_photos"
  on public.competitor_photos for delete
  using (auth.uid() = user_id);

