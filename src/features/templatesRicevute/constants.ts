import type { TemplateName } from './types'

export const TEMPLATE_NAMES: TemplateName[] = ['ricevuta_soluzione_unica', 'ricevuta_rateizzata']

export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  ricevuta_soluzione_unica: 'Ricevuta - Soluzione Unica',
  ricevuta_rateizzata: 'Ricevuta - Pagamento Rateizzato'
}
