import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colori brand Brixia Rugby
        brixia: {
          primary: '#0b1f4d',      // Blu navy Brixia
          secondary: '#4aa3ff',    // Celeste
          accent: '#f7f7f5',       // Bianco sporco
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
        'brixia': '0 4px 20px rgba(11, 31, 77, 0.15)'
      },
      backgroundImage: {
        'brixia-gradient': 'linear-gradient(135deg, #0b1f4d 0%, #4aa3ff 100%)',
        'brixia-light': 'linear-gradient(135deg, #f7f7f5 0%, #ffffff 100%)'
      }
    }
  },
  plugins: []
} satisfies Config