# Codice da incollare nell’editor Supabase per la funzione send-fcm-push

## Passi nell’editor Supabase (Via Editor)

1. **Nome funzione:** nel campo **"Function name"** in basso cancella "dynamic-worker" e scrivi: **`send-fcm-push`**
2. **Codice:** nell’editor, **seleziona tutto** il codice (Ctrl+A) e **cancella**.
3. **Incolla:** apri nel tuo progetto il file **`index.ts`** che si trova nella stessa cartella di questo file (`supabase/functions/send-fcm-push/index.ts`), **seleziona tutto** (Ctrl+A), **copia** (Ctrl+C), poi torna nell’editor Supabase e **incolla** (Ctrl+V).
4. Clicca il pulsante verde **"Deploy function"**.

Dopo il deploy, aggiungi il segreto **FCM_SERVICE_ACCOUNT_JSON** in Edge Functions → Secrets (il JSON dell’account di servizio Firebase). Poi crea il webhook su Database → Webhooks (INSERT su `notifications` → chiama `send-fcm-push`).
