# 🎯 NUOVO SISTEMA CREAZIONE SESSIONI AUTOMATICHE

## 📋 COSA È CAMBIATO

È stato implementato un **sistema intelligente** per creare sessioni di allenamento che:

✅ **Usa la configurazione `training_locations` come unica fonte di verità**  
✅ **Rispetta l'ordine ciclico** dei giorni di allenamento  
✅ **Evita duplicati** automaticamente  
✅ **Calcola automaticamente** data, ora e luogo  
✅ **Funziona identicamente** su web app e mobile app  

---

## 🏗️ ARCHITETTURA

### File Creati/Modificati

```
Web App (C:\Users\BRIXIA\Dropbox\@ AP\APP BRIXIA\Brixia\)
├── src/lib/sessionScheduler.ts        ✅ NUOVO - Logica condivisa
├── PULIZIA_SESSIONI_ESEMPIO.sql       ✅ NUOVO - Script pulizia
└── NUOVO_SISTEMA_SESSIONI.md          ✅ NUOVO - Questa guida

Mobile App (C:\Users\BRIXIA\Documents\FlowMe\)
├── src/lib/sessionScheduler.ts        ✅ NUOVO - Stessa logica
└── src/types/database.ts              ✅ MODIFICATO - Aggiunti tipi
```

---

## 🚀 COME FUNZIONA

### 1. **Configurazione Categoria** (Training Locations)

Ogni categoria (es. U16) ha una configurazione in `training_locations`:

| Giorno    | Sede        | Ora Inizio | Ora Fine |
|-----------|-------------|------------|----------|
| tuesday   | Brescia     | 18:00      | 19:30    |
| thursday  | Gussago     | 17:30      | 19:00    |
| friday    | Ospitaletto | 18:00      | 19:30    |

**Ordine Importante**: I giorni sono ordinati! Il sistema crea sessioni in questo ordine ciclico.

### 2. **Algoritmo di Creazione**

```typescript
// Se NON ci sono sessioni
→ Trova il primo Martedì >= oggi
→ Crea sessione: Martedì, Brescia, 18:00-19:30

// Se l'ultima sessione è Martedì
→ Prossima: Giovedì (prossimo nel ciclo)
→ Crea sessione: Giovedì, Gussago, 17:30-19:00

// Se l'ultima sessione è Venerdì
→ Prossima: Martedì (ciclo ricomincia!)
→ Crea sessione: Martedì settimana successiva
```

### 3. **Prevenzione Duplicati**

Se la data calcolata esiste già:
→ Avanza al prossimo giorno configurato
→ Ripete fino a trovare una data libera

---

## 📖 GUIDA UTILIZZO

### STEP 1: Configura Training Locations

#### Opzione A: Dalla Web App

1. Vai su **"Settings"** o **"Attività"**
2. Seleziona una categoria
3. Clicca **"Gestisci Sedi Allenamento"** o **"Training Locations"**
4. Aggiungi i giorni/orari/location per quella categoria

**Esempio per U16**:
```
➕ Aggiungi Sede
- Sede: Brescia
- Giorno: Martedì
- Ora Inizio: 18:00
- Ora Fine: 19:30
→ Salva

➕ Aggiungi Sede
- Sede: Gussago
- Giorno: Giovedì
- Ora Inizio: 17:30
- Ora Fine: 19:00
→ Salva

➕ Aggiungi Sede
- Sede: Ospitaletto
- Giorno: Venerdì
- Ora Inizio: 18:00
- Ora Fine: 19:30
→ Salva
```

#### Opzione B: Via SQL (Più Veloce)

```sql
-- Esempio per categoria U16
INSERT INTO training_locations (category_id, location, weekday, start_time, end_time)
VALUES 
  ((SELECT id FROM categories WHERE code = 'U16'), 'Brescia', 'tuesday', '18:00', '19:30'),
  ((SELECT id FROM categories WHERE code = 'U16'), 'Gussago', 'thursday', '17:30', '19:00'),
  ((SELECT id FROM categories WHERE code = 'U16'), 'Ospitaletto', 'friday', '18:00', '19:30');
```

