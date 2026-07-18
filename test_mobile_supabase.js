// TEST DIRETTO SUPABASE PER APP MOBILE
// Esegui questo script nella console del browser dell'app mobile

async function testSupabaseConnection() {
  console.log('🔍 Test connessione Supabase per app mobile...');
  
  // Test 1: Verifica se supabase è disponibile
  if (typeof supabase === 'undefined') {
    console.error('❌ Supabase client non trovato!');
    return;
  }
  
  console.log('✅ Supabase client trovato:', supabase);
  
  // Test 2: Query diretta per Federico Viola
  const federicoViolaId = '56c2846c-2be6-4d72-ac34-ce3264128512';
  
  console.log(`🔍 Test query infortuni per Federico Viola (ID: ${federicoViolaId})...`);
  
  try {
    const { data, error } = await supabase
      .from('injuries')
      .select('*')
      .eq('person_id', federicoViolaId)
      .eq('current_status', 'In corso')
      .eq('is_closed', false);
    
    if (error) {
      console.error('❌ Errore query infortuni:', error);
    } else {
      console.log('✅ Risultato query infortuni:', data);
    }
  } catch (err) {
    console.error('❌ Errore durante query:', err);
  }
  
  // Test 3: Query generale per tutti gli infortuni attivi
  console.log('🔍 Test query tutti gli infortuni attivi...');
  
  try {
    const { data, error } = await supabase
      .from('injuries')
      .select('*')
      .eq('current_status', 'In corso')
      .eq('is_closed', false);
    
    if (error) {
      console.error('❌ Errore query generale:', error);
    } else {
      console.log('✅ Tutti gli infortuni attivi:', data);
    }
  } catch (err) {
    console.error('❌ Errore durante query generale:', err);
  }
}

// Esegui il test
testSupabaseConnection();



