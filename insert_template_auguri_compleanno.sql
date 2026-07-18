-- Inserisce il template "Auguri Compleanno" per messaggi di compleanno
-- Esegui questo script in Supabase SQL Editor (Dashboard → SQL Editor)
-- Placeholder: {NOME} viene sostituito con il nome della persona al momento dell'invio

INSERT INTO public.message_templates (type, name, content, subject)
SELECT 'whatsapp', 'Auguri Compleanno',
  E'🏉🎉 Ehi {NOME}! Oggi si festeggia forte! 🎂🥳\n\nTantissimi auguri da tutta la famiglia Brixia Rugby! 💙\nChe il tuo compleanno sia pieno di sorrisi, energia ed entusiasmo,\ne ricco di mete nella tua vita! 💪🔥\n\nGoditi la giornata come dopo una grande vittoria 💥\n\nUn abbraccio enorme,\nBrixia Rugby 🏉💙',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE name = 'Auguri Compleanno' AND type = 'whatsapp');
