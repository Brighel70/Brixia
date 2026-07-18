import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { getBrandConfig } from '@/config/brand'
import { ClipboardCheck, TrendingUp, BarChart2, Calendar } from 'lucide-react'

/** Stagione sportiva: 1° luglio – 30 giugno (come FeesManagement / Activities). */
function getSeasonStartDate(): string {
  const now = new Date()
  const year = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear()
  return `${year}-07-01`
}

function getSeasonEndDate(): string {
  const start = getSeasonStartDate()
  const y = parseInt(start.slice(0, 4), 10)
  return `${y + 1}-06-30`
}

/** Tutti i mesi della stagione in ordine: luglio … giugno (chiavi YYYY-MM). */
function getSeasonMonthKeys(): string[] {
  const start = getSeasonStartDate()
  const end = getSeasonEndDate()
  const keys: string[] = []
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return keys
}

export interface CategoryAttendanceStats {
  categoryId: string
  categoryName: string
  categoryCode: string
  totalSessions: number
  totalRecords: number
  presentCount: number
  percentage: number
  monthlyData: Array<{ month: string; sessions: number; present: number; percentage: number }>
  /** Se impostato, viene mostrato al posto di "X presenti su Y registrazioni" (es. card Senior = media Serie C e Serie B). */
  customSubtitle?: string
}

/** Ordina le categorie mettendo Senior/Seniores sempre per ultima a destra. */
function sortCategoriesSeniorLast<T extends { categoryName: string; categoryCode: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const aIsSenior = /senior/i.test(a.categoryName) || /seniores/i.test(a.categoryCode)
    const bIsSenior = /senior/i.test(b.categoryName) || /seniores/i.test(b.categoryCode)
    if (aIsSenior && !bIsSenior) return 1
    if (!aIsSenior && bIsSenior) return -1
    return 0
  })
}

interface AttendanceOverviewProps {
  embedInLayout?: boolean
}

