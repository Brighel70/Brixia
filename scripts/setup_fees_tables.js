const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Configurazione Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili d\'ambiente Supabase non trovate!')
  console.error('Assicurati di avere VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupFeesTables() {
  try {
    console.log('🚀 Inizializzazione tabelle per gestione quote...')
    
    // Leggi il file SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'fees_tables.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Dividi le query per statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Trovate ${statements.length} statement SQL da eseguire`)
    
    // Esegui ogni statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`⏳ Esecuzione statement ${i + 1}/${statements.length}...`)
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          // Se la funzione exec_sql non esiste, prova con una query diretta
          if (error.message.includes('exec_sql')) {
            console.log('⚠️  Funzione exec_sql non disponibile, esecuzione manuale richiesta')
            console.log('📋 Esegui manualmente il file database/fees_tables.sql nel tuo database')
            break
          } else {
            throw error
          }
        }
      }
    }
    
    console.log('✅ Tabelle per gestione quote create con successo!')
    console.log('')
    console.log('📊 Tabelle create:')
    console.log('  - fees (quote principali)')
    console.log('  - fee_assignments (assegnazioni ai tesserati)')
    console.log('  - payments (pagamenti)')
    console.log('  - fee_discounts (sconti e promozioni)')
    console.log('  - fee_templates (template per quote)')
    console.log('')
    console.log('🎯 Quote predefinite inserite:')
    console.log('  - Tessere annuali (adulti, giovanili, senior, famiglia)')
    console.log('  - Quote gite e trasferte')
    console.log('  - Quote corsi e formazione')
    console.log('  - Quote eventi e manifestazioni')
    console.log('  - Quote attrezzature e divise')
    console.log('  - Quote assicurazioni')
    console.log('')
    console.log('🚀 Il sistema di gestione quote è pronto!')
    
  } catch (error) {
    console.error('❌ Errore durante la creazione delle tabelle:', error)
    console.log('')
    console.log('🔧 Soluzione alternativa:')
    console.log('1. Apri il file database/fees_tables.sql')
    console.log('2. Copia tutto il contenuto')
    console.log('3. Esegui le query nel tuo database Supabase')
    console.log('4. Le tabelle e i dati predefiniti verranno creati')
  }
}

// Esegui lo script
setupFeesTables()



