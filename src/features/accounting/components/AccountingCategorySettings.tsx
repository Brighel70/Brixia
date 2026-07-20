import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RotateCcw,
  Save,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/config/permissions'
import {
  createCategory,
  createCategoryGroup,
  fetchCategoriesForSettings,
  fetchCategoryGroups,
  resetRecommendedCategoryActivation,
  saveCategoryActivationBatch,
  updateCategory
} from '../api/categorySettings.api'
import type {
  AccountingCategoryGroup,
  AccountingCategorySettingsRow,
  ReceivableNature
} from '../types'
import {
  applyMasterGroupToggle,
  buildActivationPayload,
  filterSettingsRows,
  groupActivationState,
  isProtectedCategory,
  suggestCodeFromName
} from '../utils/categorySettingsCalculations'
import { receivableNatureLabel } from '../utils/labels'

type DirTab = 'income' | 'expense'

function MasterCheckbox({
  state,
  onChange,
  disabled
}: {
  state: boolean | 'indeterminate'
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'indeterminate'
  }, [state])
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      checked={state === true}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300"
    />
  )
}

export function AccountingCategorySettings() {
  const { hasPermission, isAdmin } = usePermissions()
  const canManage = isAdmin() || hasPermission(PERMISSIONS.ACCOUNTING.MANAGE_SETTINGS)
  const canView = canManage || hasPermission(PERMISSIONS.ACCOUNTING.VIEW)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirTab, setDirTab] = useState<DirTab>('income')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'system' | 'custom'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [groups, setGroups] = useState<AccountingCategoryGroup[]>([])
  const [categories, setCategories] = useState<AccountingCategorySettingsRow[]>([])
  const [baseline, setBaseline] = useState<string>('')

  const [groupModal, setGroupModal] = useState(false)
  const [catModal, setCatModal] = useState<{ groupId: string } | null>(null)
  const [groupForm, setGroupForm] = useState({
    direction: 'income' as DirTab,
    name: '',
    code: '',
    description: '',
    sortOrder: '0',
    isActive: true
  })
  const [catForm, setCatForm] = useState({
    name: '',
    code: '',
    notes: '',
    nature: 'to_classify' as ReceivableNature,
    includeCommercial: false,
    availMovements: true,
    availBudget: true,
    availReports: true,
    sortOrder: '0',
    isActive: true
  })

  const dirty = useMemo(() => {
    const snap = JSON.stringify({ groups, categories })
    return baseline !== '' && snap !== baseline
  }, [groups, categories, baseline])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [g, c] = await Promise.all([fetchCategoryGroups(), fetchCategoriesForSettings()])
      setGroups(g)
      setCategories(c)
      setBaseline(JSON.stringify({ groups: g, categories: c }))
      const exp: Record<string, boolean> = {}
      g.forEach((gr) => {
        exp[gr.id] = true
      })
      setExpanded(exp)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento categorie')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const filtered = useMemo(
    () =>
      filterSettingsRows({
        groups,
        categories,
        direction: dirTab,
        search,
        statusFilter,
        originFilter
      }),
    [groups, categories, dirTab, search, statusFilter, originFilter]
  )

  const patchCategory = (id: string, patch: Partial<AccountingCategorySettingsRow>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const patchGroup = (id: string, patch: Partial<AccountingCategoryGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  const handleMasterToggle = (groupId: string, activate: boolean) => {
    setCategories((prev) => {
      const inGroup = prev.filter((c) => c.group_id === groupId)
      const others = prev.filter((c) => c.group_id !== groupId)
      return [...others, ...applyMasterGroupToggle(inGroup, activate)]
    })
    patchGroup(groupId, { is_active: activate })
  }

  const handleSave = async () => {
    if (!canManage) return
    setSaving(true)
    try {
      await saveCategoryActivationBatch(buildActivationPayload(groups, categories))
      toast.success('Configurazione categorie salvata')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  const handleResetLocal = () => {
    if (!window.confirm('Annullare le modifiche non salvate?')) return
    void load()
  }

  const handleRestoreRecommended = async () => {
    if (!canManage) return
    if (
      !window.confirm(
        'Ripristinare la configurazione consigliata? Le personalizzazioni di attivazione verranno sovrascritte.'
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await resetRecommendedCategoryActivation()
      toast.success('Configurazione consigliata ripristinata')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ripristino non riuscito')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectAll = (activate: boolean) => {
    const groupIds = new Set(filtered.groups.map((g) => g.id))
    setCategories((prev) =>
      prev.map((c) => {
        if (!c.group_id || !groupIds.has(c.group_id)) return c
        if (isProtectedCategory(c)) return { ...c, is_active: true }
        return { ...c, is_active: activate }
      })
    )
    setGroups((prev) =>
      prev.map((g) => (groupIds.has(g.id) ? { ...g, is_active: activate } : g))
    )
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Serve il permesso <code>accounting.view</code> per vedere le categorie contabili.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
        Caricamento categorie contabili…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <p className="mt-2 text-xs">
          Se compare un errore di schema, applica prima la migration{' '}
          <code>019_accounting_category_settings.sql</code> (non ancora applicata).
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Categorie contabili</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configura le categorie di entrata e uscita disponibili nella Contabilità.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Natura e rilevanza fiscale (limite commerciale) devono essere confermate dal
        commercialista. QUOTE resta sempre attiva per la sincronizzazione automatica.
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {(
          [
            ['income', 'Entrate'],
            ['expense', 'Uscite']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDirTab(id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              dirTab === id
                ? 'border-brixia-primary text-slate-900'
                : 'border-transparent text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Ricerca</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gruppo, nome o codice…"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Stato</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">Tutte</option>
            <option value="active">Attive</option>
            <option value="inactive">Inattive</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Origine</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as typeof originFilter)}
          >
            <option value="all">Tutte</option>
            <option value="system">Sistema</option>
            <option value="custom">Personalizzate</option>
          </select>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
          onClick={() => handleSelectAll(true)}
          disabled={!canManage}
        >
          Seleziona tutto
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
          onClick={() => handleSelectAll(false)}
          disabled={!canManage}
        >
          Deseleziona tutto
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
          onClick={() => {
            const next: Record<string, boolean> = {}
            filtered.groups.forEach((g) => {
              next[g.id] = true
            })
            setExpanded((prev) => ({ ...prev, ...next }))
          }}
        >
          Espandi
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
          onClick={() => {
            const next: Record<string, boolean> = {}
            filtered.groups.forEach((g) => {
              next[g.id] = false
            })
            setExpanded((prev) => ({ ...prev, ...next }))
          }}
        >
          Comprimi
        </button>
        {canManage && (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
              onClick={() => void handleRestoreRecommended()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Ripristina consigliata
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-brixia-primary px-3 py-2 text-xs font-semibold text-white"
              onClick={() => {
                setGroupForm({
                  direction: dirTab,
                  name: '',
                  code: '',
                  description: '',
                  sortOrder: '0',
                  isActive: true
                })
                setGroupModal(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuova macro-categoria
            </button>
          </>
        )}
      </div>

      <div className="space-y-3">
        {filtered.groups.map((g) => {
          const cats = filtered.categoriesByGroup.get(g.id) ?? []
          const allInGroup = categories.filter((c) => c.group_id === g.id)
          const master = groupActivationState(allInGroup)
          const activeCount = allInGroup.filter((c) => c.is_active).length
          const isOpen = expanded[g.id] !== false
          return (
            <div key={g.id} className="rounded-xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                <MasterCheckbox
                  state={master}
                  disabled={!canManage}
                  onChange={(next) => handleMasterToggle(g.id, next)}
                />
                <button
                  type="button"
                  className="text-slate-500"
                  onClick={() => setExpanded((p) => ({ ...p, [g.id]: !isOpen }))}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{g.name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {g.code}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        g.is_system
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-violet-100 text-violet-800'
                      }`}
                    >
                      {g.is_system ? 'Sistema' : 'Personalizzata'}
                    </span>
                    {!g.is_active && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        Inattiva
                      </span>
                    )}
                    {master === 'indeterminate' && (
                      <span className="text-[10px] text-amber-700">
                        Parzialmente attiva (categorie protette)
                      </span>
                    )}
                  </div>
                  {g.description && (
                    <p className="mt-0.5 text-xs text-slate-500">{g.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    Sottocategorie attive: {activeCount}/{allInGroup.length}
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    onClick={() => {
                      setCatForm({
                        name: '',
                        code: '',
                        notes: '',
                        nature: 'to_classify',
                        includeCommercial: false,
                        availMovements: true,
                        availBudget: true,
                        availReports: true,
                        sortOrder: '0',
                        isActive: true
                      })
                      setCatModal({ groupId: g.id })
                    }}
                  >
                    Nuova sottocategoria
                  </button>
                )}
              </div>
              {isOpen && (
                <ul className="divide-y divide-slate-50">
                  {cats.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">Nessuna sottocategoria.</li>
                  ) : (
                    cats.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          disabled={!canManage || isProtectedCategory(c)}
                          checked={c.is_active}
                          onChange={(e) =>
                            patchCategory(c.id, {
                              is_active: isProtectedCategory(c) ? true : e.target.checked
                            })
                          }
                          title={
                            isProtectedCategory(c)
                              ? 'QUOTE non può essere disattivata'
                              : undefined
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <span className="font-mono text-xs text-slate-500">{c.code}</span>
                            <span className="text-xs text-slate-500">
                              {receivableNatureLabel(c.default_nature)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                c.is_system
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-violet-100 text-violet-800'
                              }`}
                            >
                              {c.is_system ? 'Sistema' : 'Personalizzata'}
                            </span>
                            {!c.is_active && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                Inattiva
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {[
                              c.available_in_movements ? 'Prima nota' : null,
                              c.available_in_budget ? 'Preventivo' : null,
                              c.available_in_reports ? 'Report' : null
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Nessun utilizzo'}
                          </p>
                        </div>
                        {canManage && !c.is_system && (
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-0.5 text-xs"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  'Archiviare questa sottocategoria? Resterà visibile nello storico.'
                                )
                              ) {
                                return
                              }
                              void updateCategory({ id: c.id, archive: true })
                                .then(() => {
                                  toast.success('Categoria archiviata')
                                  return load()
                                })
                                .catch((err) =>
                                  toast.error(
                                    err instanceof Error ? err.message : 'Archiviazione non riuscita'
                                  )
                                )
                            }}
                          >
                            Archivia
                          </button>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {dirty && canManage && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">Modifiche non salvate</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={handleResetLocal}
                disabled={saving}
              >
                Annulla modifiche
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-brixia-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                <Save className="h-4 w-4" />
                Salva modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {groupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Nuova macro-categoria</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Tipo</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={groupForm.direction}
                  onChange={(e) =>
                    setGroupForm((f) => ({
                      ...f,
                      direction: e.target.value as DirTab
                    }))
                  }
                >
                  <option value="income">Entrata</option>
                  <option value="expense">Uscita</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={groupForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setGroupForm((f) => ({
                      ...f,
                      name,
                      code: f.code && f.code !== suggestCodeFromName(f.name) ? f.code : suggestCodeFromName(name)
                    }))
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Codice</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
                  value={groupForm.code}
                  onChange={(e) =>
                    setGroupForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Descrizione</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                  value={groupForm.description}
                  onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setGroupModal(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="rounded-lg bg-brixia-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void createCategoryGroup({
                    direction: groupForm.direction,
                    code: groupForm.code,
                    name: groupForm.name,
                    description: groupForm.description || null,
                    sortOrder: Number(groupForm.sortOrder) || 0,
                    isActive: groupForm.isActive
                  })
                    .then(() => {
                      toast.success('Macro-categoria creata')
                      setGroupModal(false)
                      return load()
                    })
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
                    )
                }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Nuova sottocategoria</h3>
            <p className="mt-1 text-xs text-amber-800">
              Natura e limite commerciale: da verificare con il commercialista.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={catForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setCatForm((f) => ({
                      ...f,
                      name,
                      code:
                        f.code && f.code !== suggestCodeFromName(f.name)
                          ? f.code
                          : suggestCodeFromName(name)
                    }))
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Codice</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  value={catForm.code}
                  onChange={(e) => setCatForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Natura</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={catForm.nature}
                  onChange={(e) => {
                    const nature = e.target.value as ReceivableNature
                    setCatForm((f) => ({
                      ...f,
                      nature,
                      includeCommercial:
                        nature === 'commercial' ? true : f.includeCommercial
                    }))
                  }}
                >
                  <option value="institutional">Istituzionale</option>
                  <option value="commercial">Commerciale</option>
                  <option value="mixed">Misto</option>
                  <option value="to_classify">Da classificare</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={catForm.includeCommercial}
                  onChange={(e) =>
                    setCatForm((f) => ({ ...f, includeCommercial: e.target.checked }))
                  }
                />
                Inclusione nel limite commerciale
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={catForm.availMovements}
                  onChange={(e) =>
                    setCatForm((f) => ({ ...f, availMovements: e.target.checked }))
                  }
                />
                Disponibile in Prima nota
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={catForm.availBudget}
                  onChange={(e) => setCatForm((f) => ({ ...f, availBudget: e.target.checked }))}
                />
                Disponibile nel Preventivo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={catForm.availReports}
                  onChange={(e) => setCatForm((f) => ({ ...f, availReports: e.target.checked }))}
                />
                Disponibile nei Report/Consuntivo
              </label>
              <div>
                <label className="text-xs font-medium text-slate-600">Note</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                  value={catForm.notes}
                  onChange={(e) => setCatForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setCatModal(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="rounded-lg bg-brixia-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void createCategory({
                    groupId: catModal.groupId,
                    code: catForm.code,
                    name: catForm.name,
                    notes: catForm.notes || null,
                    defaultNature: catForm.nature,
                    includeInCommercialLimit: catForm.includeCommercial,
                    availableInMovements: catForm.availMovements,
                    availableInBudget: catForm.availBudget,
                    availableInReports: catForm.availReports,
                    sortOrder: Number(catForm.sortOrder) || 0,
                    isActive: catForm.isActive
                  })
                    .then(() => {
                      toast.success('Sottocategoria creata')
                      setCatModal(null)
                      return load()
                    })
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Creazione non riuscita')
                    )
                }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
