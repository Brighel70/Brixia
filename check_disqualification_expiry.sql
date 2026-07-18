-- Funzione per controllare e aggiornare automaticamente le squalifiche scadute
-- Questa funzione può essere eseguita periodicamente (es. ogni giorno) per rimuovere
-- automaticamente il flag disqualified quando la data di scadenza è passata

-- Funzione per aggiornare le squalifiche scadute
CREATE OR REPLACE FUNCTION check_and_update_expired_disqualifications()
RETURNS TABLE(
  updated_count INTEGER,
  updated_players TEXT[]
) 
LANGUAGE plpgsql
AS $$
DECLARE
  player_record RECORD;
  updated_players_list TEXT[] := '{}';
  total_updated INTEGER := 0;
BEGIN
  -- Trova tutti i giocatori squalificati con data di scadenza passata
  FOR player_record IN 
    SELECT id, given_name, family_name, disqualification_end_date
    FROM people 
    WHERE disqualified = true 
      AND disqualification_end_date IS NOT NULL 
      AND disqualification_end_date < CURRENT_DATE
  LOOP
    -- Aggiorna il giocatore rimuovendo la squalifica
    UPDATE people 
    SET 
      disqualified = false,
      disqualification_end_date = NULL
    WHERE id = player_record.id;
    
    -- Aggiungi il nome del giocatore alla lista
    updated_players_list := array_append(
      updated_players_list, 
      CONCAT(player_record.given_name, ' ', player_record.family_name)
    );
    
    total_updated := total_updated + 1;
    
    -- Log dell'aggiornamento
    RAISE NOTICE 'Squalifica rimossa per % (ID: %, Data scadenza: %)', 
      CONCAT(player_record.given_name, ' ', player_record.family_name),
      player_record.id,
      player_record.disqualification_end_date;
  END LOOP;
  
  -- Restituisci il risultato
  RETURN QUERY SELECT total_updated, updated_players_list;
END;
$$;

-- Funzione per eseguire il controllo (da chiamare periodicamente)
CREATE OR REPLACE FUNCTION execute_disqualification_check()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  result RECORD;
  message TEXT;
BEGIN
  -- Esegui il controllo delle squalifiche scadute
  SELECT * INTO result FROM check_and_update_expired_disqualifications();
  
  -- Crea il messaggio di risultato
  IF result.updated_count > 0 THEN
    message := CONCAT(
      'Squalifiche aggiornate: ', result.updated_count, 
      ' giocatori. Lista: ', array_to_string(result.updated_players, ', ')
    );
  ELSE
    message := 'Nessuna squalifica scaduta da aggiornare.';
  END IF;
  
  -- Log del risultato
  RAISE NOTICE '%', message;
  
  RETURN message;
END;
$$;

-- Trigger per aggiornare automaticamente quando viene modificata la data di scadenza
CREATE OR REPLACE FUNCTION trigger_check_disqualification_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se la data di scadenza è stata impostata e è nel passato, rimuovi la squalifica
  IF NEW.disqualification_end_date IS NOT NULL 
     AND NEW.disqualification_end_date < CURRENT_DATE 
     AND NEW.disqualified = true THEN
    
    NEW.disqualified := false;
    NEW.disqualification_end_date := NULL;
    
    RAISE NOTICE 'Squalifica automaticamente rimossa per % (ID: %) - data scadenza nel passato', 
      CONCAT(NEW.given_name, ' ', NEW.family_name), NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crea il trigger
DROP TRIGGER IF EXISTS check_disqualification_date_trigger ON people;
CREATE TRIGGER check_disqualification_date_trigger
  BEFORE INSERT OR UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_disqualification_date();

-- Commenti per documentare le funzioni
COMMENT ON FUNCTION check_and_update_expired_disqualifications() IS 'Controlla e aggiorna automaticamente le squalifiche scadute';
COMMENT ON FUNCTION execute_disqualification_check() IS 'Esegue il controllo delle squalifiche e restituisce un messaggio di risultato';
COMMENT ON FUNCTION trigger_check_disqualification_date() IS 'Trigger per controllare automaticamente le date di scadenza delle squalifiche';











