import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, pdf, Svg, Circle } from '@react-pdf/renderer'
import { getBrandConfig } from '@/config/brand'
import { supabase } from '@/lib/supabaseClient'
import { getMatchListDisplayRole, getPlayerProfileRoleLabel } from '@/utils/personUtils'

export interface EventPresentationMatchListPlayer {
  number: number
  name: string
  role: string
}

export interface EventPresentationMatchList {
  name?: string | null
  players: EventPresentationMatchListPlayer[]
}

export interface EventPresentationData {
  title: string
  event_date: string
  start_time?: string
  end_time?: string
  event_time?: string
  event_type: string
  location?: string
  away_location?: string
  is_home?: boolean
  opponents?: string[]
  opponent?: string
  gironi?: { id: string; name: string; teams: string[] }[]
  categories?: { name?: string; code?: string; abbreviation?: string | null }
  event_id?: string
  matchList?: EventPresentationMatchList
  is_championship?: boolean
  is_friendly?: boolean
  /** Incontro Staff */
  description?: string
  presenti?: string[]
  assenti?: string[]
  ordine_del_giorno?: string[]
  allegati?: string[]
  tuttiPresenti?: boolean
}

const NAVY = '#0b1f4d'
const NAVY_DARK = '#061528'
const ACCENT = '#4aa3ff'
const WHITE = '#ffffff'
const GRAY_700 = '#334155'
const GRAY_500 = '#64748b'
const HEADER_CARD_BG = '#162a54'
const HEADER_CARD_BORDER = '#2a4070'
const PINK_BADGE = '#ec4899'
const AMBER_BADGE = '#f59e0b'
const GIRONE_HEADER_BG = '#071226'
const GIRONE_HEADER_SUBTITLE = '#C8D3ED'
const GIRONE_TEAM_TEXT = '#0B1533'
const GIRONE_TEAM_ROW_BG = '#F1F6FB'
const GIRONE_TEAM_ROW_ALT_BG = '#F7FBFF'
const GIRONE_TEAM_ROW_BORDER = '#E3EDF7'
const GIRONE_ACCENT_COLORS = ['#2F6DF6', '#10B7A6', '#F4B740'] as const

function formatDateIt(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  const dayName = days[d.getDay()] || '—'
  const day = d.getDate()
  const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  const month = months[d.getMonth()] || ''
  return `${dayName} ${day} ${month}`
}

function capitalizeFirst(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function getEventDayNumber(dateStr: string): string {
  if (!dateStr) return '—'
  const day = new Date(dateStr).getDate()
  return Number.isNaN(day) ? '—' : String(day)
}

function formatGironiSummary(gironi: { teams: string[] }[]): string {
  if (gironi.length === 0) return ''
  const counts = gironi.map((g) => g.teams.length)
  const allSame = counts.every((c) => c === counts[0])
  if (allSame && counts[0] > 0) return `${gironi.length} gironi da ${counts[0]}`
  return `${gironi.length} gironi`
}

function formatTime(t?: string): string {
  if (!t) return ''
  return String(t).substring(0, 5)
}

function getEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    partita: 'Partita',
    torneo: 'Torneo',
    consiglio: 'Consiglio',
    incontro_staff: 'Incontro Staff',
    festa_del_rugby: 'Festa del Rugby',
  }
  return labels[type] || type
}

function getPartitaCategoryLabel(
  category: { abbreviation?: string | null; code?: string; name?: string } | null | undefined
): string {
  return category?.abbreviation?.trim() || category?.code?.trim() || category?.name?.trim() || ''
}

function stripOpponentCategorySuffix(
  opponentRaw: string,
  category: { abbreviation?: string | null; code?: string; name?: string } | null | undefined
): string {
  let opponentBase = opponentRaw.trim()
  const suffixLabels = [
    category?.abbreviation?.trim(),
    category?.name?.trim(),
    category?.code?.trim(),
  ].filter((label): label is string => Boolean(label))

  for (const label of suffixLabels) {
    const suffix = ` – ${label}`
    if (opponentBase.endsWith(suffix)) {
      opponentBase = opponentBase.slice(0, -suffix.length).trim()
      break
    }
  }

  return opponentBase
}

function getPartitaEventDisplayTitle(event: EventPresentationData, clubName: string): string {
  const categoryLabel = getPartitaCategoryLabel(event.categories)
  const opponentRaw = event.opponent?.trim() || event.opponents?.[0]?.trim() || ''
  if (!categoryLabel || !opponentRaw) return ''

  const opponentBase = stripOpponentCategorySuffix(opponentRaw, event.categories)
  const club = clubName.trim()
  const ourName = club && categoryLabel ? `${club} ${categoryLabel}` : club || categoryLabel || 'La nostra squadra'
  const opponentName =
    opponentBase && categoryLabel ? `${opponentBase} ${categoryLabel}` : opponentBase

  return event.is_home ? `${ourName} vs ${opponentName}` : `${opponentName} vs ${ourName}`
}

function getOpponentPartitaTeamDisplayName(event: EventPresentationData): string {
  const categoryLabel = getPartitaCategoryLabel(event.categories)
  const opponentRaw = event.opponent?.trim() || event.opponents?.[0]?.trim() || ''
  if (!opponentRaw) return '—'

  const opponentBase = stripOpponentCategorySuffix(opponentRaw, event.categories)
  if (opponentBase && categoryLabel) return `${opponentBase} ${categoryLabel}`
  return opponentBase || '—'
}

