# Fix errore "Could not find the 'teamflow_access_blocked' column of 'people'"

L'errore compare quando salvi una persona (es. un tutor) perché l'app invia i campi della webapp **TeamFlow** alla tabella `people`, ma le relative colonne non sono ancora state create nel database.

## Cosa fare

1. Vai su **Supabase** → il tuo progetto → **SQL Editor**.
2. Apri il file `database/add_teamflow_columns_people.sql` e **copia tutto** il suo contenuto.
3. Incolla lo script nell’editor SQL di Supabase e clicca **Run**.
4. Controlla che non ci siano errori (dovrebbe comparire “Success”).
5. Riprova a salvare il tutor dall’app.

Lo script aggiunge in sicurezza le colonne (con `IF NOT EXISTS`):

- `teamflow_app_role`
- `teamflow_additional_roles`
- `teamflow_sections`
- `teamflow_access_blocked`
- `teamflow_staff_categories`

Dopo averle create, il salvataggio andrà a buon fine.
