-- Add cover_image_url to kanban_columns.
-- Used by Design board for Trello-style column banners.
-- Nullable: non-Design boards simply never populate it.

ALTER TABLE public.kanban_columns
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- No new RLS needed — existing policies cover it:
--   SELECT: can_view_board(auth.uid(), board_id)
--   ALL:    is_admin(auth.uid())
-- CEO/CTO satisfy is_admin, so they can UPDATE the column to set the cover.
