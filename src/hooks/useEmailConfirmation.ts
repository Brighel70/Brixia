import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface PendingUser {
  id: string
  full_name: string
  email: string
  phone: string
  password: string
  user_role_id: string
  role_permissions: any[]
}

export const useEmailConfirmation = () => {
  useEffect(() => {
    // Listener per i cambiamenti di autenticazione
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const userId = session.user.id
          
          // Controlla se c'è un utente in attesa di conferma
          const pendingUserKey = `pending_user_${userId}`
          const pendingUserData = localStorage.getItem(pendingUserKey)
          
          if (pendingUserData) {
            try {
              const userData: PendingUser = JSON.parse(pendingUserData)
              

              
              // Crea il profilo
              const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                  id: userData.id,
                  full_name: userData.full_name,
                  email: userData.email,
                  phone: userData.phone,
                  password: userData.password,
                  user_role_id: userData.user_role_id
                })

              if (profileError) {
                console.error('❌ Errore creazione profilo:', profileError)
                return
              }

              // Salva i permessi del ruolo
              if (userData.role_permissions.length > 0) {
                const { error: permissionsError } = await supabase
                  .from('role_permissions')
                  .insert(userData.role_permissions)

                if (permissionsError) {
                  console.warn('⚠️ Errore salvataggio permessi:', permissionsError)
                }
              }

              // Rimuovi i dati temporanei
              localStorage.removeItem(pendingUserKey)
              

              
              // Mostra notifica all'utente
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Account Attivato', {
                  body: `Il tuo account è stato attivato con successo!`,
                  icon: '/favicon.svg'
                })
              }
              
            } catch (error) {
              console.error('❌ Errore nella creazione automatica del profilo:', error)
            }
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])
}


