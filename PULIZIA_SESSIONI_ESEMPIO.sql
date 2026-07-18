-- =====================================================
-- SCRIPT PULIZIA SESSIONI DI ESEMPIO
-- =====================================================
--
-- ATTENZIONE: Questo script elimina TUTTE le sessioni
-- esistenti per permettere di ricrearle con il nuovo
-- sistema automatico basato su training_locations.
--
-- IMPORTANTE: Esegui SOLO se sei sicuro che le sessioni
-- attuali sono solo esempi senza dati di presenza importanti!
--
-- Se hai già presenze registrate, NON eseguire questo script!
-- =====================================================

-- 1. VERIFICA: Conta le sessioni esistenti
SELECT 
  c.name as categoria,
  COUNT(s.id) as numero_sessioni,
  MIN(s.session_date) as prima_sessione,
  MAX(s.session_date) as ultima_sessione
FROM sessions s
JOIN categories c ON s.category_id = c.id
GROUP BY c.name
ORDER BY c.name;

-- 2. VERIFICA: Conta le presenze registrate
SELECT 
  c.name as categoria,
  COUNT(DISTINCT a.session_id) as sessioni_con_presenze,
  COUNT(a.id) as numero_presenze
FROM attendance a
JOIN sessions s ON a.session_id = s.id
JOIN categories c ON s.category_id = c.id
GROUP BY c.name
ORDER BY c.name;

-- =====================================================
-- SE HAI VERIFICATO CHE NON CI SONO PRESENZE IMPORTANTI,
-- DECOMENTA E ESEGUI IL BLOCCO SEGUENTE:
-- =====================================================

/*
-- 3. ELIMINA PRESENZE ASSOCIATE (se esistono)
DELETE FROM attendance 
WHERE session_id IN (SELECT id FROM sessions);

-- 4. ELIMINA TUTTE LE SESSIONI
DELETE FROM sessions;

-- 5. VERIFICA PULIZIA
SELECT 
  'Sessioni rimanenti' as tipo,
  COUNT(*) as conteggio
FROM sessions

UNION ALL

SELECT 
  'Presenze rimanenti' as tipo,
  COUNT(*) as conteggio
FROM attendance;

-- Output atteso: 0 per entrambi
*/

-- =====================================================
-- DOPO LA PULIZIA
-- =====================================================
--
-- 1. Vai nella web app su "Attività" o "Settings"
-- 2. Per ogni categoria, configura i giorni/orari/location
--    usando il componente "Training Locations Manager"
-- 3. Torna su "Attività" e clicca "Crea Allenamenti Automatici"
-- 4. Il sistema creerà le sessioni seguendo la configurazione!
--
-- =====================================================




