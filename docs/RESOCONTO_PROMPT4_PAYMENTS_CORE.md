# Resoconto Prompt #4 — Dedup pagamenti (FeesTab + FeesManagement)

## Nuovo file creato

**Path:** `src/lib/fees/paymentsCore.ts`

**Contenuto (lista funzioni):**

### Pure functions
- `getInstallmentStatus(dueDate)` → `'overdue' | 'regular'`
- `calculateDaysLate(dueDate, paidDate)` → numero giorni (positivo = ritardo)
- `hasChanges(selectedInstallments, initialPaymentStatus)` → boolean
- `canEditInstallment(index, paymentInstallments, selectedInstallments, options)` → boolean  
  - `options.considerPaidAsEditable`: FeesTab=true, FeesManagement=false
- `calculateFeeTotals(feeId, assignments)` → `{ total, paid, pending, installments }`
- `buildInstallmentUpdatePayload(isSelected, paymentMethod, paymentDate)` → payload per update

### Supabase wrappers
- `markInstallmentsPaid(updates[])` → aggiorna fee_assignments (status, paid_at, payment_method)
- `updateInstallment(assignmentId, data)` → update singola assegnazione

---

## Dove è stata sostituita la logica

### FeesTab (`src/components/CreatePerson/FeesTab.tsx`)

**Import:**
```ts
import {
  getInstallmentStatus,
  calculateDaysLate,
  hasChanges,
  canEditInstallment as canEditInstallmentCore,
  calculateFeeTotals as calculateFeeTotalsCore,
  markInstallmentsPaid
} from '@/lib/fees/paymentsCore'
```

**Sostituzioni:**
- `getInstallmentStatus` → import dal core
- `calculateDaysLate` → import dal core
- `calculateFeeTotals` → wrapper che chiama `calculateFeeTotalsCore(feeId, assignments)`
- `canEditInstallment` → `canEditInstallmentCore(..., { considerPaidAsEditable: true })`
- `hasChanges` → `hasChanges(selectedInstallments, initialPaymentStatus)` (rinominato `hasPaymentChanges`)
- `handleMarkPayment` → usa `markInstallmentsPaid(updates)` al posto del loop manuale

### FeesManagement (`src/pages/FeesManagement.tsx`)

**Import:**
```ts
import {
  getInstallmentStatus,
  calculateDaysLate,
  canEditInstallment as canEditInstallmentCore,
  markInstallmentsPaid
} from '@/lib/fees/paymentsCore'
```

**Sostituzioni:**
- `getInstallmentStatus` → import dal core
- `calculateDaysLate` → import dal core
- `canEditInstallment` → `canEditInstallmentCore(..., { considerPaidAsEditable: false })`

**NON sostituito:** `handlePaymentSubmit` — mantiene la logica locale perché:
- gestisce sia update (assegnazioni reali) che insert (rate temporanee con `isRealAssignment: false`)
- `markInstallmentsPaid` gestisce solo update; l’insert richiede logica specifica

---

## Cosa NON è stato unificato e perché

| Elemento | Motivo |
|----------|--------|
| `handlePaymentSubmit` (FeesManagement) | Gestisce sia update che insert di nuove assegnazioni; `markInstallmentsPaid` copre solo update. La logica di insert per rate temporanee resta locale. |
| `handleOpenPaymentModal` / `handlePayment` | Costruzione di `paymentInstallments` diversa tra i due componenti (FeesManagement usa `fee.installments` + `isRealAssignment`; FeesTab usa solo `feeAssignments`). Non unificato per evitare regressioni. |
| `convertToSinglePayment` / `convertToInstallments` | Solo FeesTab ha handler attivi; FeesManagement ha solo pulsanti senza `onClick`. La conversione in FeesTab aggiorna soprattutto lo stato UI; non è stata estratta nel core. |
| `updateInstallment` (FeesManagement riga 1381) | È usata nel form di creazione/modifica quota (campi amount, due_date, notes), non nel modal pagamenti. Contesto diverso, lasciata locale. |
| `hasChanges` in FeesManagement | Il pulsante "Registra Pagamento" non è disabilitato in base a `hasChanges`; la logica non è necessaria. |

**Differenza `canEditInstallment`:**
- **FeesTab** (`considerPaidAsEditable: true`): la rata precedente può essere considerata “sbloccante” se è già pagata in DB, anche se non selezionata nel modal.
- **FeesManagement** (`considerPaidAsEditable: false`): la rata precedente deve essere selezionata nel modal per sbloccare la successiva.

---

## Esito `npm run build`

```
✓ built in 10.57s
```

Build completata senza errori.

---

## Checklist test manuale

Da verificare manualmente:

- [ ] **FeesTab (CreatePerson → tab QUOTA):**
  - Aprire gestione pagamenti
  - Toggle rata pagata/non pagata (se consentito)
  - Cambiare metodo (contanti/bonifico) e data
  - Salvare e verificare persistenza (refresh pagina)
- [ ] **FeesManagement:**
  - Aprire gestione pagamenti da lista assegnazioni
  - Toggle rata pagata/non pagata
  - Cambiare metodo e data
  - Salvare e verificare persistenza
- [ ] Conversione unica ↔ rate (solo FeesTab): verificare che i pulsanti funzionino come prima

---

## Domanda finale

Posso procedere con il **Prompt #5** (piano migrazione people3 → people + script SQL in step sicuri)?
