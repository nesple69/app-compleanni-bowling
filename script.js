// Floating Animation Logic - DISABLED per richiesta utente
/*
const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];
const floatingImages = [
  'pin.png',
  'ball.png', 
  'cake.png',
  'pizza.png'
];

function createFloatingObject() {
  const container = document.getElementById('balloon-container');
  if (!container) return;

  const rand = Math.random();
  let el;

  // 40% Balloon, 60% PNG Images
  if (rand < 0.4) {
    el = document.createElement('div');
    el.className = 'balloon';
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.backgroundColor = color;
  } else {
    // PNG Image (pin, ball, cake, or pizza)
    el = document.createElement('img');
    el.src = floatingImages[Math.floor(Math.random() * floatingImages.length)];
    el.className = 'floating-image';
  }

  el.style.left = Math.random() * 95 + 'vw';
  el.style.animationDuration = (Math.random() * 5 + 6) + 's';

  container.appendChild(el);
  setTimeout(() => el.remove(), 11000);
}

setInterval(createFloatingObject, 600);
*/


// Booking Logic
const PRICE_PER_LANE = {
  '1h': 34,
  '1.5h': 50,
  '2h': 65,
  '2.5h': 77
};
const MAX_PLAYERS_PER_LANE = 6;

// Start Booking
// Start Booking
function startBooking() {
  document.getElementById('welcomeStep').style.display = 'none';
  document.getElementById('bookingSteps').style.display = 'block';

  // Show Header
  document.querySelector('header').style.display = 'flex';

  // Start with Step 2 (Availability)
  showStep('step2');

  updateRealTimeCost();
}

// Navigation
function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
  document.getElementById(stepId).style.display = 'block';

  // Update Indicators
  let stepNum = 0;
  if (stepId === 'step2') stepNum = 1;
  if (stepId === 'step1') stepNum = 2;
  if (stepId === 'step_package') stepNum = 3;
  if (stepId === 'step_cake') stepNum = 4;
  if (stepId === 'step3') stepNum = 5;
  if (stepId === 'step4') stepNum = 6;

  for (let i = 1; i <= 6; i++) {
    const ind = document.getElementById('ind' + i);
    if (!ind) continue;
    if (i <= stepNum) ind.classList.add('active');
    else ind.classList.remove('active');
  }
}

// Next Step Handlers
// Step 1 (Contact) -> Step Package
document.getElementById('nextFromStep1ToPackage').addEventListener('click', () => {
  const nome = document.getElementById('nome');
  const cognome = document.getElementById('cognome');
  const telefono = document.getElementById('telefono');
  const festeggiato = document.getElementById('festeggiato');
  const anni = document.getElementById('anni_festeggiato');
  const email = document.getElementById('email');

  // VALIDAZIONI TEMPORANEAMENTE DISATTIVATE
  /* 
  // Basic "Empty" check with descriptive alerts
  if (!nome.value.trim()) {
    showCustomAlert("Per favore, inserisci il tuo nome.");
    nome.classList.add('shake');
    setTimeout(() => nome.classList.remove('shake'), 400);
    return;
  }
  if (!cognome.value.trim()) {
    showCustomAlert("Per favore, inserisci il tuo cognome.");
    cognome.classList.add('shake');
    setTimeout(() => cognome.classList.remove('shake'), 400);
    return;
  }
  if (!telefono.value.trim()) {
    showCustomAlert("Per favore, inserisci un numero di telefono.");
    telefono.classList.add('shake');
    setTimeout(() => telefono.classList.remove('shake'), 400);
    return;
  }
  if (!festeggiato.value.trim()) {
    showCustomAlert("Per favore, inserisci il nome del festeggiato.");
    festeggiato.classList.add('shake');
    setTimeout(() => festeggiato.classList.remove('shake'), 400);
    return;
  }
  if (!anni.value.trim()) {
    showCustomAlert("Per favore, inserisci quanti anni compie il festeggiato.");
    anni.classList.add('shake');
    setTimeout(() => anni.classList.remove('shake'), 400);
    return;
  }
  if (!email.value.trim()) {
    showCustomAlert("Per favore, inserisci un indirizzo email.");
    email.classList.add('shake');
    setTimeout(() => email.classList.remove('shake'), 400);
    return;
  }

  // Format checks
  const cleanTel = telefono.value.replace(/\D/g, '');
  if (cleanTel.length < 9) {
    showCustomAlert("Il numero di telefono inserito non sembra corretto (minimo 9 cifre).");
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
  if (!gdpr.checked) {
    showCustomAlert("Per favore, accetta il trattamento dei dati personali (GDPR) per proseguire.");
    gdpr.classList.add('shake');
    setTimeout(() => gdpr.classList.remove('shake'), 400);
    return;
  }
  */

  showStep('step_package');
  updateRealTimeCost();
  document.getElementById('floatingCost').classList.remove('hidden');
});

