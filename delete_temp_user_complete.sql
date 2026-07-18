-- Script per eliminare completamente l'utente temp@brixiarugby.it
-- Elimina tutti i riferimenti prima di eliminare l'utente

-- =====================================
-- FASE 1: Trova l'ID utente
-- =====================================

DO $$
DECLARE
    user_id_to_delete uuid;
BEGIN
    -- Trova l'ID dell'utente
    SELECT id INTO user_id_to_delete
    FROM auth.users
    WHERE email = 'temp@brixiarugby.it';
    
    IF user_id_to_delete IS NULL THEN
        RAISE NOTICE '⚠️ Utente temp@brixiarugby.it non trovato in auth.users';
        RETURN;
    END IF;
    
    RAISE NOTICE '🆔 ID utente da eliminare: %', user_id_to_delete;
    
    -- =====================================
    -- FASE 2: Elimina tutti i riferimenti
    -- =====================================
    
    -- Elimina da staff_categories
    DELETE FROM staff_categories WHERE user_id = user_id_to_delete;
    RAISE NOTICE '✅ Rimosso da staff_categories';
    
    -- Elimina da user_permissions
    DELETE FROM user_permissions WHERE user_id = user_id_to_delete;
    RAISE NOTICE '✅ Rimosso da user_permissions';
    
    -- Elimina da role_permissions (se esiste)
    -- DELETE FROM role_permissions WHERE role_id IN (SELECT user_role_id FROM profiles WHERE id = user_id_to_delete);
    
    -- Elimina il profilo
    DELETE FROM profiles WHERE id = user_id_to_delete;
    RAISE NOTICE '✅ Profilo eliminato';
    
    -- Elimina eventuali riferimenti in altre tabelle
    -- (Aggiungi qui altre tabelle se necessario)
    
    -- =====================================
    -- FASE 3: Elimina l'utente da auth.users
    -- =====================================
    
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    RAISE NOTICE '✅ Utente eliminato da auth.users';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Utente temp@brixiarugby.it eliminato completamente!';
    
END $$;

-- =====================================
-- FASE 4: Verifica eliminazione
-- =====================================

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'temp@brixiarugby.it') 
    THEN '❌ Utente ancora presente'
    ELSE '✅ Utente eliminato con successo'
  END as status;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE email = 'temp@brixiarugby.it') 
    THEN '❌ Profilo ancora presente'
    ELSE '✅ Profilo eliminato con successo'
  END as status;
