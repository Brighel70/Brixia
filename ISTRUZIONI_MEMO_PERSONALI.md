# Memo Personali – Setup

La pagina Memo permette a ogni utente di creare note, promemoria, appuntamenti e cose da fare **privati e visibili solo a sé stessi**.

## 1. Esegui la migrazione SQL

Apri Supabase → SQL Editor ed esegui il contenuto del file `create_user_memos.sql`:

- Crea la tabella `user_memos`
- Imposta le policy RLS così che ogni utente veda solo i propri memo
- Gli altri utenti non possono accedere ai dati degli altri

## 2. Funzionalità

- **Nota**: note libere senza data
- **Promemoria**: note con data di scadenza
- **Appuntamento**: data e ora
- **Da fare**: checkbox per segnare come completato

## 3. Privacy

Tutti i dati sono filtrati per `user_id = auth.uid()`. Le policy RLS garantiscono che nessun utente possa leggere o modificare i memo di altri.
