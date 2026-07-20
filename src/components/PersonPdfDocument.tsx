import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Rect } from '@react-pdf/renderer'
import type { PersonForm } from '@/hooks/usePersonForm'

/** Icone SVG per le sezioni (24x24 viewBox, bianche su sfondo colorato) */
function SectionIcon({ name, color = '#fff', size = 20 }: { name: string; color?: string; size?: number }) {
  const s = size / 24
  const iconColor = color
  const icons: Record<string, React.ReactNode> = {
    person: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="7" r="4" fill={iconColor} />
        <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    player: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" fill="none" stroke={iconColor} strokeWidth="2" />
        <Path d="M8 12l3 3 5-6" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
    staff: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="4" y="8" width="16" height="12" rx="1" fill="none" stroke={iconColor} strokeWidth="2" />
        <Path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke={iconColor} strokeWidth="2" />
        <Path d="M12 14v2" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    fees: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" fill="none" stroke={iconColor} strokeWidth="2" />
        <Path d="M12 6v12M9 9h6M9 15h6" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    documents: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={iconColor} strokeWidth="2" />
        <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
    notes: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" fill="none" stroke={iconColor} strokeWidth="2" />
        <Path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke={iconColor} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    ),
    injuries: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
        <Circle cx="12" cy="12" r="4" fill="none" stroke={iconColor} strokeWidth="2" />
      </Svg>
    ),
    stats: (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M18 20V10M12 20V4M6 20v-6" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  }
  return icons[name] || <Circle cx="12" cy="12" r="3" fill={iconColor} />
}

const LABELS: Record<string, string> = {
  given_name: 'Nome',
  family_name: 'Cognome',
  date_of_birth: 'Data di nascita',
  gender: 'Sesso',
  status: 'Status',
  nationality: 'Nazionalità',
  fiscal_code: 'Codice fiscale',
  membership_number: 'Numero tessera',
  email: 'Email',
  phone: 'Telefono',
  emergency_contact_name: 'Contatto di emergenza',
  emergency_contact_phone: 'Telefono emergenza',
  medical_notes: 'Note mediche',
  address_street: 'Via/Indirizzo',
  address_city: 'Città',
  address_zip: 'CAP',
  address_country: 'Paese',
}

const GENDER_LABELS: Record<string, string> = { M: 'Maschio', F: 'Femmina', other: 'Altro' }
const STATUS_LABELS: Record<string, string> = { active: 'Attivo', inactive: 'Inattivo', suspended: 'Sospeso' }

