-- 043_accounting_catalog_clarity_and_deduplication.sql
--
-- Razionalizza il catalogo 042 senza cancellare alcun dato storico.
-- Le vecchie voci che potevano creare confusione restano consultabili nei
-- report, ma non sono piu' selezionabili per nuovi movimenti o preventivi.

BEGIN;

-- Questa e' una riclassificazione amministrativa di voci di sistema:
-- i codici e gli ID non vengono modificati, quindi lo storico resta integro.
ALTER TABLE public.accounting_category_groups DISABLE TRIGGER USER;
ALTER TABLE public.accounting_categories DISABLE TRIGGER USER;

-- Macro-categorie con un perimetro leggibile gia' dal nome.
UPDATE public.accounting_category_groups
SET
  name = CASE
    WHEN direction = 'income' AND code = 'QUOTE_SPORT' THEN 'Quote associative e sportive'
    WHEN direction = 'income' AND code = 'CORSI_FORMAZIONE' THEN 'Corsi e attivita formative'
    WHEN direction = 'income' AND code = 'BAR_MERCH_RICAVI' THEN 'Bar, ristoro e vendita prodotti'
    WHEN direction = 'expense' AND code = 'MATERIALE_SPORTIVO' THEN 'Materiale e attrezzatura sportiva'
    WHEN direction = 'expense' AND code = 'ALLOGGI' THEN 'Alloggi continuativi e foresteria'
    WHEN direction = 'expense' AND code = 'BAR_MERCH_COSTI' THEN 'Bar, ristoro e vendita prodotti'
    ELSE name
  END,
  description = CASE
    WHEN direction = 'income' AND code = 'QUOTE_SPORT' THEN 'Quote richieste a soci e tesserati per iscrizione, attivita ordinaria, gare e ritiri della squadra.'
    WHEN direction = 'income' AND code = 'CORSI_FORMAZIONE' THEN 'Corrispettivi di corsi, campus, clinic e progetti formativi resi dalla societa.'
    WHEN direction = 'income' AND code = 'BAR_MERCH_RICAVI' THEN 'Incassi da bar e ristoro, merchandising e materiale tecnico venduto.'
    WHEN direction = 'expense' AND code = 'MATERIALE_SPORTIVO' THEN 'Forniture e attrezzature per squadra, allenamento e gara; non investimenti durevoli.'
    WHEN direction = 'expense' AND code = 'ALLOGGI' THEN 'Costi ricorrenti di appartamenti, foresteria e ospitalita continuativa; non trasferte.'
    WHEN direction = 'expense' AND code = 'BAR_MERCH_COSTI' THEN 'Acquisti e costi operativi di bar, ristoro e prodotti destinati alla vendita.'
    ELSE description
  END,
  updated_at = now()
WHERE (direction, code) IN (
  ('income', 'QUOTE_SPORT'),
  ('income', 'CORSI_FORMAZIONE'),
  ('income', 'BAR_MERCH_RICAVI'),
  ('expense', 'MATERIALE_SPORTIVO'),
  ('expense', 'ALLOGGI'),
  ('expense', 'BAR_MERCH_COSTI')
);

-- ENTRATE: quote dei tesserati e corsi venduti come servizio sono separati.
UPDATE public.accounting_categories
SET name = 'Quota associativa annuale',
    notes = 'Quota annuale di adesione alla societa; distinta da iscrizione, attivita sportiva e corsi.',
    updated_at = now()
WHERE upper(code) = 'QUOTE';

UPDATE public.accounting_categories
SET name = 'Quota di prima iscrizione',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT')
  AND (upper(code) = 'I_QUOTE_SPORT_02' OR lower(btrim(name)) = 'quote di iscrizione');

UPDATE public.accounting_categories
SET name = 'Quota attivita sportiva ordinaria',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT')
  AND (upper(code) = 'I_QUOTE_SPORT_03' OR lower(btrim(name)) = 'quote sportive');

UPDATE public.accounting_categories
SET name = 'Quota gara atleta',
    notes = 'Quota richiesta al singolo atleta per partecipare a una gara.',
    updated_at = now()
WHERE upper(code) = 'QUOTE_GARA';

-- La voce sarebbe indistinguibile dai corrispettivi dei corsi: resta solo per
-- lo storico e per i report, mentre per i nuovi movimenti si usa il gruppo Corsi.
UPDATE public.accounting_categories
SET name = 'Quota corsi (storico: usare Corsi e attivita formative)',
    is_active = false,
    available_in_movements = false,
    available_in_budget = false,
    available_in_reports = true,
    notes = 'Voce dismessa per evitare sovrapposizione con i corrispettivi dei corsi.',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT')
  AND (upper(code) = 'I_QUOTE_SPORT_05' OR lower(btrim(name)) LIKE 'quote per corsi%');

