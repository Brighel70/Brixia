-- Abbreviazione personalizzata per categoria (es. u12, B, C)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS abbreviation text;

COMMENT ON COLUMN categories.abbreviation IS 'Abbreviazione visualizzata per la categoria (es. u12, B, C)';
