import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search
} from 'lucide-react'
import { toast } from 'sonner'
import GoleeConfirmModal from '@/components/GoleeConfirmModal'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/config/permissions'
import {
  countCategoryUsage,
  createCategory,
  createCategoryGroup,
  fetchCategoriesForSettings,
  fetchCategoryGroups,
  resetRecommendedCategoryActivation,
  saveCategoryActivationBatch,
  updateCategory,
  updateCategoryGroup
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

type PendingConfirm =
  | { kind: 'discard' }
  | { kind: 'restore' }
  | { kind: 'archiveCategory'; category: AccountingCategorySettingsRow; detail: string }
  | { kind: 'archiveGroup'; group: AccountingCategoryGroup }
  | { kind: 'leave' }

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
  const canManageSystemCategories = isAdmin()
  const canView = canManage || hasPermission(PERMISSIONS.ACCOUNTING.VIEW)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirTab, setDirTab] = useState<DirTab>('income')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive' | 'archived'
  >('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'system' | 'custom'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [groups, setGroups] = useState<AccountingCategoryGroup[]>([])
  const [categories, setCategories] = useState<AccountingCategorySettingsRow[]>([])
  const [baseline, setBaseline] = useState<string>('')

  const [groupModal, setGroupModal] = useState(false)
  const [catModal, setCatModal] = useState<{ groupId: string } | null>(null)
  const [editingGroup, setEditingGroup] = useState<AccountingCategoryGroup | null>(null)
  const [editingCategory, setEditingCategory] = useState<AccountingCategorySettingsRow | null>(null)
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
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [confirmingAction, setConfirmingAction] = useState(false)

  const dirty = useMemo(() => {
    const snap = JSON.stringify({ groups, categories })
    return baseline !== '' && snap !== baseline
  }, [groups, categories, baseline])

  const blocker = useBlocker(Boolean(dirty && canManage))

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setPendingConfirm({ kind: 'leave' })
    }
  }, [blocker.state])

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
      return [
        ...others,
        ...applyMasterGroupToggle(inGroup, activate, canManageSystemCategories)
      ]
    })
    patchGroup(groupId, { is_active: activate })
  }

  const handleSave = async () => {
    if (!canManage) return
    setSaving(true)
    try {
      if (canManageSystemCategories) {
        const previous = JSON.parse(baseline) as {
          groups: AccountingCategoryGroup[]
          categories: AccountingCategorySettingsRow[]
        }
        const previousGroups = new Map(previous.groups.map((group) => [group.id, group]))
        const previousCategories = new Map(
          previous.categories.map((category) => [category.id, category])
        )
        const groupUpdates = groups.filter(
          (group) => previousGroups.get(group.id)?.is_active !== group.is_active
        )
        const categoryUpdates = categories.filter((category) => {
          const old = previousCategories.get(category.id)
          return (
            old?.is_active !== category.is_active ||
            old?.available_in_movements !== category.available_in_movements ||
            old?.available_in_budget !== category.available_in_budget ||
            old?.available_in_reports !== category.available_in_reports
          )
        })

        await Promise.all([
          ...groupUpdates.map((group) =>
            updateCategoryGroup({ id: group.id, isActive: group.is_active })
          ),
          ...categoryUpdates.map((category) =>
            updateCategory({
              id: category.id,
              isActive: category.is_active,
              availableInMovements: category.available_in_movements,
              availableInBudget: category.available_in_budget,
              availableInReports: category.available_in_reports
            })
          )
        ])
      } else {
        await saveCategoryActivationBatch(buildActivationPayload(groups, categories))
      }
      toast.success('Configurazione categorie salvata')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  const handleResetLocal = () => {
    setPendingConfirm({ kind: 'discard' })
  }

  const handleRestoreRecommended = () => {
    if (!canManage) return
    setPendingConfirm({ kind: 'restore' })
  }

  const handleSelectAll = (activate: boolean) => {
    const groupIds = new Set(filtered.groups.filter((g) => !g.archived_at).map((g) => g.id))
    setCategories((prev) =>
      prev.map((c) => {
        if (!c.group_id || !groupIds.has(c.group_id) || c.archived_at) return c
        if (isProtectedCategory(c) && !canManageSystemCategories) {
          return { ...c, is_active: true }
        }
        return { ...c, is_active: activate }
      })
    )
    setGroups((prev) =>
      prev.map((g) =>
        groupIds.has(g.id) && !g.archived_at ? { ...g, is_active: activate } : g
      )
    )
  }

  const handleCategoryArchive = async (category: AccountingCategorySettingsRow) => {
    try {
      const usage = await countCategoryUsage(category.id)
      const detail = `${usage.movements} moviment${usage.movements === 1 ? 'o' : 'i'} e ${usage.budgetLines} righ${usage.budgetLines === 1 ? 'a' : 'e'} di Preventivo collegate.\nLo storico resterà invariato.`
      setPendingConfirm({ kind: 'archiveCategory', category, detail })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archiviazione non riuscita')
    }
  }

  const handleGroupArchive = (group: AccountingCategoryGroup) => {
    const activeChildren = categories.filter(
      (category) =>
        category.group_id === group.id && !category.archived_at && category.is_active
    ).length
    if (activeChildren > 0) {
      toast.error('Disattiva o archivia prima tutte le sottocategorie attive della macro-categoria.')
      return
    }
    setPendingConfirm({ kind: 'archiveGroup', group })
  }

  const closePendingConfirm = () => {
    if (confirmingAction) return
    if (pendingConfirm?.kind === 'leave' && blocker.state === 'blocked') {
      blocker.reset()
    }
    setPendingConfirm(null)
  }

  const runPendingConfirm = async () => {
    if (!pendingConfirm) return

    if (pendingConfirm.kind === 'discard') {
      setPendingConfirm(null)
      void load()
      return
    }

    if (pendingConfirm.kind === 'leave') {
      setPendingConfirm(null)
      if (blocker.state === 'blocked') blocker.proceed()
      return
    }

    setConfirmingAction(true)
    try {
      if (pendingConfirm.kind === 'restore') {
        await resetRecommendedCategoryActivation()
        toast.success('Configurazione consigliata ripristinata')
        await load()
      } else if (pendingConfirm.kind === 'archiveCategory') {
        await updateCategory({
          id: pendingConfirm.category.id,
          archive: true,
          isActive: false
        })
        toast.success('Categoria archiviata')
        await load()
      } else if (pendingConfirm.kind === 'archiveGroup') {
        await updateCategoryGroup({ id: pendingConfirm.group.id, archive: true, isActive: false })
        toast.success('Macro-categoria archiviata')
        await load()
      }
      setPendingConfirm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operazione non riuscita')
    } finally {
      setConfirmingAction(false)
    }
  }

  const confirmModalProps = (() => {
    if (!pendingConfirm) {
      return {
        open: false,
        title: '',
        message: '',
        confirmLabel: 'Conferma',
        cancelLabel: 'Annulla',
        variant: 'warning' as const
      }
    }
    switch (pendingConfirm.kind) {
      case 'discard':
        return {
          open: true,
          title: 'Annullare le modifiche?',
          message: 'Le modifiche non salvate andranno perse.',
          confirmLabel: 'Annulla modifiche',
          cancelLabel: 'Continua a modificare',
          variant: 'warning' as const
        }
      case 'restore':
        return {
          open: true,
          title: 'Ripristinare la configurazione consigliata?',
          message:
            'Le personalizzazioni di attivazione verranno sovrascritte. Potrai comunque salvare o annullare dopo il ripristino.',
          confirmLabel: 'Ripristina',
          cancelLabel: 'Annulla',
          variant: 'warning' as const
        }
      case 'archiveCategory':
        return {
          open: true,
          title: `Archiviare "${pendingConfirm.category.name}"?`,
          message: pendingConfirm.detail,
          confirmLabel: 'Archivia',
          cancelLabel: 'Annulla',
          variant: 'danger' as const
        }
      case 'archiveGroup':
        return {
          open: true,
          title: `Archiviare "${pendingConfirm.group.name}"?`,
          message: 'Lo storico resterà invariato.',
          confirmLabel: 'Archivia',
          cancelLabel: 'Annulla',
          variant: 'danger' as const
        }
      case 'leave':
        return {
          open: true,
          title: 'Uscire senza salvare?',
          message: 'Le modifiche apportate potrebbero non essere salvate.',
          confirmLabel: 'Esci',
          cancelLabel: 'Annulla',
          variant: 'warning' as const
        }
    }
  })()

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
    <>
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Categorie contabili</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configura le categorie di entrata e uscita disponibili nella Contabilità.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Natura e rilevanza fiscale (limite commerciale) devono essere confermate dal
        commercialista. Admin e Super Admin possono gestire anche le categorie di sistema;
        codici e direzioni tecniche restano fissi per non interrompere le automazioni.
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
                ? 'border-brand-primary text-slate-900'
                : 'border-transparent text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E8ECF0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="min-w-[260px] flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ricerca</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-xl border border-[#D9E2EC] bg-[#FBFCFE] py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#2F6DF6] focus:ring-2 focus:ring-[#2F6DF6]/15"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gruppo, nome o codice…"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Stato</label>
          <select
            className="rounded-xl border border-[#D9E2EC] bg-[#FBFCFE] px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2F6DF6]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">Tutte</option>
            <option value="active">Attive</option>
            <option value="inactive">Inattive</option>
            <option value="archived">Archiviate</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Origine</label>
          <select
            className="rounded-xl border border-[#D9E2EC] bg-[#FBFCFE] px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2F6DF6]"
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
          className="rounded-xl border border-[#D9E2EC] px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-45"
          onClick={() => handleSelectAll(true)}
          disabled={!canManage}
        >
          Seleziona tutto
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#D9E2EC] px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-45"
          onClick={() => handleSelectAll(false)}
          disabled={!canManage}
        >
          Deseleziona tutto
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#D9E2EC] px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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
          className="rounded-xl border border-[#D9E2EC] px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D9E2EC] px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => void handleRestoreRecommended()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Ripristina consigliata
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
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
          const allInGroup = categories.filter((c) => c.group_id === g.id && !c.archived_at)
          const master = groupActivationState(allInGroup)
          const activeCount = allInGroup.filter((c) => c.is_active).length
          const isOpen = expanded[g.id] !== false
          return (
            <div key={g.id} className="overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#EEF2F6] px-4 py-3.5">
                <div className="flex shrink-0 items-center gap-2">
                  <MasterCheckbox
                    state={master}
                    disabled={!canManage || !!g.archived_at}
                    onChange={(next) => handleMasterToggle(g.id, next)}
                  />
                  <button
                    type="button"
                    className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => setExpanded((p) => ({ ...p, [g.id]: !isOpen }))}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[19px] font-bold text-[#1A2332]">{g.name}</span>
                  <span className="rounded-md bg-[#F0F4F8] px-1.5 py-0.5 font-mono text-sm font-semibold text-slate-600">
                    {g.code}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm font-semibold ${
                      g.is_system
                        ? 'bg-[#EAF2FF] text-[#2F6DF6]'
                        : 'bg-[#F2EDFF] text-[#7758D9]'
                    }`}
                  >
                    {g.is_system ? 'Sistema' : 'Personalizzata'}
                  </span>
                  {!g.is_active && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700">
                      Inattiva
                    </span>
                  )}
                  {g.archived_at && (
                    <span className="rounded-full bg-[#FFF4E5] px-2 py-0.5 text-sm font-semibold text-[#B46700]">
                      Archiviata
                    </span>
                  )}
                  {master === 'indeterminate' && !canManageSystemCategories && (
                    <span className="text-sm font-medium text-[#B46700]">
                      Parzialmente attiva (categorie protette)
                    </span>
                  )}
                  {g.description && (
                    <span className="text-base text-slate-500">{g.description}</span>
                  )}
                  <span className="text-base text-slate-500">
                    <span className="font-semibold text-[#1A2332]">{activeCount}/{allInGroup.length}</span> sottocategorie attive
                  </span>
                </div>
                <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5">
                {canManage && !g.archived_at && (
                  <button
                    type="button"
                    className="rounded-lg border border-[#D9E2EC] p-2 text-[#2F6DF6] transition hover:bg-[#EAF2FF]"
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
                    title="Nuova sottocategoria"
                    aria-label="Nuova sottocategoria"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                )}
                {canManage && (!g.is_system || canManageSystemCategories) && (
                  <>
                    {!g.archived_at && (
                      <button
                        type="button"
                        className="rounded-lg border border-[#D9E2EC] p-2 text-slate-600 transition hover:bg-slate-50"
                        onClick={() => setEditingGroup({ ...g })}
                        title="Modifica macro-categoria"
                        aria-label="Modifica macro-categoria"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {!g.is_system && (
                    <button
                      type="button"
                      className={`rounded-lg border p-2 transition ${g.archived_at ? 'border-[#BFEEDC] text-[#0B9A6D] hover:bg-[#E6FAF3]' : 'border-[#F5D3D3] text-[#D14F4F] hover:bg-[#FFF1F1]'}`}
                      onClick={() => {
                        if (g.archived_at) {
                          void updateCategoryGroup({ id: g.id, archive: false })
                            .then(() => {
                              toast.success('Macro-categoria ripristinata')
                              return load()
                            })
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : 'Ripristino non riuscito')
                            )
                        } else {
                          void handleGroupArchive(g)
                        }
                      }}
                      title={g.archived_at ? 'Ripristina macro-categoria' : 'Archivia macro-categoria'}
                      aria-label={g.archived_at ? 'Ripristina macro-categoria' : 'Archivia macro-categoria'}
                    >
                      {g.archived_at ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </button>
                    )}
                  </>
                )}
                </div>
              </div>
              {isOpen && (
                <>
                <div className="hidden bg-[#F8FAFC] px-4 py-2 xl:grid xl:grid-cols-[42px_minmax(260px,1.45fr)_150px_150px_126px_120px_minmax(300px,1fr)_92px] xl:items-center xl:gap-3">
                  <span />
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Nome</span>
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Codice</span>
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Natura</span>
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Origine</span>
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Stato</span>
                  <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Utilizzi</span>
                  <span className="text-right text-sm font-bold uppercase tracking-wide text-slate-500">Azioni</span>
                </div>
                <ul className="divide-y divide-[#EEF2F6]">
                  {cats.length === 0 ? (
                    <li className="px-4 py-3 text-base text-slate-500">Nessuna sottocategoria.</li>
                  ) : (
                    cats.map((c) => (
                      <li
                        key={c.id}
                        className="grid gap-3 px-4 py-3 text-[17px] xl:grid-cols-[42px_minmax(260px,1.45fr)_150px_150px_126px_120px_minmax(300px,1fr)_92px] xl:items-center"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#2F6DF6]"
                          disabled={
                            !canManage ||
                            (isProtectedCategory(c) && !canManageSystemCategories) ||
                            !!c.archived_at
                          }
                          checked={c.is_active}
                          onChange={(e) =>
                            patchCategory(c.id, {
                              is_active:
                                isProtectedCategory(c) && !canManageSystemCategories
                                  ? true
                                  : e.target.checked
                            })
                          }
                          title={
                            isProtectedCategory(c) && !canManageSystemCategories
                              ? 'QUOTE non può essere disattivata'
                              : undefined
                          }
                        />
                        <div className="min-w-0 xl:contents">
                          <div className="flex flex-wrap items-center gap-2 xl:contents">
                            <span className="min-w-0 truncate font-semibold text-[#1A2332] xl:col-start-2">{c.name}</span>
                            <span className="w-fit rounded-md bg-[#F0F4F8] px-1.5 py-0.5 font-mono text-sm font-semibold text-slate-600 xl:col-start-3">{c.code}</span>
                            <span className="text-base text-slate-500 xl:col-start-4">
                              {receivableNatureLabel(c.default_nature)}
                            </span>
                            <span
                              className={`w-fit rounded-full px-2 py-0.5 text-sm font-semibold xl:col-start-5 ${
                                !c.is_active || c.archived_at
                                  ? 'bg-slate-100 text-slate-500'
                                  : c.is_system
                                    ? 'bg-[#EAF2FF] text-[#2F6DF6]'
                                    : 'bg-[#F2EDFF] text-[#7758D9]'
                              }`}
                            >
                              {c.is_system ? 'Sistema' : 'Personalizzata'}
                            </span>
                            <span
                              className={`w-fit rounded-full px-2 py-0.5 text-sm font-semibold xl:col-start-6 ${
                                c.archived_at
                                  ? 'bg-[#FFF4E5] text-[#B46700]'
                                  : c.is_active
                                    ? 'bg-[#E6FAF3] text-[#0B9A6D]'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {c.archived_at ? 'Archiviata' : c.is_active ? 'Attiva' : 'Inattiva'}
                            </span>
                          </div>
                          <p className="hidden">
                            {[
                              c.available_in_movements ? 'Prima nota' : null,
                              c.available_in_budget ? 'Preventivo' : null,
                              c.available_in_reports ? 'Report' : null
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Nessun utilizzo'}
                          </p>
                          <div className="flex flex-wrap gap-1.5 text-sm text-slate-600 xl:col-start-7">
                            {(
                              [
                                ['available_in_movements', 'Prima nota'],
                                ['available_in_budget', 'Preventivo'],
                                ['available_in_reports', 'Report']
                              ] as const
                            ).map(([field, label]) => {
                              const highlighted = c[field] && c.is_active && !c.archived_at
                              return (
                              <label key={field} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold ${highlighted ? 'bg-[#EAF2FF] text-[#2F6DF6]' : 'bg-[#F4F6F8] text-slate-400'}`}>
                                <input
                                  type="checkbox"
                                  className={`h-3.5 w-3.5 rounded border-slate-300 ${highlighted ? 'accent-[#2F6DF6]' : 'accent-slate-400'}`}
                                  checked={c[field]}
                                  disabled={
                                    !canManage ||
                                    !!c.archived_at ||
                                    (isProtectedCategory(c) && !canManageSystemCategories)
                                  }
                                  onChange={(event) =>
                                    patchCategory(c.id, { [field]: event.target.checked })
                                  }
                                />
                                {label}
                              </label>
                              )
                            })}
                          </div>
                        </div>
                        {canManage && (!c.is_system || canManageSystemCategories) && (
                          <div className="flex items-center justify-end gap-1.5 xl:col-start-8">
                            {!c.archived_at && (
                              <button
                                type="button"
                                className="rounded-lg border border-[#D9E2EC] p-2 text-slate-600 transition hover:bg-slate-50"
                                onClick={() => setEditingCategory({ ...c })}
                                title="Modifica sottocategoria"
                                aria-label="Modifica sottocategoria"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {!c.is_system && (
                            <button
                              type="button"
                              className={`rounded-lg border p-2 transition ${c.archived_at ? 'border-[#BFEEDC] text-[#0B9A6D] hover:bg-[#E6FAF3]' : 'border-[#F5D3D3] text-[#D14F4F] hover:bg-[#FFF1F1]'}`}
                              onClick={() => {
                                if (c.archived_at) {
                                  void updateCategory({ id: c.id, archive: false })
                                    .then(() => {
                                      toast.success('Categoria ripristinata')
                                      return load()
                                    })
                                    .catch((err) =>
                                      toast.error(
                                        err instanceof Error ? err.message : 'Ripristino non riuscito'
                                      )
                                    )
                                } else {
                                  void handleCategoryArchive(c)
                                }
                              }}
                              title={c.archived_at ? 'Ripristina sottocategoria' : 'Archivia sottocategoria'}
                              aria-label={c.archived_at ? 'Ripristina sottocategoria' : 'Archivia sottocategoria'}
                            >
                              {c.archived_at ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                            </button>
                            )}
                          </div>
                        )}
                      </li>
                    ))
                  )}
                </ul>
                </>
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
                className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={groupForm.isActive}
                  onChange={(event) =>
                    setGroupForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                Macro-categoria attiva
              </label>
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
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
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
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
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

      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Modifica macro-categoria</h3>
            <p className="mt-1 text-xs text-slate-500">Codice e tipo restano invariati.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={editingGroup.name}
                  onChange={(event) =>
                    setEditingGroup((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Descrizione</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  value={editingGroup.description ?? ''}
                  onChange={(event) =>
                    setEditingGroup((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingGroup.is_active}
                  onChange={(event) =>
                    setEditingGroup((current) =>
                      current ? { ...current, is_active: event.target.checked } : current
                    )
                  }
                />
                Macro-categoria attiva
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setEditingGroup(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const group = editingGroup
                  void updateCategoryGroup({
                    id: group.id,
                    name: group.name,
                    description: group.description,
                    isActive: group.is_active
                  })
                    .then(() => {
                      toast.success('Macro-categoria aggiornata')
                      setEditingGroup(null)
                      return load()
                    })
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Aggiornamento non riuscito')
                    )
                }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Modifica sottocategoria</h3>
            <p className="mt-1 text-xs text-slate-500">Codice e direzione restano invariati.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={editingCategory.name}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Macro-categoria</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={editingCategory.group_id ?? ''}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current ? { ...current, group_id: event.target.value || null } : current
                    )
                  }
                >
                  {groups
                    .filter(
                      (group) =>
                        group.direction === editingCategory.direction && !group.archived_at
                    )
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Natura</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={editingCategory.default_nature}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current
                        ? {
                            ...current,
                            default_nature: event.target.value as ReceivableNature
                          }
                        : current
                    )
                  }
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
                  checked={editingCategory.include_in_commercial_limit}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current
                        ? {
                            ...current,
                            include_in_commercial_limit: event.target.checked
                          }
                        : current
                    )
                  }
                />
                Inclusione nel limite commerciale
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingCategory.is_active}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current ? { ...current, is_active: event.target.checked } : current
                    )
                  }
                />
                Sottocategoria attiva
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingCategory.available_in_movements}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current
                        ? { ...current, available_in_movements: event.target.checked }
                        : current
                    )
                  }
                />
                Disponibile in Prima nota
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingCategory.available_in_budget}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current ? { ...current, available_in_budget: event.target.checked } : current
                    )
                  }
                />
                Disponibile nel Preventivo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingCategory.available_in_reports}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current ? { ...current, available_in_reports: event.target.checked } : current
                    )
                  }
                />
                Disponibile nei Report/Consuntivo
              </label>
              <div>
                <label className="text-xs font-medium text-slate-600">Note</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  value={editingCategory.notes ?? ''}
                  onChange={(event) =>
                    setEditingCategory((current) =>
                      current ? { ...current, notes: event.target.value } : current
                    )
                  }
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setEditingCategory(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const category = editingCategory
                  void updateCategory({
                    id: category.id,
                    name: category.name,
                    notes: category.notes,
                    defaultNature: category.default_nature,
                    includeInCommercialLimit: category.include_in_commercial_limit,
                    availableInMovements: category.available_in_movements,
                    availableInBudget: category.available_in_budget,
                    availableInReports: category.available_in_reports,
                    isActive: category.is_active,
                    groupId: category.group_id
                  })
                    .then(() => {
                      toast.success('Categoria aggiornata')
                      setEditingCategory(null)
                      return load()
                    })
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Aggiornamento non riuscito')
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
      <GoleeConfirmModal
        open={confirmModalProps.open}
        title={confirmModalProps.title}
        message={confirmModalProps.message}
        confirmLabel={confirmModalProps.confirmLabel}
        cancelLabel={confirmModalProps.cancelLabel}
        variant={confirmModalProps.variant}
        confirming={confirmingAction}
        confirmingLabel="Attendere…"
        onCancel={closePendingConfirm}
        onConfirm={() => {
          void runPendingConfirm()
        }}
      />
    </>
  )
}
