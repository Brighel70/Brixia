import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import { formatCurrency } from '@/utils/feeUtils'
import jsPDF from 'jspdf'
import { getBrandConfig } from '@/config/brand'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Dumbbell,
  Trophy,
  FileText,
  FileDown,
  Stethoscope,
  CreditCard,
  UserX,
  Activity,
  BarChart2
} from 'lucide-react'

const EVENT_TYPE_LABELS: Record<string, string> = {
  partita: 'Partita',
  torneo: 'Torneo',
  consiglio: 'Consiglio',
  evento_sociale: 'Evento sociale',
  raduno: 'Raduno',
  festa: 'Festa',
  incontro_genitori: 'Incontro genitori',
  incontro_staff: 'Incontro staff',
  altro: 'Altro'
}

function getCategoryAbbreviation(nameOrCode: string | undefined): string {
  if (!nameOrCode?.trim()) return '-'
  const val = nameOrCode.trim()
  const u = val.toUpperCase()
  if (u === 'SENIOR' || u === 'SENIORES') return ''
  const byCode: Record<string, string> = {
    U6: 'U6', U8: 'U8', U10: 'U10', U12: 'U12', U14: 'U14', U16: 'U16', U18: 'U18',
    SERIE_C: 'C', SERIE_B: 'B', PODEROSA: 'POD', GUSSAGOLD: 'GUS', BRIXIAOLD: 'BRI', LEONESSE: 'LEO'
  }
  const byName: Record<string, string> = {
    'Under 6': 'U6', 'Under 8': 'U8', 'Under 10': 'U10', 'Under 12': 'U12',
    'Under 14': 'U14', 'Under 16': 'U16', 'Under 18': 'U18',
    'Serie C': 'C', 'Serie B': 'B', 'Poderosa': 'POD',
    'GussagOld': 'GUS', 'Brixia Old': 'BRI', 'Leonesse': 'LEO'
  }
  return byCode[val] || byName[val] || val
}

interface ResocontoSettimanaleProps {
  embedInLayout?: boolean
}

