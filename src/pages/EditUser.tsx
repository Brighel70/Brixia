import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

/**
 * Compatibilità per vecchi link /edit-user/:id.
 * L'anagrafica è l'unica schermata che modifica ruoli, sezioni e codici di accesso.
 */
export default function EditUser() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [message, setMessage] = useState('Apertura scheda persona...')

  useEffect(() => {
    let cancelled = false

    const redirectToPerson = async () => {
      if (!userId) {
        setMessage('Utente non valido.')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('person_id')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return
      if (error || !data?.person_id) {
        setMessage('Questo account non è collegato a una scheda persona. Controlla l’anagrafica prima di modificarne l’accesso.')
        return
      }

      navigate(`/create-person?edit=${data.person_id}&tab=flowme&from=/users-management`, { replace: true })
    }

    void redirectToPerson()
    return () => { cancelled = true }
  }, [navigate, userId])

  return <div className="p-8 text-center text-gray-600">{message}</div>
}
