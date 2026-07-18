# Deploy funzione “Invia email infortuni” (send-injury-email)

## Metodo 1 – Script automatico (consigliato)

1. Apri **PowerShell** nella cartella del progetto (dove si trova `deploy-injury-email.ps1`).
2. Esegui:
   ```powershell
   .\deploy-injury-email.ps1
   ```
3. Se si apre il browser: fai **login** con il tuo account Supabase.
4. La **prima volta** lo script può chiederti il **Reference ID** del progetto:
   - Vai su [supabase.com](https://supabase.com) → il tuo progetto.
   - **Project Settings** (icona ingranaggio) → **General**.
   - Copia il **Reference ID** e incollalo quando lo script te lo chiede.
5. Alla fine lo script fa da solo: collegamento al progetto e deploy della funzione.

Dopo il deploy, imposta i **segreti** (una sola volta):

- Dashboard Supabase → **Project Settings** → **Edge Functions** → **Secrets**.
- Aggiungi:
  - `RESEND_API_KEY` = la tua API key di [Resend](https://resend.com).
  - `RESEND_FROM_EMAIL` = es. `Brixia Rugby <tua-email@dominio.com>`.

---

## Metodo 2 – Senza CLI (solo dalla Dashboard)

Se non vuoi usare PowerShell o la CLI:

1. Vai su **Supabase** → il tuo progetto → **Edge Functions**.
2. **Create a new function** → nome: `send-injury-email`.
3. Sostituisci tutto il codice della funzione con il contenuto del file:
   `supabase/functions/send-injury-email/index.ts`
4. Clicca **Deploy**.
5. In **Project Settings** → **Edge Functions** → **Secrets** aggiungi:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`

(Il risultato è lo stesso del Metodo 1.)
