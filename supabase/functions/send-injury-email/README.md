# Edge Function: send-injury-email

Invia email con il corpo del template e i documenti allegati (per infortunio) tramite **Resend**.

## Configurazione

1. **Account Resend**: registrati su [resend.com](https://resend.com) e crea un API Key.
2. **Segreti Supabase** (Dashboard → Project Settings → Edge Functions → Secrets):
   - `RESEND_API_KEY`: la tua API key Resend (es. `re_xxxx`).
   - `RESEND_FROM_EMAIL` (opzionale): mittente dell’email, es. `Brixia Rugby <noreply@tudominio.com>`. Se non lo imposti viene usato `onboarding@resend.dev` (solo per test).

3. **Dominio in Resend**: per inviare da un tuo indirizzo (es. `noreply@tudominio.com`) verifica il dominio in Resend.

## Deploy

```bash
supabase functions deploy send-injury-email
```

## Utilizzo

Dopo aver creato l’evento "Apertura Sinistro" nella scheda Infortuni di un giocatore, si apre il modal per inserire l’email del destinatario e inviare. L’email conterrà il corpo del template (destinatario Assicurazione) e gli allegati selezionati nel template e presenti per quell’infortunio.
