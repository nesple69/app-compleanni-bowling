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
    // Riverifica disponibilità se la durata aumenta o cambia
    checkAvailability();
  }));
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
    const val = e.target.value;
    if (!val) return;

    const [year, month, day] = val.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const dayOfWeek    = selectedDate.getDay();

    const weekdaySlots = document.querySelectorAll('.time-card[data-day-type="weekday"]');
    const sundaySlots  = document.querySelectorAll('.time-card[data-day-type="sunday"]');
    const currentChecked = document.querySelector('input[name="fascia_oraria"]:checked');

    if (dayOfWeek === 0) {
      weekdaySlots.forEach(slot => slot.style.display = 'none');
      sundaySlots.forEach(slot => {
        slot.style.display = 'flex';
        slot.querySelector('input').checked = true;
      });
    } else {
      weekdaySlots.forEach(slot => slot.style.display = 'flex');
      sundaySlots.forEach(slot => slot.style.display = 'none');
      // Preserva lo slot orario selezionato se è già un feriale valido
      if (!currentChecked || currentChecked.value === '19:30') {
        const firstWeekdaySlot = document.querySelector('.time-card[data-day-type="weekday"] input');
        if (firstWeekdaySlot) firstWeekdaySlot.checked = true;
      }
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

    if (partNum > 36) {
      showCustomAlert('Il numero massimo per le prenotazioni online è di 36 partecipanti (6 piste). Per feste con più di 36 persone, ti invitiamo a contattare il Bowling Valdera al 0587 420120.');
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
        document.getElementById('bookingSteps').style.display = 'none';
        document.getElementById('welcomeStep').style.display  = 'block';
        document.querySelector('header').style.display        = 'none';
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
