/**
 * GOOGLE APPS SCRIPT — Bowling Valdera
 * Versione: 2.0 — Aggiornato 2026-08-25
 *
 * PASSI PER IL DEPLOY:
 * 1. Aprire il progetto Apps Script collegato al foglio.
 * 2. Impostare le Proprietà dello script (Impostazioni progetto → Proprietà):
 *      API_SECRET   = BV2026-f8e3a7d2b9c4-k7p1   (stesso valore di API_TOKEN in script.js)
 *      CALENDAR_ID  = <email del calendario Google>
 *      ADMIN_EMAIL  = <email admin che riceve le notifiche>
 *      SENDER_EMAIL = info@bowlingvaldera.it
 * 3. Incollare questo codice e fare Deploy → Nuova distribuzione (o aggiorna esistente).
 * 4. NESSUN valore sensibile va hardcodato in questo file — tutto tramite ScriptProperties.
 */

const SHEET_NAME = 'dati_compleanno';

/** Recupera i valori di configurazione dalle ScriptProperties (non hardcodati). */
function getProps() {
  const p = PropertiesService.getScriptProperties();
  return {
    calendarId:  p.getProperty('CALENDAR_ID'),
    adminEmail:  p.getProperty('ADMIN_EMAIL'),
    senderEmail: p.getProperty('SENDER_EMAIL'),
    apiSecret:   p.getProperty('API_SECRET'),
  };
}

/** Sanitizza stringhe per prevenire HTML Injection nelle email. */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- GESTIONE PREFLIGHT CORS (OPTIONS) ---
function doOptions(e) {
  return ContentService.createTextOutput('');
}

