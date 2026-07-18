// =====================================================
// SCRIPT SEMPLICE PER VERIFICARE IL PROBLEMA U16
// =====================================================

// Verifica configurazione U16 nel database
const checkU16Config = async () => {
  console.log('🔍 Verifico configurazione U16...')
  
  try {
    // Carica configurazione U16
    const { data: category } = await supabase
      .from('categories')
      .select('id, name, code')
      .eq('code', 'U16')
      .single()
    
    if (!category) {
      console.error('❌ Categoria U16 non trovata')
      return
    }
    
    console.log('✅ Categoria U16 trovata:', category)
    
    // Carica training locations
    const { data: locations } = await supabase
      .from('training_locations')
      .select('*')
      .eq('category_id', category.id)
      .order('weekday')
    
    console.log('📅 Configurazione U16:', locations)
    
    // Carica sessioni esistenti
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_date, location, start_time, end_time')
      .eq('category_id', category.id)
      .order('session_date')
    
    console.log('📊 Sessioni U16 esistenti:', sessions)
    
    return { category, locations, sessions }
  } catch (error) {
    console.error('❌ Errore:', error)
  }
}

// Esegui il check
checkU16Config()



