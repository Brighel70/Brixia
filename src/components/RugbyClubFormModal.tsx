import { useEffect, useRef, useState } from 'react'
import {
  Building2,
  Flag,
  Users,
  Plus,
  Trash2,
  Phone,
  Mail,
  UserRound,
  Briefcase,
  Pencil,
  Check,
  Upload,
  ImageIcon,
} from 'lucide-react'
import RegionAutocomplete from '@/components/RegionAutocomplete'
import ListAutocomplete, { isValidListOption } from '@/components/ListAutocomplete'
import { RUGBY_CLUB_COUNTRIES } from '@/lib/rugbyClubCountries'
import { ITALIAN_REGIONS } from '@/lib/italianRegions'
import { formatItalianPhone } from '@/lib/formatItalianPhone'
import { toTitleCase, toTitleCaseInput } from '@/lib/toTitleCase'
import { compressImageDataUrl } from '@/lib/originClubLogos'

export interface ClubContactForm {
  id: string
  name: string
  role: string
  phone: string
  email: string
}

export type RugbyClubLogoChange = null | 'remove' | string

export interface RugbyClubFormValues {
  name: string
  isItalian: boolean
  region: string
  contacts: ClubContactForm[]
  logoUrl: string
  logoChange: RugbyClubLogoChange
}

interface RugbyClubFormModalProps {
  open: boolean
  mode?: 'add' | 'edit'
  initialValues?: RugbyClubFormValues | null
  loading?: boolean
  onClose: () => void
  onSubmit: (values: RugbyClubFormValues) => void | Promise<void>
}

function emptyContact(): ClubContactForm {
  return { id: crypto.randomUUID(), name: '', role: '', phone: '', email: '' }
}

export function defaultRugbyClubFormValues(): RugbyClubFormValues {
  return {
    name: '',
    isItalian: true,
    region: '',
    contacts: [],
    logoUrl: '',
    logoChange: null,
  }
}

function contactHasData(c: ClubContactForm) {
  return !!(c.name.trim() || c.role.trim() || c.phone.trim() || c.email.trim())
}

