import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'

type Profile = { id: string; full_name: string | null; role: 'admin'|'coach'|'medic'|'director'; password: string; email: string }

interface AuthState {
  userId: string | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
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