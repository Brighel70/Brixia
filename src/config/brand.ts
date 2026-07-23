// Configurazione brand del club personalizzabile
export interface BrandConfig {
  // Nome e identità del club
  clubName: string
  clubShortName: string
  /** Nome mostrato nel footer dei PDF (es. presentazione evento). Se non impostato si usa clubName. */
  footerName?: string
  clubDescription: string
  
  // Colori sociali del club
  colors: {
    primary: string      // Colore principale
    secondary: string    // Colore secondario
    accent: string       // Colore di sfondo
    success: string      // Verde per presenze
    warning: string      // Giallo per permessi
    danger: string       // Rosso per assenze/infortuni
    info: string        // Blu per informazioni
    light: string       // Grigio chiaro
    dark: string        // Grigio scuro
  }
  
  // Informazioni di contatto
  contact: {
    email: string
    phone: string
    address: string
    website: string
    flowmeAppUrl?: string  // URL app FlowMe per login (link cliccabile nei messaggi WhatsApp)
  }
  
  // Stagione sportiva
  season: string
  
  // Logo e assets
  assets: {
    logo: string
    logoAlt: string
    favicon: string
    heroImage?: string  // Immagine di sfondo per la homepage
    headerCenterLogo?: string  // Logo al centro dell'header (caricabile da Brand)
    mobileAppLogo?: string     // Logo al centro header app mobile FlowMe (data URL in UI; URL pubblico salvato su Supabase)
    letterheadLogo?: string    // Logo per carta intestata (ricevute PDF, a destra nell'header)
  }
  
  // Configurazione UI
  ui: {
    borderRadius: string
    shadow: string
    animation: string
    fontFamily?: string
    fontSize?: string
  }
  
  // Personalizzazioni aggiuntive
  customization: {
    showHeroImage: boolean
    heroImageOpacity: number
    showWatermark?: boolean  // rimosso dall'UI, opzionale per compatibilità
    customCSS?: string
    theme: 'light' | 'dark' | 'auto'
  }
}

// Seed club di default per questa installazione (non è il nome del prodotto TeamFlow).
// Altre società sovrascrivono tutto da Personalizzazione Brand / storage.
export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  // Nome e identità del club
  clubName: 'Brixia Rugby',
  clubShortName: 'Brixia',
  footerName: 'Brixia A.s.d',
  clubDescription: 'Società Sportiva Dilettantistica',
  
  // Colori sociali del club
  colors: {
    primary: '#0b1f4d',      // Blu navy
    secondary: '#4aa3ff',    // Celeste
    accent: '#f7f7f5',       // Bianco sporco
    success: '#10b981',      // Verde per presenze
    warning: '#f59e0b',      // Giallo per permessi
    danger: '#ef4444',       // Rosso per assenze/infortuni
    info: '#3b82f6',        // Blu per informazioni
    light: '#f8fafc',       // Grigio chiaro
    dark: '#1e293b'         // Grigio scuro
  },
  
  // Informazioni di contatto
  contact: {
    email: 'info@brixiarugby.it',
    phone: '+39 030 1234567',
    address: 'Via del Rugby, 123 - Brescia',
    website: 'www.brixiarugby.it',
    flowmeAppUrl: 'https://flowme-lemon.vercel.app/login'
  },
  
  // Stagione sportiva
  season: '2025/26',
  
  // Logo e assets del club (file in public/; sostituibili da Brand)
  assets: {
    logo: '/logo-brixia-official.png',
    logoAlt: 'Logo società',
    favicon: '/favicon.ico',
    heroImage: '/hero-rugby.jpg',
    headerCenterLogo: '/TeamFlow%20bubble.png',  // Logo prodotto header (sostituibile)
    mobileAppLogo: '',  // Logo app mobile: caricato da Brand, pubblicato su Storage per FlowMe
    letterheadLogo: ''  // Logo per carta intestata (ricevute PDF)
  },
  
  // Configurazione UI
  ui: {
    borderRadius: 'rounded-2xl',
    shadow: 'shadow-soft',
    animation: 'transition-all duration-200',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 'base'
  },
  
  // Personalizzazioni aggiuntive
  customization: {
    showHeroImage: true,
    heroImageOpacity: 0.3,
    customCSS: '',
    theme: 'light'
  }
}

const BRAND_STORAGE_KEY = 'teamflow-brand-config'
const LEGACY_BRAND_STORAGE_KEY = 'brixia-brand-config'
const IDB_NAME = 'TeamFlowBrand'
const LEGACY_IDB_NAME = 'AppBrixiaBrand'
const IDB_VERSION = 1
const IDB_STORE = 'config'

let cachedConfig: BrandConfig | null = null

function openBrandDB(name: string = IDB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, IDB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
  })
}

async function getBrandFromIDB(): Promise<string | null> {
  const tryGet = async (dbName: string, key: string): Promise<string | null> => {
    try {
      const db = await openBrandDB(dbName)
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly')
        const req = tx.objectStore(IDB_STORE).get(key)
        req.onsuccess = () => {
          db.close()
          resolve((req.result as string | undefined) ?? null)
        }
        req.onerror = () => {
          db.close()
          reject(req.error)
        }
      })
    } catch {
      return null
    }
  }

  return (
    (await tryGet(IDB_NAME, BRAND_STORAGE_KEY)) ||
    (await tryGet(IDB_NAME, LEGACY_BRAND_STORAGE_KEY)) ||
    (await tryGet(LEGACY_IDB_NAME, LEGACY_BRAND_STORAGE_KEY)) ||
    (await tryGet(LEGACY_IDB_NAME, BRAND_STORAGE_KEY))
  )
}

