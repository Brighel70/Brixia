# Deploy su Vercel - Guida Completa

## Prerequisiti

1. **Account Vercel**: Assicurati di avere un account su [vercel.com](https://vercel.com)
2. **Supabase configurato**: Il bucket Storage deve essere già configurato

## Comandi per il Deploy

### 1. Installa Vercel CLI (se non già installato)
```bash
npm install -g vercel
```

### 2. Login su Vercel
```bash
vercel login
```

### 3. Deploy del progetto
```bash
# Dalla cartella root del progetto
vercel --prod
```

## Configurazione Variabili d'Ambiente su Vercel

1. Vai sul dashboard di Vercel
2. Seleziona il tuo progetto
3. Vai su **Settings → Environment Variables**
4. Aggiungi le seguenti variabili:

```
NEXT_PUBLIC_SUPABASE_URL = your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your_supabase_anon_key
```

## Configurazione CORS su Supabase

Dopo il deploy, aggiungi il dominio Vercel nella configurazione CORS:

1. Vai su Supabase → **Storage → Settings → CORS**
2. Aggiungi una nuova configurazione:
   - **Origin**: `https://your-app-name.vercel.app`
   - **Methods**: `GET, POST, PUT, PATCH, DELETE`
   - **Headers**: `Authorization, Content-Type, Range`

## Verifica del Deployment

1. Testa l'upload di un PDF in un evento Consiglio
2. Verifica che il PDF si apra correttamente
3. Testa l'eliminazione di un evento con PDF allegati

## Risoluzione Problemi Comuni

### Errore CORS
- Verifica che il dominio Vercel sia correttamente configurato in Supabase CORS
- Assicurati che tutti i metodi HTTP necessari siano abilitati

### Errore Variabili d'Ambiente
- Controlla che le variabili siano configurate correttamente su Vercel
- Riavvia il deployment dopo aver aggiunto le variabili

### Errore Upload PDF
- Verifica che il bucket `docs` esista su Supabase
- Controlla che le policy SQL siano state eseguite correttamente

## Comandi Utili

```bash
# Deploy in modalità preview
vercel

# Deploy in produzione
vercel --prod

# Visualizza i logs
vercel logs

# Rimuovi un deployment
vercel remove
```


