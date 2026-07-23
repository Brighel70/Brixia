import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import type { AccountingFiscalProfile } from '../types'
import {
  fetchFiscalProfile,
  setMovementApprovalMode,
  updateFiscalProfile
} from '../api/fiscalProfile.api'

interface AccountingFiscalProfileSettingsProps {
  canManage: boolean
}

export function AccountingFiscalProfileSettings({ canManage }: AccountingFiscalProfileSettingsProps) {
  const [profile, setProfile] = useState<AccountingFiscalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvalMode, setApprovalMode] = useState<'simple' | 'verify_then_post'>('simple')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFiscalProfile()
      setProfile(data)
      let mode = data.movement_approval_mode
      if (mode !== 'simple' && mode !== 'verify_then_post') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db = supabase as any
          const { data: settings } = await db
            .from('accounting_settings')
            .select('movement_approval_mode')
            .eq('singleton_guard', true)
            .maybeSingle()
          if (
            settings?.movement_approval_mode === 'simple' ||
            settings?.movement_approval_mode === 'verify_then_post'
          ) {
            mode = settings.movement_approval_mode
          }
        } catch {
          // profile get may predate movement_approval_mode column exposure
        }
      }
      setApprovalMode(mode ?? 'simple')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile caricare il profilo fiscale')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return <div className="text-sm text-slate-500">Caricamento profilo fiscale…</div>
  }

  if (error || !profile) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {error ?? 'Profilo non disponibile (applica migration 050).'}
      </div>
    )
  }

  const unverified = profile.params_verification_status !== 'verified'

  const save = async () => {
    if (!canManage || !profile) return
    setSaving(true)
    try {
      const updated = await updateFiscalProfile({
        legal_form: profile.legal_form,
        tax_code: profile.tax_code,
        vat_number: profile.vat_number,
        rasd_registration: profile.rasd_registration,
        fiscal_regime: profile.fiscal_regime,
        regime_398_active: profile.regime_398_active,
        regime_398_from: profile.regime_398_from,
        regime_398_to: profile.regime_398_to,
        commercial_activity_active: profile.commercial_activity_active,
        ets_flag: profile.ets_flag,
        consultant_name: profile.consultant_name,
        consultant_notes: profile.consultant_notes,
        fiscal_profile_notes: profile.fiscal_profile_notes
      })
      setProfile(updated)
      toast.success('Profilo fiscale aggiornato (stato: da validare)')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  const saveApprovalMode = async () => {
    if (!canManage) return
    setSaving(true)
    try {
      const mode = await setMovementApprovalMode(approvalMode, 'Impostazioni Contabilità')
      setApprovalMode(mode as 'simple' | 'verify_then_post')
      toast.success(
        mode === 'simple'
          ? 'Workflow semplice attivo (bozza → contabilizza)'
          : 'Workflow con verifica attivo (bozza → verifica → contabilizza)'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aggiornamento workflow non riuscito')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Profilo fiscale associazione</h3>
        <p className="mt-1 text-sm text-slate-500">{profile.disclaimer}</p>
        {unverified && (
          <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            PARAMETRI NON VERIFICATI — da validare con il commercialista
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Forma giuridica
          <select
            disabled={!canManage}
            value={profile.legal_form}
            onChange={(e) => setProfile({ ...profile, legal_form: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="ASD">ASD</option>
            <option value="SSD">SSD</option>
          </select>
        </label>
        <label className="text-sm">
          Regime
          <input
            disabled={!canManage}
            value={profile.fiscal_regime}
            onChange={(e) => setProfile({ ...profile, fiscal_regime: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Codice fiscale
          <input
            disabled={!canManage}
            value={profile.tax_code ?? ''}
            onChange={(e) => setProfile({ ...profile, tax_code: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Partita IVA
          <input
            disabled={!canManage}
            value={profile.vat_number ?? ''}
            onChange={(e) => setProfile({ ...profile, vat_number: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Iscrizione RASD
          <input
            disabled={!canManage}
            value={profile.rasd_registration ?? ''}
            onChange={(e) => setProfile({ ...profile, rasd_registration: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Commercialista
          <input
            disabled={!canManage}
            value={profile.consultant_name ?? ''}
            onChange={(e) => setProfile({ ...profile, consultant_name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={profile.regime_398_active}
            onChange={(e) => setProfile({ ...profile, regime_398_active: e.target.checked })}
          />
          Regime 398 attivo
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={profile.commercial_activity_active}
            onChange={(e) =>
              setProfile({ ...profile, commercial_activity_active: e.target.checked })
            }
          />
          Attività commerciale
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={profile.ets_flag}
            onChange={(e) => setProfile({ ...profile, ets_flag: e.target.checked })}
          />
          ETS
        </label>
      </div>

      <label className="block text-sm">
        Note profilo
        <textarea
          disabled={!canManage}
          value={profile.fiscal_profile_notes ?? ''}
          onChange={(e) => setProfile({ ...profile, fiscal_profile_notes: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {canManage && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
        >
          Salva profilo fiscale
        </button>
      )}

      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-900">Approvazioni movimenti</h4>
        <p className="mt-1 text-xs text-slate-500">
          Default semplice per ASD piccole. Attiva la verifica solo se serve un controllo a due
          livelli.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            disabled={!canManage}
            value={approvalMode}
            onChange={(e) =>
              setApprovalMode(e.target.value as 'simple' | 'verify_then_post')
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="simple">Semplice: bozza → contabilizza</option>
            <option value="verify_then_post">Con verifica: bozza → verifica → contabilizza</option>
          </select>
          {canManage && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveApprovalMode()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              Salva workflow
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
