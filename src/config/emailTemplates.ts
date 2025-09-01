// Template email personalizzati per IL Brixia Rugby
// Questi template devono essere configurati nel dashboard Supabase

export const EMAIL_TEMPLATES = {
  // Template per conferma registrazione
  CONFIRM_SIGNUP: {
    subject: 'Benvenuto in IL Brixia Rugby - Conferma la tua email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B1B3B; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🏉 IL Brixia Rugby</h1>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #0B1B3B; margin-top: 0;">Benvenuto nel nostro team!</h2>
          
          <p style="font-size: 16px; line-height: 1.6;">Ciao,</p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Grazie per esserti registrato come membro dello staff di <strong>IL Brixia Rugby</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Per completare la registrazione e accedere al sistema di gestione presenze, clicca sul pulsante qui sotto:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: #2A60A6; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                      display: inline-block;">
              ✅ Conferma Email
            </a>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6;"><strong>Questo link è sicuro e ti permetterà di:</strong></p>
          <ul style="font-size: 16px; line-height: 1.6;">
            <li>Accedere al sistema di gestione presenze</li>
            <li>Visualizzare le tue categorie assegnate</li>
            <li>Registrare presenze durante gli allenamenti</li>
            <li>Gestire le sessioni di rugby</li>
          </ul>
          
          <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1976d2;">
              <strong>🔒 Sicurezza:</strong> Questo link è generato automaticamente da Supabase e contiene un token di sicurezza univoco.
            </p>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            Se non hai richiesto tu questa registrazione, ignora questa email.
          </p>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            Cordiali saluti,<br>
            <strong>Team IL Brixia Rugby</strong>
          </p>
        </div>
      </div>
    `,
    text: `
      Benvenuto in IL Brixia Rugby!

      Ciao,

      Grazie per esserti registrato come membro dello staff di IL Brixia Rugby.

      Per completare la registrazione e accedere al sistema di gestione presenze, 
      copia e incolla questo link nel tuo browser:

      {{ .ConfirmationURL }}

      Questo link è sicuro e ti permetterà di:
      - Accedere al sistema di gestione presenze
      - Visualizzare le tue categorie assegnate  
      - Registrare presenze durante gli allenamenti
      - Gestire le sessioni di rugby

      SICUREZZA: Questo link è generato automaticamente da Supabase e contiene un token di sicurezza univoco.

      Se non hai richiesto tu questa registrazione, ignora questa email.

      Cordiali saluti,
      Team IL Brixia Rugby
    `
  },

  // Template per reset password
  RESET_PASSWORD: {
    subject: 'IL Brixia Rugby - Reset Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B1B3B; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🏉 IL Brixia Rugby</h1>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #0B1B3B; margin-top: 0;">Reset Password Richiesto</h2>
          
          <p style="font-size: 16px; line-height: 1.6;">Ciao,</p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Hai richiesto il reset della password per il tuo account in <strong>IL Brixia Rugby</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Clicca sul pulsante qui sotto per impostare una nuova password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: #2A60A6; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                      display: inline-block;">
              🔑 Imposta Nuova Password
            </a>
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              <strong>⏰ Scadenza:</strong> Questo link scade tra 1 ora per motivi di sicurezza.
            </p>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            Se non hai richiesto tu questo reset, ignora questa email e la tua password rimarrà invariata.
          </p>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            Cordiali saluti,<br>
            <strong>Team IL Brixia Rugby</strong>
          </p>
        </div>
      </div>
    `,
    text: `
      IL Brixia Rugby - Reset Password

      Ciao,

      Hai richiesto il reset della password per il tuo account in IL Brixia Rugby.

      Per impostare una nuova password, copia e incolla questo link nel tuo browser:

      {{ .ConfirmationURL }}

      IMPORTANTE: Questo link scade tra 1 ora per motivi di sicurezza.

      Se non hai richiesto tu questo reset, ignora questa email e la tua password rimarrà invariata.

      Cordiali saluti,
      Team IL Brixia Rugby
    `
  },

  // Template per cambio email
  CHANGE_EMAIL: {
    subject: 'IL Brixia Rugby - Conferma Nuova Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0B1B3B; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🏉 IL Brixia Rugby</h1>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #0B1B3B; margin-top: 0;">Conferma Nuova Email</h2>
          
          <p style="font-size: 16px; line-height: 1.6;">Ciao,</p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Hai richiesto di cambiare l'email del tuo account in <strong>IL Brixia Rugby</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6;">
            Clicca sul pulsante qui sotto per confermare la nuova email:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{ .ConfirmationURL }}" 
               style="background: #2A60A6; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
                      display: inline-block;">
              ✉️ Conferma Nuova Email
            </a>
          </div>
          
          <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #2e7d32;">
              <strong>✅ Conferma:</strong> Dopo la conferma, la tua email verrà aggiornata nel sistema.
            </p>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #666;">
            Se non hai richiesto tu questo cambio, ignora questa email.
          </p>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            Cordiali saluti,<br>
            <strong>Team IL Brixia Rugby</strong>
          </p>
        </div>
      </div>
    `,
    text: `
      IL Brixia Rugby - Conferma Nuova Email

      Ciao,

      Hai richiesto di cambiare l'email del tuo account in IL Brixia Rugby.

      Per confermare la nuova email, copia e incolla questo link nel tuo browser:

      {{ .ConfirmationURL }}

      Dopo la conferma, la tua email verrà aggiornata nel sistema.

      Se non hai richiesto tu questo cambio, ignora questa email.

      Cordiali saluti,
      Team IL Brixia Rugby
    `
  }
}

// Funzione helper per ottenere un template specifico
export const getEmailTemplate = (type: keyof typeof EMAIL_TEMPLATES) => {
  return EMAIL_TEMPLATES[type]
}

// Funzione per validare un template
export const validateEmailTemplate = (template: any) => {
  return template && 
         template.subject && 
         template.html && 
         template.text
}


