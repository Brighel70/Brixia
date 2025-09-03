# Sistema di Ruoli e Permessi - Brixia Rugby

## Ruoli Disponibili

Il sistema supporta **12 ruoli** con diversi livelli di accesso:

### 1. **Admin** (Priorità: 1)
- **Accesso**: Completo a tutte le funzionalità
- **Permessi**: Tutti i permessi disponibili
- **Uso**: Amministratore di sistema

### 2. **Dirigente** (Priorità: 2)
- **Accesso**: Quasi completo, tranne gestione utenti
- **Permessi**: Tutto tranne creazione/modifica/eliminazione utenti e backup
- **Uso**: Dirigente del club

### 3. **Segreteria** (Priorità: 3)
- **Accesso**: Gestione amministrativa
- **Permessi**: Visualizzazione e gestione di giocatori, eventi, sessioni, report
- **Uso**: Personale di segreteria

### 4. **Direttore Sportivo** (Priorità: 4)
- **Accesso**: Gestione sportiva completa
- **Permessi**: Gestione giocatori, eventi, sessioni, categorie
- **Uso**: Responsabile dell'area sportiva

### 5. **Direttore Tecnico** (Priorità: 5)
- **Accesso**: Gestione tecnica
- **Permessi**: Gestione giocatori, eventi, sessioni (senza eliminazione)
- **Uso**: Responsabile tecnico

### 6. **Allenatore** (Priorità: 6)
- **Accesso**: Gestione allenamenti
- **Permessi**: Gestione sessioni, presenze, giocatori (solo modifica)
- **Uso**: Allenatori delle squadre

### 7. **Team Manager** (Priorità: 7)
- **Accesso**: Gestione squadra
- **Permessi**: Visualizzazione e gestione presenze
- **Uso**: Manager delle squadre

### 8. **Accompagnatore** (Priorità: 8)
- **Accesso**: Supporto
- **Permessi**: Visualizzazione e gestione presenze
- **Uso**: Accompagnatori delle squadre

### 9. **Player** (Priorità: 9)
- **Accesso**: Limitato ai propri dati e categoria
- **Permessi**: Visualizzazione dei propri dati, presenze, eventi e sessioni della sua categoria
- **Uso**: Giocatori che possono accedere ai propri dati tramite account personale
- **Collegamento**: Collegato al giocatore tramite codice FIR

### 10. **Preparatore** (Priorità: 10)
- **Accesso**: Preparazione fisica
- **Permessi**: Gestione attività fisiche e presenze
- **Uso**: Preparatori atletici

### 11. **Medico** (Priorità: 11)
- **Accesso**: Informazioni sanitarie
- **Permessi**: Visualizzazione e modifica dati sanitari giocatori
- **Uso**: Medico sportivo

### 12. **Fisio** (Priorità: 12)
- **Accesso**: Fisioterapia
- **Permessi**: Visualizzazione e modifica dati sanitari giocatori
- **Uso**: Fisioterapista

### 13. **Famiglia** (Priorità: 13)
- **Accesso**: Limitato
- **Permessi**: Solo visualizzazione di giocatori, eventi e sessioni
- **Uso**: Familiari dei giocatori

## Categorie di Permessi

### Players (Giocatori)
- `players.view` - Visualizza giocatori
- `players.create` - Crea giocatori
- `players.edit` - Modifica giocatori
- `players.delete` - Elimina giocatori
- `players.export` - Esporta dati giocatori

### Events (Eventi)
- `events.view` - Visualizza eventi
- `events.create` - Crea eventi
- `events.edit` - Modifica eventi
- `events.delete` - Elimina eventi

### Sessions (Sessioni)
- `sessions.view` - Visualizza sessioni
- `sessions.create` - Crea sessioni
- `sessions.edit` - Modifica sessioni
- `sessions.delete` - Elimina sessioni
- `sessions.start` - Avvia sessioni
- `sessions.stop` - Termina sessioni

