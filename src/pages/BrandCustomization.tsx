import { useState, useEffect, useRef } from 'react'
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
import Header from '@/components/Header'
import { supabase } from '@/lib/supabaseClient'
import { 
  getBrandConfig, 
  saveBrandConfig, 
  updateCSSVariables,
  DEFAULT_BRAND_CONFIG,
  type BrandConfig 
} from '@/config/brand'

const BRAND_SETTINGS_KEY = 'mobile_app_logo_url'
/** Nome file in Storage per il "Logo del Club" (usato anche nella pagina di login) */
export const CLUB_LOGO_STORAGE_NAME = 'club-logo'

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

/** Ridimensiona l'immagine mantenendo la trasparenza (PNG, senza sfondo). Gli SVG non vengono modificati. */
async function compressImageDataUrl(dataUrl: string, maxSizePx = 800): Promise<string> {
  if (dataUrl.startsWith('data:image/svg')) return dataUrl
  return new Promise((resolve) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let w = img.width
      let h = img.height
      if (w > maxSizePx || h > maxSizePx) {
        if (w > h) {
          h = Math.round((h * maxSizePx) / w)
          w = maxSizePx
        } else {
          w = Math.round((w * maxSizePx) / h)
          h = maxSizePx
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      // Non riempire lo sfondo: resta trasparente così i loghi restano senza sfondo
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      try {
        const out = canvas.toDataURL('image/png')
        resolve(out)
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

interface FileUploadProps {
  label: string
  currentFile: string
  onFileChange: (file: string) => void
  accept?: string
  description?: string
  maxSizePx?: number
  /** Anteprima più grande (es. per logo centrale header) */
  previewLarge?: boolean
  /** Sfondo come header (gradiente brand) per vedere il logo come in home */
  previewHeaderBg?: boolean
}

function FileUpload({ label, currentFile, onFileChange, accept = "image/*", description, maxSizePx = 800, previewLarge, previewHeaderBg }: FileUploadProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const result = e.target?.result as string
        const compressed = await compressImageDataUrl(result, maxSizePx)
        onFileChange(compressed)
      }
      reader.readAsDataURL(file)
    }
  }

  const previewSizeClass = previewLarge ? 'w-64 h-24 min-h-[6rem]' : 'w-32 h-20'
  const previewBgClass = previewHeaderBg
    ? 'bg-gradient-to-r from-brixia-primary to-brixia-secondary'
    : 'bg-white'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="space-y-3">
        {currentFile && (
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center rounded-lg border border-gray-200 overflow-hidden ${previewSizeClass} ${previewBgClass}`}>
              <img 
                src={currentFile} 
                alt="Preview" 
                className={`w-full h-full object-contain p-1`}
              />
            </div>
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

interface BrandCustomizationProps {
  embedInLayout?: boolean
}

export default function BrandCustomization({ embedInLayout = false }: BrandCustomizationProps) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<BrandConfig>(getBrandConfig())
  const [previewMode, setPreviewMode] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)
  const [logoMobileSetupOk, setLogoMobileSetupOk] = useState<boolean | null>(null)
  const [logoMobileSynced, setLogoMobileSynced] = useState(false)

  const checkLogoMobileSetup = async () => {
    const { error } = await supabase.from('brand_settings').select('key').limit(1)
    setLogoMobileSetupOk(!error)
  }

  useEffect(() => {
    checkLogoMobileSetup()
  }, [])

  // Aggiorna le variabili CSS in tempo reale quando cambiano i colori (anteprima visiva)
  useEffect(() => {
    updateCSSVariables(config)
  }, [config])

  // In modalità anteprima, salva anche su disco
  useEffect(() => {
    if (previewMode) {
      saveBrandConfig(config).catch(() => {})
    }
  }, [config, previewMode])

  // Scroll alla sezione anteprima quando si attiva
  useEffect(() => {
    if (previewMode && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [previewMode])

  const handleCopyLogoSetupScript = async () => {
    try {
      const r = await fetch('/setup_logo_app_mobile.sql')
      const text = await r.text()
      await navigator.clipboard.writeText(text)
      alert('Script copiato negli appunti. Incollalo nel SQL Editor di Supabase e clicca Esegui.')
    } catch {
      alert('Apri Supabase → SQL Editor → Nuova query, poi copia il contenuto del file setup_logo_app_mobile.sql dalla cartella del progetto.')
    }
  }

  const handleSave = async () => {
    const success = await saveBrandConfig(config)
    if (!success) {
      alert('Errore nel salvataggio. Riprova.')
      return
    }
    // Sincronizza "Logo del Club" su Storage (stesso logo usato nella pagina di login)
      const clubLogo = config.assets.logo?.trim() || ''
      if (clubLogo && clubLogo.startsWith('data:')) {
        try {
          const res = await fetch(clubLogo)
          const blob = await res.blob()
          const ext = clubLogo.includes('svg') ? 'svg' : 'png'
          const fileName = `${CLUB_LOGO_STORAGE_NAME}.${ext}`
          const file = new File([blob], fileName, { type: blob.type })
          const { error: uploadErr } = await supabase.storage.from('brand').upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type })
          if (!uploadErr) {
            const otherExt = ext === 'svg' ? 'png' : 'svg'
            await supabase.storage.from('brand').remove([`${CLUB_LOGO_STORAGE_NAME}.${otherExt}`]).catch(() => {})
          }
        } catch (e) {
          console.warn('Sincronizzazione Logo del Club su Storage non riuscita:', e)
        }
      }

    // Sincronizza logo app mobile e Nome Club su Supabase (brand_settings) per l'app FlowMe
    const mobileLogo = config.assets.mobileAppLogo?.trim() || ''
    try {
      // Nome Club (campo "NOME CLUB"): visibile nell'header basso dell'app FlowMe su smartphone/tablet
      await supabase.from('brand_settings').upsert(
        { key: 'club_name', value: config.clubName?.trim() || '', updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (mobileLogo && mobileLogo.startsWith('data:')) {
        const res = await fetch(mobileLogo)
        const blob = await res.blob()
        const ext = mobileLogo.includes('svg') ? 'svg' : 'png'
        const fileName = `mobile-app-logo.${ext}`
        const file = new File([blob], fileName, { type: blob.type })
        const { error: uploadError } = await supabase.storage
          .from('brand')
          .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: file.type })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('brand').getPublicUrl(fileName)
        const publicUrl = urlData?.publicUrl || ''
        await supabase.from('brand_settings').upsert(
          { key: BRAND_SETTINGS_KEY, value: publicUrl, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        setLogoMobileSynced(true)
        setTimeout(() => setLogoMobileSynced(false), 5000)
        const otherExt = ext === 'svg' ? 'png' : 'svg'
        await supabase.storage.from('brand').remove([`mobile-app-logo.${otherExt}`]).catch(() => {})
      } else {
        await supabase.storage.from('brand').remove(['mobile-app-logo.png', 'mobile-app-logo.svg']).catch(() => {})
        await supabase.from('brand_settings').upsert(
          { key: BRAND_SETTINGS_KEY, value: null, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      }
    } catch (e) {
      console.warn('Sincronizzazione logo app mobile non riuscita:', e)
      setLogoMobileSetupOk(false)
      alert(
        'Configurazione salvata, ma il logo per l\'app mobile non è stato sincronizzato. ' +
        'Esegui in Supabase (SQL Editor) lo script setup_logo_app_mobile.sql (vedi avviso in questa pagina). ' +
        'Dettaglio: ' + (e instanceof Error ? e.message : String(e))
      )
    }
    await checkLogoMobileSetup()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
    <div className={`min-h-full bg-gray-50 ${embedInLayout ? '' : 'min-h-screen'}`}>
      {!embedInLayout && (
        <Header
          title="Personalizzazione Brand"
          subtitle="Personalizza l'aspetto grafico della tua app"
          showBack={true}
        />
      )}

      <main className="max-w-6xl mx-auto p-6">
        {/* Messaggio di salvataggio */}
        {saved && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            ✅ Configurazione salvata con successo!
            {logoMobileSynced && (
              <p className="mt-2 font-medium">Logo app mobile sincronizzato. Riapri l&apos;app FlowMe (o torna sull&apos;app) per vederlo.</p>
            )}
          </div>
        )}

        {/* Avviso: setup logo app mobile non eseguito */}
        {logoMobileSetupOk === false && (
          <div className="mb-6 p-4 bg-amber-100 border border-amber-500 text-amber-900 rounded-lg">
            <p className="font-semibold mb-2">Logo app mobile (FlowMe) non attivo</p>
            <p className="text-sm mb-3">
              Per far comparire il logo nell&apos;app FlowMe devi eseguire una volta lo script su Supabase: apri il progetto Supabase → SQL Editor → incolla lo script qui sotto e clicca Esegui.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyLogoSetupScript}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
              >
                Copia script negli appunti
              </button>
              <button
                type="button"
                onClick={checkLogoMobileSetup}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
              >
                Ho eseguito lo script
              </button>
            </div>
          </div>
        )}

        {/* Azioni rapide - distribuite orizzontalmente come il contenitore sotto */}
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-4 py-2 rounded-lg transition-colors min-w-0 ${
              previewMode
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
            }`}
          >
            <Eye size={16} className="inline mr-2" />
            {previewMode ? 'Anteprima Attiva' : 'Anteprima'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors min-w-0"
          >
            <Save size={16} className="inline mr-2" />
            Salva
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-w-0"
          >
            <RotateCcw size={16} className="mr-2" />
            Ripristina Default
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors min-w-0"
          >
            <Download size={16} className="mr-2" />
            Esporta Config
          </button>
          <label className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors cursor-pointer min-w-0 flex items-center justify-center">
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

        {/* Logo e Immagini */}
        <div className="mb-8 bg-white rounded-2xl p-6 shadow-soft overflow-x-auto">
          <div className="flex items-center gap-3 mb-6">
            <Image className="text-brixia-primary text-2xl" />
            <h2 className="text-xl font-bold text-brixia-primary">Logo e Immagini</h2>
          </div>

          {/* 6 campi in griglia: 2 righe × 3 colonne, distribuzione orizzontale uniforme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="min-w-0">
              <FileUpload
                label="Logo del Club"
                currentFile={config.assets.logo}
                onFileChange={(file) => setConfig({
                  ...config, 
                  assets: {...config.assets, logo: file}
                })}
                description="Logo principale del club (SVG o PNG consigliato)"
                previewLarge
                previewHeaderBg
              />
            </div>
            <div className="min-w-0">
              <FileUpload
                label="Logo centrale header"
                currentFile={config.assets.headerCenterLogo || ''}
                onFileChange={(file) => setConfig({
                  ...config, 
                  assets: {...config.assets, headerCenterLogo: file}
                })}
                description="Logo al centro dell'header in tutte le pagine"
                previewLarge
                previewHeaderBg
              />
            </div>
            <div className="min-w-0">
              <FileUpload
                label="Logo app mobile (FlowMe)"
                currentFile={config.assets.mobileAppLogo || ''}
                onFileChange={(file) => setConfig({
                  ...config, 
                  assets: {...config.assets, mobileAppLogo: file}
                })}
                description="Logo mostrato al centro dell'header nell'app mobile FlowMe. Clicca Salva per inviare il logo all'app."
                previewLarge
                previewHeaderBg
              />
            </div>
            <div className="min-w-0">
              <FileUpload
                label="Logo per Carta intestata"
                currentFile={config.assets.letterheadLogo || ''}
                onFileChange={(file) => setConfig({
                  ...config, 
                  assets: {...config.assets, letterheadLogo: file}
                })}
                description="Logo mostrato a destra nell'intestazione delle ricevute PDF."
                previewLarge
              />
            </div>
            <div className="min-w-0">
              <FileUpload
                label="Favicon"
                currentFile={config.assets.favicon}
                onFileChange={(file) => setConfig({
                  ...config, 
                  assets: {...config.assets, favicon: file}
                })}
                accept="image/x-icon,image/png"
                description="Icona per la scheda del browser (16x16 o 32x32 px)"
                maxSizePx={128}
              />
            </div>
            <div className="min-w-0">
              <FileUpload
                label="Immagine Hero (Sfondo Homepage)"
                currentFile={config.assets.heroImage || ''}
                onFileChange={(file) => setConfig({
                  ...config, 
                  assets: {...config.assets, heroImage: file}
                })}
                description="Immagine di sfondo per la homepage (opzionale)"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonna sinistra */}
          <div className="space-y-8">
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
          </div>

          {/* Colonna destra */}
          <div className="space-y-8">
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

        {/* Informazioni di Contatto e Identità del Club - affiancate */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Informazioni di Contatto */}
          <div className="bg-white rounded-2xl p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="text-brixia-primary text-2xl" />
              <h2 className="text-xl font-bold text-brixia-primary">Informazioni di Contatto</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={config.contact.email}
                  onChange={(e) => setConfig({ ...config, contact: { ...config.contact, email: e.target.value.toLowerCase() } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
                <input
                  type="tel"
                  value={config.contact.phone}
                  onChange={(e) => setConfig({ ...config, contact: { ...config.contact, phone: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo</label>
                <input
                  type="text"
                  value={config.contact.address}
                  onChange={(e) => setConfig({ ...config, contact: { ...config.contact, address: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sito Web</label>
                <input
                  type="url"
                  value={config.contact.website}
                  onChange={(e) => setConfig({ ...config, contact: { ...config.contact, website: e.target.value } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link app FlowMe (login)</label>
                <input
                  type="url"
                  value={config.contact.flowmeAppUrl || ''}
                  onChange={(e) => setConfig({ ...config, contact: { ...config.contact, flowmeAppUrl: e.target.value } })}
                  placeholder="https://flowme-lemon.vercel.app/login"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Link cliccabile inviato nei messaggi WhatsApp di benvenuto</p>
              </div>
            </div>
          </div>

          {/* Identità del Club */}
          <div className="bg-white rounded-2xl p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-6">
              <Type className="text-brixia-primary text-2xl" />
              <h2 className="text-xl font-bold text-brixia-primary">Identità del Club</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Club</label>
                <input
                  type="text"
                  value={config.clubName}
                  onChange={(e) => setConfig({ ...config, clubName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  placeholder="Es: Brixia Rugby"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Abbreviato</label>
                <input
                  type="text"
                  value={config.clubShortName}
                  onChange={(e) => setConfig({ ...config, clubShortName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  placeholder="Es: Brixia"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                <textarea
                  value={config.clubDescription}
                  onChange={(e) => setConfig({ ...config, clubDescription: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  placeholder="Descrizione del club..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stagione Sportiva</label>
                <input
                  type="text"
                  value={config.season}
                  onChange={(e) => setConfig({ ...config, season: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brixia-secondary focus:border-transparent"
                  placeholder="Es: 2025/26"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Anteprima in tempo reale */}
        {previewMode && (
          <div ref={previewRef} className="mt-12 bg-white rounded-2xl p-6 shadow-soft">
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

