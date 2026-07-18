import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  itemName?: string
  /** Se true, aggiunge " \"itemName\"?" al messaggio; se false, mostra itemName come sottotitolo sopra il messaggio */
  itemNameInMessage?: boolean
  loading?: boolean
  /** Stile dark in coerenza con l'app (tema scuro) */
  dark?: boolean
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  itemNameInMessage = true,
  loading = false,
  dark = true
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
          dark
            ? 'bg-slate-800/95 border border-white/10 backdrop-blur-xl'
            : 'bg-white border border-slate-200'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Pulsante chiudi (X) in alto a destra */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors z-10 ${
            dark
              ? 'text-slate-400 hover:text-white hover:bg-white/10'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          } disabled:opacity-50`}
          aria-label="Chiudi"
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>

        <div className="p-6 pt-8">
          {/* Icona warning */}
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-5 ${
              dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'
            }`}
          >
            <AlertTriangle className="w-8 h-8" strokeWidth={2} />
          </div>

          <h3
            className={`text-xl font-semibold text-center mb-3 ${
              dark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {title}
          </h3>
          {itemName != null && itemName !== '' && !itemNameInMessage && (
            <p
              className={`text-center text-sm font-medium mb-2 ${
                dark ? 'text-white' : 'text-gray-900'
              }`}
            >
              "{itemName}"
            </p>
          )}
          <p
            className={`text-center text-sm leading-relaxed mb-6 ${
              dark ? 'text-slate-300' : 'text-gray-600'
            }`}
          >
            {message}
            {itemName != null && itemName !== '' && itemNameInMessage && (
              <span className={dark ? 'font-medium text-white' : 'font-medium text-gray-900'}>
                {' '}"{itemName}"?
              </span>
            )}
          </p>

          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
                dark
                  ? 'border border-white/20 text-slate-200 hover:bg-white/10'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Eliminazione...' : 'Elimina'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