---

### STEP 2: Crea Sessioni Automatiche

#### Dalla Web App

1. Vai su **"Attività"**
2. Seleziona la categoria
3. Clicca **"Crea Sessioni Automatiche"**
4. Scegli quante sessioni vuoi:
   - 📅 **Settimanale**: 1 settimana (es. 3 sessioni per U16)
   - 📆 **2 Settimane**: 2 settimane (es. 6 sessioni)
   - 🗓️ **4 Settimane**: 1 mese (es. 12 sessioni)
5. Conferma → Le sessioni vengono create automaticamente!

#### Dalla Mobile App (Staff Dashboard)

1. Apri **Staff Dashboard**
2. Seleziona categoria
3. Clicca **"Crea Sessione Automatica"**
4. Il sistema crea la prossima sessione nel ciclo

#### Via Codice (Programmazione)

```typescript
import { 
  createAutomaticSession, 
  createMultipleAutomaticSessions,
  previewNextSession 
} from '@/lib/sessionScheduler'

// Crea singola sessione
const session = await createAutomaticSession('category-uuid')

// Crea 4 sessioni
const sessions = await createMultipleAutomaticSessions('category-uuid', 4)

// Anteprima (senza creare)
const preview = await previewNextSession('category-uuid')
console.log('Prossima sessione:', preview)
// → { session_date: '2024-10-22', location: 'Brescia', start_time: '18:00', ... }
```

---

## 🎯 ESEMPI PRATICI

### Esempio 1: Prima Creazione

**Situazione**: Categoria U16, nessuna sessione esistente, oggi è Lunedì 14 Ottobre

**Configurazione**:
- tuesday → Brescia 18:00-19:30
- thursday → Gussago 17:30-19:00
- friday → Ospitaletto 18:00-19:30

**Azione**: Crea 1 settimana

**Risultato**:
```
✅ Martedì 15 Ott  → Brescia, 18:00-19:30
✅ Giovedì 17 Ott  → Gussago, 17:30-19:00
✅ Venerdì 18 Ott  → Ospitaletto, 18:00-19:30
```

---

### Esempio 2: Continuazione Ciclo

**Situazione**: Ultima sessione U16 è Venerdì 18 Ottobre

**Azione**: Crea 1 settimana

**Risultato** (ciclo ricomincia):
```
✅ Martedì 22 Ott  → Brescia, 18:00-19:30
✅ Giovedì 24 Ott  → Gussago, 17:30-19:00
✅ Venerdì 25 Ott  → Ospitaletto, 18:00-19:30
```

---

### Esempio 3: Evita Duplicati

**Situazione**: 
- Ultima sessione: Martedì 15 Ott
- Esiste già una sessione: Giovedì 17 Ott (creata manualmente)

**Azione**: Crea prossima sessione

**Risultato**:
```
⚠️ Giovedì 17 Ott già esistente, avanzo...
✅ Venerdì 18 Ott  → Ospitaletto, 18:00-19:30
```

---

## 🛡️ REGOLE E VINCOLI

### ✅ Cosa PUOI fare

- ✅ Configurare giorni/orari/location per categoria
- ✅ Creare sessioni automatiche (web e mobile)
- ✅ Modificare configurazione (future sessioni useranno la nuova)
- ✅ Creare "Allenamenti Extra" manuali (rimangono disponibili)
- ✅ Eliminare singole sessioni se necessario

### ❌ Cosa NON puoi più fare (per sessioni automatiche)

- ❌ Scegliere manualmente data/ora/location
- ❌ Creare sessioni fuori dalla configurazione
- ❌ Bypassare l'ordine ciclico dei giorni

### ⚠️ Sessioni "Extra"

Le sessioni **"Extra"** (allenamenti straordinari) continuano a funzionare come prima:
- Si possono creare manualmente
- Si possono scegliere data/ora/location liberamente
- Non interferiscono con il ciclo automatico

---

## 🔧 TROUBLESHOOTING

### Problema: "Nessuna configurazione trovata"

**Causa**: La categoria non ha training_locations configurate

