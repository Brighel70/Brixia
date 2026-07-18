-- Rimuove il constraint UNIQUE per permettere multiple assegnazioni per rate

-- Rimuovi il constraint UNIQUE esistente
ALTER TABLE fee_assignments DROP CONSTRAINT IF EXISTS fee_assignments_fee_id_person_id_key;

-- Aggiungi un indice per migliorare le performance invece del constraint
CREATE INDEX IF NOT EXISTS idx_assignments_fee_person ON fee_assignments(fee_id, person_id);