export default function AttendanceOverview({ embedInLayout = false }: AttendanceOverviewProps) {
  const navigate = useNavigate()
  const brand = getBrandConfig()
  const { primary, secondary, dark } = brand.colors

  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [perCategory, setPerCategory] = useState<CategoryAttendanceStats[]>([])
  const [globalMonthly, setGlobalMonthly] = useState<Array<{ month: string; sessions: number; present: number; percentage: number }>>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const seasonStart = getSeasonStartDate()
      const seasonEnd = getSeasonEndDate()
      const today = new Date().toISOString().slice(0, 10)
      const endDate = today < seasonEnd ? today : seasonEnd

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, code')
        .eq('active', true)
        .order('sort', { ascending: true })

      if (!categoriesData?.length) {
        setCategories([])
        setPerCategory([])
        setGlobalMonthly([])
        setLoading(false)
        return
      }

      setCategories(categoriesData as Array<{ id: string; name: string; code: string }>)

      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('id, category_id, session_date')
        .gte('session_date', seasonStart)
        .lte('session_date', endDate)
        .order('session_date', { ascending: true })

      const sessions = sessionsData || []
      const sessionIds = sessions.map((s: any) => s.id)
      if (sessionIds.length === 0) {
        const empty = categoriesData.map((c: any) => ({
          categoryId: c.id,
          categoryName: c.name,
          categoryCode: c.code || c.name,
          totalSessions: 0,
          totalRecords: 0,
          presentCount: 0,
          percentage: 0,
          monthlyData: []
        }))
        setPerCategory(sortCategoriesSeniorLast(empty))
        setGlobalMonthly([])
        setLoading(false)
        return
      }

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('session_id, player_id, status')
        .in('session_id', sessionIds)

      const attendance = attendanceData || []
      const sessionById = Object.fromEntries(sessions.map((s: any) => [s.id, s]))

      const getMonthKey = (dateStr: string) => dateStr.slice(0, 7)
      /** Label asse: "10/25" invece del nome mese (Ott 25). */
      const getMonthLabel = (dateStr: string) => {
        const [y, m] = dateStr.split('-')
        const mm = m ? String(parseInt(m, 10)).padStart(2, '0') : '01'
        const yy = y ? y.slice(-2) : '00'
        return `${mm}/${yy}`
      }

      const byCategory: Record<string, CategoryAttendanceStats> = {}
      for (const c of categoriesData as Array<{ id: string; name: string; code: string }>) {
        byCategory[c.id] = {
          categoryId: c.id,
          categoryName: c.name,
          categoryCode: c.code || c.name,
          totalSessions: 0,
          totalRecords: 0,
          presentCount: 0,
          percentage: 0,
          monthlyData: []
        }
      }

      const globalByMonth: Record<string, { sessions: number; present: number; total: number }> = {}

      sessions.forEach((s: any) => {
        const catId = s.category_id
        if (!byCategory[catId]) return
        byCategory[catId].totalSessions++
        const monthKey = getMonthKey(s.session_date)
        if (!globalByMonth[monthKey]) globalByMonth[monthKey] = { sessions: 0, present: 0, total: 0 }
        globalByMonth[monthKey].sessions++
      })

      /** Per (categoryId, playerId): totale registrazioni e presenti (per calcolare media tra giocatori). */
      const byCategoryPlayer: Record<string, Record<string, { total: number; present: number }>> = {}
      attendance.forEach((att: any) => {
        const session = sessionById[att.session_id]
        if (!session) return
        const catId = session.category_id
        if (!byCategory[catId]) return
        byCategory[catId].totalRecords++
        if (att.status === 'PRESENTE') byCategory[catId].presentCount++
        const playerId = att.player_id
        if (!byCategoryPlayer[catId]) byCategoryPlayer[catId] = {}
        if (!byCategoryPlayer[catId][playerId]) byCategoryPlayer[catId][playerId] = { total: 0, present: 0 }
        byCategoryPlayer[catId][playerId].total++
        if (att.status === 'PRESENTE') byCategoryPlayer[catId][playerId].present++
        const monthKey = getMonthKey(session.session_date)
        if (globalByMonth[monthKey]) {
          globalByMonth[monthKey].total++
          if (att.status === 'PRESENTE') globalByMonth[monthKey].present++
        }
      })

      const categoryMonthly: Record<string, Record<string, { sessions: number; present: number; total: number }>> = {}
      sessions.forEach((s: any) => {
        const catId = s.category_id
        if (!categoryMonthly[catId]) categoryMonthly[catId] = {}
        const monthKey = getMonthKey(s.session_date)
        if (!categoryMonthly[catId][monthKey]) categoryMonthly[catId][monthKey] = { sessions: 0, present: 0, total: 0 }
        categoryMonthly[catId][monthKey].sessions++
      })
      attendance.forEach((att: any) => {
        const session = sessionById[att.session_id]
        if (!session) return
        const catId = session.category_id
        const monthKey = getMonthKey(session.session_date)
        if (categoryMonthly[catId]?.[monthKey]) {
          categoryMonthly[catId][monthKey].total++
          if (att.status === 'PRESENTE') categoryMonthly[catId][monthKey].present++
        }
      })

      const sortedMonths = Object.keys(globalByMonth).sort()
      /** Asse da luglio a giugno compreso: grafico "parti da destra" con giugno a destra. */
      const seasonMonthKeys = getSeasonMonthKeys()
      setGlobalMonthly(
        seasonMonthKeys.map((key) => {
          const v = globalByMonth[key] || { sessions: 0, present: 0, total: 0 }
          const pct = v.total > 0 ? Math.round((v.present / v.total) * 100) : 0
          return {
            month: getMonthLabel(key + '-01'),
            sessions: v.sessions,
            present: v.present,
            percentage: pct
          }
        })
      )

      const result = (categoriesData as Array<{ id: string; name: string; code: string }>).map((c) => {
        const stat = byCategory[c.id]
        // Percentuale = media delle percentuali di presenza di ogni singolo giocatore (non totale presenti/totale registrazioni)
        const playersInCat = byCategoryPlayer[c.id] ? Object.values(byCategoryPlayer[c.id]) : []
        const playerPercentages = playersInCat
          .filter((p) => p.total > 0)
          .map((p) => (p.present / p.total) * 100)
        stat.percentage =
          playerPercentages.length > 0
            ? Math.round(playerPercentages.reduce((a, b) => a + b, 0) / playerPercentages.length)
            : 0
        stat.monthlyData = seasonMonthKeys.map((key) => {
          const v = categoryMonthly[c.id]?.[key] || { sessions: 0, present: 0, total: 0 }
          const pct = v.total > 0 ? Math.round((v.present / v.total) * 100) : 0
          return {
            month: getMonthLabel(key + '-01'),
            sessions: v.sessions,
            present: v.present,
            percentage: pct
          }
        })
        return stat
      })

      // Card Senior/Seniores: percentuale = media tra Serie C e Serie B (non i dati della categoria Senior)
      const isSerieB = (s: CategoryAttendanceStats) => /serie\s*b/i.test(s.categoryName) || /serie_b/i.test(s.categoryCode)
      const isSerieC = (s: CategoryAttendanceStats) => /serie\s*c/i.test(s.categoryName) || /serie_c/i.test(s.categoryCode)
      const isSenior = (s: CategoryAttendanceStats) => /senior/i.test(s.categoryName) || /seniores/i.test(s.categoryCode)
      const serieB = result.find(isSerieB)
      const serieC = result.find(isSerieC)
      const seniorStat = result.find(isSenior)
      if (seniorStat && (serieB || serieC)) {
        const pctB = serieB?.percentage ?? 0
        const pctC = serieC?.percentage ?? 0
        const count = [serieB, serieC].filter(Boolean).length
        seniorStat.percentage = Math.round((pctB + pctC) / count)
        seniorStat.customSubtitle = 'Media tra Serie C e Serie B'
        // Andamento mensile Senior = media mensile di Serie B e Serie C (per il grafico "Andamento per categoria")
        seniorStat.monthlyData = seniorStat.monthlyData.map((m, i) => {
          const b = serieB?.monthlyData[i]?.percentage ?? 0
          const c = serieC?.monthlyData[i]?.percentage ?? 0
          const avg = Math.round((b + c) / count)
          return { ...m, percentage: avg }
        })
      }

      setPerCategory(sortCategoriesSeniorLast(result))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className={embedInLayout ? 'min-h-full' : ''}>
        {!embedInLayout && <Header title="Presenze" />}
        <div className="p-8 text-center" style={{ background: embedInLayout ? undefined : `linear-gradient(180deg, ${primary} 0%, ${dark} 100%)`, minHeight: embedInLayout ? '40vh' : '40vh' }}>
          <p className="text-white/90">Caricamento presenze stagione in corso...</p>
        </div>
      </div>
    )
  }

  const seasonStart = getSeasonStartDate()
  const seasonLabel = `${seasonStart.slice(0, 4)}/${String(parseInt(seasonStart.slice(0, 4), 10) + 1).slice(2, 4)}`

  return (
    <div className={embedInLayout ? 'min-h-full' : 'min-h-screen'} style={{ background: embedInLayout ? undefined : `linear-gradient(180deg, ${primary} 0%, ${dark} 50%, #0f172a 100%)` }}>
      {!embedInLayout && <Header title="Presenze" />}
      <div className="w-full p-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-white/90">
            Stagione <strong>{seasonLabel}</strong> – da inizio stagione a oggi
          </p>
          <button
            type="button"
            onClick={() => navigate('/activities')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: secondary }}
          >
            <ClipboardCheck className="w-5 h-5" />
            Segna presenze (Allenamenti)
          </button>
        </div>

        {/* Presenze per categoria */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5" style={{ color: secondary }} />
            Presenze per categoria
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {perCategory.map((cat) => (
              <div
                key={cat.categoryId}
                className="rounded-2xl border p-5 shadow-lg backdrop-blur-sm"
                style={{
                  background: `linear-gradient(145deg, ${primary} 0%, ${dark} 100%)`,
                  borderColor: `${secondary}40`
                }}
              >
                <div className="font-semibold text-white mb-1">{cat.categoryName}</div>
                <div className="text-2xl font-bold text-white">{cat.percentage}%</div>
                <div className="text-sm text-white/70 mt-1">
                  {cat.customSubtitle ?? `${cat.presentCount} presenti su ${cat.totalRecords} registrazioni`}
                </div>
                {!cat.customSubtitle && (
                  <div className="text-xs text-white/60 mt-1">{cat.totalSessions} sessioni</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Andamento mensile (globale) */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: secondary }} />
            Andamento presenze (tutte le categorie)
          </h2>
          <div
            className="rounded-2xl border p-6 shadow-lg"
            style={{
              background: `linear-gradient(160deg, ${primary} 0%, ${dark} 100%)`,
              borderColor: `${secondary}40`
            }}
          >
            {globalMonthly.length === 0 ? (
              <p className="text-white/70">Nessun dato in stagione.</p>
            ) : (
              <div className="w-full">
                {/* Grafico a linee: tutta la larghezza della card, asse Y 0–100%, soglia 85% */}
                <svg
                  viewBox="0 0 520 200"
                  className="w-full block"
                  style={{ aspectRatio: '520/200', minHeight: 180 }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="attendance-line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={secondary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={secondary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const n = globalMonthly.length
                    const pad = { left: 48, right: 32, top: 20, bottom: 40 }
                    const chartW = 520 - pad.left - pad.right
                    const chartH = 200 - pad.top - pad.bottom
                    const yScale = (pct: number) => pad.top + chartH - (pct / 100) * chartH
                    const points = globalMonthly.map((m, i) => {
                      const x = pad.left + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW)
                      return { x, y: yScale(m.percentage), ...m }
                    })
                    const lineD = points.map((p) => `${p.x},${p.y}`).join(' ')
                    const bottomY = pad.top + chartH
                    const areaD = lineD
                      ? `M ${points[0].x},${bottomY} L ${lineD.replace(/\s/g, ' L ')} L ${points[points.length - 1].x},${bottomY} Z`
                      : ''

                    return (
                      <>
                        {/* Griglia orizzontale (0, 25, 50, 75, 100%) */}
                        {[0, 25, 50, 75, 100].map((pct) => {
                          const y = yScale(pct)
                          return (
                            <line
                              key={pct}
                              x1={pad.left}
                              x2={520 - pad.right}
                              y1={y}
                              y2={y}
                              stroke="rgba(255,255,255,0.08)"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                          )
                        })}
                        {/* Asse Y: label 0%, 50%, 100% */}
                        {[0, 50, 100].map((pct) => (
                          <text
                            key={pct}
                            x={pad.left - 8}
                            y={yScale(pct) + 4}
                            textAnchor="end"
                            className="fill-white/50 text-[10px] font-medium tabular-nums"
                          >
                            {pct}%
                          </text>
                        ))}
                        {/* Soglia minima 85%: linea orizzontale che delimita la soglia da stare sopra */}
                        {(() => {
                          const y85 = yScale(85)
                          return (
                            <>
                              <line
                                x1={pad.left}
                                x2={520 - pad.right}
                                y1={y85}
                                y2={y85}
                                stroke="rgba(34, 197, 94, 0.9)"
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                              />
                              <text
                                x={520 - pad.right + 6}
                                y={y85 + 4}
                                textAnchor="start"
                                className="text-[10px] font-medium"
                                style={{ fill: 'rgb(52, 211, 153)' }}
                              >
                                85% soglia min.
                              </text>
                            </>
                          )
                        })()}
                        {/* Area sotto la linea */}
                        {areaD && <path d={areaD} fill="url(#attendance-line-gradient)" />}
                        {/* Linea */}
                        <polyline
                          points={lineD}
                          fill="none"
                          stroke={secondary}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Punti e label % sopra il punto */}
                        {points.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill={secondary} stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
                            <text
                              x={p.x}
                              y={Math.max(pad.top + 12, p.y - 8)}
                              textAnchor="middle"
                              className="fill-white text-[11px] font-semibold tabular-nums"
                            >
                              {p.percentage}%
                            </text>
                          </g>
                        ))}
                        {/* Label mesi sotto (dentro SVG per allineamento preciso) */}
                        {points.map((p, i) => (
                          <text
                            key={i}
                            x={p.x}
                            y={200 - 14}
                            textAnchor="middle"
                            className="fill-white/60 text-[11px]"
                          >
                            {p.month}
                          </text>
                        ))}
                      </>
                    )
                  })()}
                </svg>
              </div>
            )}
          </div>
        </section>

        {/* Andamento per categoria (grafici a barre per categoria) */}
        {perCategory.some((c) => c.monthlyData.some((m) => m.sessions > 0 || m.percentage > 0)) && (
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color: secondary }} />
              Andamento per categoria
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {perCategory
                .filter((c) => c.monthlyData.some((m) => m.sessions > 0 || m.percentage > 0))
                .map((cat) => (
                  <div
                    key={cat.categoryId}
                    className="rounded-2xl border p-4 shadow-lg"
                    style={{
                      background: `linear-gradient(160deg, ${primary} 0%, ${dark} 100%)`,
                      borderColor: `${secondary}40`
                    }}
                  >
                    <div className="font-semibold text-white mb-3">{cat.categoryName}</div>
                    <div className="flex gap-1 items-end">
                      {cat.monthlyData.map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-white text-xs font-medium tabular-nums min-h-[14px]">
                            {m.percentage}%
                          </span>
                          <div className="relative w-full h-28 flex flex-col justify-end rounded-t overflow-hidden bg-white/5">
                            {/* Soglia 85%: linea orizzontale (15% dal top = 85% dal basso) */}
                            <div
                              className="absolute left-0 right-0 top-[15%] z-10 h-0 border-t border-dashed pointer-events-none"
                              style={{ borderColor: 'rgba(34, 197, 94, 0.85)' }}
                            />
                            <div
                              className="w-full rounded-t transition-all overflow-hidden"
                              style={{
                                height: `${Math.min(100, m.percentage)}%`,
                                minHeight: m.percentage > 0 ? 3 : 0,
                                backgroundColor: secondary
                              }}
                            />
                          </div>
                          <span className="text-white/50 text-xs truncate max-w-full">{m.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Confronto con stagione precedente (placeholder) */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Confronto con stagione precedente</h2>
          <div
            className="rounded-2xl border border-dashed p-8 text-center"
            style={{
              background: `${primary}33`,
              borderColor: `${secondary}60`
            }}
          >
            <p className="text-white/80">
              Quando saranno disponibili i dati della stagione precedente, qui vedrai il confronto (media presenze, trend, ecc.).
            </p>
            <p className="text-white/60 text-sm mt-2">Stagione corrente: {seasonLabel}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
