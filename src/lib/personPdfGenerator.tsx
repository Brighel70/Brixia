import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig } from '@/config/brand'
import { formatCurrency } from '@/utils/feeUtils'
import { getPositionDisplayName } from '@/utils/personUtils'
import type { PersonForm } from '@/hooks/usePersonForm'
import { PersonAnagraficaPdf, PersonCompletePdf, type CompletePdfSection, type PlayerStats } from '@/components/PersonPdfDocument'

function formatDateIt(val: string | undefined): string {
  if (!val) return '—'
  const d = val.split(/[-/]/)
  if (d.length >= 3) return `${d[2].padStart(2, '0')}/${d[1].padStart(2, '0')}/${d[0]}`
  return val
}

const DOC_CATEGORY_LABELS: Record<string, string> = {
  id_card: 'Documento identità',
  certificate: 'Visita medica',
  receipt: 'Ricevuta pagamento',
  consent: 'Consenso/Liberatoria',
  other: 'Altro',
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  note: 'Nota',
  medical: 'Medica',
  injury: 'Infortunio',
  training: 'Allenamento',
  secretary: 'Segreteria',
}

/** Genera PDF scheda anagrafica con @react-pdf/renderer (card, colori, layout moderno) */
export async function generateAnagraficaPdf(form: PersonForm): Promise<void> {
  const brand = getBrandConfig()
  const clubName = brand?.clubShortName || brand?.clubName || 'TeamFlow'

  const blob = await pdf(<PersonAnagraficaPdf form={form} clubName={clubName} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

export interface CompletePdfData {
  form: PersonForm
  documents: Array<{ title: string; category: string; created_at: string; expiry_date?: string }>
  notes: Array<{ content: string; type?: string; created_at: string; reminder_date?: string }>
  injuries: Array<{
    id: string
    injury_date: string
    injury_type: string
    severity: string
    body_part: string
    current_status: string
    cause?: string
    duration_days?: number
    expected_weeks_off?: number
    in_chiusura?: boolean
  }>
  injuryActivities: Array<{
    injury_id: string
    activity_type: string
    duration_minutes?: number
    massaggio?: boolean
    tecar?: boolean
    laser?: boolean
  }>
  feeAssignments: Array<{
    feeName: string
    status: string
    paid_at?: string
    notes?: string
    installments?: Array<{ installment_number: number; amount: number; status: string; paid_at?: string }>
  }>
  categories: Array<{ id: string; code: string }>
  playerPositions: Array<{ id: string; name: string }>
  staffRoles: Array<{ id: string; name: string }>
  playerStats?: PlayerStats | null
}

export interface PlayerStatsView {
  partite: number
  presenze: number
  sessioniTotali: number
  minuti: number
  mete: number
  punti: number
  infortuni: number
}

export async function loadPlayerStatsForView(personId: string, categoryIds: string[]): Promise<PlayerStatsView | null> {
  if (!categoryIds.length) return null
  try {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .in('category_id', categoryIds)
    const sessionIds = (sessions || []).map((s: any) => s.id)
    const sessioniTotali = sessionIds.length

    let presenze = 0
    if (sessionIds.length) {
      const { data: attendance } = await supabase
        .from('attendance')
        .select('session_id, status')
        .eq('player_id', personId)
        .in('session_id', sessionIds)
      presenze = (attendance || []).filter((a: any) => a.status === 'PRESENTE').length
    }

    const { data: matchLists } = await supabase
      .from('match_lists')
      .select('id, selected_players')
      .in('category_id', categoryIds)
      .eq('type', 'match')

    const matchListIds = matchLists?.map((ml: any) => ml.id) || []
    let partite = 0
    matchLists?.forEach((ml: any) => {
      const players = ml.selected_players || []
      if (players.some((p: any) => (p?.player_id || p?.id || p) === personId)) partite++
    })

    let minuti = 0
    let mete = 0
    let punti = 0
    if (matchListIds.length) {
      const { data: matchStats } = await supabase
        .from('match_statistics')
        .select('minutes_played, tries, conversions, drop_goals')
        .eq('player_id', personId)
        .in('match_list_id', matchListIds)
      ;(matchStats || []).forEach((s: any) => {
        minuti += s.minutes_played || 0
        mete += s.tries || 0
        punti += (s.tries || 0) * 5 + (s.conversions || 0) * 2 + (s.drop_goals || 0) * 3
      })
    }

    const { count: injuriesCount } = await supabase
      .from('injuries')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)

    return {
      partite,
      presenze,
      sessioniTotali,
      minuti,
      mete,
      punti,
      infortuni: injuriesCount || 0,
    }
  } catch {
    return null
  }
}

export async function loadCompletePdfData(
  personId: string,
  form: PersonForm,
  categories: Array<{ id: string; code: string }>,
  playerPositions: Array<{ id: string; name: string }>,
  staffRoles: Array<{ id: string; name: string }>
): Promise<CompletePdfData> {
  const categoryIds = form.player_categories || []
  const [docRes, notesRes, injuriesRes, assignmentsRes, playerStats] = await Promise.all([
    supabase.from('documents').select('title, category, created_at, expiry_date').eq('person_id', personId).order('created_at', { ascending: false }),
    supabase.from('notes').select('content, type, created_at, reminder_date').eq('person_id', personId).order('created_at', { ascending: false }),
    supabase.from('injuries').select('id, injury_date, injury_type, severity, body_part, current_status, cause, duration_days, expected_weeks_off, in_chiusura, is_closed').eq('person_id', personId).order('injury_date', { ascending: false }),
    supabase.from('fee_assignments').select(`
      fee_id, notes, status, paid_at, amount, installment_number,
      fees(name)
    `).eq('person_id', personId).order('installment_number', { ascending: true }),
    loadPlayerStatsForView(personId, categoryIds),
  ])

  const injuryIds = (injuriesRes.data || []).map((i: { id: string }) => i.id)
  let injuryActivities: Array<{ injury_id: string; activity_type: string; activity_date?: string; activity_description?: string; duration_minutes?: number; massaggio?: boolean; tecar?: boolean; laser?: boolean }> = []
  if (injuryIds.length > 0) {
    const { data: actData } = await supabase
      .from('injury_activities')
      .select('injury_id, activity_type, activity_date, activity_description, duration_minutes, massaggio, tecar, laser')
      .in('injury_id', injuryIds)
    injuryActivities = actData || []
  }

  const byFee = new Map<string, any[]>()
  for (const a of assignmentsRes.data || []) {
    const feeId = (a as any).fee_id || 'unknown'
    if (!byFee.has(feeId)) byFee.set(feeId, [])
    byFee.get(feeId)!.push(a)
  }
  const feeAssignments = Array.from(byFee.entries()).map(([, assignments]) => {
    const first = assignments[0] as any
    const fee = first.fees
    const installments = assignments.map((a: any) => ({
      installment_number: a.installment_number || 1,
      amount: (a.amount || 0) / 100,
      status: a.status || 'pending',
      paid_at: a.paid_at,
    }))
    return {
      feeName: fee?.name || '—',
      status: first.status || 'pending',
      paid_at: first.paid_at,
      notes: first.notes,
      installments,
    }
  })

  return {
    form,
    documents: docRes.data || [],
    notes: notesRes.data || [],
    injuries: injuriesRes.data || [],
    injuryActivities,
    feeAssignments,
    categories,
    playerPositions,
    staffRoles,
    playerStats: playerStats || null,
  }
}

const PERSONAL_GROUPS: { label: string; fields: (keyof PersonForm)[][] }[] = [
  { label: 'Identità', fields: [['given_name', 'family_name'], ['date_of_birth', 'gender'], ['status', 'nationality']] },
  { label: 'Documenti', fields: [['fiscal_code', 'membership_number']] },
  { label: 'Contatti', fields: [['email', 'phone']] },
  { label: 'Contatto emergenza', fields: [['emergency_contact_name', 'emergency_contact_phone']] },
  { label: 'Residenza', fields: [['address_street'], ['address_city', 'address_zip', 'address_country']] },
  { label: 'Note mediche', fields: [['medical_notes']] },
]

/** Genera PDF scheda completa con @react-pdf/renderer */
export async function generateCompletePdf(data: CompletePdfData): Promise<void> {
  const brand = getBrandConfig()
  const clubName = brand?.clubShortName || brand?.clubName || 'TeamFlow'
  const { form, documents, notes, injuries, injuryActivities, feeAssignments, categories, playerPositions, staffRoles, playerStats } = data

  const sections: CompletePdfSection[] = []
  const LABELS: Record<string, string> = {
    given_name: 'Nome', family_name: 'Cognome', date_of_birth: 'Data di nascita',
    gender: 'Sesso', status: 'Status', nationality: 'Nazionalità',
    fiscal_code: 'Codice fiscale', membership_number: 'Numero tessera',
    email: 'Email', phone: 'Telefono',
    emergency_contact_name: 'Contatto di emergenza', emergency_contact_phone: 'Telefono emergenza',
    medical_notes: 'Note mediche',
    address_street: 'Via/Indirizzo', address_city: 'Città', address_zip: 'CAP', address_country: 'Paese',
  }
  const GENDER_LABELS: Record<string, string> = { M: 'Maschio', F: 'Femmina', other: 'Altro' }
  const STATUS_LABELS: Record<string, string> = { active: 'Attivo', inactive: 'Inattivo', suspended: 'Sospeso' }

  const getVal = (key: string) => {
    let v: string = (form as any)[key] ?? ''
    if (key === 'gender') v = GENDER_LABELS[v] || v
    if (key === 'status') v = STATUS_LABELS[v] || v
    if (key === 'date_of_birth') v = formatDateIt(v)
    return v?.trim() || '—'
  }

  // 1. Informazioni personali (gruppi logici) - sempre presente
  sections.push({
    title: 'Informazioni personali',
    icon: 'person',
    groupedRows: PERSONAL_GROUPS.map(grp => ({
      groupLabel: grp.label,
      rows: grp.fields.map(row => row.map(key => ({ label: LABELS[key] || key, value: getVal(key) }))),
    })),
  })

  // 2. Giocatore - sempre presente se is_player
  if (form.is_player) {
    const groupedRows: Array<{ groupLabel: string; rows: Array<Array<{ label: string; value: string }>> }> = []
    const catVal = form.player_categories?.map(id => categories.find(c => c.id === id)?.code).filter(Boolean).join(', ') || '—'
    const posVal = form.player_positions?.map(id => playerPositions.find(p => p.id === id)?.name).filter(Boolean).map(getPositionDisplayName).join(', ') || '—'
    groupedRows.push({ groupLabel: 'Categoria e ruolo', rows: [[{ label: 'Categorie', value: catVal }, { label: 'Posizioni', value: posVal }]] })
    if (form.fir_code || form.csen_card || form.csen_card_issued_at) {
      groupedRows.push({
        groupLabel: 'Tessera e codici',
        rows: [[
          { label: 'Codice FIR', value: form.fir_code || '—' },
          { label: 'Tessera CSEN', value: form.csen_card || '—' },
          { label: 'Data emissione CSEN', value: form.csen_card_issued_at ? formatDateIt(form.csen_card_issued_at) : '—' },
        ]],
      })
    }
    groupedRows.push({
      groupLabel: 'Stato',
      rows: [[
        { label: 'Infortunato', value: form.injured ? 'Sì' : 'No' },
        { label: 'Squalificato', value: form.disqualified ? (form.disqualification_end_date ? `Fino al ${formatDateIt(form.disqualification_end_date)}` : 'Sì') : 'No' },
      ]],
    })
    sections.push({ title: 'Giocatore', icon: 'player', groupedRows })
    sections.push({ title: 'Statistiche giocatore', icon: 'stats', stats: playerStats ?? { partite: 0, presenze: 0, sessioniTotali: 0, minuti: 0, mete: 0, punti: 0, infortuni: 0 } })
  }

  // 3. Staff - sempre presente se is_staff
  if (form.is_staff) {
    const rolesVal = form.staff_roles?.map(id => staffRoles.find(r => r.id === id)?.name || id).filter(Boolean).join(', ') || '—'
    const rows: { label: string; value: string }[] = [
      { label: 'Ruoli', value: rolesVal },
    ]
    if (form.staff_categories?.length) {
      rows.push({ label: 'Categorie', value: form.staff_categories.map(id => categories.find(c => c.id === id)?.code).filter(Boolean).join(', ') })
    }
    if (form.tutor_relationship) rows.push({ label: 'Relazione tutor', value: form.tutor_relationship })
    sections.push({ title: 'Staff', icon: 'staff', rows })
  }

  // 4. Quote - sempre presente
  {
    const rows: { label: string; value: string }[] = []
    if (feeAssignments.length === 0) {
      rows.push({ label: 'Stato', value: 'Nessuna quota assegnata' })
    } else {
      for (const fa of feeAssignments) {
        rows.push({ label: 'Quota', value: fa.feeName })
        rows.push({ label: 'Stato', value: fa.status })
        if (fa.paid_at) rows.push({ label: 'Pagato il', value: formatDateIt(fa.paid_at.split('T')[0]) })
        if (fa.notes) rows.push({ label: 'Note', value: fa.notes })
        if (fa.installments?.length) {
          fa.installments.forEach(inst => {
            rows.push({ label: `Rata ${inst.installment_number}`, value: `${formatCurrency(Number(inst.amount))} - ${inst.status}${inst.paid_at ? ' (pagato ' + formatDateIt(inst.paid_at.split('T')[0]) + ')' : ''}` })
          })
        }
      }
    }
    sections.push({ title: 'Quote', icon: 'fees', rows })
  }

  // 5. Documenti - sempre presente
  {
    const rows: { label: string; value: string }[] = []
    if (documents.length === 0) {
      rows.push({ label: 'Stato', value: 'Nessun documento caricato' })
    } else {
      for (const d of documents) {
        rows.push({ label: 'Titolo', value: d.title })
        rows.push({ label: 'Categoria', value: DOC_CATEGORY_LABELS[d.category] || d.category })
        rows.push({ label: 'Caricato il', value: formatDateIt(d.created_at?.split('T')[0]) })
        if (d.expiry_date) rows.push({ label: 'Scadenza', value: formatDateIt(d.expiry_date.split('T')[0]) })
      }
    }
    sections.push({ title: 'Documenti', icon: 'documents', rows })
  }

  // 6. Note - sempre presente
  {
    const rows: { label: string; value: string }[] = []
    if (notes.length === 0) {
      rows.push({ label: 'Stato', value: 'Nessuna nota' })
    } else {
      for (const n of notes) {
        rows.push({ label: 'Tipo', value: NOTE_TYPE_LABELS[n.type || 'note'] || n.type })
        rows.push({ label: 'Contenuto', value: n.content })
        rows.push({ label: 'Data', value: formatDateIt(n.created_at?.split('T')[0]) })
        if (n.reminder_date) rows.push({ label: 'Promemoria', value: formatDateIt(n.reminder_date.split('T')[0]) })
      }
    }
    sections.push({ title: 'Note', icon: 'notes', rows })
  }

  // 7. Infortuni - sempre presente, card complete come nell'app
  {
    if (injuries.length === 0) {
      sections.push({
        title: 'Infortuni',
        icon: 'injuries',
        rows: [{ label: 'Stato', value: 'Nessun infortunio registrato' }],
      })
    } else {
      const injuryFullCards = injuries.map((inj: { id: string; injury_date: string; injury_type: string; severity: string; body_part: string; current_status: string; cause?: string; duration_days?: number; expected_weeks_off?: number; in_chiusura?: boolean; is_closed?: boolean }) => {
        const sev = inj.severity === 'Grave' ? 'danger' : inj.severity === 'Moderato' ? 'warning' : 'default'
        const title = `${inj.injury_type}${inj.body_part ? ` - ${inj.body_part}` : ''}`.trim() || 'Infortunio'
        const dateStr = formatDateIt(inj.injury_date)
        const acts = injuryActivities.filter((a: { injury_id: string }) => a.injury_id === inj.id)

        // Giorni: come nell'app (calculateDaysPassed)
        let giorni = 0
        if (inj.injury_date) {
          const injuryDate = new Date(inj.injury_date)
          const hasClosingVisit = acts.some((a: { activity_type: string; activity_description?: string }) =>
            a.activity_type === 'medical_visit' && (a.activity_description || '').toUpperCase().includes('VISITA DI CHIUSURA')
          )
          if (inj.is_closed && hasClosingVisit) {
            const closingVisit = acts
              .filter((a: { activity_type: string; activity_description?: string }) =>
                a.activity_type === 'medical_visit' && (a.activity_description || '').toUpperCase().includes('VISITA DI CHIUSURA')
              )
              .sort((a: { activity_date?: string }, b: { activity_date?: string }) =>
                new Date(b.activity_date || 0).getTime() - new Date(a.activity_date || 0).getTime()
              )[0]
            if (closingVisit?.activity_date) {
              const closedDate = new Date(closingVisit.activity_date)
              giorni = Math.floor((closedDate.getTime() - injuryDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
            }
          }
          if (giorni === 0) {
            giorni = Math.floor((Date.now() - injuryDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          }
        }

        // Previsione: come nell'app (expected_weeks_off o duration_days come "giorni")
        const previsione = (inj.expected_weeks_off != null ? `${inj.expected_weeks_off} giorni` : null) ||
          (inj.duration_days != null ? `${inj.duration_days} giorni` : null) || '—'
        const stato = inj.current_status || (inj.in_chiusura ? 'In chiusura' : 'In corso')

        const visite = acts.filter((a: { activity_type: string }) => a.activity_type === 'medical_visit' || a.activity_type === 'Visita medica').length
        const fisio = acts.filter((a: { activity_type: string }) => a.activity_type === 'physiotherapy' || a.activity_type === 'Fisioterapia').length
        const ore = acts.reduce((s: number, a: { duration_minutes?: number }) => s + (a.duration_minutes || 0), 0)
        const esami = acts.filter((a: { activity_type: string }) => a.activity_type === 'test').length
        const tecar = acts.filter((a: { tecar?: boolean }) => a.tecar).length
        const massaggi = acts.filter((a: { massaggio?: boolean }) => a.massaggio).length
        const laser = acts.filter((a: { laser?: boolean }) => a.laser).length

        const oreDisplay = ore >= 60 ? `${Math.floor(ore / 60)}h ${ore % 60}m` : `${ore}m`

        return {
          title,
          date: dateStr,
          severity: sev,
          attributes: [
            { label: 'TIPO', value: title },
            { label: 'GRAVITÀ', value: inj.severity || '—' },
            { label: 'STATO', value: stato },
            { label: 'GIORNI', value: String(giorni) },
            { label: 'PREVISIONE', value: previsione },
            { label: 'CAUSA', value: inj.cause || '—' },
          ],
          activities: [
            { label: 'Visite', value: String(visite) },
            { label: 'Fisio', value: String(fisio) },
            { label: 'Ore', value: oreDisplay },
            { label: 'Esami', value: String(esami) },
            { label: 'Tecar', value: String(tecar) },
            { label: 'Massaggi', value: String(massaggi) },
            { label: 'Laser', value: String(laser) },
          ],
        }
      })
      sections.push({ title: 'Infortuni', icon: 'injuries', injuryFullCards, accentColor: 'danger' })
    }
  }

  const blob = await pdf(<PersonCompletePdf form={form} clubName={clubName} sections={sections} />).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
