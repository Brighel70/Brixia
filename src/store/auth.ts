import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { normalizeTeamflowRoleName, type TeamflowRoleName } from '@teamflow/shared'

type Profile = { 
  id: string; 
  full_name: string | null; 
  role: TeamflowRoleName | 'Player' | 'Preparatore' | 'Fisio';
  password: string; 
  email: string;
  user_role_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_year?: number;
  fir_code?: string;
  person_id?: string; // Aggiunto per compatibilità con mobile app
  staff_categories?: any[];
  is_super_admin?: boolean;
}

async function resolveTeamflowProfileRole(roleId: string | null | undefined): Promise<TeamflowRoleName> {
  if (!roleId) return 'Famiglia'

  const { data } = await supabase
    .from('user_roles')
    .select('name')
    .eq('id', roleId)
    .maybeSingle()

  return normalizeTeamflowRoleName(data?.name || roleId) || 'Famiglia'
}

async function ensureTeamflowProfile(authUserId: string, email: string, code: string): Promise<Profile | null> {
  const { error: syncError } = await supabase.rpc('sync_flowme_auth_password', {
    p_email: email,
    p_code: code,
  })
  if (syncError) throw syncError

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
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
      // Il codice viene verificato lato database. Non leggere piu persone prima
      // dell'autenticazione: permette di proteggere la tabella people con RLS.
      const { error: syncError } = await supabase.rpc('sync_flowme_auth_password', {
        p_email: emailTrim,
        p_code: codeTrim,
      })

      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: codeTrim,
      })

      if (signInError?.message?.includes('Invalid login credentials') && !syncError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: emailTrim,
          password: codeTrim,
          options: { emailRedirectTo: undefined },
        })
        if (signUpError || !signUpData.user || !signUpData.session) {
          throw signUpError || new Error('Accesso creato ma conferma email richiesta.')
        }
        await ensureTeamflowProfile(signUpData.user.id, emailTrim, codeTrim)
        signInData = { user: signUpData.user, session: signUpData.session }
        signInError = null
      }

      if (!signInError && signInData.user) {
        let profileData: Profile | null
        if (syncError) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', signInData.user.id)
            .maybeSingle()
          if (error) throw error
          profileData = data as Profile | null
        } else {
          profileData = await ensureTeamflowProfile(signInData.user.id, emailTrim, codeTrim)
        }

        if (!profileData) {
          throw new Error('Profilo non trovato. Contatta l\'amministratore.')
        }

        if (profileData.person_id) {
          const { data: personAccess, error: personError } = await supabase
            .from('people')
            .select('teamflow_access_blocked')
            .eq('id', profileData.person_id)
            .maybeSingle()
          if (personError) throw personError
          if (personAccess?.teamflow_access_blocked) {
            await supabase.auth.signOut()
            throw new Error('L\'accesso a TeamFlow per questa persona e stato bloccato dall\'amministratore.')
          }
        }

        saveToStorage('auth-userId', signInData.user.id)
        saveToStorage('auth-profile', profileData)
        set({ userId: signInData.user.id, profile: profileData, loading: false })
        return
      }

      throw signInError || new Error('Email o codice/password non corretti.')

      // Verifica che esista una persona con questa email e questo codice TeamFlow (confronto case-insensitive sul codice)
      const { data: people, error: personError } = await supabase
        .from('people')
        .select('id, given_name, family_name, email, teamflow_app_role, invite_code_teamflow, teamflow_access_blocked')
        .ilike('email', emailTrim)

      if (personError) {
        set({ loading: false })
        throw new Error('Email o codice TeamFlow non corretti. Usa l\'email della scheda persona e il Codice TeamFlow (sezione "Codice accesso TeamFlow" nel tab TeamFlow/Flowme), non il Codice Flowme.')
      }

      const person = people?.find(
        p => p.invite_code_teamflow != null && String(p.invite_code_teamflow).trim().toLowerCase() === codeTrim.toLowerCase()
      ) ?? null

      if (person?.teamflow_access_blocked) {
        set({ loading: false })
        throw new Error('L\'accesso a TeamFlow per questa persona è stato bloccato dall\'amministratore.')
      }

      // Nessuna persona con quel codice: prova login email + password (es. admin di assistenza)
      if (!person) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: codeTrim
        })
        if (authError || !authData.user) {
          set({ loading: false })
          const detail = authError?.message ? ` (${authError.message})` : ''
          throw new Error(
            'Email o codice/password non corretti.' + detail +
            ' Per l\'admin di assistenza usa andreabulgari@me.com e la password dedicata. Altrimenti usa email persona + Codice TeamFlow.'
          )
        }
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single()
        if (profileError || !profileData) {
          set({ loading: false })
          throw new Error('Profilo non trovato. Contatta l\'amministratore.')
        }
        saveToStorage('auth-userId', authData.user.id)
        saveToStorage('auth-profile', profileData)
        set({ userId: authData.user.id, profile: profileData })
        set({ loading: false })
        return
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
        let profileData: Profile | null = await ensureTeamflowProfile(authData.user.id, emailTrim, codeTrim)
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
          const { error: createErr } = await supabase.rpc('sync_flowme_auth_password', {
            p_email: emailTrim,
            p_code: codeTrim,
          })
          const { data: created } = createErr
            ? { data: null }
            : await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle()
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
        let upsertedProfile: Profile | null = null
        let profileInsertError: { code?: string } | null = null
        try {
          upsertedProfile = await ensureTeamflowProfile(signUpData.user.id, emailTrim, codeTrim)
        } catch (error) {
          profileInsertError = error as { code?: string }
        }

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
              await ensureTeamflowProfile(signUpData.user.id, emailTrim, codeTrim)
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
    localStorage.removeItem('auth-userId')
    localStorage.removeItem('auth-profile')
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('signOut Auth:', e)
    }
    set({ userId: null, profile: null })
  },
  
  async fetchProfile() {
    // Non serve più, il profilo è già caricato al login
  },

  async initializeAuth() {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session

      if (session?.user) {
        let profileData = loadFromStorage('auth-profile') as Profile | null
        // Il profilo va sempre aggiornato: ruoli e privilegi possono cambiare
        // lato amministrazione mentre la sessione dell'utente e' ancora valida.
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
        if (!error && data) {
          profileData = data as Profile
          saveToStorage('auth-userId', session.user.id)
          saveToStorage('auth-profile', profileData)
        } else if (!error) {
          profileData = null
        }
        if (profileData) {
          if (profileData.person_id) {
            const { data: personAccess } = await supabase
              .from('people')
              .select('teamflow_access_blocked')
              .eq('id', profileData.person_id)
              .maybeSingle()

            if (personAccess?.teamflow_access_blocked) {
              await supabase.auth.signOut()
              localStorage.removeItem('auth-userId')
              localStorage.removeItem('auth-profile')
              set({ userId: null, profile: null })
              return
            }
          }
          set({ userId: session.user.id, profile: profileData })
          return
        }
      }

      // Nessuna sessione Auth valida: non usare solo localStorage (rompe RLS)
      localStorage.removeItem('auth-userId')
      localStorage.removeItem('auth-profile')
      set({ userId: null, profile: null })
    } catch (e) {
      console.error('initializeAuth:', e)
      set({ userId: null, profile: null })
    }
  }
}))
