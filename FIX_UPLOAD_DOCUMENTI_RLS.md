# Fix: Errore upload documenti "new row violates row-level security policy"

## Problema
Quando carichi un documento nella scheda di un giocatore, compare l'errore:
```
StorageApiError: new row violates row-level security policy
```

## Causa
Le policy RLS (Row Level Security) del bucket Storage `docs` richiedevano che il path iniziasse con l'ID utente (`auth.uid()`), mentre l'app usa il path `people/{person_id}/{filename}`.

## Soluzione

### 1. Esegui lo script SQL su Supabase

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri il file `fix_storage_docs_policies.sql` (nella root del progetto)
3. Copia tutto il contenuto e incollalo nel SQL Editor
4. Clicca **Run** (Esegui)

Lo script:
- Rimuove le policy vecchie e conflittuali
- Crea nuove policy che permettono agli utenti autenticati di caricare, leggere, aggiornare ed eliminare file nel bucket `docs`

### 2. Verifica bucket docs

Se il bucket non esiste ancora:
1. Vai su **Supabase** → **Storage**
2. Clicca **New bucket**
3. Nome: `docs`
4. Pubblico: **No** (privato)
5. Clicca **Create**

Poi riesegui lo script `fix_storage_docs_policies.sql`.

### 3. Riprova l'upload

Dopo aver eseguito lo script, torna alla scheda del giocatore e prova di nuovo a caricare un documento.

---

## Fix aggiuntivo (warning React)

È stato corretto anche il warning "uncontrolled input to be controlled" nei campi del form Documenti, assicurando che tutti i value degli input siano sempre stringhe (mai `undefined`).
