-- Inserisce le 8 voci predefinite per "Tipo di Attività" (modal Aggiungi Attività).
-- Esegui dopo create_injury_activity_types_table.sql oppure se la tabella esiste già e vuoi solo popolarla.
-- Idempotente: non crea duplicati (ON CONFLICT su code).

INSERT INTO injury_activity_types (name, code, sort_order, active) VALUES
  ('Visita Medica', 'medical_visit', 1, true),
  ('Fisioterapia', 'physiotherapy', 2, true),
  ('Test/Esame', 'test', 3, true),
  ('Annotazione', 'note', 4, true),
  ('Rimborso Assicurativo', 'insurance_refund', 5, true),
  ('Acquisto Attrezzatura', 'equipment_purchase', 6, true),
  ('Spese Sostenute', 'expenses', 7, true),
  ('Altro', 'other', 8, true)
ON CONFLICT (code) DO NOTHING;
