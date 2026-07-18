# Inventario riferimenti people3

## 1) Sintesi

| Categoria | Conteggio |
|-----------|-----------|
| **Totale occorrenze "people3"** | ~120+ (in ~35 file) |
| **Runtime (app TS/TSX)** | **0** |
| **SQL migration/fix (database)** | ~80 |
| **Documentazione** | ~25 |

**Risultato principale:** L'app TeamFlow **non usa people3** in nessun punto. Tutte le query Supabase usano `from('people')`. La migrazione DB (001, 002) è già completata.

---

## 2) Runtime (DA PULIRE)

### Nessun riferimento runtime in src/

**Verifica:** Grep su `src/` per `people3`, `from('people3')` → **0 risultati**.

Tutte le query Supabase nell'app usano `from('people')`:
- CreatePersonView, PeopleView, GuardiansTab, TutorTab, FeesTab, ecc.
- `player_guardian_relationships` è usato con join su `people` (es. `player:people!player_person_id`)

**Conclusione:** Nessuna modifica necessaria nel codice app per people3.

---

### SQL con people3 (script one-off / migration)

| File | Riga/Blocco | Tipo | Cosa fa | Sostituzione |
|------|-------------|------|---------|--------------|
| `database/fix_needs_review_people3.sql` | 21 | SELECT | `SELECT * FROM people3 WHERE id = v_p3_id` | Script one-off già eseguito. Può restare per riferimento. |
| `create_player_guardian_relationships.sql` | 4-5 | DDL | `REFERENCES people3(id)` nella definizione tabella | **Obsoleto**: 002 ha già spostato FK su people. Se si ricrea la tabella, usare `REFERENCES people(id)`. |
| `fix_notes_person_id_revert_to_people3.sql` | 9 | DDL | Ripristina FK notes su people3 | **Pericoloso**: non eseguire. Mantenere FK su people. |

---

## 3) Documentazione (FACOLTATIVO)

| File | Contesto |
|------|----------|
| `docs/PEOPLE_MIGRATION_PLAN.md` | Piano migrazione, riferimenti storici a people3 |
| `docs/ANALISI_CRITICA_TEAMFLOW_FLOWME.md` | Analisi people vs people3, raccomandazioni |
| `docs/RESOCONTO_PROMPT4_PAYMENTS_CORE.md` | Menzione Prompt #5 (migrazione people3) |
| `INTEGRAZIONE_FAMILIARI.md` | "player_guardian_relationships usa people3" (ora obsoleto) |
| `ESEGUI_SCRIPT_IN_QUESTO_ORDINE.md` | Errori "Key not present in people3" |
| `fix_notes_person_id_fk.sql` | Commento "people3 è legacy" |
| `fix_notes_person_id_drop_fk.sql` | Commento "person_id esiste in people3" |
| `check_database_schema.sql` | Note su person_id/people3 |
| `FIX_DOCUMENTS_FOREIGN_KEY.sql` | Fix FK documents da people3 a people |

---

## 4) Rischi

### Pericolosi (non eseguire)

| File | Rischio |
|------|---------|
| `fix_notes_person_id_revert_to_people3.sql` | Ripristina FK notes su people3 → rompe l'app |
| `copy_people_to_people3.sql` | TRUNCATE people3, copia da people → perdita dati se people3 ha dati unici |
| `migrate_people_table.sql` | `ALTER TABLE people3 RENAME TO people` → distruttivo |

### Innocui

| Tipo | Note |
|------|------|
| Commenti in SQL | Solo documentazione |
| Script migration 001, 002 | Già eseguiti, idempotenti |
| `fix_needs_review_people3.sql` | One-off, già eseguito |
| `inventory_fk_people_people3.sql` | Solo diagnostica |

### Da aggiornare (priorità bassa)

| File | Azione |
|------|--------|
| `create_player_guardian_relationships.sql` | Cambiare `REFERENCES people3(id)` → `REFERENCES people(id)` per coerenza schema |
| `INTEGRAZIONE_FAMILIARI.md` | Aggiornare "usa people3" → "usa people" |
| `docs/PEOPLE_MIGRATION_PLAN.md` | Segnare Prompt #6 completato, FK già su people |

---

## 5) Checklist pulizia (per Prompt #7)

1. **[Priorità alta]** Aggiornare `create_player_guardian_relationships.sql`: `REFERENCES people3(id)` → `REFERENCES people(id)` (per nuovi deploy)
2. **[Priorità media]** Aggiornare `INTEGRAZIONE_FAMILIARI.md`: sostituire "people3" con "people"
3. **[Priorità media]** Aggiornare `docs/PEOPLE_MIGRATION_PLAN.md`: segnare migrazione completata
4. **[Priorità bassa]** Aggiungere commento `DEPRECATED` su `fix_notes_person_id_revert_to_people3.sql`
5. **[Priorità bassa]** Archiviare o rimuovere script migration obsoleti (`copy_people_to_people3`, `migrate_people_table`, ecc.) in cartella `database/archive/` se si vuole tenere traccia
6. **[Opzionale]** Aggiornare `docs/ANALISI_CRITICA_TEAMFLOW_FLOWME.md`: segnare "people3 deprecata, migrazione completata"

---

## Riepilogo player_guardian_relationships

| File | Uso |
|------|-----|
| `src/pages/CreatePersonView.tsx` | 1054, 1122 | Query `.from('player_guardian_relationships')` con join `player:people!player_person_id` |
| `src/pages/PeopleView.tsx` | 694 | Query `.from('player_guardian_relationships')` |
| `src/components/GuardiansTab.tsx` | 93, 167, 192 | Query `.from('player_guardian_relationships')` |

**Nota:** Le query usano già `people` nel join. La tabella `player_guardian_relationships` ha FK su `people` (dopo 002). Nessuna modifica necessaria.
