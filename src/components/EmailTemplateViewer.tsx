import { useState } from 'react'
import { EMAIL_TEMPLATES, getEmailTemplate } from '@/config/emailTemplates'

interface TemplateViewerProps {
  className?: string
}

export default function EmailTemplateViewer({ className = '' }: TemplateViewerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof EMAIL_TEMPLATES>('CONFIRM_SIGNUP')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const template = getEmailTemplate(selectedTemplate)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Errore nel copiare:', err)
    }
  }

  const getTemplateDisplayName = (key: string) => {
    const names = {
      CONFIRM_SIGNUP: 'Conferma Registrazione',
      RESET_PASSWORD: 'Reset Password',
      CHANGE_EMAIL: 'Cambio Email'
    }
    return names[key as keyof typeof names] || key
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="card p-6">
        <h3 className="text-xl font-bold text-navy mb-4">📧 Template Email Personalizzati</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleziona Template:
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value as keyof typeof EMAIL_TEMPLATES)}
            className="w-full p-3 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="CONFIRM_SIGNUP">Conferma Registrazione</option>
            <option value="RESET_PASSWORD">Reset Password</option>
            <option value="CHANGE_EMAIL">Cambio Email</option>
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Istruzioni:</strong> Copia questi template e configurali nel dashboard Supabase 
            sotto <strong>Authentication → Email Templates</strong>. Assicurati di mantenere la variabile 
            <code className="bg-blue-100 px-1 rounded">&#123;&#123; .ConfirmationURL &#125;&#125;</code> nei template.
          </p>
        </div>

        {/* Oggetto Email */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Oggetto Email (Subject):
            </label>
            <button
              onClick={() => copyToClipboard(template.subject, 'subject')}
              className="text-sky-600 hover:text-sky-800 text-sm font-medium flex items-center gap-1"
            >
              {copiedField === 'subject' ? '✅ Copiato!' : '📋 Copia'}
            </button>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm">
            {template.subject}
          </div>
        </div>

        {/* Contenuto HTML */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Contenuto HTML:
            </label>
            <button
              onClick={() => copyToClipboard(template.html, 'html')}
              className="text-sky-600 hover:text-sky-800 text-sm font-medium flex items-center gap-1"
            >
              {copiedField === 'html' ? '✅ Copiato!' : '📋 Copia'}
            </button>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="max-h-96 overflow-auto">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap">{template.html}</pre>
            </div>
          </div>
        </div>

        {/* Contenuto Testo */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Contenuto Testo (Fallback):
            </label>
            <button
              onClick={() => copyToClipboard(template.text, 'text')}
              className="text-sky-600 hover:text-sky-800 text-sm font-medium flex items-center gap-1"
            >
              {copiedField === 'text' ? '✅ Copiato!' : '📋 Copia'}
            </button>
          </div>
          <div className="bg-gray-100 p-3 rounded-lg">
            <div className="max-h-96 overflow-auto">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap">{template.text}</pre>
            </div>
          </div>
        </div>

        {/* Anteprima */}
        <div>
          <h4 className="text-lg font-semibold text-navy mb-3">👀 Anteprima Template</h4>
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b">
              <strong>Oggetto:</strong> {template.subject}
            </div>
            <div 
              className="p-4 max-h-96 overflow-auto"
              dangerouslySetInnerHTML={{ __html: template.html }}
            />
          </div>
        </div>
      </div>

      {/* Informazioni aggiuntive */}
      <div className="card p-6 bg-green-50 border border-green-200">
        <h4 className="text-lg font-semibold text-green-800 mb-3">✅ Template Pronto per l'Uso</h4>
        <div className="text-sm text-green-700 space-y-2">
          <p>• <strong>Branding:</strong> Utilizza i colori ufficiali di IL Brixia Rugby</p>
          <p>• <strong>Sicurezza:</strong> Include messaggi rassicuranti sulla sicurezza</p>
          <p>• <strong>Responsive:</strong> Design ottimizzato per tutti i dispositivi</p>
          <p>• <strong>Fallback:</strong> Versione testo per client email che non supportano HTML</p>
          <p>• <strong>Variabili:</strong> Utilizza correttamente le variabili Supabase</p>
        </div>
      </div>
    </div>
  )
}
