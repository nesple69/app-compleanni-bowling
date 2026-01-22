/**
 * GOOGLE APPS SCRIPT - Bowling Valdera
 * Data: 15 Gennaio 2026
 * 
 * DEPLOYMENT URL: https://script.google.com/macros/s/AKfycbzBUSpATfJw5nK7Ja-z8tY3K5qocNLTDm3yXptoaZcT3Ywx7H4LtfkzyVb7PAPeB7mM/exec
 * 
 * IMPORTANTE: Questo script è collegato al foglio Google Sheets "compleanni"
 * Calendar ID: federicacircelli25@gmail.com
 * Email mittente: info@bowlingvaldera.it
 */

const SHEET_NAME = 'dati_compleanno';
const CALENDAR_ID = 'federicacircelli25@gmail.com';

// --- GESTIONE VERIFICA DISPONIBILITÀ (GET) ---
function doGet(e) {
  const dateStr = e.parameter.date; // Si aspetta DD-MM-YYYY
  const timeStr = e.parameter.time;

  if (!dateStr || !timeStr) {
    return ContentService.createTextOutput(JSON.stringify({ available: false, error: "Missing params" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Converti data da DD-MM-YYYY a YYYY-MM-DD per la ricerca nel calendario
  const dateParts = dateStr.split('-');
  const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

  const isAvailable = checkCalendarAvailability(isoDate, timeStr);

  return ContentService.createTextOutput(JSON.stringify({ available: isAvailable }))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- GESTIONE SALVATAGGIO PRENOTAZIONE (POST) ---
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    // Aggiungi riga al foglio (ordine esatto delle colonne)
    sheet.appendRow([
      new Date(),              // Timestamp
      data.festeggiato,        // Festeggiato
      data.anni,               // Anni
      data.cliente,            // Cliente
      data.telefono,           // Telefono
      data.email,              // Email
      data.data_festa,         // Data Festa
      data.ora,                // Ora
      data.partecipanti,       // Persone
      data.menu,               // Menu
      data.patatine,           // Patatine
      data.torta,              // Torta
      data.scritta_torta,      // Scritta
      data.altre_richieste,    // Note
      data.durata,             // Durata
      data.totale,             // Totale
      data.allergie_dichiarate,// Allergie Dichiarate
      data.gdpr,               // GDPR
      data.marketing,          // Marketing
      data.foto_torta          // Foto Torta
    ]);

    createCalendarEvent(data);
    sendConfirmationEmail(data);

    // Formatta la colonna Totale (colonna 16) con il simbolo €
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 16).setNumberFormat('€#,##0.00');

    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

// --- FUNZIONALITÀ INTERNE ---
function checkCalendarAvailability(dateStr, timeStr) {
  const start = new Date(dateStr + 'T' + timeStr + ':00');
  // Consideriamo una finestra di 2 ore per la disponibilità
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const events = calendar.getEvents(start, end);

  // Controllo chiusure o ferie (eventi di tutto il giorno)
  const dayStart = new Date(dateStr + 'T00:00:00');
  const dayEnd = new Date(dateStr + 'T23:59:59');
  const allDayEvents = calendar.getEvents(dayStart, dayEnd);

  for (let event of allDayEvents) {
    const title = event.getTitle().toUpperCase();
    if (title.includes("CHIUSO") || title.includes("FERIE")) {
      return false;
    }
  }

  return events.length === 0;
}

function createCalendarEvent(data) {
  // Converti data da DD-MM-YYYY a YYYY-MM-DD
  const dateParts = data.data_festa.split('-');
  const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

  const start = new Date(isoDate + 'T' + data.ora + ':00');
  const durationInHours = parseFloat(data.durata) || 2;
  const end = new Date(start.getTime() + durationInHours * 60 * 60 * 1000);

  const title = "FESTA " + data.festeggiato.toUpperCase() + " (" + data.partecipanti + " pers.)";
  const desc = "Cliente: " + data.cliente + "\nTel: " + data.telefono + "\nMenu: " + data.menu + "\nTorta: " + data.torta;

  CalendarApp.getCalendarById(CALENDAR_ID).createEvent(title, start, end, { description: desc });
}

function sendConfirmationEmail(data) {
  const recipient = data.email || "info@bowlingvaldera.it";
  const subject = "Conferma Prenotazione Compleanno - " + data.festeggiato;

  const logoUrl = "https://static.wixstatic.com/media/f8ebda_855a92753e0446558b7d1137bc653197~mv2.png";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #b71c1c; padding: 20px; text-align: center;">
        <img src="${logoUrl}" alt="Bowling Valdera" style="max-width: 180px;">
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #b71c1c; text-align: center;">Prenotazione Confermata! &#x1F3B3;</h2>
        <p>Ciao <strong>${data.cliente}</strong>,</p>
        <p>Siamo felici di confermarti la prenotazione per il compleanno di <strong>${data.festeggiato}</strong>!</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;">&#x1F4C5; <strong>Data:</strong> ${data.data_festa}</p>
          <p style="margin: 5px 0;">&#x1F554; <strong>Orario:</strong> ${data.ora}</p>
          <p style="margin: 5px 0;">&#x1F465; <strong>Invitati:</strong> ${data.partecipanti}</p>
          <p style="margin: 5px 0;">&#x1F355; <strong>Menu:</strong> ${data.menu}</p>
          <p style="margin: 5px 0;">&#x1F382; <strong>Torta:</strong> ${data.torta}</p>
          <p style="margin: 5px 0;">&#x1F4B0; <strong>Totale:</strong> €${data.totale}</p>
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

  GmailApp.sendEmail(recipient, subject, "", {
    from: "info@bowlingvaldera.it",
    htmlBody: htmlBody
  });

  // Email admin
  GmailApp.sendEmail("federicacircelli25@gmail.com", "[NUOVA PRENOTAZIONE] " + data.festeggiato + " - " + data.data_festa, "", {
    from: "info@bowlingvaldera.it",
    htmlBody: htmlBody
  });
}
