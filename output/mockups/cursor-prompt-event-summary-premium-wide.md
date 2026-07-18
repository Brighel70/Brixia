# Prompt per Cursor - Nuovo Sunto Evento Premium Wide

Devi ricreare il modal/sunto evento del gestionale TeamFlow usando:

1. L'immagine/mockup che ti allego in chat.
2. Il file JSON del mockup: `output/mockups/event-summary-premium-wide.spec.json`.
3. Il codice reale del progetto, soprattutto `src/pages/Events.tsx`.

## Obiettivo

Sostituisci graficamente il modal dettagli evento attuale, quello renderizzato in `src/pages/Events.tsx` quando `showEventModal && selectedEvent`, con una nuova vista premium larga come nel mockup.

Questa vista serve soprattutto per eventi di tipo `torneo` e `festa_del_rugby`, dove ci sono molte squadre e molti gironi.

## Scope consentito

Modifica solo la UI del modal dettagli evento in `src/pages/Events.tsx`.

Mantieni la logica esistente:

- apertura/chiusura modal;
- dati `selectedEvent`;
- helper esistenti tipo `getEventParticipants`, `isMultiTeamEventType`, `formatDate`;
- funzioni PDF esistenti, inclusa `generateEventPresentationPdf`;
- modifica evento;
- eliminazione evento;
- gestione PDF verbali per consigli, se presente;
- dark mode se gia usata nella pagina.

Non modificare:

- database;
- Supabase;
- schema dati;
- salvataggi;
- creazione eventi;
- generatore PDF;
- logica drag and drop dei gironi nel form;
- altre pagine.

## Layout richiesto

Il modal deve essere molto piu largo dell'attuale:

- larghezza indicativa: `min(1380px, calc(100vw - 48px))`;
- altezza indicativa: `min(820px, calc(100vh - 48px))`;
- bordo arrotondato premium;
- sfondo generale chiaro;
- header superiore blu navy.

Struttura:

1. Header evento in alto.
2. Corpo centrale diviso in due colonne:
   - colonna sinistra navigazione/ricerca;
   - colonna destra contenuto principale.
3. Footer azioni con i pulsanti `PDF`, `Modifica`, `Elimina`, `Chiudi`.

Non creare il pannello dettaglio a destra: nel mockup finale e stato eliminato.

## Header alto

L'header deve essere compatto, piu basso rispetto al primo mockup.

A sinistra:

- badge evento, esempio `FESTA DEL RUGBY`;
- titolo evento grande, da `selectedEvent.title`, esempio `Due Laghi`.

Non mostrare sotto al titolo frasi descrittive tipo:

- `Sunto evento premium, largo e pensato per 32 squadre`.

Non mettere il logo in alto a sinistra.

A destra mostra 4 card/tile:

1. `DATA`
   - valore: data formattata, esempio `Dom 5 luglio`;
   - sotto: orario, esempio `10:00 - 13:00`.

2. `LUOGO`
   - valore: luogo reale evento, esempio `Brescia`;
   - sotto: `Casa` o `Trasferta`.

3. `FORMATO`
   - valore: `[numero squadre] Squadre`, esempio `32 Squadre`;
   - sotto: `[squadre per girone] /Teams per [numero gironi] gironi`, esempio `4 /Teams per 8 gironi`.

4. Logo societa
   - usa `brandConfig.assets.logo?.trim() || '/brixia-logo.svg'`;
   - questa tile occupa lo spazio dove prima ci sarebbe stata una quarta card.

## Colonna sinistra

Titolo: `NAVIGAZIONE`.

Tre tab/card:

1. `Panoramica` con label destra `evento`;
2. `Gironi` con label destra numero gironi;
3. `Squadre` con label destra numero squadre.

La tab attiva deve essere navy scura.

Sotto:

- sezione `RICERCA RAPIDA`;
- input placeholder `Cerca squadra o girone...`;
- sezione `SQUADRE TROVATE`.

Comportamento ricerca:

- se il campo e vuoto, non mostrare nessuna societa trovata;
- mostra solo una frase neutra: `Digita per cercare una societa o un girone.`;
- quando si digita, filtra per nome squadra e nome girone;
- cliccando una squadra trovata, passa alla vista `Gironi` e porta/seleiziona il relativo girone.

## Vista Panoramica

Quando la tab attiva e `Panoramica`, il titolo dell'header secondario deve essere:

