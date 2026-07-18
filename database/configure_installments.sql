-- Script per verificare e configurare le rate per la "Quota di Iscrizione annuale"

-- Prima verifichiamo lo stato attuale
SELECT 
  id, 
  name, 
  category, 
  amount, 
  payment_mode, 
  installments,
  installment_count
FROM fees 
WHERE name LIKE '%Iscrizione%' OR name LIKE '%annuale%';

-- Aggiorniamo la quota "Quota di Iscrizione annuale" per U18 con le 3 rate
UPDATE fees 
SET 
  payment_mode = 'installments',
  installment_count = 3,
  installments = '[
    {
      "amount": 50,
      "due_date": "2025-07-07", 
      "notes": "Acconto",
      "installment_number": 1,
      "installment_type": "acconto"
    },
    {
      "amount": 100,
      "due_date": "2025-09-30",
      "notes": "Acconto", 
      "installment_number": 2,
      "installment_type": "acconto"
    },
    {
      "amount": 150,
      "due_date": "2025-12-15",
      "notes": "Saldo",
      "installment_number": 3, 
      "installment_type": "saldo"
    }
  ]'::jsonb
WHERE name = 'Quota di Iscrizione annuale' AND category = 'U18';

-- Verifichiamo che l'aggiornamento sia andato a buon fine
SELECT 
  id, 
  name, 
  category, 
  amount, 
  payment_mode, 
  installment_count,
  installments
FROM fees 
WHERE name = 'Quota di Iscrizione annuale' AND category = 'U18';

-- Controlliamo anche le assegnazioni esistenti per questa quota
SELECT 
  fa.id,
  fa.fee_id,
  fa.person_id,
  fa.amount,
  fa.status,
  fa.due_date,
  fa.paid_at,
  fa.installment_number,
  fa.installment_type,
  f.name as fee_name
FROM fee_assignments fa
JOIN fees f ON fa.fee_id = f.id
WHERE f.name = 'Quota di Iscrizione annuale' AND f.category = 'U18'
ORDER BY fa.installment_number;










