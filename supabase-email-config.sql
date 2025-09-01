-- Configurazione Email Template per IL Brixia Rugby
-- Esegui questi comandi nel SQL Editor di Supabase

-- 1. Configurazione generale email
-- Nota: I template email devono essere configurati manualmente dal dashboard Supabase
-- Vai su Authentication → Email Templates

-- 2. Configurazione URL di redirect per le email
-- Vai su Authentication → Settings → URL Configuration

-- Site URL (sostituisci con il tuo dominio)
-- UPDATE auth.config SET site_url = 'https://tuodominio.com' WHERE id = 1;

-- Redirect URLs per le email di conferma
-- Aggiungi questi URL nella sezione "Redirect URLs":
-- https://tuodominio.com/auth/callback
-- https://tuodominio.com/auth/confirm
-- https://tuodominio.com/auth/reset-password

-- 3. Configurazione SMTP personalizzato (opzionale)
-- Se vuoi usare un provider email diverso da Supabase:

-- Esempio per SendGrid:
-- UPDATE auth.config SET 
--   smtp_admin_email = 'noreply@brixiarugby.com',
--   smtp_host = 'smtp.sendgrid.net',
--   smtp_port = 587,
--   smtp_user = 'apikey',
--   smtp_pass = 'YOUR_SENDGRID_API_KEY',
--   smtp_sender_name = 'IL Brixia Rugby'
-- WHERE id = 1;

-- Esempio per Mailgun:
-- UPDATE auth.config SET 
--   smtp_admin_email = 'noreply@brixiarugby.com',
--   smtp_host = 'smtp.mailgun.org',
--   smtp_port = 587,
--   smtp_user = 'postmaster@tuodominio.com',
--   smtp_pass = 'YOUR_MAILGUN_PASSWORD',
--   smtp_sender_name = 'IL Brixia Rugby'
-- WHERE id = 1;

-- 4. Configurazione scadenza token email
-- UPDATE auth.config SET 
--   jwt_exp = 3600, -- 1 ora per reset password
--   refresh_token_rotation_enabled = true
-- WHERE id = 1;

-- 5. Abilita conferma email obbligatoria
-- UPDATE auth.config SET 
--   enable_confirmations = true,
--   enable_signup = true,
--   enable_manual_linking = false
-- WHERE id = 1;

-- 6. Configurazione notifiche email
-- UPDATE auth.config SET 
--   mailer_autoconfirm = false,
--   mailer_secure_email_change_enabled = true,
--   mailer_otp_exp = 3600
-- WHERE id = 1;

-- 7. Personalizzazione mittente email
-- UPDATE auth.config SET 
--   mailer_defaults = jsonb_build_object(
--     'from_name', 'IL Brixia Rugby',
--     'from_email', 'noreply@brixiarugby.com',
--     'subject_prefix', '[Brixia Rugby] '
--   )
-- WHERE id = 1;

-- 8. Verifica configurazione corrente
SELECT 
  id,
  site_url,
  smtp_host,
  smtp_admin_email,
  mailer_defaults,
  enable_confirmations,
  enable_signup
FROM auth.config 
WHERE id = 1;

-- 9. Controlla le policy di sicurezza per le email
-- Assicurati che le policy RLS permettano l'accesso alle email di conferma
-- Questo è solitamente gestito automaticamente da Supabase

-- 10. Test configurazione email
-- Dopo aver configurato i template, crea un utente di prova per verificare
-- che le email arrivino con il design corretto

-- IMPORTANTE: 
-- - I template email devono essere configurati MANUALMENTE dal dashboard Supabase
-- - Le configurazioni SMTP richiedono credenziali valide del provider email
-- - Testa sempre le email con account di prova prima di andare in produzione
-- - Mantieni le variabili {{ .ConfirmationURL }} nei template HTML e testo


