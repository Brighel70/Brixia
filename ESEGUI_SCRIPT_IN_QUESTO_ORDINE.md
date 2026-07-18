# ⚡ ESEGUI QUESTI 3 SCRIPT SQL IN ORDINE

**IMPORTANTE:** Segui l'ordine esatto! ⚠️

---

## 🎯 **ERRORE ATTUALE:**

```
Key is not present in table "people3"
violates foreign key constraint "documents_person_id_fkey"
```

**Causa:** La tabella `documents` ha una foreign key che punta a `people3` invece di `people`!

---

## 📋 **SCRIPT DA ESEGUIRE (IN ORDINE)**

### **SCRIPT 1️⃣: FIX_DOCUMENTS_FOREIGN_KEY.sql** ⚡ PRIMA QUESTO!

**Cosa fa:**
- ✅ Elimina la foreign key errata (punta a people3)
- ✅ Crea la foreign key corretta (punta a people)

**Tempo:** ~3 secondi

---

### **SCRIPT 2️⃣: ADD_MISSING_COLUMNS_DOCUMENTS.sql** ⚡ POI QUESTO!

**Cosa fa:**
- ✅ Aggiunge colonne `file_size` e `file_type`
- ✅ Aggiunge colonna `updated_at`
- ✅ Imposta default per `visibility`

**Tempo:** ~3 secondi

---

### **SCRIPT 3️⃣: FIX_IS_MINOR_BUG.sql** ⚡ INFINE QUESTO!

**Cosa fa:**
- ✅ Corregge il calcolo del campo `is_minor`
- ✅ Persone adulte non più minorenni
- ✅ Ricrea trigger automatico

**Tempo:** ~10 secondi

---

## 🚀 **PROCEDURA COMPLETA**

### **STEP 1: Apri Supabase**
```
1. Vai su https://supabase.com
2. Accedi al progetto
3. Menu laterale → SQL Editor
```

### **STEP 2: Esegui SCRIPT 1**
```
1. New Query
2. Apri: FIX_DOCUMENTS_FOREIGN_KEY.sql
3. Copia TUTTO il contenuto
4. Incolla nel SQL Editor
5. RUN (o Ctrl+Enter)
6. Aspetta messaggio ✅
```

### **STEP 3: Esegui SCRIPT 2**
```
1. New Query (nuova tab)
2. Apri: ADD_MISSING_COLUMNS_DOCUMENTS.sql
3. Copia TUTTO il contenuto
4. Incolla nel SQL Editor
5. RUN (o Ctrl+Enter)
6. Aspetta messaggio ✅
```

### **STEP 4: Esegui SCRIPT 3**
```
1. New Query (nuova tab)
2. Apri: FIX_IS_MINOR_BUG.sql
3. Copia TUTTO il contenuto
4. Incolla nel SQL Editor
5. RUN (o Ctrl+Enter)
6. Aspetta messaggio ✅
```

### **STEP 5: Ricarica l'App**
```
1. Torna al browser
2. Premi F5
3. Vai su Anagrafica → Documenti
4. Prova upload file!
```

---

## ⏱️ **TEMPO TOTALE: ~20 SECONDI**

- Script 1: ~3 sec
- Script 2: ~3 sec  
- Script 3: ~10 sec
- Reload: ~1 sec

---

## ✅ **CHECKLIST**

```
□ SCRIPT 1: FIX_DOCUMENTS_FOREIGN_KEY.sql
□ SCRIPT 2: ADD_MISSING_COLUMNS_DOCUMENTS.sql
□ SCRIPT 3: FIX_IS_MINOR_BUG.sql
□ Ricarica app (F5)
□ Test upload documento
```

---

## 🎉 **RISULTATO ATTESO**

**PRIMA:**
```
❌ Errore 409: Key not present in table "people3"
❌ Errore 400: null value in column "visibility"
❌ Popup tutor per persone adulte
```

**DOPO:**
```
✅ Documento caricato con successo!
✅ File visibile nella lista
✅ Download funzionante
✅ Calcolo età corretto
```

---

## 🆘 **SE HAI PROBLEMI**

**Problema:** Errore durante esecuzione script
- Leggi il messaggio di errore nel SQL Editor
- Potrebbe già essere fixato

**Problema:** Upload ancora non funziona
1. Verifica che TUTTI e 3 gli script siano stati eseguiti
2. Controlla la console browser (F12) per vedere errore esatto
3. Ricarica pagina (F5)

---

## 🎯 **ORDINE CRITICO**

**NON saltare passaggi! Esegui in QUESTO ordine:**

```
1️⃣ FIX_DOCUMENTS_FOREIGN_KEY.sql       ← PRIMA!
2️⃣ ADD_MISSING_COLUMNS_DOCUMENTS.sql   ← POI!
3️⃣ FIX_IS_MINOR_BUG.sql                ← INFINE!
```

---

**⚡ VAI SU SUPABASE ED ESEGUI I 3 SCRIPT IN ORDINE!** 🚀














