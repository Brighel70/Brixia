/**
 * 🔧 ESEMPI DI INTEGRAZIONE DEL NUOVO SISTEMA SESSIONI
 * 
 * Questo file contiene esempi di come integrare il nuovo
 * sessionScheduler.ts nelle pagine esistenti SENZA rompere
 * le funzionalità attuali.
 * 
 * NON ESEGUIRE QUESTO FILE - È SOLO UN RIFERIMENTO!
 */

import { 
  createAutomaticSession, 
  createMultipleAutomaticSessions,
  previewNextSession,
  loadCategoryConfig 
} from '@/lib/sessionScheduler'

// ============================================================================
// ESEMPIO 1: Sostituire createBulkSessions() in Activities.tsx
// ============================================================================

/**
 * PRIMA (vecchio sistema):
 */
const OLD_createBulkSessions_OLD = async (category: any, sessionType: string) => {
  // ... logica vecchia con calcoli manuali ...
}

/**
 * DOPO (nuovo sistema):
 */
const createBulkSessions_NEW = async (category: any, sessionType: string) => {
  try {
    // Verifica che la categoria abbia una configurazione
    const config = await loadCategoryConfig(category.id)
    
    if (!config) {
      alert(`⚠️ Configurazione mancante per ${category.name}!\n\nVai su Settings → Gestisci Sedi Allenamento e configura i giorni/orari/location per questa categoria.`)
      return
    }

    // Calcola quante sessioni creare
    let count = 0
    switch (sessionType) {
      case 'weekly':
        count = config.ordered_weekdays.length  // Es. 3 per [Mar, Gio, Ven]
        break
      case 'biweekly':
        count = config.ordered_weekdays.length * 2  // Es. 6
        break
      case 'monthly':
        count = config.ordered_weekdays.length * 4  // Es. 12
        break
      default:
        count = 1
    }

    console.log(`🚀 Creazione ${count} sessioni per ${category.name}...`)

    // Crea sessioni automaticamente
    const sessions = await createMultipleAutomaticSessions(category.id, count)

    if (sessions.length === 0) {
      alert('❌ Errore nella creazione delle sessioni')
      return
    }

    alert(`✅ Create ${sessions.length} sessioni per ${category.name}!`)
    
    // Ricarica la lista sessioni
    await loadSessions()

  } catch (error) {
    console.error('❌ Errore in createBulkSessions:', error)
    alert('❌ Errore nella creazione delle sessioni')
  }
}

// ============================================================================
// ESEMPIO 2: Aggiungere bottone "Crea Prossima Automatica"
// ============================================================================

/**
 * JSX da aggiungere nella UI (Activities.tsx o CategoryActivities.tsx)
 */
const UI_Example_AutomaticSessionButton = () => {
  return (
    <div className="flex flex-col gap-2">
      {/* Bottone principale: Crea Automatica */}
      <button
        onClick={async () => {
          if (!selectedCategory) return
          
          const session = await createAutomaticSession(selectedCategory.id)
          
          if (session) {
            alert(`✅ Sessione creata:\n${session.session_date}\n${session.location}`)
            await loadSessions()  // Ricarica lista
          } else {
            alert('❌ Errore: verifica che la categoria abbia una configurazione training_locations')
          }
        }}
        className="btn bg-green-600 text-white px-4 py-2 rounded-lg"
      >
        ➕ Crea Prossima Automatica
      </button>

      {/* Bottone secondario: Crea Multiple */}
      <button
        onClick={() => setShowSessionTypeModal(true)}
        className="btn bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        📅 Crea Multiple Sessioni
      </button>

      {/* Bottone terziario: Allenamento Extra (manuale) */}
      <button
        onClick={() => setShowManualCreateModal(true)}
        className="btn bg-gray-600 text-white px-4 py-2 rounded-lg"
      >
        ⚙️ Allenamento Extra (Manuale)
      </button>
    </div>
  )
}

// ============================================================================
// ESEMPIO 3: Modal per creazione multiple sessioni
// ============================================================================

