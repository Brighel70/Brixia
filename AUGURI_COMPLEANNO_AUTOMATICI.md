# Auguri di compleanno automatici nell'app mobile

Gli auguri vengono inviati nell'app FlowMe a tutti coloro che compiono gli anni **oggi**, alle 10:00 del mattino.

## Metodo consigliato: tutto in Supabase (nessun servizio esterno)

**Un solo script SQL** – nessun cron esterno, nessuna Edge Function da deployare.

### 1. Esegui lo script

1. Apri **Supabase Dashboard** → **SQL Editor**
2. Copia il contenuto di `setup_auguri_compleanno_cron.sql`
3. Esegui la query

Fatto. Ogni giorno alle 10:00 (ora italiana) gli auguri vengono inviati in automatico.

### 2. Cosa fa lo script

- Crea la funzione `send_birthday_wishes_today()` che inserisce le notifiche per i compleanni di oggi
- Schedula un job con **pg_cron** che la esegue ogni giorno alle 9:00 UTC (= 10:00 Italia in inverno)
- Il webhook esistente su `notifications` invia la push sul telefono

### 3. Comandi utili

```sql
-- Verifica che il job sia attivo
SELECT * FROM cron.job WHERE jobname = 'auguri-compleanno-10am';

-- Disattiva il job
SELECT cron.unschedule('auguri-compleanno-10am');

-- Riattiva (riesegui lo script o):
SELECT cron.schedule('auguri-compleanno-10am', '0 9 * * *', 'SELECT send_birthday_wishes_today()');
```

### 4. Ora legale

- **Inverno (CET)**: 9:00 UTC = 10:00 Italia
- **Estate (CEST)**: 9:00 UTC = 11:00 Italia

Per avere 10:00 anche in estate, modifica lo schedule in `'0 8 * * *'` nello script.

---

## Metodo alternativo: Edge Function + cron esterno

Se preferisci usare la Edge Function (es. per test manuali), puoi configurarla con [cron-job.org](https://cron-job.org) o Vercel Cron. Vedi la cartella `supabase/functions/send-birthday-wishes/`.
