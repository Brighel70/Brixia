# Setup Supabase Storage per PDF Upload

## 1. Configurazione Bucket Storage

1. Vai nel pannello di Supabase → **Storage**
2. Clicca su **"New bucket"**
3. Crea un bucket chiamato **`docs`**
4. Imposta il bucket come **privato** (non pubblico)

## 2. Configurazione SQL

Esegui lo script `setup_supabase_storage.sql` nel SQL Editor di Supabase per configurare le policy di sicurezza.

## 3. Configurazione CORS

1. Vai su **Storage → Settings → CORS Configuration**
2. Aggiungi le seguenti configurazioni:

### Per sviluppo locale:
- **Origin**: `http://localhost:3000`
- **Methods**: `GET, POST, PUT, PATCH, DELETE`
- **Headers**: `Authorization, Content-Type, Range`

### Per produzione Vercel:
- **Origin**: `https://your-app-name.vercel.app`
- **Methods**: `GET, POST, PUT, PATCH, DELETE`
- **Headers**: `Authorization, Content-Type, Range`

## 4. Variabili d'ambiente

Crea un file `.env.local` nella root del progetto:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 5. Deploy su Vercel

1. Assicurati che le variabili d'ambiente siano configurate in Vercel
2. Aggiungi il dominio Vercel nella configurazione CORS di Supabase
3. Fai il deploy

## Come funziona

- I PDF vengono caricati nella cartella `events/` del bucket `docs`
- Ogni file ha un nome unico generato automaticamente
- Solo gli utenti autenticati possono caricare/visualizzare i propri file
- Gli admin possono accedere a tutti i file
- I file vengono automaticamente eliminati quando si elimina un evento

## Struttura dei file

```
docs/
└── events/
    ├── verbale_2024-01-15T10-30-00-000Z_abc123def.pdf
    ├── verbale_2024-01-15T14-15-30-000Z_xyz789ghi.pdf
    └── ...
```