export default function ResocontoSettimanale({ embedInLayout = false }: ResocontoSettimanaleProps) {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date()
    const dayOfWeek = d.getDay() // 0=dom, 1=lun, ..., 6=sab
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    d.setDate(d.getDate() + diffToMonday)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [events, setEvents] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [expiringCertificates, setExpiringCertificates] = useState<any[]>([])
  const [overdueFees, setOverdueFees] = useState<any[]>([])
  const [absentCount, setAbsentCount] = useState(0)
  const [injuryCount, setInjuryCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const startDateStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const endDate = new Date(weekStart)
  endDate.setDate(weekStart.getDate() + 6)
  const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [eventsRes, sessionsRes, certRes, feesRes, statsRes, injuriesRes] = await Promise.all([
          supabase
            .from('events')
            .select('id, title, start_time, event_time, event_type, location, event_date, categories(name, code)')
            .gte('event_date', startDateStr)
            .lte('event_date', endDateStr)
            .order('event_date', { ascending: true })
            .order('start_time', { ascending: true }),
          supabase
            .from('sessions')
            .select('id, session_date, start_time, end_time, location, away_place, categories(name, code)')
            .gte('session_date', startDateStr)
            .lte('session_date', endDateStr)
            .order('session_date', { ascending: true })
            .order('start_time', { ascending: true }),
          supabase
            .from('documents')
            .select('id, expiry_date, people:person_id(id, full_name)')
            .eq('category', 'certificate')
            .not('expiry_date', 'is', null)
            .lte('expiry_date', endDateStr)
            .order('expiry_date', { ascending: true })
            .limit(15),
          supabase
            .from('fee_assignments')
            .select('id, amount, due_date, status, people:person_id(id, full_name), fees:fee_id(name)')
            .in('status', ['pending', 'overdue']),
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('status', 'ASSENTE'),
          supabase.from('injuries').select('id', { count: 'exact', head: true }).eq('is_closed', false)
        ])

        setEvents(eventsRes.data || [])
        setSessions(sessionsRes.data || [])
        setExpiringCertificates(certRes.data || [])
        const today = new Date().toISOString().split('T')[0]
        const overdue = (feesRes.data || []).filter(
          (a: any) => a.status === 'overdue' || (a.due_date && a.due_date < today)
        )
        setOverdueFees(overdue)
        setAbsentCount((statsRes as any).count ?? 0)
        setInjuryCount((injuriesRes as any).count ?? 0)
      } catch (e) {
        console.error('Errore caricamento resoconto:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [startDateStr, endDateStr])

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  const goToCurrentWeek = () => {
    const d = new Date()
    const dayOfWeek = d.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    d.setDate(d.getDate() + diffToMonday)
    d.setHours(0, 0, 0, 0)
    setWeekStart(d)
  }

  const getItemsForDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayEvents = events.filter((e: any) => e.event_date === dateStr)
    const daySessions = sessions.filter((s: any) => s.session_date === dateStr)
    const partite = dayEvents.filter((e: any) => e.event_type === 'partita')
    const altriEventi = dayEvents.filter((e: any) => e.event_type !== 'partita')
    return { partite, altriEventi, allenamenti: daySessions }
  }

  const formatWeekRange = () => {
    const end = new Date(weekStart)
    end.setDate(weekStart.getDate() + 6)
    return `${weekStart.getDate()} - ${end.getDate()} ${weekStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`
  }

  const generatePDF = useCallback(() => {
    const doc = new jsPDF('l', 'mm', 'a4') // Landscape A4
    const pageWidth = doc.internal.pageSize.getWidth()  // 297mm
    const pageHeight = doc.internal.pageSize.getHeight() // 210mm
    const margin = 12
    const colW = (pageWidth - margin * 2) / 7
    const headerH = 38
    const mainH = pageHeight - headerH - 58
    const dayHeaderH = 12

    // Palette premium
    const navy = [15, 23, 42]
    const blue = [59, 130, 246]
    const emerald = [16, 185, 129]
    const amber = [245, 158, 11]
    const rose = [244, 63, 94]
    const violet = [139, 92, 246]
    const white = [255, 255, 255]
    const slate200 = [226, 232, 240]
    const slate400 = [148, 163, 184]
    const slate500 = [100, 116, 139]

    // === SFONDO DECORATIVO (strisce sottili) ===
    doc.setFillColor(248, 250, 252)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    for (let i = 0; i < 20; i++) {
      doc.setDrawColor(241, 245, 249)
      doc.setLineWidth(0.1)
      doc.line(0, i * 11, pageWidth, i * 11)
    }

    // === HEADER PREMIUM ===
    doc.setFillColor(navy[0], navy[1], navy[2])
    doc.rect(0, 0, pageWidth, headerH, 'F')
    // Accent gradient simulato (3 strisce)
    doc.setFillColor(59, 130, 246)
    doc.rect(0, 0, pageWidth, 2, 'F')
    doc.setFillColor(96, 165, 250)
    doc.rect(0, 2, pageWidth, 2, 'F')
    doc.setFillColor(147, 197, 253)
    doc.rect(0, 4, pageWidth, 2, 'F')
    // Titolo (no emoji: Helvetica non li supporta)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(white[0], white[1], white[2])
    doc.text('RESOCONTO SETTIMANALE', margin, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(203, 213, 225)
    doc.text(formatWeekRange().toUpperCase(), margin, 24)
    doc.setFontSize(9)
    doc.setTextColor(slate400[0], slate400[1], slate400[2])
    doc.text(`${getBrandConfig().clubName} - ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - margin, 14, { align: 'right' })
    doc.text(`Generato alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 22, { align: 'right' })

    // === 7 COLONNE GIORNI (design card) ===
    const dayShort = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short' })
    const dayNum = (d: Date) => d.getDate().toString()
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6
    const isToday = (d: Date) => {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return ds === new Date().toISOString().split('T')[0]
    }

    weekDays.forEach((day, colIndex) => {
      const x = margin + colIndex * colW
      const { partite, altriEventi, allenamenti } = getItemsForDay(day)
      const hasContent = partite.length > 0 || altriEventi.length > 0 || allenamenti.length > 0
      const today = isToday(day)

      // Header giorno - colori diversi weekend vs feriale, evidenzia OGGI
      const headerR = today ? 59 : (isWeekend(day) ? 100 : 59)
      const headerG = today ? 130 : (isWeekend(day) ? 116 : 130)
      const headerB = today ? 246 : (isWeekend(day) ? 139 : 246)
      doc.setFillColor(headerR, headerG, headerB)
      doc.rect(x + 1, headerH + 2, colW - 2, dayHeaderH, 'F')
      if (today) {
        doc.setDrawColor(251, 191, 36)
        doc.setLineWidth(0.5)
        doc.rect(x, headerH + 1, colW, dayHeaderH + 4)
      }
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.2)
      doc.rect(x + 1, headerH + 2, colW - 2, dayHeaderH)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(`${dayShort(day)} ${dayNum(day)}`, x + colW / 2, headerH + 7.5, { align: 'center' })
      if (today) {
        doc.setFontSize(6)
        doc.text('[OGGI]', x + colW / 2, headerH + 11, { align: 'center' })
      }

      // Box contenuto - sfondo bianco con bordo
      doc.setFillColor(white[0], white[1], white[2])
      doc.rect(x + 1, headerH + dayHeaderH + 3, colW - 2, mainH - 5, 'F')
      doc.setDrawColor(slate200[0], slate200[1], slate200[2])
      doc.setLineWidth(0.25)
      doc.rect(x + 1, headerH + dayHeaderH + 3, colW - 2, mainH - 5)

      let lineY = headerH + dayHeaderH + 8
      const lineH = 5.5

      const addLine = (text: string, color: number[]) => {
        if (lineY < headerH + dayHeaderH + mainH - 6) {
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(color[0], color[1], color[2])
          const truncated = doc.splitTextToSize(text, colW - 6)
          truncated.slice(0, 2).forEach((t: string) => {
            doc.text(t, x + 4, lineY)
            lineY += lineH
          })
        }
      }

      if (!hasContent) {
        doc.setFontSize(7)
        doc.setTextColor(slate400[0], slate400[1], slate400[2])
        doc.text('- Nessuna attivita -', x + colW / 2, lineY + 2, { align: 'center' })
      } else {
        partite.forEach((e: any) => {
          const t = (e.start_time || e.event_time || '').toString().substring(0, 5)
          const title = (e.title || '').substring(0, 22)
          const cat = getCategoryAbbreviation(e.categories?.code || e.categories?.name)
          addLine(`${t} ${title} (${cat})`, amber)
        })
        allenamenti.forEach((s: any) => {
          const t = (s.start_time || s.end_time || '').toString().substring(0, 5)
          const loc = (s.location || s.away_place || '-').substring(0, 16)
          const cat = getCategoryAbbreviation(s.categories?.code || s.categories?.name)
          addLine(`${t} ${loc} (${cat})`, emerald)
        })
        altriEventi.forEach((e: any) => {
          const t = (e.start_time || e.event_time || '').toString().substring(0, 5)
          const tipo = (EVENT_TYPE_LABELS[e.event_type] || e.event_type).substring(0, 10)
          addLine(`${t} ${tipo}`, violet)
        })
      }
    })

    // === FOOTER STATS - Design premium ===
    const bottomY = pageHeight - 54
    doc.setFillColor(navy[0], navy[1], navy[2])
    doc.rect(0, bottomY, pageWidth, 54, 'F')
    doc.setFillColor(blue[0], blue[1], blue[2])
    doc.rect(0, bottomY, pageWidth, 3, 'F')

    const cardW = (pageWidth - margin * 2 - 30) / 4
    const cardH = 22
    const cardY = bottomY + 10
    const cardGap = 8
    const stats = [
      { label: 'Visite in scadenza', value: expiringCertificates.length, color: amber },
      { label: 'Quote scadute', value: overdueFees.length, color: rose },
      { label: 'Assenze', value: absentCount, color: violet },
      { label: 'Infortuni aperti', value: injuryCount, color: emerald }
    ]

    stats.forEach((s, i) => {
      const cx = margin + 6 + i * (cardW + cardGap)
      // Card con sfondo chiaro su navy (no emoji: Helvetica non li supporta)
      doc.setFillColor(51, 65, 85) // slate-700
      doc.rect(cx, cardY, cardW, cardH, 'F')
      doc.setDrawColor(148, 163, 184)
      doc.setLineWidth(0.4)
      doc.rect(cx, cardY, cardW, cardH)
      // Label
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(203, 213, 225)
      doc.text(s.label.toUpperCase(), cx + cardW / 2, cardY + 7, { align: 'center' })
      // Valore grande
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(s.color[0], s.color[1], s.color[2])
      doc.text(String(s.value), cx + cardW / 2, cardY + 17, { align: 'center' })
    })

    // Dettagli rapidi a destra
    const detailX = margin + 4 * (cardW + cardGap) + 14
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(203, 213, 225)
    if (expiringCertificates.length > 0) {
      const first = expiringCertificates[0]
      const days = Math.ceil((new Date(first.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      doc.text(`> ${(first.people?.full_name || '-').substring(0, 20)} (${days <= 0 ? 'Scaduto' : `${days} gg`})`, detailX, cardY + 5)
    }
    if (overdueFees.length > 0) {
      const first = overdueFees[0]
      doc.text(`> ${(first.people?.full_name || '-').substring(0, 18)} ${first.amount} eur`, detailX, cardY + 12)
    }

    // Footer finale
    doc.setDrawColor(59, 130, 246)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8)
    doc.setFontSize(8)
    doc.setTextColor(slate400[0], slate400[1], slate400[2])
    doc.text(`${getBrandConfig().clubName} - Resoconto settimanale - ${startDateStr} - ${endDateStr}`, pageWidth / 2, pageHeight - 4, { align: 'center' })

    // Apri il PDF in una nuova scheda: decidi tu se salvarlo
    window.open(doc.output('bloburl'), '_blank')
  }, [weekStart, events, sessions, expiringCertificates, overdueFees, absentCount, injuryCount])

  useEffect(() => {
    const handler = () => generatePDF()
    window.addEventListener('export-resoconto-pdf', handler)
    return () => window.removeEventListener('export-resoconto-pdf', handler)
  }, [generatePDF])

  const dark = embedInLayout

  if (loading) {
    return (
      <div className={`min-h-screen ${dark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        {!embedInLayout && <Header title="Resoconto Settimanale" hideCenterLogo />}
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-slate-900 text-white' : 'bg-gray-50'}`}>
      {!embedInLayout && (
        <Header
          title="Resoconto Settimanale"
          hideCenterLogo
          rightButton={
            <button
              onClick={generatePDF}
              className="p-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Esporta PDF"
            >
              <FileDown className="w-6 h-6" strokeWidth={2} />
            </button>
          }
        />
      )}
      <div className="max-w-6xl mx-auto p-6">
        {/* Header con navigazione settimana */}
        <div className={`flex items-center justify-between mb-6 p-4 rounded-2xl ${dark ? 'bg-slate-800/50' : 'bg-white shadow'} border ${dark ? 'border-white/10' : 'border-gray-200'}`}>
          <button
            onClick={prevWeek}
            className={`p-2 rounded-xl transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h2 className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
              {formatWeekRange()}
            </h2>
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-blue-500 hover:text-blue-600 mt-1"
            >
              Vai a questa settimana
            </button>
          </div>
          <button
            onClick={nextWeek}
            className={`p-2 rounded-xl transition-colors ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Riepilogo settimana - card riassuntive */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => navigate('/alerts')}
            className={`p-4 rounded-2xl text-left transition-colors ${dark ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30' : 'bg-amber-50 hover:bg-amber-100 border border-amber-200'}`}
          >
            <Stethoscope className={`w-6 h-6 mb-2 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
            <p className={`font-semibold ${dark ? 'text-amber-200' : 'text-amber-800'}`}>Visite mediche in scadenza</p>
            <p className={`text-2xl font-bold mt-1 ${dark ? 'text-white' : 'text-amber-900'}`}>{expiringCertificates.length}</p>
          </button>
          <button
            onClick={() => navigate('/fees')}
            className={`p-4 rounded-2xl text-left transition-colors ${dark ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 hover:bg-red-100 border border-red-200'}`}
          >
            <CreditCard className={`w-6 h-6 mb-2 ${dark ? 'text-red-400' : 'text-red-600'}`} />
            <p className={`font-semibold ${dark ? 'text-red-200' : 'text-red-800'}`}>Quote scadute</p>
            <p className={`text-2xl font-bold mt-1 ${dark ? 'text-white' : 'text-red-900'}`}>{overdueFees.length}</p>
          </button>
          <button
            onClick={() => navigate('/attendance')}
            className={`p-4 rounded-2xl text-left transition-colors ${dark ? 'bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30' : 'bg-orange-50 hover:bg-orange-100 border border-orange-200'}`}
          >
            <UserX className={`w-6 h-6 mb-2 ${dark ? 'text-orange-400' : 'text-orange-600'}`} />
            <p className={`font-semibold ${dark ? 'text-orange-200' : 'text-orange-800'}`}>Assenze da confermare</p>
            <p className={`text-2xl font-bold mt-1 ${dark ? 'text-white' : 'text-orange-900'}`}>{absentCount}</p>
          </button>
          <button
            onClick={() => navigate('/infortuni')}
            className={`p-4 rounded-2xl text-left transition-colors ${dark ? 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30' : 'bg-purple-50 hover:bg-purple-100 border border-purple-200'}`}
          >
            <Activity className={`w-6 h-6 mb-2 ${dark ? 'text-purple-400' : 'text-purple-600'}`} />
            <p className={`font-semibold ${dark ? 'text-purple-200' : 'text-purple-800'}`}>Infortuni aperti</p>
            <p className={`text-2xl font-bold mt-1 ${dark ? 'text-white' : 'text-purple-900'}`}>{injuryCount}</p>
          </button>
        </div>

        {/* Calendario giorni della settimana */}
        <div className="space-y-4">
          {weekDays.map((day) => {
            const { partite, altriEventi, allenamenti } = getItemsForDay(day)
            const hasContent = partite.length > 0 || altriEventi.length > 0 || allenamenti.length > 0
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
            const isToday = dateStr === new Date().toISOString().split('T')[0]

            return (
              <div
                key={dateStr}
                className={`rounded-2xl overflow-hidden border ${dark ? 'bg-slate-800/30 border-white/10' : 'bg-white border-gray-200'} ${isToday ? (dark ? 'ring-2 ring-blue-500' : 'ring-2 ring-blue-400') : ''}`}
              >
                <div className={`px-4 py-3 flex items-center gap-2 ${dark ? 'bg-slate-700/50' : 'bg-gray-50'} border-b ${dark ? 'border-white/10' : 'border-gray-200'}`}>
                  <Calendar className={`w-5 h-5 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {isToday && <span className="ml-2 text-sm px-2 py-0.5 rounded-full bg-blue-500 text-white">Oggi</span>}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {!hasContent ? (
                    <p className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Nessuna attività programmata</p>
                  ) : (
                    <>
                      {partite.length > 0 && (
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
                            <Trophy className="w-4 h-4" /> Partite ({partite.length})
                          </h4>
                          <ul className="space-y-1">
                            {partite.map((e: any) => (
                              <li key={e.id} className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {(e.start_time || e.event_time || '').toString().substring(0, 5)} – {e.title}
                                {(e.categories?.code || e.categories?.name) && (
                                  <span className="ml-1 text-xs opacity-75">({getCategoryAbbreviation(e.categories?.code || e.categories?.name)})</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {allenamenti.length > 0 && (
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            <Dumbbell className="w-4 h-4" /> Allenamenti ({allenamenti.length})
                          </h4>
                          <ul className="space-y-1">
                            {allenamenti.map((s: any) => (
                              <li key={s.id} className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {(s.start_time || s.end_time || '').toString().substring(0, 5)} – {s.location || s.away_place || '-'}
                                {(s.categories?.code || s.categories?.name) && (
                                  <span className="ml-1 text-xs opacity-75">({getCategoryAbbreviation(s.categories?.code || s.categories?.name)})</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {altriEventi.length > 0 && (
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${dark ? 'text-blue-400' : 'text-blue-700'}`}>
                            <FileText className="w-4 h-4" /> Eventi ({altriEventi.length})
                          </h4>
                          <ul className="space-y-1">
                            {altriEventi.map((e: any) => (
                              <li key={e.id} className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {(e.start_time || e.event_time || '').toString().substring(0, 5)} – {EVENT_TYPE_LABELS[e.event_type] || e.event_type}: {e.title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Dettaglio visite mediche e quote (se presenti) */}
        {(expiringCertificates.length > 0 || overdueFees.length > 0) && (
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {expiringCertificates.length > 0 && (
              <div className={`rounded-2xl p-6 border ${dark ? 'bg-slate-800/30 border-white/10' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-semibold mb-4 flex items-center gap-2 ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
                  <Stethoscope className="w-5 h-5" /> Visite mediche in scadenza
                </h3>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {expiringCertificates.map((c: any) => {
                    const days = Math.ceil((new Date(c.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return (
                      <li key={c.id} className={`text-sm flex justify-between ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span>{c.people?.full_name || '-'}</span>
                        <span className={days <= 0 ? 'text-red-500 font-medium' : ''}>
                          {new Date(c.expiry_date).toLocaleDateString('it-IT')} ({days <= 0 ? 'Scaduto' : `${days} gg`})
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <button
                  onClick={() => navigate('/alerts')}
                  className="mt-4 text-sm text-blue-500 hover:text-blue-600 font-medium"
                >
                  Vedi tutti →
                </button>
              </div>
            )}
            {overdueFees.length > 0 && (
              <div className={`rounded-2xl p-6 border ${dark ? 'bg-slate-800/30 border-white/10' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-semibold mb-4 flex items-center gap-2 ${dark ? 'text-red-400' : 'text-red-700'}`}>
                  <CreditCard className="w-5 h-5" /> Quote scadute
                </h3>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {overdueFees.slice(0, 10).map((f: any) => (
                    <li key={f.id} className={`text-sm flex justify-between ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span>{f.people?.full_name || '-'} ({f.fees?.name || 'Quota'})</span>
                      <span className="font-medium">{formatCurrency((f.amount || 0) / 100)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/fees')}
                  className="mt-4 text-sm text-blue-500 hover:text-blue-600 font-medium"
                >
                  Vedi tutti →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
