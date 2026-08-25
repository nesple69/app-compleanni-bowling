// ============================================================
// CONFIGURAZIONE — Costanti globali
// ============================================================

// Token di sicurezza per il backend.
// IMPORTANTE: questo stesso valore deve essere impostato in Apps Script
// come proprietà "API_SECRET" (Impostazioni progetto → Proprietà dello script).
const API_TOKEN = 'BV2026-f8e3a7d2b9c4-k7p1';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzoxNM77DBO4xRQBdz27XmvpFMdh8mQYzqsIbq4aVCKnZGgSkNPDESEadui1jHsLqJDHw/exec';

// Tariffe Bowling per pista
// Lunedì - Giovedì: 30,00 € / ora
const PRICE_PER_LANE_WEEKDAY = {
  '1h': 30,
  '1.5h': 45,
  '2h': 60,
  '2.5h': 75
};

// Venerdì, Sabato e Domenica: 35,00 € / ora
const PRICE_PER_LANE_WEEKEND = {
  '1h': 35,
  '1.5h': 52.5,
  '2h': 70,
  '2.5h': 87.5
};

const MAX_PLAYERS_PER_LANE = 6;

const MENUS = {
  // NOTA: i prezzi qui sono sincronizzati con quelli mostrati nell'HTML.
  'Basic': { name: 'Basic',  price: 10.0  },
  'Smart': { name: 'Smart',  price: 12.5  },
  'Plus':  { name: 'Plus',   price: 11.5  }, // 11,50 €
  'Prime': { name: 'Prime',  price: 15.0  }, // 15,00 €
  'Ultra': { name: 'Ultra',  price: 18.5  }
};
const FRIES_PRICE      = 2.0; // 2,00 €
const CAKE_PHOTO_PRICE = 5.0;

function getPricePerLaneMap() {
  const dateStr = document.getElementById('data')?.value;
  if (!dateStr) return PRICE_PER_LANE_WEEKDAY;

  const [year, month, day] = dateStr.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  const dayOfWeek = selectedDate.getDay(); // 0=Dom, 5=Ven, 6=Sab

  // Venerdì (5), Sabato (6), Domenica (0) -> Weekend (35€/h)
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6);
  return isWeekend ? PRICE_PER_LANE_WEEKEND : PRICE_PER_LANE_WEEKDAY;
}

function updateDurationLabels() {
  const priceMap = getPricePerLaneMap();
  
  const el1h = document.getElementById('price-durata-1h');
  const el15h = document.getElementById('price-durata-1-5h');
  const el2h = document.getElementById('price-durata-2h');
  const el25h = document.getElementById('price-durata-2-5h');

  if (el1h) el1h.textContent = `${priceMap['1h']}€ / Pista`;
  if (el15h) el15h.textContent = `${priceMap['1.5h'].toString().replace('.', ',')}€ / Pista`;
  if (el2h) el2h.textContent = `${priceMap['2h']}€ / Pista`;
  if (el25h) el25h.textContent = `${priceMap['2.5h'].toString().replace('.', ',')}€ / Pista`;
}


// ============================================================
// NAVIGAZIONE
// ============================================================

function startBooking() {
  document.getElementById('welcomeStep').style.display = 'none';
  document.getElementById('bookingSteps').style.display = 'block';
  document.querySelector('header').style.display = 'flex';
  showStep('step2');
  updateRealTimeCost();
}

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
  document.getElementById(stepId).style.display = 'block';

  const stepMap = { step2: 1, step1: 2, step_package: 3, step_cake: 4, step3: 5, step4: 6 };
  const stepNum = stepMap[stepId] || 0;

  for (let i = 1; i <= 6; i++) {
    const ind = document.getElementById('ind' + i);
    if (!ind) continue;
    if (i <= stepNum) ind.classList.add('active');
    else ind.classList.remove('active');
  }
}


// ============================================================
// CALCOLO COSTI IN TEMPO REALE
// ============================================================