UPDATE public.accounting_categories
SET name = 'Riaddebito tesseramento agli atleti',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT')
  AND (upper(code) = 'I_QUOTE_SPORT_06' OR lower(btrim(name)) LIKE 'tesseramenti addebitati%');

UPDATE public.accounting_categories
SET name = 'Quota ritiro o camp della squadra',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT')
  AND (upper(code) = 'I_QUOTE_SPORT_07' OR lower(btrim(name)) LIKE 'ritiri e camp%');

UPDATE public.accounting_categories
SET name = 'Altre quote associative e sportive',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT')
  AND (upper(code) = 'I_QUOTE_SPORT_08' OR lower(btrim(name)) LIKE 'altre entrate da attivita%');

UPDATE public.accounting_categories
SET name = CASE upper(code)
    WHEN 'I_CORSI_FORMAZIONE_01' THEN 'Corrispettivi corsi sportivi'
    WHEN 'I_CORSI_FORMAZIONE_02' THEN 'Corrispettivi campus estivi'
    WHEN 'I_CORSI_FORMAZIONE_03' THEN 'Corrispettivi clinic e stage'
    WHEN 'I_CORSI_FORMAZIONE_04' THEN 'Corrispettivi corsi di formazione'
    WHEN 'I_CORSI_FORMAZIONE_05' THEN 'Corrispettivi attivita nelle scuole'
    WHEN 'I_CORSI_FORMAZIONE_06' THEN 'Corrispettivi progetti sportivi per terzi'
    WHEN 'I_CORSI_FORMAZIONE_07' THEN 'Altri corrispettivi formativi'
    ELSE name
  END,
  updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'CORSI_FORMAZIONE');

-- Eventi, contributi e cessioni: nomi che escludono le sovrapposizioni.
UPDATE public.accounting_categories
SET name = 'Altri contributi pubblici',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'CONTRIBUTI_LIBERALITA')
  AND (upper(code) = 'CONTRIBUTI_PUBBLICI' OR lower(btrim(name)) = 'contributi pubblici');

UPDATE public.accounting_categories
SET name = 'Quote di iscrizione a tornei organizzati',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'GARE_EVENTI')
  AND (upper(code) = 'I_GARE_EVENTI_02' OR lower(btrim(name)) LIKE 'iscrizioni a tornei%');

UPDATE public.accounting_categories
SET name = 'Altri ricavi da tornei',
    updated_at = now()
WHERE upper(code) = 'RICAVI_TORNEI';

UPDATE public.accounting_categories
SET name = CASE lower(btrim(name))
    WHEN 'vendita di attrezzature' THEN 'Cessione di attrezzature societarie durevoli'
    WHEN 'vendita di mezzi societari' THEN 'Cessione di mezzi societari'
    WHEN 'vendita di altri beni' THEN 'Cessione di altri beni durevoli'
    ELSE name
  END,
  updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'CESSIONI_BENI')
  AND upper(code) IN ('I_CESSIONI_BENI_01', 'I_CESSIONI_BENI_02', 'I_CESSIONI_BENI_03');

-- Bar, ristoro e vendita: un solo merchandising attivo. L'abbigliamento con
-- logo e gli accessori confluiscono nel merchandising; il tecnico resta a parte.
UPDATE public.accounting_categories
SET name = 'Vendita merchandising (abbigliamento e accessori)',
    notes = 'Vendita di prodotti con marchio della societa, inclusi abbigliamento e accessori.',
    updated_at = now()
WHERE upper(code) = 'MERCHANDISING';

UPDATE public.accounting_categories
SET name = 'Vendita abbigliamento (storico: usare Vendita merchandising)',
    is_active = false,
    available_in_movements = false,
    available_in_budget = false,
    available_in_reports = true,
    notes = 'Voce dismessa: abbigliamento e accessori sono gestiti dal merchandising.',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'BAR_MERCH_RICAVI')
  AND (upper(code) = 'I_BAR_MERCH_RICAVI_03' OR lower(btrim(name)) = 'vendita abbigliamento');

UPDATE public.accounting_categories
SET name = 'Vendita materiale tecnico sportivo',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('income', 'BAR_MERCH_RICAVI')
  AND (upper(code) = 'I_BAR_MERCH_RICAVI_04' OR lower(btrim(name)) = 'vendita materiale sportivo');

