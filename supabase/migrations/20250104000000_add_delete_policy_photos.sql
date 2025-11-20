-- Migration: Add DELETE policy for photos table
-- This allows users to delete their own photo imports

drop policy if exists "Users can delete own photos" on public.photos;
create policy "Users can delete own photos"
  on public.photos for delete
  using (auth.uid() = user_id);