function updateRealTimeCost() {
  const partInput = document.getElementById('partecipanti');
  const part = parseInt(partInput.value, 10) || 0;

  let duration = '1.5h';
  document.getElementsByName('durata').forEach(r => { if (r.checked) duration = r.value; });

  let selectedMenuKey = 'Basic';
  document.getElementsByName('pacchetto').forEach(r => { if (r.checked) selectedMenuKey = r.value; });

  const fries     = document.getElementById('patatine').checked;
  const cakePhoto = document.getElementById('foto_torta').checked;

  const step3Visible  = document.getElementById('step3').style.display === 'block';
  const step4Visible  = document.getElementById('step4').style.display === 'block';
  const includeLanes  = step3Visible || step4Visible;

  const pricePerLaneMap = getPricePerLaneMap();
  const lanes    = part > 0 ? Math.ceil(part / MAX_PLAYERS_PER_LANE) : 0;
  const laneCost = includeLanes ? lanes * (pricePerLaneMap[duration] || 0) : 0;

  const menuPrice      = MENUS[selectedMenuKey] ? MENUS[selectedMenuKey].price : 0;
  const friesCost      = fries ? FRIES_PRICE : 0;
  const photoCost      = cakePhoto ? CAKE_PHOTO_PRICE : 0;
  const totalFoodCost  = part * (menuPrice + friesCost);
  const total          = laneCost + totalFoodCost + photoCost;

  document.querySelector('.cost-value').textContent = total.toFixed(2).replace('.', ',') + ' €';

  return { total: total.toFixed(2), lanes, duration, part, selectedMenuKey, fries, cakePhoto };
}


// ============================================================
// RIEPILOGO (Step 4)
// ============================================================

function updateSummaryView() {
  const data     = updateRealTimeCost();
  const menuInfo = MENUS[data.selectedMenuKey];

  const nomeFesteggiato = document.getElementById('festeggiato').value;
  document.getElementById('ticket-name').textContent         = nomeFesteggiato.toUpperCase();
  document.getElementById('ticket-header-event').textContent = `Festa di Compleanno di ${nomeFesteggiato}`;

  const d = document.getElementById('data').value;
  document.getElementById('ticket-date').textContent = d ? d.split('-').reverse().join('/') : '-';

  let time = '';
  document.getElementsByName('fascia_oraria').forEach(r => { if (r.checked) time = r.value; });
  document.getElementById('ticket-time').textContent = time;

  document.getElementById('ticket-lanes').textContent        = data.lanes + ' PISTE';
  document.getElementById('ticket-participants').textContent = data.part;

  const durationLabel = data.duration.toUpperCase().replace('H', ' ORE');
  document.getElementById('ticket-duration').textContent = durationLabel;

  let cake = '';
  document.getElementsByName('torta').forEach(r => { if (r.checked) cake = r.value; });
  const cakeMsg = document.getElementById('scritta_torta').value;

  let menuSummary = menuInfo.name.toUpperCase();
  if (data.fries) menuSummary += '\n+ PATATINE';
  document.getElementById('ticket-menu').textContent  = menuSummary;
  document.getElementById('ticket-menu').style.whiteSpace = 'pre-wrap';

  let cakeSummary = cake.toUpperCase();
  if (cakeMsg)       cakeSummary += `\n("${cakeMsg}")`;
  if (data.cakePhoto) cakeSummary += '\n+ FOTO';
  document.getElementById('ticket-cake').textContent  = cakeSummary;
  document.getElementById('ticket-cake').style.whiteSpace = 'pre-wrap';

  document.getElementById('totalSpan').textContent = data.total;
  return menuSummary;
}


// ============================================================
// VERIFICA DISPONIBILITÀ
// ============================================================

// AbortController a scope di modulo per cancellare richieste obsolete (fix race condition)
let currentAvailabilityController = null;

