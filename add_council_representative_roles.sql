-- Aggiunge i ruoli Rappresentante Gussago, Ospitaletto, Brescia
-- (figure ufficiali delle società costituenti che partecipano al consiglio Brixia)

-- 1. Rimuovi il vecchio constraint
ALTER TABLE public.council_members DROP CONSTRAINT IF EXISTS council_members_role_check;

-- 2. Aggiungi il nuovo constraint con i ruoli rappresentanti
ALTER TABLE public.council_members ADD CONSTRAINT council_members_role_check
  CHECK (role IN (
    'president',
    'vice_president',
    'counselor',
    'representative_gussago',
    'representative_ospitaletto',
    'representative_brescia'
  ));

COMMENT ON COLUMN public.council_members.role IS 'Ruolo: president, vice_president, counselor, representative_gussago, representative_ospitaletto, representative_brescia';
