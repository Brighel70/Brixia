# 🚀 ISTRUZIONI FINALI - Sistema Upload Documenti

**Stato:** ✅ CODICE FIXATO - Manca solo eseguire script SQL

---

## 🎯 **PROBLEMA RISOLTO NEL CODICE**

### **Errori Risolti:**
1. ✅ Aggiunto campo `visibility: 'staff'` obbligatorio
2. ✅ Messaggio di errore più chiaro
3. ✅ Rimosso log console eccessivo

### **File Modificati:**
- ✅ `src/components/DocumentsTab.tsx`
- ✅ `src/pages/CreatePersonView.tsx`

---

## ⚡ **AZIONI RICHIESTE**

### **STEP 1: Esegui Script SQL su Supabase**

**Vai su:** https://supabase.com → Tuo Progetto → SQL Editor

**Esegui questo script:**
```sql
ADD_MISSING_COLUMNS_DOCUMENTS.sql
```

**Cosa fa:**
- ✅ Aggiunge colonna `file_size` (per dimensione file)
- ✅ Aggiunge colonna `file_type` (per tipo MIME)
- ✅ Aggiunge colonna `updated_at` (per timestamp)
- ✅ Imposta default `visibility = 'staff'`
- ✅ Corregge record esistenti con visibility NULL

**Tempo:** ~5 secondi

---

### **STEP 2: (Opzionale) Fix Calcolo Età**

Se vuoi risolvere anche il problema del minorenne:

**Esegui questo script:**
```sql
FIX_IS_MINOR_BUG.sql
```

**Cosa fa:**
- ✅ Corregge il campo `is_minor` per tutte le persone
- ✅ Persone adulte (es. 1990) non più minorenni
- ✅ Ricrea trigger automatico

**Tempo:** ~10 secondi

---

### **STEP 3: Ricarica l'App**

```
1. Torna al browser
2. Premi F5 (o Ctrl+R)
3. Vai su Anagrafica → Documenti
4. Prova a caricare un file!
```

---

## 📋 **PROCEDURA COMPLETA (COPIA/INCOLLA)**

```bash
# 1. Apri Supabase SQL Editor
https://supabase.com

# 2. New Query → Incolla questo:
# Contenuto di ADD_MISSING_COLUMNS_DOCUMENTS.sql

# 3. Clicca RUN e aspetta ✅

# 4. (Opzionale) New Query → Incolla questo:
# Contenuto di FIX_IS_MINOR_BUG.sql

# 5. Clicca RUN e aspetta ✅

# 6. Ricarica l'app nel browser (F5)

# 7. Prova upload documento!
```

---

## ✅ **RISULTATO ATTESO**

**PRIMA:**
```
❌ Errore upload: null value in column "visibility"
❌ Errore upload: Could not find 'file_size' column
```

**DOPO:**
```
✅ Documento caricato con successo!
✅ File visibile nella lista documenti
✅ Download funzionante
```

---

## 🐛 **Se Ancora Non Funziona**

1. **Apri console browser (F12)**
2. **Leggi l'errore esatto** sotto "Errore upload:"
3. **Verifica che lo script SQL sia stato eseguito**
4. **Controlla che il bucket `docs` esista** su Supabase Storage

---

## 📊 **Verifica Rapida SQL**

Per verificare che tutto sia a posto, esegui su Supabase:

```sql
-- Verifica colonne documents
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'documents'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Dovresti vedere:**
- ✅ file_size (integer)
- ✅ file_type (text)
- ✅ visibility (text, default 'staff')
- ✅ updated_at (timestamp)

---

## 🎯 **TL;DR**

```
1. Supabase SQL Editor
2. Esegui ADD_MISSING_COLUMNS_DOCUMENTS.sql
3. F5 nell'app
4. Upload documento
5. ✅ FUNZIONA!
```

---

**⚡ ESEGUI LO SCRIPT SQL ADESSO!** 🚀

Tempo richiesto: **5 secondi** ⏱️














