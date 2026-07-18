// =====================================================
// SCRIPT DI DEBUG PER VERIFICARE IL PROBLEMA U16
// DA ESEGUIRE NELLA CONSOLE DEL BROWSER
// =====================================================

console.log('🔍 DEBUG: Verifico il problema U16...')

// 1. Verifica configurazione U16
async function checkU16Config() {
  console.log('📋 Verifico configurazione U16...')
  
  const { data: category } = await supabase
    .from('categories')
    .select('id, name, code')
    .eq('code', 'U16')
    .single()
  
  if (!category) {
    console.error('❌ Categoria U16 non trovata')
    return null
  }
  
  console.log('✅ Categoria U16:', category)
  
  const { data: locations } = await supabase
    .from('training_locations')
    .select('*')
    .eq('category_id', category.id)
    .order('weekday')
  
  console.log('📅 Configurazione U16:', locations)
  return { category, locations }
}

// 2. Verifica sessioni esistenti U16
async function checkU16Sessions() {
  console.log('📊 Verifico sessioni U16 esistenti...')
  
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('code', 'U16')
    .single()
  
  if (!category) {
    console.error('❌ Categoria U16 non trovata')
    return []
  }
  
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, session_date, location, start_time, end_time')
    .eq('category_id', category.id)
    .order('session_date')
  
  console.log('📅 Sessioni U16 esistenti:', sessions)
  return sessions
}

// 3. Test creazione sessione singola
async function testSingleSession() {
  console.log('🧪 Test creazione sessione singola U16...')
  
  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('code', 'U16')
    .single()
  
  if (!category) {
    console.error('❌ Categoria U16 non trovata')
    return
  }
  
  // Importa le funzioni dal sessionScheduler
  const { createAutomaticSession } = await import('./src/lib/sessionScheduler.js')
  
  const session = await createAutomaticSession(category.id)
  
  if (session) {
    console.log('✅ Sessione creata:', session)
  } else {
    console.error('❌ Errore creazione sessione')
  }
}

// 4. Esegui tutti i test
async function runDebug() {
  console.log('🚀 Inizio debug U16...')
  
  await checkU16Config()
  await checkU16Sessions()
  await testSingleSession()
  
  console.log('🎉 Debug completato!')
}

// Esegui
runDebug()
