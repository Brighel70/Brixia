import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { getBrandConfig } from '@/config/brand'
import { sortNamesBySurname, sortCouncilParticipantNames } from '@/lib/sortNames'
import { normalizeOrdineDelGiorno } from '@/lib/councilOrdineDelGiorno'

export interface CouncilEventData {
  title: string
  event_date: string
  start_time?: string
  end_time?: string
  location?: string
  away_location?: string
  participants?: string[]
  invited?: string[]
  /** Assenti (membri del consiglio non presenti); in PDF sopra Ordine del giorno */
  absent?: string[]
  ordine_del_giorno?: string[]
  /** Ruoli consiglio: serve per mettere il presidente sempre per primo */
  councilMembers?: { name: string; role?: string }[]
}

function formatDateIt(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  const dayName = days[d.getDay()]
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${dayName} ${day}/${month}/${year}`
}

function formatTime(t?: string): string {
  if (!t) return ''
  return String(t).substring(0, 5)
}

/** Layout fisso card nomi (A4 pt) — react-pdf non equalizza bene con flex/percentuali. */
const A4_WIDTH = 595.28
const PAGE_CONTENT_PADDING = 36
const SECTION_PADDING = 18
const SECTION_BORDER_LEFT = 5
const SECTION_BORDER_RIGHT = 1
const NAMES_PER_ROW = 4
const NAME_CHIP_GAP = 8
const NAME_CHIP_HEIGHT = 34
const NAMES_GRID_WIDTH =
  A4_WIDTH -
  PAGE_CONTENT_PADDING * 2 -
  SECTION_PADDING * 2 -
  SECTION_BORDER_LEFT -
  SECTION_BORDER_RIGHT
const NAME_CHIP_WIDTH =
  (NAMES_GRID_WIDTH - NAME_CHIP_GAP * (NAMES_PER_ROW - 1)) / NAMES_PER_ROW

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: 'Helvetica',
    backgroundColor: '#f8fafc',
    fontSize: 11,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#0b1f4d',
    paddingVertical: 28,
    paddingHorizontal: 36,
    marginBottom: 0,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerLogo: {
    width: 73,
    height: 73,
    objectFit: 'contain',
    marginLeft: 16,
  },
  headerAccent: {
    height: 6,
    backgroundColor: '#4aa3ff',
    marginTop: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  headerMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  content: {
    padding: 36,
    paddingTop: 28,
  },
  section: {
    marginBottom: 24,
  },
  /* Direttivo: blu navy con bordo laterale */
  sectionDirettivo: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#0b1f4d',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  sectionTitleDirettivo: {
    color: '#0b1f4d',
    borderBottomColor: '#cbd5e1',
  },
  sectionContentDirettivo: {
    fontSize: 11,
    color: '#0f172a',
    lineHeight: 1.4,
  },
  /* Invitati: verde con bordo laterale */
  sectionInvitati: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#15803d',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  sectionTitleInvitati: {
    color: '#166534',
    borderBottomColor: '#dcfce7',
  },
  sectionContentInvitati: {
    fontSize: 11,
    color: '#14532d',
    lineHeight: 1.4,
  },
  /* Assenti: rosso con bordo laterale */
  sectionAssenti: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#b91c1c',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  sectionTitleAssenti: {
    color: '#b91c1c',
    borderBottomColor: '#fef2f2',
  },
  sectionContentAssenti: {
    fontSize: 11,
    color: '#991b1b',
    lineHeight: 1.4,
  },
  nameGrid: {
    marginTop: 4,
    width: NAMES_GRID_WIDTH,
  },
  nameRow: {
    flexDirection: 'row',
    width: NAMES_GRID_WIDTH,
    marginBottom: 8,
  },
  nameChip: {
    width: NAME_CHIP_WIDTH,
    maxWidth: NAME_CHIP_WIDTH,
    minWidth: NAME_CHIP_WIDTH,
    height: NAME_CHIP_HEIGHT,
    maxHeight: NAME_CHIP_HEIGHT,
    marginRight: NAME_CHIP_GAP,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  nameChipLast: {
    marginRight: 0,
  },
  nameChipSpacer: {
    width: NAME_CHIP_WIDTH,
    maxWidth: NAME_CHIP_WIDTH,
    minWidth: NAME_CHIP_WIDTH,
    height: NAME_CHIP_HEIGHT,
    marginRight: NAME_CHIP_GAP,
  },
  nameChipSpacerLast: {
    marginRight: 0,
  },
  nameChipText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 1.25,
  },
  /* Ordine del giorno: arancio con bordo laterale */
  sectionOdg: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#b45309',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  sectionTitleOdg: {
    color: '#b45309',
    borderBottomColor: '#fff7ed',
  },
  sectionContent: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 1.6,
  },
  odgList: {
    marginTop: 6,
  },
  odgItem: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingLeft: 4,
  },
  odgNumber: {
    width: 24,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#b45309',
  },
  odgText: {
    flex: 1,
    fontSize: 11,
    color: '#78350f',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
})

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function NamesGrid({
  names,
  textStyle,
  chipBorderColor,
}: {
  names: string[]
  textStyle: object
  chipBorderColor: string
}) {
  if (names.length === 0) return null
  const rows = chunkArray(names, NAMES_PER_ROW)

  return (
    <View style={styles.nameGrid}>
      {rows.map((row, rowIndex) => {
        const cells: (string | null)[] = [...row]
        while (cells.length < NAMES_PER_ROW) cells.push(null)

        return (
          <View key={`row-${rowIndex}`} style={styles.nameRow} wrap={false}>
            {cells.map((name, colIndex) => {
              const isLast = colIndex === NAMES_PER_ROW - 1
              if (name == null) {
                return (
                  <View
                    key={`${rowIndex}-spacer-${colIndex}`}
                    style={[
                      styles.nameChipSpacer,
                      isLast ? styles.nameChipSpacerLast : null,
                    ]}
                  />
                )
              }
              return (
                <View
                  key={`${rowIndex}-${colIndex}`}
                  style={[
                    styles.nameChip,
                    { borderColor: chipBorderColor },
                    isLast ? styles.nameChipLast : null,
                  ]}
                >
                  <Text style={[textStyle, styles.nameChipText]}>{name}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

function CouncilResocontoDocument({
  event,
  clubName,
  logoUrl,
}: {
  event: CouncilEventData
  clubName: string
  logoUrl: string | null
}) {
  const sede = event.location === 'Trasferta' ? event.away_location : event.location
  const members = event.councilMembers ?? []
  const participantsList = sortCouncilParticipantNames(
    event.participants?.filter(Boolean) ?? [],
    members,
  )
  const invitedList = sortNamesBySurname(event.invited?.filter(Boolean) ?? [])
  const absentList = sortCouncilParticipantNames(
    event.absent?.filter(Boolean) ?? [],
    members,
  )
  const odg = normalizeOrdineDelGiorno(event.ordine_del_giorno?.filter(Boolean) ?? [])

  const timeLine = [
    event.start_time && `Inizio: ${formatTime(event.start_time)}`,
    event.end_time && `Fine: ${formatTime(event.end_time)}`,
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{event.title}</Text>
            <Text style={styles.headerMeta}>{formatDateIt(event.event_date)}</Text>
            {timeLine ? <Text style={styles.headerMeta}>{timeLine}</Text> : null}
            {sede?.trim() ? <Text style={styles.headerMeta}>Sede: {sede.trim()}</Text> : null}
          </View>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.headerLogo} />
          ) : null}
        </View>
        <View style={styles.headerAccent} />

        <View style={styles.content}>
          {participantsList.length > 0 && (
            <View style={styles.sectionDirettivo}>
              <Text style={[styles.sectionTitle, styles.sectionTitleDirettivo]}>Direttivo ({participantsList.length})</Text>
              <NamesGrid
                names={participantsList}
                textStyle={styles.sectionContentDirettivo}
                chipBorderColor="#bfdbfe"
              />
            </View>
          )}

          {invitedList.length > 0 && (
            <View style={styles.sectionInvitati}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInvitati]}>Invitati ({invitedList.length})</Text>
              <NamesGrid
                names={invitedList}
                textStyle={styles.sectionContentInvitati}
                chipBorderColor="#bbf7d0"
              />
            </View>
          )}

          {absentList.length > 0 && (
            <View style={styles.sectionAssenti}>
              <Text style={[styles.sectionTitle, styles.sectionTitleAssenti]}>Assenti ({absentList.length})</Text>
              <NamesGrid
                names={absentList}
                textStyle={styles.sectionContentAssenti}
                chipBorderColor="#fecaca"
              />
            </View>
          )}

          {odg.length > 0 && (
            <View style={styles.sectionOdg}>
              <Text style={[styles.sectionTitle, styles.sectionTitleOdg]}>Ordine del giorno</Text>
              <View style={styles.odgList}>
                {odg.map((point, index) => (
                  <View key={index} style={styles.odgItem}>
                    <Text style={styles.odgNumber}>{index + 1}.</Text>
                    <Text style={styles.odgText}>{point}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          {clubName === 'Brixia' ? 'Brixia A.s.d.' : clubName} — Resoconto consiglio (promemoria) — Generato da TeamFlow
        </Text>
      </Page>
    </Document>
  )
}

/** Logo del Club da brand (stesso di Brand Customization / sidebar). */
function getLogoSource(): string {
  const brand = getBrandConfig()
  const logo = brand?.assets?.logo?.trim()
  if (!logo) return ''
  if (logo.startsWith('data:') || logo.startsWith('blob:')) return logo
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo
  if (typeof window !== 'undefined') return window.location.origin + (logo.startsWith('/') ? logo : `/${logo}`)
  return logo
}

/** Converte il logo in data URL così il PDF lo incorpora e lo mostra sempre (niente CORS). */
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

/** Nome file per il download: "Consiglio del DD-MM-YYYY ( Sede ).pdf" */
export function getCouncilResocontoPdfFilename(event: CouncilEventData): string {
  const d = event.event_date ? new Date(event.event_date) : new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const datePart = `${day}-${month}-${year}`
  const sede = (event.location === 'Trasferta' ? event.away_location : event.location)?.trim() || 'Sede'
  return `Consiglio del ${datePart} ( ${sede} ).pdf`
}

/** Genera il PDF, apre l'anteprima in nuova scheda con pulsante "Salva file" (nome: Consiglio del DD-MM-YYYY ( Sede ).pdf). */
export async function generateCouncilResocontoPdf(event: CouncilEventData): Promise<void> {
  const brand = getBrandConfig()
  const clubName = brand?.clubShortName || brand?.clubName || 'TeamFlow'
  const logoSource = getLogoSource()
  let logoUrl: string | null = logoSource ? await resolveLogoToDataUrl(logoSource) : null
  if (!logoUrl && logoSource) logoUrl = logoSource

  const blob = await pdf(<CouncilResocontoDocument event={event} clubName={clubName} logoUrl={logoUrl} />).toBlob()
  const pdfUrl = URL.createObjectURL(blob)
  const filename = getCouncilResocontoPdfFilename(event)

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Anteprima resoconto consiglio</title>
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
    <h1>Resoconto consiglio</h1>
    <button type="button" id="saveBtn">Salva file</button>
  </div>
  <iframe src="${pdfUrl}" title="PDF resoconto"></iframe>
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

  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const htmlUrl = URL.createObjectURL(htmlBlob)
  window.open(htmlUrl, '_blank')
  URL.revokeObjectURL(htmlUrl)
}