function getMatchListSectionTitle(event: EventPresentationData): string {
  const clubName = getBrandConfig().clubName?.trim() || getBrandConfig().clubShortName?.trim() || ''
  const built = getPartitaEventDisplayTitle(event, clubName)
  if (built) {
    return `LISTA GARA — ${built.toUpperCase()}`
  }

  const stripped = (event.title || '')
    .replace(/^Partita\s+(amichevole|campionato):\s*/i, '')
    .trim()
  if (stripped) {
    return `LISTA GARA — ${stripped.toUpperCase()}`
  }

  return 'LISTA GARA'
}

function getPartitaHeaderLine(event: EventPresentationData): string {
  const categoryFull = event.categories?.name?.trim().toUpperCase() || ''
  const kind = event.is_championship
    ? 'PARTITA DI CAMPIONATO'
    : event.is_friendly
      ? 'PARTITA AMICHEVOLE'
      : 'PARTITA'
  return categoryFull ? `${kind} ${categoryFull}` : kind
}

function getPartitaHeaderTitle(event: EventPresentationData): string {
  const clubName = getBrandConfig().clubName?.trim() || getBrandConfig().clubShortName?.trim() || ''
  return getPartitaEventDisplayTitle(event, clubName) || event.title
}

/** 0,5 cm in punti PDF (72 pt = 1 inch, 2.54 cm = 1 inch) */
const CM_MARGIN = 72 / 2.54 / 2

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: 'Helvetica',
    backgroundColor: '#f8fafc',
    fontSize: 11,
  },
  pageContinuation: {
    padding: 0,
    paddingTop: CM_MARGIN,
    paddingBottom: CM_MARGIN,
    fontFamily: 'Helvetica',
    backgroundColor: '#f8fafc',
    fontSize: 11,
  },
  header: {
    backgroundColor: NAVY_DARK,
    paddingBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBgDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerBlob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  headerBlobLeft: {
    width: 240,
    height: 240,
    backgroundColor: '#1a4a8f',
    opacity: 0.38,
    top: -95,
    left: -75,
  },
  headerBlobRight: {
    width: 300,
    height: 300,
    backgroundColor: '#2563c7',
    opacity: 0.28,
    top: -70,
    right: -110,
  },
  headerBlobMid: {
    width: 180,
    height: 180,
    backgroundColor: '#3b82f6',
    opacity: 0.18,
    bottom: -70,
    left: 200,
  },
  headerBlobAccent: {
    width: 120,
    height: 120,
    backgroundColor: ACCENT,
    opacity: 0.12,
    top: 20,
    right: 180,
  },
  headerForeground: {
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  headerTopPartita: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  headerLogoSpacer: {
    width: 43,
    height: 43,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerPartitaBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerPartitaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: WHITE,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: WHITE,
    letterSpacing: 1,
  },
  /** Tipo evento e categoria: stessa dimensione (es. 12) */
  headerTypeCategory: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  /** Titolo evento: 2 punti più grande di tipo/categoria (es. 16) */
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: WHITE,
    letterSpacing: 0.5,
  },
  headerCategory: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerLogo: {
    width: 43,
    height: 43,
    objectFit: 'contain',
    marginLeft: 12,
  },
  headerAccent: {
    height: 5,
    backgroundColor: ACCENT,
  },
  headerInfoRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 32,
  },
  headerInfoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: HEADER_CARD_BG,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: HEADER_CARD_BORDER,
    minWidth: 0,
  },
  headerInfoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerInfoBadgeLogo: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoBadgeLogoImage: {
    width: 40,
    height: 40,
    objectFit: 'contain',
  },
  headerInfoBadgeText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: 'bold',
  },
  headerInfoContent: {
    flex: 1,
    minWidth: 0,
  },
  headerInfoLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerInfoMain: {
    fontSize: 10,
    fontWeight: 'bold',
    color: WHITE,
  },
  headerInfoSub: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    padding: 28,
    paddingTop: 24,
  },
  contentCompact: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  continuationContent: {
    paddingHorizontal: 28,
    paddingTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: GRAY_500,
    marginBottom: 6,
  },
  sectionValue: {
    fontSize: 12,
    color: GRAY_700,
    lineHeight: 1.5,
  },
  row: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  /** Data, ora e luogo su una riga (legacy, non più usato nel body) */
  metaRow: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  metaCol: {
    flex: 1,
    minWidth: 0,
  },
  metaColDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  card: {
    flex: 1,
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  /** Contenitore a tutta larghezza come Data/Luogo (stesso stile card) */
  cardFull: {
    width: '100%',
    backgroundColor: WHITE,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  squadreChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  squadraChipWrapper: {
    flex: 1,
    minWidth: 0,
  },
  squadraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    minHeight: 36,
  },
  squadraChipWithLogo: {
    justifyContent: 'flex-start',
  },
  squadraChipLogoSlot: {
    width: 22,
    height: 22,
    flexShrink: 0,
  },
  squadraChipLogoBox: {
    width: 22,
    height: 22,
    backgroundColor: WHITE,
    borderRadius: 4,
    padding: 2,
    flexShrink: 0,
  },
  squadraChipLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  squadraChipText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: NAVY,
  },
  squadraChipTextWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  matchListColumns: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  matchListColumn: {
    flex: 1,
    minWidth: 0,
  },
  matchListColumnLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: GRAY_500,
    marginBottom: 6,
  },
  matchListColumnCard: {
    backgroundColor: WHITE,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchListCard: {
    width: '100%',
    backgroundColor: WHITE,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  matchListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  matchListNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NAVY_DARK,
    color: WHITE,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 5,
  },
  matchListName: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: NAVY,
  },
  matchListRole: {
    width: 72,
    fontSize: 7,
    color: GRAY_500,
    textAlign: 'right',
  },
  gironiPremiumColumn: {
    gap: 14,
  },
  gironiPremiumRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  gironiPremiumRowDense: {
    gap: 8,
    marginBottom: 8,
  },
  gironePremiumCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  gironePremiumCardDense: {
    borderRadius: 14,
    marginBottom: 0,
  },
  gironePremiumCardFull: {
    width: '100%',
  },
  gironePremiumCardPaired: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  gironePremiumHeader: {
    backgroundColor: GIRONE_HEADER_BG,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 0,
  },
  gironePremiumHeaderDense: {
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  gironePremiumHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gironePremiumHeaderInnerDense: {
    marginBottom: 6,
  },
  gironePremiumTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: WHITE,
  },
  gironePremiumTitleDense: {
    fontSize: 9,
  },
  gironePremiumSubtitle: {
    fontSize: 8,
    color: GIRONE_HEADER_SUBTITLE,
  },
  gironePremiumSubtitleDense: {
    fontSize: 7,
  },
  gironePremiumDivider: {
    height: 3,
    width: '100%',
  },
  gironePremiumBody: {
    padding: 12,
  },
  gironePremiumBodyDense: {
    padding: 6,
  },
  gironeTeamsGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  gironeTeamsGridRowDense: {
    gap: 4,
    marginBottom: 4,
  },
  gironeTeamCellWrapper: {
    flex: 1,
    minWidth: 0,
  },
  gironeTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 36,
    marginBottom: 6,
  },
  gironeTeamRowDense: {
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 8,
    minHeight: 24,
    marginBottom: 0,
  },
  gironeTeamLogoSlot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gironeTeamLogoSlotDense: {
    width: 14,
    height: 14,
  },
  gironeTeamDot: {
    width: 10,
    height: 10,
  },
  gironeTeamLogo: {
    width: 18,
    height: 18,
    objectFit: 'contain',
  },
  gironeTeamLogoDense: {
    width: 14,
    height: 14,
  },
  gironeTeamNameWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minWidth: 0,
  },
  gironeTeamName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: GIRONE_TEAM_TEXT,
    textTransform: 'uppercase',
  },
  gironeTeamNameDense: {
    fontSize: 7,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 8,
    color: GRAY_500,
    textAlign: 'center',
  },
})

