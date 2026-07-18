-- Add is_championship and is_friendly columns to events table if they don't exist

-- Check if columns exist and add them if they don't
DO $$ 
BEGIN
    -- Add is_championship column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'is_championship'
    ) THEN
        ALTER TABLE public.events ADD COLUMN is_championship BOOLEAN DEFAULT false;
    END IF;
    
    -- Add is_friendly column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'is_friendly'
    ) THEN
        ALTER TABLE public.events ADD COLUMN is_friendly BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Update existing events to have is_friendly = true by default
UPDATE public.events 
SET is_friendly = true 
WHERE is_friendly IS NULL;

-- Update existing events to have is_championship = false by default
UPDATE public.events 
SET is_championship = false 
WHERE is_championship IS NULL;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('is_championship', 'is_friendly');