export default function RugbyClubFormModal({
  open,
  mode = 'add',
  initialValues = null,
  loading = false,
  onClose,
  onSubmit,
}: RugbyClubFormModalProps) {
  const [form, setForm] = useState<RugbyClubFormValues>(defaultRugbyClubFormValues)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [logoZoomOpen, setLogoZoomOpen] = useState(false)
  const [logoZoomPos, setLogoZoomPos] = useState({ top: 0, left: 0 })
  const logoInputRef = useRef<HTMLInputElement>(null)
  const logoThumbRef = useRef<HTMLButtonElement>(null)
  const isEdit = mode === 'edit'

  useEffect(() => {
    if (open) {
      setForm(initialValues ?? defaultRugbyClubFormValues())
      setEditingContactId(null)
      setIsAddingContact(false)
      setLogoZoomOpen(false)
    }
  }, [open, initialValues])

  if (!open) return null

  const updateContact = (id: string, patch: Partial<ClubContactForm>) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }

  const addContact = () => {
    const newC = emptyContact()
    setForm((prev) => ({ ...prev, contacts: [...prev.contacts, newC] }))
    setEditingContactId(newC.id)
    setIsAddingContact(true)
  }

  const removeContact = (id: string) => {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((c) => c.id !== id),
    }))
    if (editingContactId === id) {
      setEditingContactId(null)
      setIsAddingContact(false)
    }
  }

  const startEditContact = (id: string) => {
    setEditingContactId(id)
    setIsAddingContact(false)
  }

  const cancelContactEditor = () => {
    if (isAddingContact && editingContactId) {
      setForm((prev) => ({
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== editingContactId),
      }))
    }
    setEditingContactId(null)
    setIsAddingContact(false)
  }

  const confirmContactEditor = () => {
    if (editingContactId) {
      const current = form.contacts.find((c) => c.id === editingContactId)
      if (current?.phone.trim()) {
        updateContact(editingContactId, { phone: formatItalianPhone(current.phone) })
      }
      if (!current || !contactHasData(current)) {
        setForm((prev) => ({
          ...prev,
          contacts: prev.contacts.filter((c) => c.id !== editingContactId),
        }))
      }
    }
    setEditingContactId(null)
    setIsAddingContact(false)
  }

  const tableContacts = form.contacts.filter(
    (c) => contactHasData(c) && c.id !== editingContactId
  )
  const editingContact = editingContactId
    ? form.contacts.find((c) => c.id === editingContactId)
    : null

  const locationOptions = form.isItalian ? ITALIAN_REGIONS : RUGBY_CLUB_COUNTRIES
  const isFormValid = Boolean(
    form.name.trim() && isValidListOption(form.region, locationOptions)
  )

  const logoPreview =
    form.logoChange === 'remove' ? '' : form.logoChange ?? form.logoUrl

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const result = event.target?.result as string
      const compressed = await compressImageDataUrl(result, 512)
      setForm((prev) => ({ ...prev, logoChange: compressed }))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeLogo = () => {
    setLogoZoomOpen(false)
    setForm((prev) => ({ ...prev, logoChange: 'remove' }))
  }

  const LOGO_THUMB_SIZE = 48
  const LOGO_ZOOM_SIZE = LOGO_THUMB_SIZE * 5

  const openLogoZoom = () => {
    if (!logoPreview || !logoThumbRef.current) return
    const rect = logoThumbRef.current.getBoundingClientRect()
    const top = Math.max(12, rect.top - LOGO_ZOOM_SIZE - 12)
    const left = Math.min(
      window.innerWidth - LOGO_ZOOM_SIZE - 12,
      Math.max(12, rect.left + rect.width / 2 - LOGO_ZOOM_SIZE / 2)
    )
    setLogoZoomPos({ top, left })
    setLogoZoomOpen(true)
  }

  const closeLogoZoom = () => setLogoZoomOpen(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return
    const contacts = form.contacts
      .filter((c) => contactHasData(c))
      .map((c) => ({
        ...c,
        phone: c.phone.trim() ? formatItalianPhone(c.phone) : '',
      }))
    onSubmit({ ...form, name: toTitleCase(form.name), contacts })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30 ring-1 ring-white/20 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header premium */}
        <div className="relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.32),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.22),transparent_42%)]" />
          <div className="relative px-6 py-5 flex items-start gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center overflow-hidden ring-1 ring-white/20">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo società"
                    className="h-full w-full object-contain bg-white p-1.5"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-teal-200" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isEdit ? 'Modifica società' : 'Aggiungi società'}
                </h2>
                <p className="text-sm text-slate-300 mt-0.5">
                  {isEdit ? 'Aggiorna dati anagrafici e referenti' : 'Dati anagrafici e referenti di contatto'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 bg-slate-50">
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            {/* Nome società + logo */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    Nome società <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: toTitleCaseInput(e.target.value) }))
                    }
                    placeholder="Es. Rugby Gussago"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-950 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-400 focus:bg-white transition-all"
                  />
                </div>

                <div className="shrink-0 space-y-2 sm:w-auto">
                  <label
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600"
                    title="Verrà mostrato nelle card e negli altri punti dell'app dove compare la società"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                    Logo
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      ref={logoThumbRef}
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      onMouseEnter={logoPreview ? openLogoZoom : undefined}
                      onMouseLeave={closeLogoZoom}
                      onFocus={logoPreview ? openLogoZoom : undefined}
                      onBlur={closeLogoZoom}
                      title={logoPreview ? 'Passa il mouse per ingrandire' : 'Carica logo'}
                      className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/50"
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Anteprima logo"
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <Upload className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        title="Rimuovi logo"
                        className="flex h-12 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Italiana / Straniera + Regione o Nazione — riga compatta */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer group shrink-0">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.isItalian}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          isItalian: e.target.checked,
                          region: '',
                        }))
                      }
                      className="peer sr-only"
                    />
                    <div className="w-10 h-5 rounded-full bg-slate-300 peer-checked:bg-teal-500 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                  <Flag className={`w-3.5 h-3.5 shrink-0 ${form.isItalian ? 'text-teal-600' : 'text-amber-600'}`} />
                  <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">
                    {form.isItalian ? 'Italiana' : 'Straniera'}
                  </span>
                </label>

                <span className="text-xs font-semibold text-gray-600 shrink-0 w-14 sm:w-auto">
                  {form.isItalian ? 'Regione' : 'Nazione'} <span className="text-red-500">*</span>
                </span>

                <div className="flex-1 min-w-0">
                  {form.isItalian ? (
                    <RegionAutocomplete
                      value={form.region}
                      onChange={(region) => setForm((prev) => ({ ...prev, region }))}
                      compact
                    />
                  ) : (
                    <ListAutocomplete
                      value={form.region}
                      onChange={(nation) => setForm((prev) => ({ ...prev, region: nation }))}
                      options={RUGBY_CLUB_COUNTRIES}
                      placeholder="Cerca..."
                      emptyLabel="Nessuna nazione trovata"
                      compact
                    />
                  )}
                </div>
              </div>
            </section>

            {/* Responsabili — tabella compatta + editor solo in aggiunta/modifica */}
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-semibold text-gray-800">Responsabili da contattare</h3>
                </div>
                {!editingContactId && (
                  <button
                    type="button"
                    onClick={addContact}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi referente
                  </button>
                )}
              </div>

              {tableContacts.length > 0 && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ruolo</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefono</th>
                          <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                          <th className="px-3 py-2 w-20" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableContacts.map((contact) => (
                          <tr key={contact.id} className="hover:bg-teal-50/40 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[120px] truncate" title={contact.name}>
                              {contact.name || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate" title={contact.role}>
                              {contact.role || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs sm:text-sm">
                              {contact.phone || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate" title={contact.email}>
                              {contact.email || '—'}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => startEditContact(contact.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                  title="Modifica"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeContact(contact.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tableContacts.length === 0 && !editingContact && (
                <p className="text-sm text-gray-500 text-center py-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  Nessun referente. Clicca «Aggiungi referente».
                </p>
              )}

              {editingContact && (
                <div className="rounded-2xl border border-teal-300 bg-gradient-to-br from-white to-teal-50/60 p-4 shadow-lg shadow-teal-500/10 ring-4 ring-teal-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
                      {isAddingContact ? 'Nuovo referente' : 'Modifica referente'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                        <UserRound className="w-3.5 h-3.5" />
                        Nome e cognome
                      </label>
                      <input
                        type="text"
                        value={editingContact.name}
                        onChange={(e) => updateContact(editingContact.id, { name: e.target.value })}
                        placeholder="Es. Mario Rossi"
                        autoFocus
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-950 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        Ruolo
                      </label>
                      <input
                        type="text"
                        value={editingContact.role}
                        onChange={(e) => updateContact(editingContact.id, { role: e.target.value })}
                        placeholder="Es. Presidente"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-950 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        Telefono
                      </label>
                      <input
                        type="tel"
                        value={editingContact.phone}
                        onChange={(e) => updateContact(editingContact.id, { phone: e.target.value })}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v) updateContact(editingContact.id, { phone: formatItalianPhone(v) })
                        }}
                        placeholder="+39 333 1234567"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-950 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-400"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={editingContact.email}
                        onChange={(e) => updateContact(editingContact.id, { email: e.target.value })}
                        placeholder="nome@esempio.it"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-950 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelContactEditor}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={confirmContactEditor}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 inline-flex items-center justify-center gap-1.5 shadow-lg shadow-teal-600/20"
                    >
                      <Check className="w-4 h-4" />
                      Conferma referente
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Footer azioni — nascosto mentre si aggiunge/modifica un referente */}
          {!editingContactId && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white/95 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="flex-1 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? 'Salvataggio...' : isEdit ? 'Salva modifiche' : 'Aggiungi società'}
            </button>
          </div>
          )}
        </form>

        {logoZoomOpen && logoPreview && (
          <div
            className="pointer-events-none fixed z-[60] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ring-4 ring-slate-100"
            style={{ top: logoZoomPos.top, left: logoZoomPos.left, width: LOGO_ZOOM_SIZE, height: LOGO_ZOOM_SIZE }}
          >
            <img
              src={logoPreview}
              alt="Anteprima logo ingrandita"
              className="h-full w-full object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
