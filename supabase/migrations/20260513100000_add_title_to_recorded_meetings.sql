-- Add title column to recorded_meetings for browser-recorded meetings.
-- Previously the title was collected in the UI but never persisted.
ALTER TABLE recorded_meetings ADD COLUMN IF NOT EXISTS title text;
