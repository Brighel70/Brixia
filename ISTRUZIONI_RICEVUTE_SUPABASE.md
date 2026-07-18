# Istruzioni: attivare le ricevute di pagamento (Supabase)

Seguendo questi passaggi **una sola volta** attivi il sistema delle ricevute. Non serve saper programmare.

---

## Cosa fare (in ordine)

### Passo 1 – Apri Supabase

1. Vai su [https://supabase.com](https://supabase.com) e fai **Login**.
2. Apri il **tuo progetto** (quello usato da TeamFlow).

---

### Passo 2 – Crea la tabella e gli indici

1. Nel menu a sinistra clicca su **“SQL Editor”**.
2. Clicca **“New query”** (nuova query).
3. Apri il file **`create_payment_receipts.sql`** (nella cartella del progetto TeamFlow), **copia tutto** il suo contenuto e **incollalo** nella finestra del SQL Editor.
4. Clicca **“Run”** (Esegui) in basso a destra.
5. Controlla che in basso compaia un messaggio tipo **“Success”** (nessun errore). Se vedi errori, scrivili e chiedi aiuto.

---

### Passo 3 – Crea il bucket “ricevute” e i permessi

1. Sempre nel **SQL Editor**, clicca di nuovo **“New query”**.
2. Apri il file **`setup_storage_ricevute.sql`**, **copia tutto** e **incollalo** nella nuova query.
3. Clicca **“Run”**.
4. Controlla che compaia **“Success”**.

Se qui compare un errore tipo **“relation storage.buckets does not exist”** o simile, vai al **Passo 3 alternativo** sotto.

---

### Passo 3 alternativo (solo se lo script SQL dà errore)

Se lo script del Passo 3 non funziona, crea il bucket dalla Dashboard:

1. Nel menu a sinistra clicca su **“Storage”**.
2. Clicca **“New bucket”**.
3. **Name:** scrivi esattamente: `ricevute`
4. Attiva **“Public bucket”** (così il link al PDF si apre anche da telefono senza login).
5. Clicca **“Create bucket”**.
6. Poi torna al **SQL Editor**, apri una **nuova query** e incolla **solo** queste righe (sostituisci tutto il contenuto di `setup_storage_ricevute.sql` con questo, oppure esegui solo questo):

```sql
-- Permesso: chiunque può leggere i PDF delle ricevute
DROP POLICY IF EXISTS "Lettura pubblica ricevute" ON storage.objects;
CREATE POLICY "Lettura pubblica ricevute"
ON storage.objects FOR SELECT
USING (bucket_id = 'ricevute');

DROP POLICY IF EXISTS "Solo autenticati possono caricare ricevute" ON storage.objects;
CREATE POLICY "Solo autenticati possono caricare ricevute"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ricevute');

DROP POLICY IF EXISTS "Solo autenticati possono aggiornare ricevute" ON storage.objects;
CREATE POLICY "Solo autenticati possono aggiornare ricevute"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'ricevute');
```

7. Clicca **“Run”**.

---

## Verifica

- Dopo Passo 2 e Passo 3 (o 3 alternativo) non serve fare altro.
- Quando in **TeamFlow** generi una ricevuta da una quota pagata (icona aereoplano → “Genera ricevuta”), il PDF viene salvato e il genitore/tutor lo vedrà in **FlowMe** nella sezione **Pagamenti** (link “Ricevuta”).

Se qualcosa non va, copia il messaggio di errore che vedi in Supabase e chiedi supporto indicando anche quale passo stavi facendo.
