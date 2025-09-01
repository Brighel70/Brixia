-- Aggiungi campo password alla tabella profiles
ALTER TABLE public.profiles 
ADD COLUMN password text;

-- Aggiungi campo email alla tabella profiles
ALTER TABLE public.profiles 
ADD COLUMN email text;

-- Aggiorna la password per Andrea Bulgari
UPDATE public.profiles 
SET password = 'password123', email = 'andrea.bulgari@ymail.com'
WHERE full_name = 'Andrea Bulgari';
