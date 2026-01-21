// ================================================
// GOOGLE APPS SCRIPT - VERSIONE FINALE CONFIGURATA
// ✅ PRONTO DA USARE - ID GIÀ CONFIGURATO
// ================================================

// ⚙️ CONFIGURAZIONE - GIÀ IMPOSTATA!
const SPREADSHEET_ID = '1O_0-qpQFpEby4LsLlyC8xUwFLwrixd_-tNIrMeuA9Ro';
const SHEET_NAME = 'Prenotazioni';
const CALENDAR_ID = 'primary';
const EMAIL_FROM = 'info@bowlingvaldera.it';

// ================================================
// GET: Controlla Disponibilità
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
// POST: Salva Prenotazione
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
  
  const row = [
    new Date(),
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
    data.gdpr || 'No',
    data.marketing || 'No',
    data.totale || '0'
  ];
  
  sheet.appendRow(row);
  const lastRow = sheet.getLastRow();
  
  // Formatta € nella colonna Totale (19 = S)
  sheet.getRange(lastRow, 19).setNumberFormat('€#,##0.00');
  
  if (lastRow % 2 === 0) {
    sheet.getRange(lastRow, 1, 1, 19).setBackground('#f3f3f3');
  }
}

// ================================================
// CREA EVENTO CALENDAR
// ================================================
function addToCalendar(data) {
  try {
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const [day, month, year] = data.data_festa.split('-').map(Number);
    const startDateTime = new Date(year, month - 1, day);
    const [hours, minutes] = data.ora.split(':').map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
    
    let durationHours = 1.5;
    if (data.durata === '1h') durationHours = 1;
    else if (data.durata === '1.5h') durationHours = 1.5;
    else if (data.durata === '2h') durationHours = 2;
    else if (data.durata === '2.5h') durationHours = 2.5;
    
    const endDateTime = new Date(startDateTime.getTime() + (durationHours * 60 * 60 * 1000));
    const title = `🎉 Compleanno ${data.festeggiato} (${data.anni} anni)`;
    
    const description = `
📋 DETTAGLI

👤 ${data.cliente}
📞 ${data.telefono}
📧 ${data.email}

🎂 ${data.festeggiato} (${data.anni} anni)
👥 ${data.partecipanti} persone

🍕 ${data.menu}
${data.patatine === 'Sì' ? '🍟 Patatine' : ''}
🎂 ${data.torta}
${data.scritta_torta ? `✍️ "${data.scritta_torta}"` : ''}
${data.foto_torta === 'Sì' ? '📸 Con foto' : ''}

🎳 ${data.durata}
${data.altre_richieste ? `📝 ${data.altre_richieste}` : ''}

💰 ${data.totale} €
    `.trim();
    
    const event = calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: 'Bowling Valdera, Via ToscoRomagnola 127, Fornacette (PI)'
    });
    
    event.addEmailReminder(3 * 24 * 60);
    event.addPopupReminder(60);
    
    Logger.log('Evento creato: ' + event.getId());
  } catch (error) {
    Logger.log('Errore Calendar: ' + error.toString());
  }
}

// ================================================
// INVIA EMAIL
// ================================================
function sendConfirmationEmail(data) {
  try {
    const subject = `✅ Prenotazione Confermata - Festa di ${data.festeggiato}`;
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
<style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
.container{max-width:600px;margin:0 auto;padding:20px}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
.content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
.info-box{background:#fff;padding:20px;margin:20px 0;border-left:4px solid #667eea;border-radius:5px}
h2{color:#667eea;margin-top:0}
.footer{text-align:center;padding:20px;color:#666;font-size:.9em}
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>🎉 PRENOTAZIONE CONFERMATA!</h1></div>
<div class="content">
<p>Gentile <strong>${data.cliente}</strong>,</p>
<p>La prenotazione per la festa di <strong>${data.festeggiato}</strong> è confermata! 🎊</p>
<div class="info-box">
<h2>📅 Dettagli</h2>
<p><strong>Data:</strong> ${data.data_festa}</p>
<p><strong>Orario:</strong> ${data.ora}</p>
<p><strong>Partecipanti:</strong> ${data.partecipanti}</p>
</div>
<div class="info-box">
<h2>🍕 Menu</h2>
<p><strong>Pacchetto:</strong> ${data.menu}</p>
${data.patatine === 'Sì' ? '<p>🍟 Patatine</p>' : ''}
<p><strong>Torta:</strong> ${data.torta}</p>
${data.scritta_torta ? `<p><strong>Scritta:</strong> "${data.scritta_torta}"</p>` : ''}
${data.foto_torta === 'Sì' ? '<p>📸 Con foto</p>' : ''}
</div>
<div class="info-box">
<h2>💰 Totale</h2>
<p style="font-size:1.5em;color:#667eea"><strong>${data.totale} €</strong></p>
</div>
<div class="info-box">
<h2>📍 Dove</h2>
<p><strong>Bowling Valdera</strong><br>Via ToscoRomagnola 127, Fornacette (PI)<br>☎️ 0587 420120</p>
</div>
<p style="margin-top:30px">Ci vediamo! 🎳🎂</p>
</div>
<div class="footer">
<p>Per modifiche: 0587 420120</p>
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
    Logger.log('Errore Email: ' + error.toString());
  }
}