async function checkAvailability() {
  const dateStr = document.getElementById('data').value;
  const time    = document.querySelector('input[name="fascia_oraria"]:checked')?.value;
  const msg     = document.getElementById('availability-msg');
  const nextBtn = document.getElementById('nextFromStep2ToStep1');

  if (!dateStr || !time) return;

  if (currentAvailabilityController) {
    currentAvailabilityController.abort();
  }
  currentAvailabilityController = new AbortController();
  const controller = currentAvailabilityController;

  msg.textContent          = '⏳ Verifica disponibilità...';
  msg.style.color          = '#fff';
  msg.style.fontSize       = '1.5rem';
  msg.dataset.available    = 'loading';
  nextBtn.disabled         = true;

  // Fix: costruttore locale per evitare il bug del fuso orario UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const date       = new Date(year, month - 1, day);
  const dayOfWeek  = date.getDay();
  const d          = date.getDate();
  const m          = date.getMonth() + 1;

  const now              = new Date();
  const selectedDateTime = new Date(year, month - 1, day);
  const [hours, minutes] = time.split(':').map(Number);
  selectedDateTime.setHours(hours, minutes, 0, 0);
  if (selectedDateTime < now) {
    showUnavailable('Non è possibile prenotare una data/orario già passati. Seleziona una data e orario futuri.');
    return;
  }

  if (dayOfWeek === 3) {
    showUnavailable('Spiacenti, il Mercoledì non accettiamo compleanni.');
    return;
  }

  if (dayOfWeek === 0 && time !== '19:30') {
    showUnavailable('La Domenica accettiamo solo la fascia delle 19:30.');
    return;
  }

  const holidays = ['1-1', '6-1', '25-4', '1-5', '2-6', '15-8', '1-11', '8-12', '25-12', '26-12'];
  if (holidays.includes(`${d}-${m}`)) {
    showUnavailable('Spiacenti, non accettiamo compleanni nei giorni festivi.');
    return;
  }

  let selectedDuration = '1.5';
  document.getElementsByName('durata').forEach(r => {
    if (r.checked) selectedDuration = r.value.replace('h', '');
  });

  const dateParts   = dateStr.split('-');
  const dateItalian = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
  const timeoutId   = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${SCRIPT_URL}?date=${dateItalian}&time=${time}&duration=${selectedDuration}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (controller !== currentAvailabilityController) return;

    const result = await response.json();

    if (result.available) {
      msg.textContent       = '✅ Orario Disponibile!';
      msg.style.color       = '#fff';
      msg.dataset.available = 'true';
      nextBtn.disabled      = false;
    } else {
      showUnavailable("Orario già prenotato. Scegli un'altra fascia o data.");
    }
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') return;
    console.error('Availability check failed', e);
    // Fix: errore di rete NON equivale a disponibile
    msg.textContent       = '⚠️ Servizio non raggiungibile. Riprova o contattaci al 0587 420120.';
    msg.style.color       = 'orange';
    msg.dataset.available = 'error';
    nextBtn.disabled      = true;
  }

  function showUnavailable(text) {
    if (controller !== currentAvailabilityController) return;
    msg.textContent       = '❌ ' + text;
    msg.style.color       = '#fff';
    msg.dataset.available = 'false';
    nextBtn.disabled      = true;
  }
}


// ============================================================
// SALVATAGGIO DATABASE
// ============================================================

// Fix: funzione a scope di modulo (non più intrappolata in closure DOMContentLoaded)
async function saveToDatabase() {
  const nome     = document.getElementById('nome').value;
  const cognome  = document.getElementById('cognome').value;

  const dataFestaRaw    = document.getElementById('data').value;
  const dataFestaItalian = dataFestaRaw ? dataFestaRaw.split('-').reverse().join('-') : '';

  let selectedDuration = '1.5h';
  document.getElementsByName('durata').forEach(r => { if (r.checked) selectedDuration = r.value; });

  const payload = {
    _token:              API_TOKEN,
    festeggiato:         document.getElementById('festeggiato').value,
    anni:                document.getElementById('anni_festeggiato').value,
    cliente:             `${nome} ${cognome}`.trim(),
    telefono:            document.getElementById('telefono').value,
    email:               document.getElementById('email').value.trim(),
    data_festa:          dataFestaItalian,
    ora:                 document.querySelector('input[name="fascia_oraria"]:checked')?.value,
    partecipanti:        document.getElementById('partecipanti').value,
    menu:                document.querySelector('input[name="pacchetto"]:checked')?.value,
    patatine:            document.getElementById('patatine').checked ? 'Sì' : 'No',
    torta:               document.querySelector('input[name="torta"]:checked')?.value,
    scritta_torta:       document.getElementById('scritta_torta').value,
    altre_richieste:     document.getElementById('altre_richieste').value,
    durata:              selectedDuration,
    foto_torta:          document.getElementById('foto_torta').checked ? 'Sì' : 'No',
    allergie_dichiarate: document.getElementById('allergy_declaration').checked ? 'Confermato' : 'No',
    gdpr:                document.getElementById('gdpr_consent').checked ? 'Accettato' : 'No',
    marketing:           document.getElementById('marketing_consent').checked ? 'Sì' : 'No',
    totale:              parseFloat(document.getElementById('totalSpan').textContent.replace(/[€\s]/g, '').replace(',', '.'))
  };

  try {
    // Fix: rimosso mode:'no-cors' — la risposta è ora leggibile e verificabile.
    // Content-Type: text/plain evita il preflight CORS su Apps Script.
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Server error: ' + response.status);

    const text = await response.text();

    // Compatibilità con entrambi i formati:
    // - Vecchio formato (pre-aggiornamento Apps Script): stringa "Success"
    // - Nuovo formato (post-aggiornamento): JSON { success: true }
    if (text.startsWith('{')) {
      const result = JSON.parse(text);
      return result.success === true;
    } else {
      return text.trim() === 'Success';
    }

  } catch (e) {
    console.error('Database save failed', e);
    return false;
  }
}