`[selectedEvent.title] in sintesi`

Esempio:

`Due Laghi in sintesi`

Non usare `Composizione gironi` in questa vista.

Non mostrare:

- card blu interna `Due Laghi in sintesi`;
- card `Uso dei pulsanti`;
- metriche interne `Data`, `Orario`, `Squadre`, `Gironi`;
- frase `Questa vista serve per capire l'evento...`.

Mostra invece:

1. Card timeline senza titolo `Programma rapido`.

Timeline:

- `09:30` - `Accoglienza squadre e briefing staff`;
- orario inizio evento reale - `Inizio attivita in campo`;
- orario fine evento reale - `Fine attivita`.

2. Card `Anteprima gironi`.

Dentro mostra una griglia compatta dei gironi:

- nome girone;
- numero squadre;
- bordo/accent colorato per ogni girone.

Cliccando un girone dalla preview si passa alla vista `Gironi`.

## Vista Gironi

Quando la tab attiva e `Gironi`, mostra tutte le card dei gironi.

Ogni card girone deve:

- avere bordo colorato con il colore del girone;
- avere header navy compatto;
- NON avere il cerchio grande con numero `01`, `02`, ecc.;
- mostrare nell'header:
  - a sinistra: nome girone, esempio `Girone 1`;
  - a destra: numero squadre, esempio `4 squadre`;
- avere una riga colorata subito appoggiata sotto la base dell'header;
- la riga colorata deve avere lo stesso colore del bordo della card;
- mostrare tutte le squadre dentro il girone, senza tagliarne nessuna.

Le squadre dentro la card devono essere righe chiare arrotondate con:

- pallino colorato;
- nome squadra in grassetto.

## Vista Squadre

Quando la tab attiva e `Squadre`, mostra una griglia di tutte le societa/squadre.

Ogni card squadra deve mostrare:

- nome squadra;
- pill con nome del girone e colore accent del girone.

Cliccando una squadra:

- passa alla vista `Gironi`;
- seleziona/evidenzia il girone corrispondente.

## Header secondario

L'header secondario della sezione principale, quello con titolo e chip conteggio, deve essere basso/compatto circa il 25% in meno rispetto alla prima versione.

Esempio in Panoramica:

- titolo: `Due Laghi in sintesi`;
- chip a destra: `32 squadre`.

Non mostrare sotto il titolo frasi descrittive tipo:

- `Card larghe, leggibili e cliccabili. Ogni girone apre il dettaglio a destra.`

## Footer azioni

Mantieni i 4 pulsanti in basso:

- `PDF`;
- `Modifica`;
- `Elimina`;
- `Chiudi`.

Devono usare gli handler esistenti:

- `generateEventPresentationPdf(...)`;
- `handleEditEvent(selectedEvent)`;
- `handleDeleteEvent(selectedEvent.id)`;
- `handleCloseEventModal()`.

Non rompere il comportamento attuale.

## Dati dinamici

Calcola dinamicamente:

- numero squadre da `selectedEvent.opponents` o dalla funzione esistente usata oggi;
- numero gironi da `selectedEvent.gironi.length`;
- squadre per girone, preferibilmente dal primo girone o media semplice;
- nomi squadre da `selectedEvent.gironi[].teams`;
- luogo da `selectedEvent.location` / `selectedEvent.away_location`;
- casa/trasferta da `selectedEvent.is_home`;
- orari da `selectedEvent.start_time`, `selectedEvent.end_time`, `selectedEvent.event_time`.

## Responsive

Su desktop deve sfruttare tutta la larghezza.

Su schermi piu stretti:

- le colonne possono impilarsi;
- le card girone possono scendere a 2 colonne o 1 colonna;
- nessun testo deve sovrapporsi;
- nessuna squadra deve essere tagliata dentro il proprio girone.

## Qualita finale

Prima di finire:

1. Controlla che TypeScript non segnali errori nel file modificato.
2. Controlla che il modal si apra.
3. Controlla le tre viste:
   - Panoramica;
   - Gironi;
   - Squadre.
4. Controlla la ricerca:
   - campo vuoto: nessuna societa trovata;
   - campo compilato: mostra risultati.
5. Controlla i pulsanti finali.

Il risultato deve essere fedele all'immagine allegata e al JSON `output/mockups/event-summary-premium-wide.spec.json`.
