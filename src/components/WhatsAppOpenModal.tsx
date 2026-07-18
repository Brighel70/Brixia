import React, { useState, useEffect, useRef } from 'react'

interface WhatsAppOpenModalProps {
  isOpen: boolean
  url: string
  onClose: () => void
  /** Se true, "Apri WhatsApp" non chiude il modal: apre WhatsApp e quando l'utente torna mostra solo "Invia" */
  waitForReturn?: boolean
  /** Chiamato quando l'utente clicca "Invia" (per mostrare conferma "Messaggio inviato?") */
  onAfterSend?: () => void
}

/** Modal WhatsApp: due pulsanti per aprire l'app o inviare con messaggio */
export default function WhatsAppOpenModal({ isOpen, url, onClose, waitForReturn, onAfterSend }: WhatsAppOpenModalProps) {
  const [showOnlyInvia, setShowOnlyInvia] = useState(false)
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const match = url?.match(/whatsapp:\/\/send\?phone=([^&]+)(?:&text=(.*))?/)
  const phone = match?.[1]
  const urlSoloApp = phone ? `whatsapp://send?phone=${phone}` : null

  // Quando il modal si chiude, reset dello stato
  useEffect(() => {
    if (!isOpen) {
      setShowOnlyInvia(false)
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current)
        fallbackTimeoutRef.current = null
      }
    }
  }, [isOpen])

  // Ascolta il ritorno dell'utente (visibilitychange) quando waitForReturn è attivo
  useEffect(() => {
    if (!isOpen || !waitForReturn) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current)
          fallbackTimeoutRef.current = null
        }
        setShowOnlyInvia(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isOpen, waitForReturn])

  const apriWhatsApp = () => {
    if (urlSoloApp) window.open(urlSoloApp, '_blank')
    if (waitForReturn) {
      // Non chiudere: aspetta visibilitychange (ritorno) oppure fallback dopo 2s
      fallbackTimeoutRef.current = setTimeout(() => setShowOnlyInvia(true), 2000)
    } else {
      onClose()
    }
  }

  const inviaConMessaggio = () => {
    window.open(url, '_blank')
    if (onAfterSend) {
      onAfterSend()
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="text-4xl mb-4">📱</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Preparazione messaggio WhatsApp</h3>
          <p className="text-gray-600 mb-6">
            {showOnlyInvia ? 'Ora invia il messaggio:' : 'Scegli come procedere:'}
          </p>
          <div className="flex flex-col gap-3">
            {!showOnlyInvia && (
              <button
                type="button"
                onClick={apriWhatsApp}
                className="w-full px-4 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium border border-gray-300"
              >
                1) Apri WhatsApp e torna qui
              </button>
            )}
            <button
              type="button"
              onClick={inviaConMessaggio}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              {showOnlyInvia ? 'Invia' : '2) Invia, WhatsApp già aperto'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
