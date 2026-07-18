-- Elimina le tabelle di supporto alla migrazione people3 → people (non più usate)
DROP TABLE IF EXISTS public.people_migration_audit;
DROP TABLE IF EXISTS public.people3_people_map;
