# 🚨 FIX URGENTE: Foreign Key Injuries

## ❌ **PROBLEMA:**
```
insert or update on table "injuries" violates foreign key constraint "injuries_person_id_fkey"
```

**Causa:** La tabella `injuries` ha una foreign key che punta alla tabella sbagliata!

---

## ✅ **SOLUZIONE:**

### **STEP 1: Esegui Script SQL** ⚡

**File:** `fix_injuries_foreign_key.sql`

```
1. Vai su Supabase → SQL Editor
2. New Query
3. Apri: fix_injuries_foreign_key.sql
4. Copia TUTTO il contenuto
5. Incolla nel SQL Editor
6. RUN (o Ctrl+Enter)
7. Aspetta messaggio ✅
```

### **STEP 2: Ricarica App** ⚡

```
F5 nel browser
```

### **STEP 3: Test Creazione Infortunio** ⚡

```
1. Vai su Anagrafica → Modifica persona
2. Tab "Infortuni"
3. Clicca "Nuovo Infortunio"
4. Compila il form
5. Clicca "Salva"
6. Dovrebbe funzionare senza errori!
```

---

## 🎯 **RISULTATO ATTESO:**

### **PRIMA (Errore):**
```
❌ Errore nel salvataggio: foreign key constraint "injuries_person_id_fkey"
❌ Impossibile creare nuovi infortuni
```

### **DOPO (Corretto):**
```
✅ Infortunio salvato con successo
✅ Nessun errore foreign key
✅ Creazione infortuni funzionante
```

---

## 📋 **COSA FA LO SCRIPT:**

```
✅ Verifica constraint attuale
✅ Elimina constraint errato
✅ Crea constraint corretto (punta a people)
✅ Verifica creazione corretta
✅ Test dati tabella people
```

---

## 🆘 **SE HAI PROBLEMI:**

### **Problema:** Script non funziona
- Controlla che sia copiato tutto
- Premi RUN (non solo Enter)

### **Problema:** Ancora errori dopo script
- Ricarica pagina (F5)
- Controlla console browser (F12)

### **Problema:** Tabella people vuota
- Esegui prima gli script di migrazione dati

---

**🎉 Dopo questo fix potrai creare infortuni senza errori!** 🚀













