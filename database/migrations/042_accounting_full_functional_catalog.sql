-- 042_accounting_full_functional_catalog.sql
-- Catalogo contabile definitivo: 11 macro-categorie di entrata e 17 di uscita.
-- I record esistenti vengono riusati e riclassificati: lo storico mantiene gli ID.

BEGIN;

-- Le protezioni applicative sono corrette nell'uso ordinario. Durante questa
-- migrazione amministrativa servono però a riclassificare il catalogo storico.
ALTER TABLE public.accounting_category_groups DISABLE TRIGGER USER;
ALTER TABLE public.accounting_categories DISABLE TRIGGER USER;

-- Riutilizza i gruppi provvisori gia' presenti, senza cambiare i loro ID.
WITH group_renames(direction, old_code, new_code, new_name, new_description, new_sort_order) AS (
  VALUES
    ('income', 'RICAVI_EVENTI', 'GARE_EVENTI', 'Gare, tornei ed eventi', 'Ricavi di gare, tornei, eventi e iniziative sociali.', 40),
    ('income', 'CONTRIBUTI', 'CONTRIBUTI_LIBERALITA', 'Contributi e liberalita', 'Contributi pubblici e privati, donazioni e raccolte fondi.', 30),
    ('income', 'ALTRE_ENTRATE_G', 'PROVENTI_STRAORDINARI', 'Proventi finanziari e straordinari', 'Interessi, plusvalenze e altre entrate residuali.', 110),
    ('expense', 'COSTI_SPORTIVI', 'MATERIALE_SPORTIVO', 'Materiale sportivo e abbigliamento', 'Materiale tecnico, attrezzature e abbigliamento.', 50),
    ('expense', 'STRUTTURA', 'IMPIANTI_UTENZE', 'Impianti, strutture e utenze', 'Costi di gestione degli impianti.', 60),
    ('expense', 'PERSONALE', 'PERSONALE_COLLABORATORI', 'Personale e collaboratori', 'Compensi, rimborsi e oneri del personale.', 10),
    ('expense', 'AMMINISTRAZIONE', 'SEGRETERIA_INFORMATICA', 'Segreteria, amministrazione e informatica', 'Segreteria, software e servizi digitali.', 110),
    ('expense', 'ALTRE_USCITE_G', 'SPESE_STRAORDINARIE', 'Spese straordinarie e impreviste', 'Costi residuali e non ricorrenti.', 170)
)
UPDATE public.accounting_category_groups AS g
SET
  code = r.new_code,
  name = r.new_name,
  description = r.new_description,
  sort_order = r.new_sort_order,
  updated_at = now()
FROM group_renames AS r
WHERE g.direction = r.direction
  AND g.code = r.old_code
  AND NOT EXISTS (
    SELECT 1
    FROM public.accounting_category_groups AS target
    WHERE target.direction = r.direction AND target.code = r.new_code
  );