// Step 2 (Availability) -> Step 1 (Contact)
document.getElementById('nextFromStep2ToStep1').addEventListener('click', () => {
  const dataFesta = document.getElementById('data');
  const part = document.getElementById('partecipanti');
  const msg = document.getElementById('availability-msg');

  // VALIDAZIONI TEMPORANEAMENTE DISATTIVATE
  /*
  let valid = true;
  if (!dataFesta.value) {
    showCustomAlert("Per favore, seleziona la data della festa.");
    dataFesta.classList.add('shake');
    setTimeout(() => dataFesta.classList.remove('shake'), 400);
    valid = false;
  }
  if (!part.value || part.value < 1) {
    showCustomAlert("Il numero di partecipanti non è valido.");
    part.classList.add('shake');
    setTimeout(() => part.classList.remove('shake'), 400);
    valid = false;
  }

  if (!valid) return;

  // Check minimum participants based on time slot
  let selectedTime = '17:00';
  document.getElementsByName('fascia_oraria').forEach(r => { if (r.checked) selectedTime = r.value; });

  let minRequired = 15; // default for 17:00
  if (selectedTime === '18:00') minRequired = 12;
  if (selectedTime === '19:00') minRequired = 10;

  if (parseInt(part.value) < minRequired) {
    showCustomAlert(`Per l'orario delle ${selectedTime} sono richiesti almeno ${minRequired} partecipanti.`);
    part.classList.add('shake');
    setTimeout(() => part.classList.remove('shake'), 400);
    return;
  }

  if (msg.dataset.available === 'false') {
    showCustomAlert("L'orario selezionato non è più disponibile. Per favore, cambialo.");
    msg.classList.add('shake');
    setTimeout(() => msg.classList.remove('shake'), 400);
    return;
  }
  */

  showStep('step1');
  updateRealTimeCost();
});

