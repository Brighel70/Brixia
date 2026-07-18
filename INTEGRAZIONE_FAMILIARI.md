# Guida Integrazione Sistema Familiari

## 📋 Componenti Creati

Ho creato i seguenti file per gestire i familiari e i loro collegamenti con i giocatori:

### 1. **Database**
- `create_player_guardian_relationships.sql` - Tabella per le relazioni giocatore-familiare

### 2. **Componenti React**
- `src/components/PlayerSelectionModal.tsx` - Popup per selezionare i giocatori (STEP 1)
- `src/components/RelationshipAssignmentModal.tsx` - Popup per assegnare le parentele (STEP 2)
- `src/components/GuardiansTab.tsx` - Tab "Famigliare" con tabella collegamenti

---

## 🛠️ STEP 1: Creare la Tabella nel Database

Esegui il file SQL in Supabase:

```bash
# Apri Supabase Dashboard → SQL Editor → Incolla il contenuto di:
create_player_guardian_relationships.sql
```

---

## 🛠️ STEP 2: Integrare GuardiansTab in CreatePersonView

### A. Import dei componenti

Aggiungi questi import all'inizio di `src/pages/CreatePersonView.tsx`:

```typescript
import PlayerSelectionModal from '../components/PlayerSelectionModal'
import RelationshipAssignmentModal from '../components/RelationshipAssignmentModal'
import GuardiansTab from '../components/GuardiansTab'
```

### B. Aggiungi stati per i modals

Cerca la sezione dove sono dichiarati gli stati (circa riga 140-200) e aggiungi:

```typescript
// Stati per gestire i modal dei familiari
const [showPlayerSelectionModal, setShowPlayerSelectionModal] = useState(false)
const [showRelationshipModal, setShowRelationshipModal] = useState(false)
const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
const [guardianPersonId, setGuardianPersonId] = useState<string | null>(null)
```

### C. Aggiungi funzioni handler

Cerca la sezione delle funzioni (circa riga 1500-1800) e aggiungi:

```typescript
// Gestione apertura automatica popup quando si seleziona "familiare"
const handleRoleChange = (field: string, value: any) => {
  // Chiama la funzione originale di handleInputChange
  originalHandleInputChange(field, value)
  
  // Se il ruolo principale è "familiare", apri il popup
  if (field === 'app_role' && value === 'familiare' && !isEditing) {
    setShowPlayerSelectionModal(true)
  }
  
  // Se deseleziona "familiare", chiudi i popup se aperti
  if (field === 'app_role' && value !== 'familiare') {
    setShowPlayerSelectionModal(false)
    setShowRelationshipModal(false)
    setSelectedPlayerIds([])
  }
}

// Conferma selezione giocatori → apre popup parentele
const handlePlayerSelectionConfirm = (playerIds: string[]) => {
  setSelectedPlayerIds(playerIds)
  setShowPlayerSelectionModal(false)
  setShowRelationshipModal(true)
}

// Chiusura popup selezione → rimuovi ruolo familiare
const handlePlayerSelectionClose = () => {
  setShowPlayerSelectionModal(false)
  setSelectedPlayerIds([])
  // Rimuovi il ruolo "familiare"
  originalHandleInputChange('app_role', '')
}

// Conferma assegnazione parentele → salva relazioni
const handleRelationshipAssignmentConfirm = async (assignments: any[]) => {
  try {
    // Se stiamo creando una nuova persona, salva prima la persona
    if (!isEditing && !guardianPersonId) {
      // Salva la persona e ottieni l'ID
      await handleSave()
      // L'ID verrà salvato in form.id dopo il salvataggio
      // Poi salviamo le relazioni
    }
    
    const personId = isEditing ? currentEditId : form.id
    
    if (personId) {
      // Inserisci le relazioni nel database
      const relationshipsToInsert = assignments.map(assignment => ({
        player_person_id: assignment.playerId,
        guardian_person_id: personId,
        relationship_type: assignment.relationshipType
      }))

      const { error } = await supabase
        .from('player_guardian_relationships')
        .insert(relationshipsToInsert)

      if (error) throw error
      
      console.log('✅ Relazioni salvate con successo')
    }
    
    setShowRelationshipModal(false)
    setSelectedPlayerIds([])
  } catch (error) {
    console.error('❌ Errore nel salvataggio delle relazioni:', error)
    alert('Errore nel salvataggio delle relazioni')
  }
}

// Chiusura popup parentele
const handleRelationshipAssignmentClose = () => {
  setShowRelationshipModal(false)
  setSelectedPlayerIds([])
}
```

### D. Modifica handleInputChange per usare handleRoleChange

Cerca dove viene chiamato `handleInputChange` nel JSX per il campo `app_role` e sostituisci con:

```typescript
// Prima:
onChange={(e) => handleInputChange('app_role', e.target.value)}

// Dopo:
onChange={(e) => handleRoleChange('app_role', e.target.value)}
```

### E. Aggiungi il tab "Famigliare"

