// Configurazione brand del club personalizzabile
export interface BrandConfig {
  // Nome e identità del club
  clubName: string
  clubShortName: string
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
  }
  
  // Stagione sportiva
  season: string
  
  // Logo e assets
  assets: {
    logo: string
    logoAlt: string
    favicon: string
    heroImage?: string  // Immagine di sfondo per la homepage
    watermark?: string  // Filigrana per i documenti
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
    showWatermark: boolean
    customCSS?: string
    theme: 'light' | 'dark' | 'auto'
  }
}

// Configurazione di default
export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  // Nome e identità del club
  clubName: 'Brixia Rugby',
  clubShortName: 'Brixia',
  clubDescription: 'Società Sportiva Dilettantistica',
  
  // Colori sociali del club
  colors: {
    primary: '#0b1f4d',      // Blu navy Brixia
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
    website: 'www.brixiarugby.it'
  },
  
  // Stagione sportiva
  season: '2025/26',
  
  // Logo e assets
  assets: {
    logo: '/brixia-logo.svg',
    logoAlt: 'Logo Brixia Rugby',
    favicon: '/favicon.ico',
    heroImage: '/hero-rugby.jpg',
    watermark: '/watermark.png'
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
    showWatermark: false,
    customCSS: '',
    theme: 'light'
  }
}

// Funzione per ottenere la configurazione personalizzata
export const getBrandConfig = (): BrandConfig => {
  try {
    const saved = localStorage.getItem('brixia-brand-config')
    if (saved) {
      return { ...DEFAULT_BRAND_CONFIG, ...JSON.parse(saved) }
    }
  } catch (error) {
    console.warn('Errore nel caricamento configurazione brand:', error)
  }
  return DEFAULT_BRAND_CONFIG
}

// Funzione per salvare la configurazione personalizzata
export const saveBrandConfig = (config: Partial<BrandConfig>) => {
  try {
    const current = getBrandConfig()
    const updated = { ...current, ...config }
    localStorage.setItem('brixia-brand-config', JSON.stringify(updated))
    
    // Aggiorna le variabili CSS personalizzate
    updateCSSVariables(updated)
    
    return true
  } catch (error) {
    console.error('Errore nel salvataggio configurazione brand:', error)
    return false
  }
}

// Funzione per aggiornare le variabili CSS
export const updateCSSVariables = (config: BrandConfig) => {
  const root = document.documentElement
  
  // Colori principali
  root.style.setProperty('--brixia-primary', config.colors.primary)
  root.style.setProperty('--brixia-secondary', config.colors.secondary)
  root.style.setProperty('--brixia-accent', config.colors.accent)
  root.style.setProperty('--brixia-success', config.colors.success)
  root.style.setProperty('--brixia-warning', config.colors.warning)
  root.style.setProperty('--brixia-danger', config.colors.danger)
  root.style.setProperty('--brixia-info', config.colors.info)
  
  // Font e UI
  if (config.ui.fontFamily) {
    root.style.setProperty('--brixia-font-family', config.ui.fontFamily)
  }
  
  // Tema
  if (config.customization.theme !== 'auto') {
    document.documentElement.setAttribute('data-theme', config.customization.theme)
  }
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
