import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Palette, 
  Type, 
  Image, 
  Settings, 
  Save, 
  RotateCcw, 
  Eye,
  Download,
  Upload,
  Trash2
} from 'lucide-react'
import { 
  getBrandConfig, 
  saveBrandConfig, 
  DEFAULT_BRAND_CONFIG,
  type BrandConfig 
} from '@/config/brand'
import { BRAND_CONFIG } from '@/config/brand'

interface ColorPickerProps {
  label: string
  color: string
  onChange: (color: string) => void
  description?: string
}

function ColorPicker({ label, color, onChange, description }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
          placeholder="#000000"
        />
      </div>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  )
}

interface FileUploadProps {
  label: string
  currentFile: string
  onFileChange: (file: string) => void
  accept?: string
  description?: string
}

function FileUpload({ label, currentFile, onFileChange, accept = "image/*", description }: FileUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        onFileChange(result)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="space-y-3">
        {currentFile && (
          <div className="flex items-center gap-3">
            <img 
              src={currentFile} 
              alt="Preview" 
              className="w-16 h-16 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={() => onFileChange('')}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="Rimuovi"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
        <input
          type="file"
          onChange={handleFileChange}
          accept={accept}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brixia-primary file:text-white hover:file:bg-brixia-primary/90"
        />
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
    </div>
  )
}

export default function BrandCustomization() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<BrandConfig>(getBrandConfig())
  const [previewMode, setPreviewMode] = useState(false)
  const [saved, setSaved] = useState(false)

  // Aggiorna la configurazione quando cambia
  useEffect(() => {
    if (previewMode) {
      saveBrandConfig(config)
    }
  }, [config, previewMode])

  const handleSave = () => {
    const success = saveBrandConfig(config)
    if (success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleReset = () => {
    setConfig(DEFAULT_BRAND_CONFIG)
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(config, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `brixia-brand-config-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string)
          setConfig(imported)
        } catch (error) {
          alert('Errore nel caricamento del file. Verifica che sia un JSON valido.')
        }
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brixia-accent to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-brixia-primary to-brixia-secondary text-white p-6 shadow-brixia">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-white/20 transition"
            >
              ←
            </button>
            <div>
              <h1 className="text-3xl font-bold">Personalizzazione Brand</h1>
              <p className="text-brixia-accent/90 text-sm">
                Personalizza l'aspetto grafico della tua app
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                previewMode 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              <Eye size={16} className="mr-2" />
              {previewMode ? 'Anteprima Attiva' : 'Anteprima'}
            </button>
            
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
            >
              <Save size={16} className="mr-2" />
              Salva
            </button>
          </div>
        </div>
      </header>

      {/* Contenuto principale */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Messaggio di salvataggio */}
        {saved && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            ✅ Configurazione salvata con successo!
          </div>
        )}

        {/* Azioni rapide */}
        <div className="mb-8 flex flex-wrap gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RotateCcw size={16} className="mr-2" />
            Ripristina Default
          </button>
          
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Download size={16} className="mr-2" />
            Esporta Config
          </button>
          
          <label className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors cursor-pointer">
            <Upload size={16} className="mr-2" />
            Importa Config
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonna sinistra - Configurazioni principali */}
          <div className="space-y-8">
            
            {/* Identità del Club */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <Type className="text-brixia-primary text-2xl" />
                <h2 className="text-xl font-bold text-brixia-primary">Identità del Club</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Club
                  </label>
                  <input
                    type="text"
                    value={config.clubName}
                    onChange={(e) => setConfig({...config, clubName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                    placeholder="Es: Brixia Rugby"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Abbreviato
                  </label>
                  <input
                    type="text"
                    value={config.clubShortName}
                    onChange={(e) => setConfig({...config, clubShortName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                    placeholder="Es: Brixia"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrizione
                  </label>
                  <textarea
                    value={config.clubDescription}
                    onChange={(e) => setConfig({...config, clubDescription: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                    placeholder="Descrizione del club..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stagione Sportiva
                  </label>
                  <input
                    type="text"
                    value={config.season}
                    onChange={(e) => setConfig({...config, season: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                    placeholder="Es: 2025/26"
                  />
                </div>
              </div>
            </div>

            {/* Colori */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="text-brixia-primary text-2xl" />
                <h2 className="text-xl font-bold text-brixia-primary">Colori del Brand</h2>
              </div>
              
              <div className="space-y-4">
                <ColorPicker
                  label="Colore Principale"
                  color={config.colors.primary}
                  onChange={(color) => setConfig({
                    ...config, 
                    colors: {...config.colors, primary: color}
                  })}
                  description="Colore principale per header, bottoni e elementi chiave"
                />
                
                <ColorPicker
                  label="Colore Secondario"
                  color={config.colors.secondary}
                  onChange={(color) => setConfig({
                    ...config, 
                    colors: {...config.colors, secondary: color}
                  })}
                  description="Colore per accenti e elementi secondari"
                />
                
                <ColorPicker
                  label="Colore di Sfondo"
                  color={config.colors.accent}
                  onChange={(color) => setConfig({
                    ...config, 
                    colors: {...config.colors, accent: color}
                  })}
                  description="Colore di sfondo per le pagine"
                />
                
                <ColorPicker
                  label="Colore Successo"
                  color={config.colors.success}
                  onChange={(color) => setConfig({
                    ...config, 
                    colors: {...config.colors, success: color}
                  })}
                  description="Colore per presenze e azioni positive"
                />
                
                <ColorPicker
                  label="Colore Avviso"
                  color={config.colors.warning}
                  onChange={(color) => setConfig({
                    ...config, 
                    colors: {...config.colors, warning: color}
                  })}
                  description="Colore per permessi e avvisi"
                />
                
                <ColorPicker
                  label="Colore Pericolo"
                  color={config.colors.danger}
                  onChange={(color) => setConfig({
                    ...config, 
                    colors: {...config.colors, danger: color}
                  })}
                  description="Colore per assenze e errori"
                />
              </div>
            </div>

            {/* Contatti */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="text-brixia-primary text-2xl" />
                <h2 className="text-xl font-bold text-brixia-primary">Informazioni di Contatto</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={config.contact.email}
                    onChange={(e) => setConfig({
                      ...config, 
                      contact: {...config.contact, email: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={config.contact.phone}
                    onChange={(e) => setConfig({
                      ...config, 
                      contact: {...config.contact, phone: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={config.contact.address}
                    onChange={(e) => setConfig({
                      ...config, 
                      contact: {...config.contact, address: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sito Web
                  </label>
                  <input
                    type="url"
                    value={config.contact.website}
                    onChange={(e) => setConfig({
                      ...config, 
                      contact: {...config.contact, website: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Colonna destra - Assets e personalizzazioni */}
          <div className="space-y-8">
            
            {/* Logo e Assets */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <Image className="text-brixia-primary text-2xl" />
                <h2 className="text-xl font-bold text-brixia-primary">Logo e Immagini</h2>
              </div>
              
              <div className="space-y-6">
                <FileUpload
                  label="Logo del Club"
                  currentFile={config.assets.logo}
                  onFileChange={(file) => setConfig({
                    ...config, 
                    assets: {...config.assets, logo: file}
                  })}
                  description="Logo principale del club (SVG o PNG consigliato)"
                />
                
                <FileUpload
                  label="Favicon"
                  currentFile={config.assets.favicon}
                  onFileChange={(file) => setConfig({
                    ...config, 
                    assets: {...config.assets, favicon: file}
                  })}
                  accept="image/x-icon,image/png"
                  description="Icona per la scheda del browser (16x16 o 32x32 px)"
                />
                
                <FileUpload
                  label="Immagine Hero (Sfondo Homepage)"
                  currentFile={config.assets.heroImage || ''}
                  onFileChange={(file) => setConfig({
                    ...config, 
                    assets: {...config.assets, heroImage: file}
                  })}
                  description="Immagine di sfondo per la homepage (opzionale)"
                />
                
                <FileUpload
                  label="Filigrana Documenti"
                  currentFile={config.assets.watermark || ''}
                  onFileChange={(file) => setConfig({
                    ...config, 
                    assets: {...config.assets, watermark: file}
                  })}
                  description="Filigrana per report e documenti (opzionale)"
                />
              </div>
            </div>

            {/* Personalizzazioni UI */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="text-brixia-primary text-2xl" />
                <h2 className="text-xl font-bold text-brixia-primary">Personalizzazioni UI</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mostra Immagine Hero
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.customization.showHeroImage}
                      onChange={(e) => setConfig({
                        ...config, 
                        customization: {...config.customization, showHeroImage: e.target.checked}
                      })}
                      className="w-4 h-4 text-brixia-primary focus:ring-brixia-secondary border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-600">
                      Mostra l'immagine di sfondo nella homepage
                    </span>
                  </div>
                </div>
                
                {config.customization.showHeroImage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opacità Immagine Hero
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.customization.heroImageOpacity}
                      onChange={(e) => setConfig({
                        ...config, 
                        customization: {...config.customization, heroImageOpacity: parseFloat(e.target.value)}
                      })}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.round(config.customization.heroImageOpacity * 100)}%
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mostra Filigrana
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.customization.showWatermark}
                      onChange={(e) => setConfig({
                        ...config, 
                        customization: {...config.customization, showWatermark: e.target.checked}
                      })}
                      className="w-4 h-4 text-brixia-primary focus:ring-brixia-secondary border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-600">
                      Mostra filigrana sui report e documenti
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tema
                  </label>
                  <select
                    value={config.customization.theme}
                    onChange={(e) => setConfig({
                      ...config, 
                      customization: {...config.customization, theme: e.target.value as 'light' | 'dark' | 'auto'}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  >
                    <option value="light">Chiaro</option>
                    <option value="dark">Scuro</option>
                    <option value="auto">Automatico</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CSS Personalizzato */}
            <div className="bg-white rounded-2xl p-6 shadow-soft">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="text-brixia-primary text-2xl" />
                <h2 className="text-xl font-bold text-brixia-primary">CSS Personalizzato</h2>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSS Personalizzato
                </label>
                <textarea
                  value={config.customization.customCSS || ''}
                  onChange={(e) => setConfig({
                    ...config, 
                    customization: {...config.customization, customCSS: e.target.value}
                  })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent font-mono text-sm"
                  placeholder="/* Inserisci qui il tuo CSS personalizzato */"
                />
                <p className="text-xs text-gray-500 mt-1">
                  CSS personalizzato per modifiche avanzate all'aspetto dell'app
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Anteprima in tempo reale */}
        {previewMode && (
          <div className="mt-12 bg-white rounded-2xl p-6 shadow-soft">
            <h2 className="text-xl font-bold text-brixia-primary mb-6">Anteprima in Tempo Reale</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card di esempio */}
              <div className={`bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl shadow-soft p-6`}>
                <div className="text-center">
                  <div className="text-4xl mb-3 text-success">🏉</div>
                  <h3 className="text-xl font-bold mb-2" style={{color: config.colors.primary}}>
                    Esempio Card
                  </h3>
                  <p className="text-sm text-gray-600">Questa è un'anteprima di come appariranno le tue card</p>
                </div>
              </div>
              
              {/* Bottoni di esempio */}
              <div className="space-y-4">
                <button 
                  className="w-full px-4 py-2 rounded-2xl font-semibold text-white transition-all duration-200"
                  style={{backgroundColor: config.colors.primary}}
                >
                  Bottone Principale
                </button>
                
                <button 
                  className="w-full px-4 py-2 rounded-2xl font-semibold text-white transition-all duration-200"
                  style={{backgroundColor: config.colors.secondary}}
                >
                  Bottone Secondario
                </button>
              </div>
              
              {/* Colori di esempio */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full" style={{backgroundColor: config.colors.success}}></div>
                  <span className="text-sm">Successo</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full" style={{backgroundColor: config.colors.warning}}></div>
                  <span className="text-sm">Avviso</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full" style={{backgroundColor: config.colors.danger}}></div>
                  <span className="text-sm">Pericolo</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

