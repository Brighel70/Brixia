# Analisi critica: abbinamento Tutor ↔ Giocatore minorenne

## Stato attuale – dove si gestisce il collegamento

### 1. Dalla scheda del TUTOR (adulto con ruolo Tutor)

| Dove | Cosa si vede | Si può aggiungere/togliere minorenni? |
|------|----------------|--------------------------------------|
| **Tab "TeamFlow / Flowme"** (FlowmeTab) | Elenco minorenni + rapporto (Padre, Mamma, …) + link "Modifica giocatori abbinati" | **Sì** – unico posto dove si aggiungono/tolgono minorenni per questo tutor |
| **Tab "TeamFlow" (sotto-tab)** | Stesso identico blocco (Flowme e TeamFlow duplicato) | Sì (stessi dati) |
| **Tab "Tutor" (Staff)** | Card con nome minorenne, rapporto, pulsante "Vai al Giocatore" | **No** – messaggio: "Aggiungi dal tab TeamFlow/Flowme" |
| **Tab "Giocatore"** | Stesso elenco minorenni ma con dettagli (categorie, posizioni) + "Vai al Giocatore" | **No** |

### 2. Dalla scheda del GIOCATORE minorenne

| Dove | Cosa si vede | Si può aggiungere/togliere tutor? |
|------|----------------|-----------------------------------|
| **Tab "Tutor"** (TutorTab) | Elenco tutor con relazione, contatti, "Modifica" / "Elimina" | **Sì** – "Aggiungi Tutor" apre nuova scheda `?tutor=true&athleteId=...`; "Modifica" apre scheda tutor con ritorno al giocatore |

---

## Problemi individuati

### 1. Due tab che mostrano la stessa cosa (Tutor + Giocatore) sulla scheda tutor

Sulla scheda di un tutor compaiono **due tab** con lo stesso ruolo concettuale:

- **Tab "Tutor"**: card minorenni (nome, rapporto, "Vai al Giocatore").
- **Tab "Giocatore"**: stesso elenco con in più categorie/posizioni e di nuovo "Vai al Giocatore".

L’utente non capisce perché ci siano due tab per “i minorenni collegati a questo tutor”. È ridondante e poco chiaro.

### 2. Un solo posto per collegare i minorenni al tutor (e non è il tab Tutor)

Per dire “questo tutor segue questi minorenni” si deve andare in **TeamFlow / Flowme** e lì, solo se il ruolo è Tutor, usare “Modifica giocatori abbinati”.

- Il tab **Tutor** mostra i minorenni ma non permette di aggiungerli/toglierli e rimanda a TeamFlow/Flowme.
- L’abbinamento è quindi legato all’“accesso app” (Flowme/TeamFlow) invece che alla relazione tutor–minorenne.

Risultato: logica poco intuitiva (“per collegare un minorenne al tutor devo andare in TeamFlow/Flowme”).

### 3. Stessa gestione in due posti (Flowme e TeamFlow)

Nel tab **TeamFlow / Flowme** la sezione “Giocatori minorenni a cui è abbinato come tutor” è presente sia nel sotto-tab **Flowme** sia nel sotto-tab **TeamFlow**. Stessi dati, stessa azione “Modifica giocatori abbinati” in due posti. Duplicazione inutile e rischio di confusione.

### 4. Asimmetria tra “da giocatore” e “da tutor”

- **Da giocatore minorenne**: tab Tutor → “Aggiungi Tutor” → crei/colleghi il tutor in modo chiaro.
- **Da tutor**: per collegare i minorenni non c’è un “Aggiungi giocatore” nel tab Tutor, ma solo il rimando a TeamFlow/Flowme.

L’utente si aspetterebbe di poter fare “Aggiungi giocatore” (o “Abbina minorenne”) direttamente dal tab **Tutor** della scheda tutor, in modo simmetrico.

### 5. Doppio stato in form (tutor_athlete_ids + tutor_athlete_relations)

Il form mantiene sia `tutor_athlete_ids` sia `tutor_athlete_relations`. Vengono tenuti allineati in più punti. Meglio una sola fonte di verità (es. solo `tutor_athlete_relations`) e derivare gli id dove servono.

---

## Proposta di semplificazione

### Obiettivo

- **Un solo posto** per vedere e gestire “questo tutor segue questi minorenni”: il **tab Tutor** della scheda tutor.
- **Stessa logica** da entrambi i lati: da giocatore si gestiscono i tutor, da tutor si gestiscono i minorenni, senza passare da TeamFlow/Flowme per gli abbinamenti.
- **Un solo tab** sulla scheda tutor per “minorenni collegati” (niente tab “Giocatore” duplicato).

### Modifiche consigliate

1. **Tab Tutor (scheda tutor) = posto unico per minorenni**
   - Nel tab **Tutor** (Staff) della scheda di un tutor:
     - Mantenere le card (nome, rapporto, “Vai al Giocatore”).
     - Aggiungere qui il pulsante **“Modifica giocatori abbinati”** (o “Aggiungi / gestisci minorenni”) che apre il modal di selezione minorenni + rapporto (stessa logica oggi in FlowmeTab).
   - Così l’utente non deve più andare in TeamFlow/Flowme per collegare i minorenni al tutor.

2. **Rimuovere il tab “Giocatore” dalla scheda tutor**
   - Per un tutor adulto non mostrare più il tab “Giocatore”.
   - Tutto ciò che serve (elenco minorenni, rapporto, “Vai al Giocatore”) resta nel tab **Tutor**. Si evita la doppia tab e la confusione.

3. **TeamFlow/Flowme: solo avviso e link**
   - Quando il ruolo è Tutor, in FlowmeTab (Flowme e TeamFlow) non duplicare più la lista né il pulsante “Modifica giocatori abbinati”.
   - Mostrare un breve messaggio: *“I giocatori minorenni abbinati a questo tutor si gestiscono nel tab **Tutor** della scheda.”* con eventuale pulsante “Vai al tab Tutor” che imposta `activeTab = 'staff'` (tab Tutor).

4. **Form: una sola fonte per gli abbinamenti**
   - Usare solo `tutor_athlete_relations` nel form e derivare `tutor_athlete_ids` dove serve (salvataggio, API). Riduce errori di sincronizzazione.

5. **Navigazione (già ok)**
   - Da tutor → “Vai al Giocatore” → scheda minorenne con tab Giocatore.
   - Da minorenne → “Modifica” tutor → scheda tutor con `fromAthlete` e “Torna al giocatore”.
   - Nessun cambiamento necessario qui.

---

## Riepilogo flussi desiderati dopo la semplificazione

| Azione | Dove | Come |
|--------|------|------|
| Vedere i minorenni di un tutor | Scheda tutor → tab **Tutor** | Card con nome, rapporto, “Vai al Giocatore” |
| Aggiungere/togliere minorenni a un tutor | Scheda tutor → tab **Tutor** | Pulsante “Modifica giocatori abbinati” → modal selezione + rapporto |
| Vedere i tutor di un minorenne | Scheda minorenne → tab **Tutor** | Elenco tutor (TutorTab) |
| Aggiungere tutor a un minorenne | Scheda minorenne → tab **Tutor** | “Aggiungi Tutor” → nuova scheda `?tutor=true&athleteId=...` |
| Modificare un tutor partendo dal minorenne | Scheda minorenne → tab **Tutor** → Modifica | Apertura scheda tutor con “Torna al giocatore” |

In questo modo la logica di abbinamento e consultazione da tutor a giocatore e da giocatore a tutor diventa coerente e più semplice da usare e da mantenere.