// ============================================================
// RESET CON COUNTDOWN VISIBILE
// ============================================================

function scheduleReset(delayMs = 8000) {
  let remaining = Math.floor(delayMs / 1000);
  const countdown = document.createElement('p');
  countdown.style.cssText = 'text-align:center; color:#aaa; margin-top:1.5rem; font-size:0.9rem;';
  countdown.textContent = `Ritorno alla home in ${remaining}s`;
  document.getElementById('step_success').appendChild(countdown);

  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(interval);
      location.reload();
    } else {
      countdown.textContent = `Ritorno alla home in ${remaining}s`;
    }
  }, 1000);
}


// ============================================================
// CUSTOM ALERT MODAL
// ============================================================

function showCustomAlert(msg) {
  const modal    = document.getElementById('customAlert');
  const textArea = document.getElementById('alertMessage');
  if (modal && textArea) {
    textArea.textContent = msg;
    modal.style.display  = 'flex';
  }
}

function closeCustomAlert() {
  const modal = document.getElementById('customAlert');
  if (modal) modal.style.display = 'none';
}


// ============================================================
// INIZIALIZZAZIONE — Un unico punto di ingresso
// ============================================================

function init() {

  // --- Costo in tempo reale ---
  document.getElementById('partecipanti').addEventListener('input', updateRealTimeCost);
  document.getElementsByName('durata').forEach(el => el.addEventListener('change', updateRealTimeCost));
  document.getElementsByName('pacchetto').forEach(el => el.addEventListener('change', updateRealTimeCost));
  document.getElementById('patatine').addEventListener('change', updateRealTimeCost);
  document.getElementById('foto_torta').addEventListener('change', updateRealTimeCost);

  // --- Partecipanti minimi dinamici per fascia oraria ---
  const timeSlots = document.getElementsByName('fascia_oraria');
  const partInput = document.getElementById('partecipanti');

  function updateMinParticipants() {
    let selectedTime = '17:00';
    timeSlots.forEach(r => { if (r.checked) selectedTime = r.value; });
    let min = 15;
    if (selectedTime === '18:00') min = 12;
    if (selectedTime === '19:00') min = 10;
    partInput.min = min;
    const currentVal = parseInt(partInput.value, 10);
    if (isNaN(currentVal) || currentVal < min) {
      partInput.value = min;
      updateRealTimeCost();
    }
  }

  timeSlots.forEach(el => el.addEventListener('change', () => {
    updateMinParticipants();
    checkAvailability();
  }));

  // --- Filtro slot orari per data (domenica vs feriale) ---
  document.getElementById('data').addEventListener('change', (e) => {
    // Fix: costruttore locale per evitare il bug del fuso orario UTC
    const [year, month, day] = e.target.value.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayOfWeek    = selectedDate.getDay();

    const weekdaySlots = document.querySelectorAll('.time-card[data-day-type="weekday"]');
    const sundaySlots  = document.querySelectorAll('.time-card[data-day-type="sunday"]');

    if (dayOfWeek === 0) {
      weekdaySlots.forEach(slot => slot.style.display = 'none');
      sundaySlots.forEach(slot => {
        slot.style.display = 'flex';
        slot.querySelector('input').checked = true;
      });
    } else {
      weekdaySlots.forEach(slot => slot.style.display = 'flex');
      sundaySlots.forEach(slot => slot.style.display = 'none');
      const firstWeekdaySlot = document.querySelector('.time-card[data-day-type="weekday"] input');
      if (firstWeekdaySlot) firstWeekdaySlot.checked = true;
    }

    updateMinParticipants();
    updateDurationLabels();
    updateRealTimeCost();
    checkAvailability();
  });

  updateMinParticipants();
  updateDurationLabels();

  // --- Pulsante start ---
  document.getElementById('startBookingBtn').addEventListener('click', startBooking);

  // ----------------------------------------------------------------
  // NAVIGAZIONE AVANTI
  // ----------------------------------------------------------------

  document.getElementById('nextFromStep2ToStep1').addEventListener('click', () => {
    const dataFesta = document.getElementById('data');
    const part      = document.getElementById('partecipanti');
    const msg       = document.getElementById('availability-msg');

    if (!dataFesta.value) {
      showCustomAlert('Per favore, seleziona la data della festa.');
      dataFesta.classList.add('shake');
      setTimeout(() => dataFesta.classList.remove('shake'), 400);
      return;
    }

    const partNum = parseInt(part.value, 10);
    if (isNaN(partNum) || partNum < 1) {
      showCustomAlert('Il numero di partecipanti non è valido.');
      part.classList.add('shake');
      setTimeout(() => part.classList.remove('shake'), 400);
      return;
    }

    let selectedTime = '17:00';
    document.getElementsByName('fascia_oraria').forEach(r => { if (r.checked) selectedTime = r.value; });

    let minRequired = 15;
    if (selectedTime === '18:00') minRequired = 12;
    if (selectedTime === '19:00') minRequired = 10;
    if (selectedTime === '19:30') minRequired = 15;

    if (partNum < minRequired) {
      showCustomAlert(`Per la fascia delle ${selectedTime} il numero minimo è ${minRequired} persone.`);
      part.classList.add('shake');
      setTimeout(() => part.classList.remove('shake'), 400);
      return;
    }

    if (msg.dataset.available === 'false') {
      showCustomAlert("L'orario selezionato non è disponibile. Scegli un'altra data o fascia oraria.");
      return;
    }
    if (msg.dataset.available === 'loading') {
      showCustomAlert('Stiamo ancora verificando la disponibilità. Attendi un momento.');
      return;
    }
    if (msg.dataset.available === 'error') {
      showCustomAlert('Impossibile verificare la disponibilità. Riprova più tardi o contattaci al 0587 420120.');
      return;
    }

    showStep('step1');
    updateRealTimeCost();
  });

  document.getElementById('nextFromStep1ToPackage').addEventListener('click', () => {
    const nome        = document.getElementById('nome');
    const cognome     = document.getElementById('cognome');
    const telefono    = document.getElementById('telefono');
    const festeggiato = document.getElementById('festeggiato');
    const anni        = document.getElementById('anni_festeggiato');
    const email       = document.getElementById('email');

    const requiredFields = [
      [nome,        'Per favore, inserisci il tuo nome.'],
      [cognome,     'Per favore, inserisci il tuo cognome.'],
      [telefono,    'Per favore, inserisci un numero di telefono.'],
      [festeggiato, 'Per favore, inserisci il nome del festeggiato.'],
      [anni,        "Per favore, inserisci l'età del festeggiato."],
      [email,       'Per favore, inserisci un indirizzo email.'],
    ];

    for (const [field, alertMsg] of requiredFields) {
      if (!field.value.trim()) {
        showCustomAlert(alertMsg);
        field.classList.add('shake');
        setTimeout(() => field.classList.remove('shake'), 400);
        return;
      }
    }

    const cleanTel = telefono.value.replace(/\D/g, '');
    if (cleanTel.length < 9) {
      showCustomAlert('Il numero di telefono inserito non sembra corretto (minimo 9 cifre).');
      telefono.classList.add('shake');
      setTimeout(() => telefono.classList.remove('shake'), 400);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value.trim())) {
      showCustomAlert("L'indirizzo email inserito non è nel formato corretto.");
      email.classList.add('shake');
      setTimeout(() => email.classList.remove('shake'), 400);
      return;
    }

    const gdpr = document.getElementById('gdpr_consent');
    if (gdpr && !gdpr.checked) {
      showCustomAlert('Per favore, accetta il trattamento dei dati personali (GDPR) per proseguire.');
      return;
    }

    showStep('step_package');
    updateRealTimeCost();
    document.getElementById('floatingCost').classList.remove('hidden');
  });

  document.getElementById('nextToStepCakePage').addEventListener('click', () => {
    const selected = document.querySelector('input[name="pacchetto"]:checked');
    if (!selected) {
      showCustomAlert('Per favore, seleziona un pacchetto menu.');
      return;
    }
    const allergyCheck = document.getElementById('allergy_declaration');
    if (!allergyCheck.checked) {
      showCustomAlert("Per favore, conferma di aver letto l'informativa sulle allergie e intolleranze alimentari.");
      allergyCheck.parentElement.classList.add('shake');
      setTimeout(() => allergyCheck.parentElement.classList.remove('shake'), 400);
      return;
    }
    showStep('step_cake');
    updateRealTimeCost();
  });

  document.getElementById('nextToStepCake').addEventListener('click', () => {
    const selected = document.querySelector('input[name="torta"]:checked');
    if (!selected) {
      showCustomAlert('Per favore, seleziona una torta.');
      return;
    }
    showStep('step3');
    updateRealTimeCost();
  });

  document.getElementById('nextToStep4').addEventListener('click', () => {
    const selected = document.querySelector('input[name="durata"]:checked');
    if (!selected) {
      showCustomAlert('Per favore, seleziona la durata della festa.');
      return;
    }
    updateSummaryView();
    showStep('step4');
  });

  // ----------------------------------------------------------------
  // NAVIGAZIONE INDIETRO
  // ----------------------------------------------------------------
  document.getElementById('backFromStep2ToWelcome').addEventListener('click', () => {
    document.getElementById('bookingSteps').style.display = 'none';
    document.getElementById('welcomeStep').style.display  = 'block';
    document.querySelector('header').style.display        = 'none';
  });

  document.getElementById('backFromStep1ToStep2').addEventListener('click', () => showStep('step2'));

  document.getElementById('backFromPackageToStep1').addEventListener('click', () => {
    showStep('step1');
    document.getElementById('floatingCost').classList.add('hidden');
  });

  document.getElementById('backToStepPackage').addEventListener('click', () => {
    showStep('step_package');
    updateRealTimeCost();
  });

  document.getElementById('backToStepCakePage').addEventListener('click', () => {
    showStep('step_cake');
    updateRealTimeCost();
  });

  document.getElementById('backToStep3').addEventListener('click', () => {
    showStep('step3');
    updateRealTimeCost();
  });

  // ----------------------------------------------------------------
  // CONFERMA PRENOTAZIONE
  // ----------------------------------------------------------------
  const confirmBtn = document.getElementById('confirmBooking');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled    = true;
      confirmBtn.textContent = 'Salvataggio in corso...';

      const success = await saveToDatabase();

      if (success) {
        showStep('step_success');
        document.getElementById('floatingCost').classList.add('hidden');
      } else {
        showCustomAlert('Ops! Qualcosa è andato storto nel salvataggio. Riprova tra un momento.');
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Conferma Prenotazione';
      }
    });
  }

  // ----------------------------------------------------------------
  // INVITO WHATSAPP
  // ----------------------------------------------------------------
  const sendInviteBtn = document.getElementById('sendInviteWa');
  if (sendInviteBtn) {
    sendInviteBtn.addEventListener('click', () => {
      const festeggiato = document.getElementById('festeggiato').value;
      const clientTel   = document.getElementById('telefono').value;
      const date        = document.getElementById('ticket-date').textContent;
      const time        = document.getElementById('ticket-time').textContent;

      const inviteMsg =
        `*INVITO ALLA FESTA DI ${festeggiato.toUpperCase()}!* 🎳🎉\n\n` +
        `Ciao! Sei invitato alla mia festa di compleanno al *Bowling Valdera*!\n\n` +
        `📅 *Quando:* ${date}\n` +
        `🕔 *Orario:* ${time}\n` +
        `📍 *Dove:* Via ToscoRomagnola, 127, Fornacette (PI)\n\n` +
        `📞 *Info locale:* 0587 420120\n` +
        `🌐 *Sito:* www.bowlingvaldera.com\n\n` +
        `Ti aspetto per strike, musica e tanto divertimento! 🍕🎂🎳`;

      // Fix: normalizzazione numero telefono robusta
      const cleanTel = clientTel.replace(/\D/g, '');
      let finalTel;
      if (cleanTel.startsWith('39') && cleanTel.length >= 11) {
        finalTel = cleanTel;
      } else if (cleanTel.startsWith('0')) {
        finalTel = '39' + cleanTel.slice(1);
      } else {
        finalTel = '39' + cleanTel;
      }

      const waUrl = `https://api.whatsapp.com/send?phone=${finalTel}&text=${encodeURIComponent(inviteMsg)}`;
      window.open(waUrl, '_blank');

      scheduleReset(8000);
    });
  }

  // ----------------------------------------------------------------
  // SKIP INVITO
  // ----------------------------------------------------------------
  const skipInviteBtn = document.getElementById('skipInviteWa');
  if (skipInviteBtn) {
    skipInviteBtn.addEventListener('click', () => {
      scheduleReset(8000);
    });
  }

}

// ============================================================
// AVVIO APPLICAZIONE — Un unico DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', init);
