-- Corregge il template Auguri Compleanno con emoji UTF-8 corrette
-- Esegui in Supabase SQL Editor (Dashboard → SQL Editor)
-- Placeholder: {NOME} = solo il nome (senza cognome)

UPDATE public.message_templates
SET content = '🏉🎉 Ehi {NOME}! Oggi si festeggia forte! 🎂🥳

Tantissimi auguri da tutta la famiglia Brixia Rugby! 💙
Che il tuo compleanno sia pieno di sorrisi, energia ed entusiasmo,
e ricco di mete nella tua vita! 💪🔥

Goditi la giornata come dopo una grande vittoria 💥

Un abbraccio enorme,
Brixia Rugby 🏉💙'
WHERE type = 'whatsapp' AND name ILIKE '%Auguri Compleanno%';
