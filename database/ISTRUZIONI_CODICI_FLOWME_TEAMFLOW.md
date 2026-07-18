# Due codici separati: Flowme e TeamFlow

Ogni persona può avere **due codici invito distinti**:
- **Codice Flowme** (`invite_code`) – per registrarsi nell’app Flowme
- **Codice TeamFlow** (`invite_code_teamflow`) – per registrarsi nella webapp TeamFlow

## Cosa fare in Supabase

1. Apri **Supabase** → **SQL Editor**.
2. Esegui lo script **`database/add_invite_code_teamflow.sql`** (aggiunge la colonna `invite_code_teamflow` e l’indice univoco).

## Dove si gestiscono i codici nell’app

- Tab **TeamFlow / Flowme** → scheda **Flowme**: blocco **“Codice accesso Flowme”** (genera, copia, rigenera).
- Stesso tab → scheda **TeamFlow**: blocco **“Codice accesso TeamFlow”** (genera, copia, rigenera).

Le due app (Flowme e TeamFlow) dovranno usare in login/registrazione:
- Flowme: validare solo `invite_code`
- TeamFlow: validare solo `invite_code_teamflow`
