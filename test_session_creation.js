// =====================================================
// TEST SISTEMA CREAZIONE SESSIONI AUTOMATICHE
// =====================================================

console.log('🧪 TEST SISTEMA CREAZIONE SESSIONI AUTOMATICHE')
console.log('=====================================================')

// Test 1: Verifica configurazione U18
console.log('\n📋 STEP 1: Verifica configurazione U18')
console.log('Esegui in Supabase SQL Editor:')
console.log(`
SELECT 
  weekday,
  location,
  start_time,
  end_time
FROM training_locations tl
JOIN categories c ON tl.category_id = c.id
WHERE c.code = 'U18'
ORDER BY 
  CASE weekday 
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7
  END;
`)

// Test 2: Cancella sessioni U18 esistenti
console.log('\n🗑️ STEP 2: Cancella sessioni U18 esistenti')
console.log('Esegui in Supabase SQL Editor:')
console.log(`
-- Cancella presenze prima
DELETE FROM attendance 
WHERE session_id IN (
  SELECT s.id 
  FROM sessions s 
  JOIN categories c ON s.category_id = c.id 
  WHERE c.code = 'U18'
);

-- Cancella sessioni U18
DELETE FROM sessions 
WHERE category_id IN (
  SELECT id FROM categories WHERE code = 'U18'
);

-- Verifica
SELECT COUNT(*) as sessioni_u18_rimanenti 
FROM sessions s 
JOIN categories c ON s.category_id = c.id 
WHERE c.code = 'U18';
`)

// Test 3: Test creazione sessioni
console.log('\n🚀 STEP 3: Test creazione sessioni')
console.log('Apri Console Browser (F12) e incolla:')
console.log(`
// Test creazione singola sessione
const { createAutomaticSession } = await import('./src/lib/sessionScheduler.ts')

// Trova U18
const { data: u18 } = await supabase
  .from('categories')
  .select('id, code, name')
  .eq('code', 'U18')
  .single()

console.log('🚀 Test creazione U18...')

// Crea 1 sessione
const session = await createAutomaticSession(u18.id)

if (session) {
  const date = new Date(session.session_date)
  const dayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][date.getDay()]
  console.log('✅ Sessione creata:', dayName, session.session_date, session.location)
} else {
  console.log('❌ Errore nella creazione')
}
`)

// Test 4: Test creazione multiple sessioni
console.log('\n📅 STEP 4: Test creazione multiple sessioni')
console.log('Apri Console Browser (F12) e incolla:')
console.log(`
// Test creazione 3 sessioni (1 settimana)
const { createMultipleAutomaticSessions } = await import('./src/lib/sessionScheduler.ts')

const sessions = await createMultipleAutomaticSessions(u18.id, 3)

console.log('✅ Sessioni create:', sessions.length)

sessions.forEach((s, i) => {
  const date = new Date(s.session_date)
  const dayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][date.getDay()]
  console.log(\`\${i+1}. \${dayName} \${s.session_date} (\${s.location})\`)
})
`)

// Test 5: Verifica risultato
console.log('\n✅ STEP 5: Verifica risultato')
console.log('Dovresti vedere:')
console.log('1. Martedì 2025-10-21 (Brescia)')
console.log('2. Giovedì 2025-10-23 (Ospitaletto)')
console.log('3. Venerdì 2025-10-24 (Ospitaletto)')
console.log('')
console.log('Solo Martedì, Giovedì, Venerdì! ✅')
console.log('NON Lunedì o Mercoledì! ❌')

console.log('\n🎯 RISULTATO ATTESO:')
console.log('- Solo giorni configurati (Mar/Gio/Ven)')
console.log('- Date nel futuro')
console.log('- Location corrette')
console.log('- Ciclo corretto')

console.log('\n🚀 PRONTO PER IL TEST!')