Cerca l'array `tabs` (circa riga 2540) e aggiungi:

```typescript
const tabs = [
  { id: 'personal', name: 'Dati Personali', icon: '👤' },
  // ... altri tab esistenti ...
  
  // Aggiungi questo NUOVO tab
  { 
    id: 'guardian', 
    name: 'Famigliare', 
    icon: '👨‍👩‍👧‍👦',
    hidden: !form.staff_roles?.includes('familiare')
  },
  
  // ... resto dei tab ...
]
```

### F. Renderizza il tab Guardian

Cerca la sezione dove vengono renderizzati i vari tab (circa riga 4100-4300) e aggiungi:

```typescript
{activeTab === 'guardian' && (
  <GuardiansTab
    guardianId={currentEditId || form.id || ''}
    isEditing={isEditMode}
  />
)}
```

### G. Aggiungi i modals alla fine del JSX

Cerca la fine del return del componente (circa riga 4350) e aggiungi PRIMA della chiusura finale:

```typescript
      {/* Modal per selezione giocatori */}
      <PlayerSelectionModal
        isOpen={showPlayerSelectionModal}
        onClose={handlePlayerSelectionClose}
        onConfirm={handlePlayerSelectionConfirm}
        excludePlayerIds={[]}
      />

      {/* Modal per assegnazione parentele */}
      <RelationshipAssignmentModal
        isOpen={showRelationshipModal}
        onClose={handleRelationshipAssignmentClose}
        onConfirm={handleRelationshipAssignmentConfirm}
        selectedPlayerIds={selectedPlayerIds}
      />
    </div> {/* Chiusura finale esistente */}
  )
}
```

---

## 🛠️ STEP 3: Test del Sistema

### Test 1: Creazione Familiare
1. Vai su "Crea Nuova Persona"
2. Seleziona ruolo "familiare" dal dropdown
3. Deve aprirsi automaticamente il popup con la lista giocatori
4. Seleziona uno o più giocatori
5. Clicca "Conferma"
6. Deve aprirsi il popup per assegnare le parentele
7. Assegna una parentela per ogni giocatore
8. Clicca "Conferma"
9. La persona familiare viene creata con le relazioni salvate

### Test 2: Tab Famigliare
1. Fai login come familiare (o vai nella pagina di modifica di un familiare)
2. Vai nel tab "Famigliare"
3. Dovresti vedere la tabella con i giocatori collegati
4. Clicca "Nuovo collegamento" per aggiungere altri giocatori
5. Clicca "X" per rimuovere un collegamento (con conferma)

### Test 3: Validazioni
1. Prova a chiudere il popup selezione senza selezionare giocatori → il ruolo "familiare" deve essere rimosso
2. Prova a confermare le parentele senza assegnare una parentela → deve mostrare errore
3. Nel tab Famigliare, i giocatori già collegati non devono apparire nel popup "Nuovo collegamento"

---

## ⚠️ Note Importanti

1. **Tabella Database**: La tabella `player_guardian_relationships` usa `people` come riferimento (migrazione completata; people3 è deprecata)
2. **UUID Categorie**: Il mapping delle categorie è hardcoded. Se aggiungi nuove categorie, aggiorna il `categoryMapping` in tutti e 3 i componenti
3. **Permessi**: Assicurati che le RLS (Row Level Security) policies in Supabase permettano:
   - Inserimento in `player_guardian_relationships`
   - Lettura in `player_guardian_relationships` per i familiari
   - Cancellazione in `player_guardian_relationships` per i familiari

---

## 🐛 Troubleshooting

### Errore: "Failed to resolve import @/lib/supabase"
- Verifica che il path alias `@` sia configurato in `vite.config.ts`
- Verifica che il file `src/lib/supabaseClient.ts` esista
- **NOTA**: I componenti usano già il path corretto `'../lib/supabaseClient'`

### I popup non si aprono
- Controlla la console del browser per errori
- Verifica che gli stati `showPlayerSelectionModal` e `showRelationshipModal` siano stati aggiunti
- Verifica che la funzione `handleRoleChange` sia stata implementata correttamente

### Le relazioni non vengono salvate
- Controlla che la tabella `player_guardian_relationships` sia stata creata
- Verifica i log della console per errori Supabase
- Controlla le RLS policies in Supabase

### Il tab "Famigliare" non appare
- Verifica che `form.staff_roles` contenga 'familiare'
- Controlla che il tab sia stato aggiunto correttamente all'array `tabs`
- Verifica la condizione `hidden` nel tab

---

## 📝 Prossimi Passi

- [ ] Eseguire `create_player_guardian_relationships.sql` in Supabase
- [ ] Integrare i componenti in `CreatePersonView.tsx` seguendo gli step sopra
- [ ] Testare il flusso completo
- [ ] Configurare le RLS policies in Supabase se necessario
- [ ] Aggiornare il mapping delle categorie se necessario

---

**Nota**: Questa integrazione NON richiede modifiche a `usePersonForm.ts` per mantenere la stabilità del sistema esistente.

