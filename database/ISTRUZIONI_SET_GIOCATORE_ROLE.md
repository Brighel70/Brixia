# Impostare ruolo Giocatore in Flowme/TeamFlow per tutti i giocatori

## Cosa fa lo script

Lo script `set_giocatore_role_flowme_teamflow.sql` aggiorna **solo** i ruoli nella sezione TeamFlow/Flowme per tutte le persone con `is_player = true`:

1. **Flowme (app_role)**  
   - Se il primo ruolo è vuoto → imposta "Giocatore"  
   - Se c’è già un altro ruolo → aggiunge "Giocatore" nei ruoli aggiuntivi  

2. **TeamFlow (teamflow_app_role)**  
   - Stessa logica di Flowme  

3. **Sezioni visibili**  
   - Aggiunge `"player"` a `flowme_sections` e `teamflow_sections` se manca  

## Cosa non modifica

- `player_categories` (categorie del giocatore)  
- `staff_categories`  
- Tutti gli altri campi della persona  

## Come eseguire

1. Apri Supabase → SQL Editor  
2. Incolla il contenuto di `set_giocatore_role_flowme_teamflow.sql`  
3. Esegui lo script  

## Verifica preliminare (opzionale)

Per vedere quali giocatori verrebbero aggiornati, puoi eseguire prima:

```sql
SELECT 
  given_name || ' ' || COALESCE(family_name, '') as nome,
  app_role,
  teamflow_app_role,
  flowme_sections,
  teamflow_sections,
  player_categories
FROM public.people
WHERE is_player = true
ORDER BY nome;
```

## Dopo l’esecuzione

La query finale nello script mostra un campione di giocatori con i ruoli Flowme e TeamFlow aggiornati.
