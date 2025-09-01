import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import EmailTemplateViewer from '@/components/EmailTemplateViewer'
import { useAuth } from '@/store/auth'

interface Category {
  id: string
  code: string
  name: string
  sort: number
  active: boolean
  created_at: string
}

interface NewCategory {
  code: string
  name: string
}

export default function Settings() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState<NewCategory>( { code: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'categories' | 'system' | 'emails' | 'permissions'>('categories')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    loadCategories()
    
    // Controlla se c'è un parametro tab nell'URL
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get('tab')
    
    if (tabParam && ['categories', 'system', 'emails', 'permissions'].includes(tabParam)) {
      setActiveTab(tabParam as 'categories' | 'system' | 'emails' | 'permissions')
    }
  }, [])

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort', { ascending: true })

      if (error) throw error
      
      // Assicurati che tutte le categorie abbiano il campo active
      const categoriesWithActive = (data || []).map(cat => ({
        ...cat,
        active: cat.active !== undefined ? cat.active : true
      }))
      
      setCategories(categoriesWithActive)
    } catch (error) {
      console.error('Errore nel caricamento categorie:', error)
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!newCategory.code.trim() || !newCategory.name.trim()) {
        throw new Error('Codice e nome sono obbligatori')
      }

      // Verifica che il codice non esista già
      const existingCategory = categories.find(c => c.code === newCategory.code.toUpperCase())
      if (existingCategory) {
        throw new Error('Una categoria con questo codice esiste già')
      }

      // Determina il valore sort per la nuova categoria
      let sortValue = 999 // Valore di default per nuove categorie
      
      // Se è una delle categorie standard, assegna il sort corretto
      const standardSorts: { [key: string]: number } = {
        'U14': 1,
        'U16': 2,
        'U18': 3,
        'CADETTA': 4,
        'PRIMA': 5,
        'SENIORES': 6
      }
      
      if (standardSorts[newCategory.code.toUpperCase()]) {
        sortValue = standardSorts[newCategory.code.toUpperCase()]
      } else {
        // Per nuove categorie, trova il valore sort più alto e aggiungi 1
        const maxSort = Math.max(...categories.map(c => c.sort), 0)
        sortValue = maxSort + 1
      }

      const { error } = await supabase
        .from('categories')
        .insert({
          code: newCategory.code.toUpperCase(),
          name: newCategory.name.trim(),
          sort: sortValue
        })

      if (error) throw error

      setMessage('✅ Categoria creata con successo!')
      setNewCategory({ code: '', name: '' })
      loadCategories() // Ricarica la lista
    } catch (error: any) {
      console.error('Errore nella creazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditCategory = (categoryId: string, currentName: string) => {
    setEditingCategory(categoryId)
    setEditingName(currentName)
  }

  const handleSaveCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: editingName.trim() })
        .eq('id', categoryId)

      if (error) throw error

      setMessage('✅ Nome categoria aggiornato con successo!')
      setEditingCategory(null)
      setEditingName('')
      loadCategories()
    } catch (error: any) {
      console.error('Errore nell\'aggiornamento categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditingName('')
  }

  const handleToggleActive = async (categoryId: string, currentActive: boolean) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ active: !currentActive })
        .eq('id', categoryId)
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        setMessage(`✅ Categoria ${!currentActive ? 'attivata' : 'disattivata'} con successo!`)
      } else {
        setMessage(`❌ Errore: Update non riuscito`)
      }
      
      await loadCategories()
    } catch (error: any) {
      console.error('Errore nel cambio stato categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // PASSO 1: Controlla se ci sono giocatori collegati (usa i campi corretti)
      let players: any[] = []
      let playersError = null
      
      try {
        const { data, error } = await supabase
          .from('players')
          .select('id, first_name, last_name') // Usa i campi corretti
          .eq('category_id', categoryId)
        
        players = data || []
        playersError = error
      } catch (e) {
        // Se la tabella players non esiste, ignora
        console.log('Tabella players non trovata, continuo...')
      }

      // PASSO 2: Controlla se ci sono utenti collegati
      let users: any[] = []
      let usersError = null
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('category_id', categoryId)
        
        users = data || []
        usersError = error
      } catch (e) {
        // Se la tabella profiles non esiste, ignora
        console.log('Tabella profiles non trovata, continuo...')
      }

      // PASSO 3: Se ci sono collegamenti, mostra popup dettagliato
      if ((players && players.length > 0) || (users && users.length > 0)) {
        let message = '❌ **IMPOSSIBILE ELIMINARE QUESTA CATEGORIA!**\n\n'
        message += '**Motivo:** La categoria è attualmente in uso da:\n\n'

        if (players && players.length > 0) {
          message += `🏃‍♂️ **${players.length} Giocatore/i:**\n`
          players.forEach(player => {
            const playerName = player.first_name && player.last_name 
              ? `${player.first_name} ${player.last_name}`
              : player.first_name || player.last_name || 'Nome non disponibile'
            message += `   • ${playerName}\n`
          })
          message += '\n'
        }

        if (users && users.length > 0) {
          message += `👥 **${users.length} Utente/i:**\n`
          users.forEach(user => {
            message += `   • ${user.full_name || 'Nome non disponibile'}\n`
          })
          message += '\n'
        }

        message += '**Soluzione:**\n'
        message += '1. Sposta tutti i giocatori/utenti in altre categorie\n'
        message += '2. Oppure elimina prima i giocatori/utenti collegati\n'
        message += '3. Poi riprova a eliminare la categoria'

        // Mostra popup con messaggio dettagliato
        alert(message)
        return
      }

      // PASSO 4: Se non ci sono collegamenti, procedi con l'eliminazione
      if (!confirm('Sei sicuro di voler eliminare questa categoria? Questa azione non può essere annullata.')) {
        return
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error

      setMessage('✅ Categoria eliminata con successo!')
      loadCategories() // Ricarica la lista
    } catch (error: any) {
      console.error('Errore nell\'eliminazione categoria:', error)
      setMessage(`❌ Errore: ${error.message}`)
    }
  }

  const handleInputChange = (field: keyof NewCategory, value: string) => {
    setNewCategory(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div>
      <Header title="Configurazioni" showBack={true} />
      
      <div className="p-6">
        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => {
              setActiveTab('categories')
              navigate('/settings?tab=categories', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'categories'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Categorie
          </button>
          <button
            onClick={() => {
              setActiveTab('system')
              navigate('/settings?tab=system', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'system'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚙️ Sistema
          </button>
          <button
            onClick={() => {
              setActiveTab('emails')
              navigate('/settings?tab=emails', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'emails'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📧 Email
          </button>
          <button
            onClick={() => {
              setActiveTab('permissions')
              navigate('/settings?tab=permissions', { replace: true })
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'bg-white text-sky-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            🔐 I Tuoi Permessi
          </button>
        </div>

        {/* Tab Categorie */}
        {activeTab === 'categories' && (
          <div className="space-y-8">
            {/* Aggiungi Categoria */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Aggiungi Nuova Categoria</h2>
              
              <form onSubmit={handleAddCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Codice *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCategory.code}
                      onChange={(e) => handleInputChange('code', e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Es. U16, SENIORES"
                      maxLength={10}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCategory.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Es. Under 16, Seniores"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="btn bg-sky text-white px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creazione...' : 'Aggiungi Categoria'}
                </button>
              </form>
            </div>

            {/* Lista Categorie */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Categorie Esistenti</h2>
              
              {categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📋</div>
                  <p>Nessuna categoria trovata</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className={`flex items-center justify-between p-4 rounded-lg transition-colors duration-200 ${
                      category.active 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center space-x-4 relative">
                        {/* Checkbox per attivazione */}
                                                <div className="relative z-20">
                          <input
                            type="checkbox"
                            checked={category.active || false}
                            onChange={(e) => {
                              handleToggleActive(category.id, category.active || false)
                            }}
                            className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            title={category.active ? 'Disattiva categoria' : 'Attiva categoria'}
                          />
                        </div>
                        
                        <div>
                          <div className="font-semibold text-lg">{category.code}</div>
                          {editingCategory === category.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCategory(category.id)}
                                className="text-sm bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                              >
                                Salva
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-sm bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">{category.name}</div>
                          )}
                          <div className="text-xs text-gray-500">
                            Creata il {new Date(category.created_at).toLocaleDateString('it-IT')}
                            {category.active ? (
                              <span className="ml-2 text-green-600">✓ Attiva</span>
                            ) : (
                              <span className="ml-2 text-red-700">✗ Non attiva</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {editingCategory !== category.id && (
                          <button
                            onClick={() => handleEditCategory(category.id, category.name)}
                            className="btn bg-blue-500 text-white px-3 py-2 text-sm hover:bg-blue-600"
                            title="Modifica nome categoria"
                          >
                            Modifica
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="btn bg-red-500 text-white px-3 py-2 text-sm hover:bg-red-600"
                          title="Elimina categoria"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Sistema */}
        {activeTab === 'system' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-4">Impostazioni Sistema</h2>
              
              <div className="space-y-6">
                {/* Personalizzazione Brand */}
                <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-pink-800 mb-2">🎨 Personalizzazione Brand</h3>
                    <p className="text-sm text-pink-700">
                      Personalizza logo, colori, nome squadra e aspetto grafico dell'app.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/brand-customization')}
                    className="btn bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 text-sm hover:from-pink-600 hover:to-purple-600 ml-4"
                  >
                    🎨 Personalizza
                  </button>
                </div>

                {/* Gestione Utenti */}
                <div className="p-4 bg-green-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-800 mb-2">👥 Gestione Utenti</h3>
                    <p className="text-sm text-green-700">
                      Creazione e gestione di utenti staff con diversi livelli di accesso.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/create-user')}
                    className="btn bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 ml-4"
                  >
                    ➕ Crea Nuovo Utente
                  </button>
                </div>

                {/* Gestione Giocatori */}
                <div className="p-4 bg-orange-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-800 mb-2">🏉 Gestione Giocatori</h3>
                    <p className="text-sm text-orange-700">
                      Registrazione giocatori e assegnazione alle categorie appropriate.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/create-player')}
                    className="btn bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700 ml-4"
                  >
                    ➕ Crea Nuovo Giocatore
                  </button>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">🔐 Autenticazione</h3>
                  <p className="text-sm text-blue-700">
                    Sistema di autenticazione personalizzato con gestione profili e ruoli.
                  </p>
                </div>
                
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">📊 Presenze</h3>
                  <p className="text-sm text-purple-700">
                    Sistema di tracciamento presenze per sessioni e allenamenti.
                  </p>
                </div>

                {/* I Tuoi Permessi - NUOVA FASCIA */}
                <div className="p-4 bg-indigo-50 rounded-lg cursor-pointer transition-all duration-200 hover:scale-102 hover:bg-indigo-100"
                     onClick={() => setActiveTab('permissions')}>
                  <h3 className="font-semibold text-indigo-800 mb-2">🔐 I Tuoi Permessi</h3>
                  <p className="text-sm text-indigo-700 mb-3">
                    Visualizza i permessi del tuo ruolo e quelli non assegnati.
                  </p>
                  <div className="flex items-center text-indigo-600 text-sm">
                    <span>👆 Clicca per visualizzare i tuoi permessi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Email */}
        {activeTab === 'emails' && (
          <div className="space-y-8">
            <EmailTemplateViewer />
          </div>
        )}

        {/* Tab I Tuoi Permessi */}
        {activeTab === 'permissions' && (
          <div className="space-y-8">
            <div className="card p-6">
              <h2 className="text-2xl font-bold text-navy mb-6">I Tuoi Permessi</h2>
              <p className="text-gray-600 mb-6">
                Visualizza i permessi del tuo ruolo e quelli non assegnati
              </p>
              
              {/* Informazioni Ruolo */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">👤</span>
                  <div>
                    <h3 className="font-semibold text-blue-800">Ruolo: {profile?.role || 'Non definito'}</h3>
                    <p className="text-sm text-blue-600">Visualizza i permessi associati al tuo ruolo</p>
                  </div>
                </div>
              </div>
              
              {/* Permessi Dinamici */}
              <div className="space-y-6">
                {/* Categoria: Attività */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-3">🏃‍♂️ Attività</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Attività</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Crea Attività</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Modifica Attività</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Presenze</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Giocatori */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-3">🏉 Giocatori</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Giocatori</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Modifica Giocatori</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Categorie</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Sessioni */}
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h3 className="font-semibold text-orange-800 mb-3">📅 Sessioni</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Sessioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Crea Sessioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Modifica Sessioni</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Presenze</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Report */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-3">📊 Report</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Visualizza Report</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Crea Report</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Esporta Dati</span>
                    </div>
                  </div>
                </div>

                {/* Categoria: Sistema */}
                <div className="p-4 bg-red-50 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-3">⚙️ Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Utenti</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Gestione Ruoli</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">Configurazioni</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messaggio */}
        {message && (
          <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-lg max-w-sm ${
            message.startsWith('✅') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}