function formatDateIt(val: string | undefined): string {
  if (!val) return '—'
  const d = val.split(/[-/]/)
  if (d.length >= 3) return `${d[2].padStart(2, '0')}/${d[1].padStart(2, '0')}/${d[0]}`
  return val
}

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: 'Helvetica', backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0f172a',
    paddingVertical: 24,
    paddingHorizontal: 32,
    marginBottom: 0,
  },
  headerAccent: { height: 6, backgroundColor: '#6366f1', marginTop: 4 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 12, color: '#94a3b8' },
  content: { width: '100%', padding: 24, paddingTop: 20 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#6366f1',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cardIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardIconText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 16,
  },
  inlineField: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    minWidth: '30%',
  },
  inlineLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    marginRight: 6,
    textTransform: 'uppercase',
  },
  inlineValue: { fontSize: 10, color: '#1e293b', flex: 1 },
  groupLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6366f1',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupLabelFirst: { marginTop: 0 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  statCardBlue: { backgroundColor: '#dbeafe' },
  statCardGreen: { backgroundColor: '#d1fae5' },
  statCardAmber: { backgroundColor: '#fef3c7' },
  statCardPurple: { backgroundColor: '#ede9fe' },
  statCardRed: { backgroundColor: '#fee2e2' },
  statCardCyan: { backgroundColor: '#cffafe' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
  statLabel: { fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  statBadge: { fontSize: 8, color: '#64748b', marginTop: 4 },
  injuryCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  injuryMiniCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  injuryMiniCardRed: { borderLeftColor: '#ef4444' },
  injuryMiniCardAmber: { borderLeftColor: '#f59e0b' },
  injuryMiniLabel: { fontSize: 8, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  injuryMiniValue: { fontSize: 11, fontWeight: 'bold', color: '#1e293b' },
  injuryFullCard: {
    width: '100%',
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#fef7f7',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderLeftWidth: 4,
    borderLeftColor: '#f87171',
  },
  injuryFullCardDanger: { borderLeftColor: '#ef4444', backgroundColor: '#fef2f2' },
  injuryFullCardWarning: { borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  injuryFullCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#fecaca' },
  injuryFullCardTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  injuryFullCardDate: { fontSize: 9, color: '#64748b' },
  injuryAttrRow: { flexDirection: 'row', flexWrap: 'nowrap', marginBottom: 8, width: '100%', alignSelf: 'stretch' },
  injuryAttrMiniCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 44,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  injuryCardTextWrap: { width: '100%', alignItems: 'center' },
  injuryAttrLabel: { fontSize: 7, fontWeight: 'bold', color: '#64748b', marginBottom: 2, textTransform: 'uppercase', textAlign: 'center' },
  injuryAttrValue: { fontSize: 9, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  injuryActivitiesLabel: { fontSize: 8, fontWeight: 'bold', color: '#6366f1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  injuryActivitiesRow: { flexDirection: 'row', flexWrap: 'nowrap', width: '100%', alignSelf: 'stretch' },
  injuryActivityMiniCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 44,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  injuryActivityLabel: { fontSize: 7, fontWeight: 'bold', color: '#64748b', marginBottom: 2, textAlign: 'center' },
  injuryActivityValue: { fontSize: 10, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  sectionCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#10b981',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionCardWarning: { borderLeftColor: '#f59e0b' },
  sectionCardDanger: { borderLeftColor: '#ef4444' },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 2,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  rowAlt: { backgroundColor: '#f1f5f9' },
  rowLabel: { fontSize: 9, fontWeight: 'bold', color: '#64748b', width: '35%' },
  rowValue: { fontSize: 10, color: '#1e293b', flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  footerText: { fontSize: 8, color: '#94a3b8', textAlign: 'center' },
})

interface PersonAnagraficaPdfProps {
  form: PersonForm
  clubName?: string
}

// Gruppi logici con righe: Identità, Documenti, Contatti, Emergenza, Residenza, Salute
const PERSONAL_GROUPS: { label: string; fields: (keyof PersonForm)[][] }[] = [
  { label: 'Identità', fields: [['given_name', 'family_name'], ['date_of_birth', 'gender'], ['status', 'nationality']] },
  { label: 'Documenti', fields: [['fiscal_code', 'membership_number']] },
  { label: 'Contatti', fields: [['email', 'phone']] },
  { label: 'Contatto emergenza', fields: [['emergency_contact_name', 'emergency_contact_phone']] },
  { label: 'Residenza', fields: [['address_street'], ['address_city', 'address_zip', 'address_country']] },
  { label: 'Note mediche', fields: [['medical_notes']] },
]

export function PersonAnagraficaPdf({ form, clubName = 'TeamFlow' }: PersonAnagraficaPdfProps) {
  const fullName = `${form.given_name || ''} ${form.family_name || ''}`.trim() || 'Scheda anagrafica'

  const getVal = (key: string) => {
    let v: string = (form as any)[key] ?? ''
    if (key === 'gender') v = GENDER_LABELS[v] || v
    if (key === 'status') v = STATUS_LABELS[v] || v
    if (key === 'date_of_birth') v = formatDateIt(v)
    return v?.trim() || '—'
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{fullName}</Text>
              <Text style={styles.headerSubtitle}>Informazioni personali · {clubName}</Text>
            </View>
          </View>
          <View style={styles.headerAccent} />
        </View>

        <View style={styles.content}>
          <View style={styles.card} wrap={false}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <SectionIcon name="person" color="#fff" size={20} />
              </View>
              <Text style={styles.cardTitle}>Dati anagrafici</Text>
            </View>
            {PERSONAL_GROUPS.map((grp, gi) => (
              <View key={gi}>
                <Text style={[styles.groupLabel, gi === 0 && styles.groupLabelFirst]}>{grp.label}</Text>
                {grp.fields.map((row, ri) => (
                  <View key={ri} style={styles.inlineRow}>
                    {row.map(key => (
                      <View key={key} style={styles.inlineField}>
                        <Text style={styles.inlineLabel}>{LABELS[key] || key}:</Text>
                        <Text style={styles.inlineValue}>{getVal(key)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {clubName} · Scheda anagrafica · Generato il {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} alle {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export interface PlayerStats {
  partite: number
  presenze: number
  sessioniTotali: number
  minuti: number
  mete: number
  punti: number
  infortuni: number
}

export interface CompletePdfSection {
  title: string
  icon: string
  accentColor?: 'default' | 'warning' | 'danger'
  rows?: Array<{ label: string; value: string }>
  /** Campi sulla stessa riga: ogni array interno = una riga con più campi affiancati */
  inlineRows?: Array<Array<{ label: string; value: string }>>
  /** Dati con gruppi logici (es. Identità, Documenti, Contatti) */
  groupedRows?: Array<{ groupLabel: string; rows: Array<Array<{ label: string; value: string }>> }>
  /** Sezione infortuni con mini-card (legacy) */
  injuryCards?: Array<{ label: string; value: string; severity?: 'default' | 'warning' | 'danger' }>[]
  /** Sezione statistiche giocatore (card con Partite, Presenze, ecc.) */
  stats?: PlayerStats
  /** Card complete per infortunio (come nell'app: header, attributi, attività mediche) */
  injuryFullCards?: Array<{
    title: string
    date: string
    severity?: 'default' | 'warning' | 'danger'
    attributes: Array<{ label: string; value: string }>
    activities: Array<{ label: string; value: string }>
  }>
}

interface PersonCompletePdfProps {
  form: PersonForm
  clubName?: string
  sections: CompletePdfSection[]
}

const STAT_CARD_COLORS = ['statCardBlue', 'statCardGreen', 'statCardAmber', 'statCardPurple', 'statCardCyan', 'statCardRed'] as const

export function PersonCompletePdf({ form, clubName = 'TeamFlow', sections }: PersonCompletePdfProps) {
  const fullName = `${form.given_name || ''} ${form.family_name || ''}`.trim() || 'Scheda completa'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{fullName}</Text>
              <Text style={styles.headerSubtitle}>Scheda completa · {clubName}</Text>
            </View>
          </View>
          <View style={styles.headerAccent} />
        </View>

        <View style={styles.content}>
          {sections.map((sec, idx) => (
            <View
              key={idx}
              wrap={false}
              style={[
                styles.sectionCard,
                sec.accentColor === 'warning' && styles.sectionCardWarning,
                sec.accentColor === 'danger' && styles.sectionCardDanger,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: sec.accentColor === 'danger' ? '#ef4444' : sec.accentColor === 'warning' ? '#f59e0b' : sec.stats ? '#0ea5e9' : '#10b981' }]}>
                  <SectionIcon name={typeof sec.icon === 'string' ? sec.icon : 'person'} color="#fff" size={20} />
                </View>
                <Text style={styles.cardTitle}>{sec.title}</Text>
              </View>

              {sec.stats ? (
                (() => {
                  const s = sec.stats
                  const items = [
                    { label: 'Partite', value: String(s.partite), color: 'statCardBlue', badge: '' },
                    { label: 'Presenze', value: `${s.presenze}/${s.sessioniTotali || 1}`, color: 'statCardCyan', badge: s.sessioniTotali ? `${Math.round((s.presenze / s.sessioniTotali) * 100)}%` : '' },
                    { label: 'Minuti', value: String(s.minuti), color: 'statCardGreen', badge: '' },
                    { label: 'Mete', value: String(s.mete), color: 'statCardAmber', badge: '' },
                    { label: 'Punti', value: String(s.punti), color: 'statCardPurple', badge: '' },
                    { label: 'Infortuni', value: String(s.infortuni), color: 'statCardRed', badge: '' },
                  ]
                  return (
                    <View style={styles.statsRow}>
                      {items.map((it, i) => (
                        <View key={i} style={[styles.statCard, styles[it.color as keyof typeof styles] as any]}>
                          <Text style={styles.statValue}>{it.value}</Text>
                          <Text style={styles.statLabel}>{it.label}</Text>
                          {it.badge ? <Text style={styles.statBadge}>{it.badge}</Text> : null}
                        </View>
                      ))}
                    </View>
                  )
                })()
              ) : sec.groupedRows ? (
                sec.groupedRows.map((grp, gIdx) => (
                  <View key={gIdx}>
                    <Text style={[styles.groupLabel, gIdx === 0 && styles.groupLabelFirst]}>{grp.groupLabel}</Text>
                    {grp.rows.map((rowGroup, rg) => (
                      <View key={rg} style={styles.inlineRow}>
                        {rowGroup.map((f, fi) => (
                          <View key={fi} style={styles.inlineField}>
                            <Text style={styles.inlineLabel}>{f.label}:</Text>
                            <Text style={styles.inlineValue}>{f.value || '—'}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ))
              ) : sec.injuryFullCards ? (
                sec.injuryFullCards.map((card, ic) => (
                  <View key={ic} wrap={false} style={[styles.injuryFullCard, card.severity === 'danger' && styles.injuryFullCardDanger, card.severity === 'warning' && styles.injuryFullCardWarning]}>
                    <View style={styles.injuryFullCardHeader}>
                      <Text style={styles.injuryFullCardTitle}>{card.title}</Text>
                      <Text style={styles.injuryFullCardDate}>{card.date}</Text>
                    </View>
                    <View style={styles.injuryAttrRow}>
                      {card.attributes.slice(0, 4).map((a, ai) => (
                        <View key={ai} style={[styles.injuryAttrMiniCard, ai < 3 && { marginRight: 8 }]}>
                          <View style={styles.injuryCardTextWrap}>
                            <Text style={styles.injuryAttrLabel}>{a.label}</Text>
                          </View>
                          <View style={styles.injuryCardTextWrap}>
                            <Text style={styles.injuryAttrValue}>{a.value || '—'}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    {card.attributes.length > 4 && (
                      <View style={styles.injuryAttrRow}>
                        {card.attributes.slice(4, 6).map((a, ai) => (
                          <View key={ai} style={[styles.injuryAttrMiniCard, ai < 1 && { marginRight: 8 }]}>
                            <View style={styles.injuryCardTextWrap}>
                              <Text style={styles.injuryAttrLabel}>{a.label}</Text>
                            </View>
                            <View style={styles.injuryCardTextWrap}>
                              <Text style={styles.injuryAttrValue}>{a.value || '—'}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                    <Text style={styles.injuryActivitiesLabel}>ATTIVITÀ MEDICHE</Text>
                    <View style={styles.injuryActivitiesRow}>
                      {card.activities.map((act, ai) => (
                        <View key={ai} style={[styles.injuryActivityMiniCard, ai < 6 && { marginRight: 8 }]}>
                          <View style={styles.injuryCardTextWrap}>
                            <Text style={styles.injuryActivityLabel}>{act.label}</Text>
                          </View>
                          <View style={styles.injuryCardTextWrap}>
                            <Text style={styles.injuryActivityValue}>{act.value || '—'}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : sec.injuryCards ? (
                sec.injuryCards.map((injGroup, ig) => (
                  <View key={ig} style={styles.injuryCardsRow}>
                    {injGroup.map((item, ii) => (
                      <View
                        key={ii}
                        style={[
                          styles.injuryMiniCard,
                          item.severity === 'danger' && styles.injuryMiniCardRed,
                          item.severity === 'warning' && styles.injuryMiniCardAmber,
                        ]}
                      >
                        <Text style={styles.injuryMiniLabel}>{item.label}</Text>
                        <Text style={styles.injuryMiniValue}>{item.value || '—'}</Text>
                      </View>
                    ))}
                  </View>
                ))
              ) : sec.inlineRows ? (
                sec.inlineRows.map((rowGroup, rg) => (
                  <View key={rg} style={styles.inlineRow}>
                    {rowGroup.map((f, fi) => (
                      <View key={fi} style={styles.inlineField}>
                        <Text style={styles.inlineLabel}>{f.label}:</Text>
                        <Text style={styles.inlineValue}>{f.value || '—'}</Text>
                      </View>
                    ))}
                  </View>
                ))
              ) : sec.rows ? (
                sec.rows.map((row, i) => (
                  <View key={i} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <Text style={styles.rowValue}>{row.value || '—'}</Text>
                  </View>
                ))
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {clubName} · Scheda completa · Generato il {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })} alle {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
