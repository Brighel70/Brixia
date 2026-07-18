# Logo app mobile (FlowMe) – Setup

Dalla webapp puoi caricare il logo che viene mostrato al centro dell’header nell’app mobile FlowMe.

## 1. Esegui le migrazioni su Supabase

Nel **SQL Editor** del progetto Supabase (lo stesso usato da webapp e app FlowMe) esegui **in questo ordine**:

1. **`create_brand_settings_table.sql`**  
   Crea la tabella `brand_settings` e le policy RLS (lettura per tutti, scrittura solo autenticati).

2. **`storage_brand_public_read.sql`**  
   Consente la lettura pubblica dei file `brand/mobile-app-logo.png` e `brand/mobile-app-logo.svg` nel bucket `docs`, così l’app mobile può caricare l’immagine senza login.

## 2. Stesso progetto Supabase

Webapp e app FlowMe devono usare **lo stesso progetto Supabase** (stessi `VITE_SUPABASE_URL` e stesso database). Controlla i file `.env` in entrambi i progetti.

## 3. Utilizzo

1. **Webapp**: Impostazioni (o menu) → **Personalizzazione Brand** → sezione **Logo e Immagini** → **Logo app mobile (FlowMe)**. Carica l’immagine e clicca **Salva**.
2. **App FlowMe**: All’avvio l’header legge l’URL da `brand_settings` e mostra il logo al centro; se non c’è nessun logo salvato, viene usato il default `/FlowMe.png`.

## Riepilogo modifiche

- **Webapp (AppBrixia)**  
  - `src/config/brand.ts`: aggiunto `assets.mobileAppLogo`.  
  - `src/pages/BrandCustomization.tsx`: nuova sezione upload “Logo app mobile (FlowMe)”; al salvataggio upload su Storage e scrittura in `brand_settings`.

- **Database**  
  - Tabella `brand_settings` (key, value, updated_at) con RLS.

- **App FlowMe**  
  - `src/components/FlowMeAppHeader.tsx`: legge `mobile_app_logo_url` da `brand_settings` e usa quell’URL per il logo al centro.  
  - `src/types/database.ts`: tipo per `brand_settings`.

---

## Il logo nell’app mobile non cambia – cosa controllare

1. **Tabella `brand_settings`**  
   In Supabase → Table Editor verifica che esista la tabella `brand_settings` e che, dopo aver salvato dalla webapp (Personalizzazione Brand → Salva), ci sia una riga con `key = mobile_app_logo_url` e `value` = un URL che inizia con `https://...supabase.co/storage/...`.  
   Se la tabella non c’è: esegui `create_brand_settings_table.sql`.

2. **Salvataggio dalla webapp**  
   Dopo aver caricato il logo, clicca **Salva**. Se compare un messaggio di errore sulla “sincronizzazione logo app mobile”, esegui gli script SQL indicati sopra.

3. **Storage pubblico**  
   Se in `brand_settings` l’URL c’è ma nell’app il logo non si vede (icona rotta o niente), di solito il bucket non è leggibile in pubblico. Esegui `storage_brand_public_read.sql` e ricarica l’app.

4. **Stesso Supabase**  
   Webapp e FlowMe devono puntare allo stesso progetto Supabase (stesso URL in `.env`). Se usano due progetti diversi, la webapp scrive in un DB e FlowMe legge dall’altro.

5. **Riavvio / ricarica FlowMe**  
   Dopo aver sistemato DB e Storage, chiudi e riapri l’app mobile (o fai un refresh completo) per ricaricare il logo.
