-- Fix waiting_list modality CHECK constraint
-- The existing constraint doesn't accept 'corte'/'barba' which the app uses.
-- Drop and recreate with the correct allowed values.

ALTER TABLE waiting_list
  DROP CONSTRAINT IF EXISTS waiting_list_modality_check;

ALTER TABLE waiting_list
  ADD CONSTRAINT waiting_list_modality_check CHECK (modality IS NULL OR char_length(modality) > 0);