### Attendance (Presenze)
- `attendance.view` - Visualizza presenze
- `attendance.mark` - Segna presenze
- `attendance.edit` - Modifica presenze
- `attendance.export` - Esporta presenze

### Staff (Personale)
- `staff.view` - Visualizza staff
- `staff.create` - Crea utenti staff
- `staff.edit` - Modifica utenti staff
- `staff.delete` - Elimina utenti staff

### Categories (Categorie)
- `categories.view` - Visualizza categorie
- `categories.create` - Crea categorie
- `categories.edit` - Modifica categorie
- `categories.delete` - Elimina categorie

### Settings (Impostazioni)
- `settings.view` - Visualizza impostazioni
- `settings.edit` - Modifica impostazioni
- `settings.brand` - Personalizza brand

### Users (Utenti)
- `users.view` - Visualizza utenti
- `users.create` - Crea utenti
- `users.edit` - Modifica utenti
- `users.delete` - Elimina utenti
- `users.roles` - Gestisce ruoli

## Ruolo Player - Funzionalità Speciali

### Creazione Utente Player
1. **Selezione Ruolo**: Scegliere "Player" dal dropdown ruoli
2. **Inserimento FIR Code**: Inserire il codice FIR del giocatore
3. **Ricerca Automatica**: Il nome del giocatore appare automaticamente
4. **Validazione**: Il giocatore deve esistere nella tabella `players`
5. **Collegamento**: L'utente viene collegato al giocatore tramite FIR code

### Permessi Player
- ✅ **Visualizza i propri dati personali**
- ✅ **Visualizza le proprie presenze**
- ✅ **Visualizza eventi/allenamenti della sua categoria**
- ✅ **Visualizza comunicazioni generali della sua categoria**
- ❌ **Non può vedere altri giocatori**
- ❌ **Non può modificare dati**
- ❌ **Non può gestire categorie**

### Database per Player
- **Tabella**: `profiles` con campo `fir_code`
- **Collegamento**: `profiles.fir_code` → `players.fir_code`
- **Categorie**: Automatiche basate sul giocatore collegato

## Implementazione

### Database
- **Tabella**: `user_roles` - Contiene i 12 ruoli
- **Tabella**: `permissions` - Contiene tutti i permessi
- **Tabella**: `role_permissions` - Collega ruoli e permessi
- **Tabella**: `profiles` - Contiene il ruolo dell'utente

### Frontend
- **File**: `src/config/permissions.ts` - Configurazione ruoli e permessi
- **File**: `src/components/PermissionGuard.tsx` - Componente per proteggere contenuti
- **File**: `src/hooks/usePermissions.ts` - Hook per gestire permessi
- **File**: `src/store/auth.ts` - Store per autenticazione

### Script SQL
- **File**: `update_user_roles_real.sql` - Script per aggiornare i ruoli nel database
- **File**: `add_player_fir_code.sql` - Script per aggiungere il campo FIR code alla tabella profiles

## Utilizzo

### Proteggere una pagina
```tsx
<PermissionGuard requiredRole="Admin">
  <AdminPanel />
</PermissionGuard>
```

### Proteggere con permesso specifico
```tsx
<PermissionGuard requiredPermission={PERMISSIONS.PLAYERS.CREATE}>
  <CreatePlayerForm />
</PermissionGuard>
```

### Componenti di convenienza
```tsx
<AdminOnly>
  <AdminContent />
</AdminOnly>

<AllenatoreOnly>
  <CoachContent />
</AllenatoreOnly>

<PlayerOnly>
  <PlayerContent />
</PlayerOnly>
```

## Stato Attuale

⚠️ **IMPORTANTE**: Il sistema di permessi è **DISABILITATO** temporaneamente nel frontend per permettere la navigazione durante lo sviluppo. 

Per riattivare i controlli di accesso, decommentare il codice nel file `src/hooks/usePermissions.ts` e rimuovere i `return true` temporanei.
