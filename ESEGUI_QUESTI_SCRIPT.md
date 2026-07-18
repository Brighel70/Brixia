# 🚀 SCRIPT SQL DA ESEGUIRE SU SUPABASE

**IMPORTANTE:** Esegui questi script nell'ordine indicato!

---

## ✅ **SCRIPT 1: Aggiungi Colonne Mancanti** (OBBLIGATORIO)

**File:** `ADD_MISSING_COLUMNS_DOCUMENTS.sql`

**Cosa fa:**
- Aggiunge le colonne `file_size` e `file_type` alla tabella `documents` esistente
- Risolve l'errore "Could not find the 'file_size' column"

**Come eseguire:**
1. Apri **Supabase → SQL Editor**
2. Copia tutto il contenuto di `ADD_MISSING_COLUMNS_DOCUMENTS.sql`
3. Incolla nel SQL Editor
4. Clicca **RUN**
5. Verifica che vedi: ✅ Colonna file_size aggiunta / ✅ Colonna file_type aggiunta

---

## ✅ **SCRIPT 2: Fix Calcolo Età** (OBBLIGATORIO)

**File:** `FIX_IS_MINOR_BUG.sql`

**Cosa fa:**
- Corregge il campo `is_minor` per tutte le persone
- Persone adulte non saranno più considerate minorenni
- Ricrea il trigger per calcolo automatico

**Come eseguire:**
1. Apri **Supabase → SQL Editor** (nuova query)
2. Copia tutto il contenuto di `FIX_IS_MINOR_BUG.sql`
3. Incolla nel SQL Editor
4. Clicca **RUN**
5. Verifica che vedi: ✅ PROBLEMA RISOLTO

---

## 📋 **PROCEDURA COMPLETA**

### **STEP 1: Vai su Supabase**
```
1. Apri https://supabase.com
2. Accedi al tuo progetto
3. Menu laterale → SQL Editor
```

### **STEP 2: Esegui Script 1**
```
1. New Query
2. Copia contenuto di: ADD_MISSING_COLUMNS_DOCUMENTS.sql
3. Incolla e RUN
4. Aspetta il messaggio ✅
```

### **STEP 3: Esegui Script 2**
```
1. New Query (altra tab)
2. Copia contenuto di: FIX_IS_MINOR_BUG.sql
3. Incolla e RUN
4. Aspetta il messaggio ✅
```

### **STEP 4: Ricarica l'App**
```
1. Torna al browser
2. Premi F5
3. Vai su Anagrafica → Documenti
4. Prova l'upload!
```

---

## 🎯 **Ordine di Esecuzione**

**PRIMA questo:**
```sql
ADD_MISSING_COLUMNS_DOCUMENTS.sql  ← ⚡ ESEGUI SUBITO!
```

**POI questo:**
```sql
FIX_IS_MINOR_BUG.sql               ← ⚡ ESEGUI DOPO!
```

---

## ⏱️ **Tempo Richiesto**

- **Script 1:** ~5 secondi
- **Script 2:** ~10 secondi
- **TOTALE:** ~15 secondi

---

## ✅ **Checklist**

- [ ] Script 1 eseguito: ADD_MISSING_COLUMNS_DOCUMENTS.sql
- [ ] Script 2 eseguito: FIX_IS_MINOR_BUG.sql
- [ ] App ricaricata (F5)
- [ ] Test upload documento
- [ ] Persona del 1990 non più minorenne

---

## 🆘 **Se Hai Problemi**

### **Problema: Non riesco ad accedere a Supabase**
- Controlla le credenziali
- Verifica di essere nel progetto corretto

### **Problema: Errore durante l'esecuzione script**
- Leggi il messaggio di errore
- Verifica che non ci siano script già eseguiti
- Controlla le policies RLS

### **Problema: Upload documenti ancora non funziona**
1. Verifica che lo script 1 sia stato eseguito
2. Controlla la console browser (F12)
3. Ricarica la pagina (F5)
4. Prova di nuovo

---

## 🎉 **RISULTATO ATTESO**

**Dopo aver eseguito gli script:**

✅ Upload documenti funzionante  
✅ Nessun errore 400 in console  
✅ Calcolo età corretto  
✅ Popup tutor solo per minorenni  
✅ App veloce e stabile  

---

**⚡ VAI SU SUPABASE ED ESEGUI I 2 SCRIPT!**