const UI_Example_MultipleSessionsModal = () => {
  const [sessionType, setSessionType] = useState<'weekly' | 'biweekly' | 'monthly' | null>(null)

  return (
    <div className="modal">
      <h2>Crea Sessioni Automatiche</h2>
      
      {/* Scelta tipo */}
      <div className="space-y-2">
        <button onClick={() => setSessionType('weekly')}>
          📅 1 Settimana
          <p className="text-sm">Crea tutti gli allenamenti della settimana</p>
        </button>
        
        <button onClick={() => setSessionType('biweekly')}>
          📆 2 Settimane
          <p className="text-sm">Crea gli allenamenti per 2 settimane</p>
        </button>
        
        <button onClick={() => setSessionType('monthly')}>
          🗓️ 4 Settimane
          <p className="text-sm">Crea gli allenamenti per 1 mese</p>
        </button>
      </div>

      {/* Conferma */}
      {sessionType && (
        <button
          onClick={async () => {
            if (!selectedCategory) return
            await createBulkSessions_NEW(selectedCategory, sessionType)
            setSessionType(null)
            closeModal()
          }}
          className="btn bg-green-600 text-white px-4 py-2 rounded-lg mt-4"
        >
          ✅ Conferma Creazione
        </button>
      )}
    </div>
  )
}

// ============================================================================
// ESEMPIO 4: Anteprima prossima sessione
// ============================================================================

const UI_Example_PreviewNextSession = () => {
  const [preview, setPreview] = useState<any>(null)

  useEffect(() => {
    if (selectedCategory) {
      loadPreview()
    }
  }, [selectedCategory])

  const loadPreview = async () => {
    if (!selectedCategory) return
    
    const nextSession = await previewNextSession(selectedCategory.id)
    setPreview(nextSession)
  }

  if (!preview) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-2">
        📅 Prossima Sessione Automatica
      </h3>
      <div className="text-sm text-blue-800">
        <p>📆 Data: {preview.session_date}</p>
        <p>📍 Luogo: {preview.location}</p>
        <p>⏰ Orario: {preview.start_time} - {preview.end_time}</p>
      </div>
      <button
        onClick={async () => {
          await createAutomaticSession(selectedCategory.id)
          await loadSessions()
          await loadPreview()
        }}
        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm"
      >
        ✅ Crea Questa Sessione
      </button>
    </div>
  )
}

// ============================================================================
// ESEMPIO 5: Controllo configurazione mancante
// ============================================================================

const checkCategoryConfiguration = async (categoryId: string): Promise<boolean> => {
  const config = await loadCategoryConfig(categoryId)
  
  if (!config) {
    const confirmed = confirm(
      '⚠️ CONFIGURAZIONE MANCANTE\n\n' +
      'Questa categoria non ha una configurazione training_locations.\n\n' +
      'Vuoi configurarla ora?\n\n' +
      '(Sarai reindirizzato alla pagina Settings)'
    )
    
    if (confirmed) {
      // Redirect a Settings con categoria pre-selezionata
      window.location.href = `/settings?category=${categoryId}&tab=training-locations`
    }
    
    return false
  }
  
  return true
}

// Usalo così:
const handleCreateSession = async () => {
  if (!selectedCategory) return
  
  // Verifica configurazione prima di procedere
  const hasConfig = await checkCategoryConfiguration(selectedCategory.id)
  if (!hasConfig) return
  
  // Procedi con la creazione
  await createAutomaticSession(selectedCategory.id)
}

// ============================================================================
// ESEMPIO 6: Integrazione Mobile App (StaffDashboard.tsx)
// ============================================================================

/**
 * In StaffDashboard.tsx della mobile app, aggiungi:
 */
const MobileStaffDashboard_Example = () => {
  return (
    <div className="p-4">
      <h2>Sessioni Allenamento</h2>
      
      {/* Lista sessioni esistenti */}
      <div className="space-y-2">
        {sessions.map(session => (
          <div key={session.id} className="bg-white p-3 rounded border">
            <p>{session.session_date}</p>
            <p>{session.location}</p>
          </div>
        ))}
      </div>

      {/* Bottone creazione automatica */}
      <button
        onClick={async () => {
          if (!selectedCategory) return
          
          // Usa il nuovo sistema
          const session = await createAutomaticSession(selectedCategory)
          
          if (session) {
            alert(`✅ Sessione creata per ${session.session_date}`)
            loadSessions()  // Ricarica
          } else {
            alert('❌ Errore: configura training_locations nella web app')
          }
        }}
        className="w-full bg-primary-600 text-white py-3 rounded-lg mt-4"
      >
        ➕ Crea Prossima Sessione
      </button>
    </div>
  )
}

