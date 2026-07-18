-- Inserisce il template "Sollecito quota scaduta" per WhatsApp (se non esiste)
-- Placeholder sostituiti automaticamente all'invio:
--   [inserisci importo della quota] = importo (es. € 150,00)
--   [data_scadenza] = data scadenza quota
--   [nome_giocatore] = nome del giocatore
-- Modificabile da Impostazioni > Template messaggi

INSERT INTO public.message_templates (type, name, content, subject)
SELECT 'whatsapp', 'Sollecito quota scaduta', 
  'Buongiorno,
vi ricordiamo gentilmente che la quota di [inserisci importo della quota] con scadenza [data_scadenza] relativa a [nome_giocatore] risulta ad oggi scaduta.

Vi chiediamo cortesemente di provvedere al saldo nei prossimi giorni.
Qualora aveste già effettuato il pagamento, vi preghiamo di non considerare questo messaggio.

Per qualsiasi necessità o chiarimento restiamo a disposizione.
Grazie per la collaborazione e per il sostegno al progetto.

Un cordiale saluto,
Brixia Rugby',
  NULL
FROM (SELECT 1) AS _dummy
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates 
  WHERE type = 'whatsapp' AND LOWER(name) = 'sollecito quota scaduta'
);
