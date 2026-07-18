import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'
import RugbyClubFormModal, {
  type RugbyClubFormValues,
  defaultRugbyClubFormValues,
} from '@/components/RugbyClubFormModal'
import { toast } from 'sonner'
import { Globe2, MapPin, Plus, RotateCcw, Search, Users } from 'lucide-react'
import ClubSocietyCard from '@/components/ClubSocietyCard'
import {
  deleteOriginClubLogo,
  uploadOriginClubLogoFromDataUrl,
} from '@/lib/originClubLogos'
import { normalizeItalianPhone } from '@/lib/formatItalianPhone'
import { isValidListOption } from '@/components/ListAutocomplete'
import { ITALIAN_REGIONS } from '@/lib/italianRegions'
import { RUGBY_CLUB_COUNTRIES } from '@/lib/rugbyClubCountries'
import { toTitleCase } from '@/lib/toTitleCase'

interface ClubContact {
  name: string
  role: string
  phone?: string
  email?: string
}

interface ClubRecord {
  id: string
  name: string
  sort_order: number
  created_at: string
  is_italian?: boolean
  region?: string | null
  contacts?: ClubContact[]
  logo_url?: string | null
}

interface ClubsManagementProps {
  embedInLayout?: boolean
}

function buildContactsPayload(contacts: RugbyClubFormValues['contacts']): ClubContact[] {
  return contacts
    .filter((c) => c.name.trim() || c.role.trim() || c.phone.trim() || c.email.trim())
    .map(({ name, role, phone, email }) => ({
      name: name.trim(),
      role: role.trim(),
      ...(phone.trim() ? { phone: normalizeItalianPhone(phone) } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
    }))
}

function clubToFormValues(club: ClubRecord): RugbyClubFormValues {
  const base = defaultRugbyClubFormValues()
  const contacts =
    Array.isArray(club.contacts) && club.contacts.length > 0
      ? club.contacts.map((c) => ({
          id: crypto.randomUUID(),
          name: c.name || '',
          role: c.role || '',
          phone: c.phone ? normalizeItalianPhone(c.phone) : '',
          email: c.email || '',
        }))
      : base.contacts

  return {
    name: club.name,
    isItalian: club.is_italian !== false,
    region: club.region || '',
    contacts,
    logoUrl: club.logo_url || '',
    logoChange: null,
  }
}

function isDuplicateClubName(name: string, clubs: ClubRecord[], excludeId?: string) {
  const normalized = name.trim()
  return clubs.some(
    (c) =>
      c.id !== excludeId &&
      c.name.localeCompare(normalized, 'it', { sensitivity: 'base' }) === 0
  )
}

export default function ClubsManagement({ embedInLayout = false }: ClubsManagementProps) {
  const [clubs, setClubs] = useState<ClubRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClub, setEditingClub] = useState<ClubRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'societa' | 'regioni'>('societa')
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)

  const italianClubs = clubs.filter((club) => club.is_italian !== false).length
  const foreignClubs = clubs.length - italianClubs
  const clubsWithContacts = clubs.filter((club) => Array.isArray(club.contacts) && club.contacts.length > 0).length
  const filteredClubs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return clubs

    return clubs.filter((club) => {
      const contactsText = Array.isArray(club.contacts)
        ? club.contacts
            .map((contact) => [contact.name, contact.role, contact.phone, contact.email].filter(Boolean).join(' '))
            .join(' ')
        : ''

      return [club.name, club.region || '', contactsText]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [clubs, searchTerm])
  const regionGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; isItalian: boolean; clubs: ClubRecord[] }>()

    filteredClubs.forEach((club) => {
      const isItalian = club.is_italian !== false
      const label = club.region?.trim() || (isItalian ? 'Area non indicata' : 'Estera')
      const key = `${isItalian ? 'italia' : 'estero'}:${label}`
      const existing = groups.get(key)

      if (existing) {
        existing.clubs.push(club)
      } else {
        groups.set(key, { key, label, isItalian, clubs: [club] })
      }
    })

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }))
  }, [filteredClubs])

  const modalInitialValues = useMemo(
    () => (editingClub ? clubToFormValues(editingClub) : null),
    [editingClub]
  )

  useEffect(() => {
    loadClubs()
  }, [])

  useEffect(() => {
    setExpandedRegion(null)
  }, [searchTerm])

  const loadClubs = async () => {
    try {
      const { data, error } = await supabase
        .from('origin_clubs')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      const sorted = (data || []).sort((a, b) =>
        a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
      )
      setClubs(sorted)
    } catch (error: any) {
      console.error('Errore caricamento società:', error)
      toast.error('Errore nel caricamento delle società')
    }
  }

  const closeModal = () => {
    if (loading) return
    setModalOpen(false)
    setEditingClub(null)
  }

  const openAddModal = () => {
    setEditingClub(null)
    setModalOpen(true)
  }

  const openEditModal = (club: ClubRecord) => {
    setEditingClub(club)
    setModalOpen(true)
  }

  const saveClubPayload = (values: RugbyClubFormValues, logoUrl?: string | null) => ({
    name: toTitleCase(values.name),
    is_italian: values.isItalian,
    region: values.region.trim() || null,
    contacts: buildContactsPayload(values.contacts),
    ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
  })

  const resolveLogoUrl = async (
    clubId: string,
    currentLogoUrl: string | null | undefined,
    logoChange: RugbyClubFormValues['logoChange']
  ) => {
    if (logoChange === null) return currentLogoUrl ?? null
    if (logoChange === 'remove') {
      await deleteOriginClubLogo(clubId, currentLogoUrl)
      return null
    }
    if (logoChange.startsWith('data:')) {
      return uploadOriginClubLogoFromDataUrl(clubId, logoChange)
    }
    return currentLogoUrl ?? null
  }

  const handleSubmit = async (values: RugbyClubFormValues) => {
    const name = values.name.trim()
    if (!name) {
      toast.error('Inserisci il nome della società')
      return
    }
    if (!values.region.trim()) {
      toast.error(values.isItalian ? 'Seleziona la regione' : 'Seleziona la nazione')
      return
    }
    const locationOptions = values.isItalian ? ITALIAN_REGIONS : RUGBY_CLUB_COUNTRIES
    if (!isValidListOption(values.region, locationOptions)) {
      toast.error(
        values.isItalian
          ? 'Seleziona una regione valida dall\'elenco'
          : 'Seleziona una nazione valida dall\'elenco'
      )
      return
    }
    if (isDuplicateClubName(name, clubs, editingClub?.id)) {
      toast.error('Esiste già una società con questo nome')
      return
    }
    setLoading(true)
    setMessage('')
    try {
      if (editingClub) {
        const logoUrl = await resolveLogoUrl(editingClub.id, editingClub.logo_url, values.logoChange)
        const { error } = await supabase
          .from('origin_clubs')
          .update(saveClubPayload(values, logoUrl))
          .eq('id', editingClub.id)

        if (error) throw error
        toast.success('Società aggiornata')
      } else {
        const maxOrder = clubs.length > 0 ? Math.max(...clubs.map((c) => c.sort_order), 0) : 0
        const { data: inserted, error } = await supabase
          .from('origin_clubs')
          .insert({
            ...saveClubPayload(values),
            sort_order: maxOrder + 1,
          })
          .select('id')
          .single()

        if (error) throw error

        if (values.logoChange && values.logoChange !== 'remove' && values.logoChange.startsWith('data:')) {
          const logoUrl = await uploadOriginClubLogoFromDataUrl(inserted.id, values.logoChange)
          const { error: logoError } = await supabase
            .from('origin_clubs')
            .update({ logo_url: logoUrl })
            .eq('id', inserted.id)
          if (logoError) throw logoError
        }

        toast.success('Società aggiunta')
      }
      closeModal()
      loadClubs()
    } catch (error: any) {
      console.error('Errore salvataggio società:', error)
      if (error?.code === '23505') {
        toast.error('Questa società è già presente')
      } else if (
        error?.message?.includes('logo_url') ||
        error?.message?.includes('column') ||
        error?.code === 'PGRST204'
      ) {
        toast.error('Esegui add_origin_club_logo.sql su Supabase per aggiungere la colonna logo_url')
      } else if (
        error?.message?.includes('brand') ||
        error?.message?.includes('Bucket') ||
        error?.message?.includes('bucket') ||
        error?.statusCode === '404'
      ) {
        toast.error('Configura il bucket Storage "brand" in Supabase (vedi setup_logo_app_mobile.sql)')
      } else {
        toast.error(error?.message || 'Errore nel salvataggio')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminare la società "${name}"?`)) return
    try {
      const club = clubs.find((c) => c.id === id)
      const { error } = await supabase.from('origin_clubs').delete().eq('id', id)
      if (error) throw error
      if (club?.logo_url) {
        await deleteOriginClubLogo(id, club.logo_url)
      }
      toast.success('Società eliminata')
      if (editingClub?.id === id) closeModal()
      loadClubs()
    } catch (error: any) {
      toast.error(error?.message || 'Errore nell\'eliminazione')
    }
  }

  return (
    <div className={embedInLayout ? 'min-h-full bg-slate-100 text-slate-950' : 'min-h-screen bg-slate-100'}>
      {!embedInLayout && <Header title="Altre Società" showBack={true} />}

      <div className="w-full px-6 py-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-7 text-white shadow-2xl shadow-slate-950/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">Altre Società</h1>
            <p className="max-w-xl text-sm leading-6 text-slate-300 lg:text-right">
              Elenco delle società usato per la squadra di origine dei giocatori e per la selezione delle squadre
              negli eventi (partite, tornei, feste del rugby, ecc.).
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Totale</p>
              <p className="mt-1 text-2xl font-bold text-white">{clubs.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Italiane</p>
              <p className="mt-1 text-2xl font-bold text-teal-200">{italianClubs}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estere</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">{foreignClubs}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Con referenti</p>
              <p className="mt-1 text-2xl font-bold text-blue-200">{clubsWithContacts}</p>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full xl:w-[calc((100%-1rem)/2)] 2xl:w-[calc((100%-2rem)/3)]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cerca per società, regione o referente..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-12 text-sm font-medium text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                title="Cancella ricerca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode('societa')
                setExpandedRegion(null)
              }}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition ${
                viewMode === 'societa'
                  ? 'bg-slate-950 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Società
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('regioni')
                setExpandedRegion(null)
              }}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition ${
                viewMode === 'regioni'
                  ? 'bg-slate-950 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Regione
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Aggiungi società
            </button>
          </div>
        </div>

        <div>
          <ul
            className={`grid gap-4 ${
              viewMode === 'regioni' && expandedRegion
                ? 'grid-cols-1'
                : 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'
            }`}
          >
            {filteredClubs.length === 0 ? (
              <li className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-sm">
                Nessuna società. Clicca «Aggiungi società» per inserirne una.
              </li>
            ) : viewMode === 'regioni' ? (
              (expandedRegion ? regionGroups.filter((g) => g.key === expandedRegion) : regionGroups).map((group) => {
                const isOpen = expandedRegion === group.key
                return (
                  <li
                    key={group.key}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-xl ${
                      isOpen
                        ? 'col-span-full border-teal-300 ring-4 ring-teal-100'
                        : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRegion(isOpen ? null : group.key)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                    >
                      <div className="flex min-w-0 gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${
                          group.isItalian ? 'bg-teal-700' : 'bg-amber-600'
                        }`}>
                          {group.isItalian ? <MapPin className="h-6 w-6" /> : <Globe2 className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold text-slate-950">{group.label}</h3>
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            {group.clubs.length} societ{group.clubs.length === 1 ? 'à' : 'à'}
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        isOpen ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isOpen ? 'Chiudi' : 'Apri'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {group.clubs.map((club) => (
                            <ClubSocietyCard
                              key={club.id}
                              club={club}
                              onEdit={() => openEditModal(club)}
                              onDelete={() => handleDelete(club.id, club.name)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })
            ) : (
              filteredClubs.map((club) => (
                <li key={club.id} className="list-none">
                  <ClubSocietyCard
                    club={club}
                    onEdit={() => openEditModal(club)}
                    onDelete={() => handleDelete(club.id, club.name)}
                    meta={
                      <div className="flex flex-col items-start gap-1">
                        {club.region && (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                            club.is_italian !== false
                              ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100'
                              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
                          }`}>
                            {club.is_italian !== false ? <MapPin className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}
                            {club.region}
                          </span>
                        )}
                        {club.is_italian === false && !club.region && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                            <Globe2 className="h-3.5 w-3.5" />
                            Estera
                          </span>
                        )}
                        {Array.isArray(club.contacts) && club.contacts.length > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                            <Users className="h-3.5 w-3.5" />
                            {club.contacts.length} referent{club.contacts.length === 1 ? 'e' : 'i'}
                          </span>
                        )}
                      </div>
                    }
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <RugbyClubFormModal
        open={modalOpen}
        mode={editingClub ? 'edit' : 'add'}
        initialValues={modalInitialValues}
        loading={loading}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
