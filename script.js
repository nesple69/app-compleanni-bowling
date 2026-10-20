// ============================================================
// CONFIGURAZIONE — Costanti globali
// ============================================================

// Token di sicurezza per il backend.
// IMPORTANTE: questo stesso valore deve essere impostato in Apps Script
// come proprietà "API_SECRET" (Impostazioni progetto → Proprietà dello script).
const API_TOKEN = 'BV2026-f8e3a7d2b9c4-k7p1';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzEwpsUfQzU-1IAOd0c6JPUr_Fct_xL-ivTxpDC7OTAnSSBJu0-DQfS0vNTv8nOrVBgSg/exec';

// Tariffe Bowling per pista (fisse tutti i giorni: 30,00 € / ora a pista)
const PRICE_PER_LANE = {
  '1h': 30,
  '1.5h': 45,
  '2h': 60,
  '2.5h': 75
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
  return PRICE_PER_LANE;
}

function updateDurationLabels() {
  const el1h = document.getElementById('price-durata-1h');
  const el15h = document.getElementById('price-durata-1-5h');
  const el2h = document.getElementById('price-durata-2h');
  const el25h = document.getElementById('price-durata-2-5h');

  if (el1h) el1h.textContent = '30€ / Pista';
  if (el15h) el15h.textContent = '45€ / Pista';
  if (el2h) el2h.textContent = '60€ / Pista';
  if (el25h) el25h.textContent = '75€ / Pista';
}


// ============================================================
// NAVIGAZIONE
// ============================================================

function startBooking() {
  const container = document.querySelector('main.container');
  if (container) container.classList.remove('landing-mode');
  document.getElementById('welcomeStep').style.display = 'none';
  document.getElementById('bookingSteps').style.display = 'block';
  document.querySelector('header').style.display = 'flex';
  showStep('step2');
  updateRealTimeCost();
}

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.style.display = 'none');
  const target = document.getElementById(stepId);
  if (target) target.style.display = 'block';

  // Scorri dolcemente all'inizio del form
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const progressBar   = document.querySelector('.progress-bar');
  const stepNavHeader = document.querySelector('.step-nav-header');
  const topBackBtn    = document.getElementById('topStepBackBtn');

  if (stepId === 'step_success') {
    if (progressBar) progressBar.style.display = 'none';
    if (stepNavHeader) stepNavHeader.style.display = 'none';
    return;
  } else {
    if (progressBar) progressBar.style.display = 'flex';
    if (stepNavHeader) stepNavHeader.style.display = 'flex';
    if (topBackBtn) {
      topBackBtn.textContent = (stepId === 'step2') ? '← Torna alla Home' : '← Torna Indietro';
    }
  }

  const stepMap = { step2: 1, step1: 2, step_package: 3, step_cake: 4, step3: 5, step4: 6 };
  const stepNum = stepMap[stepId] || 0;

  for (let i = 1; i <= 6; i++) {
    const ind = document.getElementById('ind' + i);
    if (!ind) continue;
    if (i <= stepNum) {
      ind.classList.add('active');
      ind.style.cursor = (i < stepNum) ? 'pointer' : 'default';
    } else {
      ind.classList.remove('active');
      ind.style.cursor = 'default';
    }
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

  const pricePerLaneMap = getPricePerLaneMap();
  const lanes    = part > 0 ? Math.ceil(part / MAX_PLAYERS_PER_LANE) : 0;
  // Costo pista sempre incluso per trasparenza ed evitare sbalzi improvvisi di prezzo
  const laneCost = lanes * (pricePerLaneMap[duration] || 0);

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


// ============================================================
// BIGLIETTO DIGITALE D'INVITO — Popolamento, Download e Condivisione
// ============================================================

function popolaBiglietto(dati) {
  if (!dati) return;

  const elName  = document.getElementById('displayHostName');
  const elTitle = document.getElementById('displayPartyTitle');
  const elDate  = document.getElementById('displayDate');
  const elTime  = document.getElementById('displayTime');

  if (elName) {
    elName.textContent = (dati.nome || 'FESTEGGIATO').toUpperCase();
  }

  if (elTitle) {
    if (dati.eta) {
      elTitle.textContent = `compie ${dati.eta} anni!`;
    } else {
      elTitle.textContent = 'Festa di Compleanno!';
    }
  }

  if (elDate) {
    elDate.textContent = dati.data || '-';
  }

  if (elTime) {
    elTime.textContent = dati.ora || '-';
  }
}

async function scaricaImmagine() {
  const card = document.getElementById('invitationCard');
  if (!card) return;

  try {
    const canvas = await html2canvas(card, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null
    });

    const nome = (document.getElementById('displayHostName')?.textContent || 'Compleanno').trim();
    const link = document.createElement('a');
    link.download = `Invito_Bowling_${nome}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Errore generazione immagine:', err);
    showCustomAlert('Impossibile scaricare l\'immagine automaticamente. Puoi fare uno screenshot del biglietto.');
  }
}

async function scaricaPDF() {
  const card = document.getElementById('invitationCard');
  if (!card) return;

  try {
    const canvas = await html2canvas(card, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const posY = Math.max(margin, (pageHeight - imgHeight) / 2);

    pdf.addImage(imgData, 'JPEG', margin, posY, imgWidth, imgHeight);

    const nome = (document.getElementById('displayHostName')?.textContent || 'Compleanno').trim();
    pdf.save(`Invito_Bowling_${nome}.pdf`);
  } catch (err) {
    console.error('Errore generazione PDF:', err);
    showCustomAlert('Impossibile generare il PDF. Puoi stampare questa schermata.');
  }
}

function condividiWhatsApp() {
  const nome = (document.getElementById('displayHostName')?.textContent || 'mio figlio').trim();
  const data = (document.getElementById('displayDate')?.textContent || '').trim();
  const ora  = (document.getElementById('displayTime')?.textContent || '').trim();
  const eta  = (document.getElementById('displayPartyTitle')?.textContent || '').trim();

  const msg = `🎳 *INVITO ALLA FESTA DI ${nome.toUpperCase()}!* 🎉\n` +
              `${eta ? eta + '\n' : ''}` +
              `📅 *Data:* ${data}\n` +
              `⏰ *Orario:* ${ora}\n` +
              `📍 *Dove:* Bowling Valdera (Via Tosco Romagnola 127, Fornacette - PI)\n` +
              `📞 *Info locale:* 0587 420120\n\n` +
              `Ti aspetto per strike, musica, pizza e torta! 🍕🎂🎳`;

  const encodedMsg = encodeURIComponent(msg);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Smartphone: apre direttamente l'app WhatsApp nativa
    window.location.href = `whatsapp://send?text=${encodedMsg}`;
  } else {
    // PC / Desktop: apre direttamente WhatsApp Web
    window.open(`https://web.whatsapp.com/send?text=${encodedMsg}`, '_blank');
  }
}

