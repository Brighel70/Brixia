import { createClient } from '@supabase/supabase-js'

// Credenziali Supabase hardcoded per sviluppo
const url = 'https://lsuqdeizqapsexeekrua.supabase.co'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdXFkZWl6cWFwc2V4ZWVrcnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDcxMDUsImV4cCI6MjA3MTg4MzEwNX0.8w5u567qZcgxLmvi5N6M2N2eMrc6il20i7fkLIPJYHA'

// Verifica che le credenziali siano valide
if (!url || !url.includes('supabase.co')) {
  throw new Error('URL Supabase non valido')
}

if (!anon || anon.length < 100) {
  throw new Error('Chiave anonima Supabase non valida')
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})