-- USCITE: distingue consumo sportivo, attrezzatura, investimenti e trasferte.
UPDATE public.accounting_categories
SET name = CASE upper(code)
    WHEN 'E_MATERIALE_SPORTIVO_01' THEN 'Equipaggiamento tecnico sportivo'
    WHEN 'MATERIALE_SPORTIVO' THEN 'Materiale di consumo sportivo'
    WHEN 'E_MATERIALE_SPORTIVO_03' THEN 'Palloni e attrezzatura di allenamento'
    WHEN 'E_MATERIALE_SPORTIVO_10' THEN 'Altre forniture sportive correnti'
    ELSE name
  END,
  updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'MATERIALE_SPORTIVO');

UPDATE public.accounting_categories
SET name = 'Pedaggi e parcheggi dei mezzi societari',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'MEZZI_SOCIETARI')
  AND (upper(code) = 'E_MEZZI_SOCIETARI_08' OR lower(btrim(name)) = 'pedaggi e parcheggi');

UPDATE public.accounting_categories
SET name = CASE upper(code)
    WHEN 'E_TRASFERTE_TRASPORTI_08' THEN 'Pernottamento in trasferta'
    WHEN 'E_TRASFERTE_TRASPORTI_09' THEN 'Pedaggi e parcheggi in trasferta'
    ELSE name
  END,
  updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'TRASFERTE_TRASPORTI');

UPDATE public.accounting_categories
SET name = 'Ospitalita continuativa e foresteria',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'ALLOGGI')
  AND (upper(code) = 'E_ALLOGGI_07' OR lower(btrim(name)) LIKE 'pernottamenti e strutture%');

UPDATE public.accounting_categories
SET name = CASE upper(code)
    WHEN 'E_GARE_EVENTI_COSTI_05' THEN 'Organizzazione feste ed eventi sociali'
    WHEN 'E_GARE_EVENTI_COSTI_06' THEN 'Sicurezza e assistenza sanitaria per eventi'
    ELSE name
  END,
  updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'GARE_EVENTI_COSTI');

UPDATE public.accounting_categories
SET name = 'Investimenti in attrezzature sportive',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'INVESTIMENTI_STRAORDINARI')
  AND (upper(code) = 'E_INVESTIMENTI_STRAORDINARI_01' OR lower(btrim(name)) = 'acquisto attrezzature sportive');

-- Un solo acquisto attivo di alimenti/bevande e uno di merchandising. Le due
-- vecchie varianti equivalenti restano disponibili solo per leggere lo storico.
UPDATE public.accounting_categories
SET name = 'Acquisto alimenti e bevande per bar e ristoro',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
  AND (upper(code) = 'E_BAR_MERCH_COSTI_02' OR lower(btrim(name)) = 'acquisto alimenti e bevande');

UPDATE public.accounting_categories
SET name = 'Acquisto prodotti per il bar (storico: usare Alimenti e bevande)',
    is_active = false,
    available_in_movements = false,
    available_in_budget = false,
    available_in_reports = true,
    notes = 'Voce dismessa: usare Acquisto alimenti e bevande per bar e ristoro.',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
  AND (upper(code) = 'E_BAR_MERCH_COSTI_01' OR lower(btrim(name)) LIKE 'acquisto prodotti per il bar%');

UPDATE public.accounting_categories
SET name = 'Acquisto merchandising da rivendere (abbigliamento e accessori)',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
  AND (upper(code) = 'E_BAR_MERCH_COSTI_05' OR lower(btrim(name)) = 'acquisto merchandising');

UPDATE public.accounting_categories
SET name = 'Acquisto abbigliamento da rivendere (storico: usare Merchandising)',
    is_active = false,
    available_in_movements = false,
    available_in_budget = false,
    available_in_reports = true,
    notes = 'Voce dismessa: abbigliamento e accessori sono gestiti dall acquisto merchandising.',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
  AND (upper(code) = 'E_BAR_MERCH_COSTI_06' OR lower(btrim(name)) LIKE 'acquisto abbigliamento destinato%');

UPDATE public.accounting_categories
SET name = 'Costi operativi di bar e ristoro',
    updated_at = now()
WHERE group_id = public.accounting_category_group_id_by_code('expense', 'BAR_MERCH_COSTI')
  AND (upper(code) = 'E_BAR_MERCH_COSTI_07' OR lower(btrim(name)) LIKE 'costi per feste e ristoro%');

ALTER TABLE public.accounting_categories ENABLE TRIGGER USER;
ALTER TABLE public.accounting_category_groups ENABLE TRIGGER USER;

NOTIFY pgrst, 'reload schema';

COMMIT;
