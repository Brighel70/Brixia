import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'

type Profile = { 
  id: string; 
  full_name: string | null; 
  role: 'Admin'|'Dirigente'|'Segreteria'|'Direttore Sportivo'|'Direttore Tecnico'|'Allenatore'|'Team Manager'|'Accompagnatore'|'Player'|'Preparatore'|'Medico'|'Fisio'|'Famiglia'; 
  password: string; 
  email: string;
  user_role_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_year?: number;
  fir_code?: string;
  person_id?: string; // Aggiunto per compatibilità con mobile app
}

const teamflowProfileRoles: Profile['role'][] = [
  'Admin',
  'Dirigente',
  'Segreteria',
  'Direttore Sportivo',
  'Direttore Tecnico',
  'Allenatore',
  'Team Manager',
  'Accompagnatore',
  'Player',
  'Preparatore',
  'Medico',
  'Fisio',
  'Famiglia'
]

const normalizeRoleName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

async function resolveTeamflowProfileRole(roleId: string | null | undefined): Promise<Profile['role']> {
  if (!roleId) return 'Famiglia'

  const { data } = await supabase
    .from('user_roles')
    .select('name')
    .eq('id', roleId)
    .maybeSingle()

  const roleName = data?.name?.trim()
  if (roleName && teamflowProfileRoles.includes(roleName as Profile['role'])) {
    return roleName as Profile['role']
  }

  const aliases: Record<string, Profile['role']> = {
    admin: 'Admin',
    giocatore: 'Player',
    player: 'Player',
    famiglia: 'Famiglia',
    family: 'Famiglia',
    fisioterapista: 'Fisio',
    fisio: 'Fisio'
  }

  return aliases[normalizeRoleName(roleName || roleId)] || 'Famiglia'
}

interface AuthState {
  userId: string | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Login con email della persona + codice TeamFlow (generato nella scheda persona) */
  signInWithTeamFlowCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  initializeAuth: () => Promise<void>
}

// Funzioni helper per localStorage
const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Errore nel salvare in localStorage:', error)
  }
}