// --- VERIFICA DISPONIBILITÀ (GET) ---
function doGet(e) {
  const dateStr       = e.parameter.date;
  const timeStr       = e.parameter.time;
  const durationHours = parseFloat(e.parameter.duration) || 1.5;

  if (!dateStr || !timeStr) {
    return ContentService
      .createTextOutput(JSON.stringify({ available: false, error: 'Missing params' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const dateParts = dateStr.split('-');
  const isoDate   = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
  const isAvailable = checkCalendarAvailability(isoDate, timeStr, durationHours);

  return ContentService
    .createTextOutput(JSON.stringify({ available: isAvailable }))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- SALVATAGGIO PRENOTAZIONE (POST) ---
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const props = getProps();

    // Validazione token di sicurezza
    if (!props.apiSecret || data._token !== props.apiSecret) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    sheet.appendRow([
      new Date(),
      data.festeggiato,
      data.anni,
      data.cliente,
      data.telefono,
      data.email,
      data.data_festa,
      data.ora,
      data.partecipanti,
      data.menu,
      data.patatine,
      data.torta,
      data.scritta_torta,
      data.altre_richieste,
      data.durata,
      data.totale,
      data.allergie_dichiarate,
      data.gdpr,
      data.marketing,
      data.foto_torta
    ]);

    createCalendarEvent(data, props);
    sendConfirmationEmail(data, props);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 16).setNumberFormat('€#,##0.00');

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- VERIFICA DISPONIBILITÀ CALENDARIO ---
// Fix: usa la durata reale dell'evento + buffer di 30 minuti per setup/pulizia
function checkCalendarAvailability(dateStr, timeStr, durationHours) {
  const props    = getProps();
  const start    = new Date(dateStr + 'T' + timeStr + ':00');
  const bufferMs = 30 * 60 * 1000;
  const end      = new Date(start.getTime() + (durationHours * 60 * 60 * 1000) + bufferMs);

  const calendar = CalendarApp.getCalendarById(props.calendarId);
  const events   = calendar.getEvents(start, end);

  // Controllo chiusure o ferie (eventi tutto il giorno con titolo CHIUSO/FERIE)
  const dayStart      = new Date(dateStr + 'T00:00:00');
  const dayEnd        = new Date(dateStr + 'T23:59:59');
  const allDayEvents  = calendar.getEvents(dayStart, dayEnd);

  for (const event of allDayEvents) {
    const title = event.getTitle().toUpperCase();
    if (title.includes('CHIUSO') || title.includes('FERIE')) {
      return false;
    }
  }

  return events.length === 0;
}

// --- CREAZIONE EVENTO CALENDARIO ---
function createCalendarEvent(data, props) {
  const dateParts      = data.data_festa.split('-');
  const isoDate        = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
  const start          = new Date(isoDate + 'T' + data.ora + ':00');
  const durationInHours = parseFloat(data.durata) || 2;
  const end            = new Date(start.getTime() + durationInHours * 60 * 60 * 1000);

  const title = 'FESTA ' + data.festeggiato.toUpperCase() + ' (' + data.partecipanti + ' pers.)';
  const desc  = 'Cliente: ' + data.cliente + '\nTel: ' + data.telefono +
                '\nMenu: ' + data.menu + '\nTorta: ' + data.torta;

  CalendarApp.getCalendarById(props.calendarId).createEvent(title, start, end, { description: desc });
}

// --- INVIO EMAIL DI CONFERMA ---
// Fix: tutti i valori utente sono sanitizzati con escapeHtml per prevenire HTML Injection
function sendConfirmationEmail(data, props) {
  const recipient = data.email || props.adminEmail;
  const subject   = 'Conferma Prenotazione Compleanno - ' + data.festeggiato;
  const logoUrl   = 'https://static.wixstatic.com/media/f8ebda_855a92753e0446558b7d1137bc653197~mv2.png';

  const safeCliente     = escapeHtml(data.cliente);
  const safeFesteggiato = escapeHtml(data.festeggiato);
  const safeData        = escapeHtml(data.data_festa);
  const safeOra         = escapeHtml(data.ora);
  const safePartec      = escapeHtml(String(data.partecipanti));
  const safeMenu        = escapeHtml(data.menu);
  const safeTorta       = escapeHtml(data.torta);
  const safeTotale      = escapeHtml(String(data.totale));

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #b71c1c; padding: 20px; text-align: center;">
        <img src="${logoUrl}" alt="Bowling Valdera" style="max-width: 180px;">
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #b71c1c; text-align: center;">Prenotazione Confermata! &#x1F3B3;</h2>
        <p>Ciao <strong>${safeCliente}</strong>,</p>
        <p>Siamo felici di confermarti la prenotazione per il compleanno di <strong>${safeFesteggiato}</strong>!</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;">&#x1F4C5; <strong>Data:</strong> ${safeData}</p>
          <p style="margin: 5px 0;">&#x1F554; <strong>Orario:</strong> ${safeOra}</p>
          <p style="margin: 5px 0;">&#x1F465; <strong>Invitati:</strong> ${safePartec}</p>
          <p style="margin: 5px 0;">&#x1F355; <strong>Menu:</strong> ${safeMenu}</p>
          <p style="margin: 5px 0;">&#x1F382; <strong>Torta:</strong> ${safeTorta}</p>
          <p style="margin: 5px 0;">&#x1F4B0; <strong>Totale:</strong> &euro;${safeTotale}</p>
        </div>
        <p style="font-size: 0.9em; color: #666; font-style: italic; text-align: center;">
          Ti aspettiamo per strike, musica e tanto divertimento!
        </p>
      </div>
      <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 0.8em; color: #777;">
        <p style="margin: 5px 0;"><strong>Bowling Valdera</strong></p>
        <p style="margin: 5px 0;">Via ToscoRomagnola, 127, Fornacette (PI)</p>
        <p style="margin: 5px 0;">&#x1F4DE; 0587 420120 | &#x1F310; <a href="http://www.bowlingvaldera.com" style="color: #b71c1c;">www.bowlingvaldera.com</a></p>
      </div>
    </div>
  `;

  GmailApp.sendEmail(recipient, subject, '', {
    from: props.senderEmail,
    htmlBody: htmlBody
  });

  GmailApp.sendEmail(props.adminEmail, '[NUOVA PRENOTAZIONE] ' + data.festeggiato + ' - ' + data.data_festa, '', {
    from: props.senderEmail,
    htmlBody: htmlBody
  });
}
