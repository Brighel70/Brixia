# Sistema di Gestione Quote e Costi

## Panoramica

Il sistema di gestione quote permette di gestire tutti i costi e le quote della società sportiva, incluse:

- **Quote di iscrizione** (tessere annuali)
- **Quote gite** (trasferte, ritiri)
- **Quote corsi** (formazione, aggiornamenti)
- **Quote eventi** (tornei, manifestazioni)
- **Quote attrezzature** (divise, materiali)
- **Quote assicurazioni** (infortuni, RC)
- **Altre quote** (contributi vari)

## Funzionalità Principali

### 1. Gestione Quote
- ✅ Creazione, modifica ed eliminazione quote
- ✅ Categorizzazione per tipo e categoria di persone
- ✅ Importi personalizzabili
- ✅ Quote obbligatorie e opzionali
- ✅ Date di scadenza
- ✅ Stati attivo/inattivo

### 2. Assegnazioni
- ✅ Assegnazione quote ai tesserati
- ✅ Importi personalizzati per assegnazione
- ✅ Filtri per categoria di persone
- ✅ Ricerca per nome
- ✅ Gestione scadenze

### 3. Tracking Pagamenti
- ✅ Stati: In Attesa, Pagato, Scaduto, Annullato
- ✅ Metodi di pagamento
- ✅ Date di pagamento
- ✅ Note e riferimenti

## Struttura Database

### Tabelle Principali

#### `fees` - Quote Principali
```sql
- id (UUID, PK)
- name (VARCHAR) - Nome quota
- description (TEXT) - Descrizione
- type (ENUM) - Tipo: membership, trip, course, event, equipment, insurance, other
- amount (INTEGER) - Importo in centesimi
- currency (VARCHAR) - Valuta (default: EUR)
- category (ENUM) - Categoria: adult, youth, senior, family, all
- is_active (BOOLEAN) - Attiva/Inattiva
- is_mandatory (BOOLEAN) - Obbligatoria/Opzionale
- due_date (DATE) - Data scadenza
- created_at, updated_at (TIMESTAMP)
```

#### `fee_assignments` - Assegnazioni
```sql
- id (UUID, PK)
- fee_id (UUID, FK) - Riferimento quota
- person_id (UUID, FK) - Riferimento persona
- amount (INTEGER) - Importo specifico (può differire dalla quota base)
- status (ENUM) - pending, paid, overdue, cancelled
- due_date (DATE) - Data scadenza
- paid_date (DATE) - Data pagamento
- payment_method (VARCHAR) - Metodo pagamento
- notes (TEXT) - Note
- created_at, updated_at (TIMESTAMP)
```

#### `payments` - Pagamenti
```sql
- id (UUID, PK)
- assignment_id (UUID, FK) - Riferimento assegnazione
- amount (INTEGER) - Importo pagato
- payment_method (VARCHAR) - Metodo pagamento
- payment_date (DATE) - Data pagamento
- reference (VARCHAR) - Riferimento (bonifico, ricevuta)
- notes (TEXT) - Note
- created_at (TIMESTAMP)
```

## Quote Predefinite

Il sistema include quote predefinite per una società sportiva:

### Tessere/Iscrizioni
- Tessera Annuale Adulti: €50.00
- Tessera Annuale Giovanili: €30.00
- Tessera Annuale Senior: €40.00
- Tessera Famiglia: €120.00

### Gite e Trasferte
- Gita di Fine Anno: €80.00
- Ritiro Estivo: €150.00
- Trasferta Nord Italia: €50.00
- Trasferta Sud Italia: €80.00

### Corsi e Formazione
- Corso Arbitri: €200.00
- Corso Allenatori: €250.00
- Corso Primo Soccorso: €150.00
- Seminario Tecnico: €50.00

### Eventi
- Torneo Estivo: €30.00
- Festa di Fine Anno: €20.00
- Cena Sociale: €25.00

### Attrezzature
- Divisa Casa: €45.00
- Divisa Trasferta: €45.00
- Tuta da Allenamento: €35.00
- Borsa Sportiva: €20.00

### Assicurazioni
- Assicurazione Infortuni: €30.00
- Assicurazione Responsabilità Civile: €20.00

## Utilizzo

### 1. Accesso al Sistema
- Vai alla Home → "Quote e Costi"
- Richiede permessi di amministrazione

### 2. Creare una Nuova Quota
1. Clicca "Nuova Quota"
2. Compila i dettagli:
   - Nome e descrizione
   - Tipo di quota
   - Importo
   - Categoria di persone
   - Se obbligatoria
   - Data scadenza (opzionale)
3. Salva

### 3. Assegnare Quote ai Tesserati
1. Dalla lista quote, clicca l'icona 📋
2. Seleziona le persone:
   - Usa i filtri per categoria
   - Cerca per nome
   - Seleziona singolarmente o "Seleziona Tutti"
3. Configura:
   - Importo personalizzato (opzionale)
   - Data scadenza
   - Note
4. Crea assegnazioni

### 4. Gestire Pagamenti
- Le assegnazioni appaiono nel tab "Assegnazioni"
- Puoi vedere lo stato: In Attesa, Pagato, Scaduto, Annullato
- Per registrare un pagamento, aggiorna lo stato e la data

## Permessi

Il sistema richiede il permesso `SETTINGS.EDIT` per:
- Creare/modificare/eliminare quote
- Assegnare quote ai tesserati
- Visualizzare assegnazioni e report

## Personalizzazione

### Aggiungere Nuovi Tipi di Quota
Modifica l'enum `type` nella tabella `fees` e aggiorna l'interfaccia TypeScript.

### Aggiungere Nuove Categorie
Modifica l'enum `category` nella tabella `fees` e aggiorna l'interfaccia TypeScript.

### Template Quote
Il sistema include template predefiniti per creare rapidamente quote simili.

## Report e Statistiche

### Vista `fee_statistics`
```sql
SELECT 
  type,
  category,
  total_fees,
  active_fees,
  mandatory_fees,
  avg_amount,
  min_amount,
  max_amount
FROM fee_statistics
ORDER BY type, category;
```

### Vista `assignment_details`
```sql
SELECT 
  fa.id,
  p.first_name,
  p.last_name,
  f.name as fee_name,
  f.type as fee_type,
  fa.amount,
  fa.status,
  fa.due_date,
  fa.paid_date
FROM assignment_details
ORDER BY fa.created_at DESC;
```

## Sconti e Promozioni

Il sistema supporta sconti tramite la tabella `fee_discounts`:
- Sconti percentuali o importi fissi
- Applicabili a quote specifiche o categorie
- Periodi di validità
- Categorie di persone specifiche

## Migrazione Dati

Per migrare quote esistenti:
1. Esegui `database/fees_tables.sql`
2. Importa le quote esistenti nella tabella `fees`
3. Crea le assegnazioni nella tabella `fee_assignments`
4. Registra i pagamenti nella tabella `payments`

## Supporto

Per problemi o domande:
1. Controlla i log della console
2. Verifica i permessi utente
3. Controlla la struttura del database
4. Consulta la documentazione Supabase



