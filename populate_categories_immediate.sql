-- ========================================
-- POPOLA IMMEDIATAMENTE LE CATEGORIE MANCANTI
-- ========================================

-- Prima verifica se ci sono categorie
SELECT 'CATEGORIE ESISTENTI:' as info;
SELECT COUNT(*) as total_categories FROM categories;

-- Se non ci sono categorie, inseriscile
INSERT INTO public.categories (id, name, code, sort, active) VALUES
('67609990-54dd-44b0-b962-b239202d1e8d', 'Under 6', 'U6', 1, TRUE),
('9554c543-ba66-4478-b8eb-0068fedb25fc', 'Under 8', 'U8', 2, TRUE),
('edbbd9e2-5e93-457d-946e-7a6c8674ad4c', 'Under 10', 'U10', 3, TRUE),
('72782d07-18a8-4927-86ea-b3de30cd89b6', 'Under 12', 'U12', 4, TRUE),
('e5a4f646-8ac9-4b27-9cf8-731349a6246e', 'Under 14', 'U14', 5, TRUE),
('57be41ad-9f4e-4eaa-afc7-1e2d7a38423c', 'Under 16', 'U16', 6, TRUE),
('d9c82f91-8087-47f5-9b90-9b729572f0e8', 'Under 18', 'U18', 7, TRUE),
('8b23bada-ff67-4d26-93e5-d7bf1bd4933e', 'Under 20', 'U20', 8, TRUE),
('56e1a72e-189d-4dee-b36e-c0da34adbe7c', 'Serie C', 'SERIE_C', 9, TRUE),
('5c8617f7-f5a0-4e87-af5d-1ba89265fdc8', 'Senior', 'SENIOR', 10, TRUE),
('9f27808d-f85f-4df2-8749-043ef440fcc0', 'Serie B', 'SERIE_B', 11, TRUE),
('9a44ff5b-db15-4328-9752-2d8de549e588', 'Seniores', 'SENIORES', 12, FALSE),
('dd497f55-606f-452d-9b14-901a0753ffec', 'Poderosa', 'PODEROSA', 13, TRUE),
('1d5cd67e-30a6-4e11-a7b2-43fc42cdce78', 'GussagOld', 'GUSSAGOLD', 14, TRUE),
('3d9e9aeb-d3c5-4c66-9904-8896bae495bc', 'Brixia Old', 'BRIXIAOLD', 15, TRUE),
('b99e6a40-746e-4316-b16c-9fa5fa52c512', 'Leonesse', 'LEONESSE', 16, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Verifica le categorie inserite
SELECT 'CATEGORIE DOPO INSERIMENTO:' as info;
SELECT COUNT(*) as total_categories FROM categories;
SELECT id, name, code, sort, active FROM categories ORDER BY sort;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ CATEGORIE POPOLATE CON SUCCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Ora dovresti vedere i checkbox delle categorie';
  RAISE NOTICE '📋 Ricarica la pagina per vedere i cambiamenti';
  RAISE NOTICE '';
END $$;








