// ================================================
// GOOGLE APPS SCRIPT - VERSIONE COMPLETA E FUNZIONANTE
// Con: Foto Torta + Formattazione € Automatica
// ================================================

// ⚙️ CONFIGURAZIONE - MODIFICA QUESTI VALORI!
const SPREADSHEET_ID = 'IL_TUO_SPREADSHEET_ID';  // ← INSERISCI IL TUO ID QUI!
const SHEET_NAME = 'Prenotazioni';
const CALENDAR_ID = 'primary';
const EMAIL_FROM = 'info@bowlingvaldera.it';

// ================================================
// FUNZIONE GET: Controlla Disponibilità
// ================================================
function doGet(e) {
  try {
    const date = e.parameter.date;
    const time = e.parameter.time;
    
    if (!date || !time) {
      return ContentService.createTextOutput(JSON.stringify({
        available: false,
        error: 'Missing parameters'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const [year, month, day] = date.split('-').map(Number);
    const startDateTime = new Date(year, month - 1, day);
    const [hours, minutes] = time.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
    const endDateTime = new Date(startDateTime.getTime() + (3 * 60 * 60 * 1000));
    
    const events = calendar.getEvents(startDateTime, endDateTime);
    const birthdayEvents = events.filter(event => {
      const title = event.getTitle().toLowerCase();
      return title.includes('compleanno') || title.includes('festa');
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      available: birthdayEvents.length === 0,
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

// ================================================
// FUNZIONE POST: Salva Prenotazione
// ================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    saveToSheet(data);
    addToCalendar(data);
    sendConfirmationEmail(data);
    
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

// ================================================
// SALVA SU GOOGLE SHEETS
// ================================================
function saveToSheet(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Crea foglio se non esiste
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'Timestamp', 'Festeggiato', 'Età', 'Cliente', 'Telefono', 'Email',
      'Data Festa', 'Orario', 'Partecipanti', 'Menu', 'Patatine', 'Torta',
      'Scritta Torta', 'Foto Torta', 'Durata', 'Altre Richieste',
      'GDPR', 'Marketing', 'Totale €'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Prepara la riga con TUTTI i campi nell'ordine corretto
  const row = [
    new Date(),                    // A - Timestamp
    data.festeggiato || '',       // B - Festeggiato
    data.anni || '',              // C - Età
    data.cliente || '',           // D - Cliente
    data.telefono || '',          // E - Telefono
    data.email || '',             // F - Email
    data.data_festa || '',        // G - Data Festa
    data.ora || '',               // H - Orario
    data.partecipanti || '',      // I - Partecipanti
    data.menu || '',              // J - Menu
    data.patatine || 'No',        // K - Patatine
    data.torta || '',             // L - Torta
    data.scritta_torta || '',     // M - Scritta Torta
    data.foto_torta || 'No',      // N - Foto Torta ✅ AGGIUNTO!
    data.durata || '',            // O - Durata
    data.altre_richieste || '',   // P - Altre Richieste
    data.gdpr || 'No',            // Q - GDPR
    data.marketing || 'No',       // R - Marketing
    data.totale || '0'            // S - Totale
  ];
  
  // Aggiungi la riga
  sheet.appendRow(row);
  
  // Ottieni l'ultima riga appena aggiunta
  const lastRow = sheet.getLastRow();
  
  // ✅ FORMATTA IL TOTALE COME € (colonna 19 = S)
  sheet.getRange(lastRow, 19).setNumberFormat('€#,##0.00');
  
  // Colora righe alternate (opzionale)
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, 19).setBackground('#f3f3f3');
  }
  
  Logger.log('Dati salvati su Sheets, riga: ' + lastRow);
}

// ================================================
// AGGIUNGI A GOOGLE CALENDAR
// ================================================
function addToCalendar(data) {
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    
    // Converti data da DD-MM-YYYY a oggetto Date
    const [day, month, year] = data.data_festa.split('-').map(Number);
    const startDateTime = new Date(year, month - 1, day);
    
    // Imposta orario
    const [hours, minutes] = data.ora.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
    
    // Calcola durata
    let durationHours = 1.5;
    if (data.durata === '1h') durationHours = 1;
    else if (data.durata === '1.5h') durationHours = 1.5;
    else if (data.durata === '2h') durationHours = 2;
    else if (data.durata === '2.5h') durationHours = 2.5;
    
    const endDateTime = new Date(startDateTime.getTime() + (durationHours * 60 * 60 * 1000));
    
    // Titolo evento
    const title = `🎉 Compleanno ${data.festeggiato} (${data.anni} anni)`;
    
    // Descrizione dettagliata
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

${data.altre_richieste ? `📝 Note: ${data.altre_richieste}` : ''}

💰 Totale: ${data.totale} €
    `.trim();
    
    // Crea evento
    const event = calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: 'Bowling Valdera, Via ToscoRomagnola 127, Fornacette (PI)'
    });
    
    // Aggiungi promemoria
    event.addEmailReminder(3 * 24 * 60); // 3 giorni prima
    event.addPopupReminder(60); // 1 ora prima
    
    Logger.log('Evento Calendar creato: ' + event.getId());
  } catch (error) {
    Logger.log('Errore creazione Calendar: ' + error.toString());
  }
}

// ================================================
// INVIA EMAIL DI CONFERMA
// ================================================
function sendConfirmationEmail(data) {
  try {
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
    h2 { color: #667eea; margin-top: 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
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
      <p>&copy; ${new Date().getFullYear()} Bowling Valdera</p>
    </div>
  </div>
</body>
</html>
    `;
    
    MailApp.sendEmail({
      to: data.email,
      subject: subject,
      htmlBody: htmlBody,
      name: 'Bowling Valdera',
      replyTo: EMAIL_FROM
    });
    
    Logger.log('Email inviata a: ' + data.email);
  } catch (error) {
    Logger.log('Errore invio email: ' + error.toString());
  }
}
