# Tabelle deprecate

## people3

### Perché esiste ancora

`people3` era la tabella anagrafica legacy. La migrazione a `people` è completata (2025), ma la tabella non è stata eliminata per:
- Backup e riferimento storico
- Possibilità di rollback in caso di problemi
- Periodo di transizione prima del DROP definitivo

### Non usarla

- **Nessuna FK** punta a `people3` (tutte sono state migrate su `people`)
- **L'app** usa solo `people` (`from('people')`)
- **Nuove query** devono usare `people`
- **Script SQL** che creano tabelle devono usare `REFERENCES people(id)`, non `people3`

### Eliminare people3 (dopo migrazione completata)

Se la migrazione su `people` è completa e **nessuna FK** punta più a `people3`:

1. (Consigliato) Esegui `database/inventory_people3_dependencies.sql` e verifica 0 dipendenze.
2. Esegui `database/drop_people3_safe.sql` nel SQL Editor di Supabase: lo script verifica automaticamente che non ci siano FK verso `people3` e poi elimina la tabella. In caso di FK residue lo script fallisce con messaggio esplicito.

Alternativa manuale: `database/drop_people3__MANUAL_ONLY.sql` (decommentare la riga `DROP TABLE` dopo aver verificato a mano).

Le tabelle `people3_people_map` e `people_migration_audit` (se presenti) restano: contengono solo UUID di people3 per storico e non hanno FK verso `people3`.

Vedi `docs/PEOPLE_MIGRATION_PLAN.md` e `docs/PEOPLE3_DROP_CHECKLIST.md` per la checklist completa.