function updateSummaryView() {
  const data     = updateRealTimeCost();
  const menuInfo = MENUS[data.selectedMenuKey];

  const nomeFesteggiato = document.getElementById('festeggiato').value.trim() || 'Festeggiato';
  const etaFesteggiato  = document.getElementById('anni_festeggiato').value.trim();

  const d = document.getElementById('data').value;
  let formattedDate = '-';
  if (d) {
    const parts = d.split('-').map(Number);
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    formattedDate = `${parts[2]} ${months[parts[1] - 1]} ${parts[0]}`;
  }

  let time = '';
  document.getElementsByName('fascia_oraria').forEach(r => { if (r.checked) time = r.value; });

  // Popola automaticamente il Biglietto Digitale d'Invito
  popolaBiglietto({
    nome: nomeFesteggiato,
    eta: etaFesteggiato,
    data: formattedDate,
    ora: time
  });

  // Correzione concordanza singolare/plurale (1 PISTA vs 2 PISTE)
  document.getElementById('ticket-lanes').textContent        = data.lanes === 1 ? '1 PISTA' : `${data.lanes} PISTE`;
  document.getElementById('ticket-participants').textContent = data.part;

  // Correzione concordanza singolare/plurale (1 ORA vs 2 ORE)
  const durationLabel = data.duration === '1h' ? '1 ORA' : data.duration.toUpperCase().replace('H', ' ORE');
  document.getElementById('ticket-duration').textContent = durationLabel;

  let cake = '';
  document.getElementsByName('torta').forEach(r => { if (r.checked) cake = r.value; });
  const cakeMsg = document.getElementById('scritta_torta').value;

  let menuSummary = menuInfo.name.toUpperCase();
  if (data.fries) menuSummary += '\n+ PATATINE';
  document.getElementById('ticket-menu').textContent  = menuSummary;
  document.getElementById('ticket-menu').style.whiteSpace = 'pre-wrap';

  let cakeSummary = cake.toUpperCase();
  if (data.cakePhoto) cakeSummary += ' (+ Foto)';
  document.getElementById('ticket-cake').textContent  = cakeSummary;

  const elCakeMsg = document.getElementById('ticket-cake-msg');
  if (elCakeMsg) {
    elCakeMsg.textContent = cakeMsg ? `"${cakeMsg}"` : 'Nessuna';
  }

  document.getElementById('totalSpan').textContent = data.total;
  return menuSummary;
}