**Soluzione**: Vai su Settings → Gestisci Sedi Allenamento → Aggiungi almeno un giorno

---

### Problema: "Impossibile calcolare prossima data"

**Causa**: Tutte le date calcolate esistono già (troppi duplicati)

**Soluzione**: 
1. Verifica se ci sono sessioni duplicate
2. Elimina quelle non necessarie
3. Riprova

---

### Problema: Sessione creata nel giorno sbagliato

**Causa**: L'ordine dei giorni in `training_locations` potrebbe essere errato

**Soluzione**:
1. Controlla l'ordine in `training_locations`
2. I giorni vengono ordinati automaticamente per weekday (lun→dom)
3. Se vuoi cambiare ordine, modifica i giorni configurati

---

### Problema: Orario o location sbagliati

**Causa**: La configurazione in `training_locations` è errata

**Soluzione**:
1. Vai su Settings → Gestisci Sedi Allenamento
2. Modifica il giorno specifico
3. Le NUOVE sessioni useranno la configurazione aggiornata
4. Le sessioni già create rimangono invariate

---

## 🧪 TESTING

### Test 1: Prima Sessione

```typescript
// Setup
const categoryId = 'uuid-u16'
// Assicurati che non ci siano sessioni per questa categoria

// Esegui
const session = await createAutomaticSession(categoryId)

// Verifica
assert(session.session_date >= today)
assert(session.location === config.schedule[firstDay].location)
assert(session.start_time === config.schedule[firstDay].start_time)
```

### Test 2: Ciclo Corretto

```typescript
// Setup
const categoryId = 'uuid-u16'
// Config: [tuesday, thursday, friday]
// Ultima sessione: friday

// Esegui
const session = await createAutomaticSession(categoryId)

// Verifica
const weekday = getWeekday(session.session_date)
assert(weekday === 'tuesday')  // Deve ripartire dal primo giorno!
```

### Test 3: Evita Duplicati

```typescript
// Setup
const categoryId = 'uuid-u16'

// Esegui
const session1 = await createAutomaticSession(categoryId)
const session2 = await createAutomaticSession(categoryId)

// Verifica
assert(session1.session_date !== session2.session_date)
```

---

## 📞 SUPPORTO

### Domande Frequenti

**Q: Posso ancora creare sessioni manuali?**  
A: Sì! Le sessioni "Extra" rimangono disponibili per allenamenti straordinari.

**Q: Cosa succede se modifico la configurazione?**  
A: Le NUOVE sessioni seguiranno la nuova configurazione. Quelle già create restano invariate.

**Q: Posso usare questo sistema anche dalla mobile?**  
A: Sì! Il codice è identico su web e mobile.

**Q: Come elimino sessioni create per sbaglio?**  
A: Vai su Attività → Seleziona sessione → Elimina (come prima)

**Q: Il sistema funziona con feste/chiusure?**  
A: Attualmente no, ma può essere aggiunto in futuro un sistema di "giorni esclusi".

---

## 🔮 PROSSIMI SVILUPPI (Opzionali)

Funzionalità che potrebbero essere aggiunte in futuro:

- [ ] Giorni festivi/chiusure (skip automatico)
- [ ] Limite sessioni settimanali (validazione)
- [ ] Notifiche quando vengono create sessioni
- [ ] Bulk creation con preview prima di confermare
- [ ] Import/Export configurazioni tra categorie
- [ ] Template configurazione per categorie simili

---

## ✅ CHECKLIST MIGRAZIONE

Prima di usare il nuovo sistema in produzione:

- [ ] Ho configurato `training_locations` per tutte le categorie attive
- [ ] Ho verificato che giorni/orari/location siano corretti
- [ ] Ho testato la creazione di 1-2 sessioni per categoria
- [ ] Ho verificato che il ciclo funzioni correttamente
- [ ] Ho eliminato le sessioni di esempio (se necessario)
- [ ] Ho informato gli utenti del nuovo sistema

---

**Fine Guida** ✅

Per domande o problemi, fare riferimento a questo documento o contattare lo sviluppatore.




