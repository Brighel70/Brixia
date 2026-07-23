import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Compatibilità per il vecchio link /create-user.
 * Una persona e il suo accesso vengono creati insieme dall'anagrafica canonica.
 */
export default function CreateUser() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/create-person?tab=flowme&from=/users-management', { replace: true })
  }, [navigate])

  return <div className="p-6 text-sm text-slate-600">Apertura della scheda persona...</div>
}
