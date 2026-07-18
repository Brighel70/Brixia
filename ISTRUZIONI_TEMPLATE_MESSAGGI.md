# Template Messaggi - Setup

## Creazione tabella

Per usare l'area **Template Messaggi** in Impostazioni, esegui lo script SQL in Supabase:

1. Apri Supabase → SQL Editor
2. Esegui il contenuto di `create_message_templates_table.sql`

## Utilizzo

- Vai in **Impostazioni** → tab **Template**
- Clicca **Nuovo template**
- Scegli il tipo: **WhatsApp**, **Email** o **Altro**
- Inserisci nome e contenuto
- Per le email, puoi aggiungere anche l'oggetto

## Variabili

Puoi usare variabili nel testo che verranno sostituite al momento dell'invio, ad esempio:
- `{nome}` - nome della persona
- `{cognome}` - cognome
- `{data}` - data dell'evento
- (altre variabili dipendono dall'integrazione)
