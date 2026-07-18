-- Create the payment ledger if this legacy database was created before the
-- payments table was introduced.
ALTER TABLE public.fee_assignments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS paid_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.fee_assignments(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_assignment ON public.payments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);

-- Bring historical assignments marked as paid into the same payment ledger
-- used by the application today. The statement is idempotent: it only adds
-- the missing portion of an already-paid assignment.

INSERT INTO public.payments (
  assignment_id,
  amount,
  payment_method,
  payment_date,
  notes
)
SELECT
  assignment.id,
  assignment.amount - COALESCE(SUM(payment.amount), 0) AS amount,
  COALESCE(assignment.payment_method, 'legacy_adjustment') AS payment_method,
  COALESCE(assignment.paid_date, assignment.paid_at::date, CURRENT_DATE) AS payment_date,
  'Riconciliazione storica quota gia segnata come pagata' AS notes
FROM public.fee_assignments AS assignment
LEFT JOIN public.payments AS payment ON payment.assignment_id = assignment.id
WHERE assignment.status = 'paid'
GROUP BY (
  assignment.id,
  assignment.amount,
  assignment.payment_method,
  assignment.paid_date,
  assignment.paid_at
)
HAVING assignment.amount > COALESCE(SUM(payment.amount), 0);