-- Catalogo delle macro-categorie. L'upsert preserva gli stati di attivazione
-- scelti dalla societa' e aggiorna solamente struttura, nome e ordinamento.
WITH catalog(direction, code, name, description, sort_order) AS (
  VALUES
    ('income', 'QUOTE_SPORT', 'Quote e attività sportive', 'Quote associative, sportive e attività correlate.', 10),
    ('income', 'SPONSOR_PUB', 'Sponsorizzazioni e pubblicità', 'Sponsor, pubblicità e partnership commerciali.', 20),
    ('income', 'CONTRIBUTI_LIBERALITA', 'Contributi e liberalità', 'Contributi, liberalità, donazioni e raccolte fondi.', 30),
    ('income', 'GARE_EVENTI', 'Gare, tornei ed eventi', 'Ricavi da manifestazioni, tornei ed eventi.', 40),
    ('income', 'CORSI_FORMAZIONE', 'Corsi, campus e formazione', 'Corsi, campus, clinic e progetti formativi.', 50),
    ('income', 'IMPIANTI_RICAVI', 'Affitto e utilizzo degli impianti', 'Ricavi da impianti, spazi e attrezzature.', 60),
    ('income', 'BAR_MERCH_RICAVI', 'Bar, ristoro e merchandising', 'Ricavi commerciali da bar, ristoro e vendita.', 70),
    ('income', 'SERVIZI_COMMERCIALI', 'Servizi commerciali', 'Prestazioni e servizi resi a terzi.', 80),
    ('income', 'RIMBORSI_INDENNIZZI', 'Rimborsi e indennizzi', 'Rimborsi, recuperi e risarcimenti ricevuti.', 90),
    ('income', 'CESSIONI_BENI', 'Cessione di beni e immobilizzazioni', 'Vendita di beni, mezzi e immobilizzazioni.', 100),
    ('income', 'PROVENTI_STRAORDINARI', 'Proventi finanziari e straordinari', 'Interessi, plusvalenze e altre entrate residuali.', 110),
    ('expense', 'PERSONALE_COLLABORATORI', 'Personale e collaboratori', 'Compensi, rimborsi e oneri del personale.', 10),
    ('expense', 'AFFILIAZIONI_FEDERALI', 'Affiliazioni, tesseramenti e attività federale', 'Costi federali, tesseramenti, gare e campionati.', 20),
    ('expense', 'ASSICURAZIONI', 'Assicurazioni', 'Assicurazioni di atleti, persone, impianti e mezzi.', 30),
    ('expense', 'AREA_MEDICA', 'Area medica e sanitaria', 'Visite, materiali e servizi sanitari.', 40),
    ('expense', 'MATERIALE_SPORTIVO', 'Materiale sportivo e abbigliamento', 'Materiale tecnico, attrezzature e abbigliamento.', 50),
    ('expense', 'IMPIANTI_UTENZE', 'Impianti, strutture e utenze', 'Costi di gestione degli impianti.', 60),
    ('expense', 'ALLOGGI', 'Appartamenti e alloggi', 'Alloggi, appartamenti e pernottamenti.', 70),
    ('expense', 'MEZZI_SOCIETARI', 'Mezzi societari', 'Acquisto, gestione e manutenzione dei mezzi.', 80),
    ('expense', 'TRASFERTE_TRASPORTI', 'Trasferte e trasporti', 'Viaggi, trasferte e logistica.', 90),
    ('expense', 'GARE_EVENTI_COSTI', 'Gare, tornei ed eventi', 'Costi di gare, tornei, ritiri ed eventi.', 100),
    ('expense', 'SEGRETERIA_INFORMATICA', 'Segreteria, amministrazione e informatica', 'Segreteria, software e servizi digitali.', 110),
    ('expense', 'CONSULENZE_ADEMPIMENTI', 'Consulenze, formazione e adempimenti', 'Consulenze professionali, formazione e adempimenti.', 120),
    ('expense', 'COMUNICAZIONE_MARKETING', 'Comunicazione, marketing e promozione', 'Promozione, comunicazione e rappresentanza.', 130),
    ('expense', 'BAR_MERCH_COSTI', 'Bar, ristoro e merchandising', 'Acquisti e costi commerciali di bar e merchandising.', 140),
    ('expense', 'SPESE_BANCARIE_FISCALI', 'Spese bancarie, fiscali e finanziarie', 'Banche, imposte, tasse e oneri finanziari.', 150),
    ('expense', 'INVESTIMENTI_STRAORDINARI', 'Investimenti e manutenzioni straordinarie', 'Investimenti, lavori e ammortamenti.', 160),
    ('expense', 'SPESE_STRAORDINARIE', 'Spese straordinarie e impreviste', 'Costi residuali e non ricorrenti.', 170)
)
INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT catalog.direction, catalog.code, catalog.name, catalog.description, true, true, catalog.sort_order
FROM catalog
ON CONFLICT (direction, code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_system = true,
  archived_at = NULL,
  archived_by = NULL,
  updated_at = now();

-- Riclassifica le voci gia' introdotte nel catalogo provvisorio.
WITH remap(code, direction, group_code, name, sort_order) AS (
  VALUES
    ('QUOTE', 'income', 'QUOTE_SPORT', 'Quote associative', 1),
    ('QUOTE_GARA', 'income', 'QUOTE_SPORT', 'Quote gara', 4),
    ('SPONSOR', 'income', 'SPONSOR_PUB', 'Sponsorizzazioni', 1),
    ('PUBBLICITA', 'income', 'SPONSOR_PUB', 'Pubblicità', 2),
    ('MERCHANDISING', 'income', 'BAR_MERCH_RICAVI', 'Merchandising', 5),
    ('SERVIZI_COMMERCIALI', 'income', 'SERVIZI_COMMERCIALI', 'Servizi sportivi a terzi', 3),
    ('BIGLIETTERIA', 'income', 'GARE_EVENTI', 'Biglietteria', 1),
    ('RICAVI_TORNEI', 'income', 'GARE_EVENTI', 'Ricavi da tornei', 4),
    ('CONTRIBUTI_PUBBLICI', 'income', 'CONTRIBUTI_LIBERALITA', 'Contributi pubblici', 1),
    ('DONAZIONI', 'income', 'CONTRIBUTI_LIBERALITA', 'Donazioni', 9),
    ('RIMBORSI_ASSICURATIVI', 'income', 'RIMBORSI_INDENNIZZI', 'Rimborsi assicurativi', 1),
    ('ALTRE_ENTRATE', 'income', 'PROVENTI_STRAORDINARI', 'Altre entrate', 6),
    ('MATERIALE_SPORTIVO', 'expense', 'MATERIALE_SPORTIVO', 'Materiale sportivo', 2),
    ('MATERIALE_MEDICO', 'expense', 'AREA_MEDICA', 'Materiale medicale', 6),
    ('ARBITRI', 'expense', 'GARE_EVENTI_COSTI', 'Arbitri e ufficiali di gara', 7),
    ('TRASFERTE_GARA', 'expense', 'TRASFERTE_TRASPORTI', 'Trasferte di gara', 1),
    ('AFFITTO_CAMPI', 'expense', 'IMPIANTI_UTENZE', 'Affitto campi', 1),
    ('UTENZE', 'expense', 'IMPIANTI_UTENZE', 'Altri costi degli impianti', 13),
    ('MANUTENZIONE_IMPIANTI', 'expense', 'IMPIANTI_UTENZE', 'Manutenzione ordinaria', 9),
    ('NOLEGGI', 'expense', 'GARE_EVENTI_COSTI', 'Noleggio strutture e attrezzature', 9),
    ('COMPENSI_TECNICI', 'expense', 'PERSONALE_COLLABORATORI', 'Compensi collaboratori sportivi', 4),
    ('ASSICURAZIONI_SPORT', 'expense', 'ASSICURAZIONI', 'Assicurazione atleti', 1),
    ('SPESE_VIAGGIO', 'expense', 'TRASFERTE_TRASPORTI', 'Altre spese di viaggio e trasporto', 10),
    ('CONSULENZE', 'expense', 'CONSULENZE_ADEMPIMENTI', 'Altre consulenze', 12),
    ('SOFTWARE_GESTIONALE', 'expense', 'SEGRETERIA_INFORMATICA', 'Gestionale e servizi digitali', 6),
    ('SPESE_BANCARIE', 'expense', 'SPESE_BANCARIE_FISCALI', 'Spese bancarie', 1),
    ('MULTE_SANZIONI', 'expense', 'AFFILIAZIONI_FEDERALI', 'Multe e sanzioni sportive', 8),
    ('AMMORTAMENTI', 'expense', 'INVESTIMENTI_STRAORDINARI', 'Ammortamenti', 8),
    ('ALTRE_USCITE', 'expense', 'SPESE_STRAORDINARIE', 'Altre uscite straordinarie', 7)
)
UPDATE public.accounting_categories AS c
SET
  group_id = g.id,
  direction = r.direction,
  name = r.name,
  sort_order = r.sort_order,
  is_system = true,
  updated_at = now()
FROM remap AS r
JOIN public.accounting_category_groups AS g
  ON g.direction = r.direction AND g.code = r.group_code
WHERE upper(c.code) = r.code;

-- La riga legacy non e' piu' una voce operativa: SPONSOR e' la categoria canonica.
UPDATE public.accounting_categories
SET
  name = 'Sponsorizzazioni (storico)',
  is_active = false,
  available_in_movements = false,
  available_in_budget = false,
  updated_at = now()
WHERE upper(code) = 'SPONSORIZZAZIONI';

-- Le voci nuove partono disattivate: ogni societa' le abilita dalle impostazioni.
WITH catalog(direction, group_code, name, sort_order) AS (
  VALUES
    -- Entrate: Quote e attivita' sportive
    ('income','QUOTE_SPORT','Quote associative',1), ('income','QUOTE_SPORT','Quote di iscrizione',2), ('income','QUOTE_SPORT','Quote sportive',3), ('income','QUOTE_SPORT','Quote gara',4), ('income','QUOTE_SPORT','Quote per corsi e attività sportive',5), ('income','QUOTE_SPORT','Tesseramenti addebitati agli atleti',6), ('income','QUOTE_SPORT','Ritiri e camp sportivi',7), ('income','QUOTE_SPORT','Altre entrate da attività sportiva',8),
    -- Entrate: Sponsor
    ('income','SPONSOR_PUB','Sponsorizzazioni',1), ('income','SPONSOR_PUB','Pubblicità',2), ('income','SPONSOR_PUB','Cartellonistica pubblicitaria',3), ('income','SPONSOR_PUB','Sponsor tecnici',4), ('income','SPONSOR_PUB','Partnership commerciali',5), ('income','SPONSOR_PUB','Altri proventi pubblicitari',6),
    -- Entrate: Contributi
    ('income','CONTRIBUTI_LIBERALITA','Contributi pubblici',1), ('income','CONTRIBUTI_LIBERALITA','Contributi comunali',2), ('income','CONTRIBUTI_LIBERALITA','Contributi regionali',3), ('income','CONTRIBUTI_LIBERALITA','Contributi statali',4), ('income','CONTRIBUTI_LIBERALITA','Contributi federali',5), ('income','CONTRIBUTI_LIBERALITA','Contributi da enti sportivi',6), ('income','CONTRIBUTI_LIBERALITA','Contributi da fondazioni',7), ('income','CONTRIBUTI_LIBERALITA','Liberalità',8), ('income','CONTRIBUTI_LIBERALITA','Donazioni',9), ('income','CONTRIBUTI_LIBERALITA','Cinque per mille',10), ('income','CONTRIBUTI_LIBERALITA','Raccolte fondi',11), ('income','CONTRIBUTI_LIBERALITA','Altri contributi',12),
    -- Entrate: Gare ed eventi
    ('income','GARE_EVENTI','Biglietteria',1), ('income','GARE_EVENTI','Iscrizioni a tornei organizzati',2), ('income','GARE_EVENTI','Ricavi da gare',3), ('income','GARE_EVENTI','Ricavi da tornei',4), ('income','GARE_EVENTI','Ricavi da eventi sportivi',5), ('income','GARE_EVENTI','Ricavi da feste ed eventi sociali',6), ('income','GARE_EVENTI','Altri ricavi da eventi',7),
    -- Entrate: Corsi
    ('income','CORSI_FORMAZIONE','Corsi sportivi',1), ('income','CORSI_FORMAZIONE','Campus estivi',2), ('income','CORSI_FORMAZIONE','Clinic e stage',3), ('income','CORSI_FORMAZIONE','Corsi di formazione',4), ('income','CORSI_FORMAZIONE','Attività nelle scuole',5), ('income','CORSI_FORMAZIONE','Progetti sportivi',6), ('income','CORSI_FORMAZIONE','Altre attività formative',7),
    -- Entrate: Impianti
    ('income','IMPIANTI_RICAVI','Affitto campi',1), ('income','IMPIANTI_RICAVI','Affitto palestre',2), ('income','IMPIANTI_RICAVI','Utilizzo degli impianti',3), ('income','IMPIANTI_RICAVI','Concessione di spazi',4), ('income','IMPIANTI_RICAVI','Noleggio attrezzature',5), ('income','IMPIANTI_RICAVI','Altri ricavi da strutture',6),
    -- Entrate: Bar e merchandising
    ('income','BAR_MERCH_RICAVI','Incassi bar',1), ('income','BAR_MERCH_RICAVI','Ristorazione e ristoro',2), ('income','BAR_MERCH_RICAVI','Vendita abbigliamento',3), ('income','BAR_MERCH_RICAVI','Vendita materiale sportivo',4), ('income','BAR_MERCH_RICAVI','Merchandising',5), ('income','BAR_MERCH_RICAVI','Altre vendite',6),
    -- Entrate: Servizi
    ('income','SERVIZI_COMMERCIALI','Prestazioni di servizi',1), ('income','SERVIZI_COMMERCIALI','Organizzazione di eventi per terzi',2), ('income','SERVIZI_COMMERCIALI','Servizi sportivi a terzi',3), ('income','SERVIZI_COMMERCIALI','Collaborazioni commerciali',4), ('income','SERVIZI_COMMERCIALI','Altri servizi commerciali',5),
    -- Entrate: Rimborsi
    ('income','RIMBORSI_INDENNIZZI','Rimborsi assicurativi',1), ('income','RIMBORSI_INDENNIZZI','Risarcimenti',2), ('income','RIMBORSI_INDENNIZZI','Rimborsi spese ricevuti',3), ('income','RIMBORSI_INDENNIZZI','Recuperi e riaddebiti di costi',4), ('income','RIMBORSI_INDENNIZZI','Altri rimborsi e indennizzi',5),
    -- Entrate: Cessioni
    ('income','CESSIONI_BENI','Vendita di attrezzature',1), ('income','CESSIONI_BENI','Vendita di mezzi societari',2), ('income','CESSIONI_BENI','Vendita di altri beni',3), ('income','CESSIONI_BENI','Cessione di immobilizzazioni',4),
    -- Entrate: Straordinarie
    ('income','PROVENTI_STRAORDINARI','Interessi attivi',1), ('income','PROVENTI_STRAORDINARI','Abbuoni attivi',2), ('income','PROVENTI_STRAORDINARI','Sopravvenienze attive',3), ('income','PROVENTI_STRAORDINARI','Plusvalenze',4), ('income','PROVENTI_STRAORDINARI','Entrate straordinarie',5), ('income','PROVENTI_STRAORDINARI','Altre entrate',6),
    -- Uscite: Personale
    ('expense','PERSONALE_COLLABORATORI','Compensi allenatori',1), ('expense','PERSONALE_COLLABORATORI','Compensi preparatori atletici',2), ('expense','PERSONALE_COLLABORATORI','Compensi dirigenti',3), ('expense','PERSONALE_COLLABORATORI','Compensi collaboratori sportivi',4), ('expense','PERSONALE_COLLABORATORI','Compensi amministrativo-gestionali',5), ('expense','PERSONALE_COLLABORATORI','Stipendi e salari',6), ('expense','PERSONALE_COLLABORATORI','Rimborsi spese',7), ('expense','PERSONALE_COLLABORATORI','Rimborsi chilometrici',8), ('expense','PERSONALE_COLLABORATORI','Premi e incentivi',9), ('expense','PERSONALE_COLLABORATORI','Contributi previdenziali',10), ('expense','PERSONALE_COLLABORATORI','Oneri del personale',11), ('expense','PERSONALE_COLLABORATORI','Altri costi per personale e collaboratori',12),
    -- Uscite: Federazione
    ('expense','AFFILIAZIONI_FEDERALI','Riaffiliazione',1), ('expense','AFFILIAZIONI_FEDERALI','Affiliazioni',2), ('expense','AFFILIAZIONI_FEDERALI','Tesseramenti',3), ('expense','AFFILIAZIONI_FEDERALI','Iscrizione ai campionati',4), ('expense','AFFILIAZIONI_FEDERALI','Tasse gara',5), ('expense','AFFILIAZIONI_FEDERALI','Diritti e contributi federali',6), ('expense','AFFILIAZIONI_FEDERALI','Omologazioni',7), ('expense','AFFILIAZIONI_FEDERALI','Multe e sanzioni sportive',8), ('expense','AFFILIAZIONI_FEDERALI','Altri costi federali',9),
    -- Uscite: Assicurazioni
    ('expense','ASSICURAZIONI','Assicurazione atleti',1), ('expense','ASSICURAZIONI','Assicurazione dirigenti e collaboratori',2), ('expense','ASSICURAZIONI','Responsabilità civile',3), ('expense','ASSICURAZIONI','Assicurazione impianti',4), ('expense','ASSICURAZIONI','Assicurazione mezzi societari',5), ('expense','ASSICURAZIONI','Altre assicurazioni',6),
    -- Uscite: Area medica
    ('expense','AREA_MEDICA','Certificati medici',1), ('expense','AREA_MEDICA','Visite mediche',2), ('expense','AREA_MEDICA','Medici e personale sanitario',3), ('expense','AREA_MEDICA','Fisioterapia',4), ('expense','AREA_MEDICA','Riabilitazione',5), ('expense','AREA_MEDICA','Materiale medicale',6), ('expense','AREA_MEDICA','Farmaci e dispositivi sanitari',7), ('expense','AREA_MEDICA','Defibrillatori e relativa manutenzione',8), ('expense','AREA_MEDICA','Altre spese sanitarie',9),
    -- Uscite: Materiale sportivo
    ('expense','MATERIALE_SPORTIVO','Materiale tecnico',1), ('expense','MATERIALE_SPORTIVO','Materiale sportivo',2), ('expense','MATERIALE_SPORTIVO','Palloni e attrezzature',3), ('expense','MATERIALE_SPORTIVO','Abbigliamento da gara',4), ('expense','MATERIALE_SPORTIVO','Abbigliamento da allenamento',5), ('expense','MATERIALE_SPORTIVO','Divise dello staff',6), ('expense','MATERIALE_SPORTIVO','Borse e accessori',7), ('expense','MATERIALE_SPORTIVO','Lavanderia',8), ('expense','MATERIALE_SPORTIVO','Riparazione e manutenzione attrezzature',9), ('expense','MATERIALE_SPORTIVO','Altro materiale sportivo',10),
    -- Uscite: Impianti
    ('expense','IMPIANTI_UTENZE','Affitto campi',1), ('expense','IMPIANTI_UTENZE','Affitto palestre',2), ('expense','IMPIANTI_UTENZE','Canoni di concessione',3), ('expense','IMPIANTI_UTENZE','Energia elettrica',4), ('expense','IMPIANTI_UTENZE','Gas',5), ('expense','IMPIANTI_UTENZE','Acqua',6), ('expense','IMPIANTI_UTENZE','Telefonia e connessione Internet',7), ('expense','IMPIANTI_UTENZE','Pulizie',8), ('expense','IMPIANTI_UTENZE','Manutenzione ordinaria',9), ('expense','IMPIANTI_UTENZE','Manutenzione campi',10), ('expense','IMPIANTI_UTENZE','Custodia e vigilanza',11), ('expense','IMPIANTI_UTENZE','Smaltimento rifiuti',12), ('expense','IMPIANTI_UTENZE','Altri costi degli impianti',13),
    -- Uscite: Alloggi
    ('expense','ALLOGGI','Affitto appartamenti',1), ('expense','ALLOGGI','Spese condominiali',2), ('expense','ALLOGGI','Utenze degli appartamenti',3), ('expense','ALLOGGI','Pulizia degli appartamenti',4), ('expense','ALLOGGI','Arredi e dotazioni',5), ('expense','ALLOGGI','Manutenzione degli alloggi',6), ('expense','ALLOGGI','Pernottamenti e strutture ricettive',7), ('expense','ALLOGGI','Altre spese per appartamenti e alloggi',8),
    -- Uscite: Mezzi
    ('expense','MEZZI_SOCIETARI','Acquisto mezzi',1), ('expense','MEZZI_SOCIETARI','Leasing e noleggio',2), ('expense','MEZZI_SOCIETARI','Carburante',3), ('expense','MEZZI_SOCIETARI','Assicurazione mezzi',4), ('expense','MEZZI_SOCIETARI','Bollo',5), ('expense','MEZZI_SOCIETARI','Manutenzione e riparazioni',6), ('expense','MEZZI_SOCIETARI','Pneumatici',7), ('expense','MEZZI_SOCIETARI','Pedaggi e parcheggi',8), ('expense','MEZZI_SOCIETARI','Revisioni',9), ('expense','MEZZI_SOCIETARI','Altri costi dei mezzi societari',10),
    -- Uscite: Trasferte
    ('expense','TRASFERTE_TRASPORTI','Trasferte di gara',1), ('expense','TRASFERTE_TRASPORTI','Trasferte dello staff',2), ('expense','TRASFERTE_TRASPORTI','Autobus e pullman',3), ('expense','TRASFERTE_TRASPORTI','Treni',4), ('expense','TRASFERTE_TRASPORTI','Aerei',5), ('expense','TRASFERTE_TRASPORTI','Taxi e trasporto locale',6), ('expense','TRASFERTE_TRASPORTI','Vitto in trasferta',7), ('expense','TRASFERTE_TRASPORTI','Alloggio in trasferta',8), ('expense','TRASFERTE_TRASPORTI','Pedaggi e parcheggi',9), ('expense','TRASFERTE_TRASPORTI','Trasporto di materiale',10), ('expense','TRASFERTE_TRASPORTI','Altre spese di viaggio e trasporto',11),
    -- Uscite: Gare ed eventi
    ('expense','GARE_EVENTI_COSTI','Organizzazione gare',1), ('expense','GARE_EVENTI_COSTI','Organizzazione tornei',2), ('expense','GARE_EVENTI_COSTI','Iscrizione a tornei',3), ('expense','GARE_EVENTI_COSTI','Organizzazione ritiri',4), ('expense','GARE_EVENTI_COSTI','Feste ed eventi sociali',5), ('expense','GARE_EVENTI_COSTI','Sicurezza e servizio sanitario',6), ('expense','GARE_EVENTI_COSTI','Arbitri e ufficiali di gara',7), ('expense','GARE_EVENTI_COSTI','Premi, coppe e medaglie',8), ('expense','GARE_EVENTI_COSTI','Noleggio strutture e attrezzature',9), ('expense','GARE_EVENTI_COSTI','Service audio e video',10), ('expense','GARE_EVENTI_COSTI','Altri costi per gare ed eventi',11),
    -- Uscite: Segreteria
    ('expense','SEGRETERIA_INFORMATICA','Materiale di segreteria',1), ('expense','SEGRETERIA_INFORMATICA','Cancelleria',2), ('expense','SEGRETERIA_INFORMATICA','Stampe e fotocopie',3), ('expense','SEGRETERIA_INFORMATICA','Spese postali',4), ('expense','SEGRETERIA_INFORMATICA','Software e licenze',5), ('expense','SEGRETERIA_INFORMATICA','Gestionale e servizi digitali',6), ('expense','SEGRETERIA_INFORMATICA','Hardware e dispositivi informatici',7), ('expense','SEGRETERIA_INFORMATICA','Hosting, domini e servizi web',8), ('expense','SEGRETERIA_INFORMATICA','Firma digitale e PEC',9), ('expense','SEGRETERIA_INFORMATICA','Assistenza informatica',10), ('expense','SEGRETERIA_INFORMATICA','Altre spese amministrative',11),
    -- Uscite: Consulenze
    ('expense','CONSULENZE_ADEMPIMENTI','Commercialista',1), ('expense','CONSULENZE_ADEMPIMENTI','Consulente del lavoro',2), ('expense','CONSULENZE_ADEMPIMENTI','Consulenze legali',3), ('expense','CONSULENZE_ADEMPIMENTI','Consulenze fiscali',4), ('expense','CONSULENZE_ADEMPIMENTI','Consulenze amministrative',5), ('expense','CONSULENZE_ADEMPIMENTI','Consulenze tecniche',6), ('expense','CONSULENZE_ADEMPIMENTI','Sicurezza sul lavoro',7), ('expense','CONSULENZE_ADEMPIMENTI','Privacy e GDPR',8), ('expense','CONSULENZE_ADEMPIMENTI','Corsi di formazione',9), ('expense','CONSULENZE_ADEMPIMENTI','Aggiornamento tecnico dello staff',10), ('expense','CONSULENZE_ADEMPIMENTI','Certificazioni e adempimenti',11), ('expense','CONSULENZE_ADEMPIMENTI','Altre consulenze',12),
    -- Uscite: Comunicazione
    ('expense','COMUNICAZIONE_MARKETING','Pubblicità',1), ('expense','COMUNICAZIONE_MARKETING','Social media',2), ('expense','COMUNICAZIONE_MARKETING','Sito Internet',3), ('expense','COMUNICAZIONE_MARKETING','Grafica e stampa',4), ('expense','COMUNICAZIONE_MARKETING','Fotografie e video',5), ('expense','COMUNICAZIONE_MARKETING','Ufficio stampa',6), ('expense','COMUNICAZIONE_MARKETING','Materiale promozionale',7), ('expense','COMUNICAZIONE_MARKETING','Insegne e cartellonistica',8), ('expense','COMUNICAZIONE_MARKETING','Eventi promozionali',9), ('expense','COMUNICAZIONE_MARKETING','Omaggi e rappresentanza',10), ('expense','COMUNICAZIONE_MARKETING','Altri costi di comunicazione',11),
    -- Uscite: Bar e merchandising
    ('expense','BAR_MERCH_COSTI','Acquisto prodotti per il bar',1), ('expense','BAR_MERCH_COSTI','Acquisto alimenti e bevande',2), ('expense','BAR_MERCH_COSTI','Materiale monouso',3), ('expense','BAR_MERCH_COSTI','Attrezzature per bar e cucina',4), ('expense','BAR_MERCH_COSTI','Acquisto merchandising',5), ('expense','BAR_MERCH_COSTI','Acquisto abbigliamento destinato alla vendita',6), ('expense','BAR_MERCH_COSTI','Costi per feste e ristoro',7), ('expense','BAR_MERCH_COSTI','Altri costi commerciali',8),
    -- Uscite: Banche e fisco
    ('expense','SPESE_BANCARIE_FISCALI','Spese bancarie',1), ('expense','SPESE_BANCARIE_FISCALI','Commissioni POS',2), ('expense','SPESE_BANCARIE_FISCALI','Commissioni sui pagamenti elettronici',3), ('expense','SPESE_BANCARIE_FISCALI','Interessi passivi',4), ('expense','SPESE_BANCARIE_FISCALI','Imposte e tasse',5), ('expense','SPESE_BANCARIE_FISCALI','IVA',6), ('expense','SPESE_BANCARIE_FISCALI','Ritenute',7), ('expense','SPESE_BANCARIE_FISCALI','Bolli',8), ('expense','SPESE_BANCARIE_FISCALI','Sanzioni e interessi fiscali',9), ('expense','SPESE_BANCARIE_FISCALI','Altri oneri finanziari',10),
    -- Uscite: Investimenti
    ('expense','INVESTIMENTI_STRAORDINARI','Acquisto attrezzature sportive',1), ('expense','INVESTIMENTI_STRAORDINARI','Acquisto arredi',2), ('expense','INVESTIMENTI_STRAORDINARI','Acquisto hardware',3), ('expense','INVESTIMENTI_STRAORDINARI','Lavori sugli impianti',4), ('expense','INVESTIMENTI_STRAORDINARI','Manutenzioni straordinarie',5), ('expense','INVESTIMENTI_STRAORDINARI','Ristrutturazioni',6), ('expense','INVESTIMENTI_STRAORDINARI','Migliorie su beni di terzi',7), ('expense','INVESTIMENTI_STRAORDINARI','Ammortamenti',8), ('expense','INVESTIMENTI_STRAORDINARI','Altri investimenti',9),
    -- Uscite: Straordinarie
    ('expense','SPESE_STRAORDINARIE','Risarcimenti',1), ('expense','SPESE_STRAORDINARIE','Sopravvenienze passive',2), ('expense','SPESE_STRAORDINARIE','Perdite e minusvalenze',3), ('expense','SPESE_STRAORDINARIE','Spese impreviste',4), ('expense','SPESE_STRAORDINARIE','Spese non classificabili',5), ('expense','SPESE_STRAORDINARIE','Altre uscite straordinarie',6)
)
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  CASE WHEN c.direction = 'income' THEN 'I' ELSE 'E' END || '_' || c.group_code || '_' || lpad(c.sort_order::text, 2, '0'),
  c.name,
  c.direction,
  CASE
    WHEN c.group_code IN ('QUOTE_SPORT', 'CONTRIBUTI_LIBERALITA', 'RIMBORSI_INDENNIZZI') THEN 'institutional'
    WHEN c.group_code IN ('SPONSOR_PUB', 'IMPIANTI_RICAVI', 'BAR_MERCH_RICAVI', 'SERVIZI_COMMERCIALI', 'CESSIONI_BENI') THEN 'commercial'
    ELSE 'to_classify'
  END,
  c.group_code IN ('SPONSOR_PUB', 'IMPIANTI_RICAVI', 'BAR_MERCH_RICAVI', 'SERVIZI_COMMERCIALI', 'CESSIONI_BENI'),
  true, false, false, c.sort_order, NULL,
  g.id, true, true, true
FROM catalog AS c
JOIN public.accounting_category_groups AS g
  ON g.direction = c.direction AND g.code = c.group_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.accounting_categories AS existing
  WHERE existing.group_id = g.id
    AND lower(btrim(existing.name)) = lower(btrim(c.name))
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  direction = EXCLUDED.direction,
  default_nature = EXCLUDED.default_nature,
  include_in_commercial_limit = EXCLUDED.include_in_commercial_limit,
  is_system = true,
  sort_order = EXCLUDED.sort_order,
  notes = EXCLUDED.notes,
  group_id = EXCLUDED.group_id,
  updated_at = now();

-- QUOTE resta esclusa dalla Prima nota manuale anche dopo la riclassificazione.
UPDATE public.accounting_categories
SET
  available_in_movements = false,
  available_in_budget = false,
  available_in_reports = true,
  updated_at = now()
WHERE upper(code) = 'QUOTE';

ALTER TABLE public.accounting_categories ENABLE TRIGGER USER;
ALTER TABLE public.accounting_category_groups ENABLE TRIGGER USER;

NOTIFY pgrst, 'reload schema';

COMMIT;
