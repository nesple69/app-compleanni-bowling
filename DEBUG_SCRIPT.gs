// FUNZIONE DI DEBUG - AGGIUNGI QUESTA AL TUO GOOGLE APPS SCRIPT
// Serve per testare Calendar e Email senza fare una prenotazione completa

function testCalendarAndEmail() {
  // Dati di test
  const testData = {
    festeggiato: 'Mario',
    anni: '10',
    cliente: 'Rossi Paolo',
    telefono: '3331234567',
    email: 'TUA_EMAIL_DI_TEST@gmail.com',  // ← METTI LA TUA EMAIL
    data_festa: '25-01-2026',
    ora: '19:30',
    partecipanti: '15',
    menu: 'Smart',
    patatine: 'Sì',
    torta: 'Pan di Spagna Chantilly',
    scritta_torta: 'Buon Compleanno Mario',
    foto_torta: 'Sì',
    durata: '1.5h',
    altre_richieste: 'Test',
    allergie_dichiarate: 'Confermato',
    gdpr: 'Accettato',
    marketing: 'Sì',
    totale: '187.50'
  };
  
  console.log('=== INIZIO TEST ===');
  
  try {
    console.log('1. Test creazione evento calendario...');
    addToCalendar(testData);
    console.log('✅ Evento calendario creato!');
  } catch (error) {
    console.log('❌ ERRORE CALENDARIO:');
    console.log(error.toString());
    console.log(error.stack);
  }
  
  try {
    console.log('2. Test invio email...');
    sendConfirmationEmail(testData);
    console.log('✅ Email inviata!');
  } catch (error) {
    console.log('❌ ERRORE EMAIL:');
    console.log(error.toString());
    console.log(error.stack);
  }
  
  console.log('=== FINE TEST ===');
}

// ESEGUI QUESTA FUNZIONE E GUARDA I LOG PER VEDERE DOVE FALLISCE
