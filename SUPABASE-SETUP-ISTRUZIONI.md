# Setup Supabase (TeamFlow)

Il database di produzione è già configurato. Per nuovi progetti o modifiche schema usare solo:

- **`database/migrations/`** — script numerati (`001_…`, `002_…`, …) da eseguire in ordine
- **`database/ensure_support_admin.sql`** — admin di assistenza (`andreabulgari@me.com`)
- **`supabase-setup.js`** — genera stringhe SQL legacy di bootstrap (solo se serve un DB da zero; preferire le migration)

## Admin di assistenza

Su ogni nuovo progetto Supabase cliente:

1. SQL Editor → incolla `database/ensure_support_admin.sql` → Run
2. Login TeamFlow / FlowMe con email e password indicate nello script

## Push

- Web Push (FlowMe): script in repo FlowMe `create_push_subscriptions.sql`
- FCM `push_tokens`: tabella già presente in Supabase; lo script storico non è più nel repo