// ============================================================================
// ESEMPIO 7: Backward Compatibility - Mantenere "Extra" manuale
// ============================================================================

/**
 * Mantieni il form manuale per "Allenamento Extra"
 */
const ManualSessionForm = () => {
  const [formData, setFormData] = useState({
    date: '',
    location: '',
    start_time: '',
    end_time: ''
  })

  return (
    <div className="bg-gray-50 p-4 rounded border">
      <h3 className="font-semibold mb-3">⚙️ Allenamento Extra</h3>
      <p className="text-sm text-gray-600 mb-4">
        Per allenamenti straordinari fuori dalla configurazione standard
      </p>
      
      <div className="space-y-2">
        <input 
          type="date" 
          value={formData.date}
          onChange={(e) => setFormData({...formData, date: e.target.value})}
        />
        <input 
          type="text" 
          placeholder="Location"
          value={formData.location}
          onChange={(e) => setFormData({...formData, location: e.target.value})}
        />
        <input 
          type="time" 
          value={formData.start_time}
          onChange={(e) => setFormData({...formData, start_time: e.target.value})}
        />
        <input 
          type="time" 
          value={formData.end_time}
          onChange={(e) => setFormData({...formData, end_time: e.target.value})}
        />
        
        <button
          onClick={async () => {
            // Usa il vecchio sistema per Extra
            await supabase.from('sessions').insert({
              category_id: selectedCategory.id,
              session_date: formData.date,
              location: formData.location,
              start_time: formData.start_time,
              end_time: formData.end_time,
              away_place: null
            })
            
            alert('✅ Allenamento Extra creato!')
          }}
          className="w-full bg-gray-600 text-white py-2 rounded"
        >
          Crea Extra
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// ESEMPIO 8: Error Handling Completo
// ============================================================================

const robustCreateSession = async (categoryId: string) => {
  try {
    // 1. Verifica configurazione
    const config = await loadCategoryConfig(categoryId)
    
    if (!config) {
      throw new Error('CONFIGURAZIONE_MANCANTE')
    }

    // 2. Crea sessione
    const session = await createAutomaticSession(categoryId)
    
    if (!session) {
      throw new Error('CREAZIONE_FALLITA')
    }

    // 3. Successo
    return { success: true, session }

  } catch (error: any) {
    // Gestione errori user-friendly
    if (error.message === 'CONFIGURAZIONE_MANCANTE') {
      alert(
        '⚠️ Configurazione Mancante\n\n' +
        'Prima di creare sessioni automatiche, devi configurare:\n' +
        '• Giorni della settimana\n' +
        '• Orari allenamento\n' +
        '• Sedi\n\n' +
        'Vai su Settings → Training Locations'
      )
    } else if (error.message === 'CREAZIONE_FALLITA') {
      alert(
        '❌ Creazione Fallita\n\n' +
        'Possibili cause:\n' +
        '• Tutte le date sono già occupate\n' +
        '• Errore database\n\n' +
        'Controlla la console per dettagli'
      )
    } else {
      alert(`❌ Errore: ${error.message}`)
    }
    
    return { success: false, error }
  }
}

// ============================================================================
// FINE ESEMPI
// ============================================================================

export {
  createBulkSessions_NEW,
  UI_Example_AutomaticSessionButton,
  UI_Example_MultipleSessionsModal,
  UI_Example_PreviewNextSession,
  checkCategoryConfiguration,
  MobileStaffDashboard_Example,
  ManualSessionForm,
  robustCreateSession
}

/**
 * 📝 NOTE FINALI:
 * 
 * 1. Questi sono SOLO ESEMPI - non eseguire questo file!
 * 2. Copia/adatta il codice necessario nelle tue pagine
 * 3. Testa ogni modifica in sviluppo prima di deployare
 * 4. Mantieni sempre backup prima di modifiche importanti
 * 5. Leggi NUOVO_SISTEMA_SESSIONI.md per la guida completa
 */




