// ============================================
// Google Apps Script per App Compleanni Bowling
// VERSIONE AGGIORNATA con campo Allergie
// ============================================

// CONFIGURAZIONE
const SPREADSHEET_ID = '1O_0-qpQFpEby4LsLlyC8xUwFLwrixd_-tNIrMeuA9Ro'; // ID del foglio Google Sheets
const SHEET_NAME = 'Prenotazioni';
const CALENDAR_ID = 'primary'; // o il tuo Calendar ID personalizzato
const EMAIL_FROM = 'info@bowlingvaldera.it';

// ============================================
// FUNZIONE GET: Controlla disponibilità
// ============================================
function doGet(e) {
  try {
    const date = e.parameter.date;
    const time = e.parameter.time;
    
    Logger.log('doGet chiamato - Date: ' + date + ', Time: ' + time);
    
    if (!date || !time) {
      return ContentService.createTextOutput(JSON.stringify({
        available: false,
        error: 'Missing parameters'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Controlla se c'è già un evento nel calendario
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    
    // Converti data da DD-MM-YYYY (formato italiano) a oggetto Date
    const [day, month, year] = date.split('-').map(Number);
    const startDateTime = new Date(year, month - 1, day);
    Logger.log('Data parsata: ' + startDateTime);
    
    // Imposta l'orario
    const [hours, minutes] = time.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
    
    // Cerca eventi nelle 3 ore successive all'orario selezionato
    const endDateTime = new Date(startDateTime.getTime() + (3 * 60 * 60 * 1000));
    
    const events = calendar.getEvents(startDateTime, endDateTime);
    
    // Filtra solo eventi di compleanno (quelli con tag specifico)
    const birthdayEvents = events.filter(event => {
      const title = event.getTitle().toLowerCase();
      return title.includes('compleanno') || title.includes('festa');
    });
    
    const available = birthdayEvents.length === 0;
    
    return ContentService.createTextOutput(JSON.stringify({
      available: available,
      date: date,
      time: time
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      available: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// FUNZIONE POST: Salva prenotazione
// ============================================
function doPost(e) {
  try {
    Logger.log('doPost chiamato');
    Logger.log('Parametri ricevuti: ' + JSON.stringify(e.parameter));
    Logger.log('postData: ' + (e.postData ? e.postData.contents : 'nessun postData'));
    
    let data;
    
    // Prova prima a leggere dal parametro 'data' (FormData)
    if (e.parameter && e.parameter.data) {
      Logger.log('Dati ricevuti come parametro form');
      data = JSON.parse(e.parameter.data);
    } 
    // Altrimenti prova a leggere dal body JSON
    else if (e.postData && e.postData.contents) {
      Logger.log('Dati ricevuti come JSON body');
      data = JSON.parse(e.postData.contents);
    } 
    else {
      throw new Error('Nessun dato ricevuto');
    }
    
    Logger.log('Dati parsati: ' + JSON.stringify(data));
    
    // 1. Salva su Google Sheets
    Logger.log('Inizio salvataggio su Sheets...');
    saveToSheet(data);
    Logger.log('Salvataggio su Sheets completato');
    
    // 2. Aggiungi al Google Calendar
    Logger.log('Inizio creazione evento Calendar...');
    addToCalendar(data);
    Logger.log('Evento Calendar creato');
    
    // 3. Invia email di conferma
    Logger.log('Inizio invio email...');
    sendConfirmationEmail(data);
    Logger.log('Email inviata');
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Prenotazione salvata con successo'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Errore in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// SALVA SU GOOGLE SHEETS
// ============================================
function saveToSheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Crea il foglio se non esiste
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    
    // Aggiungi intestazioni
    const headers = [
      'Timestamp',
      'Festeggiato',
      'Età',
      'Cliente',
      'Telefono',
      'Email',
      'Data Festa',
      'Orario',
      'Partecipanti',
      'Menu',
      'Patatine',
      'Torta',
      'Scritta Torta',
      'Foto Torta',
      'Durata',
      'Altre Richieste',
      'Allergie Dichiarate', // NUOVO CAMPO
      'GDPR',
      'Marketing',
      'Totale €'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Prepara i dati da inserire
  const row = [
    new Date(), // Timestamp
    data.festeggiato || '',
    data.anni || '',
    data.cliente || '',
    data.telefono || '',
    data.email || '',
    data.data_festa || '',
    data.ora || '',
    data.partecipanti || '',
    data.menu || '',
    data.patatine || 'No',
    data.torta || '',
    data.scritta_torta || '',
    data.foto_torta || 'No',
    data.durata || '',
    data.altre_richieste || '',
    data.allergie_dichiarate || 'No', // NUOVO CAMPO
    data.gdpr || 'No',
    data.marketing || 'No',
    data.totale || '0'
  ];
  
  // Aggiungi la riga
  sheet.appendRow(row);
  
  // Formatta l'ultima riga aggiunta
  const lastRow = sheet.getLastRow();
  
  // Formatta il totale come valuta
  sheet.getRange(lastRow, 20).setNumberFormat('€#,##0.00');
  
  // Colora le righe alternate
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, 20).setBackground('#f3f3f3');
  }
}

// ============================================
// AGGIUNGI A GOOGLE CALENDAR
// ============================================
function addToCalendar(data) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  
  // Converti data da DD-MM-YYYY a oggetto Date
  const [day, month, year] = data.data_festa.split('-').map(Number);
  const startDateTime = new Date(year, month - 1, day);
  
  // Imposta l'orario
  const [hours, minutes] = data.ora.split(':').map(Number);
  startDateTime.setHours(hours, minutes, 0, 0);
  
  // Calcola durata in ore
  let durationHours = 1.5; // default
  if (data.durata === '1h') durationHours = 1;
  else if (data.durata === '1.5h') durationHours = 1.5;
  else if (data.durata === '2h') durationHours = 2;
  else if (data.durata === '2.5h') durationHours = 2.5;
  
  const endDateTime = new Date(startDateTime.getTime() + (durationHours * 60 * 60 * 1000));
  
  // Crea titolo evento
  const title = `🎉 Compleanno ${data.festeggiato} (${data.anni} anni)`;
  
  // Crea descrizione evento
  const description = `
📋 DETTAGLI PRENOTAZIONE

👤 Cliente: ${data.cliente}
📞 Telefono: ${data.telefono}
📧 Email: ${data.email}

🎂 Festeggiato: ${data.festeggiato} (${data.anni} anni)
👥 Partecipanti: ${data.partecipanti}

🍕 Menu: ${data.menu}
${data.patatine === 'Sì' ? '🍟 Con patatine' : ''}
🎂 Torta: ${data.torta}
${data.scritta_torta ? `✍️ Scritta: "${data.scritta_torta}"` : ''}
${data.foto_torta === 'Sì' ? '📸 Con foto sulla torta' : ''}

🎳 Durata: ${data.durata}

⚠️ Allergie dichiarate: ${data.allergie_dichiarate}

${data.altre_richieste ? `📝 Note: ${data.altre_richieste}` : ''}

💰 Totale: ${data.totale} €
  `.trim();
  
  // Crea l'evento
  const event = calendar.createEvent(title, startDateTime, endDateTime, {
    description: description,
    location: 'Bowling Valdera, Via ToscoRomagnola 127, Fornacette (PI)'
  });
  
  // Aggiungi promemoria
  event.addEmailReminder(3 * 24 * 60); // 3 giorni prima
  event.addPopupReminder(60); // 1 ora prima
  
  Logger.log('Evento creato: ' + event.getId());
}

// ============================================
// INVIA EMAIL DI CONFERMA
// ============================================
function sendConfirmationEmail(data) {
  const subject = `✅ Prenotazione Confermata - Festa di ${data.festeggiato}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
    h2 { color: #667eea; margin-top: 0; }
    .highlight { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 PRENOTAZIONE CONFERMATA!</h1>
    </div>
    
    <div class="content">
      <p>Gentile <strong>${data.cliente}</strong>,</p>
      
      <p>La prenotazione per la festa di compleanno di <strong>${data.festeggiato}</strong> è stata confermata con successo! 🎊</p>
      
      <div class="info-box">
        <h2>📅 Dettagli Evento</h2>
        <p><strong>Data:</strong> ${data.data_festa}</p>
        <p><strong>Orario:</strong> ${data.ora}</p>
        <p><strong>Durata:</strong> ${data.durata}</p>
        <p><strong>Partecipanti:</strong> ${data.partecipanti} persone</p>
      </div>
      
      <div class="info-box">
        <h2>🍕 Menu e Servizi</h2>
        <p><strong>Pacchetto:</strong> ${data.menu}</p>
        ${data.patatine === 'Sì' ? '<p>🍟 Con patatine fritte</p>' : ''}
        <p><strong>Torta:</strong> ${data.torta}</p>
        ${data.scritta_torta ? `<p><strong>Scritta torta:</strong> "${data.scritta_torta}"</p>` : ''}
        ${data.foto_torta === 'Sì' ? '<p>📸 Con foto sulla torta</p>' : ''}
      </div>
      
      ${data.allergie_dichiarate === 'Confermato' ? `
      <div class="highlight">
        <strong>⚠️ IMPORTANTE:</strong> Avete confermato l'obbligo di comunicare eventuali allergie o intolleranze alimentari.
        Se presenti, vi preghiamo di comunicarle al numero sottostante.
      </div>
      ` : ''}
      
      <div class="info-box">
        <h2>💰 Riepilogo Costi</h2>
        <p style="font-size: 1.5em; color: #667eea;"><strong>Totale: ${data.totale} €</strong></p>
      </div>
      
      <div class="info-box">
        <h2>📍 Dove Siamo</h2>
        <p><strong>Bowling Valdera</strong></p>
        <p>Via ToscoRomagnola, 127<br>Fornacette (PI)</p>
        <p>📞 <a href="tel:0587420120">0587 420120</a></p>
        <p>🌐 <a href="https://www.bowlingvaldera.com">www.bowlingvaldera.com</a></p>
      </div>
      
      ${data.altre_richieste ? `
      <div class="info-box">
        <h2>📝 Note Aggiuntive</h2>
        <p>${data.altre_richieste}</p>
      </div>
      ` : ''}
      
      <p style="margin-top: 30px;">Non vediamo l'ora di festeggiare insieme! 🎳🎂</p>
    </div>
    
    <div class="footer">
      <p>Questa email è stata generata automaticamente.</p>
      <p>Per qualsiasi modifica o informazione, chiamaci al 0587 420120</p>
      <p>&copy; ${new Date().getFullYear()} Bowling Valdera - Tutti i diritti riservati</p>
    </div>
  </div>
</body>
</html>
  `;
  
  // Invia email
  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    name: 'Bowling Valdera',
    replyTo: EMAIL_FROM
  });
  
  Logger.log('Email inviata a: ' + data.email);
}
