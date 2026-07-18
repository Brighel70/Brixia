-- Create family-player relationships table
CREATE TABLE IF NOT EXISTS public.family_player_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'parent', -- parent, grandparent, guardian, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique relationship per family-player pair
    UNIQUE(family_id, player_id)
);

-- Enable RLS
ALTER TABLE public.family_player_relations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON public.family_player_relations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.family_player_relations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.family_player_relations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.family_player_relations
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_family_player_relations_family_id ON public.family_player_relations(family_id);
CREATE INDEX IF NOT EXISTS idx_family_player_relations_player_id ON public.family_player_relations(player_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_family_player_relations_updated_at 
    BEFORE UPDATE ON public.family_player_relations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();