async function setBrandInIDB(json: string): Promise<void> {
  const db = await openBrandDB(IDB_NAME)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(json, BRAND_STORAGE_KEY)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

/** Inizializza la config (leggendo da IndexedDB o migrando da localStorage). Chiamare prima del primo render. */
export async function initBrandConfig(): Promise<BrandConfig> {
  try {
    let json: string | null = await getBrandFromIDB()
    if (!json) {
      const fromLS =
        localStorage.getItem(BRAND_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_BRAND_STORAGE_KEY)
      if (fromLS) {
        json = fromLS
        await setBrandInIDB(json)
        try {
          localStorage.removeItem(BRAND_STORAGE_KEY)
          localStorage.removeItem(LEGACY_BRAND_STORAGE_KEY)
        } catch (_) {}
      }
    } else {
      // Migra su chiavi/DB nuovi se arrivava dal legacy
      await setBrandInIDB(json)
    }
    if (json) {
      const parsed = JSON.parse(json)
      const mergedAssets = { ...DEFAULT_BRAND_CONFIG.assets, ...parsed.assets }
      cachedConfig = { ...DEFAULT_BRAND_CONFIG, ...parsed, assets: mergedAssets }
    } else {
      cachedConfig = DEFAULT_BRAND_CONFIG
    }
    updateCSSVariables(cachedConfig)
    return cachedConfig
  } catch (error) {
    console.warn('Errore init configurazione brand:', error)
    cachedConfig = DEFAULT_BRAND_CONFIG
    return cachedConfig
  }
}

// Funzione per ottenere la configurazione personalizzata (sincrona, usa cache)
export const getBrandConfig = (): BrandConfig => {
  if (cachedConfig) return cachedConfig
  try {
    const saved =
      localStorage.getItem(BRAND_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_BRAND_STORAGE_KEY)
    if (saved) return { ...DEFAULT_BRAND_CONFIG, ...JSON.parse(saved) }
  } catch (_) {}
  return DEFAULT_BRAND_CONFIG
}

// Funzione per salvare la configurazione personalizzata (usa IndexedDB, quota molto più alta di localStorage)
export async function saveBrandConfig(config: Partial<BrandConfig>): Promise<boolean> {
  try {
    const current = getBrandConfig()
    const mergedAssets = { ...current.assets, ...(config.assets || {}) }
    const updated = { ...current, ...config, assets: mergedAssets }
    cachedConfig = updated
    updateCSSVariables(updated)
    const json = JSON.stringify(updated)
    await setBrandInIDB(json)
    window.dispatchEvent(new CustomEvent('brand-config-updated'))
    return true
  } catch (error) {
    console.error('Errore nel salvataggio configurazione brand:', error)
    return false
  }
}

/** Aggiorna il favicon del documento con quello dalla config (data URL o path). */
export function applyFavicon(config: BrandConfig) {
  const favicon = config.assets?.favicon?.trim()
  if (!favicon) return
  let existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!existing) {
    existing = document.createElement('link')
    existing.rel = 'icon'
    document.head.appendChild(existing)
  }
  existing.href = favicon
}

// Funzione per aggiornare le variabili CSS
export const updateCSSVariables = (config: BrandConfig) => {
  const root = document.documentElement
  
  // Colori principali (token prodotto-neutri; valori = club corrente)
  root.style.setProperty('--brand-primary', config.colors.primary)
  root.style.setProperty('--brand-secondary', config.colors.secondary)
  root.style.setProperty('--brand-accent', config.colors.accent)
  root.style.setProperty('--brand-success', config.colors.success)
  root.style.setProperty('--brand-warning', config.colors.warning)
  root.style.setProperty('--brand-danger', config.colors.danger)
  root.style.setProperty('--brand-info', config.colors.info)
  
  // Font e UI
  if (config.ui.fontFamily) {
    root.style.setProperty('--brand-font-family', config.ui.fontFamily)
  }
  
  // Tema
  if (config.customization.theme !== 'auto') {
    document.documentElement.setAttribute('data-theme', config.customization.theme)
  }

  // Favicon dalla config (data URL o path)
  applyFavicon(config)
}

// Utility per accedere ai colori
export const getBrandColor = (colorName: keyof BrandConfig['colors']) => {
  const config = getBrandConfig()
  return config.colors[colorName]
}

// Utility per le classi CSS del brand
export const getBrandClasses = () => {
  const config = getBrandConfig()
  return {
    card: `bg-white/90 backdrop-blur-xl border border-white/60 ${config.ui.borderRadius} ${config.ui.shadow}`,
    button: `rounded-2xl px-4 py-2 font-semibold ${config.ui.animation} hover:opacity-90 active:scale-95`,
    primaryButton: `bg-[${config.colors.primary}] text-white hover:bg-[${config.colors.primary}]/90`,
    secondaryButton: `bg-[${config.colors.secondary}] text-white hover:bg-[${config.colors.secondary}]/90`
  }
}

// Esporta la configurazione corrente per compatibilità
export const BRAND_CONFIG = getBrandConfig()