const loadFromStorage = (key: string) => {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.error('Errore nel caricare da localStorage:', error)
    return null
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  userId: null,
  profile: null,
  loading: false,
  
  async signIn(email, password) {
    set({ loading: true })
    
    try {
      // Usa l'autenticazione Supabase corretta
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      })
      
      if (authError) {
        throw authError
      }
      
      if (!authData.user) {
        throw new Error('Utente non trovato')
      }
      
      // Ora carica il profilo dalla tabella profiles usando l'ID dell'utente autenticato
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()
      
      if (profileError) {
        throw new Error('Errore nel caricamento profilo: ' + profileError.message)
      }
      
      if (!profileData) {
        throw new Error('Profilo utente non trovato')
      }
      
      // Salva nel localStorage
      saveToStorage('auth-userId', authData.user.id)
      saveToStorage('auth-profile', profileData)
      
      set({ userId: authData.user.id, profile: profileData })
      
    } catch (error) {
      throw error
    } finally {
      set({ loading: false })
    }
  },

  async signInWithTeamFlowCode(email, code) {
    set({ loading: true })
    const emailTrim = email.trim().toLowerCase()
    const codeTrim = code.trim()
    if (!emailTrim || !codeTrim) {
      set({ loading: false })
      throw new Error('Inserisci email e codice TeamFlow')
    }

    try {
      // Verifica che esista una persona con questa email e questo codice TeamFlow (confronto case-insensitive sul codice)
      const { data: people, error: personError } = await supabase
        .from('people')
        .select('id, given_name, family_name, email, teamflow_app_role, invite_code_teamflow')
        .ilike('email', emailTrim)

      if (personError) {
        set({ loading: false })
        throw new Error('Email o codice TeamFlow non corretti. Usa l\'email della scheda persona e il Codice TeamFlow (sezione "Codice accesso TeamFlow" nel tab TeamFlow/Flowme), non il Codice Flowme.')
      }

      const person = people?.find(
        p => p.invite_code_teamflow != null && String(p.invite_code_teamflow).trim().toLowerCase() === codeTrim.toLowerCase()
      ) ?? null

      if (!person) {
        set({ loading: false })
        throw new Error('Email o codice TeamFlow non corretti. Usa l\'email della scheda persona e il Codice TeamFlow (sezione "Codice accesso TeamFlow" nel tab TeamFlow/Flowme), non il Codice Flowme.')
      }

      const profileRole = await resolveTeamflowProfileRole(person.teamflow_app_role)

      // Prova il login: prima con il codice salvato nel DB, poi con quello digitato (per massima compatibilità)
      const storedCode = String(person.invite_code_teamflow).trim()
      let authData: { user: any } | null = null
      let authError: { message?: string } | null = null

      let result = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: storedCode
      })
      authData = result.data
      authError = result.error

      // Se fallisce con "credenziali non valide", riprova con il codice esatto digitato dall'utente
      if (authError?.message?.includes('Invalid login credentials') && codeTrim !== storedCode) {
        result = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: codeTrim
        })
        authData = result.data
        authError = result.error
      }

      if (!authError && authData?.user) {
        let profileData: Profile | null = null
        const { data: fetchedProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single()
        if (!profileError && fetchedProfile) {
          profileData = fetchedProfile
        }
        // Profilo mancante (es. primo accesso dopo conferma email): crealo ora che l'utente è in auth.users
        if (!profileData && person) {
          const { data: created, error: createErr } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: person.email || emailTrim,
              first_name: person.given_name || '',
              last_name: person.family_name || '',
              full_name: person.given_name || person.family_name ? `${person.given_name || ''} ${person.family_name || ''}`.trim() : null,
              role: profileRole,
              person_id: person.id
            })
            .select()
            .single()
          if (!createErr && created) profileData = created
        }
        if (!profileData) {
          set({ loading: false })
          throw new Error('Profilo non trovato. Contatta l\'amministratore.')
        }
        saveToStorage('auth-userId', authData.user.id)
        saveToStorage('auth-profile', profileData)
        set({ userId: authData.user.id, profile: profileData })
        set({ loading: false })
        return
      }

      // Se "credenziali non valide", può essere il primo accesso: crea utente Auth con password = codice
      if (authError?.message?.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: emailTrim,
          password: codeTrim,
          options: { emailRedirectTo: undefined }
        })

        if (signUpError) {
          if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists')) {
            set({ loading: false })
            throw new Error(
              'Account già esistente: la password (codice) in uso non coincide con il Codice TeamFlow attuale. Se hai rigenerato il codice nella scheda persona dopo il primo accesso, l\'accesso usa ancora il codice precedente. L\'amministratore può reimpostare la password in Supabase (Authentication → Users → modifica utente) impostandola uguale al Codice TeamFlow attuale mostrato nella scheda persona.'
            )
          }
          set({ loading: false })
          throw signUpError
        }

        if (!signUpData?.user) {
          set({ loading: false })
          throw new Error('Errore nella creazione dell\'accesso. Riprova.')
        }

        // Crea o aggiorna il profilo collegato alla persona (id auth = id profilo, person_id = people.id)
        const profilePayload = {
          id: signUpData.user.id,
          email: person.email || emailTrim,
          first_name: person.given_name || '',
          last_name: person.family_name || '',
          full_name: person.given_name || person.family_name ? `${person.given_name || ''} ${person.family_name || ''}`.trim() : null,
          role: profileRole,
          person_id: person.id
        }
        const { data: upsertedProfile, error: profileInsertError } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .select()
          .single()

        let profileForState: Profile | null = null
        if (!profileInsertError && upsertedProfile) {
          profileForState = { ...upsertedProfile, password: '' }
        }
        // Se errore (es. 409 conflitto): il profilo potrebbe già esistere → caricalo e procedi comunque
        if (profileInsertError) {
          const { data: existingProfile, error: fetchErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', signUpData.user.id)
            .single()
          if (!fetchErr && existingProfile) {
            profileForState = { ...existingProfile, password: '' }
            // Aggiorna person_id se non impostato (così la persona resta collegata)
            if (!existingProfile.person_id) {
              await supabase.from('profiles').update({ person_id: person.id, role: profileRole }).eq('id', signUpData.user.id)
            }
          }
        }
        if (profileInsertError && !profileForState) {
          console.error('Errore creazione profilo:', profileInsertError)
          set({ loading: false })
          // FK 23503 = utente non ancora in auth.users perché Supabase richiede conferma email
          if (profileInsertError.code === '23503') {
            throw new Error(
              'Per l\'accesso diretto (senza conferma email) disattiva "Confirm email" in Supabase: Authentication → Providers → Email → disattiva "Confirm sign up". Poi riprova.'
            )
          }
          throw new Error('Accesso creato ma errore nel profilo. Riprova ad accedere.')
        }
        if (!profileForState) {
          profileForState = { ...profilePayload, password: '' } as Profile
        }

        // Se Supabase ha creato una sessione (conferma email disabilitata), siamo già dentro
        if (signUpData.session) {
          saveToStorage('auth-userId', signUpData.user.id)
          saveToStorage('auth-profile', profileForState)
          set({ userId: signUpData.user.id, profile: profileForState })
        } else {
          set({ loading: false })
          throw new Error(
            'Per l\'accesso diretto disattiva la conferma email in Supabase: Authentication → Providers → Email → disattiva "Confirm sign up". Poi riprova con email e codice TeamFlow.'
          )
        }
        set({ loading: false })
        return
      }

      set({ loading: false })
      throw authError
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  
  async signOut() {
    // Rimuovi dal localStorage
    localStorage.removeItem('auth-userId')
    localStorage.removeItem('auth-profile')
    
    set({ userId: null, profile: null })
  },
  
  async fetchProfile() {
    // Non serve più, il profilo è già caricato al login
  },

  async initializeAuth() {
    // Carica da localStorage
    const savedUserId = loadFromStorage('auth-userId')
    const savedProfile = loadFromStorage('auth-profile')
    
    if (savedUserId && savedProfile) {
      set({ userId: savedUserId, profile: savedProfile })
    }
  }
}))
