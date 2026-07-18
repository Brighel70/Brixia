# Archivio SQL storico

Questa cartella raccoglie gli script SQL creati prima dell'adozione delle
migrazioni numerate in `database/migrations/`.

Non eseguire questi file come sequenza di installazione: molti sono controlli,
prove, correzioni puntuali o versioni alternative dello stesso intervento.
Le nuove modifiche al database devono essere create esclusivamente in
`database/migrations/` con il formato `NNN_descrizione.sql`.