// ============================================================
// WIDGET CALENDARIO MENSILE INTERATTIVO CON DISPONIBILITÀ REAL-TIME
// ============================================================

let currentCalYear  = new Date().getFullYear();
let currentCalMonth = new Date().getMonth() + 1; // 1-12
let selectedDateISO = '';
const monthAvailabilityCache = {};

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

function updateMinParticipants() {
  const partInput = document.getElementById('partecipanti');
  if (!partInput) return;
  let selectedTime = '17:00';
  document.getElementsByName('fascia_oraria').forEach(r => { if (r.checked) selectedTime = r.value; });
  let min = 15;
  if (selectedTime === '18:00') min = 12;
  if (selectedTime === '19:00') min = 10;
  if (selectedTime === '19:30') min = 15;
  partInput.min = min;
  const currentVal = parseInt(partInput.value, 10);
  if (isNaN(currentVal) || currentVal < min) {
    partInput.value = min;
    updateRealTimeCost();
  }
}

async function fetchMonthAvailability(year, month) {
  let selectedDuration = '1.5';
  document.getElementsByName('durata').forEach(r => {
    if (r.checked) selectedDuration = r.value.replace('h', '');
  });

  const cacheKey = `${year}-${month}_${selectedDuration}h`;
  if (monthAvailabilityCache[cacheKey]) {
    return monthAvailabilityCache[cacheKey];
  }

  try {
    const url = `${SCRIPT_URL}?action=month_availability&year=${year}&month=${month}&duration=${selectedDuration}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.success && data.days) {
      monthAvailabilityCache[cacheKey] = data.days;
      return data.days;
    }
  } catch (err) {
    console.warn('Recupero disponibilità mensile non riuscito, uso fallback locale:', err);
  }
  return null;
}

async function renderInteractiveCalendar(year, month) {
  const titleEl = document.getElementById('calMonthTitle');
  const gridEl  = document.getElementById('calDaysGrid');
  const prevBtn = document.getElementById('btnCalPrev');
  if (!gridEl || !titleEl) return;

  const now = new Date();
  const currentRealYear  = now.getFullYear();
  const currentRealMonth = now.getMonth() + 1;

  if (prevBtn) {
    prevBtn.disabled = (year < currentRealYear || (year === currentRealYear && month <= currentRealMonth));
  }

  titleEl.textContent = `${MONTH_NAMES_IT[month - 1]} ${year}`;
  gridEl.innerHTML = '';

  const numDays = new Date(year, month, 0).getDate();
  let firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Dom, 1=Lun
  const startOffset = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;

  // Celle vuote prima del primo giorno del mese
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day-cell empty';
    gridEl.appendChild(empty);
  }

  const dayCells = {};
  const pad = n => (n < 10 ? '0' : '') + n;
  const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Skeleton iniziale dei giorni
  for (let day = 1; day <= numDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    const isoDate = `${year}-${pad(month)}-${pad(day)}`;

    cell.dataset.date = isoDate;
    cell.innerHTML = `
      <span class="day-number">${day}</span>
      <span class="day-dot"></span>
    `;

    gridEl.appendChild(cell);
    dayCells[isoDate] = cell;

    const dayDate = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = dayDate.getDay();

    if (isoDate < todayISO) {
      cell.classList.add('past');
      cell.title = 'Data passata';
    } else if (dayOfWeek === 3) {
      cell.classList.add('closed');
      cell.title = 'Chiuso (Mercoledì)';
    }
  }

  // Chiamata backend per caricare le disponibilità reali
  const daysData = await fetchMonthAvailability(year, month);

  for (let day = 1; day <= numDays; day++) {
    const isoDate = `${year}-${pad(month)}-${pad(day)}`;
    const cell    = dayCells[isoDate];
    if (!cell) continue;

    const dayDate   = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = dayDate.getDay();

    if (isoDate < todayISO || dayOfWeek === 3) continue;

    if (daysData && daysData[isoDate]) {
      const info = daysData[isoDate];
      if (info.status === 'available') {
        cell.classList.add('available');
        cell.title = info.label || 'Disponibile';
        cell.onclick = () => selectCalendarDate(isoDate, info.slots);
      } else if (info.status === 'full') {
        cell.classList.add('full');
        cell.title = 'Tutto Pieno';
      } else {
        cell.classList.add('closed');
        cell.title = info.label || 'Chiuso';
      }
    } else {
      // Fallback
      cell.classList.add('available');
      const fallbackSlots = (dayOfWeek === 0) ? ['19:30'] : ['17:00', '18:00', '19:00'];
      cell.onclick = () => selectCalendarDate(isoDate, fallbackSlots);
    }

    if (isoDate === selectedDateISO) {
      cell.classList.add('selected');
    }
  }

  // Pre-seleziona la prima data disponibile se non ce n'è una già scelta
  if (!selectedDateISO || !document.getElementById('data').value) {
    const firstAvailKey = Object.keys(dayCells).find(iso => dayCells[iso].classList.contains('available'));
    if (firstAvailKey) {
      const slots = (daysData && daysData[firstAvailKey]) ? daysData[firstAvailKey].slots : ['17:00', '18:00', '19:00'];
      selectCalendarDate(firstAvailKey, slots);
    }
  }
}

function selectCalendarDate(isoDate, availableSlots) {
  selectedDateISO = isoDate;
  const dataInput = document.getElementById('data');
  if (dataInput) {
    dataInput.value = isoDate;
  }

  document.querySelectorAll('.cal-day-cell').forEach(c => {
    if (c.dataset.date === isoDate) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });

  const banner = document.getElementById('selectedDateBanner');
  const label  = document.getElementById('selectedDateLabel');
  if (banner && label) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dayDate = new Date(y, m - 1, d);
    const daysName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    label.textContent = `${daysName[dayDate.getDay()]} ${d} ${MONTH_NAMES_IT[m - 1]} ${y}`;
    banner.style.display = 'block';
  }

  const slots = (availableSlots && availableSlots.length > 0)
    ? availableSlots
    : ['17:00', '18:00', '19:00'];

  renderTimeSlots(isoDate, slots);
  updateRealTimeCost();
  updateDurationLabels();

  const msg = document.getElementById('availability-msg');
  if (msg) {
    msg.textContent = '✅ Orario Disponibile!';
    msg.style.color = '#fff';
    msg.dataset.available = 'true';
  }
  const nextBtn = document.getElementById('nextFromStep2ToStep1');
  if (nextBtn) nextBtn.disabled = false;
}

function renderTimeSlots(isoDate, availableSlots) {
  const container = document.getElementById('timeSlotsContainer');
  if (!container) return;

  const [y, m, d] = isoDate.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  const isSunday = (dayOfWeek === 0);

  const allPossibleSlots = isSunday
    ? [{ time: '19:30', sub: 'Min 15 Persone • Solo Dom' }]
    : [
        { time: '17:00', sub: 'Min 15 Persone' },
        { time: '18:00', sub: 'Min 12 Persone' },
        { time: '19:00', sub: 'Min 10 Persone' }
      ];

  container.innerHTML = '';
  let checkedOne = false;

  allPossibleSlots.forEach((slot) => {
    const isAvail = availableSlots.includes(slot.time);
    const shouldCheck = isAvail && !checkedOne;
    if (shouldCheck) checkedOne = true;

    const card = document.createElement('label');
    card.className = 'time-card' + (!isAvail ? ' disabled-slot' : '');
    if (!isAvail) {
      card.style.opacity = '0.35';
      card.style.cursor = 'not-allowed';
      card.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    }

    card.innerHTML = `
      <input type="radio" name="fascia_oraria" value="${slot.time}" ${shouldCheck ? 'checked' : ''} ${!isAvail ? 'disabled' : ''}>
      <div class="card-content">
        <span class="time-label">${slot.time}</span>
        <span class="time-sub">${isAvail ? slot.sub : '❌ Già Occupato'}</span>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('input[name="fascia_oraria"]').forEach(input => {
    input.addEventListener('change', () => {
      updateMinParticipants();
      updateRealTimeCost();
    });
  });

  updateMinParticipants();
}


// ============================================================
// VERIFICA DISPONIBILITÀ SINGOLA (FALLBACK / SICUREZZA)
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

  const dettagliAllergie = document.getElementById('dettagli_allergie')?.value.trim() || 'Nessuna';

  const payload = {
    _token:              API_TOKEN,
    festeggiato:         document.getElementById('festeggiato').value.trim(),
    anni:                document.getElementById('anni_festeggiato').value.trim(),
    cliente:             `${nome} ${cognome}`.trim(),
    telefono:            document.getElementById('telefono').value.trim(),
    email:               document.getElementById('email').value.trim(),
    data_festa:          dataFestaItalian,
    ora:                 document.querySelector('input[name="fascia_oraria"]:checked')?.value,
    partecipanti:        document.getElementById('partecipanti').value,
    menu:                document.querySelector('input[name="pacchetto"]:checked')?.value,
    patatine:            document.getElementById('patatine').checked ? 'Sì' : 'No',
    torta:               document.querySelector('input[name="torta"]:checked')?.value,
    scritta_torta:       document.getElementById('scritta_torta').value.trim(),
    altre_richieste:     document.getElementById('altre_richieste').value.trim(),
    durata:              selectedDuration,
    foto_torta:          document.getElementById('foto_torta').checked ? 'Sì' : 'No',
    allergie_dichiarate: document.getElementById('allergy_declaration').checked ? 'Confermato' : 'No',
    dettagli_allergie:   dettagliAllergie,
    gdpr:                document.getElementById('gdpr_consent').checked ? 'Accettato' : 'No',
    marketing:           document.getElementById('marketing_consent').checked ? 'Sì' : 'No',
    totale:              parseFloat(document.getElementById('totalSpan').textContent.replace(/[€\s]/g, '').replace(',', '.'))
  };

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Errore di comunicazione col server: ' + response.status);

    const text = await response.text();

    if (text.startsWith('{')) {
      const result = JSON.parse(text);
      if (result.success === true) {
        return { success: true };
      }
      return { success: false, error: result.error || 'Errore durante la registrazione.' };
    } else {
      const ok = text.trim() === 'Success';
      return ok ? { success: true } : { success: false, error: text.trim() };
    }

  } catch (e) {
    console.error('Database save failed', e);
    return { success: false, error: 'Connessione al server non riuscita. Riprova tra poco o contattaci al 0587 420120.' };
  }
}


