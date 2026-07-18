# Componenti duplicati tra TeamFlow e FlowMe

Per mantenere le due app allineate, questi componenti vanno tenuti in sync quando si modificano.

## Elenco

| Componente | TeamFlow | FlowMe | Note |
|------------|----------|--------|------|
| **InjuryEditModal** | `src/components/InjuryEditModal.tsx` | `src/components/InjuryEditModal.tsx` | Modale modifica infortunio |
| **InjuryActivityModal** | (logica in Activities/CategoryActivities) | `src/components/InjuryActivityModal.tsx` | Modale attività infortunio |
| **MatchListModal** | `src/components/MatchListModal.tsx` | `src/components/MatchListModal.tsx` | Modale liste partita |
| **WeeklyCalendarView** | `src/components/WeeklyCalendarView.tsx` | `src/components/WeeklyCalendarView.tsx` | Vista calendario settimanale |

## Come tenere allineati

1. Se modifichi uno di questi in un’app, verifica se la stessa modifica serve nell’altra.
2. Per logica condivisa (date, validazioni, formattazione) considera di spostarla in `@brixia/shared`.
3. In futuro si può valutare un pacchetto `@brixia/shared-ui` (React + Supabase) per questi componenti.

## Codice già condiviso

- **overlapCheck** e **sessionScheduler** sono in `@brixia/shared` e usati da entrambe le app.
