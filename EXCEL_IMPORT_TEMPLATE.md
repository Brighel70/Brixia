# Template Excel per Importazione Giocatori

## Struttura File Excel (.xlsx)

Il file Excel deve avere **una sola riga di intestazione** nella prima riga, seguita dai dati dei giocatori.

### Colonne Richieste

| Nome Colonna | Obbligatorio | Tipo | Descrizione | Esempio |
|--------------|--------------|------|-------------|---------|
| **Nome** | ✅ Sì | Testo | Nome del giocatore | Mario |
| **Cognome** | ✅ Sì | Testo | Cognome del giocatore | Rossi |
| **Data Nascita** | ✅ Sì | Data | Data di nascita (formato GG/MM/AAAA) | 15/03/2005 |
| **Codice Fiscale** | ✅ Sì | Testo | Codice fiscale (deve essere univoco) | RSSMRA80A01H501U |
| **Categoria** | ✅ Sì | Testo | Nome della categoria del giocatore (una per riga) | Serie B |
| **Codice FIR** | ❌ No | Testo | Codice FIR del giocatore | FIR123456 |
| **Sesso** | ❌ No | Testo | M, F o X (o Maschio/Femmina/Altro) | M |
| **Cittadinanza** | ❌ No | Testo | Nazionalità del giocatore | Italiana |
| **Indirizzo** | ❌ No | Testo | Via e numero civico | Via Roma 10 |
| **CAP** | ❌ No | Testo | Codice postale | 25100 |
| **Città** | ❌ No | Testo | Città di residenza | Brescia |
| **Provincia** | ❌ No | Testo | Provincia di residenza | BS |
| **Email** | ❌ No | Testo | Email del giocatore | mario.rossi@email.com |
| **Telefono** / **Cellulare** | ❌ No | Testo | Numero di telefono | +39 333 1234567 |

### Note Importanti

1. **Prima riga = Intestazioni**: La prima riga del file deve contenere esattamente i nomi delle colonne sopra indicati.

2. **Righe duplicate**: Se lo stesso giocatore (stesso Codice Fiscale) compare in più righe con categorie diverse, verrà importata SOLO la PRIMA riga trovata. Le altre verranno saltate e segnalate nel log.

3. **Formato Data**: La data di nascita DEVE essere nel formato **GG/MM/AAAA** (es. 15/03/2005). Altri formati non saranno accettati.

4. **Categorie**: 
   - Ogni riga contiene UNA sola categoria nella colonna "Categoria"
   - Il sistema mapperà automaticamente il nome della categoria all'ID corretto nel database
   - Esempi di categorie valide: "Serie B", "Serie C", "U18", "U16", "U14", "U12", "U10", "U8", ecc.

5. **Validazione**: 
   - Tutti i campi obbligatori devono essere presenti e non vuoti
   - Se un campo obbligatorio è vuoto, quella riga verrà saltata e segnalata nel log
   - Se il Codice Fiscale esiste già nel database, quella riga verrà saltata e segnalata nel log

### Esempio Struttura File Excel

```
| Nome  | Cognome | Data Nascita | Codice Fiscale | Codice FIR | Categoria | Sesso | Cittadinanza | Indirizzo   | CAP   | Città    | Provincia | Email           | Cellulare  |
|-------|---------|--------------|----------------|------------|-----------|-------|--------------|-------------|-------|----------|-----------|-----------------|------------|
| Mario | Rossi   | 15/03/2005   | RSSMRA80A01H   | FIR123456  | Serie B   | M     | Italiana     | Via Roma 10 | 25100 | Brescia  | BS        | mario@email.com | 3331234567 |
| Luigi | Bianchi | 20/05/2006   | BNCLGU80A01H   |            | Serie C   | M     |              |             |       |          |           |                 |            |
| Anna  | Verdi   | 10/08/2007   | VRDNNA80A01H   | FIR789012  | U18       | F     | Italiana     | Via Verdi 5  | 20100 | Milano   | MI        | anna@email.com  | 3337654321 |
```

### Dove verranno salvati i dati

Tutti i dati verranno salvati nella tabella **`people`** con:
- `given_name` = Nome
- `family_name` = Cognome  
- `full_name` = Nome + Cognome (generato automaticamente)
- `date_of_birth` = Data Nascita
- `fiscal_code` = Codice Fiscale
- `fir_code` = Codice FIR (se presente)
- `gender` = Sesso (M, F, o X - normalizzato automaticamente)
- `nationality` = Cittadinanza (se presente)
- `address_street` = Indirizzo (se presente)
- `address_zip` = CAP (se presente)
- `address_city` = Città (se presente)
- `address_region` = Provincia (se presente)
- `email` = Email (se presente)
- `phone` = Telefono/Cellulare (se presente)
- `is_player` = true (impostato automaticamente per tutti i giocatori importati)
- `player_categories` = Array JSONB contenente l'ID della categoria trovata nel database
- `status` = 'active' (impostato automaticamente)
- `is_minor` = true/false (calcolato automaticamente dalla data di nascita)

### Mapping Categorie

Il sistema cercherà automaticamente la corrispondenza tra il nome categoria nell'Excel e le categorie nel database usando:
1. Nome esatto (es. "Serie B" → cerca categoria con name = "Serie B")
2. Se non trovato, cerca per codice (es. "Serie B" → cerca categoria con code = "SERIE_B")
3. Se ancora non trovato, la riga verrà saltata e segnalata nel log


