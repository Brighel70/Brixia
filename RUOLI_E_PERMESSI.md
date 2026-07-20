# Accesso TeamFlow e FlowMe — regole semplici

Questo documento spiega **chi può vedere cosa**.  
Il codice tecnico condiviso è in `packages/shared/src/accessModel.ts` (identico in TeamFlow e FlowMe).

## Due porte, una persona

| | TeamFlow | FlowMe |
|---|----------|--------|
| A cosa serve | Gestionale (PC) | App telefono / tablet |
| Come si entra | Email + **Codice TeamFlow** | Email + **Codice FlowMe** |
| Chi sei nel database | Account Auth + `profiles` | Account Auth + `profiles.person_id` → `people` |
| Obbligatorio? | No | No |

Una persona può avere solo TeamFlow, solo FlowMe, oppure entrambi.  
È sempre **lo stesso record** in anagrafica (`people`).

Al primo accesso FlowMe viene creato (se manca) l’utente Auth con password = Codice FlowMe; se l’account esiste già (es. da TeamFlow) si prova anche il Codice TeamFlow.  
**Dopo l’aggiornamento Auth:** tutti devono rifare il login una volta (le vecchie sessioni solo-locali non bastano più).

## Matrice ruoli (lingua semplice)

| Ruolo | Cosa vede in pratica | Ambito |
|-------|----------------------|--------|
| **Admin** | Tutto | Intero club |
| **Dirigente** | Quasi tutto (meno gestione tecnica utenti) | Intero club |
| **Segreteria** | Persone, documenti, quote, tesseramenti | Intero club |
| **Direttore Sportivo** | Squadre, eventi, attività | Intero club |
| **Direttore Tecnico** | Gestione tecnica | Solo categorie assegnate |
| **Allenatore** | Allenamenti, presenze, giocatori | Solo le sue squadre |
| **Team Manager** | Liste, convocate, quote categoria | Solo categorie assegnate |
| **Accompagnatore** | Supporto / presenze | Solo categorie assegnate |
| **Preparatore** | Preparazione fisica | Solo categorie assegnate |
| **Medico** | Infermeria / stato fisico | Ambito sanitario |
| **Fisioterapista** | Fisioterapia / infortuni | Ambito sanitario |
| **Giocatore** | Solo i propri dati | Solo sé stesso |
| **Famiglia** | Figli collegati, pagamenti, documenti | Solo figli collegati |

In FlowMe le **sezioni visibili** (Staff, Giocatore, Genitori, …) sono quelle spuntate nella scheda persona; la tabella sopra indica il default sensato per ruolo.

## Esempi pratici

1. **Allenatore Under 14**  
   Entra in FlowMe → sezione Staff → vede solo Under 14.  
   Non deve vedere Serie B.

2. **Genitore**  
   Entra in FlowMe → sezione Famiglia → vede solo i figli collegati.  
   Non deve vedere altri giocatori.

3. **Segreteria**  
   Usa soprattutto TeamFlow (persone, quote, documenti) e/o FlowMe Segreteria/Finanziario.

4. **Admin assistenza**  
   Account dedicato (es. `andreabulgari@me.com`) per manutenzione su qualsiasi installazione.

## Cosa NON facciamo ancora

**Non attiviamo ancora le policy RLS strette** su tutte le tabelle: l’identità Auth di FlowMe c’è, ma le policy vanno progettate e testate con calma (`auth.uid()` → `profiles.person_id`).

Checklist (`accessModel.ts` → `RLS_READINESS`):

- [x] FlowMe con identità DB (Auth + `profiles.person_id`)
- [x] TeamFlow usa Supabase Auth
- [x] Categorie centralizzate
- [x] Pagamenti sul ledger
- [x] Admin assistenza documentato
- [x] RLS Fase 1 applicata (`005_rls_helpers_and_phase1.sql`: push, notifications, reminder)
- [ ] RLS Fase 2+ (events / injuries / people / fees) — non ancora

## Dove si configura oggi (operativo)

1. Scheda persona → tab **TeamFlow / Flowme**
2. Tab **Flowme**: ruolo app, codice FlowMe, sezioni
3. Tab **TeamFlow**: ruolo webapp, codice TeamFlow, sezioni/categorie

Permessi menu TeamFlow (tecnici): `src/config/permissions.ts`  
Contratto condiviso: `packages/shared/src/accessModel.ts`
