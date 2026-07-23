import React, { useState, useEffect } from 'react'
import { useReceiptHeaderSettings } from '../hooks/useReceiptHeaderSettings'
import { toast } from 'sonner'

const FIELDS: { key: keyof Pick<
  import('../types').ReceiptHeaderSettings,
  'nome_associazione' | 'sede_legale' | 'cf_associazione' | 'piva_associazione' | 'affiliazione_fir' | 'luogo'
>; label: string; placeholder: string }[] = [
  { key: 'nome_associazione', label: 'Nome associazione', placeholder: 'Es. A.S.D. nome società' },
  { key: 'sede_legale', label: 'Sede legale', placeholder: 'Es. Via Roma 1, 25100 Brescia' },
  { key: 'cf_associazione', label: 'Codice fiscale associazione', placeholder: 'Es. 12345678901' },
  { key: 'piva_associazione', label: 'P.IVA associazione', placeholder: 'Es. IT12345678901' },
  { key: 'affiliazione_fir', label: 'Affiliazione F.I.R.', placeholder: 'Es. numero affiliazione' },
  { key: 'luogo', label: 'Luogo (per data e luogo in calce)', placeholder: 'Es. Brescia' }
]

function getInitialForm(settings: { nome_associazione: string | null; sede_legale: string | null; cf_associazione: string | null; piva_associazione: string | null; affiliazione_fir: string | null; luogo: string | null } | null): Record<string, string> {
  if (!settings) return FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  return {
    nome_associazione: settings.nome_associazione ?? '',
    sede_legale: settings.sede_legale ?? '',
    cf_associazione: settings.cf_associazione ?? '',
    piva_associazione: settings.piva_associazione ?? '',
    affiliazione_fir: settings.affiliazione_fir ?? '',
    luogo: settings.luogo ?? ''
  }
}

export function ReceiptHeaderForm() {
  const { settings, loading, error, saving, save } = useReceiptHeaderSettings()
  const [form, setForm] = useState<Record<string, string>>({})
  const [initialForm, setInitialForm] = useState<Record<string, string>>({})

  useEffect(() => {
    const next = getInitialForm(settings)
    setForm(next)
    setInitialForm(next)
  }, [settings])

  const isDirty = FIELDS.some(f => (form[f.key] ?? '') !== (initialForm[f.key] ?? ''))

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await save({
        nome_associazione: form.nome_associazione || null,
        sede_legale: form.sede_legale || null,
        cf_associazione: form.cf_associazione || null,
        piva_associazione: form.piva_associazione || null,
        affiliazione_fir: form.affiliazione_fir || null,
        luogo: form.luogo || null
      })
      setInitialForm(form)
      toast.success('Dati intestazione ricevuta salvati.')
    } catch {
      toast.error('Errore nel salvataggio.')
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Dati intestazione ricevuta</h3>
      <p className="mt-1 text-sm text-gray-500">
        Questi dati vengono inseriti nell’intestazione e nel corpo delle ricevute PDF (nome associazione, sede, CF, P.IVA, F.I.R., luogo).
      </p>
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="text"
              value={form[key] ?? ''}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
        {isDirty && (
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva dati intestazione'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
