/**
 * GOOGLE APPS SCRIPT — Bowling Valdera
 * Versione: 3.0 — Audit & Security Hardened
 *
 * ISTRUZIONI PER IL DEPLOY:
 * 1. Aprire il progetto Google Apps Script collegato al Google Sheet.
 * 2. Impostare le Proprietà dello script (Impostazioni progetto → Proprietà script):
 *      API_SECRET   = BV2026-f8e3a7d2b9c4-k7p1 (o il token concordato)
 *      CALENDAR_ID  = <ID_CALENDARIO_GOOGLE> (es. federicacircelli25@gmail.com o email titolare)
 *      ADMIN_EMAIL  = <EMAIL_AMMINISTRATORE> (riceve notifiche complete e recapiti)
 *      SENDER_EMAIL = info@bowlingvaldera.it
 * 3. Incollare questo codice nel file Code.gs.
 * 4. Fare Deploy → Distribuisci come applicazione web:
 *      - Esegui come: "Io" (il proprietario dell'account)
 *      - Chi ha accesso: "Chiunque" (per consentire le chiamate dal frontend)
 * 5. Se l'URL di deployment cambia, aggiornare SCRIPT_URL in script.js.
 */

const SHEET_NAME = 'dati_compleanno';

// Listino ufficiale per ricalcolo e validazione server-side dei prezzi
const MENU_PRICES = {
  'Basic': 10.0,
  'Smart': 12.5,
  'Plus':  11.5,
  'Prime': 15.0,
  'Ultra': 18.5
};
// Tariffe Bowling fisse per pista (30€ / ora a pista tutti i giorni)
const PRICE_LANE = { '1h': 30.0, '1.5h': 45.0, '2h': 60.0, '2.5h': 75.0 };
const PRICE_FRIES        = 2.0;
const PRICE_CAKE_PHOTO   = 5.0;
const MAX_PLAYERS_PER_LANE = 6;

/** Recupera i valori di configurazione dalle ScriptProperties */
function getProps() {
  const p = PropertiesService.getScriptProperties();
  const rawAdmin = p.getProperty('ADMIN_EMAIL');
  // Se non configurato o impostato sul vecchio indirizzo nesple@gmail.com, usa info@bowlingvaldera.it
  // Notifica aziendale sempre su info@bowlingvaldera.it (ignora vecchi indirizzi dismessi come nesple@gmail.com)
  const adminEmail = 'info@bowlingvaldera.it';

  return {
    calendarId:  p.getProperty('CALENDAR_ID') || 'primary',
    adminEmail:  adminEmail,
    senderEmail: p.getProperty('SENDER_EMAIL') || 'info@bowlingvaldera.it',
    apiSecret:   p.getProperty('API_SECRET') || 'BV2026-f8e3a7d2b9c4-k7p1',
  };
}

function normalizeDateToIso(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).trim().split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // Già in formato ISO: YYYY-MM-DD
      return parts[0] + '-' + (parts[1].length < 2 ? '0' + parts[1] : parts[1]) + '-' + (parts[2].length < 2 ? '0' + parts[2] : parts[2]);
    } else if (parts[2].length === 4) {
      // In formato italiano: DD-MM-YYYY -> converti in YYYY-MM-DD
      return parts[2] + '-' + (parts[1].length < 2 ? '0' + parts[1] : parts[1]) + '-' + (parts[0].length < 2 ? '0' + parts[0] : parts[0]);
    }
  }
  return dateStr;
}

/**
 * Controllo festività chiuse obbligatoriamente di default:
 * Solo Natale (25 dic), S. Stefano (26 dic), Capodanno (1 gen), Pasqua e Pasquetta.
 * Tutti gli altri festivi sono aperti salvo evento "CHIUSO" segnato su Google Calendar.
 */
function isClosedHoliday(year, month, day) {
  // Feste fisse
  if ((month === 1 && day === 1) || (month === 12 && (day === 25 || day === 26))) {
    return true;
  }
  // Pasqua e Pasquetta (algoritmo astronomico gregoriano Meeus/Jones/Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

  if (month === easterMonth && day === easterDay) return true; // Pasqua

  const mondayDate = new Date(year, easterMonth - 1, easterDay + 1);
  if (month === (mondayDate.getMonth() + 1) && day === mondayDate.getDate()) return true; // Pasquetta

  return false;
}