// ============================================================
// CUSTOM ALERT & MODALS
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

  // Imposta data minima di prenotazione (data odierna)
  const dateInput = document.getElementById('data');
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  // --- Costo in tempo reale e riverifica disponibilità ---
  document.getElementById('partecipanti').addEventListener('input', updateRealTimeCost);
  document.getElementsByName('durata').forEach(el => el.addEventListener('change', () => {
    updateRealTimeCost();
    // Rigenera il calendario con la nuova durata selezionata
    renderInteractiveCalendar(currentCalYear, currentCalMonth);
  }));
  document.getElementsByName('pacchetto').forEach(el => el.addEventListener('change', updateRealTimeCost));
  document.getElementById('patatine').addEventListener('change', updateRealTimeCost);
  document.getElementById('foto_torta').addEventListener('change', updateRealTimeCost);

  // --- Navigazione Mese Calendario Interattivo ---
  const btnPrev = document.getElementById('btnCalPrev');
  const btnNext = document.getElementById('btnCalNext');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      currentCalMonth--;
      if (currentCalMonth < 1) {
        currentCalMonth = 12;
        currentCalYear--;
      }
      renderInteractiveCalendar(currentCalYear, currentCalMonth);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentCalMonth++;
      if (currentCalMonth > 12) {
        currentCalMonth = 1;
        currentCalYear++;
      }
      renderInteractiveCalendar(currentCalYear, currentCalMonth);
    });
  }

  // Caricamento iniziale del calendario
  renderInteractiveCalendar(currentCalYear, currentCalMonth);

  updateMinParticipants();
  updateDurationLabels();

  // --- Pulsanti start (Hero e banner inferiore) ---
  document.querySelectorAll('.start-booking-trigger, #startBookingBtn, #startBookingBtnBottom').forEach(btn => {
    btn.addEventListener('click', startBooking);
  });

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

    if (partNum > 36) {
      showCustomAlert('Il numero massimo per le prenotazioni online è di 36 partecipanti. Per feste con un numero maggiore di partecipanti, ti invitiamo a contattare il Bowling Valdera al 0587 420120.');
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
  // NAVIGAZIONE INDIETRO (Pulsanti in basso)
  // ----------------------------------------------------------------
  document.getElementById('backFromStep2ToWelcome').addEventListener('click', () => {
    document.getElementById('bookingSteps').style.display = 'none';
    document.getElementById('welcomeStep').style.display  = 'block';
    document.querySelector('header').style.display        = 'none';
  });

  document.getElementById('backFromStep1ToStep2').addEventListener('click', () => {
    showStep('step2');
    document.getElementById('floatingCost').classList.add('hidden');
  });

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
  // PULSANTE SUPERIORE (In alto ad ogni schermata)
  // ----------------------------------------------------------------
  const topStepBackBtn = document.getElementById('topStepBackBtn');
  if (topStepBackBtn) {
    topStepBackBtn.addEventListener('click', () => {
      const currentStep = document.querySelector('.step[style*="display: block"]')?.id;
      if (!currentStep || currentStep === 'step2') {
        const container = document.querySelector('main.container');
        if (container) container.classList.add('landing-mode');
        document.getElementById('bookingSteps').style.display = 'none';
        document.getElementById('welcomeStep').style.display  = 'block';
        document.querySelector('header').style.display        = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const prevMap = {
        step1: 'step2',
        step_package: 'step1',
        step_cake: 'step_package',
        step3: 'step_cake',
        step4: 'step3'
      };
      const prev = prevMap[currentStep];
      if (prev) {
        if (prev === 'step1' || prev === 'step2') {
          document.getElementById('floatingCost').classList.add('hidden');
        }
        showStep(prev);
        updateRealTimeCost();
      }
    });
  }

  // ----------------------------------------------------------------
  // INDICATORI NUMERATI CLICCABILI (Salta direttamente indietro)
  // ----------------------------------------------------------------
  const stepMap = { step2: 1, step1: 2, step_package: 3, step_cake: 4, step3: 5, step4: 6 };
  const stepMapRev = { 1: 'step2', 2: 'step1', 3: 'step_package', 4: 'step_cake', 5: 'step3', 6: 'step4' };

  for (let i = 1; i <= 6; i++) {
    const ind = document.getElementById('ind' + i);
    if (ind) {
      ind.addEventListener('click', () => {
        const currentStep = document.querySelector('.step[style*="display: block"]')?.id;
        const currentNum = stepMap[currentStep] || 1;
        // Permette al cliente di cliccare su qualsiasi passaggio precedente già compilato
        if (i < currentNum) {
          const target = stepMapRev[i];
          if (target === 'step2' || target === 'step1') {
            document.getElementById('floatingCost').classList.add('hidden');
          }
          showStep(target);
          updateRealTimeCost();
        }
      });
    }
  }

  // ----------------------------------------------------------------
  // SCORCIATOIE DI MODIFICA RAPIDA NEL RIEPILOGO (Step 4)
  // ----------------------------------------------------------------
  document.getElementById('btnEditDate')?.addEventListener('click', () => {
    document.getElementById('floatingCost').classList.add('hidden');
    showStep('step2');
    updateRealTimeCost();
  });
  document.getElementById('btnEditContact')?.addEventListener('click', () => {
    document.getElementById('floatingCost').classList.add('hidden');
    showStep('step1');
    updateRealTimeCost();
  });
  document.getElementById('btnEditMenu')?.addEventListener('click', () => {
    showStep('step_package');
    updateRealTimeCost();
  });
  document.getElementById('btnEditCake')?.addEventListener('click', () => {
    showStep('step_cake');
    updateRealTimeCost();
  });
  document.getElementById('btnEditDuration')?.addEventListener('click', () => {
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

      const saveResult = await saveToDatabase();

      if (saveResult && saveResult.success) {
        // Popola la scheda di conferma
        const festeggiato = document.getElementById('festeggiato')?.value || '-';
        const date        = document.getElementById('displayDate')?.textContent || document.getElementById('ticket-date')?.textContent || '-';
        const time        = document.getElementById('displayTime')?.textContent || document.getElementById('ticket-time')?.textContent || '-';
        const part        = document.getElementById('ticket-participants')?.textContent || '-';
        const tot         = document.getElementById('totalSpan')?.textContent || '-';

        const elCelebrant = document.getElementById('success-celebrant');
        const elDate      = document.getElementById('success-date');
        const elTime      = document.getElementById('success-time');
        const elPart      = document.getElementById('success-participants');
        const elTot       = document.getElementById('success-total');

        // Recupero durata, menu, torta e scritta
        let rawDuration = '1.5h';
        document.getElementsByName('durata').forEach(r => { if (r.checked) rawDuration = r.value; });
        const durationMap = { '1h': '1 Ora', '1.5h': '1 Ora e Mezza (1.5h)', '2h': '2 Ore', '2.5h': '2 Ore e Mezza (2.5h)' };
        const durationText = durationMap[rawDuration] || rawDuration;

        let selectedMenu = document.querySelector('input[name="pacchetto"]:checked')?.value || '-';
        if (document.getElementById('patatine')?.checked) selectedMenu += ' + Patatine Fritte';

        let selectedCake = document.querySelector('input[name="torta"]:checked')?.value || '-';
        if (document.getElementById('foto_torta')?.checked) selectedCake += ' (con foto stampata)';

        const cakeMsg = document.getElementById('scritta_torta')?.value.trim() || 'Nessuna';

        const elDuration = document.getElementById('success-duration');
        const elMenu     = document.getElementById('success-menu');
        const elCake     = document.getElementById('success-cake');
        const elCakeMsg  = document.getElementById('success-cake-msg');

        if (elCelebrant) elCelebrant.textContent = festeggiato.toUpperCase();
        if (elDate)      elDate.textContent      = date;
        if (elTime)      elTime.textContent      = time;
        if (elDuration)  elDuration.textContent  = durationText;
        if (elPart)      elPart.textContent      = part + ' persone';
        if (elMenu)      elMenu.textContent      = selectedMenu;
        if (elCake)      elCake.textContent      = selectedCake;
        if (elCakeMsg)   elCakeMsg.textContent   = cakeMsg !== 'Nessuna' ? `"${cakeMsg}"` : 'Nessuna';
        if (elTot)       elTot.textContent       = tot + ' €';

        showStep('step_success');
        document.getElementById('floatingCost').classList.add('hidden');
      } else {
        const errorMsg = (saveResult && saveResult.error) ? saveResult.error : 'Ops! Qualcosa è andato storto nel salvataggio. Riprova tra un momento.';
        showCustomAlert(errorMsg);
        confirmBtn.disabled    = false;
        confirmBtn.textContent = 'Conferma Prenotazione';
      }
    });
  }

  // ----------------------------------------------------------------
  // PULSANTE TORNA ALLA HOME (FINE PROCEDURA)
  // ----------------------------------------------------------------
  const backHomeBtn = document.getElementById('btnBackToHome');
  if (backHomeBtn) {
    backHomeBtn.addEventListener('click', () => {
      location.reload();
    });
  }

  // ----------------------------------------------------------------
  // GESTIONE MODAL PRIVACY POLICY
  // ----------------------------------------------------------------
  const openPrivacyBtn = document.getElementById('btnOpenPrivacy');
  const closePrivacyBtn = document.getElementById('btnClosePrivacy');
  const privacyModal = document.getElementById('privacyModal');

  if (openPrivacyBtn && privacyModal) {
    openPrivacyBtn.addEventListener('click', () => {
      privacyModal.style.display = 'flex';
    });
  }
  if (closePrivacyBtn && privacyModal) {
    closePrivacyBtn.addEventListener('click', () => {
      privacyModal.style.display = 'none';
    });
  }

  // Chiusura alert con pulsante OK
  const alertOkBtn = document.getElementById('btnAlertOk');
  if (alertOkBtn) {
    alertOkBtn.addEventListener('click', closeCustomAlert);
  }

  // Chiusura modali cliccando sull'overlay scuro
  [document.getElementById('customAlert'), privacyModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  });

  // Chiusura modali tramite tasto Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCustomAlert();
      if (privacyModal) privacyModal.style.display = 'none';
    }
  });

}

// ============================================================
// AVVIO APPLICAZIONE — Un unico DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', init);
