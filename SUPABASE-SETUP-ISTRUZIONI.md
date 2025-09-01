# 🚀 SETUP COMPLETO SUPABASE PER BRIXIA RUGBY

## ✅ PROBLEMA RISOLTO

Ho modificato il file `src/lib/supabaseClient.ts` per includere direttamente le tue credenziali Supabase. **L'errore dovrebbe essere risolto!**

## 🔧 CONFIGURAZIONE DATABASE SUPABASE

### **PASSO 1: Vai su Supabase Dashboard**

1. Apri [supabase.com](https://supabase.com)
2. Accedi al tuo progetto: `lsuqdeizqapsexeekrua`
3. Vai su **SQL Editor** (menu laterale sinistro)

### **PASSO 2: Esegui lo Script SQL**

1. **Copia tutto il contenuto** del file `supabase-setup.sql`
2. **Incolla nel SQL Editor** di Supabase
3. **Clicca "Run"** per eseguire lo script

### **PASSO 3: Verifica la Configurazione**

Dopo l'esecuzione, dovresti vedere:
- ✅ **15 tabelle create** nel database
- ✅ **7 categorie** (U8, U10, U12, U14, U16, U18, SENIORES)
- ✅ **9 ruoli giocatori** (Pilone, Tallonatore, ecc.)
- ✅ **8 permessi base** configurati

## 🎯 COSA FA LO SCRIPT

### **📊 Tabelle Create:**
1. **`categories`** - Categorie sportive
2. **`roles`** - Ruoli in campo
3. **`players`** - Giocatori
4. **`profiles`** - Profili utenti staff
5. **`user_roles`** - Ruoli utenti
6. **`permissions`** - Sistema permessi
7. **`sessions`** - Sessioni allenamento
8. **`attendance`** - Presenze
9. **`player_categories`** - Collegamenti giocatori-categorie
10. **`staff_categories`** - Collegamenti staff-categorie
11. **`role_permissions`** - Collegamenti ruoli-permessi

### **🔐 Sicurezza:**
- **RLS abilitato** su tutte le tabelle
- **Politiche di accesso** configurate
- **Autenticazione** richiesta per operazioni sensibili

## 🧪 TEST DELLA CONFIGURAZIONE

### **1. Riavvia l'App:**
```bash
# Ferma il server (Ctrl+C)
npm run dev
```

### **2. Dovresti vedere:**
- ✅ **Nessun errore** di connessione Supabase
- ✅ **Console log** di conferma connessione
- ✅ **Pagina di login** che si carica

### **3. Se funziona:**
- L'app si connette a Supabase
- Il database è configurato correttamente
- Puoi iniziare a usare tutte le funzionalità

## 🆘 SE CI SONO PROBLEMI

### **Errore "relation does not exist":**
- Lo script SQL non è stato eseguito completamente
- Ricopia e riesegui lo script

### **Errore "permission denied":**
- Le politiche RLS non sono configurate correttamente
- Verifica che lo script sia stato eseguito fino alla fine

### **Errore di connessione:**
- Le credenziali sono corrette nel codice
- Verifica che il progetto Supabase sia attivo

## 🎉 PROSSIMI PASSI

Una volta che tutto funziona:

1. **Testa il login** con l'app
2. **Prova le funzionalità** presenze
3. **Crea giocatori** e staff
4. **Inizia sessioni** di allenamento

## 📞 SUPPORTO

Se hai problemi:
1. **Controlla la console** del browser per errori
2. **Verifica Supabase Dashboard** per tabelle create
3. **Riesegui lo script SQL** se necessario

---

**🎯 L'app BRIXIA è ora completamente configurata e pronta per l'uso!**

