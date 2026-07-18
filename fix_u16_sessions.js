// =====================================================
// SCRIPT PER RICREARE SESSIONI U16 CORRETTE
// =====================================================

// Questo script cancella le sessioni U16 sbagliate e le ricrea
// con il sistema automatico corretto

console.log('🚀 Inizio pulizia e ricreazione sessioni U16...')

// 1. Prima cancella le sessioni U16 esistenti
async function cleanU16Sessions() {
  try {
    console.log('🧹 Cancellazione sessioni U16 esistenti...')
    
    // Cancella presenze prima
    const { error: attendanceError } = await supabase
      .from('attendance')
      .delete()
      .in('session_id', 
        supabase
          .from('sessions')
          .select('id')
          .in('category_id', 
            supabase
              .from('categories')
              .select('id')
              .eq('code', 'U16')
          )
      )
    
    if (attendanceError) {
      console.error('❌ Errore cancellazione presenze:', attendanceError)
    } else {
      console.log('✅ Presenze U16 cancellate')
    }
    
    // Cancella sessioni
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .in('category_id', 
        supabase
          .from('categories')
          .select('id')
          .eq('code', 'U16')
      )
    
    if (sessionsError) {
      console.error('❌ Errore cancellazione sessioni:', sessionsError)
    } else {
      console.log('✅ Sessioni U16 cancellate')
    }
    
  } catch (error) {
    console.error('❌ Errore nella pulizia:', error)
  }
}

// 2. Ricrea le sessioni U16 con il sistema corretto
async function recreateU16Sessions() {
  try {
    console.log('🔄 Ricreazione sessioni U16...')
    
    // Trova l'ID della categoria U16
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, code')
      .eq('code', 'U16')
      .single()
    
    if (categoryError || !category) {
      console.error('❌ Categoria U16 non trovata:', categoryError)
      return
    }
    
    console.log('📋 Categoria trovata:', category)
    
    // Usa il sistema automatico per creare 6 sessioni
    const sessions = await createMultipleAutomaticSessions(category.id, 6)
    
    if (sessions && sessions.length > 0) {
      console.log('✅ Sessioni U16 ricreate:', sessions.length)
      sessions.forEach((session, index) => {
        console.log(`  ${index + 1}. ${session.session_date} (${session.location})`)
      })
    } else {
      console.error('❌ Nessuna sessione creata')
    }
    
  } catch (error) {
    console.error('❌ Errore nella ricreazione:', error)
  }
}

// 3. Esegui il processo completo
async function fixU16Sessions() {
  console.log('🎯 Inizio correzione sessioni U16...')
  
  await cleanU16Sessions()
  await new Promise(resolve => setTimeout(resolve, 1000)) // Pausa
  await recreateU16Sessions()
  
  console.log('🎉 Correzione sessioni U16 completata!')
}

// Esegui
fixU16Sessions()



