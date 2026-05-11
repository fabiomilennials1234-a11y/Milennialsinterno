-- Add transcript_error column for storing transcription failure messages
ALTER TABLE recorded_meetings ADD COLUMN IF NOT EXISTS transcript_error text;
