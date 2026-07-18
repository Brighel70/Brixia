# Piano migrazione people3 → people

## Perché si migra

### Incoerenze FK e rischio dati

1. **Doppia tabella anagrafica**: `people` e `people3` coesistono con strutture simili. L'app usa `people` come anagrafica principale, ma alcune tabelle/colonne puntano ancora a `people3`.

2. **FK miste**:
   - `documents.person_id` → `people.id` ✅ (corretto)
   - `documents.created_by` → `auth.users(id)` (schema setup) oppure `people(id)` (in alcuni fix) ⚠️
   - `notes.person_id` → FK assente o puntava a `people3`; l'app usa `people.id` ⚠️
   - `notes.created_by` → `TEXT` (uuid o "Sistema"), nessuna FK
   - `player_guardian_relationships` → `people3(id)` ⚠️ (unica tabella che referenzia esplicitamente people3)

3. **Rischio**: inserimenti falliscono con errore 409 quando `person_id` (da `people`) non esiste in `people3` se una FK punta ancora a `people3`.

---

## Tabelle coinvolte

### Tabelle che referenziano **people3**

| Tabella | Colonna | Tipo | Vincolo FK |
|---------|---------|------|------------|
| player_guardian_relationships | player_person_id | UUID | REFERENCES people3(id) ON DELETE CASCADE |
| player_guardian_relationships | guardian_person_id | UUID | REFERENCES people3(id) ON DELETE CASCADE |

### Tabelle che referenziano **people**

| Tabella | Colonna | Tipo | FK presente |
|---------|---------|------|-------------|
| documents | person_id | UUID | ✅ people(id) |
| documents | created_by | UUID | auth.users(id) o people(id) a seconda dello schema |
| fee_assignments | person_id | UUID | ✅ people(id) |
| family_player_relations | family_id | UUID | ✅ people(id) |
| family_player_relations | player_id | UUID | ✅ people(id) |
| injuries | person_id | UUID | ✅ people(id) |
| match_lists | created_by | UUID | ✅ people(id) |
| notifications | person_id | UUID | ✅ people(id) |
| profiles | person_id | UUID | ✅ people(id) |
| tutor_athlete_relations | tutor_id | UUID | ✅ people(id) |
| tutor_athlete_relations | athlete_id | UUID | ✅ people(id) |

### Tabelle con FK incerte o assenti

| Tabella | Colonna | Note |
|---------|---------|------|
| notes | person_id | FK assente o rimossa; punta concettualmente a people.id |
| notes | created_by | TEXT (uuid o "Sistema"), nessuna FK |

### Tabelle potenzialmente coinvolte (da verificare in DB)

- guardians (child_person_id, guardian_person_id)
- medical_certificates (person_id)
- person_consents (person_id, signed_by_person_id)
- players (person_id)

---

## Confronto people vs people3

### Colonne comuni (da copy_people_to_people3)

- id, full_name, given_name, family_name, date_of_birth, is_minor, gender
- fiscal_code, email, phone
- address_street, address_city, address_zip, address_region, address_country
- nationality, emergency_contact_name, emergency_contact_phone, medical_notes
- membership_number, status, created_at, updated_at
- is_player, is_staff, injured, staff_roles, staff_categories
- player_categories, player_positions

### Identificatori

- **people.id**: UUID PRIMARY KEY DEFAULT gen_random_uuid()
- **people3.id**: UUID (stesso tipo)

### Colonne possibili solo in people

- legacy_people3_id (aggiunta in Prompt #5)
- next_membership_number
- disqualified, disqualification_end_date, invite_code (da verificare)

### Colonne possibili solo in people3

- next_membership_number (da verificare)

---

## Piano a step

### Prompt #5 (ponte) — **ATTUALE**

- Aggiungere `people.legacy_people3_id`
- Creare `people3_people_map` e `people_migration_audit`
- Backfill non distruttivo: match per email, nome+dob, o insert
- Nessuna modifica alle FK esistenti

### Prompt #6 (spostamento FK)

- Spostare `player_guardian_relationships` da people3 a people
- Aggiornare eventuali altre FK che puntano a people3
- Migrare dati residui (se necessario)

### Prompt #7 (pulizia finale)

- Deprecare people3
- Rimuovere riferimenti a people3 nel codice
- (Futuro) DROP people3 dopo periodo di transizione

---

## Stato finale raggiunto ✅

**Migrazione completata (Prompt #5, #6, #7).**

- Tutte le FK puntano a `people` (incluso `player_guardian_relationships`)
- `people3` non è più referenziata da nessuna tabella
- L'app usa solo `from('people')` (0 riferimenti runtime a people3)
- `people.legacy_people3_id` e `people3_people_map` consentono il mapping storico

### people3 = archivio

La tabella `people3` **esiste ancora** ma è in stato **archivio/deprecata**:
- Non usata da FK
- Non usata dall'app
- Mantenuta per backup e riferimento storico
- Valutare DROP solo dopo periodo di transizione (vedi `docs/DEPRECATED_TABLES.md`)

---

## Rischi e contromisure

| Rischio | Contromisura |
|---------|--------------|
| Duplicati in people | Match per email e nome+dob prima di insert; audit per needs_review |
| FK violate durante migrazione | Non modificare FK in Prompt #5; preparare solo i dati |
| Colonne mancanti in people | Insert con colonne base; UPDATE condizionale per colonne estese; EXCEPTION → needs_review |
| Script rieseguito più volte | Idempotenza: IF NOT EXISTS, ON CONFLICT, audit per skip |

---

## Checklist test

### Prima della migrazione

- [ ] Eseguire query inventario FK (vedi sotto)
- [ ] Verificare conteggio: `SELECT COUNT(*) FROM people3;` e `SELECT COUNT(*) FROM people;`
- [ ] Backup del database

### Dopo Prompt #5 (ponte)

- [ ] `SELECT status, count(*) FROM people_migration_audit GROUP BY status;`
- [ ] `SELECT COUNT(*) FROM people WHERE legacy_people3_id IS NOT NULL;`
- [ ] Verificare nessun needs_review inatteso
- [ ] Test app: creazione persona, documenti, note

### Query inventario FK (eseguire in Supabase SQL Editor)

```sql
-- FK che puntano a people3
SELECT conrelid::regclass AS tabella, conname AS constraint_name, confrelid::regclass AS riferisce_a
FROM pg_constraint
WHERE contype = 'f' AND confrelid = 'public.people3'::regclass;

-- FK che puntano a people
SELECT conrelid::regclass AS tabella, conname AS constraint_name, confrelid::regclass AS riferisce_a
FROM pg_constraint
WHERE contype = 'f' AND confrelid = 'public.people'::regclass;

-- Colonne person_id / created_by senza FK
SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE kcu.column_name IN ('person_id', 'created_by') AND tc.table_schema = 'public';
```

---

## File generati

- `database/migrations/001_people3_to_people_bridge.sql` — script ponte idempotente
- `docs/PEOPLE_MIGRATION_PLAN.md` — questo documento
