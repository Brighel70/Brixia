import React from 'react'

interface PersonalInfoTabProps {
  form: any
  handleInputChange: (field: string, value: string | boolean) => void
  isFieldDisabled: () => boolean
}

const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({ 
  form, 
  handleInputChange, 
  isFieldDisabled 
}) => {
  // Funzione per capitalizzare il testo (prima lettera maiuscola, resto minuscolo)
  const capitalizeText = (text: string) => {
    if (!text) return ''
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Funzione per formattare il numero di telefono
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return ''
    
    // Rimuovi tutti i caratteri non numerici
    const cleaned = phone.replace(/\D/g, '')
    
    // Se inizia con 39, rimuovilo (sarà aggiunto +39)
    const withoutCountryCode = cleaned.startsWith('39') ? cleaned.slice(2) : cleaned
    
    // Se è vuoto, ritorna vuoto
    if (!withoutCountryCode) return ''
    
    // Formatta con spazi: 335 6222225
    let formatted = withoutCountryCode
    if (formatted.length >= 3) {
      formatted = formatted.substring(0, 3) + ' ' + formatted.substring(3)
    }
    
    // Aggiungi +39 all'inizio
    return `+39 ${formatted}`
  }

  // Funzione per gestire il cambio del telefono
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    handleInputChange('emergency_contact_phone', formatted)
  }

  // Funzione per gestire il cambio del telefono principale
  const handleMainPhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    handleInputChange('phone', formatted)
  }

  // Funzione per gestire il cambio di testo con capitalizzazione
  const handleTextChange = (field: string, value: string) => {
    const capitalizedValue = capitalizeText(value)
    handleInputChange(field, capitalizedValue)
  }
  return (
    <div className="space-y-5">
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 relative">
        {/* Nome - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.given_name}
            onChange={(e) => handleTextChange('given_name', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>
        
        {/* Cognome - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Cognome <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.family_name}
            onChange={(e) => handleTextChange('family_name', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>
        
        {/* Data di Nascita - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Data di Nascita <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={form.date_of_birth}
            onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>
        
        {/* Sesso - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Sesso <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.gender}
            onChange={(e) => handleInputChange('gender', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          >
            <option value="">-</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">X</option>
          </select>
        </div>
        
        {/* Codice Fiscale - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Codice Fiscale <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={16}
            value={form.fiscal_code}
            onChange={(e) => handleInputChange('fiscal_code', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>
        
        {/* Numero Tessera - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M7 4a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
            </svg>
            Numero Tessera
          </label>
          <input
            type="text"
            value={form.membership_number}
            onChange={(e) => handleInputChange('membership_number', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="25000201"
          />
        </div>
        
        {/* Status - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Status <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          >
            <option value="active">Attivo</option>
            <option value="inactive">Inattivo</option>
            <option value="pending">In attesa</option>
          </select>
        </div>
        
        {/* Nazionalità - 3 colonne */}
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Nazionalità
          </label>
          <input
            type="text"
            value={form.nationality}
            onChange={(e) => {
              const value = e.target.value
              const formattedValue = value
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              handleInputChange('nationality', formattedValue)
            }}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>


        {/* Email - 6 colonne */}
        <div className="md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleTextChange('email', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>
        
        {/* Telefono - 6 colonne */}
        <div className="md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Telefono
          </label>
          <input
            type="tel"
            value={formatPhoneNumber(form.phone)}
            onChange={(e) => handleMainPhoneChange(e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
          />
        </div>

        {/* Linea divisoria orizzontale - Dopo contatti */}
        <div className="md:col-span-12">
          <div className="border-t border-gray-200 my-6"></div>
        </div>

        {/* Indirizzo - Quarta riga */}
        {/* Via/Indirizzo - 6 colonne */}
        <div className="md:col-span-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Via/Indirizzo
          </label>
          <input
            type="text"
            value={form.address_street}
            onChange={(e) => handleTextChange('address_street', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="Via, numero civico..."
          />
        </div>
        
        {/* CAP - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M7 4a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
            </svg>
            CAP
          </label>
          <input
            type="text"
            value={form.address_zip}
            onChange={(e) => handleInputChange('address_zip', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="25010"
            maxLength={5}
          />
        </div>
        
        {/* Paese - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            Paese
          </label>
          <input
            type="text"
            value={form.address_country}
            onChange={(e) => {
              const value = e.target.value
              const formattedValue = value
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              handleInputChange('address_country', formattedValue)
            }}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="Italia"
          />
        </div>
        
        {/* Città - 2 colonne */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Città
          </label>
          <input
            type="text"
            value={form.address_city}
            onChange={(e) => {
              const value = e.target.value
              const formattedValue = value
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              handleInputChange('address_city', formattedValue)
            }}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="Brescia"
          />
        </div>

        {/* Linea divisoria orizzontale - Dopo indirizzo */}
        <div className="md:col-span-12">
          <div className="border-t border-gray-200 my-6"></div>
        </div>
        
        {/* Note Mediche - 8 colonne (ingrandite) */}
        <div className="md:col-span-8">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Note Mediche
          </label>
          <textarea
            value={form.medical_notes}
            onChange={(e) => handleInputChange('medical_notes', e.target.value)}
            disabled={isFieldDisabled()}
            rows={4}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200 resize-none"
            placeholder="Note mediche, allergie, condizioni particolari..."
          />
        </div>
        
        {/* Contatto di Emergenza - Nome - 2 colonne (stringato) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Contatto di emergenza
          </label>
          <input
            type="text"
            value={form.emergency_contact_name}
            onChange={(e) => handleTextChange('emergency_contact_name', e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="Nome"
          />
        </div>
        
        {/* Telefono Emergenza - 2 colonne (stringato) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Telefono emergenza
          </label>
          <input
            type="tel"
            value={formatPhoneNumber(form.emergency_contact_phone)}
            onChange={(e) => handlePhoneChange(e.target.value)}
            disabled={isFieldDisabled()}
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-white disabled:text-gray-900 shadow-sm transition-all duration-200"
            placeholder="Numero di telefono"
          />
        </div>

        {/* Ruolo - 12 colonne (tutta la larghezza) - Spostato sotto emergenza */}
        <div className="md:col-span-12">
          <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Ruolo
          </label>
          <div className="flex items-center space-x-8">
            <label className="flex items-center group">
              <input
                type="checkbox"
                checked={form.is_player}
                onChange={(e) => handleInputChange('is_player', e.target.checked)}
                disabled={isFieldDisabled()}
                className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                  form.is_player 
                    ? 'border-blue-500 bg-blue-500 text-white' 
                    : 'border-gray-300 bg-white'
                } ${isFieldDisabled() ? 'cursor-default' : 'cursor-pointer'}`}
              />
              <span className={`ml-3 text-sm font-medium transition-colors duration-200 ${
                form.is_player 
                  ? 'text-blue-600 font-semibold' 
                  : 'text-gray-700'
              } ${isFieldDisabled() ? '' : 'group-hover:text-blue-600'}`}>
                È un giocatore
              </span>
            </label>
            
            <label className="flex items-center group">
              <input
                type="checkbox"
                checked={form.is_staff}
                onChange={(e) => handleInputChange('is_staff', e.target.checked)}
                disabled={isFieldDisabled()}
                className={`w-5 h-5 rounded border-2 transition-all duration-200 ${
                  form.is_staff 
                    ? 'border-green-500 bg-green-500 text-white' 
                    : 'border-gray-300 bg-white'
                } ${isFieldDisabled() ? 'cursor-default' : 'cursor-pointer'}`}
              />
              <span className={`ml-3 text-sm font-medium transition-colors duration-200 ${
                form.is_staff 
                  ? 'text-green-600 font-semibold' 
                  : 'text-gray-700'
              } ${isFieldDisabled() ? '' : 'group-hover:text-green-600'}`}>
                È staff
              </span>
            </label>
          </div>
        </div>

      </div>
    </div>
  )
}

export default PersonalInfoTab

