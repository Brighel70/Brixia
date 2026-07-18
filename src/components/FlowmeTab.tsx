import React, { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import PlayerSelectionModal from './PlayerSelectionModal'
import WhatsAppOpenModal from './WhatsAppOpenModal'
import { getBrandConfig } from '@/config/brand'

const DEFAULT_TEMPLATE_FLOWME = `Ciao [nome dell'anagrafica],

ti diamo il benvenuto in FlowMe, l'app mobile del Brixia Rugby che ti permetterà di essere sempre in contatto con noi, essere sempre aggiornato su tutto quanto ti riguarda.

Per accedere sarà sufficiente la tua email personale che ci hai fornito ed il seguente codice univoco:
[mettere il codice generato in FlowMe]

Ecco il link per accedervi: [flowme_app_url]

Staff FlowMe
Brixia Rugby`

const DEFAULT_TEMPLATE_TEAMFLOW = `Ciao [Nome],

ti diamo il benvenuto in TeamFlow, la webapp ufficiale del Brixia Rugby.
Grazie a TeamFlow potrai restare sempre in contatto con noi e ricevere aggiornamenti su tutte le informazioni che ti riguardano.

Per accedere ti basterà utilizzare la tua email personale che ci hai fornito e il seguente codice univoco:

[Codice]

A presto!

Staff TeamFlow
Brixia Rugby`

/** Sezioni in base al ruolo (e alle squadre assegnate). Usata per Flowme e TeamFlow. */
function getDefaultSectionsForRole (appRole: string, staffCategories: string[]): string[] {
  const hasSquad = Array.isArray(staffCategories) && staffCategories.length > 0
  switch (appRole) {
    case 'admin':
      // Admin ha sempre accesso a TUTTE le sezioni
      return ['staff', 'medico', 'player', 'family', 'segreteria', 'finanziario', 'team-manager']
    case 'direttore-tecnico':
      return ['staff', 'medico']
    case 'familiare':
    case 'tutor':
      return ['family']
    case 'direttore-sportivo':
      return ['staff', 'medico']
    case 'allenatore':
      return ['staff', 'medico']
    case 'preparatore':
      return hasSquad ? ['staff', 'medico'] : ['medico']
    case 'team-manager':
      return ['staff', 'medico', 'player']
    case 'accompagnatore':
      return hasSquad ? ['staff'] : []
    case 'medico':
    case 'fisio':
      return ['medico']
    case 'giocatore':
      return ['player']
    default:
      return []
  }
}

const ROLE_NAME_TO_ID: Record<string, string> = {
  'Admin': 'admin',
  'Team Manager': 'team-manager',
  'Allenatore': 'allenatore',
  'Accompagnatore': 'accompagnatore',
  'Direttore Sportivo': 'direttore-sportivo',
  'Direttore Tecnico': 'direttore-tecnico',
  'Preparatore Atletico': 'preparatore',
  'Tutor': 'tutor',
  'Familiare': 'familiare',
  'Medico': 'medico',
  'Fisioterapista': 'fisio',
  'Fisio': 'fisio',
  'Giocatore': 'giocatore',
  'Segreteria': 'segreteria',
  'Dirigente': 'dirigente'
}

/** Risolve roleId (può essere id tipo 'team-manager' o UUID) al id usato in getDefaultSectionsForRole. */
function resolveRoleId (roleId: string, availableRoles: { id: string; name: string }[]): string {
  const known = ['admin', 'team-manager', 'allenatore', 'accompagnatore', 'direttore-sportivo', 'direttore-tecnico', 'preparatore', 'tutor', 'familiare', 'medico', 'fisio', 'giocatore', 'segreteria', 'dirigente']
  if (known.includes(roleId)) return roleId
  const r = availableRoles.find((ro: { id: string; name: string }) => ro.id === roleId)
  return (r && ROLE_NAME_TO_ID[r.name]) ? ROLE_NAME_TO_ID[r.name] : roleId
}

/** Unione delle sezioni di default per ruolo principale + ruoli aggiuntivi (per non sovrascrivere con solo il ruolo principale). */
function getMergedDefaultSections (
  appRole: string,
  additionalRoleIds: string[],
  staffCategories: string[],
  availableRoles: { id: string; name: string }[]
): string[] {
  const resolvedMain = resolveRoleId(appRole, availableRoles)
  if (resolvedMain === 'familiare') return ['family']
  const roleIds = [appRole, ...(additionalRoleIds || [])].filter(Boolean)
  const seen = new Set<string>()
  for (const roleId of roleIds) {
    const resolved = resolveRoleId(roleId, availableRoles)
    const sections = getDefaultSectionsForRole(resolved, staffCategories)
    sections.forEach((s: string) => seen.add(s))
  }
  return Array.from(seen)
}

const SECTION_OPTIONS = [
  { id: 'staff', label: 'Staff' },
  { id: 'medico', label: 'Medico' },
  { id: 'player', label: 'Player' },
  { id: 'family', label: 'Family' },
  { id: 'segreteria', label: 'Segreteria' },
  { id: 'finanziario', label: 'Finanziario' },
  { id: 'team-manager', label: 'Team Manager' }
]

/** Opzioni per il tipo di rapporto tutor–minorenne (Padre, Mamma, ecc.) */
export const TUTOR_RELATIONSHIP_OPTIONS = [
  'Padre',
  'Mamma',
  'Nonno',
  'Nonna',
  'Tutore',
  'Fratello/Sorella',
  'Altro'
]

interface FlowmeTabProps {
  form: any
  handleInputChange: (field: string, value: string | boolean | string[] | { athlete_id: string; relationship: string }[]) => void
  isFieldDisabled: () => boolean
  availableRoles?: any[]
  onPlayerSelection?: (selectedPlayerIds: string[]) => void
  /** Tutte le categorie (squadre) per assegnare tutte le squadre all'admin di default */
  allCategories?: { id: string }[]
  /** Se fornito, per i tutor si mostra solo un messaggio + "Vai al tab Tutor" invece della lista/minor modal (gestione minorenni unificata nel tab Tutor) */
  onGoToTutorTab?: () => void
}

const FlowmeTab: React.FC<FlowmeTabProps> = ({
  form,
  handleInputChange,
  isFieldDisabled,
  availableRoles = [],
  onPlayerSelection,
  allCategories = [],
  onGoToTutorTab
}) => {
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [showTutorMinorsModal, setShowTutorMinorsModal] = useState(false)
  const [whatsAppModal, setWhatsAppModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' })
  const [tutorLinkedNames, setTutorLinkedNames] = useState<{ id: string; name: string }[]>([])
  const [innerTab, setInnerTab] = useState<'flowme' | 'teamflow'>('flowme')
  const allCategoryIds = allCategories.map((c: { id: string }) => c.id).filter(Boolean)

  const getRoleName = (roleId: string) => availableRoles.find((r: { id: string; name: string }) => r.id === roleId)?.name || ''
  const getCategoryLabel = (cat: { id: string; code?: string; name?: string }) => {
    const raw = cat.code || cat.name || cat.id
    return (typeof raw === 'string' && raw.toUpperCase() === 'SENIOR') ? 'SENIORES' : raw
  }
  const ROLE_IDS_WITH_CATEGORIES = ['admin', 'team-manager', 'allenatore', 'accompagnatore', 'direttore-sportivo', 'direttore-tecnico', 'preparatore']
  const ROLE_NAMES_WITH_CATEGORIES = ['Admin', 'Team Manager', 'Allenatore', 'Accompagnatore', 'Direttore Sportivo', 'Direttore Tecnico', 'Preparatore Atletico']
  const roleHasCategories = (roleId: string) => ROLE_IDS_WITH_CATEGORIES.includes(roleId) || ROLE_NAMES_WITH_CATEGORIES.includes(getRoleName(roleId))
  const hasRoleWithCategoriesFlowme = roleHasCategories(form.app_role || '') || (form.additional_roles || []).some((rid: string) => roleHasCategories(rid))
  const hasRoleWithCategoriesTeamFlow = roleHasCategories(form.teamflow_app_role || '') || (form.teamflow_additional_roles || []).some((rid: string) => roleHasCategories(rid))
  const isGiocatoreFlowme = getRoleName(form.app_role || '') === 'Giocatore' || (form.additional_roles || []).some((rid: string) => getRoleName(rid) === 'Giocatore')
  const isGiocatoreTeamFlow = getRoleName(form.teamflow_app_role || '') === 'Giocatore' || (form.teamflow_additional_roles || []).some((rid: string) => getRoleName(rid) === 'Giocatore')

  const isTutorFlowme = form.app_role === 'tutor' || (form.additional_roles || []).some((rid: string) => rid === 'tutor' || getRoleName(rid) === 'Tutor')
  const isTutorTeamFlow = form.teamflow_app_role === 'tutor' || (form.teamflow_additional_roles || []).some((rid: string) => rid === 'tutor' || getRoleName(rid) === 'Tutor')
  const isTutorInCurrentTab = innerTab === 'flowme' ? isTutorFlowme : isTutorTeamFlow

  const tutorRelationList = (form.tutor_athlete_relations?.length ? form.tutor_athlete_relations : (form.tutor_athlete_ids || []).map((aid: string) => ({ athlete_id: aid, relationship: 'Tutore' }))) as { athlete_id: string; relationship: string }[]

  useEffect(() => {
    const ids = tutorRelationList.map((r) => r.athlete_id)
    if (ids.length === 0) {
      setTutorLinkedNames([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('people').select('id, given_name, family_name').in('id', ids)
      if (cancelled) return
      setTutorLinkedNames((data || []).map((p: { id: string; given_name?: string; family_name?: string }) => ({
        id: p.id,
        name: [p.given_name, p.family_name].filter(Boolean).join(' ') || p.id
      })))
    })()
    return () => { cancelled = true }
  }, [form.tutor_athlete_ids?.join(','), form.tutor_athlete_relations?.map((r: { athlete_id: string }) => r.athlete_id).join(',')])

  const tutorLinkedList = tutorRelationList.map((rel) => ({
    athlete_id: rel.athlete_id,
    relationship: rel.relationship || 'Tutore',
    name: tutorLinkedNames.find((n) => n.id === rel.athlete_id)?.name || rel.athlete_id
  }))

  const brandConfig = getBrandConfig()
  const clubName = brandConfig.clubName || 'Brixia Rugby'

  const handleWhatsAppSend = async (isFlowme: boolean) => {
    const phone = (form.phone || '').trim()
    if (!phone) {
      alert('La persona non ha un numero di cellulare nella scheda. Aggiungi il telefono in Informazioni Personali.')
      return
    }
    const code = isFlowme ? (form.invite_code || '') : (form.invite_code_teamflow || '')
    if (!code) return

    let content = ''
    try {
      const { data: templates } = await supabase
        .from('message_templates')
        .select('name, content')
        .eq('type', 'whatsapp')
        .ilike('name', '%Accesso%')

      const searchTerm = isFlowme ? 'flowme' : 'teamflow'
      const found = (templates || []).find(t => (t.name || '').toLowerCase().includes(searchTerm))
      content = found?.content || (isFlowme ? DEFAULT_TEMPLATE_FLOWME : DEFAULT_TEMPLATE_TEAMFLOW)
    } catch {
      content = isFlowme ? DEFAULT_TEMPLATE_FLOWME : DEFAULT_TEMPLATE_TEAMFLOW
    }

    const nome = (form.given_name || '').trim() || 'Nome'
    const flowmeUrl = brandConfig.contact?.flowmeAppUrl || 'https://flowme-lemon.vercel.app/login'
    const msg = content
      .replace(/\[Nome\]/g, nome)
      .replace(/\[nome dell'anagrafica\]/gi, nome)
      .replace(/\[Inserire il codice generato in FlowMe\]/gi, code)
      .replace(/\[mettere il codice generato in FlowMe\]/gi, code)
      .replace(/\[Inserire il codice generato in TeamFlow\]/gi, code)
      .replace(/\[mettere il codice generato in TeamFlow\]/gi, code)
      .replace(/\[Codice\]/g, code)
      .replace(/\[flowme_app_url\]/gi, flowmeUrl)
      .replace(/Brixia Rugby/g, clubName)

    const digits = String(phone).replace(/\D/g, '')
    const whatsappNumber = digits.startsWith('39') ? digits : (digits.startsWith('0') ? '39' + digits.slice(1) : '39' + digits)
    const url = `whatsapp://send?phone=${whatsappNumber}&text=${encodeURIComponent(msg)}`
    setWhatsAppModal({ open: true, url })
  }

  // Admin: seleziona tutte le categorie (squadre) quando il ruolo è Admin
  useEffect(() => {
    if (getRoleName(form.app_role || '') !== 'Admin' || allCategoryIds.length === 0) return
    handleInputChange('staff_categories', [...allCategoryIds])
  }, [form.app_role, allCategoryIds.length])

  // Auto-flag sezioni Flowme solo quando ruolo o categorie cambiano (non sovrascrivere le scelte manuali o quelle caricate dal DB)
  const flowmeRoleKeyRef = useRef<string>('')
  useEffect(() => {
    const role = form.app_role || ''
    const additionalIds = form.additional_roles || []
    const staffCats = form.staff_categories || []
    const key = `${role}|${[...additionalIds].sort().join(',')}|${staffCats.slice().sort().join(',')}`
    const computed = getMergedDefaultSections(role, additionalIds, staffCats, availableRoles)
    const resolvedMain = resolveRoleId(role, availableRoles)
    // Admin deve avere sempre tutte le sezioni (incluso team-manager): forza l'aggiornamento
    if (resolvedMain === 'admin') {
      const current = form.flowme_sections || []
      const missing = computed.filter((s: string) => !current.includes(s))
      if (missing.length > 0) {
        handleInputChange('flowme_sections', [...new Set([...current, ...computed])])
      }
      flowmeRoleKeyRef.current = key
      return
    }
    // Se abbiamo già sezioni (es. caricate dal DB in modifica), non sovrascrivere al primo render
    if (flowmeRoleKeyRef.current === '' && (form.flowme_sections?.length ?? 0) > 0) {
      flowmeRoleKeyRef.current = key
      return
    }
    if (flowmeRoleKeyRef.current !== key) {
      flowmeRoleKeyRef.current = key
      handleInputChange('flowme_sections', computed)
    }
  }, [form.app_role, form.additional_roles, form.staff_categories, form.flowme_sections])

  // TeamFlow Admin: seleziona tutte le categorie quando il ruolo è Admin
  useEffect(() => {
    if (getRoleName(form.teamflow_app_role || '') !== 'Admin' || allCategoryIds.length === 0) return
    handleInputChange('teamflow_staff_categories', [...allCategoryIds])
  }, [form.teamflow_app_role, allCategoryIds.length])

  // Auto-flag sezioni TeamFlow solo quando ruolo o categorie cambiano (non sovrascrivere le scelte manuali o quelle caricate dal DB)
  const teamflowRoleKeyRef = useRef<string>('')
  useEffect(() => {
    const role = form.teamflow_app_role || ''
    const additionalIds = form.teamflow_additional_roles || []
    const staffCats = form.teamflow_staff_categories || []
    const key = `${role}|${[...additionalIds].sort().join(',')}|${staffCats.slice().sort().join(',')}`
    const computed = getMergedDefaultSections(role, additionalIds, staffCats, availableRoles)
    const resolvedMain = resolveRoleId(role, availableRoles)
    // Admin deve avere sempre tutte le sezioni (incluso team-manager): forza l'aggiornamento
    if (resolvedMain === 'admin') {
      const current = form.teamflow_sections || []
      const missing = computed.filter((s: string) => !current.includes(s))
      if (missing.length > 0) {
        handleInputChange('teamflow_sections', [...new Set([...current, ...computed])])
      }
      teamflowRoleKeyRef.current = key
      return
    }
    // Se abbiamo già sezioni (es. caricate dal DB in modifica), non sovrascrivere al primo render
    if (teamflowRoleKeyRef.current === '' && (form.teamflow_sections?.length ?? 0) > 0) {
      teamflowRoleKeyRef.current = key
      return
    }
    if (teamflowRoleKeyRef.current !== key) {
      teamflowRoleKeyRef.current = key
      handleInputChange('teamflow_sections', computed)
    }
  }, [form.teamflow_app_role, form.teamflow_additional_roles, form.teamflow_staff_categories, form.teamflow_sections])

  const handleRoleChange = (value: string) => {
    handleInputChange('app_role', value)
    if (getRoleName(value) === 'Admin' && allCategoryIds.length > 0) {
      handleInputChange('staff_categories', [...allCategoryIds])
    }
    if (value === 'familiare') {
      setShowPlayerModal(true)
    }
  }

  const handleTeamflowRoleChange = (value: string) => {
    handleInputChange('teamflow_app_role', value)
    if (getRoleName(value) === 'Admin' && allCategoryIds.length > 0) {
      handleInputChange('teamflow_staff_categories', [...allCategoryIds])
    }
  }

  const handlePlayerSelection = (selectedPlayerIds: string[]) => {
    if (onPlayerSelection) {
      onPlayerSelection(selectedPlayerIds)
    }
    setShowPlayerModal(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <span>📱</span>
          {innerTab === 'flowme' ? 'Flowme' : 'TeamFlow'} – Accesso e sezioni
        </h3>

        {/* Due tag piatti: Flowme | TeamFlow */}
        <div className="flex border-b border-blue-200 mb-6">
          <button
            type="button"
            onClick={() => setInnerTab('flowme')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              innerTab === 'flowme'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-blue-600'
            }`}
          >
            Flowme
          </button>
          <button
            type="button"
            onClick={() => setInnerTab('teamflow')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              innerTab === 'teamflow'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-600 hover:text-blue-600'
            }`}
          >
            TeamFlow
          </button>
        </div>

        {/* Contenuto Flowme */}
        <div className={innerTab === 'flowme' ? 'block' : 'hidden'}>
          <p className="text-xs text-blue-600 mb-4">
            Ruolo, codice invito e sezioni visibili nell&apos;app mobile Flowme.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">Ruolo nell&apos;App <span className="text-red-500">*</span></label>
              <select
                value={form.app_role || ''}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={isFieldDisabled()}
                className="w-full px-3 py-2.5 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200 bg-white text-gray-900"
              >
                <option value="">Seleziona ruolo</option>
                {availableRoles.map((role: { id: string; name: string }) => (
                  <option key={role.id} value={role.id} className="bg-white text-gray-900">{role.name}</option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-1">
                {form.app_role === 'familiare'
                  ? 'Le sezioni sotto si aggiornano in base al ruolo. Il ruolo Familiare non è Staff: serve per collegare questa persona a uno o più giocatori.'
                  : 'Le sezioni sotto si aggiornano in automatico in base al ruolo (e alle squadre assegnate nella scheda Staff).'}
              </p>
              {form.app_role === 'familiare' && (
                <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <strong>Per collegare questa persona a uno o più giocatori:</strong> vai al tab <strong>Famigliare</strong> (accanto a Documenti) e clicca «Nuovo collegamento» per aggiungere i giocatori.
                </p>
              )}
            </div>
            {form.app_role && (
              <div>
                <label className="block text-sm font-medium text-blue-800 mb-2">Ruoli Aggiuntivi</label>
                <select
                  value={form.additional_roles?.[0] || ''}
                  onChange={(e) => {
                    const selectedRole = e.target.value
                    handleInputChange('additional_roles', selectedRole ? [selectedRole] : [])
                  }}
                  disabled={isFieldDisabled()}
                  className="w-full px-3 py-2.5 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="">Seleziona ruolo aggiuntivo</option>
                  {availableRoles
                    .filter((role: { id: string }) => role.id !== form.app_role)
                    .map((role: { id: string; name: string }) => (
                      <option key={role.id} value={role.id} className="bg-white text-gray-900">{role.name}</option>
                    ))}
                </select>
                <p className="text-xs text-blue-600 mt-1">Seleziona un ruolo aggiuntivo (es: Giocatore + Allenatore)</p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-blue-800 mb-2">Codice accesso Flowme</label>
            <div className="space-y-3">
              <label className="flex items-center group">
                <input
                  type="checkbox"
                  checked={form.generate_invite_code || false}
                  onChange={(e) => {
                    const isChecked = e.target.checked
                    handleInputChange('generate_invite_code', isChecked)
                    if (isChecked && !form.invite_code) {
                      const generateCode = () => {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
                        let result = ''
                        for (let i = 0; i < 12; i++) {
                          result += chars.charAt(Math.floor(Math.random() * chars.length))
                        }
                        return result
                      }
                      handleInputChange('invite_code', generateCode())
                    }
                    if (!isChecked) handleInputChange('invite_code', '')
                  }}
                  disabled={isFieldDisabled()}
                  className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                    form.generate_invite_code ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 bg-white'
                  } ${isFieldDisabled() ? 'cursor-default' : 'cursor-pointer'}`}
                />
                <span className={`ml-3 text-sm font-medium transition-colors duration-200 ${
                  form.generate_invite_code ? 'text-blue-600 font-semibold' : 'text-gray-700'
                } ${isFieldDisabled() ? '' : 'group-hover:text-blue-600'}`}>
                  Genera codice per registrazione nell&apos;app Flowme
                </span>
              </label>
              {form.generate_invite_code && (
                <div className="space-y-3">
                  {!form.invite_code ? (
                    <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        ✅ Verrà generato un codice univoco per registrarsi nell&apos;app Flowme con i permessi assegnati.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-green-800">Codice Flowme</h4>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleWhatsAppSend(true)}
                            title="Invia messaggio WhatsApp con codice"
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Invia WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(form.invite_code)
                              alert('Codice copiato negli appunti!')
                            }}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
                          >📋 Copia</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Rigenerare il codice Flowme? Il vecchio codice non funzionerà più.')) {
                                handleInputChange('invite_code', '')
                                handleInputChange('generate_invite_code', true)
                              }
                            }}
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded transition-colors"
                          >🔄 Rigenera</button>
                        </div>
                      </div>
                      <div className="bg-white border border-green-200 rounded p-2 font-mono text-sm text-gray-800 break-all">{form.invite_code}</div>
                      <p className="text-xs text-green-700 mt-2">💡 Condividi questo codice per la registrazione nell&apos;app Flowme</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-blue-800 mb-2">Permessi nell&apos;app Flowme (cosa può vedere)</label>
            <p className="text-xs text-blue-700/80 mb-3">
              Qui gestisci solo l&apos;accesso mobile. Chi è la persona (Allenatore, Giocatore, categorie squadra) si classifica nei tab <strong>Staff</strong> e <strong>Giocatore</strong>.
            </p>
            <div className="space-y-3">
              <label className="flex items-center group">
                <input
                  type="checkbox"
                  checked={form.flowme_access_blocked || false}
                  onChange={(e) => handleInputChange('flowme_access_blocked', e.target.checked)}
                  disabled={isFieldDisabled()}
                  className="w-5 h-5 rounded border-2 border-gray-300"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">Blocca accesso app (es. ex giocatore)</span>
              </label>
              <p className="text-xs text-gray-500">Se attivo, la persona non potrà più entrare nell&apos;app Flowme anche con codice valido.</p>
              <div className="pt-2">
                <span className="block text-sm font-medium text-gray-700 mb-2">Sezioni visibili nell&apos;app Flowme</span>
                <p className="text-xs text-gray-500 mb-2">
                  Seleziona le sezioni che questa persona potrà aprire dall&apos;app. Se ne scegli una sola, si aprirà direttamente; se più di una, vedrà dei riquadri per scegliere.
                </p>
                <div className="flex flex-wrap gap-3">
                  {SECTION_OPTIONS.map(({ id, label }) => {
                    const sections = form.flowme_sections || []
                    const checked = sections.includes(id)
                    return (
                      <label key={id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const newSections = checked ? sections.filter((s: string) => s !== id) : [...sections, id]
                            handleInputChange('flowme_sections', newSections)
                          }}
                          disabled={isFieldDisabled()}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              {(hasRoleWithCategoriesFlowme && allCategories.length > 0) && (
                <div className="mt-6 pt-4 border-t border-blue-200">
                  <span className="block text-sm font-medium text-gray-700 mb-2">
                    {getRoleName(form.app_role) === 'Admin'
                      ? "Categorie (squadre) visibili nell'app Flowme"
                      : 'Categorie staff (sincronizzate col tab Staff)'}
                  </span>
                  <p className="text-xs text-gray-500 mb-2">
                    {getRoleName(form.app_role) === 'Admin'
                      ? "Sulla web app hai sempre accesso a tutte le categorie. Qui scegli quali squadre questa persona vedrà nell'app mobile Flowme."
                      : 'Stesse categorie del tab Staff in anagrafica: servono per Incontro Staff e per l’abbinamento squadre. Modificarle qui aggiorna anche il tab Staff.'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {allCategories.map((cat: { id: string; code?: string; name?: string }) => {
                      const staffCats = form.staff_categories || []
                      const checked = staffCats.includes(cat.id)
                      return (
                        <label key={cat.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const newCats = checked ? staffCats.filter((id: string) => id !== cat.id) : [...staffCats, cat.id]
                              handleInputChange('staff_categories', newCats)
                            }}
                            disabled={isFieldDisabled()}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{getCategoryLabel(cat)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {isGiocatoreFlowme && allCategories.length > 0 && (
                <div className="mt-6 pt-4 border-t border-blue-200">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Categorie giocatore (sincronizzate col tab Giocatore)</span>
                  <p className="text-xs text-gray-500 mb-2">
                    Stesse categorie del tab Giocatore: non influiscono sulle colonne Coach di Incontro Staff.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {allCategories.map((cat: { id: string; code?: string; name?: string }) => {
                      const playerCats = form.player_categories || []
                      const checked = playerCats.includes(cat.id)
                      return (
                        <label key={cat.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const newCats = checked ? playerCats.filter((id: string) => id !== cat.id) : [...playerCats, cat.id]
                              handleInputChange('player_categories', newCats)
                            }}
                            disabled={isFieldDisabled()}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{getCategoryLabel(cat)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {isTutorFlowme && (
                <div className="mt-6 pt-4 border-t border-blue-200">
                  {onGoToTutorTab ? (
                    <>
                      <span className="block text-sm font-medium text-gray-700 mb-2">Giocatori minorenni (tutor)</span>
                      <p className="text-xs text-gray-500 mb-2">L&apos;abbinamento ai giocatori minorenni e il tipo di rapporto (Padre, Mamma, ecc.) si gestiscono nel tab <strong>Tutor</strong> di questa scheda.</p>
                      <button type="button" onClick={onGoToTutorTab} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        Vai al tab Tutor
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-medium text-gray-700 mb-2">Giocatori minorenni a cui è abbinato come tutor</span>
                      <p className="text-xs text-gray-500 mb-2">Un adulto può essere tutor di uno o più minorenni. Seleziona i giocatori e indica il rapporto (es. Padre, Mamma, Nonno).</p>
                      {tutorLinkedList.length > 0 && (
                        <ul className="space-y-2 mb-3">
                          {tutorLinkedList.map((item) => (
                            <li key={item.athlete_id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-gray-800">{item.name}</span>
                              <span className="text-gray-500">—</span>
                              <select
                                value={item.relationship}
                                onChange={(e) => {
                                  const next = tutorRelationList.map((r) =>
                                    r.athlete_id === item.athlete_id ? { athlete_id: r.athlete_id, relationship: e.target.value } : { athlete_id: r.athlete_id, relationship: r.relationship }
                                  )
                                  handleInputChange('tutor_athlete_relations', next)
                                  handleInputChange('tutor_athlete_ids', next.map((x) => x.athlete_id))
                                }}
                                disabled={isFieldDisabled()}
                                className="border border-gray-300 rounded px-2 py-1 text-gray-700"
                              >
                                {TUTOR_RELATIONSHIP_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button type="button" onClick={() => setShowTutorMinorsModal(true)} disabled={isFieldDisabled()} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {tutorLinkedList.length ? 'Modifica giocatori abbinati' : 'Aggiungi giocatori minorenni'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contenuto TeamFlow */}
        <div className={innerTab === 'teamflow' ? 'block' : 'hidden'}>
          <p className="text-xs text-blue-600 mb-4">
            Ruolo e sezioni visibili nella webapp TeamFlow. Le stesse opzioni saranno abbinate alle voci della webapp in seguito.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">Ruolo nella webapp <span className="text-red-500">*</span></label>
              <select
                value={form.teamflow_app_role || ''}
                onChange={(e) => handleTeamflowRoleChange(e.target.value)}
                disabled={isFieldDisabled()}
                className="w-full px-3 py-2.5 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200 bg-white text-gray-900"
              >
                <option value="">Seleziona ruolo</option>
                {availableRoles.map((role: { id: string; name: string }) => (
                  <option key={role.id} value={role.id} className="bg-white text-gray-900">{role.name}</option>
                ))}
              </select>
              <p className="text-xs text-blue-600 mt-1">
                Le sezioni sotto si aggiornano in automatico in base al ruolo (e alle squadre assegnate qui sotto per admin).
              </p>
            </div>
            {form.teamflow_app_role && (
              <div>
                <label className="block text-sm font-medium text-blue-800 mb-2">Ruoli Aggiuntivi</label>
                <select
                  value={form.teamflow_additional_roles?.[0] || ''}
                  onChange={(e) => {
                    const selectedRole = e.target.value
                    handleInputChange('teamflow_additional_roles', selectedRole ? [selectedRole] : [])
                  }}
                  disabled={isFieldDisabled()}
                  className="w-full px-3 py-2.5 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="">Seleziona ruolo aggiuntivo</option>
                  {availableRoles
                    .filter((role: { id: string }) => role.id !== form.teamflow_app_role)
                    .map((role: { id: string; name: string }) => (
                      <option key={role.id} value={role.id} className="bg-white text-gray-900">{role.name}</option>
                    ))}
                </select>
                <p className="text-xs text-blue-600 mt-1">Seleziona un ruolo aggiuntivo (es: Giocatore + Allenatore)</p>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-blue-800 mb-2">Codice accesso TeamFlow</label>
            <div className="space-y-3">
              <label className="flex items-center group">
                <input
                  type="checkbox"
                  checked={form.generate_invite_code_teamflow || false}
                  onChange={(e) => {
                    const isChecked = e.target.checked
                    handleInputChange('generate_invite_code_teamflow', isChecked)
                    if (isChecked && !form.invite_code_teamflow) {
                      const generateCode = () => {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
                        let result = ''
                        for (let i = 0; i < 12; i++) {
                          result += chars.charAt(Math.floor(Math.random() * chars.length))
                        }
                        return result
                      }
                      handleInputChange('invite_code_teamflow', generateCode())
                    }
                    if (!isChecked) handleInputChange('invite_code_teamflow', '')
                  }}
                  disabled={isFieldDisabled()}
                  className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                    form.generate_invite_code_teamflow ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 bg-white'
                  } ${isFieldDisabled() ? 'cursor-default' : 'cursor-pointer'}`}
                />
                <span className={`ml-3 text-sm font-medium transition-colors duration-200 ${
                  form.generate_invite_code_teamflow ? 'text-blue-600 font-semibold' : 'text-gray-700'
                } ${isFieldDisabled() ? '' : 'group-hover:text-blue-600'}`}>
                  Genera codice per registrazione nella webapp TeamFlow
                </span>
              </label>
              {form.generate_invite_code_teamflow && (
                <div className="space-y-3">
                  {!form.invite_code_teamflow ? (
                    <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        ✅ Verrà generato un codice univoco per registrarsi nella webapp TeamFlow con i permessi assegnati.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-green-800">Codice TeamFlow</h4>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleWhatsAppSend(false)}
                            title="Invia messaggio WhatsApp con codice"
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Invia WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(form.invite_code_teamflow)
                              alert('Codice copiato negli appunti!')
                            }}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
                          >📋 Copia</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Rigenerare il codice TeamFlow? Il vecchio codice non funzionerà più.')) {
                                handleInputChange('invite_code_teamflow', '')
                                handleInputChange('generate_invite_code_teamflow', true)
                              }
                            }}
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded transition-colors"
                          >🔄 Rigenera</button>
                        </div>
                      </div>
                      <div className="bg-white border border-green-200 rounded p-2 font-mono text-sm text-gray-800 break-all">{form.invite_code_teamflow}</div>
                      <p className="text-xs text-green-700 mt-2">💡 Condividi questo codice per la registrazione nella webapp TeamFlow</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-blue-800 mb-2">Permessi nella webapp TeamFlow (cosa può vedere)</label>
            <p className="text-xs text-blue-700/80 mb-3">
              Qui gestisci solo l&apos;accesso web. La classificazione anagrafica resta nei tab Staff e Giocatore.
            </p>
            <div className="space-y-3">
              <label className="flex items-center group">
                <input
                  type="checkbox"
                  checked={form.teamflow_access_blocked || false}
                  onChange={(e) => handleInputChange('teamflow_access_blocked', e.target.checked)}
                  disabled={isFieldDisabled()}
                  className="w-5 h-5 rounded border-2 border-gray-300"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">Blocca accesso webapp (es. ex giocatore)</span>
              </label>
              <p className="text-xs text-gray-500">Se attivo, la persona non potrà più accedere alla webapp TeamFlow.</p>
              <div className="pt-2">
                <span className="block text-sm font-medium text-gray-700 mb-2">Sezioni visibili nella webapp TeamFlow</span>
                <p className="text-xs text-gray-500 mb-2">
                  Seleziona le sezioni che questa persona potrà vedere nella webapp. In seguito abbiniamo queste voci alle sezioni reali della webapp.
                </p>
                <div className="flex flex-wrap gap-3">
                  {SECTION_OPTIONS.map(({ id, label }) => {
                    const sections = form.teamflow_sections || []
                    const checked = sections.includes(id)
                    return (
                      <label key={id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const newSections = checked ? sections.filter((s: string) => s !== id) : [...sections, id]
                            handleInputChange('teamflow_sections', newSections)
                          }}
                          disabled={isFieldDisabled()}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              {(hasRoleWithCategoriesTeamFlow && allCategories.length > 0) && (
                <div className="mt-6 pt-4 border-t border-blue-200">
                  <span className="block text-sm font-medium text-gray-700 mb-2">
                    {getRoleName(form.teamflow_app_role) === 'Admin'
                      ? 'Categorie (squadre) visibili nella webapp TeamFlow'
                      : 'Categorie staff TeamFlow (anagrafica staff)'}
                  </span>
                  <p className="text-xs text-gray-500 mb-2">
                    {getRoleName(form.teamflow_app_role) === 'Admin'
                      ? 'Scegli quali squadre questa persona vedrà nella webapp TeamFlow (es. per limitare a poche categorie).'
                      : 'Abbinamento squadre per ruolo staff in TeamFlow (separato dalle categorie giocatore).'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {allCategories.map((cat: { id: string; code?: string; name?: string }) => {
                      const staffCats = form.teamflow_staff_categories || []
                      const checked = staffCats.includes(cat.id)
                      return (
                        <label key={cat.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const newCats = checked ? staffCats.filter((id: string) => id !== cat.id) : [...staffCats, cat.id]
                              handleInputChange('teamflow_staff_categories', newCats)
                            }}
                            disabled={isFieldDisabled()}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{getCategoryLabel(cat)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {isGiocatoreTeamFlow && allCategories.length > 0 && (
                <div className="mt-6 pt-4 border-t border-blue-200">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Categorie giocatore (sincronizzate col tab Giocatore)</span>
                  <p className="text-xs text-gray-500 mb-2">
                    Stesse categorie del tab Giocatore: non influiscono sulle colonne Coach di Incontro Staff.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {allCategories.map((cat: { id: string; code?: string; name?: string }) => {
                      const playerCats = form.player_categories || []
                      const checked = playerCats.includes(cat.id)
                      return (
                        <label key={cat.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const newCats = checked ? playerCats.filter((id: string) => id !== cat.id) : [...playerCats, cat.id]
                              handleInputChange('player_categories', newCats)
                            }}
                            disabled={isFieldDisabled()}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">{getCategoryLabel(cat)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {isTutorTeamFlow && (
                <div className="mt-6 pt-4 border-t border-blue-200">
                  {onGoToTutorTab ? (
                    <>
                      <span className="block text-sm font-medium text-gray-700 mb-2">Giocatori minorenni (tutor)</span>
                      <p className="text-xs text-gray-500 mb-2">L&apos;abbinamento ai giocatori minorenni e il tipo di rapporto (Padre, Mamma, ecc.) si gestiscono nel tab <strong>Tutor</strong> di questa scheda.</p>
                      <button type="button" onClick={onGoToTutorTab} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        Vai al tab Tutor
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="block text-sm font-medium text-gray-700 mb-2">Giocatori minorenni a cui è abbinato come tutor</span>
                      <p className="text-xs text-gray-500 mb-2">Un adulto può essere tutor di uno o più minorenni. Seleziona i giocatori e indica il rapporto (es. Padre, Mamma, Nonno).</p>
                      {tutorLinkedList.length > 0 && (
                        <ul className="space-y-2 mb-3">
                          {tutorLinkedList.map((item) => (
                            <li key={item.athlete_id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-gray-800">{item.name}</span>
                              <span className="text-gray-500">—</span>
                              <select
                                value={item.relationship}
                                onChange={(e) => {
                                  const next = tutorRelationList.map((r) =>
                                    r.athlete_id === item.athlete_id ? { athlete_id: r.athlete_id, relationship: e.target.value } : { athlete_id: r.athlete_id, relationship: r.relationship }
                                  )
                                  handleInputChange('tutor_athlete_relations', next)
                                  handleInputChange('tutor_athlete_ids', next.map((x) => x.athlete_id))
                                }}
                                disabled={isFieldDisabled()}
                                className="border border-gray-300 rounded px-2 py-1 text-gray-700"
                              >
                                {TUTOR_RELATIONSHIP_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button type="button" onClick={() => setShowTutorMinorsModal(true)} disabled={isFieldDisabled()} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {tutorLinkedList.length ? 'Modifica giocatori abbinati' : 'Aggiungi giocatori minorenni'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PlayerSelectionModal
        isOpen={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
        onConfirm={handlePlayerSelection}
      />
      {!onGoToTutorTab && (
        <PlayerSelectionModal
          isOpen={showTutorMinorsModal}
          onClose={() => setShowTutorMinorsModal(false)}
          onConfirm={(selectedPlayerIds) => {
            const current = form.tutor_athlete_relations?.length ? form.tutor_athlete_relations : (form.tutor_athlete_ids || []).map((aid: string) => ({ athlete_id: aid, relationship: 'Tutore' }))
            const newRelations = selectedPlayerIds.map((id) => {
              const existing = current.find((r: { athlete_id: string }) => r.athlete_id === id)
              return { athlete_id: id, relationship: existing ? existing.relationship : 'Padre' }
            })
            handleInputChange('tutor_athlete_relations', newRelations)
            handleInputChange('tutor_athlete_ids', newRelations.map((r) => r.athlete_id))
            setShowTutorMinorsModal(false)
          }}
          minorsOnly
          initialSelectedIds={form.tutor_athlete_ids || form.tutor_athlete_relations?.map((r: { athlete_id: string }) => r.athlete_id) || []}
          title="Abbina tutor a giocatori (fino a 19 anni)"
          description="Seleziona uno o più giocatori fino a 19 anni compresi a cui questa persona è tutor. Poi indica il rapporto (Padre, Mamma, ecc.) nell'elenco."
        />
      )}

      <WhatsAppOpenModal
        isOpen={whatsAppModal.open}
        url={whatsAppModal.url}
        onClose={() => setWhatsAppModal({ open: false, url: '' })}
      />
    </div>
  )
}

export default FlowmeTab