// From Package to Cake
document.getElementById('nextToStepCakePage').addEventListener('click', () => {
  const selected = document.querySelector('input[name="pacchetto"]:checked');
  if (!selected) {
    showCustomAlert("Per favore, seleziona un pacchetto menu.");
    return;
  }

  // Check allergy declaration
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

// From Cake to Duration
document.getElementById('nextToStepCake').addEventListener('click', () => {
  const selected = document.querySelector('input[name="torta"]:checked');
  if (!selected) {
    showCustomAlert("Per favore, seleziona una torta.");
    return;
  }
  showStep('step3'); // Duration
  updateRealTimeCost();
});

document.getElementById('nextToStep4').addEventListener('click', () => {
  const selected = document.querySelector('input[name="durata"]:checked');
  if (!selected) {
    showCustomAlert("Per favore, seleziona la durata della festa.");
    return;
  }
  updateSummaryView();
  showStep('step4');
});

// Back Handlers
document.getElementById('backFromStep2ToWelcome').addEventListener('click', () => {
  document.getElementById('bookingSteps').style.display = 'none';
  document.getElementById('welcomeStep').style.display = 'block';
  document.querySelector('header').style.display = 'none';
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
  updateRealTimeCost(); // Remove lanes cost
});
document.getElementById('backToStep3').addEventListener('click', () => {
  showStep('step3');
  updateRealTimeCost();
});

// Cost Calculation

const MENUS = {
  'Basic': { name: 'Basic', price: 10.0 },
  'Smart': { name: 'Smart', price: 12.5 },
  'Plus': { name: 'Plus', price: 12.5 },
  'Prime': { name: 'Prime', price: 15.5 },
  'Ultra': { name: 'Ultra', price: 18.5 }
};
const FRIES_PRICE = 2.5;
const CAKE_PHOTO_PRICE = 5.0;

// Cost Calculation
function updateRealTimeCost() {
  const partInput = document.getElementById('partecipanti');
  const part = parseInt(partInput.value) || 0;

  // Get Duration
  let duration = '1.5h'; // default
  document.getElementsByName('durata').forEach(r => {
    if (r.checked) duration = r.value;
  });

  // Get Menu
  let selectedMenuKey = 'Basic';
  document.getElementsByName('pacchetto').forEach(r => {
    if (r.checked) selectedMenuKey = r.value;
  });

  // Get Fries
  const fries = document.getElementById('patatine').checked;
  // Get Cake Photo
  const cakePhoto = document.getElementById('foto_torta').checked;

  // Check valid steps for Lane Cost
  const step3Visible = document.getElementById('step3').style.display === 'block';
  const step4Visible = document.getElementById('step4').style.display === 'block';
  const includeLanes = step3Visible || step4Visible;

  // Logic Calculations
  const lanes = part > 0 ? Math.ceil(part / MAX_PLAYERS_PER_LANE) : 0;

  let laneCost = 0;
  if (includeLanes) {
    laneCost = lanes * (PRICE_PER_LANE[duration] || 0);
  }

  const menuPrice = MENUS[selectedMenuKey] ? MENUS[selectedMenuKey].price : 0;
  const friesCost = fries ? FRIES_PRICE : 0;
  const photoCost = cakePhoto ? CAKE_PHOTO_PRICE : 0;

  const foodCostPerPerson = menuPrice + friesCost;
  const totalFoodCost = part * foodCostPerPerson;

  const total = laneCost + totalFoodCost + photoCost;

  // Update Floating Badge
  document.querySelector('.cost-value').textContent = total.toFixed(2).replace('.', ',') + ' €';

  return { total: total.toFixed(2), lanes, duration, part, selectedMenuKey, fries, cakePhoto };
}

// Listeners for Cost Update
document.addEventListener('DOMContentLoaded', () => {
  // Initial call
  document.getElementById('partecipanti').addEventListener('input', updateRealTimeCost);
  document.getElementsByName('durata').forEach(el => el.addEventListener('change', updateRealTimeCost));
  document.getElementsByName('pacchetto').forEach(el => el.addEventListener('change', updateRealTimeCost));
  document.getElementById('patatine').addEventListener('change', updateRealTimeCost);
  document.getElementById('foto_torta').addEventListener('change', updateRealTimeCost);

  // Dynamic Minimum Participants based on Time Slot
  const timeSlots = document.getElementsByName('fascia_oraria');
  const partInput = document.getElementById('partecipanti');

  function updateMinParticipants() {
    let selectedTime = '17:00';
    timeSlots.forEach(r => { if (r.checked) selectedTime = r.value; });

    let min = 15; // default for 17:00
    if (selectedTime === '18:00') min = 12;
    if (selectedTime === '19:00') min = 10;

    partInput.min = min;
    if (parseInt(partInput.value) < min) {
      partInput.value = min;
      updateRealTimeCost();
    }
  }

  timeSlots.forEach(el => el.addEventListener('change', () => {
    updateMinParticipants();
    checkAvailability();
  }));

  // Filter time slots based on selected date (Sunday vs weekdays)
  document.getElementById('data').addEventListener('change', (e) => {
    const selectedDate = new Date(e.target.value);
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday

    const weekdaySlots = document.querySelectorAll('.time-card[data-day-type="weekday"]');
    const sundaySlots = document.querySelectorAll('.time-card[data-day-type="sunday"]');

    if (dayOfWeek === 0) {
      // Sunday: hide weekday slots, show Sunday slot
      weekdaySlots.forEach(slot => slot.style.display = 'none');
      sundaySlots.forEach(slot => {
        slot.style.display = 'flex';
        slot.querySelector('input').checked = true; // Auto-select 19:30
      });
    } else {
      // Weekday: show weekday slots, hide Sunday slot
      weekdaySlots.forEach(slot => slot.style.display = 'flex');
      sundaySlots.forEach(slot => slot.style.display = 'none');
      // Re-check first weekday slot if Sunday was selected
      const firstWeekdaySlot = document.querySelector('.time-card[data-day-type="weekday"] input');
      if (firstWeekdaySlot) firstWeekdaySlot.checked = true;
    }

    updateMinParticipants();
    checkAvailability();
  });

  updateMinParticipants(); // Initial check
});

// Check Availability
async function checkAvailability() {
  const dateStr = document.getElementById('data').value;
  const time = document.querySelector('input[name="fascia_oraria"]:checked')?.value;
  const msg = document.getElementById('availability-msg');
  const nextBtn = document.getElementById('nextFromStep2ToStep1');

  if (!dateStr || !time) return;

  msg.textContent = "⏳ Verifica disponibilità...";
  msg.style.color = "#fff";
  msg.style.fontSize = "1.5rem";
  msg.dataset.available = "loading";
  nextBtn.disabled = true;

  const date = new Date(dateStr);
  const day = date.getDay(); // 0=Sun, 3=Wed
  const d = date.getDate();
  const m = date.getMonth() + 1;

  // 0. Rule: No past dates or past times
  const now = new Date();
  const selectedDateTime = new Date(dateStr);

  // Extract hour from time string (e.g., "17:00" -> 17)
  const [hours, minutes] = time.split(':').map(Number);
  selectedDateTime.setHours(hours, minutes, 0, 0);

  // Check if selected date+time is in the past
  if (selectedDateTime < now) {
    showUnavailable("Non è possibile prenotare una data/orario già passati. Seleziona una data e orario futuri.");
    return;
  }

  // 1. Rule: No Wednesday
  if (day === 3) {
    showUnavailable("Spiacenti, il Mercoledì non accettiamo compleanni.");
    return;
  }

  // 2. Rule: Sunday only at 19:30
  if (day === 0 && time !== "19:30") {
    showUnavailable("La Domenica accettiamo solo la fascia delle 19:30.");
    return;
  }

  // 3. Rule: Italian Holidays
  const holidays = [
    "1-1", "6-1", "25-4", "1-5", "2-6", "15-8", "1-11", "8-12", "25-12", "26-12"
  ];
  if (holidays.includes(`${d}-${m}`)) {
    showUnavailable("Spiacenti, non accettiamo compleanni nei giorni festivi.");
    return;
  }

  // 4. Calendar Check (Apps Script)
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbxX8Q62YfrjpCc38lDM3478-PEGk-iiG6080RLb5vnt3cYFWIDAq1D4suMoL_RKObkmLw/exec';

  // Convert date to Italian format DD-MM-YYYY for the script
  const dateParts = dateStr.split('-');
  const dateItalian = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

  // Use AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const response = await fetch(`${scriptUrl}?date=${dateItalian}&time=${time}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const result = await response.json();

    if (result.available) {
      msg.textContent = "✅ Orario Disponibile!";
      msg.style.color = "#fff";
      msg.dataset.available = "true";
      nextBtn.disabled = false;
    } else {
      showUnavailable("Orario già prenotato. Scegli un'altra fascia o data.");
    }
  } catch (e) {
    clearTimeout(timeoutId);
    console.error("Availability check failed", e);

    if (e.name === 'AbortError') {
      showUnavailable("Il server non risponde (Timeout). Riprova tra un momento.");
    } else {
      msg.textContent = "⚠️ Impossibile verificare disponibilità (problema di connessione)";
      msg.style.color = "orange";
      msg.dataset.available = "true"; // Allow proceeding as fallback
      nextBtn.disabled = false;
    }
  }

  function showUnavailable(text) {
    msg.textContent = "❌ " + text;
    msg.style.color = "#fff";
    msg.dataset.available = "false";
    nextBtn.disabled = true;
  }
}

function updateSummaryView() {
  const data = updateRealTimeCost();
  const menuInfo = MENUS[data.selectedMenuKey];

  // Populate Ticket
  const nomeFesteggiato = document.getElementById('festeggiato').value;
  document.getElementById('ticket-name').textContent = nomeFesteggiato.toUpperCase();
  document.getElementById('ticket-header-event').textContent = `Festa di Compleanno di ${nomeFesteggiato}`;

  const d = document.getElementById('data').value;
  document.getElementById('ticket-date').textContent = d ? d.split('-').reverse().join('/') : '-';

  // Time
  let time = '';
  document.getElementsByName('fascia_oraria').forEach(r => { if (r.checked) time = r.value; });
  document.getElementById('ticket-time').textContent = time;

  // Lanes
  document.getElementById('ticket-lanes').textContent = data.lanes + ' PISTE';

  // Participants & Duration
  document.getElementById('ticket-participants').textContent = data.part;
  const durationLabel = data.duration === 'a_partita' ? 'A Partita' : data.duration.toUpperCase().replace('H', ' ORE');
  document.getElementById('ticket-duration').textContent = durationLabel;

  // Cake Info
  let cake = '';
  document.getElementsByName('torta').forEach(r => { if (r.checked) cake = r.value; });
  const cakeMsg = document.getElementById('scritta_torta').value;

  // Menu Section
  let menuSummary = menuInfo.name.toUpperCase();
  if (data.fries) menuSummary += '\n+ PATATINE';
  document.getElementById('ticket-menu').textContent = menuSummary;
  document.getElementById('ticket-menu').style.whiteSpace = 'pre-wrap';

  // Cake Section
  let cakeSummary = cake.toUpperCase();
  if (cakeMsg) cakeSummary += `\n("${cakeMsg}")`;
  if (data.cakePhoto) cakeSummary += '\n+ FOTO';
  document.getElementById('ticket-cake').textContent = cakeSummary;
  document.getElementById('ticket-cake').style.whiteSpace = 'pre-wrap';

  // Final Cost
  document.getElementById('totalSpan').textContent = data.total;
  return menuSummary;
}

// Final Actions Handlers
document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('confirmBooking');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      // 1. Show Loading State
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Salvataggio in corso...";

      // 2. Save to Database (Triggers Calendar & Email on Backend)
      const success = await saveToDatabase();

      if (success) {
        // 3. Transition to Success Step
        showStep('step_success');
        document.getElementById('floatingCost').classList.add('hidden');

        // Timer will be triggered by user choice (WhatsApp or Skip button)
      } else {
        showCustomAlert("Ops! Qualcosa è andato storto nel salvataggio. Riprova tra un momento.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Conferma Prenotazione";
      }
    });
  }

  // Invitation Button on Success Step
  const sendInviteBtn = document.getElementById('sendInviteWa');
  if (sendInviteBtn) {
    sendInviteBtn.addEventListener('click', () => {
      const festeggiato = document.getElementById('festeggiato').value;
      const clientTel = document.getElementById('telefono').value;
      const date = document.getElementById('ticket-date').textContent;
      const time = document.getElementById('ticket-time').textContent;

      // Universal WhatsApp Link (Literal Emojis + encodeURIComponent)
      const inviteMsg = `*INVITO ALLA FESTA DI ${festeggiato.toUpperCase()}!* 🎳🎉\n\n` +
        `Ciao! Sei invitato alla mia festa di compleanno al *Bowling Valdera*!\n\n` +
        `📅 *Quando:* ${date}\n` +
        `🕔 *Orario:* ${time}\n` +
        `📍 *Dove:* Via ToscoRomagnola, 127, Fornacette (PI)\n\n` +
        `📞 *Info locale:* 0587 420120\n` +
        `🌐 *Sito:* www.bowlingvaldera.com\n\n` +
        `Ti aspetto per strike, musica e tanto divertimento! 🍕🎂🎳`;

      const cleanTel = clientTel.replace(/\s+/g, '').replace('+', '');
      const finalTel = cleanTel.startsWith('39') ? cleanTel : '39' + cleanTel;

      // Use the older but more robust URL format
      const waUrl = `https://api.whatsapp.com/send?phone=${finalTel}&text=${encodeURIComponent(inviteMsg)}`;

      // Use window.open with _blank to keep the application open in the current tab
      window.open(waUrl, '_blank');

      // Auto-reset after 3 seconds
      setTimeout(() => {
        location.reload();
      }, 3000);
    });
  }

  // Skip Invitation Button
  const skipInviteBtn = document.getElementById('skipInviteWa');
  if (skipInviteBtn) {
    skipInviteBtn.addEventListener('click', () => {
      // Auto-reset after 3 seconds
      setTimeout(() => {
        location.reload();
      }, 3000);
    });
  }

  async function saveToDatabase() {
    const nome = document.getElementById('nome').value;
    const cognome = document.getElementById('cognome').value;

    // Convert date from YYYY-MM-DD to DD-MM-YYYY (Italian format)
    const dataFestaRaw = document.getElementById('data').value;
    const dataFestaItalian = dataFestaRaw ? dataFestaRaw.split('-').reverse().join('-') : '';

    const data = {
      festeggiato: document.getElementById('festeggiato').value,
      anni: (document.getElementById('anni_festeggiato') || { value: '' }).value,
      cliente: `${nome} ${cognome}`.trim(),
      telefono: document.getElementById('telefono').value,
      email: document.getElementById('email').value.trim(),
      data_festa: dataFestaItalian,
      ora: document.querySelector('input[name="fascia_oraria"]:checked')?.value,
      partecipanti: document.getElementById('partecipanti').value,
      menu: document.querySelector('input[name="pacchetto"]:checked')?.value,
      patatine: document.getElementById('patatine').checked ? 'Sì' : 'No',
      torta: document.querySelector('input[name="torta"]:checked')?.value,
      scritta_torta: document.getElementById('scritta_torta').value,
      altre_richieste: document.getElementById('altre_richieste').value,
      durata: document.querySelector('input[name="durata"]:checked')?.value,
      foto_torta: document.getElementById('foto_torta').checked ? 'Sì' : 'No',
      allergie_dichiarate: document.getElementById('allergy_declaration').checked ? 'Confermato' : 'No',
      gdpr: document.getElementById('gdpr_consent').checked ? 'Accettato' : 'No',
      marketing: document.getElementById('marketing_consent').checked ? 'Sì' : 'No',
      totale: document.getElementById('totalSpan').textContent
    };

    const scriptUrl = 'https://script.google.com/macros/s/AKfycbxX8Q62YfrjpCc38lDM3478-PEGk-iiG6080RLb5vnt3cYFWIDAq1D4suMoL_RKObkmLw/exec';

    try {
      // Usiamo 'text/plain' per evitare il preflight CORS che Apps Script non gestisce bene
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      return true;
    } catch (e) {
      console.error("Database save failed", e);
      return false;
    }
  }
});

// Custom Alert Functions
function showCustomAlert(msg) {
  const modal = document.getElementById('customAlert');
  const textArea = document.getElementById('alertMessage');
  if (modal && textArea) {
    textArea.textContent = msg;
    modal.style.display = 'flex';
  }
}

function closeCustomAlert() {
  const modal = document.getElementById('customAlert');
  if (modal) {
    modal.style.display = 'none';
  }
}