function normalizeTeamName(name: string): string {
  return name.trim().toUpperCase()
}

function GironeTeamRow({
  name,
  accentColor,
  alternate,
  logo,
  dense = false,
}: {
  name: string
  accentColor: string
  alternate: boolean
  logo: string | null
  dense?: boolean
}) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    <View
      style={[
        styles.gironeTeamRow,
        dense ? styles.gironeTeamRowDense : null,
        {
          backgroundColor: alternate ? GIRONE_TEAM_ROW_ALT_BG : GIRONE_TEAM_ROW_BG,
          borderColor: GIRONE_TEAM_ROW_BORDER,
        },
      ]}
    >
      <View style={[styles.gironeTeamLogoSlot, dense ? styles.gironeTeamLogoSlotDense : null]}>
        {logo ? (
          <Image src={logo} style={[styles.gironeTeamLogo, dense ? styles.gironeTeamLogoDense : null]} />
        ) : (
          <Svg style={styles.gironeTeamDot} viewBox="0 0 10 10">
            <Circle cx={5} cy={5} r={3.5} fill="none" stroke={accentColor} strokeWidth={1.2} />
          </Svg>
        )}
      </View>
      <View style={styles.gironeTeamNameWrap}>
        {words.map((word, i) => (
          <React.Fragment key={`${word}-${i}`}>
            {i > 0 ? (
              <Text style={[styles.gironeTeamName, dense ? styles.gironeTeamNameDense : null]} wrap={false}>
                {' '}
              </Text>
            ) : null}
            <Text style={[styles.gironeTeamName, dense ? styles.gironeTeamNameDense : null]} wrap={false}>
              {word}
            </Text>
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

const GIRONE_TEAMS_PER_ROW_WIDE = 4
const GIRONE_TEAMS_PER_ROW_DENSE = 2

function getGironeTeamCount(g: { teams: string[] }): number {
  return g.teams.filter((t) => t?.trim()).length
}

function isCompactGirone(teamCount: number): boolean {
  return teamCount >= 4 && teamCount <= 6
}

function isUniformCompactGironiLayout(gironi: { teams: string[] }[]): boolean {
  if (gironi.length === 0) return false
  return gironi.every((g) => {
    const count = getGironeTeamCount(g)
    return count === 0 || isCompactGirone(count)
  })
}

function getGironiColumnsPerRow(uniformCompact: boolean): number {
  if (!uniformCompact) return 1
  return 2
}

function groupGironiIntoLayoutRows(
  gironi: { id: string; name: string; teams: string[] }[],
  uniformCompact: boolean
): { gironi: { id: string; name: string; teams: string[] }[]; columns: number }[] {
  const columns = getGironiColumnsPerRow(uniformCompact)

  if (columns === 1) {
    return gironi.map((g) => ({ gironi: [g], columns: 1 }))
  }

  const rows: { gironi: { id: string; name: string; teams: string[] }[]; columns: number }[] = []
  for (let i = 0; i < gironi.length; i += columns) {
    rows.push({ gironi: gironi.slice(i, i + columns), columns })
  }
  return rows
}

function renderGironeTeamsGrid(
  teams: string[],
  teamsPerRow: number,
  accentColor: string,
  logoForTeam: (name: string) => string | null,
  dense: boolean
) {
  return Array.from({ length: Math.ceil(teams.length / teamsPerRow) }, (_, rowIndex) => {
    const start = rowIndex * teamsPerRow
    const rowTeams = teams.slice(start, start + teamsPerRow)
    return (
      <View key={rowIndex} style={[styles.gironeTeamsGridRow, dense ? styles.gironeTeamsGridRowDense : null]}>
        {Array.from({ length: teamsPerRow }, (_, colIndex) => {
          const team = rowTeams[colIndex]
          const globalIndex = start + colIndex
          return (
            <View key={colIndex} style={styles.gironeTeamCellWrapper}>
              {team ? (
                <GironeTeamRow
                  name={team}
                  accentColor={accentColor}
                  alternate={globalIndex % 2 === 1}
                  logo={logoForTeam(team)}
                  dense={dense}
                />
              ) : null}
            </View>
          )
        })}
      </View>
    )
  })
}

function GironePremiumCard({
  name,
  teams,
  accentColor,
  logoForTeam,
  paired = false,
  forceVerticalTeams = false,
  dense = false,
}: {
  name: string
  teams: string[]
  accentColor: string
  logoForTeam: (team: string) => string | null
  paired?: boolean
  forceVerticalTeams?: boolean
  dense?: boolean
}) {
  const teamCount = teams.length
  const useDenseGrid = dense && teamCount === 4
  const verticalTeams = !useDenseGrid && (forceVerticalTeams || isCompactGirone(teamCount))
  const cardStyle = paired ? styles.gironePremiumCardPaired : styles.gironePremiumCardFull
  const teamCountLabel = `${teamCount} ${teamCount === 1 ? 'squadra' : 'squadre'}`

  return (
    <View
      style={[
        styles.gironePremiumCard,
        cardStyle,
        dense ? styles.gironePremiumCardDense : null,
        { borderColor: accentColor },
      ]}
      wrap={false}
    >
      <View style={[styles.gironePremiumHeader, dense ? styles.gironePremiumHeaderDense : null]}>
        <View
          style={[
            styles.gironePremiumHeaderInner,
            dense ? styles.gironePremiumHeaderInnerDense : null,
          ]}
        >
          <Text style={[styles.gironePremiumTitle, dense ? styles.gironePremiumTitleDense : null]}>{name}</Text>
          <Text style={[styles.gironePremiumSubtitle, dense ? styles.gironePremiumSubtitleDense : null]}>
            {teamCountLabel}
          </Text>
        </View>
        <View style={[styles.gironePremiumDivider, { backgroundColor: accentColor }]} />
      </View>
      <View style={[styles.gironePremiumBody, dense ? styles.gironePremiumBodyDense : null]}>
        {teamCount > 0 ? (
          useDenseGrid ? (
            renderGironeTeamsGrid(teams, GIRONE_TEAMS_PER_ROW_DENSE, accentColor, logoForTeam, true)
          ) : verticalTeams ? (
            teams.map((team, i) => (
              <GironeTeamRow
                key={`${team}-${i}`}
                name={team}
                accentColor={accentColor}
                alternate={i % 2 === 1}
                logo={logoForTeam(team)}
                dense={dense}
              />
            ))
          ) : (
            renderGironeTeamsGrid(teams, GIRONE_TEAMS_PER_ROW_WIDE, accentColor, logoForTeam, false)
          )
        ) : (
          <Text style={styles.gironePremiumSubtitle}>—</Text>
        )}
      </View>
    </View>
  )
}

function HeaderBackgroundDecor() {
  return (
    <View style={styles.headerBgDecor}>
      <View style={[styles.headerBlob, styles.headerBlobLeft]} />
      <View style={[styles.headerBlob, styles.headerBlobRight]} />
      <View style={[styles.headerBlob, styles.headerBlobMid]} />
      <View style={[styles.headerBlob, styles.headerBlobAccent]} />
    </View>
  )
}

function HeaderInfoCard({
  badge,
  badgeColor,
  badgeLogo,
  label,
  main,
  sub,
}: {
  badge: string
  badgeColor: string
  badgeLogo?: string | null
  label: string
  main: string
  sub?: string
}) {
  return (
    <View style={styles.headerInfoCard}>
      {badgeLogo ? (
        <View style={styles.headerInfoBadgeLogo}>
          <Image src={badgeLogo} style={styles.headerInfoBadgeLogoImage} />
        </View>
      ) : (
        <View style={[styles.headerInfoBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.headerInfoBadgeText}>{badge}</Text>
        </View>
      )}
      <View style={styles.headerInfoContent}>
        <Text style={styles.headerInfoLabel}>{label}</Text>
        <Text style={styles.headerInfoMain}>{main}</Text>
        {sub ? <Text style={styles.headerInfoSub}>{sub}</Text> : null}
      </View>
    </View>
  )
}

function SquadraChip({ name, logo }: { name: string; logo: string | null }) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    <View style={[styles.squadraChip, styles.squadraChipWithLogo]}>
      <View style={styles.squadraChipLogoSlot}>
        {logo ? (
          <View style={styles.squadraChipLogoBox}>
            <Image src={logo} style={styles.squadraChipLogo} />
          </View>
        ) : null}
      </View>
      <View style={styles.squadraChipTextWrap}>
        {words.map((word, i) => (
          <React.Fragment key={`${word}-${i}`}>
            {i > 0 ? <Text style={styles.squadraChipText} wrap={false}>{' '}</Text> : null}
            <Text style={styles.squadraChipText} wrap={false}>{word}</Text>
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

function GironiSection({
  gironi,
  logoForTeam,
}: {
  gironi: { id: string; name: string; teams: string[] }[]
  logoForTeam: (name: string) => string | null
}) {
  const uniformCompact = isUniformCompactGironiLayout(gironi)
  const denseLayout = false
  const layoutRows = groupGironiIntoLayoutRows(gironi, uniformCompact)
  let gironeIndex = 0

  const renderCard = (g: { id: string; name: string; teams: string[] }, paired: boolean) => {
    const accentColor = GIRONE_ACCENT_COLORS[gironeIndex % GIRONE_ACCENT_COLORS.length]
    gironeIndex += 1
    return (
      <GironePremiumCard
        key={g.id}
        name={g.name}
        teams={g.teams.filter((t) => t?.trim())}
        accentColor={accentColor}
        logoForTeam={logoForTeam}
        paired={paired}
        forceVerticalTeams={uniformCompact && !denseLayout}
        dense={denseLayout}
      />
    )
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: NAVY, marginBottom: denseLayout ? 8 : 12 }]}>Gironi</Text>
      <View style={styles.gironiPremiumColumn}>
        {layoutRows.map((row, rowIndex) => {
          if (row.columns > 1) {
            return (
              <View
                key={rowIndex}
                style={[styles.gironiPremiumRow, denseLayout ? styles.gironiPremiumRowDense : null]}
                wrap={false}
              >
                {row.gironi.map((g) => renderCard(g, true))}
              </View>
            )
          }
          return row.gironi.map((g) => renderCard(g, false))
        })}
      </View>
    </View>
  )
}

function isMultiTeamEventType(eventType: string) {
  return eventType === 'torneo' || eventType === 'festa_del_rugby'
}

const RUGBY_MATCH_ROLES: Record<number, string> = {
  1: 'Pilone SX',
  2: 'Tallonatore',
  3: 'Pilone DX',
  4: '2^ Linea',
  5: '2^ Linea',
  6: 'Flanker',
  7: 'Flanker',
  8: 'Terza Centro',
  9: 'Mediano',
  10: 'Apertura',
  11: 'Ala',
  12: '1° Centro',
  13: '2° Centro',
  14: 'Ala',
  15: 'Estremo',
}

function getRugbyRoleFromNumber(number: number) {
  return RUGBY_MATCH_ROLES[number] || '(a disposizione)'
}

function MatchListPlayerRow({ player }: { player: EventPresentationMatchListPlayer }) {
  return (
    <View style={styles.matchListRow}>
      <Text style={styles.matchListNumber}>{player.number}</Text>
      <Text style={styles.matchListName}>{player.name}</Text>
      <Text style={styles.matchListRole}>{player.role}</Text>
    </View>
  )
}

function MatchListSection({
  event,
  matchList,
}: {
  event: EventPresentationData
  matchList: EventPresentationMatchList
}) {
  const starters = matchList.players.filter(player => player.number <= 15)
  const bench = matchList.players.filter(player => player.number > 15)

  return (
    <View style={{ marginBottom: 0 }}>
      <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>
        {getMatchListSectionTitle(event)}
      </Text>
      <View style={styles.matchListCard}>
        <View style={styles.matchListColumns}>
          <View style={styles.matchListColumn}>
            <Text style={styles.matchListColumnLabel}>Titolari ({starters.length})</Text>
            <View style={styles.matchListColumnCard}>
              {starters.map(player => (
                <MatchListPlayerRow key={`starter-${player.number}-${player.name}`} player={player} />
              ))}
              {starters.length === 0 && (
                <Text style={{ fontSize: 8, color: GRAY_500 }}>Nessun titolare</Text>
              )}
            </View>
          </View>
          <View style={styles.matchListColumn}>
            <Text style={styles.matchListColumnLabel}>A disposizione ({bench.length})</Text>
            <View style={styles.matchListColumnCard}>
              {bench.map(player => (
                <MatchListPlayerRow key={`bench-${player.number}-${player.name}`} player={player} />
              ))}
              {bench.length === 0 && (
                <Text style={{ fontSize: 8, color: GRAY_500 }}>Nessuna riserva</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

async function loadMatchListForEvent(eventId: string): Promise<EventPresentationMatchList | null> {
  const { data: list, error } = await supabase
    .from('match_lists')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error || !list?.selected_players?.length) return null

  const playerIds = list.selected_players.map((player: { player_id: string }) => player.player_id)

  const { data: positionsData } = await supabase
    .from('player_positions')
    .select('id, name')
    .order('position_order')
  const positionsMap = Object.fromEntries(
    (positionsData || []).map((position: { id: string; name: string }) => [position.id, position.name])
  )

  const { data: playersData, error: playersError } = await supabase
    .from('people')
    .select('id, full_name, player_positions')
    .in('id', playerIds)

  if (playersError) return null

  const players = list.selected_players
    .map((selectedPlayer: { player_id: string; number: number }) => {
      const player = playersData?.find(p => p.id === selectedPlayer.player_id)
      const profileRole = getPlayerProfileRoleLabel(player?.player_positions, positionsMap)
      return {
        number: selectedPlayer.number,
        name: player?.full_name || 'Giocatore',
        role: getMatchListDisplayRole(selectedPlayer.number, profileRole, RUGBY_MATCH_ROLES),
      }
    })
    .sort((a: EventPresentationMatchListPlayer, b: EventPresentationMatchListPlayer) => a.number - b.number)

  return {
    name: list.name,
    players,
  }
}

function EventPresentationDocument({
  event,
  clubName,
  logoUrl,
  teamLogos,
}: {
  event: EventPresentationData
  clubName: string
  logoUrl: string | null
  teamLogos: Record<string, string | null>
}) {
  const luogo = event.location === 'Trasferta' ? event.away_location : event.location
  const luogoDisplay = luogo?.trim() ? luogo.trim() : '—'
  const oraDisplay = (() => {
    const start = formatTime(event.start_time)
    const end = formatTime(event.end_time)
    if (start && end) return `${start} – ${end}`
    if (start) return start
    if (end) return end
    if (event.event_time) return formatTime(event.event_time)
    return '—'
  })()
  const categoryName = event.categories?.name?.trim() || ''
  const opponents = event.opponents?.filter((t) => t?.trim()) ?? []
  const gironi = event.gironi ?? []
  const logoForTeam = (name: string) => teamLogos[normalizeTeamName(name)] ?? null
  const dateDisplay = capitalizeFirst(formatDateIt(event.event_date))
  const dayBadge = getEventDayNumber(event.event_date)
  const locationBadge = luogoDisplay !== '—' ? luogoDisplay.charAt(0).toUpperCase() : '—'
  const locationSub =
    event.event_type !== 'consiglio'
      ? event.is_home
        ? 'Casa'
        : event.location === 'Trasferta' || event.away_location
          ? 'Trasferta'
          : undefined
      : undefined
  const gironiSummary = formatGironiSummary(gironi)
  const teamsSub = gironiSummary || undefined
  const teamsMain = opponents.length > 0 ? `${opponents.length} società` : '—'
  const thirdCard = ((): {
    badge: string
    badgeColor: string
    badgeLogo?: string | null
    label: string
    main: string
    sub?: string
  } | null => {
    if (isMultiTeamEventType(event.event_type) && opponents.length > 0) {
      return {
        badge: String(opponents.length),
        badgeColor: AMBER_BADGE,
        label: 'Squadre',
        main: teamsMain,
        sub: teamsSub,
      }
    }
    if (event.event_type === 'partita' && opponents.length === 1) {
      const opponentDisplay = getOpponentPartitaTeamDisplayName(event)
      const opponentRaw = event.opponent?.trim() || opponents[0]?.trim() || ''
      const opponentBase = stripOpponentCategorySuffix(opponentRaw, event.categories)
      const opponentLogo = logoForTeam(opponentBase) || logoForTeam(opponentRaw)
      return {
        badge: opponentDisplay !== '—' ? opponentDisplay.charAt(0).toUpperCase() : '1',
        badgeColor: AMBER_BADGE,
        badgeLogo: opponentLogo,
        label: 'Avversario',
        main: opponentDisplay,
        sub: undefined,
      }
    }
    return null
  })()

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <HeaderBackgroundDecor />
          <View style={styles.headerForeground}>
          {event.event_type === 'partita' ? (
            <View style={styles.headerTopPartita}>
              <View style={styles.headerLogoSpacer} />
              <View style={styles.headerCenter}>
                <Text style={styles.headerPartitaBadge}>{getPartitaHeaderLine(event)}</Text>
                <Text style={styles.headerPartitaTitle}>{getPartitaHeaderTitle(event)}</Text>
              </View>
              {logoUrl ? (
                <Image src={logoUrl} style={styles.headerLogo} />
              ) : (
                <View style={styles.headerLogoSpacer} />
              )}
            </View>
          ) : (
          <View style={styles.headerTop}>
            <View style={[styles.headerLeft, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }]}>
              <Text style={styles.headerTypeCategory}>{getEventTypeLabel(event.event_type).toUpperCase()}</Text>
              <Text style={styles.headerTitle}>{event.title}</Text>
              {categoryName ? <Text style={styles.headerCategory}>{categoryName.toUpperCase()}</Text> : null}
            </View>
            {logoUrl ? <Image src={logoUrl} style={styles.headerLogo} /> : null}
          </View>
          )}

          <View style={styles.headerInfoRow}>
            <HeaderInfoCard
              badge={dayBadge}
              badgeColor={ACCENT}
              label="Data e orari"
              main={dateDisplay}
              sub={oraDisplay !== '—' ? oraDisplay : undefined}
            />
            <HeaderInfoCard
              badge={locationBadge}
              badgeColor={PINK_BADGE}
              label={event.event_type === 'consiglio' ? 'Sede' : 'Luogo'}
              main={luogoDisplay}
              sub={locationSub}
            />
            {thirdCard ? (
              <HeaderInfoCard
                badge={thirdCard.badge}
                badgeColor={thirdCard.badgeColor}
                badgeLogo={thirdCard.badgeLogo}
                label={thirdCard.label}
                main={thirdCard.main}
                sub={thirdCard.sub}
              />
            ) : null}
          </View>
          </View>
        </View>
        <View style={styles.headerAccent} />

        <View
          style={
            event.event_type === 'partita' && event.matchList && event.matchList.players.length > 0
              ? styles.contentCompact
              : styles.content
          }
        >
          {isMultiTeamEventType(event.event_type) && opponents.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>Squadre partecipanti ({opponents.length})</Text>
              <View style={styles.cardFull}>
              {Array.from({ length: Math.ceil(opponents.length / 4) }, (_, rowIndex) => {
                const start = rowIndex * 4
                const rowTeams = opponents.slice(start, start + 4)
                return (
                  <View key={rowIndex} style={styles.squadreChipsRow}>
                    {[0, 1, 2, 3].map((colIndex) => {
                      const name = rowTeams[colIndex]
                      return (
                        <View key={colIndex} style={styles.squadraChipWrapper}>
                          {name ? (
                            <SquadraChip name={name} logo={logoForTeam(name)} />
                          ) : null}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
              </View>
            </View>
          )}

          {event.event_type === 'partita' && event.matchList && event.matchList.players.length > 0 && (
            <MatchListSection event={event} matchList={event.matchList} />
          )}

          {event.event_type === 'incontro_staff' && (
            <View style={{ marginBottom: 12 }}>
              {(event.presenti?.length ?? 0) > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>
                    {event.tuttiPresenti
                      ? 'Tutti Presenti'
                      : `Presenti (${event.presenti!.length})`}
                  </Text>
                  <View style={styles.cardFull}>
                    <Text style={{ fontSize: 10, color: GRAY_700, lineHeight: 1.45 }}>
                      {event.presenti!.join(', ')}
                    </Text>
                  </View>
                </View>
              )}
              {(event.assenti?.length ?? 0) > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>
                    Assenti ({event.assenti!.length})
                  </Text>
                  <View style={styles.cardFull}>
                    <Text style={{ fontSize: 10, color: GRAY_700, lineHeight: 1.45 }}>
                      {event.assenti!.join(', ')}
                    </Text>
                  </View>
                </View>
              )}
              {event.description?.trim() ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>Descrizione</Text>
                  <View style={styles.cardFull}>
                    <Text style={{ fontSize: 10, color: GRAY_700, lineHeight: 1.45 }}>
                      {event.description.trim()}
                    </Text>
                  </View>
                </View>
              ) : null}
              {(event.ordine_del_giorno?.length ?? 0) > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>Ordine del giorno</Text>
                  <View style={styles.cardFull}>
                    {event.ordine_del_giorno!.map((point, index) => (
                      <Text
                        key={`odg-${index}`}
                        style={{ fontSize: 10, color: GRAY_700, lineHeight: 1.45, marginBottom: 3 }}
                      >
                        {index + 1}. {point}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
              {(event.allegati?.length ?? 0) > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 6 }]}>
                    Allegati ({event.allegati!.length})
                  </Text>
                  <View style={styles.cardFull}>
                    {event.allegati!.map((label, index) => (
                      <Text
                        key={`all-${index}`}
                        style={{ fontSize: 10, color: GRAY_700, lineHeight: 1.45, marginBottom: 3 }}
                      >
                        • {label}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

        </View>

        <Text style={styles.footer} fixed>
          {clubName} — Presentazione evento — Generato da TeamFlow
        </Text>
      </Page>

      {isMultiTeamEventType(event.event_type) && gironi.length > 0 && (
        <Page size="A4" style={styles.pageContinuation}>
          <View style={styles.continuationContent}>
            <GironiSection gironi={gironi} logoForTeam={logoForTeam} />
          </View>
          <Text style={styles.footer} fixed>
            {clubName} — Presentazione evento — Generato da TeamFlow
          </Text>
        </Page>
      )}
    </Document>
  )
}

function getLogoSource(): string {
  const brand = getBrandConfig()
  const logo = brand?.assets?.logo?.trim()
  if (!logo) return ''
  if (logo.startsWith('data:') || logo.startsWith('blob:')) return logo
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo
  if (typeof window !== 'undefined') return window.location.origin + (logo.startsWith('/') ? logo : `/${logo}`)
  return logo
}

async function resolveLogoToDataUrl(source: string): Promise<string | null> {
  if (!source) return null
  if (source.startsWith('data:')) return source
  try {
    const res = await fetch(source, { mode: 'cors' })
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('svg') || source.toLowerCase().endsWith('.svg')) {
      const text = await res.text()
      const base64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(text))) : ''
      return base64 ? `data:image/svg+xml;base64,${base64}` : null
    }
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function collectEventTeamNames(event: EventPresentationData): string[] {
  const names: string[] = []
  for (const t of event.opponents ?? []) {
    if (t?.trim()) names.push(t.trim())
  }
  if (event.event_type === 'partita') {
    const opponentRaw = event.opponent?.trim() || event.opponents?.[0]?.trim() || ''
    if (opponentRaw) {
      const opponentBase = stripOpponentCategorySuffix(opponentRaw, event.categories)
      if (opponentBase) names.push(opponentBase)
    }
  }
  for (const g of event.gironi ?? []) {
    for (const t of g.teams ?? []) {
      if (t?.trim()) names.push(t.trim())
    }
  }
  return names
}

async function loadTeamLogoDataUrls(teamNames: string[]): Promise<Record<string, string | null>> {
  const unique = [...new Set(teamNames.map((n) => n.trim()).filter(Boolean))]
  if (unique.length === 0) return {}

  const { data, error } = await supabase.from('origin_clubs').select('name, logo_url')
  if (error || !data) return {}

  const clubByName = new Map<string, string | null>()
  for (const club of data) {
    if (club.name?.trim()) {
      clubByName.set(normalizeTeamName(club.name), club.logo_url || null)
    }
  }

  const result: Record<string, string | null> = {}
  await Promise.all(
    unique.map(async (name) => {
      const key = normalizeTeamName(name)
      const logoUrl = clubByName.get(key) ?? null
      if (!logoUrl) {
        result[key] = null
        return
      }
      const dataUrl = await resolveLogoToDataUrl(logoUrl)
      result[key] = dataUrl || logoUrl
    })
  )
  return result
}

export function getEventPresentationPdfFilename(event: EventPresentationData): string {
  const d = event.event_date ? new Date(event.event_date) : new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const dateStr = `${day}-${month}-${year}`
  if (event.event_type === 'torneo') {
    const title = (event.title || 'evento').trim()
    return `Torneo ${title} del ${dateStr}.pdf`
  }
  if (event.event_type === 'festa_del_rugby') {
    const cat = (event.categories?.name || event.title || 'evento').trim()
    return `Festa del Rugby ${cat} del ${dateStr}.pdf`
  }
  if (event.event_type === 'incontro_staff') {
    return `Incontro_Staff_${dateStr}.pdf`
  }
  const safeTitle = (event.title || 'evento').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
  if (event.event_type === 'partita') {
    return `Lista_Gara_${safeTitle}_${dateStr}.pdf`
  }
  return `Presentazione_${safeTitle}_${dateStr}.pdf`
}

export async function generateEventPresentationPdf(event: EventPresentationData): Promise<void> {
  const brand = getBrandConfig()
  const footerLabel = brand?.footerName || brand?.clubName || brand?.clubShortName || 'TeamFlow'
  const clubName = brand?.clubShortName || brand?.clubName || 'TeamFlow'
  const logoSource = getLogoSource()
  let logoUrl: string | null = logoSource ? await resolveLogoToDataUrl(logoSource) : null
  if (!logoUrl && logoSource) logoUrl = logoSource

  let enrichedEvent = event
  if (event.event_type === 'partita') {
    let matchList = event.matchList
    if (!matchList?.players?.length && event.event_id) {
      matchList = (await loadMatchListForEvent(event.event_id)) ?? undefined
    }
    if (matchList?.players?.length) {
      enrichedEvent = { ...event, matchList }
    }
  }

  const teamLogos = await loadTeamLogoDataUrls(collectEventTeamNames(enrichedEvent))

  const blob = await pdf(
    <EventPresentationDocument event={enrichedEvent} clubName={footerLabel} logoUrl={logoUrl} teamLogos={teamLogos} />
  ).toBlob()
  const pdfUrl = URL.createObjectURL(blob)
  const filename = getEventPresentationPdfFilename(enrichedEvent)

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Presentazione evento</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: #0b1f4d;
      color: #fff;
    }
    .toolbar h1 { margin: 0; font-size: 1rem; font-weight: 600; }
    .toolbar button {
      padding: 8px 16px;
      background: #4aa3ff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
    }
    .toolbar button:hover { background: #3b8de6; }
    iframe { display: block; width: 100%; height: calc(100vh - 48px); border: none; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Presentazione evento</h1>
    <button type="button" id="saveBtn">Salva file</button>
  </div>
  <iframe src="${pdfUrl}" title="PDF presentazione"></iframe>
  <script>
    (function() {
      var filename = ${JSON.stringify(filename)};
      document.getElementById('saveBtn').onclick = function() {
        var a = document.createElement('a');
        a.href = ${JSON.stringify(pdfUrl)};
        a.download = filename;
        a.click();
      };
    })();
  </script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  } else {
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(pdfUrl)
  }
}
