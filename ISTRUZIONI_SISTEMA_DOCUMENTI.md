# 📄 Sistema di Gestione Documenti - Brixia Rugby

## ✅ Implementazione Completata

Il sistema di caricamento documenti è stato implementato nel tab **"Documenti"** della sezione Anagrafica persone.

---

## 🎯 Funzionalità Implementate

### ✨ **Caricamento Documenti**
- ✅ Drag & Drop (trascina file nell'area)
- ✅ Click per selezionare file
- ✅ Supporto PDF, JPG, PNG (max 10MB)
- ✅ Form con titolo e categoria documento
- ✅ Validazione tipo e dimensione file
- ✅ Upload su Supabase Storage
- ✅ Salvataggio metadata nel database

### 📋 **Categorie Documenti**
1. **Documento Identità** (Carta d'identità, Patente, ecc.)
2. **Certificato Medico** (Certificati medici sportivi)
3. **Ricevuta Pagamento** (Ricevute quote, pagamenti)
4. **Consenso/Liberatoria** (Liberatorie, consensi privacy)
5. **Altro** (Altri documenti)

### 🗂️ **Gestione Documenti**
- ✅ Lista documenti caricati con dettagli
- ✅ Icone per tipo file (📄 PDF, 🖼️ Immagini)
- ✅ Visualizzazione data, categoria, dimensione
- ✅ Download/Visualizzazione documento
- ✅ Eliminazione documento (con conferma)
- ✅ Contatore documenti

---

## 🚀 Setup Iniziale (OBBLIGATORIO)

### **STEP 1: Configurazione Database**

Vai su **Supabase → SQL Editor** ed esegui lo script:

```bash
setup_documents_system.sql
```

Questo script:
- ✅ Crea la tabella `documents`
- ✅ Configura gli indici per performance
- ✅ Abilita Row Level Security (RLS)
- ✅ Crea il bucket Storage `docs`
- ✅ Configura le policies di sicurezza

### **STEP 2: Verifica Bucket Storage**

1. Vai su **Supabase → Storage**
2. Verifica che esista il bucket **`docs`**
3. Impostazioni bucket:
   - **Nome**: `docs`
   - **Pubblico**: NO (privato)
   - **Allowed MIME types**: `application/pdf, image/jpeg, image/jpg, image/png`
   - **Max file size**: 10MB

### **STEP 3: Configurazione CORS (Opzionale per sviluppo)**

Se hai problemi di CORS in locale:

1. Vai su **Supabase → Storage → Settings → CORS**
2. Aggiungi configurazione:
   - **Origin**: `http://localhost:3000`
   - **Methods**: `GET, POST, PUT, DELETE`
   - **Headers**: `Authorization, Content-Type, Range`

---

## 📖 Come Usare il Sistema

### **1. Accesso alla Sezione Documenti**

1. Vai su **Anagrafica** (menu principale)
2. Clicca su una persona o crea una nuova persona
3. Clicca sul tab **"Documenti"**

### **2. Caricare un Documento**

#### **Metodo A: Drag & Drop**
1. Trascina un file PDF/JPG/PNG nell'area tratteggiata
2. Compila il form:
   - **Titolo**: Nome descrittivo del documento
   - **Categoria**: Seleziona la categoria appropriata
3. Clicca su **"Carica Documento"**

#### **Metodo B: Click per Selezionare**
1. Clicca sull'area tratteggiata
2. Seleziona il file dal tuo computer
3. Compila il form (come sopra)
4. Clicca su **"Carica Documento"**

### **3. Visualizzare un Documento**

1. Nella lista documenti, clicca sull'icona 👁️ (occhio)
2. Il documento si aprirà in una nuova finestra
3. Puoi scaricarlo o visualizzarlo direttamente

### **4. Eliminare un Documento**

1. Clicca sull'icona 🗑️ (cestino) accanto al documento
2. Conferma l'eliminazione
3. Il documento viene rimosso sia dal database che dallo storage

---

## 🔒 Sicurezza

### **Protezioni Implementate**

✅ **Validazione Client-Side**
- Verifica tipo file (solo PDF, JPG, PNG)
- Verifica dimensione (max 10MB)
- Toast di errore per file non validi

✅ **Row Level Security (RLS)**
- Solo staff autenticato può gestire documenti
- Policies per SELECT, INSERT, UPDATE, DELETE

✅ **Storage Security**
- Bucket privato (non pubblico)
- Signed URLs con scadenza (1 ora)
- Policies di accesso per staff autenticato

✅ **Organizzazione File**
- File organizzati per persona: `people/{person_id}/`
- Nomi file univoci con timestamp e random ID
- Metadata salvati nel database

---

## 📂 Struttura File Storage

```
docs/
└── people/
    ├── {person_id_1}/
    │   ├── 2024-01-15T10-30-00-000Z_abc123.pdf
    │   ├── 2024-01-16T14-20-00-000Z_def456.jpg
    │   └── ...
    ├── {person_id_2}/
    │   └── ...
    └── ...
```

---

## 🗄️ Struttura Database

### **Tabella: `documents`**

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | UUID | ID univoco documento |
| `person_id` | UUID | Riferimento alla persona |
| `title` | TEXT | Titolo documento |
| `category` | TEXT | Categoria documento |
| `file_path` | TEXT | Path nel bucket Storage |
| `file_size` | INTEGER | Dimensione file in bytes |
| `file_type` | TEXT | MIME type del file |
| `visibility` | TEXT | Livello di visibilità |
| `created_by` | UUID | Chi ha caricato il documento |
| `created_at` | TIMESTAMP | Data creazione |
| `updated_at` | TIMESTAMP | Data ultimo aggiornamento |

---

## 🎨 UI/UX

### **Stati UI**

1. **Non Salvato** → Messaggio: "Salva la persona prima di caricare documenti"
2. **Vuoto** → Area drag & drop attiva
3. **Drag Over** → Area evidenziata in blu
4. **Form Upload** → Form con titolo, categoria e pulsante carica
5. **Upload in Corso** → Pulsante disabilitato con "Caricamento..."
6. **Lista Documenti** → Card per ogni documento con azioni

### **Feedback Utente**

- ✅ Toast di successo: "Documento caricato con successo!"
- ❌ Toast di errore: "File troppo grande" / "Tipo non supportato"
- 🗑️ Conferma eliminazione: "Sei sicuro di voler eliminare questo documento?"
- ⚠️ Validazione: Campi obbligatori evidenziati

---

## 🐛 Troubleshooting

### **Problema: "Errore nel caricamento del documento"**

**Possibili cause:**
1. Tabella `documents` non creata
2. Bucket `docs` non esiste
3. Policies RLS non configurate
4. Utente non autenticato

**Soluzione:**
- Esegui lo script `setup_documents_system.sql`
- Verifica che il bucket `docs` esista su Supabase
- Controlla che l'utente sia autenticato

### **Problema: "Errore nel download del documento"**

**Possibili cause:**
1. File eliminato manualmente da Storage
2. Policies Storage non configurate
3. Signed URL scaduto (dopo 1 ora)

**Soluzione:**
- Ricarica il documento
- Verifica le policies Storage
- Prova a scaricare di nuovo

### **Problema: "File troppo grande"**

**Soluzione:**
- Comprimi il file prima di caricarlo
- Il limite è 10MB per file

### **Problema: CORS Error in sviluppo**

**Soluzione:**
- Configura CORS su Supabase Storage
- Aggiungi `http://localhost:3000` agli origins permessi

---

## 📊 Statistiche e Limiti

### **Limiti Attuali**
- ✅ Dimensione massima file: **10MB**
- ✅ Tipi file supportati: **PDF, JPG, PNG**
- ✅ Documenti per persona: **Illimitati**
- ✅ Durata signed URL: **1 ora**

### **Storage Supabase (Piano Free)**
- 📦 Storage totale: **1GB**
- 🔄 Bandwidth mensile: **2GB**
- 📄 File uploads: **50MB max per file**

---

## 🚀 Prossimi Sviluppi (Opzionali)

### **Feature da Implementare**

1. **📎 Upload Multiplo**
   - Carica più file contemporaneamente
   - Progress bar per ogni file

2. **🖼️ Anteprima Immagini**
   - Thumbnail per immagini
   - Preview inline per PDF

3. **🔍 Ricerca Documenti**
   - Ricerca per titolo
   - Filtro per categoria
   - Ordinamento per data

4. **📥 Download Multiplo**
   - Download ZIP di più documenti
   - Export documenti persona

5. **📝 Note e Tag**
   - Aggiungere note ai documenti
   - Tag personalizzati

6. **🔔 Notifiche Scadenza**
   - Alert per certificati in scadenza
   - Dashboard scadenze documenti

---

## ✅ Checklist Pre-Produzione

Prima di andare in produzione, verifica:

- [ ] Script `setup_documents_system.sql` eseguito su Supabase
- [ ] Bucket `docs` creato e configurato come privato
- [ ] Policies RLS attive su tabella `documents`
- [ ] Policies Storage attive sul bucket `docs`
- [ ] Test di upload documento completato
- [ ] Test di download documento completato
- [ ] Test di eliminazione documento completato
- [ ] Verifica limiti Supabase plan (storage e bandwidth)
- [ ] Configurazione CORS per dominio produzione
- [ ] Backup database testato

---

## 📞 Supporto

Per problemi o domande:
1. Verifica i log della console browser (F12)
2. Controlla i log Supabase (Logs & Reports)
3. Verifica che tutte le policies siano attive
4. Controlla lo storage utilizzato su Supabase

---

**🎉 Sistema Documenti Pronto!**

Ora puoi caricare, gestire e organizzare tutti i documenti dei tesserati della società sportiva!


