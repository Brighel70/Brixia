# Audit di allineamento TeamFlow e FlowMe

Data audit: 18 luglio 2026.

## Obiettivo

TeamFlow e FlowMe sono due applicazioni differenti dello stesso club. Non devono
avere gli stessi utenti o gli stessi permessi, ma devono condividere in modo
coerente persone, categorie e dati operativi.

## Risultati confermati

- Entrambe puntano allo stesso progetto Supabase.
- Il pacchetto `@brixia/shared` e' identico nelle due applicazioni.
- Entrambe usano `people` come anagrafica operativa principale.
- I flussi condivisi usano le stesse tabelle: `categories`, `sessions`,
  `attendance`, `events`, `match_lists`, `match_statistics`, `injuries`,
  `injury_activities`, `fees` e `fee_assignments`.
- TeamFlow aggiorna le categorie nei campi `people.player_categories` e
  `people.staff_categories`, che sono gli stessi letti da FlowMe.
- La build di TeamFlow e la build di produzione di FlowMe completano con successo.

## Modello da mantenere

Una persona ha un solo record in `people`, con due accessi distinti e opzionali:

1. TeamFlow: accesso gestionale tramite Supabase Auth e record `profiles`.
2. FlowMe: accesso mobile regolato da `invite_code`, `flowme_access_blocked` e
   `flowme_sections` sul record `people`.

Questa separazione e' corretta. Avere FlowMe non implica avere TeamFlow e
viceversa.

## Problemi da risolvere prima dell'RLS

### 1. FlowMe non ha un'identita' Supabase verificabile dal database

FlowMe crea una sessione locale (`flowme_session`) dopo il controllo di email e
codice. Il client Supabase resta anonimo. Le policy RLS basate su `auth.uid()`
non possono quindi distinguere con affidabilita' la persona mobile collegata.

Conseguenza: prima di rendere restrittive le policy, FlowMe deve ricevere una
identita' verificabile dal database, ad esempio tramite Supabase Auth o un token
breve emesso da una funzione server dopo la verifica del codice.

### 2. I tipi locali di FlowMe non rappresentano piu' lo schema effettivo

`npm run type-check` in FlowMe fallisce. La causa principale e' il file
`src/types/database.ts`, incompleto e con una definizione duplicata di
`training_locations`. Tabelle e colonne usate nel codice vengono inferite come
`never`.

Conseguenza: una modifica a campi condivisi puo' compilare in produzione ma non
essere controllata in sviluppo. I tipi vanno rigenerati dal database reale e
tenuti aggiornati.

### 3. Ruoli separati ma nomenclatura sovrapposta

I campi FlowMe (`app_role`, `additional_roles`, `flowme_sections`) e quelli
TeamFlow (`teamflow_app_role`, `teamflow_additional_roles`, `profiles.role`) sono
concettualmente distinti ma usano tabelle e nomi simili. La distinzione deve
essere esplicitata nel modello dati e nei componenti:

- ruoli TeamFlow: autorizzazioni gestionali;
- accesso FlowMe: sezioni e limiti mobili;
- categorie: appartenenza sportiva, indipendente dagli accessi.

### 4. Dati sensibili e log di debug nella login FlowMe

Il client mobile effettua controlli diretti su email e codici di invito e contiene
log di debug relativi al login. Questa logica dovra' passare a un endpoint server
quando verranno introdotti permessi effettivi, cosi' il client non puo' leggere o
enumerare dati di altre persone.

## Ordine di lavoro proposto

1. Rigenerare e condividere i tipi del database per TeamFlow e FlowMe.
2. Formalizzare il modello di accesso: persona, accesso TeamFlow, accesso FlowMe,
   sezioni FlowMe e categorie.
3. Sostituire il controllo mobile basato solo su sessione locale con una sessione
   verificabile lato database.
4. Applicare le policy RLS per area e per tipo di accesso.
5. Eseguire test incrociati TeamFlow -> FlowMe e FlowMe -> TeamFlow su persone,
   presenze, eventi, risultati, infortuni e quote.

## Nota

I documenti storici di FlowMe che descrivono un accesso basato su `profiles`
non riflettono integralmente il codice attuale, che usa `people` e
`flowme_session`. Il codice corrente e questo audit sono la fonte da seguire per
il prossimo consolidamento.
