# Migrazioni database (Supabase)

## Convenzioni

- `database/migrations/` contiene gli script versionati da eseguire in ordine.
- Il nome deve rispettare `NNN_descrizione_breve.sql`.
- I file `*_test.sql` sono controlli post-apply e non applicano modifiche.
- Gli script di supporto fuori dalla sequenza non sono migration ufficiali.

## Ordine attuale

1. `001_people3_to_people_bridge.sql` fino a `009_correspondence_home_opened.sql`:
   anagrafiche, autenticazione FlowMe e Corrispondenza.
2. `010_accounting_foundation.sql` e `011_accounting_foundation_hardening.sql`:
   fondazione contabile e hardening iniziale.
3. `012_accounting_core.sql` fino a `017_accounting_budget_approval_stamp.sql`:
   Prima nota, sincronizzazione quote, campi documento e Preventivo.
4. `018_accounting_commercial_vat.sql` e relativi test:
   documenti commerciali e IVA indicativa.
5. `019_accounting_category_settings.sql` e relativi test:
   macro-categorie, catalogo iniziale e impostazioni.
6. `020_accounting_sponsorship_docs.sql` e `021_sponsorship_contract_reopen.sql`:
   documenti e contratti di sponsorizzazione.
7. `022_accounting_category_integrity.sql`:
   protezioni additive per QUOTE, categorie, Prima nota e Preventivo.
8. `023_access_control_role_management.sql`:
   gestione atomica dei permessi per ruolo e per utente tramite funzioni protette.
9. `024_operational_permission_catalog.sql`:
   catalogo unico dei permessi operativi; non attiva ancora RLS sulle tabelle applicative.
10. `025_block_incomplete_demo_access.sql`:
   blocca accessi FlowMe e TeamFlow configurati senza il rispettivo codice.
11. `026_role_permission_baseline.sql`:
   ricostruisce la base demo dei permessi, mantenendo gli alias di ruolo finche anche FlowMe e allineata.
12. `027_normalize_pure_role_aliases.sql`:
   unifica Player, Preparatore e Fisio nei rispettivi ruoli canonici; Tutor e Familiare restano distinti.
13. `028_normalize_pure_role_aliases_retry.sql`:
   correzione idempotente della 027 per SQL Editor che non conserva tabelle temporanee.
14. `029_secure_profiles_and_recoverable_auth.sql`:
   collega solo gli account Auth recuperabili e rende privata la tabella `profiles`.
15. `030_secure_people_access.sql`:
   rende private le anagrafiche con accesso personale, familiare o staff autorizzato.
16. `031_secure_fees_and_payments.sql`:
   rende private quote, assegnazioni e pagamenti secondo ruolo e collegamenti familiari.
17. `032_secure_operational_activities.sql`:
   rende private sessioni, presenze ed eventi in base a ruolo, categoria assegnata
   e relazioni familiari; il QR puo' registrare soltanto la propria presenza.
18. `033_secure_documents_and_health.sql`:
   rende privati documenti, infortuni, visite, allegati e impostazioni sanitarie
   secondo permessi, categoria e relazione con la persona interessata.
19. `034_secure_relationships_categories_and_storage.sql`:
   protegge categorie, relazioni familiari e i file privati nei bucket `docs`
   e `injury-docs`, senza modificare gli altri bucket o il logo pubblico.
20. `035_secure_reference_finance_and_consents.sql`:
   protegge configurazioni operative, ricevute, modelli e consensi; la lettura
   del brand resta pubblica intenzionalmente per la schermata di accesso.
21. `036_secure_match_notes_and_legacy_operations.sql`:
   protegge liste gara, statistiche, note, archivio giocatori, luoghi di
   allenamento, tutori e visite in base a categoria, persona e area sanitaria.
22. `037_close_remaining_anonymous_surfaces.sql`:
   elimina i permessi anonimi residui su Corrispondenza, notifiche, ruoli,
   memo e cataloghi; il brand resta l'unica lettura pubblica intenzionale.
23. `038_harden_internal_authorizations.sql`:
   corregge le autorizzazioni interne emerse dalla revisione incrociata:
   perimetro delle persone, upload documenti, notifiche e catalogo permessi.
