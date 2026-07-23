import type { Config } from 'tailwindcss'
import containerQueries from '@tailwindcss/container-queries'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [containerQueries],
  theme: {
    extend: {
      colors: {
        // Colori brand società (CSS vars aggiornate da Personalizzazione Brand)
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          accent: 'var(--brand-accent)',
          success: 'var(--brand-success)',
          warning: 'var(--brand-warning)',
          danger: 'var(--brand-danger)',
          info: 'var(--brand-info)',
        },
        // Colori legacy mantenuti per compatibilità
        navy: '#0B1B3B',
        sky: '#2A60A6',
        offwhite: '#F6F4EF',
        // Colori per stati
        success: '#10b981',        // Verde presenze
        warning: '#f59e0b',        // Giallo permessi
        danger: '#ef4444',         // Rosso assenze/infortuni
        info: '#3b82f6'           // Blu informazioni
      },
      borderRadius: {
        '2xl': '1.25rem'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.20)',
        brand: '0 4px 20px rgba(11, 31, 77, 0.15)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0b1f4d 0%, #4aa3ff 100%)',
        'brand-light': 'linear-gradient(135deg, #f7f7f5 0%, #ffffff 100%)'
      }
    }
  }
} satisfies Config
