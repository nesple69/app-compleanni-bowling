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

  // Hidden initially: document.getElementById('floatingCost').classList.remove('hidden');

  updateRealTimeCost();
}

// Navigation
function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
  document.getElementById(stepId).style.display = 'block';

  // Update Indicators
  let stepNum = 0;
  if (stepId === 'step1') stepNum = 1;
  if (stepId === 'step2') stepNum = 2;
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
document.getElementById('nextToStep2').addEventListener('click', () => {
  const nome = document.getElementById('nome');
  const cognome = document.getElementById('cognome');
  const telefono = document.getElementById('telefono');
  const festeggiato = document.getElementById('festeggiato');
  const anni = document.getElementById('anni_festeggiato');
  const email = document.getElementById('email');

  let valid = true;
  [nome, cognome, telefono, festeggiato, anni, email].forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      valid = false;
    }
  });

  // Specific format checks if basic empty check passed
  if (valid) {
    // Phone: check for at least 9 digits
    const cleanTel = telefono.value.replace(/\D/g, '');
    if (cleanTel.length < 9) {
      alert("Per favore, inserisci un numero di telefono valido.");
      telefono.classList.add('shake');
      setTimeout(() => telefono.classList.remove('shake'), 400);
      valid = false;
    }
    // Email: basic regex check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value.trim())) {
      alert("Per favore, inserisci un indirizzo email valido.");
      email.classList.add('shake');
      setTimeout(() => email.classList.remove('shake'), 400);
      valid = false;
    }
  }

  if (valid) showStep('step2');
});

document.getElementById('nextToStepPackage').addEventListener('click', () => {
  const dataFesta = document.getElementById('data');
  const part = document.getElementById('partecipanti');
  const msg = document.getElementById('availability-msg');

  let valid = true;
  if (!dataFesta.value) {
    dataFesta.classList.add('shake');
    setTimeout(() => dataFesta.classList.remove('shake'), 400);
    valid = false;
  }
  if (!part.value || part.value < 1) {
    part.classList.add('shake');
    setTimeout(() => part.classList.remove('shake'), 400);
    valid = false;
  }

  if (!valid) return;

  if (msg.dataset.available === 'false') {
    msg.classList.add('shake');
    setTimeout(() => msg.classList.remove('shake'), 400);
    return;
  }

  showStep('step_package');
  updateRealTimeCost();
  document.getElementById('floatingCost').classList.remove('hidden');
});

// From Package to Cake
document.getElementById('nextToStepCakePage').addEventListener('click', () => {
  const selected = document.querySelector('input[name="pacchetto"]:checked');
  if (!selected) {
    alert("Per favore, seleziona un pacchetto menu.");
    return;
  }
  showStep('step_cake');
  updateRealTimeCost();
});

// From Cake to Duration
document.getElementById('nextToStepCake').addEventListener('click', () => {
  const selected = document.querySelector('input[name="torta"]:checked');
  if (!selected) {
    alert("Per favore, seleziona una torta.");
    return;
  }
  showStep('step3'); // Duration
  updateRealTimeCost();
});

document.getElementById('nextToStep4').addEventListener('click', () => {
  const selected = document.querySelector('input[name="durata"]:checked');
  if (!selected) {
    alert("Per favore, seleziona la durata della festa.");
    return;
  }
  updateSummaryView();
  showStep('step4');
});

// Back Handlers
document.getElementById('backToStep1').addEventListener('click', () => showStep('step1'));
document.getElementById('backToStep2').addEventListener('click', () => {
  showStep('step2');
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
    if (selectedTime === '19:00' || selectedTime === '19:30') min = 10;

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
  document.getElementById('data').addEventListener('change', checkAvailability);

  updateMinParticipants(); // Initial check
});

// Check Availability
async function checkAvailability() {
  const dateStr = document.getElementById('data').value;
  const time = document.querySelector('input[name="fascia_oraria"]:checked')?.value;
  const msg = document.getElementById('availability-msg');
  const nextBtn = document.getElementById('nextToStepPackage');

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
  const scriptUrl = 'https://script.google.com/macros/s/AKfycby20BCzZh88i1EzB2LqKX_BLikKHHZtCmEGQpd_GQ9q-4GGwIP9qO1vvg1Eo41o9wtY/exec';
  try {
    const response = await fetch(`${scriptUrl}?date=${dateStr}&time=${time}`);
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
    console.error("Availability check failed", e);
    // Fallback if script not updated yet
    msg.textContent = "⚠️ Impossibile verificare disponibilità (aggiorna lo script di Google)";
    msg.style.color = "orange";
    msg.dataset.available = "true"; // Allow proceeding for now to avoid blocking
    nextBtn.disabled = false;
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
      } else {
        alert("Ops! Qualcosa è andato storto nel salvataggio. Riprova tra un momento.");
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
    });
  }

  async function saveToDatabase() {
    const nome = document.getElementById('nome').value;
    const cognome = document.getElementById('cognome').value;
    const data = {
      festeggiato: document.getElementById('festeggiato').value,
      anni: (document.getElementById('anni_festeggiato') || { value: '' }).value,
      cliente: `${nome} ${cognome}`.trim(),
      telefono: document.getElementById('telefono').value,
      email: document.getElementById('email').value.trim(),
      data_festa: document.getElementById('data').value,
      ora: document.querySelector('input[name="fascia_oraria"]:checked')?.value,
      partecipanti: document.getElementById('partecipanti').value,
      menu: document.querySelector('input[name="pacchetto"]:checked')?.value,
      patatine: document.getElementById('patatine').checked ? 'Sì' : 'No',
      torta: document.querySelector('input[name="torta"]:checked')?.value,
      scritta_torta: document.getElementById('scritta_torta').value,
      altre_richieste: document.getElementById('altre_richieste').value,
      durata: document.querySelector('input[name="durata"]:checked')?.value,
      foto_torta: document.getElementById('foto_torta').checked ? 'Sì' : 'No',
      totale: document.getElementById('totalSpan').textContent
    };

    const scriptUrl = 'https://script.google.com/macros/s/AKfycby20BCzZh88i1EzB2LqKX_BLikKHHZtCmEGQpd_GQ9q-4GGwIP9qO1vvg1Eo41o9wtY/exec';

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