24. `039_reconcile_legacy_memberships_and_internal_writes.sql`:
   allinea la RLS alle membership categoria legacy, preserva i file legacy e
   chiude le ultime scritture dirette su ruoli e notifiche senza destinatario.
25. `040_global_super_admin_and_duplicate_email_support.sql`:
   abilita il Super Admin globale sull'identita' Auth indicata, senza basarsi
   sulla sola email di una persona, e traccia le liste gara anche per questo
   account senza richiedere una scheda anagrafica.
26. `041_accounting_system_category_admin_controls.sql`:
   consente a Admin e Super Admin di gestire stato e configurazione delle
   categorie di sistema, preservando gli identificativi tecnici e le automazioni.
27. `042_accounting_full_functional_catalog.sql`:
   sostituisce il catalogo contabile ridotto con quello funzionale completo:
   11 macro-categorie di entrata, 17 di uscita e relative sottocategorie.
28. `043_accounting_catalog_clarity_and_deduplication.sql`:
   elimina le ambiguita' del catalogo senza perdere storico: distingue quote,
   corsi, merchandising, materiale tecnico, trasferte e alloggi; le voci
   equivalenti diventano storiche e non selezionabili per nuovi inserimenti.
29. `044_accounting_remove_duplicate_categories.sql`:
   unifica i quattro doppioni residui trasferendo prima eventuali riferimenti
   alla voce canonica e cancellando poi le righe duplicate, incluse le etichette
   storiche introdotte dalla migration 043.
30. `045_accounting_remove_duplicate_categories_retry.sql`:
   copia eseguibile della 044, predisposta per il SQL Editor dopo i tentativi
   non applicati della prima versione. Usare questa migration se la 044 non ha
   completato con successo.
31. `046_allow_events_docs_storage.sql`:
   consente upload/lettura dei verbali e allegati eventi sul path `docs/events/`
   a chi ha permessi eventi; ripristina il salvataggio verbale consiglio
   bloccato dalla RLS storage introdotta con 038/039.
32. `047_accounting_movement_lifecycle.sql`:
   completa il ciclo di vita della Prima nota con contabilizzazione, annullamento
   di bozze, storno tracciato, assegnazione del conto agli incassi automatici e
   giroconti tra Cassa e Banca attraverso funzioni protette dal database.
33. `048_accounting_bank_reconciliation.sql`:
   sessioni di riconciliazione banca/cassa, righe estratto, abbinamento/esclusione
   e riepilogo saldi (gestionale distinto da estratto). Import CSV formato TeamFlow.
34. `049_accounting_fiscal_year_lifecycle.sql`:
   RPC di apertura/chiusura/riapertura esercizio, checklist, snapshot consuntivo
   e prima nota, blocco write su esercizio chiuso.
35. `050_accounting_fiscal_profile_and_calendar.sql`:
   estende il profilo fiscale ASD e introduce scadenze operative gestionali
   (promemoria, senza invii SDI/F24).
36. `051_accounting_audit_view_and_approvals.sql`:
   vista audit leggibile e workflow opzionale verifica→contabilizza
   (default: flusso semplice).
37. `052_revoke_anon_accounting_rpc_grants.sql`:
   revoca EXECUTE Contabilità da anon/PUBLIC sulle RPC 048-051 e re-grant
   solo a authenticated/service_role.
38. `053_fix_fees_catalog_club_wide_access.sql`:
   ripristina la visibilita del catalogo Quote per Dirigente/Segreteria
   (club-wide), non solo per profili con people.is_staff.

Per nuove modifiche usare il prossimo numero successivo (`054_...`). Non
modificare migration gia' applicate: creare una migration correttiva nuova.

## Come eseguire

Da Supabase Dashboard: SQL Editor, incollare una sola migration alla volta e
verificare prima il relativo file `*_test.sql`. Fare sempre un backup prima di
modifiche di schema o catalogo contabile. La migration 022 non va applicata
automaticamente dal progetto.

Prima di introdurre RLS sulle tabelle operative, eseguire il controllo di sola
lettura `database/audits/access_control_readiness.sql` e verificare i risultati.
