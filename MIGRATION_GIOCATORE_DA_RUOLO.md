# Migrazione: giocatore solo da ruolo Flowme/TeamFlow

## Cosa è cambiato

- **Prima:** una persona era considerata "giocatore" se il checkbox "È un giocatore" era attivo nel tab Informazioni Personali.
- **Ora:** una persona è considerata **giocatore solo se** nel tab **TeamFlow / Flowme** ha il ruolo **Giocatore** (e la sezione Player è attiva). Il checkbox è stato rimosso.

## Migrazione dati (una tantum)

Per tutte le persone che oggi sono giocatori perché avevano il checkbox attivo (o `is_player = true` nel DB), bisogna impostare:

- **Ruolo Flowme:** Giocatore (come ruolo principale se non hanno altro ruolo, altrimenti in "Ruoli aggiuntivi")
- **Sezione Flowme:** checkbox "Player" attivo
- **Ruolo TeamFlow:** stessa logica
- **Categorie:** restano quelle già assegnate (`player_categories` non viene modificato)

### Script da eseguire

Esegui in **Supabase → SQL Editor** lo script:

```
database/set_giocatore_role_flowme_teamflow.sql
```

Lo script:

1. Trova tutti i record in `people` con `is_player = true`
2. Imposta il ruolo **Giocatore** in Flowme (e se serve in TeamFlow)
3. Aggiunge la sezione **player** a `flowme_sections` (e `teamflow_sections` se usato)
4. Non modifica `player_categories` (le categorie già assegnate restano)

Dopo aver eseguito lo script, in app ogni persona sarà considerata giocatore solo se ha il ruolo Giocatore nel tab Flowme/TeamFlow.
