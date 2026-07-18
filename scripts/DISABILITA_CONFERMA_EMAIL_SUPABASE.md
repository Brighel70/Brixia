# Accesso diretto con email + codice TeamFlow (senza conferma email)

Per avere **solo** il controllo “questa email ha questo codice” e far entrare subito l’utente, **devi disattivare la conferma email** in Supabase. È l’unica impostazione necessaria; non si può fare solo da codice o da SQL.

---

## Opzione 1 – Dashboard (più semplice)

1. Vai su **Supabase** → il tuo progetto.
2. Menu sinistra: **Authentication** → **Providers**.
3. Clicca su **Email**.
4. Disattiva l’opzione **"Confirm email"** (toggle OFF).
5. Salva.

Così i nuovi utenti entrano subito senza dover cliccare il link nella email.

---

## Opzione 2 – Script PowerShell (Management API)

Serve per automatizzare o se preferisci non usare la dashboard.

### Cosa ti serve

1. **Project REF**  
   Dall’URL del progetto, es.  
   `https://app.supabase.com/project/lsuqdeizqapsexeekrua`  
   il REF è: **lsuqdeizqapsexeekrua**.

2. **Personal Access Token (PAT)**  
   - Supabase Dashboard → icona **Account** (in basso a sinistra) → **Access Tokens**.  
   - **Generate new token**, nome a piacere.  
   - Al token assegna il permesso che riguarda la configurazione (es. scope che include **Auth** / gestione progetto).  
   - Copia il token e conservalo: non si può rivedere dopo.

### Esecuzione

Da PowerShell, dalla cartella del progetto (o indicando il path dello script):

```powershell
.\scripts\supabase-disable-email-confirmation.ps1 -ProjectRef "IL_TUO_PROJECT_REF" -AccessToken "IL_TUO_TOKEN"
```

Esempio (sostituisci con i tuoi valori):

```powershell
.\scripts\supabase-disable-email-confirmation.ps1 -ProjectRef "lsuqdeizqapsexeekrua" -AccessToken "sbp_xxxxxxxx..."
```

Se la chiamata va a buon fine, la configurazione Auth viene aggiornata e la **conferma email risulta disattivata** (equivalente a “Confirm email” OFF nella dashboard).

---

## Verifica

Dopo aver usato la dashboard o lo script:

- Crea un utente (o fai il primo accesso con email + codice TeamFlow).
- L’utente dovrebbe poter entrare subito, senza dover confermare l’email.

Se qualcosa non funziona, controlla che il PAT abbia i permessi corretti (gestione progetto / Auth) e che il **Project REF** sia quello del progetto giusto.