/** Sanitizza stringhe per prevenire HTML Injection nelle email */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Sanitizza stringhe per prevenire Formula Injection su Google Sheets */
function sanitizeForSheet(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/** Calcola e convalida in modo autorevole il prezzo totale */
function calculateAuthoritativeTotal(data) {
  const part = parseInt(data.partecipanti, 10) || 0;
  if (part <= 0) return 0;

  const durationKey = data.durata || '1.5h';
  const lanes = Math.ceil(part / MAX_PLAYERS_PER_LANE);
  const laneCost = lanes * (PRICE_LANE[durationKey] || 45.0);

  const menuPrice = MENU_PRICES[data.menu] !== undefined ? MENU_PRICES[data.menu] : 10.0;
  const friesCost = (data.patatine === 'Sì') ? PRICE_FRIES : 0;
  const photoCost = (data.foto_torta === 'Sì') ? PRICE_CAKE_PHOTO : 0;

  const totalFoodCost = part * (menuPrice + friesCost);
  return Math.round((laneCost + totalFoodCost + photoCost) * 100) / 100;
}

// --- VERIFICA DISPONIBILITÀ (GET) ---
function doGet(e) {
  try {
    const action = e.parameter.action;

    // Richiesta disponibilità dell'intero mese (per il calendario interattivo)
    if (action === 'month_availability') {
      const year          = parseInt(e.parameter.year, 10);
      const month         = parseInt(e.parameter.month, 10); // 1-12
      const durationHours = parseFloat(e.parameter.duration) || 1.5;

      if (!year || !month) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Anno o mese mancanti' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const monthData = getMonthAvailability(year, month, durationHours);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, year: year, month: month, days: monthData }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const dateStr       = e.parameter.date;
    const timeStr       = e.parameter.time;
    const durationHours = parseFloat(e.parameter.duration) || 1.5;

    if (!dateStr || !timeStr) {
      return ContentService
        .createTextOutput(JSON.stringify({ available: false, error: 'Parametri mancanti' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const isoDate     = normalizeDateToIso(dateStr);
    const isAvailable = checkCalendarAvailability(isoDate, timeStr, durationHours);

    return ContentService
      .createTextOutput(JSON.stringify({ available: isAvailable }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ available: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- RECUPERO DISPONIBILITÀ MENSILE IN UN'UNICA CHIAMATA ---
function getMonthAvailability(year, month, durationHours) {
  const props = getProps();
  if (!props.calendarId) return {};

  const calendar = CalendarApp.getCalendarById(props.calendarId) || CalendarApp.getDefaultCalendar();
  if (!calendar) return {};

  const firstDay = new Date(year, month - 1, 1, 0, 0, 0);
  const numDays  = new Date(year, month, 0).getDate();
  const lastDay  = new Date(year, month - 1, numDays, 23, 59, 59);

  // Una sola lettura da Google Calendar per tutto il mese
  const allEvents = calendar.getEvents(firstDay, lastDay);

  const now = new Date();
  const pad = function(n) { return (n < 10 ? '0' : '') + n; };
  const todayDateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  const bufferMs = 30 * 60 * 1000;
  const daysMap  = {};

  for (let day = 1; day <= numDays; day++) {
    const dStr       = year + '-' + pad(month) + '-' + pad(day);
    const dayDate    = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek  = dayDate.getDay(); // 0=Dom, 3=Mer

    // Giorni nel passato
    if (dStr < todayDateStr) {
      daysMap[dStr] = { status: 'past', slots: [], label: 'Passato' };
      continue;
    }

    // Chiusura settimanale fissa (Mercoledì)
    if (dayOfWeek === 3) {
      daysMap[dStr] = { status: 'closed', slots: [], label: 'Chiuso (Mercoledì)' };
      continue;
    }

    // Chiusura per festività speciali di default (Natale, S. Stefano, Capodanno, Pasqua e Pasquetta)
    if (isClosedHoliday(year, month, day)) {
      daysMap[dStr] = { status: 'closed', slots: [], label: 'Festivo' };
      continue;
    }

    // Controllo eventi a giorno intero da calendario (qualsiasi evento a giorno intero blocca la giornata)
    const dayStart = new Date(year, month - 1, day, 0, 0, 0);
    const dayEnd   = new Date(year, month - 1, day, 23, 59, 59);
    let isDayBlocked = false;
    let blockStatus  = 'full';
    let blockLabel   = 'Tutto Pieno';

    for (let i = 0; i < allEvents.length; i++) {
      const ev = allEvents[i];
      if (ev.isAllDayEvent() && ev.getStartTime() < dayEnd && ev.getEndTime() > dayStart) {
        isDayBlocked = true;
        const title = (ev.getTitle() || '').toUpperCase();
        if (title.indexOf('CHIUSO') !== -1 || title.indexOf('FERIE') !== -1) {
          blockStatus = 'closed';
          blockLabel  = 'Chiuso';
        } else {
          blockStatus = 'full';
          blockLabel  = 'Tutto Pieno';
        }
        break;
      }
    }

    if (isDayBlocked) {
      daysMap[dStr] = { status: blockStatus, slots: [], label: blockLabel };
      continue;
    }

    // Slot teorici per il giorno
    const candidateSlots = (dayOfWeek === 0) ? ['19:30'] : ['17:00', '18:00', '19:00'];
    const availableSlots = [];

    for (let s = 0; s < candidateSlots.length; s++) {
      const parts = candidateSlots[s].split(':');
      const hour  = parseInt(parts[0], 10);
      const min   = parseInt(parts[1], 10);

      const slotStart  = new Date(year, month - 1, day, hour, min, 0);
      const slotEnd    = new Date(slotStart.getTime() + (durationHours * 60 * 60 * 1000));
      const checkStart = new Date(slotStart.getTime() - bufferMs + 1000);
      const checkEnd   = new Date(slotEnd.getTime() + bufferMs - 1000);

      let conflict = false;
      for (let e = 0; e < allEvents.length; e++) {
        const ev = allEvents[e];
        if (ev.isAllDayEvent()) continue;
        if (ev.getStartTime() < checkEnd && ev.getEndTime() > checkStart) {
          conflict = true;
          break;
        }
      }

      if (!conflict) {
        availableSlots.push(candidateSlots[s]);
      }
    }

    if (availableSlots.length > 0) {
      daysMap[dStr] = {
        status: 'available',
        slots: availableSlots,
        label: availableSlots.length === 1 ? '1 orario libero' : availableSlots.length + ' orari liberi'
      };
    } else {
      daysMap[dStr] = {
        status: 'full',
        slots: [],
        label: 'Tutto Pieno'
      };
    }
  }

  return daysMap;
}

// --- SALVATAGGIO PRENOTAZIONE (POST) ---
function doPost(e) {
  // Lock di concorrenza per prevenire race conditions e doppie prenotazioni simultanee
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000); // attende fino a 15 secondi

  if (!hasLock) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Il server è occupato. Riprova tra pochi istanti.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const data  = JSON.parse(e.postData.contents);
    const props = getProps();

    // Validazione token di sicurezza
    if (!props.apiSecret || data._token !== props.apiSecret) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Non autorizzato' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Riverifica disponibilità all'interno del blocco con lock
    const isoDate   = normalizeDateToIso(data.data_festa || '');
    const durationHours = parseFloat(data.durata) || 1.5;

    const stillAvailable = checkCalendarAvailability(isoDate, data.ora, durationHours);
    if (!stillAvailable) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Spiacenti, l\'orario selezionato è appena stato prenotato da un altro utente.'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Ricalcolo autorevole del prezzo per prevenire manomissioni lato client
    const verifiedTotal = calculateAuthoritativeTotal(data);
    data.totale = verifiedTotal;

    // 3. Scrittura su Google Sheets con protezione da Formula Injection
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    sheet.appendRow([
      new Date(),                                   // Col 1: Timestamp
      sanitizeForSheet(data.festeggiato),           // Col 2: Festeggiato
      sanitizeForSheet(data.anni),                  // Col 3: Anni
      sanitizeForSheet(data.cliente),               // Col 4: Cliente
      sanitizeForSheet(data.telefono),              // Col 5: Telefono
      sanitizeForSheet(data.email),                 // Col 6: Email
      sanitizeForSheet(data.data_festa),            // Col 7: Data Festa (DD-MM-YYYY)
      sanitizeForSheet(data.ora),                   // Col 8: Ora
      parseInt(data.partecipanti, 10) || 0,         // Col 9: Partecipanti
      sanitizeForSheet(data.menu),                  // Col 10: Menu
      sanitizeForSheet(data.patatine),              // Col 11: Patatine
      sanitizeForSheet(data.torta),                 // Col 12: Torta
      sanitizeForSheet(data.scritta_torta),         // Col 13: Scritta Torta
      sanitizeForSheet(data.altre_richieste),       // Col 14: Altre Richieste
      sanitizeForSheet(data.durata),                // Col 15: Durata
      data.totale,                                  // Col 16: Totale
      sanitizeForSheet(data.allergie_dichiarate),   // Col 17: Allergie Dichiarate
      sanitizeForSheet(data.gdpr),                  // Col 18: GDPR
      sanitizeForSheet(data.marketing),             // Col 19: Marketing
      sanitizeForSheet(data.foto_torta),            // Col 20: Foto Torta
      sanitizeForSheet(data.dettagli_allergie)      // Col 21: Dettagli Allergie
    ]);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 16).setNumberFormat('€#,##0.00');

    // 4. Creazione Evento Google Calendar
    createCalendarEvent(data, props);

    // 5. Invio email di notifica (con try/catch isolato per evitare rollback fittizio)
    sendConfirmationEmail(data, props);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, totale: verifiedTotal }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('Errore durante doPost:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- VERIFICA DISPONIBILITÀ CALENDARIO ---
function checkCalendarAvailability(dateStr, timeStr, durationHours) {
  const props = getProps();
  if (!props.calendarId) {
    throw new Error('CALENDAR_ID non configurato nelle Proprietà dello script.');
  }

  const calendar = CalendarApp.getCalendarById(props.calendarId);
  if (!calendar) {
    throw new Error('Impossibile accedere al calendario con ID specificato.');
  }

  // 0. Controllo festività speciali di default (Natale, S. Stefano, Capodanno, Pasqua e Pasquetta)
  const dParts = dateStr.split('-');
  const checkYear  = parseInt(dParts[0], 10);
  const checkMonth = parseInt(dParts[1], 10);
  const checkDay   = parseInt(dParts[2], 10);
  if (isClosedHoliday(checkYear, checkMonth, checkDay)) {
    return false;
  }

  // 1. Controllo eventi a giorno intero (qualsiasi evento a giorno intero blocca la giornata)
  const dayStart     = new Date(dateStr + 'T00:00:00');
  const dayEnd       = new Date(dateStr + 'T23:59:59');
  const dayEvents    = calendar.getEvents(dayStart, dayEnd);

  for (let i = 0; i < dayEvents.length; i++) {
    const ev = dayEvents[i];
    if (ev.isAllDayEvent() && ev.getStartTime() < dayEnd && ev.getEndTime() > dayStart) {
      return false; // Giornata intera occupata da evento all-day su Google Calendar
    }
  }

  // 2. Controllo disponibilità fascia oraria con buffer di 30 min simmetrico
  const bufferMs = 30 * 60 * 1000;
  const start = new Date(dateStr + 'T' + timeStr + ':00');
  const end   = new Date(start.getTime() + (durationHours * 60 * 60 * 1000));

  // Intervallo di collisione: include il tempo di pulizia prima e dopo
  const checkStart = new Date(start.getTime() - bufferMs + 1000);
  const checkEnd   = new Date(end.getTime() + bufferMs - 1000);

  const overlappingEvents = calendar.getEvents(checkStart, checkEnd);
  return overlappingEvents.length === 0;
}

// --- CREAZIONE EVENTO CALENDARIO ---
function createCalendarEvent(data, props) {
  if (!props.calendarId) return;

  const isoDate         = normalizeDateToIso(data.data_festa || '');
  const start           = new Date(isoDate + 'T' + data.ora + ':00');
  const durationInHours = parseFloat(data.durata) || 1.5;
  const end             = new Date(start.getTime() + durationInHours * 60 * 60 * 1000);

  const durationMap = {
    '1h':   '1 Ora',
    '1.5h': '1.5 Ore (1h 30m)',
    '2h':   '2 Ore',
    '2.5h': '2.5 Ore (2h 30m)'
  };
  const durataReadable = durationMap[data.durata] || (data.durata ? data.durata + ' ore' : '1.5 Ore');

  const festName = (data.festeggiato || 'FESTA').toUpperCase();
  const anniStr  = data.anni ? ' (' + data.anni + ' anni)' : '';
  const title    = 'FESTA ' + festName + anniStr + ' - ' + data.partecipanti + ' pers.';

  const desc = 
    'Festeggiato: ' + (data.festeggiato || '-') + '\n' +
    'Età: ' + (data.anni ? data.anni + ' anni' : '-') + '\n' +
    'Durata Bowling: ' + durataReadable + '\n' +
    'Caparra: da versare\n' +
    '----------------------------------------\n' +
    'Genitore / Cliente: ' + data.cliente + '\n' +
    'Tel: ' + data.telefono + '\n' +
    'Email: ' + data.email + '\n' +
    'Partecipanti: ' + data.partecipanti + ' persone\n' +
    'Menu: ' + data.menu + (data.patatine === 'Sì' ? ' + Patatine' : '') + '\n' +
    'Torta: ' + data.torta + (data.foto_torta === 'Sì' ? ' (+ Foto)' : '') + '\n' +
    'Scritta Torta: ' + (data.scritta_torta || '-') + '\n' +
    'Allergie / Intolleranze: ' + (data.dettagli_allergie || 'Nessuna') + '\n' +
    'Note / Richieste: ' + (data.altre_richieste || '-') + '\n' +
    'Totale Stimato: €' + (typeof data.totale === 'number' ? data.totale.toFixed(2) : data.totale);

  const calendar = CalendarApp.getCalendarById(props.calendarId);
  if (calendar) {
    const event = calendar.createEvent(title, start, end, { description: desc });
    try {
      // Imposta il pallino/colore dell'evento su ROSSO
      event.setColor(CalendarApp.EventColor.RED);
    } catch (e) {
      console.warn('Impossibile impostare il colore dell\'evento:', e);
    }
  }
}

// --- INVIO EMAIL DI CONFERMA ROBUSTO E RESILIENTE ---

/**
 * Invio email sicuro con 3 livelli di fallback automatico:
 * 1. Con alias personalizzato (se autorizzato in Gmail)
 * 2. Con mittente nativo autenticato ma nome "Bowling Valdera" e replyTo "info@bowlingvaldera.it" (infallibile)
 * 3. Con MailApp (motore alternativo Google Apps Script)
 */
function safeSendEmail(recipient, subject, plainText, htmlBody, props) {
  if (!recipient || typeof recipient !== 'string' || recipient.indexOf('@') === -1) {
    console.warn('Indirizzo destinatario mancante o non valido:', recipient);
    return false;
  }

  const replyToEmail = props.senderEmail || 'info@bowlingvaldera.it';
  const senderName   = 'Bowling Valdera';

  // 1. Verifica se l'alias personalizzato è configurato e autorizzato in questo account Gmail
  let isAuthorizedAlias = false;
  try {
    const aliases = GmailApp.getAliases();
    if (replyToEmail && aliases && aliases.indexOf(replyToEmail) !== -1) {
      isAuthorizedAlias = true;
    }
  } catch (e) {
    console.warn('Verifica alias Gmail non disponibile:', e);
  }

  // Tentativo 1: GmailApp con alias "from" (se autorizzato)
  if (isAuthorizedAlias) {
    try {
      GmailApp.sendEmail(recipient, subject, plainText, {
        from: replyToEmail,
        name: senderName,
        replyTo: replyToEmail,
        htmlBody: htmlBody
      });
      console.log('Email inviata con successo via GmailApp (con alias from) a:', recipient);
      return true;
    } catch (errFrom) {
      console.warn('Tentativo con alias from fallito, passo al mittente nativo:', errFrom);
    }
  }

  // Tentativo 2: GmailApp senza "from" non autorizzato (infallibile: usa l'account Google con display name e reply-to)
  try {
    GmailApp.sendEmail(recipient, subject, plainText, {
      name: senderName,
      replyTo: replyToEmail,
      htmlBody: htmlBody
    });
    console.log('Email inviata con successo via GmailApp (mittente standard) a:', recipient);
    return true;
  } catch (errGmail) {
    console.warn('Tentativo GmailApp standard fallito, passo a MailApp:', errGmail);
  }

  // Tentativo 3: MailApp (motore alternativo a livello di progetto Google Apps Script)
  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: plainText,
      htmlBody: htmlBody,
      name: senderName,
      replyTo: replyToEmail
    });
    console.log('Email inviata con successo via MailApp a:', recipient);
    return true;
  } catch (errMail) {
    console.error('ERRORE DEFINITIVO invio email a ' + recipient + ':', errMail);
    return false;
  }
}

function sendConfirmationEmail(data, props) {
  const recipient   = (data.email || '').trim();
  const adminEmail  = (props.adminEmail || 'info@bowlingvaldera.it').trim();
  const logoUrl     = 'https://static.wixstatic.com/media/f8ebda_855a92753e0446558b7d1137bc653197~mv2.png';

  const cleanFesteggiato = String(data.festeggiato || '').replace(/[\r\n]/g, ' ').trim();
  const customerSubject  = 'Conferma Prenotazione Compleanno - ' + cleanFesteggiato;
  const adminSubject     = '[NUOVA PRENOTAZIONE] ' + cleanFesteggiato + ' - ' + data.data_festa;

  const durationMap = {
    '1h':   '1 Ora',
    '1.5h': '1 Ora e Mezza (1.5h)',
    '2h':   '2 Ore',
    '2.5h': '2 Ore e Mezza (2.5h)'
  };
  const durataReadable = durationMap[data.durata] || (data.durata ? data.durata + ' ore' : '1.5 Ore');

  const safeCliente      = escapeHtml(data.cliente);
  const safeFesteggiato  = escapeHtml(data.festeggiato);
  const safeData         = escapeHtml(data.data_festa);
  const safeOra          = escapeHtml(data.ora);
  const safeDurataText   = escapeHtml(durataReadable);
  const safePartec       = escapeHtml(String(data.partecipanti));
  const safeMenu         = escapeHtml(data.menu);
  const safePatatine     = escapeHtml(data.patatine);
  const safeTorta        = escapeHtml(data.torta);
  const safeScritta      = escapeHtml(data.scritta_torta || 'Nessuna');
  const safeFotoTorta    = escapeHtml(data.foto_torta);
  const safeAllergie     = escapeHtml(data.dettagli_allergie || 'Nessuna');
  const safeRichieste    = escapeHtml(data.altre_richieste || '-');
  const safeTotale       = escapeHtml(typeof data.totale === 'number' ? data.totale.toFixed(2) : String(data.totale));
  const safeTel          = escapeHtml(data.telefono);
  const safeEmail        = escapeHtml(data.email);

  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #b71c1c; padding: 20px; text-align: center;">
        <img src="${logoUrl}" alt="Bowling Valdera" style="max-width: 180px;">
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #b71c1c; text-align: center;">Prenotazione Confermata! &#x1F3B3;</h2>
        <p>Ciao <strong>${safeCliente}</strong>,</p>
        <p>Siamo felici di confermarti la prenotazione per la festa di compleanno di <strong>${safeFesteggiato}</strong>!</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; line-height: 1.6;">
          <p style="margin: 6px 0; font-size: 15px;">&#x1F4C5; <strong>Data Festa:</strong> ${safeData}</p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F554; <strong>Orario Inizio:</strong> ore ${safeOra}</p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F3B3; <strong>Durata Gioco Bowling:</strong> <strong style="color: #b71c1c;">${safeDurataText}</strong></p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F465; <strong>Numero Partecipanti:</strong> ${safePartec} invitati</p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F355; <strong>Menu Scelto:</strong> ${safeMenu} ${safePatatine === 'Sì' ? '(con patatine fritte)' : ''}</p>
          
          <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 10px 14px; margin: 12px 0; border-radius: 4px;">
            <p style="margin: 4px 0; font-size: 15px;">&#x1F382; <strong>Tipo di Torta Scelta:</strong> <strong>${safeTorta}</strong> ${safeFotoTorta === 'Sì' ? '<span style="color:#d32f2f; font-weight:bold;">(+ Foto Stampata)</span>' : ''}</p>
            <p style="margin: 4px 0; font-size: 15px;">&#x270D;&#xFE0F; <strong>Scritta da fare sulla Torta:</strong> <strong style="color: #b71c1c; font-size: 16px;">"${safeScritta}"</strong></p>
          </div>

          <p style="margin: 6px 0; font-size: 14px;">&#x26A0;&#xFE0F; <strong>Allergie / Intolleranze:</strong> ${safeAllergie}</p>
          ${safeRichieste !== '-' ? `<p style="margin: 6px 0; font-size: 14px;">&#x1F4DD; <strong>Note aggiuntive:</strong> ${safeRichieste}</p>` : ''}
          
          <div style="margin-top: 15px; padding-top: 12px; border-top: 2px dashed #ddd;">
            <p style="margin: 4px 0; font-size: 18px; color: #b71c1c;">&#x1F4B0; <strong>Totale Stimato:</strong> &euro;${safeTotale}</p>
          </div>
        </div>

        <div style="background-color: #fff3cd; border: 2px solid #ffeeba; border-left: 6px solid #ffb300; padding: 14px 18px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #856404; font-weight: bold;">
            &#x26A0;&#xFE0F; Per la conferma di questa prenotazione è necessario versare una caparra di 50&euro;, la preghiamo di recarsi al Bowling Valdera per definire l'accordo.
          </p>
        </div>

        <p style="font-size: 0.9em; color: #666; font-style: italic; text-align: center;">
          Ti aspettiamo per strike, musica, pizza e tanto divertimento!
        </p>
      </div>
      <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 0.8em; color: #777;">
        <p style="margin: 5px 0;"><strong>Bowling Valdera</strong></p>
        <p style="margin: 5px 0;">Via ToscoRomagnola, 127, Fornacette (PI)</p>
        <p style="margin: 5px 0;">&#x1F4DE; 0587 420120 | &#x1F310; <a href="http://www.bowlingvaldera.com" style="color: #b71c1c;">www.bowlingvaldera.com</a></p>
      </div>
    </div>
  `;

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #333; color: #fff; padding: 15px; text-align: center;">
        <h3 style="margin:0;">NUOVA PRENOTAZIONE COMPLEANNO</h3>
      </div>
      <div style="padding: 20px;">
        <h4 style="margin-top:0;">Dati Cliente</h4>
        <p><strong>Genitore:</strong> ${safeCliente}</p>
        <p><strong>Telefono:</strong> <a href="tel:${safeTel}">${safeTel}</a></p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <h4>Dettagli Festa</h4>
        <p><strong>Festeggiato:</strong> ${safeFesteggiato} (${escapeHtml(String(data.anni))} anni)</p>
        <p><strong>Data Festa:</strong> ${safeData} ore ${safeOra}</p>
        <p><strong>Durata Bowling:</strong> <strong style="color: #b71c1c;">${safeDurataText}</strong></p>
        <p><strong>Numero Partecipanti:</strong> ${safePartec}</p>
        <p><strong>Menu Scelto:</strong> ${safeMenu} (Patatine: ${safePatatine})</p>
        <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 8px 12px; margin: 10px 0;">
          <p style="margin: 2px 0;"><strong>Tipo Torta:</strong> ${safeTorta} (Foto: ${safeFotoTorta})</p>
          <p style="margin: 2px 0;"><strong>Scritta sulla Torta:</strong> <strong style="color: #b71c1c;">"${safeScritta}"</strong></p>
        </div>
        <p><strong>Allergie / Intolleranze:</strong> <strong style="color:red;">${safeAllergie}</strong></p>
        <p><strong>Altre Richieste:</strong> ${safeRichieste}</p>
        <p><strong>Totale Calcolato:</strong> &euro;${safeTotale}</p>
      </div>
    </div>
  `;

  const plainCustomer = 
`Ciao ${data.cliente},
La prenotazione per il compleanno di ${data.festeggiato} al Bowling Valdera è CONFERMATA!

RIEPILOGO DELLA FESTA:
- Data Festa: ${data.data_festa}
- Orario Inizio: ${data.ora}
- Durata Gioco Bowling: ${durataReadable}
- Numero Partecipanti: ${data.partecipanti}
- Menu Scelto: ${data.menu} ${data.patatine === 'Sì' ? '(con patatine fritte)' : ''}
- Tipo di Torta: ${data.torta} ${data.foto_torta === 'Sì' ? '(con foto stampata)' : ''}
- Scritta sulla Torta: "${data.scritta_torta || 'Nessuna'}"
- Totale Stimato: €${safeTotale}

IMPORTANTE: Per la conferma di questa prenotazione è necessario versare una caparra di 50€, la preghiamo di recarsi al Bowling Valdera per definire l'accordo.

Ti aspettiamo per una giornata di strike e festa!
Bowling Valdera - Via ToscoRomagnola 127, Fornacette (PI) - Tel. 0587 420120`;

  // 1. Invio email al cliente
  const clientSent = safeSendEmail(recipient, customerSubject, plainCustomer, customerHtml, props);
  if (!clientSent) {
    console.warn('Attenzione: mancato invio email al cliente:', recipient);
  }

  // 2. Invio email all'amministratore (info@bowlingvaldera.it)
  if (adminEmail) {
    safeSendEmail(adminEmail, adminSubject, plainCustomer, adminHtml, props);
  }
}

/**
 * Funzione di utilità da eseguire nell'editor Google Apps Script
 * per testare l'invio dell'email e autorizzare gli scope di Gmail / Mail.
 */
function testSendEmail() {
  const props = getProps();
  const myEmail = props.adminEmail || Session.getActiveUser().getEmail();
  
  const testData = {
    cliente: 'Mario Rossi (Test)',
    email: myEmail,
    festeggiato: 'Luca',
    anni: 10,
    data_festa: '25-11-2026',
    ora: '18:00',
    durata: '1.5h',
    partecipanti: 15,
    menu: 'Basic',
    patatine: 'Sì',
    torta: 'Pan di Spagna Chantilly',
    scritta_torta: 'Auguri Luca!',
    foto_torta: 'No',
    dettagli_allergie: 'Nessuna',
    altre_richieste: 'Nessuna richiesta particolare',
    totale: 225.0,
    telefono: '3401234567'
  };

  console.log('Avvio test invio email a:', myEmail);
  sendConfirmationEmail(testData, props);
  console.log('Test invio email completato!');
}

/**
 * Funzione di pulizia automatica: elimina tutti gli eventi e le righe di test
 * contrassegnati con 'TEST' su Google Calendar e Google Sheets.
 */
function cleanTestEvents() {
  const props = getProps();
  const calendar = CalendarApp.getCalendarById(props.calendarId) || CalendarApp.getDefaultCalendar();

  // 1. Pulizia Google Calendar
  const startDate = new Date('2026-10-01T00:00:00');
  const endDate   = new Date('2026-12-31T23:59:59');
  const events    = calendar.getEvents(startDate, endDate);
  let calCount    = 0;

  for (let i = 0; i < events.length; i++) {
    const title = events[i].getTitle().toUpperCase();
    if (title.includes('TEST')) {
      events[i].deleteEvent();
      calCount++;
    }
  }
  console.log('Google Calendar: eliminati ' + calCount + ' eventi di test.');

  // 2. Pulizia Google Sheets
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const sheet      = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const lastRow    = sheet.getLastRow();
  let sheetCount   = 0;

  for (let r = lastRow; r >= 2; r--) {
    const festeggiato = String(sheet.getRange(r, 2).getValue() || '').toUpperCase();
    const cliente     = String(sheet.getRange(r, 4).getValue() || '').toUpperCase();
    if (festeggiato.includes('TEST') || cliente.includes('TEST')) {
      sheet.deleteRow(r);
      sheetCount++;
    }
  }
  console.log('Google Sheets: eliminate ' + sheetCount + ' righe di test.');
  console.log('>>> PULIZIA COMPLETATA CON SUCCESSO! <<<');
}
