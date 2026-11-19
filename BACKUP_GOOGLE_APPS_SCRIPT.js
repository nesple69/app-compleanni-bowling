/**
 * GOOGLE APPS SCRIPT — Bowling Valdera
 * Versione: 3.5 — Orari tondi (Lun-Ven: 17:00, 18:00, 19:00, 20:00 | Sab: 16:00, 17:00, 18:00, 19:00, 20:00 | Dom/Festivi: 19:30), buffer pulizia 0 min
 *
 * ISTRUZIONI PER IL DEPLOY:
 * 1. Aprire il progetto Google Apps Script collegato al Google Sheet.
 * 2. Impostare le Proprietà dello script (Impostazioni progetto → Proprietà script):
 *      API_SECRET   = BV2026-f8e3a7d2b9c4-k7p1 (o il token concordato)
 *      CALENDAR_ID  = <ID_CALENDARIO_GOOGLE> (es. federicacircelli25@gmail.com o email titolare)
 *      ADMIN_EMAIL  = info@bowlingvaldera.it
 *      SENDER_EMAIL = info@bowlingvaldera.it
 * 3. Incollare questo codice nel file Code.gs.
 * 4. Fare Deploy → Gestisci distribuzioni → Modifica → Nuova Versione → Distribuisci.
 * 5. Per attivare l'automazione della mail a 12 ore:
 *      Selezionare dal menu a tendina delle funzioni in alto la funzione "setupDepositTrigger"
 *      e cliccare "Esegui" una sola volta (oppure chiamare l'URL ?action=setup_trigger&token=BV2026-f8e3a7d2b9c4-k7p1).
 * 6. VELOCITÀ CALENDARIO (consigliato):
 *    a) Editor → "Servizi" (+) → aggiungere "Google Calendar API" (identificatore: Calendar).
 *       Le letture degli eventi diventano molto più veloci (se assente si usa CalendarApp in automatico).
 *    b) Eseguire una sola volta la funzione "setupAvailabilityTriggers": installa il ricalcolo automatico
 *       della cache disponibilità a ogni modifica del Google Calendar + ogni 10 minuti.
 *       (Viene installata anche in automatico chiamando ?action=setup_trigger&token=... o alla prima prenotazione.)
 */

const SHEET_NAME = 'dati_compleanno';

// Listino ufficiale per ricalcolo e validazione server-side dei prezzi
const MENU_PRICES = {
  'Basic': 10.0,
  'Smart': 12.5,
  'Plus':  11.5,
  'Prime': 15.0,
  'Ultra': 18.5
};
// Tariffe Bowling fisse per pista (30€ / ora a pista tutti i giorni)
const PRICE_LANE = { '1h': 30.0, '1.5h': 45.0, '2h': 60.0, '2.5h': 75.0 };
const PRICE_FRIES        = 2.0;
const PRICE_CAKE_PHOTO   = 5.0;
const MAX_PLAYERS_PER_LANE = 6;
const CLEANING_BUFFER_MS   = 0;              // Nessun buffer extra: un turno 17:00-18:00 lascia libero dalle 18:00
const SLOT_MARGIN_MS       = 10 * 1000;      // 10s di margine tecnico ai bordi per incastri esatti (es. 17:00-18:00 e 18:00-19:00)
const DURATION_OPTIONS     = ['1', '1.5', '2', '2.5'];

// Cache disponibilità: precalcolata e mantenuta aggiornata dai trigger (vedi setupAvailabilityTriggers)
const AVAIL_CACHE_PREFIX       = 'cal_avail_v6_';
const AVAIL_CACHE_TTL_S        = 21600; // 6 ore (massimo consentito da CacheService)
const AVAIL_PREWARM_MONTHS     = 3;     // mesi ricalcolati in anticipo (corrente + 2)
const AVAIL_INVALIDATE_MONTHS  = 13;    // mesi invalidati quando cambia il calendario
const AVAIL_REFRESH_EVERY_MIN  = 10;    // frequenza trigger di riscaldamento cache

// Fasce orarie ufficiali (IDENTICHE a SLOT_RULES in script.js).
// getDay(): 0 = Domenica ... 6 = Sabato
const SLOT_RULES = [
  { time: '16:00', days: [6] },                  // Solo Sabato
  { time: '17:00', days: [1, 2, 3, 4, 5, 6] },   // Lun-Sab
  { time: '18:00', days: [1, 2, 3, 4, 5, 6] },   // Lun-Sab
  { time: '19:00', days: [1, 2, 3, 4, 5, 6] },   // Lun-Sab
  { time: '19:30', days: [0] },                  // Domenica (e festivi aperti)
  { time: '20:00', days: [1, 2, 3, 4, 5, 6] }    // Lun-Sab
];

/** Elenco orari prenotabili per un giorno della settimana (0=Dom ... 6=Sab) */
function getSlotsForDayOfWeek(dayOfWeek) {
  const out = [];
  for (let i = 0; i < SLOT_RULES.length; i++) {
    if (SLOT_RULES[i].days.indexOf(dayOfWeek) !== -1) out.push(SLOT_RULES[i].time);
  }
  return out;
}

/** Elenco orari prenotabili per una data ISO (YYYY-MM-DD) */
function getSlotsForIsoDate(isoDate) {
  const p = String(isoDate).split('-');
  const y = parseInt(p[0], 10);
  const m = parseInt(p[1], 10);
  const day = parseInt(p[2], 10);
  if (isOpenHoliday(y, m, day)) {
    return ['19:30'];
  }
  const d = new Date(y, m - 1, day, 12, 0, 0);
  return getSlotsForDayOfWeek(d.getDay());
}

/**
 * Costruisce il link della cassa (apre il sito in modalità cassa con i dati della prenotazione).
 * Il link viene inserito nella descrizione dell'evento su Google Calendar.
 */
function buildCassaUrl(props, params) {
  const base = (props.frontendUrl || 'https://www.bowlingvaldera.com/compleanni-2').replace(/\/+$/, '');
  const pairs = ['cassa=1'];
  Object.keys(params).forEach(function (k) {
    pairs.push(k + '=' + encodeURIComponent(params[k] === null || params[k] === undefined ? '' : params[k]));
  });
  return base + (base.indexOf('?') === -1 ? '?' : '&') + pairs.join('&');
}

/** Recupera i valori di configurazione dalle ScriptProperties */
function getProps() {
  const p = PropertiesService.getScriptProperties();
  const adminEmail = 'info@bowlingvaldera.it';

  // URL fisso della web app (distribuzione già collegata al sito). Può essere forzato con la proprietà WEBAPP_URL.
  let webAppUrl = p.getProperty('WEBAPP_URL');
  if (!webAppUrl || webAppUrl.indexOf('http') !== 0) {
    webAppUrl = 'https://script.google.com/macros/s/AKfycbzkz4wmsgLUe0KsLYsbbC7kJVifeSDTduGSya3C-QIQ4htLT5OxIDYlqkbiw_vh_AAhxQ/exec';
  }

  return {
    calendarId:  p.getProperty('CALENDAR_ID') || 'primary',
    adminEmail:  adminEmail,
    senderEmail: p.getProperty('SENDER_EMAIL') || 'info@bowlingvaldera.it',
    apiSecret:   p.getProperty('API_SECRET') || 'BV2026-f8e3a7d2b9c4-k7p1',
    webAppUrl:   webAppUrl,
    frontendUrl: p.getProperty('FRONTEND_URL') || 'https://www.bowlingvaldera.com/compleanni-2',
    // La cassa si apre direttamente dallo script di Google (non dipende dalla pagina Wix).
    // Solo se si imposta la proprietà CASSA_SU_SITO = 1 si usa la cassa integrata nel sito.
    useSiteCassa: p.getProperty('CASSA_SU_SITO') === '1'
  };
}

function normalizeDateToIso(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).trim().split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // Già in formato ISO: YYYY-MM-DD
      return parts[0] + '-' + (parts[1].length < 2 ? '0' + parts[1] : parts[1]) + '-' + (parts[2].length < 2 ? '0' + parts[2] : parts[2]);
    } else if (parts[2].length === 4) {
      // In formato italiano: DD-MM-YYYY -> converti in YYYY-MM-DD
      return parts[2] + '-' + (parts[1].length < 2 ? '0' + parts[1] : parts[1]) + '-' + (parts[0].length < 2 ? '0' + parts[0] : parts[0]);
    }
  }
  return dateStr;
}

/**
 * Controllo festività chiuse obbligatoriamente di default:
 * Solo Natale (25 dic), S. Stefano (26 dic), Capodanno (1 gen), Pasqua e Pasquetta.
 * Tutti gli altri festivi sono aperti salvo evento "CHIUSO" segnato su Google Calendar.
 */
function isClosedHoliday(year, month, day) {
  // Feste fisse
  if ((month === 1 && day === 1) || (month === 12 && (day === 25 || day === 26))) {
    return true;
  }
  // Pasqua e Pasquetta (algoritmo astronomico gregoriano Meeus/Jones/Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m + 114) / 31);
  const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

  if (month === easterMonth && day === easterDay) return true; // Pasqua

  const mondayDate = new Date(year, easterMonth - 1, easterDay + 1);
  if (month === (mondayDate.getMonth() + 1) && day === mondayDate.getDate()) return true; // Pasquetta

  return false;
}

/**
 * Festivi nazionali italiani aperti (esclusi quelli chiusi di default):
 * 6 Gennaio (Epifania), 25 Aprile, 1 Maggio, 2 Giugno, 15 Agosto, 1 Novembre, 8 Dicembre.
 * Su questi giorni è disponibile esclusivamente la fascia delle 19:30.
 */
function isOpenHoliday(year, month, day) {
  return (
    (month === 1  && day === 6)  || // Epifania
    (month === 4  && day === 25) || // Liberazione
    (month === 5  && day === 1)  || // Festa dei Lavoratori
    (month === 6  && day === 2)  || // Festa della Repubblica
    (month === 8  && day === 15) || // Ferragosto
    (month === 11 && day === 1)  || // Tutti i Santi
    (month === 12 && day === 8)     // Immacolata Concezione
  );
}

/** Sanitizza stringhe per prevenire HTML Injection nelle email */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Sanitizza stringhe per prevenire Formula Injection su Google Sheets */
function sanitizeForSheet(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/** Calcola e convalida in modo autorevole il prezzo totale */
function calculateAuthoritativeTotal(data) {
  const part = parseInt(data.partecipanti, 10) || 0;
  if (part <= 0) return 0;

  const durationKey = data.durata || '1.5h';
  const lanes = Math.ceil(part / MAX_PLAYERS_PER_LANE);
  const laneCost = lanes * (PRICE_LANE[durationKey] || 45.0);

  const menuPrice = MENU_PRICES[data.menu] !== undefined ? MENU_PRICES[data.menu] : 10.0;
  const friesCost = (data.patatine === 'Sì') ? PRICE_FRIES : 0;
  const photoCost = (data.foto_torta === 'Sì') ? PRICE_CAKE_PHOTO : 0;

  const totalFoodCost = part * (menuPrice + friesCost);
  return Math.round((laneCost + totalFoodCost + photoCost) * 100) / 100;
}

// =========================================================================
// GESTIONE RICHIESTE GET (Disponibilità, Form Caparra & Salvataggio Caparra)
// =========================================================================
function doGet(e) {
  try {
    const action = e.parameter.action;

    // 1. SCHERMATA OPERATORE: Form di Registrazione Caparra da Google Calendar
    if (action === 'pay_form') {
      return renderPayForm(e);
    }

    // 2. SALVATAGGIO CAPARRA: Elaborazione dell'incasso inviato dall'operatore
    if (action === 'save_deposit') {
      return handleSaveDeposit(e);
    }

    // 3. CONTROLLO E DIAGNOSTICA PROMEMORIA 12 ORE + RIPARAZIONE AUTOMATICA LINK CALENDARIO
    if (action === 'check_reminders' || action === 'setup_trigger') {
      return handleCheckReminders(e);
    }

    // 3b. RIPARAZIONE AUTOMATICA DEI VECCHI LINK CAPARRA SU GOOGLE CALENDAR
    if (action === 'repair_calendar_links') {
      const report = repairAllCalendarLinks();
      return ContentService
        .createTextOutput(JSON.stringify(report, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Richiesta disponibilità del mese (tutte le durate) — risposta servita dalla cache precalcolata.
    //    Parametro opzionale months=N (1-3): restituisce anche i mesi successivi nella stessa risposta.
    if (action === 'month_availability') {
      const year          = parseInt(e.parameter.year, 10);
      const month         = parseInt(e.parameter.month, 10); // 1-12
      const monthsCount   = Math.min(3, Math.max(1, parseInt(e.parameter.months, 10) || 1));

      if (!year || !month || month < 1 || month > 12) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Anno o mese mancanti' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const monthsData = getMonthsAvailabilityCached(year, month, monthsCount);
      const response = {
        success:    true,
        year:       year,
        month:      month,
        byDuration: monthsData[year + '-' + month] || {}
      };
      if (monthsCount > 1) response.monthsData = monthsData;

      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Verifica disponibilità orario singolo slot
    const dateStr       = e.parameter.date;
    const timeStr       = e.parameter.time;
    const durationHours = parseFloat(e.parameter.duration) || 1.5;

    if (!dateStr || !timeStr) {
      return ContentService
        .createTextOutput(JSON.stringify({ available: false, error: 'Parametri mancanti' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const isoDate     = normalizeDateToIso(dateStr);
    const isAvailable = checkCalendarAvailability(isoDate, timeStr, durationHours);

    return ContentService
      .createTextOutput(JSON.stringify({ available: isAvailable }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ available: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- HELPERS CONDIVISI PER DISPONIBILITÀ GOOGLE CALENDAR ---
function getTargetCalendar(props, throwIfMissing) {
  if (!props.calendarId) {
    if (throwIfMissing) throw new Error('CALENDAR_ID non configurato nelle Proprietà dello script.');
    return null;
  }
  const calendar = CalendarApp.getCalendarById(props.calendarId) || (throwIfMissing ? null : CalendarApp.getDefaultCalendar());
  if (!calendar && throwIfMissing) {
    throw new Error('Impossibile accedere al calendario con ID specificato.');
  }
  return calendar;
}

/** Converte gli eventi CalendarApp in oggetti leggeri con timestamp in ms (una sola passata API) */
function normalizeCalendarEvents(rawEvents) {
  const normalized = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    const isAllDay = ev.isAllDayEvent();
    normalized.push({
      isAllDay:   isAllDay,
      startMs:    ev.getStartTime().getTime(),
      endMs:      ev.getEndTime().getTime(),
      titleUpper: isAllDay ? (ev.getTitle() || '').toUpperCase() : ''
    });
  }
  return normalized;
}

/** Converte una data "YYYY-MM-DD" (eventi a giorno intero dell'API REST) in ms, nel fuso dello script */
function allDayDateToMs(dateStr) {
  const p = String(dateStr).split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 0, 0, 0).getTime();
}

/**
 * Legge gli eventi del calendario nell'intervallo indicato e li restituisce normalizzati.
 * Usa il servizio avanzato "Google Calendar API" (Calendar.Events.list) se abilitato nel progetto:
 * una sola chiamata REST con i soli campi necessari, molto più veloce dei getter di CalendarApp.
 * Se il servizio avanzato non è abilitato o fallisce, ricade automaticamente su CalendarApp.
 */
function fetchNormalizedEvents(calendar, startDate, endDate) {
  if (typeof Calendar !== 'undefined' && Calendar.Events && typeof Calendar.Events.list === 'function') {
    try {
      const out = [];
      let pageToken = null;
      do {
        const resp = Calendar.Events.list(calendar.getId(), {
          timeMin:      startDate.toISOString(),
          timeMax:      endDate.toISOString(),
          singleEvents: true,
          showDeleted:  false,
          maxResults:   2500,
          pageToken:    pageToken || undefined,
          fields:       'nextPageToken,items(status,summary,start,end)'
        });
        const items = (resp && resp.items) || [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (!it || it.status === 'cancelled' || !it.start || !it.end) continue;
          const isAllDay = !!it.start.date && !it.start.dateTime;
          out.push({
            isAllDay:   isAllDay,
            startMs:    isAllDay ? allDayDateToMs(it.start.date) : new Date(it.start.dateTime).getTime(),
            endMs:      isAllDay ? allDayDateToMs(it.end.date)   : new Date(it.end.dateTime).getTime(),
            titleUpper: isAllDay ? String(it.summary || '').toUpperCase() : ''
          });
        }
        pageToken = resp && resp.nextPageToken;
      } while (pageToken);
      return out;
    } catch (errAdv) {
      console.warn('Calendar API avanzata non disponibile, uso CalendarApp:', errAdv);
    }
  }
  return normalizeCalendarEvents(calendar.getEvents(startDate, endDate));
}

/** Restituisce { status, label } se un evento a giorno intero blocca la giornata, altrimenti null */
function findAllDayBlock(events, dayStartMs, dayEndMs) {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.isAllDay && ev.startMs < dayEndMs && ev.endMs > dayStartMs) {
      const isClosed = ev.titleUpper.indexOf('CHIUSO') !== -1 || ev.titleUpper.indexOf('FERIE') !== -1;
      return isClosed
        ? { status: 'closed', label: 'Chiuso' }
        : { status: 'full',   label: 'Tutto Pieno' };
    }
  }
  return null;
}

/** Verifica che nessuno evento orario si sovrapponga allo slot [slotStartMs, slotStartMs + totalOccupiedMs] */
function isSlotAvailable(events, slotStartMs, totalOccupiedMs) {
  const checkStartMs = slotStartMs + SLOT_MARGIN_MS;
  const checkEndMs   = slotStartMs + totalOccupiedMs - SLOT_MARGIN_MS;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev.isAllDay && ev.startMs < checkEndMs && ev.endMs > checkStartMs) {
      return false;
    }
  }
  return true;
}

/** Invalida la cache mensile dopo una nuova prenotazione */
function invalidateMonthAvailabilityCache(isoDate) {
  try {
    const parts = String(isoDate).split('-');
    if (parts.length < 2) return;
    const year  = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    CacheService.getScriptCache().remove(AVAIL_CACHE_PREFIX + year + '_' + month);
  } catch (e) {}
}

/** Calcola la mappa disponibilità di un mese per una singola durata a partire dagli eventi già caricati */
function buildMonthDaysMap(events, year, month, durationHours, numDays, todayDateStr) {
  const pad = function(n) { return (n < 10 ? '0' : '') + n; };
  const totalOccupiedMs = (durationHours * 60 * 60 * 1000) + CLEANING_BUFFER_MS;
  const daysMap         = {};

  for (let day = 1; day <= numDays; day++) {
    const dStr = year + '-' + pad(month) + '-' + pad(day);

    if (dStr < todayDateStr) {
      daysMap[dStr] = { status: 'past', slots: [], label: 'Passato' };
      continue;
    }

    if (isClosedHoliday(year, month, day)) {
      daysMap[dStr] = { status: 'closed', slots: [], label: 'Festivo' };
      continue;
    }

    const dayStartMs = new Date(year, month - 1, day, 0, 0, 0).getTime();
    const dayEndMs   = new Date(year, month - 1, day, 23, 59, 59).getTime();
    const dayBlock   = findAllDayBlock(events, dayStartMs, dayEndMs);
    if (dayBlock) {
      daysMap[dStr] = { status: dayBlock.status, slots: [], label: dayBlock.label };
      continue;
    }

    const dayOfWeek      = new Date(year, month - 1, day, 12, 0, 0).getDay();
    const candidateSlots = isOpenHoliday(year, month, day) ? ['19:30'] : getSlotsForDayOfWeek(dayOfWeek);
    const availableSlots = [];

    for (let s = 0; s < candidateSlots.length; s++) {
      const parts = candidateSlots[s].split(':');
      const slotStartMs = new Date(year, month - 1, day, parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getTime();
      if (isSlotAvailable(events, slotStartMs, totalOccupiedMs)) {
        availableSlots.push(candidateSlots[s]);
      }
    }

    daysMap[dStr] = availableSlots.length > 0
      ? {
          status: 'available',
          slots:  availableSlots,
          label:  availableSlots.length === 1 ? '1 orario libero' : availableSlots.length + ' orari liberi'
        }
      : { status: 'full', slots: [], label: 'Tutto Pieno' };
  }

  return daysMap;
}

// --- RECUPERO DISPONIBILITÀ MENSILE PER TUTTE LE DURATE IN UN'UNICA CHIAMATA ---
function getMonthAvailabilityAllDurations(year, month, calendarOpt) {
  const calendar = calendarOpt || getTargetCalendar(getProps(), false);
  if (!calendar) return {};

  const firstDay = new Date(year, month - 1, 1, 0, 0, 0);
  const numDays  = new Date(year, month, 0).getDate();
  const lastDay  = new Date(year, month - 1, numDays, 23, 59, 59);

  // Una sola lettura da Google Calendar per tutto il mese, normalizzata in memoria
  const events = fetchNormalizedEvents(calendar, firstDay, lastDay);

  const now = new Date();
  const pad = function(n) { return (n < 10 ? '0' : '') + n; };
  const todayDateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  const byDuration = {};
  for (let i = 0; i < DURATION_OPTIONS.length; i++) {
    const durKey = DURATION_OPTIONS[i];
    byDuration[durKey] = buildMonthDaysMap(events, year, month, parseFloat(durKey), numDays, todayDateStr);
  }
  return byDuration;
}

function getMonthAvailability(year, month, durationHours) {
  const all = getMonthAvailabilityAllDurations(year, month);
  return all[String(durationHours)] || all['1.5'] || {};
}

/** Elenco [ {year, month}, ... ] di "count" mesi consecutivi a partire da year/month */
function listConsecutiveMonths(year, month, count) {
  const out = [];
  let y = year, m = month;
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * Restituisce { 'YYYY-M': byDuration } per "count" mesi consecutivi.
 * Legge tutto dalla cache in un'unica chiamata (getAll); calcola solo i mesi mancanti.
 */
function getMonthsAvailabilityCached(year, month, count) {
  const months = listConsecutiveMonths(year, month, count);
  const cache  = CacheService.getScriptCache();
  const keys   = months.map(function (mm) { return AVAIL_CACHE_PREFIX + mm.year + '_' + mm.month; });

  let cachedMap = {};
  try { cachedMap = cache.getAll(keys) || {}; } catch (eGet) { cachedMap = {}; }

  const result   = {};
  const toPut    = {};
  let calendar   = null;

  for (let i = 0; i < months.length; i++) {
    const mm  = months[i];
    const key = keys[i];
    let byDuration = null;
    if (cachedMap[key]) {
      try { byDuration = JSON.parse(cachedMap[key]); } catch (eParse) { byDuration = null; }
    }
    if (!byDuration) {
      if (!calendar) calendar = getTargetCalendar(getProps(), false);
      byDuration = getMonthAvailabilityAllDurations(mm.year, mm.month, calendar);
      toPut[key] = JSON.stringify(byDuration);
    }
    result[mm.year + '-' + mm.month] = byDuration;
  }

  if (Object.keys(toPut).length > 0) {
    try { cache.putAll(toPut, AVAIL_CACHE_TTL_S); } catch (ePut) {}
  }
  return result;
}

/**
 * Ricalcola SUBITO la cache dei prossimi mesi (corrente + 2) e invalida quelli più lontani.
 * Eseguita automaticamente:
 *  - ogni volta che un evento del Google Calendar viene creato/modificato/cancellato (trigger onEventUpdated);
 *  - ogni AVAIL_REFRESH_EVERY_MIN minuti come rete di sicurezza (trigger temporizzato).
 */
function rebuildAvailabilityCache() {
  const cache    = CacheService.getScriptCache();
  const now      = new Date();
  const startY   = now.getFullYear();
  const startM   = now.getMonth() + 1;

  // Invalida i mesi lontani (verranno ricalcolati alla prima richiesta)
  try {
    const farMonths = listConsecutiveMonths(startY, startM, AVAIL_INVALIDATE_MONTHS).slice(AVAIL_PREWARM_MONTHS);
    cache.removeAll(farMonths.map(function (mm) { return AVAIL_CACHE_PREFIX + mm.year + '_' + mm.month; }));
  } catch (eRem) {}

  // Ricalcola e scrive in cache i mesi più richiesti
  const calendar = getTargetCalendar(getProps(), false);
  if (!calendar) return;
  const toPut = {};
  const months = listConsecutiveMonths(startY, startM, AVAIL_PREWARM_MONTHS);
  for (let i = 0; i < months.length; i++) {
    const mm = months[i];
    toPut[AVAIL_CACHE_PREFIX + mm.year + '_' + mm.month] =
      JSON.stringify(getMonthAvailabilityAllDurations(mm.year, mm.month, calendar));
  }
  try { cache.putAll(toPut, AVAIL_CACHE_TTL_S); } catch (ePut) {}
}

/**
 * Installa i trigger che mantengono la cache delle disponibilità sempre calda.
 * Da eseguire UNA VOLTA dall'editor di Apps Script (menu funzioni → setupAvailabilityTriggers → Esegui),
 * oppure tramite ?action=setup_trigger&token=...
 */
function setupAvailabilityTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'rebuildAvailabilityCache') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 1. Ricalcolo immediato a ogni modifica del Google Calendar (anche manuale dello staff)
  const props = getProps();
  let calendarOwner = props.calendarId;
  if (!calendarOwner || calendarOwner === 'primary') {
    calendarOwner = Session.getEffectiveUser().getEmail();
  }
  try {
    ScriptApp.newTrigger('rebuildAvailabilityCache')
      .forUserCalendar(calendarOwner)
      .onEventUpdated()
      .create();
  } catch (errCal) {
    console.warn('Impossibile creare il trigger sul calendario (' + calendarOwner + '):', errCal);
  }

  // 2. Rete di sicurezza: ricalcolo periodico
  ScriptApp.newTrigger('rebuildAvailabilityCache')
    .timeBased()
    .everyMinutes(AVAIL_REFRESH_EVERY_MIN)
    .create();

  rebuildAvailabilityCache();
  console.log('✅ Trigger cache disponibilità installati (calendario: ' + calendarOwner + ').');
}

/** Installa i trigger della cache disponibilità se mancanti */
function ensureAvailabilityTriggersInstalled() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'rebuildAvailabilityCache') return true;
    }
    setupAvailabilityTriggers();
    return true;
  } catch (err) {
    console.warn('Impossibile verificare/creare i trigger della cache disponibilità:', err);
    return false;
  }
}

// =========================================================================
// SALVATAGGIO PRENOTAZIONE (POST)
// =========================================================================
function doPost(e) {
  // Lock di concorrenza per prevenire race conditions e doppie prenotazioni simultanee
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000); // attende fino a 15 secondi

  if (!hasLock) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Il server è occupato. Riprova tra pochi istanti.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const data  = JSON.parse(e.postData.contents);
    const props = getProps();

    // Validazione token di sicurezza
    if (!props.apiSecret || data._token !== props.apiSecret) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Non autorizzato' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Riverifica disponibilità all'interno del blocco con lock
    const isoDate   = normalizeDateToIso(data.data_festa || '');
    const durationHours = parseFloat(data.durata) || 1.5;

    const stillAvailable = checkCalendarAvailability(isoDate, data.ora, durationHours);
    if (!stillAvailable) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Spiacenti, l\'orario selezionato è appena stato prenotato da un altro utente.'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Ricalcolo autorevole del prezzo per prevenire manomissioni lato client
    const verifiedTotal = calculateAuthoritativeTotal(data);
    data.totale = verifiedTotal;

    // 3. Scrittura su Google Sheets con protezione da Formula Injection
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

    sheet.appendRow([
      new Date(),                                   // Col 1:  Timestamp
      sanitizeForSheet(data.festeggiato),           // Col 2:  Festeggiato
      sanitizeForSheet(data.anni),                  // Col 3:  Anni
      sanitizeForSheet(data.cliente),               // Col 4:  Cliente
      sanitizeForSheet(data.telefono),              // Col 5:  Telefono
      sanitizeForSheet(data.email),                 // Col 6:  Email
      sanitizeForSheet(data.data_festa),            // Col 7:  Data Festa (DD-MM-YYYY)
      sanitizeForSheet(data.ora),                   // Col 8:  Ora
      parseInt(data.partecipanti, 10) || 0,         // Col 9:  Partecipanti
      sanitizeForSheet(data.menu),                  // Col 10: Menu
      sanitizeForSheet(data.patatine),              // Col 11: Patatine
      sanitizeForSheet(data.torta),                 // Col 12: Torta
      sanitizeForSheet(data.scritta_torta),         // Col 13: Scritta Torta
      sanitizeForSheet(data.altre_richieste),       // Col 14: Altre Richieste
      sanitizeForSheet(data.durata),                // Col 15: Durata
      data.totale,                                  // Col 16: Totale
      sanitizeForSheet(data.allergie_dichiarate),   // Col 17: Allergie Dichiarate
      sanitizeForSheet(data.gdpr),                  // Col 18: GDPR
      sanitizeForSheet(data.marketing),             // Col 19: Marketing
      sanitizeForSheet(data.foto_torta),            // Col 20: Foto Torta
      sanitizeForSheet(data.dettagli_allergie),     // Col 21: Dettagli Allergie
      'IN ATTESA',                                  // Col 22: Stato Caparra
      '',                                           // Col 23: Importo Caparra Versata (€)
      data.totale,                                  // Col 24: Saldo Rimanente da Pagare (€)
      '',                                           // Col 25: Metodo Caparra
      '',                                           // Col 26: Data/Ora Incasso Caparra
      'NO',                                         // Col 27: Promemoria 12h Inviato (NO / data e ora)
      ''                                            // Col 28: ID Evento Google Calendar
    ]);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow, 16).setNumberFormat('€#,##0.00');
    sheet.getRange(lastRow, 23, 1, 2).setNumberFormat('€#,##0.00');

    // 4. Creazione Evento Google Calendar con Link di Registrazione Caparra per l'Operatore
    const eventId = createCalendarEvent(data, props, lastRow);
    if (eventId) {
      sheet.getRange(lastRow, 28).setValue(eventId);
    }
    invalidateMonthAvailabilityCache(isoDate);

    // 5. Invio email iniziale di riepilogo al cliente e notifica alla sede
    sendConfirmationEmail(data, props);

    // 6. Assicura che il trigger per il promemoria 12 ore sia attivo nel sistema
    ensureDepositTriggerInstalled();
    // 7. Assicura che i trigger della cache disponibilità siano attivi
    ensureAvailabilityTriggersInstalled();

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, totale: verifiedTotal }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('Errore durante doPost:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- VERIFICA DISPONIBILITÀ CALENDARIO ---
function checkCalendarAvailability(dateStr, timeStr, durationHours) {
  const calendar = getTargetCalendar(getProps(), true);

  // Controllo festività e fascia ufficiale prima di interrogare Google Calendar
  const dParts = dateStr.split('-');
  if (isClosedHoliday(parseInt(dParts[0], 10), parseInt(dParts[1], 10), parseInt(dParts[2], 10))) {
    return false;
  }
  if (getSlotsForIsoDate(dateStr).indexOf(timeStr) === -1) {
    return false;
  }

  // Un'unica chiamata getEvents per la giornata (copre sia eventi a giorno intero sia sovrapposizioni orarie)
  const dayStart = new Date(dateStr + 'T00:00:00');
  const dayEnd   = new Date(dateStr + 'T23:59:59');
  const events   = fetchNormalizedEvents(calendar, dayStart, dayEnd);

  if (findAllDayBlock(events, dayStart.getTime(), dayEnd.getTime())) {
    return false;
  }

  const slotStartMs     = new Date(dateStr + 'T' + timeStr + ':00').getTime();
  const totalOccupiedMs = (durationHours * 60 * 60 * 1000) + CLEANING_BUFFER_MS;
  return isSlotAvailable(events, slotStartMs, totalOccupiedMs);
}

// =========================================================================
// CREAZIONE EVENTO CALENDARIO (con link interattivo per l'operatore)
// =========================================================================
function createCalendarEvent(data, props, rowNumber) {
  if (!props.calendarId) return null;

  const isoDate         = normalizeDateToIso(data.data_festa || '');
  const start           = new Date(isoDate + 'T' + data.ora + ':00');
  const durationInHours = parseFloat(data.durata) || 1.5;
  const gameEndMs       = start.getTime() + (durationInHours * 60 * 60 * 1000);
  const fullOccupiedEnd = new Date(gameEndMs + CLEANING_BUFFER_MS);
  const end             = fullOccupiedEnd; // L'evento blocca il calendario fino al termine della pulizia

  const timeZone        = Session.getScriptTimeZone() || 'Europe/Rome';
  const gameEndStr      = Utilities.formatDate(new Date(gameEndMs), timeZone, 'HH:mm');
  const cleanEndStr     = Utilities.formatDate(fullOccupiedEnd, timeZone, 'HH:mm');

  const durationMap = {
    '1h':   '1 Ora',
    '1.5h': '1.5 Ore (1h 30m)',
    '2h':   '2 Ore',
    '2.5h': '2.5 Ore (2h 30m)'
  };
  const durataReadable = durationMap[data.durata] || (data.durata ? data.durata + ' ore' : '1.5 Ore');

  // Titolo evento: Cognome del genitore con l'ora dell'evento (es. "ROSSI - 18:00")
  let cognomeGenitore = (data.cognome || '').trim();
  if (!cognomeGenitore && data.cliente) {
    const parts = data.cliente.trim().split(/\s+/);
    cognomeGenitore = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  }
  cognomeGenitore = (cognomeGenitore || data.cliente || 'PRENOTAZIONE').toUpperCase();
  const oraEvento = data.ora ? data.ora : '';
  const title     = cognomeGenitore + (oraEvento ? ' - ' + oraEvento : '');

  // Link CASSA (nella descrizione dell'evento): usa cassa.html ospitata su Vercel (consentita da Google Calendar senza errori 'Azione non consentita')
  const buildPayUrl = function (eventId) {
    const cassaBase = 'https://app-compleanni-bowling.vercel.app/cassa.html';
    return cassaBase +
      '?row=' + encodeURIComponent(rowNumber || '') +
      '&cognome=' + encodeURIComponent(cognomeGenitore) +
      '&cliente=' + encodeURIComponent(data.cliente || '') +
      '&festeggiato=' + encodeURIComponent(data.festeggiato || '') +
      '&anni=' + encodeURIComponent(data.anni || '') +
      '&telefono=' + encodeURIComponent(data.telefono || '') +
      '&data=' + encodeURIComponent(data.data_festa || '') +
      '&ora=' + encodeURIComponent(oraEvento) +
      '&totale=' + encodeURIComponent(typeof data.totale === 'number' ? data.totale.toFixed(2) : (data.totale || '0')) +
      (eventId ? '&eventId=' + encodeURIComponent(eventId) : '') +
      '&token=' + encodeURIComponent(props.apiSecret);
  };

  const buildDesc = function (eventId) {
    return '🔴 STATO CAPARRA: IN ATTESA (Da versare)\n' +
      '👉 CLICCA QUI PER REGISTRARE LA CAPARRA INCASSATA:\n' +
      buildPayUrl(eventId) + '\n' +
      '========================================\n' +
      'Festeggiato: ' + (data.festeggiato || '-') + '\n' +
      'Età: ' + (data.anni ? data.anni + ' anni' : '-') + '\n' +
      'Orario Gioco Bowling: ' + data.ora + ' - ' + gameEndStr + ' (' + durataReadable + ')\n' +
      (CLEANING_BUFFER_MS > 0 ? 'Rassetto Piste: Piste libere alle ' + cleanEndStr + '\n' : '') +
      'Totale Stimato Festa: €' + (typeof data.totale === 'number' ? data.totale.toFixed(2) : data.totale) + '\n' +
      '----------------------------------------\n' +
      'Genitore / Cliente: ' + data.cliente + '\n' +
      'Tel: ' + data.telefono + '\n' +
      'Email: ' + data.email + '\n' +
      'Partecipanti: ' + data.partecipanti + ' persone\n' +
      'Menu: ' + data.menu + (data.patatine === 'Sì' ? ' + Patatine' : '') + '\n' +
      'Torta: ' + data.torta + (data.foto_torta === 'Sì' ? ' (+ Foto)' : '') + '\n' +
      'Scritta Torta: ' + (data.scritta_torta || '-') + '\n' +
      'Allergie / Intolleranze: ' + (data.dettagli_allergie || 'Nessuna') + '\n' +
      'Note / Richieste: ' + (data.altre_richieste || '-');
  };

  const calendar = CalendarApp.getCalendarById(props.calendarId);
  if (calendar) {
    const event = calendar.createEvent(title, start, end, { description: buildDesc('') });
    try {
      // Imposta il colore iniziale su ROSSO (Caparra non ancora versata)
      event.setColor(CalendarApp.EventColor.RED);
    } catch (e) {
      console.warn('Impossibile impostare il colore dell\'evento:', e);
    }
    const newId = event.getId();
    try {
      // Aggiorna la descrizione includendo l'ID evento nel link cassa
      event.setDescription(buildDesc(newId));
    } catch (eDesc) {
      console.warn('Impossibile aggiornare la descrizione con ID evento:', eDesc);
    }
    return newId;
  }
  return null;
}

// =========================================================================
// INTERFACCIA WEB MOBILE CASSA: Form per Inserimento Importo Caparra
// =========================================================================
/**
 * Risolve in modo intelligente la riga esatta del foglio anche se sono state eliminate righe.
 * Confronta prima per eventId (colonna 28), poi per nome festeggiato/cliente, infine per numero di riga.
 */
function resolveRowAndData(sheet, params) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const maxCol  = Math.max(sheet.getLastColumn(), 28);
  const allRows = sheet.getRange(1, 1, lastRow, maxCol).getValues();

  const reqRow         = parseInt(params.row, 10) || 0;
  const reqEventId     = String(params.eventId || '').trim().replace(/@google\.com$/, '');
  const reqFesteggiato = String(params.festeggiato || '').trim().toLowerCase();
  const reqCliente     = String(params.cliente || '').trim().toLowerCase();

  // 1. Se la riga richiesta corrisponde già a eventId o festeggiato, usala subito
  if (reqRow >= 2 && reqRow <= lastRow) {
    const candidate = allRows[reqRow - 1];
    const candEvId  = String(candidate[27] || '').trim().replace(/@google\.com$/, '');
    const candFest  = String(candidate[1] || '').trim().toLowerCase();

    if (reqEventId && candEvId && candEvId === reqEventId) {
      return { row: reqRow, rowData: candidate };
    }
    if (reqFesteggiato && candFest === reqFesteggiato) {
      return { row: reqRow, rowData: candidate };
    }
    if (!reqEventId && !reqFesteggiato) {
      return { row: reqRow, rowData: candidate };
    }
  }

  // 2. Se sono state eliminate righe e il numero è slittato, cerca per eventId su tutto il foglio
  if (reqEventId) {
    for (let r = lastRow; r >= 2; r--) {
      const candEvId = String(allRows[r - 1][27] || '').trim().replace(/@google\.com$/, '');
      if (candEvId && candEvId === reqEventId) {
        return { row: r, rowData: allRows[r - 1] };
      }
    }
  }

  // 3. Cerca per festeggiato (+ cliente se presente) partendo dalle prenotazioni più recenti
  if (reqFesteggiato) {
    for (let r = lastRow; r >= 2; r--) {
      const candFest = String(allRows[r - 1][1] || '').trim().toLowerCase();
      const candCli  = String(allRows[r - 1][3] || '').trim().toLowerCase();
      if (candFest === reqFesteggiato && (!reqCliente || candCli.indexOf(reqCliente) !== -1)) {
        return { row: r, rowData: allRows[r - 1] };
      }
    }
  }

  // 4. Fallback sul numero di riga se valido
  if (reqRow >= 2 && reqRow <= lastRow) {
    return { row: reqRow, rowData: allRows[reqRow - 1] };
  }

  return null;
}

function renderPayForm(e) {
  const props = getProps();
  const token = e.parameter.token;

  if (!props.apiSecret || token !== props.apiSecret) {
    return HtmlService.createHtmlOutput('<h3 style="color:red;font-family:sans-serif;text-align:center;margin-top:40px;">Accesso non autorizzato.</h3>');
  }

  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheet    = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const resolved = resolveRowAndData(sheet, e.parameter);

  if (!resolved) {
    return HtmlService.createHtmlOutput('<h3 style="color:red;font-family:sans-serif;text-align:center;margin-top:40px;">Prenotazione non trovata nel foglio.</h3>');
  }

  const row      = resolved.row;
  const rowData  = resolved.rowData;
  const eventId  = e.parameter.eventId || rowData[27] || '';
  const timeZone = Session.getScriptTimeZone() || 'Europe/Rome';

  const rawDataFesta = rowData[6];
  const formattedDataFesta = (rawDataFesta instanceof Date)
    ? Utilities.formatDate(rawDataFesta, timeZone, 'dd/MM/yyyy')
    : String(rawDataFesta || '-');

  const rawOra = rowData[7];
  const formattedOra = (rawOra instanceof Date)
    ? Utilities.formatDate(rawOra, timeZone, 'HH:mm')
    : String(rawOra || '-');

  const rawDataIncasso = rowData[25];
  const formattedDataIncasso = (rawDataIncasso instanceof Date)
    ? Utilities.formatDate(rawDataIncasso, timeZone, 'dd/MM/yyyy HH:mm')
    : String(rawDataIncasso || '-');

  const festeggiato  = escapeHtml(rowData[1] || '-');
  const anni         = escapeHtml(rowData[2] || '');
  const cliente      = escapeHtml(rowData[3] || '-');
  const telefono     = escapeHtml(rowData[4] || '-');
  const dataFesta    = escapeHtml(formattedDataFesta);
  const ora          = escapeHtml(formattedOra);
  const totaleNum    = parseFloat(rowData[15]) || 0;
  const statoCaparra = String(rowData[21] || 'IN ATTESA').toUpperCase();
  const caparraNum   = parseFloat(rowData[22]) || 0;
  const saldoNum     = parseFloat(rowData[23]) || Math.max(0, totaleNum - caparraNum);
  const dataIncasso  = escapeHtml(formattedDataIncasso);
  const metodoPag    = escapeHtml(rowData[24] || '-');
  const cognome      = escapeHtml(String(rowData[3] || 'CLIENTE').trim().split(/\s+/).pop().toUpperCase());

  // Se la caparra è già stata registrata, mostra la schermata riepilogativa
  if (statoCaparra === 'VERSATA') {
    const htmlAlready = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Caparra Già Registrata - Bowling Valdera</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #2d3748; }
          .card { max-width: 480px; margin: 20px auto; background: #fff; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); overflow: hidden; }
          .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 25px 20px; text-align: center; }
          .content { padding: 25px; line-height: 1.6; }
          .badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; padding: 6px 14px; border-radius: 20px; font-size: 14px; }
          .info-box { background: #f8fafc; border-radius: 12px; padding: 15px; margin: 15px 0; border-left: 4px solid #16a34a; }
          .total { font-size: 20px; font-weight: bold; color: #15803d; }
          .rem { font-size: 18px; font-weight: bold; color: #b91c1c; }
          .btn-cal { display: block; margin-top: 18px; background: #0284c7; color: #fff; padding: 14px; border-radius: 12px; font-weight: bold; text-decoration: none; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2 style="margin:0;">🎳 Bowling Valdera</h2>
            <p style="margin:5px 0 0 0; opacity:0.9;">Gestione Cassa Compleanni</p>
          </div>
          <div class="content" style="text-align: center;">
            <p><span class="badge">✅ CAPARRA GIÀ REGISTRATA</span></p>
            <h3 style="margin:10px 0;">Festa di ${festeggiato} ${anni ? '('+anni+' anni)' : ''}</h3>
            <p style="color:#64748b; margin-top:0;">Genitore: <strong>${cliente}</strong> &bull; Tel: <a href="tel:${telefono}">${telefono}</a></p>
            
            <div class="info-box" style="text-align: left;">
              <p style="margin:4px 0;">📅 <strong>Data Festa:</strong> ${dataFesta} ore ${ora}</p>
              <p style="margin:4px 0;">💰 <strong>Caparra Incassata:</strong> <span class="total">€ ${caparraNum.toFixed(2)}</span> (${metodoPag})</p>
              <p style="margin:4px 0;">🕒 <strong>Registrata il:</strong> ${dataIncasso}</p>
              <hr style="border:0; border-top:1px dashed #cbd5e1; margin:10px 0;">
              <p style="margin:4px 0;">💳 <strong>Saldo Rimanente alla Festa:</strong> <span class="rem">€ ${saldoNum.toFixed(2)}</span></p>
            </div>
            
            <p style="color:#475569; font-size:14px;">L'evento su Google Calendar è confermato in <strong style="color:#16a34a;">VERDE (${cognome} - ${ora} CAPARRA OK)</strong>.</p>
            <button type="button" onclick="window.top.close(); window.close();" class="btn-cal" style="width:100%; border:none; cursor:pointer;">✖ Chiudi questa scheda</button>
          </div>
        </div>
      </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(htmlAlready)
      .setTitle('Caparra Già Registrata - Bowling Valdera')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Schermata Cassa per inserire la caparra (100% autonoma, senza reindirizzamenti al sito Wix)
  const htmlForm = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registra Caparra - Bowling Valdera</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #0f172a; margin: 0; padding: 15px; color: #1e293b; }
        .card { max-width: 480px; margin: 10px auto; background: #ffffff; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); overflow: hidden; }
        .header { background: linear-gradient(135deg, #b71c1c 0%, #880e4f 100%); color: white; padding: 22px 20px; text-align: center; }
        .header.success-hdr { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); }
        .content { padding: 22px; }
        .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; line-height: 1.5; font-size: 14px; }
        .label { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: block; }
        .input-group { margin-bottom: 18px; }
        .input-text { width: 100%; box-sizing: border-box; padding: 14px 16px; font-size: 22px; font-weight: bold; color: #0f172a; border: 2px solid #cbd5e1; border-radius: 12px; outline: none; transition: border-color 0.2s; }
        .input-text:focus { border-color: #b71c1c; }
        .quick-btns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
        .q-btn { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: #334155; }
        .q-btn:active { background: #e2e8f0; }
        .radio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
        .radio-card { border: 2px solid #e2e8f0; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .radio-card input { margin: 0; width: 18px; height: 18px; }
        .btn-submit { width: 100%; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; border: none; padding: 16px; font-size: 17px; font-weight: bold; border-radius: 12px; cursor: pointer; margin-top: 15px; box-shadow: 0 4px 15px rgba(22,163,74,0.35); }
        .btn-submit:disabled { opacity: 0.65; cursor: wait; }
        .total-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: left; }
        .btn-cal { display: block; margin-top: 18px; background: #0284c7; color: #fff; padding: 14px; border-radius: 12px; font-weight: bold; text-decoration: none; text-align: center; }
        .err-box { display: none; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 10px; margin-top: 12px; font-size: 14px; font-weight: 600; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header" id="cardHeader">
          <h2 style="margin:0; font-size: 22px;" id="headerTitle">🎳 Registrazione Caparra</h2>
          <p style="margin:4px 0 0 0; opacity:0.85; font-size: 14px;">Cassa Compleanni &bull; Bowling Valdera</p>
        </div>

        <div class="content" id="formView">
          <div class="summary-box">
            <div style="font-size: 16px; font-weight: bold; color: #b71c1c; margin-bottom: 4px;">Festa di ${festeggiato} ${anni ? '('+anni+' anni)' : ''}</div>
            <div>Genitore: <strong>${cliente}</strong> (Tel: <a href="tel:${telefono}">${telefono}</a>)</div>
            <div>Data Festa: 📅 <strong>${dataFesta}</strong> ore <strong>${ora}</strong></div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 15px;">
              Totale Stimato Festa: <strong>€ ${totaleNum.toFixed(2)}</strong>
            </div>
          </div>

          <form id="cassaForm" onsubmit="return submitDeposit(event)">
            <div class="input-group">
              <label class="label" for="amount">Importo Caparra Ricevuta (€):</label>
              <input type="number" id="amount" name="amount" class="input-text" step="0.50" min="1" max="${totaleNum > 0 ? totaleNum * 2 : 1000}" value="50.00" required>
              <div class="quick-btns">
                <button type="button" class="q-btn" onclick="setVal(30)">30 €</button>
                <button type="button" class="q-btn" onclick="setVal(50)">50 €</button>
                <button type="button" class="q-btn" onclick="setVal(100)">100 €</button>
                <button type="button" class="q-btn" onclick="setVal(${totaleNum})">Totale</button>
              </div>
            </div>

            <div class="input-group">
              <label class="label">Metodo di Pagamento:</label>
              <div class="radio-grid">
                <label class="radio-card">
                  <input type="radio" name="method" value="Contanti" checked> Contanti
                </label>
                <label class="radio-card">
                  <input type="radio" name="method" value="POS / Carta"> Carta / POS
                </label>
                <label class="radio-card">
                  <input type="radio" name="method" value="Satispay"> Satispay
                </label>
                <label class="radio-card">
                  <input type="radio" name="method" value="Bonifico"> Bonifico
                </label>
              </div>
            </div>

            <button type="submit" id="submitBtn" class="btn-submit">
              🟢 REGISTRA INCASSO E CONFERMA
            </button>
            <div id="errBox" class="err-box"></div>
          </form>
        </div>

        <div class="content" id="successView" style="display:none; text-align:center;">
          <div style="font-size: 52px; margin-bottom: 8px;">🎉</div>
          <h2 style="color: #15803d; margin: 0 0 8px 0;">Caparra Registrata!</h2>
          <p style="color: #64748b; margin: 0;">Festa di <strong>${festeggiato}</strong> (${cliente})</p>

          <div class="total-box">
            <p style="margin: 4px 0; font-size: 15px; color: #166534;">💰 Caparra incassata: <strong id="resAmount">€ 50.00</strong> (<span id="resMethod">Contanti</span>)</p>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;">🕒 Registrata il: <span id="resTime">-</span></p>
            <hr style="border: 0; border-top: 1px dashed #86efac; margin: 8px 0;">
            <p style="margin: 4px 0; font-size: 16px; font-weight: bold; color: #14532d;">💳 Saldo rimanente alla festa: <span id="resSaldo">€ 0.00</span></p>
          </div>

          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            🟢 Evento su Google Calendar aggiornato in <strong>VERDE</strong>:<br>
            <strong id="resCalTitle">${cognome} - ${ora} (CAPARRA OK)</strong>
          </p>

          <button type="button" onclick="window.top.close(); window.close();" class="btn-cal" style="width:100%; border:none; cursor:pointer;">✖ Chiudi questa scheda</button>
        </div>
      </div>

      <script>
        var ROW_NUM = ${row};
        var TOKEN_STR = "${escapeHtml(token)}";
        var EVENT_ID_STR = "${escapeHtml(eventId)}";
        var WEBAPP_URL = "${props.webAppUrl}";

        function setVal(v) {
          if (v && v > 0) {
            document.getElementById('amount').value = parseFloat(v).toFixed(2);
          }
        }

        function showSuccess(res) {
          document.getElementById('cardHeader').className = 'header success-hdr';
          document.getElementById('headerTitle').textContent = '✅ Caparra Confermata';
          document.getElementById('formView').style.display = 'none';
          document.getElementById('successView').style.display = 'block';
          document.getElementById('resAmount').textContent = '€ ' + parseFloat(res.amount || 0).toFixed(2);
          document.getElementById('resMethod').textContent = res.method || 'Contanti';
          document.getElementById('resTime').textContent = res.nowFormatted || '';
          document.getElementById('resSaldo').textContent = '€ ' + parseFloat(res.saldoRimanente || 0).toFixed(2);
          if (res.updatedTitle) {
            document.getElementById('resCalTitle').textContent = res.updatedTitle;
          }
          setTimeout(function() {
            try { window.top.close(); } catch (e) {}
            try { window.close(); } catch (e) {}
          }, 800);
        }

        function showError(msg) {
          var btn = document.getElementById('submitBtn');
          btn.disabled = false;
          btn.textContent = '🟢 REGISTRA INCASSO E CONFERMA';
          var eb = document.getElementById('errBox');
          eb.textContent = 'Errore: ' + msg;
          eb.style.display = 'block';
        }

        function submitDeposit(ev) {
          if (ev) ev.preventDefault();
          var btn = document.getElementById('submitBtn');
          var eb = document.getElementById('errBox');
          eb.style.display = 'none';

          var amountVal = parseFloat(document.getElementById('amount').value) || 50;
          var methodInputs = document.getElementsByName('method');
          var methodVal = 'Contanti';
          for (var i = 0; i < methodInputs.length; i++) {
            if (methodInputs[i].checked) {
              methodVal = methodInputs[i].value;
              break;
            }
          }

          btn.disabled = true;
          btn.textContent = '⏳ Registrazione su Calendar in corso...';

          var payload = {
            row: ROW_NUM,
            amount: amountVal,
            method: methodVal,
            token: TOKEN_STR,
            eventId: EVENT_ID_STR
          };

          if (typeof google !== 'undefined' && google.script && google.script.run) {
            google.script.run
              .withSuccessHandler(function(res) {
                if (res && res.success) {
                  showSuccess(res);
                } else {
                  showError((res && res.error) ? res.error : 'Impossibile salvare la caparra.');
                }
              })
              .withFailureHandler(function(err) {
                showError(err && err.message ? err.message : String(err));
              })
              .processDepositFromCassa(payload);
          } else {
            var url = WEBAPP_URL +
              '?action=save_deposit&format=json' +
              '&row=' + encodeURIComponent(ROW_NUM) +
              '&amount=' + encodeURIComponent(amountVal) +
              '&method=' + encodeURIComponent(methodVal) +
              '&eventId=' + encodeURIComponent(EVENT_ID_STR) +
              '&token=' + encodeURIComponent(TOKEN_STR);
            fetch(url)
              .then(function(r) { return r.json(); })
              .then(function(res) {
                if (res && res.success) {
                  showSuccess(res);
                } else {
                  showError((res && res.error) ? res.error : 'Errore salvataggio.');
                }
              })
              .catch(function(err) {
                showError(err.message || 'Errore di rete');
              });
          }
          return false;
        }
      </script>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(htmlForm)
    .setTitle('Registra Caparra - Bowling Valdera')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Funzione chiamata direttamente dal form Cassa (tramite google.script.run)
 * per registrare la caparra, colorare l'evento in VERDE su Calendar e inviare la ricevuta.
 */
/**
 * Trova l'evento Google Calendar associato a una riga del foglio,
 * cercando prima per eventId e, se assente, per data/ora/festeggiato/cognome.
 */
function findCalendarEventForRow(calendar, rowData, fallbackEventId, timeZone) {
  if (!calendar) return null;
  const evId = String(fallbackEventId || rowData[27] || '').trim();
  if (evId) {
    try {
      let ev = calendar.getEventById(evId);
      if (!ev && evId.indexOf('@') === -1) {
        ev = calendar.getEventById(evId + '@google.com');
      }
      if (ev) return ev;
    } catch (eId) {}
  }

  // Fallback: cerca l'evento nel giorno della festa (colonna 7, indice 6)
  const rawDate = rowData[6];
  if (!rawDate) return null;

  let isoDate = '';
  if (rawDate instanceof Date) {
    isoDate = Utilities.formatDate(rawDate, timeZone, 'yyyy-MM-dd');
  } else {
    isoDate = normalizeDateToIso(String(rawDate).replace(/\//g, '-'));
  }
  if (!isoDate || isoDate.length < 8) return null;

  const dayStart = new Date(isoDate + 'T00:00:00');
  const dayEnd   = new Date(isoDate + 'T23:59:59');
  if (isNaN(dayStart.getTime())) return null;

  const rawOra = rowData[7];
  const oraStr = (rawOra instanceof Date)
    ? Utilities.formatDate(rawOra, timeZone, 'HH:mm')
    : String(rawOra || '').trim();
  const festeggiato = String(rowData[1] || '').trim().toLowerCase();
  const cliente     = String(rowData[3] || '').trim().toLowerCase();
  const cognome     = cliente ? cliente.split(/\s+/).pop() : '';

  const events = calendar.getEvents(dayStart, dayEnd);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.isAllDayEvent()) continue;
    const evStartStr = Utilities.formatDate(ev.getStartTime(), timeZone, 'HH:mm');
    const titleLower = (ev.getTitle() || '').toLowerCase();
    const descLower  = (ev.getDescription() || '').toLowerCase();

    if (oraStr && evStartStr === oraStr) return ev;
    if (festeggiato && descLower.indexOf(festeggiato) !== -1) return ev;
    if (cognome && titleLower.indexOf(cognome) !== -1) return ev;
  }
  return null;
}

/**
 * Ripara automaticamente tutti gli eventi già presenti su Google Calendar
 * sostituendo i vecchi link (vercel.app o bowlingvaldera.com/compleanni-2)
 * con il nuovo link diretto funzionante della Cassa Google Apps Script.
 */
function repairAllCalendarLinks() {
  const props    = getProps();
  const timeZone = Session.getScriptTimeZone() || 'Europe/Rome';
  const calendar = CalendarApp.getCalendarById(props.calendarId) || CalendarApp.getDefaultCalendar();
  if (!calendar) return { success: false, error: 'Calendario non trovato' };

  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, updatedCount: 0, details: [] };

  const maxCol  = Math.max(sheet.getLastColumn(), 28);
  const allData = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
  const details = [];
  let updatedCount = 0;

  for (let i = 0; i < allData.length; i++) {
    const rowNum  = i + 2;
    const rowData = allData[i];
    const fest    = String(rowData[1] || '').trim();
    const cli     = String(rowData[3] || '').trim();
    const stato   = String(rowData[21] || 'IN ATTESA').toUpperCase();

    if (!fest && !cli) continue;

    try {
      const ev = findCalendarEventForRow(calendar, rowData, rowData[27], timeZone);
      if (!ev) {
        details.push({ row: rowNum, festeggiato: fest, cliente: cli, status: 'EVENTO_NON_TROVATO_SU_CALENDAR' });
        continue;
      }

      const evId = ev.getId();
      if (!rowData[27] && evId) {
        try { sheet.getRange(rowNum, 28).setValue(evId); } catch (eSet) {}
      }

      const rawDataFesta = rowData[6];
      const fmtDataFesta = (rawDataFesta instanceof Date) ? Utilities.formatDate(rawDataFesta, timeZone, 'dd/MM/yyyy') : String(rawDataFesta || '');
      const rawOra = rowData[7];
      const fmtOra = (rawOra instanceof Date) ? Utilities.formatDate(rawOra, timeZone, 'HH:mm') : String(rawOra || '');
      const totNum = parseFloat(rowData[15]) || 0;
      const cognome = cli ? cli.split(/\s+/).pop().toUpperCase() : 'PRENOTAZIONE';

      const correctUrl = 'https://app-compleanni-bowling.vercel.app/cassa.html' +
        '?row=' + rowNum +
        '&cognome=' + encodeURIComponent(cognome) +
        '&cliente=' + encodeURIComponent(cli) +
        '&festeggiato=' + encodeURIComponent(fest) +
        '&anni=' + encodeURIComponent(rowData[2] || '') +
        '&telefono=' + encodeURIComponent(rowData[4] || '') +
        '&data=' + encodeURIComponent(fmtDataFesta) +
        '&ora=' + encodeURIComponent(fmtOra) +
        '&totale=' + encodeURIComponent(totNum.toFixed(2)) +
        '&eventId=' + encodeURIComponent(evId) +
        '&token=' + encodeURIComponent(props.apiSecret);

      const desc = ev.getDescription() || '';
      if (stato !== 'VERSATA' && desc.indexOf(correctUrl) === -1) {
        let newDesc = desc.replace(/https?:\/\/[^\s\n]+/g, function(matchedUrl) {
          if (
            matchedUrl.indexOf('vercel.app') !== -1 ||
            matchedUrl.indexOf('compleanni-2') !== -1 ||
            matchedUrl.indexOf('action=pay_form') !== -1 ||
            matchedUrl.indexOf('cassa') !== -1
          ) {
            return correctUrl;
          }
          return matchedUrl;
        });

        if (newDesc === desc && desc.indexOf('CLICCA QUI PER REGISTRARE') === -1) {
          newDesc = '🔴 STATO CAPARRA: IN ATTESA (Da versare)\n' +
            '👉 CLICCA QUI PER REGISTRARE LA CAPARRA INCASSATA:\n' +
            correctUrl + '\n' +
            '========================================\n' + desc;
        }

        if (newDesc !== desc) {
          try {
            ev.setDescription(newDesc);
            updatedCount++;
            console.log('✅ Riga ' + rowNum + ' (' + fest + '): Link caparra aggiornato su Google Calendar.');
            details.push({ row: rowNum, festeggiato: fest, cliente: cli, title: ev.getTitle(), status: 'LINK_AGGIORNATO', url: correctUrl });
          } catch (eDesc) {
            console.warn('⚠️ Riga ' + rowNum + ' (' + fest + '): Impossibile modificare descrizione evento (' + eDesc.message + ').');
            details.push({ row: rowNum, festeggiato: fest, cliente: cli, title: ev.getTitle(), status: 'ERRORE_MODIFICA_DESC: ' + eDesc.message, url: correctUrl });
          }
        } else {
          details.push({ row: rowNum, festeggiato: fest, cliente: cli, title: ev.getTitle(), status: 'GIA_ALLINEATO', url: correctUrl });
        }
      } else {
        // Se la caparra è già versata e il titolo ha il doppio pallino emoji "🟢 ", lo rimuove lasciando solo il colore verde dell'evento
        if (stato === 'VERSATA') {
          try {
            ev.setColor(CalendarApp.EventColor.GREEN);
            const curTitle = ev.getTitle() || '';
            if (/^[🟢🔴🟡\s]+/.test(curTitle)) {
              ev.setTitle(curTitle.replace(/^[🟢🔴🟡\s]+/, '').trim());
              updatedCount++;
            }
          } catch (eClean) {}
        }
        details.push({ row: rowNum, festeggiato: fest, cliente: cli, title: ev.getTitle(), status: stato === 'VERSATA' ? 'CAPARRA_GIA_VERSATA' : 'GIA_ALLINEATO', url: correctUrl });
      }
    } catch (errRow) {
      console.warn('Errore riga ' + rowNum + ':', errRow.message);
      details.push({ row: rowNum, festeggiato: fest, cliente: cli, status: 'ERRORE_RIGA: ' + errRow.message });
    }
  }

  console.log('>>> RIPARAZIONE COMPLETATA! Eventi aggiornati: ' + updatedCount + ' <<<');
  return { success: true, updatedCount: updatedCount, details: details };
}

function processDepositFromCassa(params) {
  return saveDepositCore(params || {});
}

// =========================================================================
// SALVATAGGIO DELLA CAPARRA REGISTRATA DALL'OPERATORE
// =========================================================================
function saveDepositCore(params) {
  const props = getProps();
  const token = params.token;

  if (!props.apiSecret || token !== props.apiSecret) {
    return { success: false, error: 'Non autorizzato (token non valido).' };
  }

  const amount = parseFloat(params.amount) || 50.0;
  const method = sanitizeForSheet(params.method || 'Contanti');

  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheet    = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const resolved = resolveRowAndData(sheet, params);
  if (!resolved) {
    return { success: false, error: 'Prenotazione non trovata nel foglio.' };
  }

  const row     = resolved.row;
  const rowData = resolved.rowData;

  const festeggiato   = rowData[1];
  const cliente       = rowData[3];
  const customerEmail = rowData[5];
  const totaleNum     = parseFloat(rowData[15]) || 0;
  const eventId       = rowData[27] || params.eventId; // Col 28 (0-indexed: 27) oppure parametro dal link cassa

  const saldoRimanente = Math.max(0, totaleNum - amount);
  const now = new Date();
  const timeZone = Session.getScriptTimeZone() || 'Europe/Rome';
  const nowFormatted = Utilities.formatDate(now, timeZone, 'dd/MM/yyyy HH:mm');

  // 1. Aggiorna Google Sheets in un'unica operazione batch super-veloce
  sheet.getRange(row, 22, 1, 6).setValues([[
    'VERSATA',
    amount,
    saldoRimanente,
    method,
    nowFormatted,
    'ANNULLATO (Caparra già incassata)'
  ]]);

  let updatedTitle = '';

  // 2. Aggiorna Google Calendar (Colore VERDE, Titolo aggiornato e dettagli saldo)
  try {
    const calendar = CalendarApp.getCalendarById(props.calendarId) || CalendarApp.getDefaultCalendar();
    if (calendar) {
      const event = findCalendarEventForRow(calendar, rowData, eventId, timeZone);
      if (event) {
        // Cambia colore del pallino nativo di Google Calendar in VERDE (GREEN) senza aggiungere un secondo pallino nel titolo
        event.setColor(CalendarApp.EventColor.GREEN);

        // Aggiorna titolo evento nel formato "ROSSI - 18:00 (CAPARRA OK)" (senza emoji pallino iniziale)
        try {
          const rawTitle = event.getTitle() || '';
          let cleanTitle = rawTitle.replace(/^[🟢🔴🟡\s]+/, '').replace(/\s*\([^)]*\)$/, '').trim();
          if (!cleanTitle) {
            const cognome = (rowData[3] || 'PRENOTAZIONE').toString().trim().split(/\s+/).pop();
            const rawOra = rowData[7];
            const ora = (rawOra instanceof Date) ? Utilities.formatDate(rawOra, timeZone, 'HH:mm') : String(rawOra || '');
            cleanTitle = cognome.toUpperCase() + (ora ? ' - ' + ora : '');
          }
          updatedTitle = cleanTitle + ' (CAPARRA OK)';
          event.setTitle(updatedTitle);
        } catch (eTitle) {
          console.warn('Errore aggiornamento titolo evento Calendar:', eTitle);
        }

        const currentDesc = event.getDescription() || '';
        const updatedHeader = 
          '🟢 STATO CAPARRA: VERSATA E CONFERMATA ✅\n' +
          '💰 Caparra Incassata: € ' + amount.toFixed(2) + ' (' + method + ')\n' +
          '🕒 Registrata il: ' + nowFormatted + '\n' +
          '💳 SALDO RIMANENTE DA INCASSARE ALLA FESTA: € ' + saldoRimanente.toFixed(2) + '\n' +
          '========================================\n';

        // Rimuove eventuale vecchio blocco di stato caparra e il relativo link
        let strippedDesc = currentDesc;
        const festIdx = strippedDesc.indexOf('Festeggiato:');
        if (festIdx !== -1) {
          strippedDesc = strippedDesc.substring(festIdx);
        } else {
          strippedDesc = strippedDesc.replace(/^🔴 STATO CAPARRA[\s\S]*?========================================\r?\n?/, '');
        }
        event.setDescription(updatedHeader + strippedDesc);
      }
    }
  } catch (errCal) {
    console.warn('Errore durante l\'aggiornamento di Google Calendar:', errCal);
  }

  // 3. Invia email di conferma/ricevuta al cliente
  if (customerEmail && String(customerEmail).indexOf('@') !== -1) {
    try {
      const receiptSubject = 'Caparra Ricevuta - Festa di ' + festeggiato + ' al Bowling Valdera';
      const receiptHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #1b5e20; color: white; padding: 20px; text-align: center;">
            <h2 style="margin:0;">Caparra Ricevuta con Successo! &#x1F389;</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Bowling Valdera</p>
          </div>
          <div style="padding: 25px; line-height: 1.6;">
            <p>Gentile <strong>${escapeHtml(cliente)}</strong>,</p>
            <p>ti confermiamo di aver registrato il versamento della caparra per la festa di compleanno di <strong>${escapeHtml(festeggiato)}</strong>!</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #2e7d32; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 4px 0;">💰 <strong>Importo Caparra Versata:</strong> &euro;${amount.toFixed(2)} (${escapeHtml(method)})</p>
              <p style="margin: 4px 0;">🕒 <strong>Data Registrazione:</strong> ${nowFormatted}</p>
              <hr style="border:0; border-top: 1px dashed #cbd5e1; margin: 10px 0;">
              <p style="margin: 4px 0; font-size: 16px;">💳 <strong>Saldo Rimanente da versare il giorno della festa:</strong> <strong style="color: #1b5e20;">&euro;${saldoRimanente.toFixed(2)}</strong></p>
            </div>

            <p>La prenotazione è ora confermata al 100%! Vi aspettiamo per una giornata indimenticabile di divertimento e strike!</p>
            <p style="margin-top: 25px;">A presto,<br><strong>Staff Bowling Valdera</strong></p>
          </div>
        </div>
      `;
      const receiptPlain = `Gentile ${cliente},\nti confermiamo la ricezione della caparra di €${amount.toFixed(2)} per la festa di ${festeggiato}.\nSaldo rimanente da saldare alla festa: €${saldoRimanente.toFixed(2)}.\nGrazie e a presto!\nBowling Valdera`;
      safeSendEmail(customerEmail, receiptSubject, receiptPlain, receiptHtml, props);
    } catch (eMail) {
      console.warn('Errore invio ricevuta caparra al cliente:', eMail);
    }
  }

  return {
    success: true,
    festeggiato: festeggiato,
    cliente: cliente,
    amount: amount,
    saldoRimanente: saldoRimanente,
    method: method,
    nowFormatted: nowFormatted,
    updatedTitle: updatedTitle
  };
}

function handleSaveDeposit(e) {
  const result = saveDepositCore({
    token:       e.parameter.token,
    row:         e.parameter.row,
    amount:      e.parameter.amount,
    method:      e.parameter.method,
    eventId:     e.parameter.eventId,
    festeggiato: e.parameter.festeggiato,
    cliente:     e.parameter.cliente
  });

  if (!result.success) {
    if (e.parameter.format === 'json') {
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    return HtmlService.createHtmlOutput('<h3 style="color:red;text-align:center;margin-top:40px;">' + escapeHtml(result.error) + '</h3>');
  }

  if (e.parameter.format === 'json') {
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }

  const successHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Caparra Registrata</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #1e293b; text-align: center; }
        .card { max-width: 440px; margin: 20px auto; background: #fff; border-radius: 20px; padding: 30px 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .icon { font-size: 54px; margin-bottom: 10px; }
        .total-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 15px; margin: 20px 0; }
        .btn-cal { display: block; margin-top: 18px; background: #0284c7; color: #fff; padding: 14px; border-radius: 12px; font-weight: bold; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🎉</div>
        <h2 style="color: #15803d; margin: 0 0 10px 0;">Caparra Registrata!</h2>
        <p style="color: #64748b; margin: 0;">Festa di <strong>${escapeHtml(result.festeggiato)}</strong></p>
        
        <div class="total-box">
          <p style="margin: 4px 0; font-size: 15px; color: #166534;">Caparra incassata: <strong>€ ${result.amount.toFixed(2)}</strong> (${escapeHtml(result.method)})</p>
          <hr style="border: 0; border-top: 1px dashed #86efac; margin: 8px 0;">
          <p style="margin: 4px 0; font-size: 16px; font-weight: bold; color: #14532d;">Rimanente da incassare alla festa: € ${result.saldoRimanente.toFixed(2)}</p>
        </div>

        <p style="font-size: 14px; color: #475569;">
          🟢 Evento Calendar aggiornato in <strong>VERDE</strong>.
        </p>

        <a href="https://calendar.google.com/calendar/r" target="_top" class="btn-cal">👉 Torna a Google Calendar</a>
      </div>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(successHtml);
}

// =========================================================================
// AUTOMAZIONE PROMEMORIA 12 ORE (Controllo e Invio Automatico)
// =========================================================================

/**
 * Parser resiliente per date e timestamp da Google Sheets.
 * Gestisce oggetti Date nativi, formati numerici epoch, e stringhe sia in formato ISO
 * (YYYY-MM-DD HH:mm:ss) sia in formato italiano/europeo (DD/MM/YYYY HH:mm:ss o DD-MM-YYYY HH:mm:ss).
 */
function parseTimestampSafe(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return new Date(val);

  const str = String(val).trim();
  // 1. Prova parsing nativo ISO / US
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // 2. Prova formato data/ora italiano: DD/MM/YYYY o DD-MM-YYYY con HH:mm[:ss]
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const day     = parseInt(match[1], 10);
    const month   = parseInt(match[2], 10) - 1;
    const year    = parseInt(match[3], 10);
    const hours   = match[4] ? parseInt(match[4], 10) : 0;
    const minutes = match[5] ? parseInt(match[5], 10) : 0;
    const seconds = match[6] ? parseInt(match[6], 10) : 0;
    d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Assicura che il trigger temporizzato per il promemoria sia installato e attivo.
 */
function ensureDepositTriggerInstalled() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkAndSendDepositReminders') {
        return true;
      }
    }
    setupDepositTrigger();
    return true;
  } catch (err) {
    console.warn('Impossibile verificare/creare trigger in automatico:', err);
    return false;
  }
}

/**
 * Funzione schedulata (Trigger periodico ogni 10 minuti o chiamata diagnostica on-demand):
 * Controlla tutte le prenotazioni: se sono trascorsi 30 minuti e la caparra non è ancora
 * stata registrata (e il promemoria non è mai stato inviato), invia la mail amichevole di promemoria.
 */
function checkAndSendDepositReminders(options) {
  options = options || {};
  const props = getProps();
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const lastRow = sheet.getLastRow();

  const report = {
    totalRows: Math.max(0, lastRow - 1),
    evaluatedRows: 0,
    sentCount: 0,
    skippedCount: 0,
    actions: []
  };

  if (lastRow < 2) return report;

  const maxCol = Math.max(sheet.getLastColumn(), 28);
  const dataRange = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
  const now = new Date();
  
  // Default 12 ore (personalizzabile via parametro options.minHours o options.minMinutes)
  const minDelayMs = (typeof options.minHours === 'number')
    ? (options.minHours * 60 * 60 * 1000)
    : (typeof options.minMinutes === 'number' ? (options.minMinutes * 60 * 1000) : (12 * 60 * 60 * 1000));
  const maxDelayMs = 72 * 60 * 60 * 1000; // 3 giorni max per evitare prenotazioni storiche
  const logoUrl = 'https://static.wixstatic.com/media/f8ebda_855a92753e0446558b7d1137bc653197~mv2.png';

  for (let i = 0; i < dataRange.length; i++) {
    const row = dataRange[i];
    const rowIndex = i + 2;

    if (options.forceRow && rowIndex !== options.forceRow) {
      continue;
    }

    report.evaluatedRows++;

    const rowTimestamp    = row[0];  // Col 1: Timestamp
    const festeggiato     = row[1];  // Col 2: Festeggiato
    const cliente         = row[3];  // Col 4: Cliente
    const email           = (row[5] || '').toString().trim(); // Col 6: Email
    const dataFesta       = row[6];  // Col 7: Data Festa
    const ora             = row[7];  // Col 8: Ora
    const statoCaparra    = (row[21] || '').toString().trim().toUpperCase(); // Col 22: Stato Caparra
    const promemoriaStato = (row[26] || '').toString().trim().toUpperCase(); // Col 27: Stato Promemoria

    // 1. Salta se la caparra è già versata
    if (statoCaparra === 'VERSATA') {
      report.skippedCount++;
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, status: 'SKIPPED: Caparra già versata' });
      continue;
    }

    // 2. Salta se il promemoria è già stato inviato
    const alreadySent = promemoriaStato &&
                        promemoriaStato !== 'NO' &&
                        promemoriaStato !== 'IN ATTESA' &&
                        promemoriaStato !== 'DA INVIARE' &&
                        promemoriaStato !== '-';
    if (alreadySent) {
      report.skippedCount++;
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, status: 'SKIPPED: Promemoria già inviato (' + promemoriaStato + ')' });
      continue;
    }

    if (!email || email.indexOf('@') === -1) {
      report.skippedCount++;
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, status: 'SKIPPED: Email non valida' });
      continue;
    }

    // 3. Parsing resiliente della data di prenotazione
    const bookingDate = parseTimestampSafe(rowTimestamp);
    if (!bookingDate) {
      report.skippedCount++;
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, status: 'SKIPPED: Timestamp non valido (' + rowTimestamp + ')' });
      continue;
    }

    const elapsed = now.getTime() - bookingDate.getTime();
    const elapsedMinutes = Math.floor(elapsed / (60 * 1000));

    // Se non sono ancora passate le ore minime (default 12 ore) e non è forzato
    if (!options.forceRow && elapsed < minDelayMs) {
      const waitMin = Math.ceil((minDelayMs - elapsed) / (60 * 1000));
      const waitHours = (waitMin / 60).toFixed(1);
      const elapsedHours = (elapsedMinutes / 60).toFixed(1);
      report.skippedCount++;
      report.actions.push({
        row: rowIndex,
        festeggiato: festeggiato,
        status: 'IN ATTESA: Mancano ancora ' + waitHours + ' ore (Trascorsi ' + elapsedHours + ' ore / ' + elapsedMinutes + ' min)'
      });
      continue;
    }

    if (!options.forceRow && elapsed > maxDelayMs) {
      report.skippedCount++;
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, status: 'SKIPPED: Prenotazione troppo vecchia (> 3 giorni)' });
      continue;
    }

    // 4. Invio effettivo del promemoria amichevole
    const currentHour = now.getHours();
    const saluto = (currentHour >= 5 && currentHour < 13) ? 'Buongiorno' : ((currentHour >= 13 && currentHour < 18) ? 'Buon pomeriggio' : 'Buonasera');
    const salutoFinale = (currentHour >= 5 && currentHour < 18) ? 'Buona giornata' : 'Buona serata';

    const safeCliente     = escapeHtml(cliente);
    const safeFesteggiato = escapeHtml(festeggiato);
    const safeData        = escapeHtml(dataFesta);
    const safeOra         = escapeHtml(ora);

    const reminderSubject = 'Promemoria prenotazione festa di ' + safeFesteggiato + ' - Bowling Valdera';

    const reminderHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #b71c1c; padding: 20px; text-align: center;">
          <img src="${logoUrl}" alt="Bowling Valdera" style="max-width: 180px;">
        </div>
        <div style="padding: 30px; line-height: 1.6;">
          <h2 style="color: #b71c1c; text-align: center; margin-top: 0;">Promemoria Prenotazione Compleanno &#x1F3B3;</h2>
          <p>${saluto} signor/ra <strong>${safeCliente}</strong>,</p>
          <p>abbiamo ricevuto la sua richiesta di prenotazione per la festa di compleanno di <strong>${safeFesteggiato}</strong> per il giorno <strong>${safeData}</strong> alle ore <strong>${safeOra}</strong> e abbiamo provveduto a registrarla nel nostro calendario!</p>
          
          <div style="background-color: #fff3cd; border: 2px solid #ffeeba; border-left: 6px solid #ffb300; padding: 16px 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #856404; font-weight: bold;">
              &#x26A0;&#xFE0F; Vogliamo ricordarle però che la procedura sarà conclusa e confermata definitivamente solo dopo il versamento di una caparra di 50&euro;, che potrà portare direttamente al Bowling Valdera entro 2 o 3 giorni dalla prenotazione.
            </p>
          </div>

          <p style="font-size: 15px;">
            La ringraziamo per la fiducia concessaci e la aspettiamo!
          </p>
          <p style="font-size: 15px; font-weight: bold; color: #b71c1c; margin-top: 25px;">
            ${salutoFinale},<br>
            Staff Bowling Valdera
          </p>
        </div>
        <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 0.8em; color: #777;">
          <p style="margin: 5px 0;"><strong>Bowling Valdera</strong></p>
          <p style="margin: 5px 0;">Via ToscoRomagnola, 127, Fornacette (PI)</p>
          <p style="margin: 5px 0;">&#x1F4DE; 0587 420120 | &#x1F310; <a href="http://www.bowlingvaldera.com" style="color: #b71c1c;">www.bowlingvaldera.com</a></p>
        </div>
      </div>
    `;

    const reminderPlain = 
`${saluto} signor/ra ${cliente},
abbiamo ricevuto la sua richiesta di prenotazione per la festa di compleanno di ${festeggiato} (in data ${dataFesta} ore ${ora}) e abbiamo provveduto a registrarla nel nostro calendario.

Vogliamo ricordarle però che la procedura sarà conclusa e confermata definitivamente solo dopo il versamento di una caparra di 50€, che potrà portare direttamente al Bowling Valdera entro 2 o 3 giorni dalla prenotazione.

La ringraziamo per la fiducia concessaci e la aspettiamo!
${salutoFinale},

Staff Bowling Valdera
Via ToscoRomagnola, 127, Fornacette (PI) - Tel. 0587 420120`;

    const sent = safeSendEmail(email, reminderSubject, reminderPlain, reminderHtml, props);
    if (sent) {
      const timeZone = Session.getScriptTimeZone() || 'Europe/Rome';
      const sentTime = Utilities.formatDate(now, timeZone, 'dd/MM/yyyy HH:mm');
      sheet.getRange(rowIndex, 27).setValue(sentTime);
      report.sentCount++;
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, email: email, status: 'INVIATO_CON_SUCCESSO alle ' + sentTime });
      console.log('✅ Promemoria caparra inviato con successo a:', email, 'per riga:', rowIndex);
    } else {
      report.actions.push({ row: rowIndex, festeggiato: festeggiato, email: email, status: 'ERRORE_INVIO_MAIL' });
    }
  }

  return report;
}

/**
 * Endpoint GET diagnostico per verificare in tempo reale lo stato dei promemoria
 * e assicurarsi che il trigger sia attivo.
 */
function handleCheckReminders(e) {
  const props = getProps();
  const token = e.parameter.token;
  if (!props.apiSecret || token !== props.apiSecret) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Non autorizzato (token non valido o mancante)' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Verifica se il trigger temporizzato è registrato
  let triggerActive = false;
  let triggerCount = 0;
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkAndSendDepositReminders') {
        triggerActive = true;
        triggerCount++;
      }
    }
  } catch (errTrig) {
    console.warn('Errore lettura triggers:', errTrig);
  }

  // Se richiesto action=setup_trigger o se il trigger non era attivo, installalo subito
  if (!triggerActive || e.parameter.action === 'setup_trigger') {
    try {
      setupDepositTrigger();
      triggerActive = true;
      triggerCount = 1;
    } catch (errSetup) {
      console.warn('Errore setupDepositTrigger:', errSetup);
    }
  }

  // Trigger della cache disponibilità calendario (ricalcolo a ogni modifica + ogni 10 min)
  let availabilityTriggersActive = false;
  try {
    if (e.parameter.action === 'setup_trigger') {
      setupAvailabilityTriggers();
      availabilityTriggersActive = true;
    } else {
      availabilityTriggersActive = ensureAvailabilityTriggersInstalled();
    }
  } catch (errAvail) {
    console.warn('Errore setupAvailabilityTriggers:', errAvail);
  }

  const options = {};
  if (e.parameter.force_row) {
    options.forceRow = parseInt(e.parameter.force_row, 10);
  }
  if (e.parameter.min_minutes !== undefined) {
    options.minMinutes = parseFloat(e.parameter.min_minutes);
  }

  const report = checkAndSendDepositReminders(options);
  report.success = true;
  report.triggerActive = triggerActive;
  report.triggerCount = triggerCount;
  report.availabilityTriggersActive = availabilityTriggersActive;
  report.serverTime = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Rome', 'dd/MM/yyyy HH:mm:ss');

  return ContentService
    .createTextOutput(JSON.stringify(report, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Configura automaticamente il trigger temporizzato (ogni 30 minuti)
 */
function setupDepositTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkAndSendDepositReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkAndSendDepositReminders')
    .timeBased()
    .everyMinutes(30)
    .create();

  console.log('✅ Trigger temporizzato (ogni 30 min) per invio promemoria caparra impostato con successo!');
}

// =========================================================================
// INVIO EMAIL DI CONFERMA INIZIALE ROBUSTO E RESILIENTE
// =========================================================================

function safeSendEmail(recipient, subject, plainText, htmlBody, props) {
  if (!recipient || typeof recipient !== 'string' || recipient.indexOf('@') === -1) {
    console.warn('Indirizzo destinatario mancante o non valido:', recipient);
    return false;
  }

  const replyToEmail = props.senderEmail || 'info@bowlingvaldera.it';
  const senderName   = 'Bowling Valdera';

  // 1. Verifica se l'alias personalizzato è configurato e autorizzato in questo account Gmail
  let isAuthorizedAlias = false;
  try {
    const aliases = GmailApp.getAliases();
    if (replyToEmail && aliases && aliases.indexOf(replyToEmail) !== -1) {
      isAuthorizedAlias = true;
    }
  } catch (e) {
    console.warn('Verifica alias Gmail non disponibile:', e);
  }

  // Tentativo 1: GmailApp con alias "from" (se autorizzato)
  if (isAuthorizedAlias) {
    try {
      GmailApp.sendEmail(recipient, subject, plainText, {
        from: replyToEmail,
        name: senderName,
        replyTo: replyToEmail,
        htmlBody: htmlBody
      });
      console.log('Email inviata con successo via GmailApp (con alias from) a:', recipient);
      return true;
    } catch (errFrom) {
      console.warn('Tentativo con alias from fallito, passo al mittente nativo:', errFrom);
    }
  }

  // Tentativo 2: GmailApp senza "from" non autorizzato
  try {
    GmailApp.sendEmail(recipient, subject, plainText, {
      name: senderName,
      replyTo: replyToEmail,
      htmlBody: htmlBody
    });
    console.log('Email inviata con successo via GmailApp (mittente standard) a:', recipient);
    return true;
  } catch (errGmail) {
    console.warn('Tentativo GmailApp standard fallito, passo a MailApp:', errGmail);
  }

  // Tentativo 3: MailApp
  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: plainText,
      htmlBody: htmlBody,
      name: senderName,
      replyTo: replyToEmail
    });
    console.log('Email inviata con successo via MailApp a:', recipient);
    return true;
  } catch (errMail) {
    console.error('ERRORE DEFINITIVO invio email a ' + recipient + ':', errMail);
    return false;
  }
}

function sendConfirmationEmail(data, props) {
  const recipient   = (data.email || '').trim();
  const adminEmail  = (props.adminEmail || 'info@bowlingvaldera.it').trim();
  const logoUrl     = 'https://static.wixstatic.com/media/f8ebda_855a92753e0446558b7d1137bc653197~mv2.png';

  const cleanFesteggiato = String(data.festeggiato || '').replace(/[\r\n]/g, ' ').trim();
  const customerSubject  = 'Conferma Ricezione Prenotazione Compleanno - ' + cleanFesteggiato;
  const adminSubject     = '[NUOVA PRENOTAZIONE] ' + cleanFesteggiato + ' - ' + data.data_festa;

  const durationMap = {
    '1h':   '1 Ora',
    '1.5h': '1 Ora e Mezza (1.5h)',
    '2h':   '2 Ore',
    '2.5h': '2 Ore e Mezza (2.5h)'
  };
  const durataReadable = durationMap[data.durata] || (data.durata ? data.durata + ' ore' : '1.5 Ore');

  const safeCliente      = escapeHtml(data.cliente);
  const safeFesteggiato  = escapeHtml(data.festeggiato);
  const safeData         = escapeHtml(data.data_festa);
  const safeOra          = escapeHtml(data.ora);
  const safeDurataText   = escapeHtml(durataReadable);
  const safePartec       = escapeHtml(String(data.partecipanti));
  const safeMenu         = escapeHtml(data.menu);
  const safePatatine     = escapeHtml(data.patatine);
  const safeTorta        = escapeHtml(data.torta);
  const safeScritta      = escapeHtml(data.scritta_torta || 'Nessuna');
  const safeFotoTorta    = escapeHtml(data.foto_torta);
  const safeAllergie     = escapeHtml(data.dettagli_allergie || 'Nessuna');
  const safeRichieste    = escapeHtml(data.altre_richieste || '-');
  const safeTotale       = escapeHtml(typeof data.totale === 'number' ? data.totale.toFixed(2) : String(data.totale));
  const safeTel          = escapeHtml(data.telefono);
  const safeEmail        = escapeHtml(data.email);

  const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #b71c1c; padding: 20px; text-align: center;">
        <img src="${logoUrl}" alt="Bowling Valdera" style="max-width: 180px;">
      </div>
      <div style="padding: 30px;">
        <h2 style="color: #b71c1c; text-align: center;">Prenotazione Ricevuta! &#x1F3B3;</h2>
        <p>Ciao <strong>${safeCliente}</strong>,</p>
        <p>abbiamo ricevuto la tua richiesta di prenotazione per la festa di compleanno di <strong>${safeFesteggiato}</strong>!</p>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; line-height: 1.6;">
          <p style="margin: 6px 0; font-size: 15px;">&#x1F4C5; <strong>Data Festa:</strong> ${safeData}</p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F554; <strong>Orario Inizio:</strong> ore ${safeOra}</p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F3B3; <strong>Durata Gioco Bowling:</strong> <strong style="color: #b71c1c;">${safeDurataText}</strong></p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F465; <strong>Numero Partecipanti:</strong> ${safePartec} invitati</p>
          <p style="margin: 6px 0; font-size: 15px;">&#x1F355; <strong>Menu Scelto:</strong> ${safeMenu} ${safePatatine === 'Sì' ? '(con patatine fritte)' : ''}</p>
          
          <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 10px 14px; margin: 12px 0; border-radius: 4px;">
            <p style="margin: 4px 0; font-size: 15px;">&#x1F382; <strong>Tipo di Torta Scelta:</strong> <strong>${safeTorta}</strong> ${safeFotoTorta === 'Sì' ? '<span style="color:#d32f2f; font-weight:bold;">(+ Foto Stampata)</span>' : ''}</p>
            <p style="margin: 4px 0; font-size: 15px;">&#x270D;&#xFE0F; <strong>Scritta da fare sulla Torta:</strong> <strong style="color: #b71c1c; font-size: 16px;">"${safeScritta}"</strong></p>
          </div>

          <p style="margin: 6px 0; font-size: 14px;">&#x26A0;&#xFE0F; <strong>Allergie / Intolleranze:</strong> ${safeAllergie}</p>
          ${safeRichieste !== '-' ? `<p style="margin: 6px 0; font-size: 14px;">&#x1F4DD; <strong>Note aggiuntive:</strong> ${safeRichieste}</p>` : ''}
          
          <div style="margin-top: 15px; padding-top: 12px; border-top: 2px dashed #ddd;">
            <p style="margin: 4px 0; font-size: 18px; color: #b71c1c;">&#x1F4B0; <strong>Totale Stimato:</strong> &euro;${safeTotale}</p>
          </div>
        </div>

        <div style="background-color: #fff3cd; border: 2px solid #ffeeba; border-left: 6px solid #ffb300; padding: 14px 18px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #856404; font-weight: bold;">
            &#x26A0;&#xFE0F; Per la conferma di questa prenotazione è necessario versare una caparra di 50&euro;, la preghiamo di recarsi al Bowling Valdera entro 2 o 3 giorni per definire l'accordo.
          </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #b71c1c; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #333333;">
            &#x23F0; <strong>Rispetto dell'orario:</strong> vi preghiamo gentilmente di arrivare puntuali all'orario prenotato per non ritardare i compleanni successivi ed evitare di dover scalare i minuti di ritardo dalla durata della vostra partita.
          </p>
        </div>

        <p style="font-size: 0.9em; color: #666; font-style: italic; text-align: center;">
          Ti aspettiamo per strike, musica, pizza e tanto divertimento!
        </p>
      </div>
      <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 0.8em; color: #777;">
        <p style="margin: 5px 0;"><strong>Bowling Valdera</strong></p>
        <p style="margin: 5px 0;">Via ToscoRomagnola, 127, Fornacette (PI)</p>
        <p style="margin: 5px 0;">&#x1F4DE; 0587 420120 | &#x1F310; <a href="http://www.bowlingvaldera.com" style="color: #b71c1c;">www.bowlingvaldera.com</a></p>
      </div>
    </div>
  `;

  const adminHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #333; color: #fff; padding: 15px; text-align: center;">
        <h3 style="margin:0;">NUOVA PRENOTAZIONE COMPLEANNO</h3>
      </div>
      <div style="padding: 20px;">
        <h4 style="margin-top:0;">Dati Cliente</h4>
        <p><strong>Genitore:</strong> ${safeCliente}</p>
        <p><strong>Telefono:</strong> <a href="tel:${safeTel}">${safeTel}</a></p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
        <h4>Dettagli Festa</h4>
        <p><strong>Festeggiato:</strong> ${safeFesteggiato} (${escapeHtml(String(data.anni))} anni)</p>
        <p><strong>Data Festa:</strong> ${safeData} ore ${safeOra}</p>
        <p><strong>Durata Bowling:</strong> <strong style="color: #b71c1c;">${safeDurataText}</strong></p>
        <p><strong>Numero Partecipanti:</strong> ${safePartec}</p>
        <p><strong>Menu Scelto:</strong> ${safeMenu} (Patatine: ${safePatatine})</p>
        <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 8px 12px; margin: 10px 0;">
          <p style="margin: 2px 0;"><strong>Tipo Torta:</strong> ${safeTorta} (Foto: ${safeFotoTorta})</p>
          <p style="margin: 2px 0;"><strong>Scritta sulla Torta:</strong> <strong style="color: #b71c1c;">"${safeScritta}"</strong></p>
        </div>
        <p><strong>Allergie / Intolleranze:</strong> <strong style="color:red;">${safeAllergie}</strong></p>
        <p><strong>Altre Richieste:</strong> ${safeRichieste}</p>
        <p><strong>Totale Calcolato:</strong> &euro;${safeTotale}</p>
      </div>
    </div>
  `;

  const plainCustomer = 
`Ciao ${data.cliente},
abbiamo ricevuto la richiesta per il compleanno di ${data.festeggiato} al Bowling Valdera!

RIEPILOGO DELLA FESTA:
- Data Festa: ${data.data_festa}
- Orario Inizio: ${data.ora}
- Durata Gioco Bowling: ${durataReadable}
- Numero Partecipanti: ${data.partecipanti}
- Menu Scelto: ${data.menu} ${data.patatine === 'Sì' ? '(con patatine fritte)' : ''}
- Tipo di Torta: ${data.torta} ${data.foto_torta === 'Sì' ? '(con foto stampata)' : ''}
- Scritta sulla Torta: "${data.scritta_torta || 'Nessuna'}"
- Totale Stimato: €${safeTotale}

IMPORTANTE: Per la conferma di questa prenotazione è necessario versare una caparra di 50€ entro 2 o 3 giorni, la preghiamo di recarsi al Bowling Valdera per definire l'accordo.

RISPETTO DELL'ORARIO: vi preghiamo gentilmente di arrivare puntuali all'orario prenotato per non ritardare i compleanni successivi ed evitare di dover scalare i minuti di ritardo dalla durata della vostra partita.

Ti aspettiamo per una giornata di strike e festa!
Bowling Valdera - Via ToscoRomagnola 127, Fornacette (PI) - Tel. 0587 420120`;

  // 1. Invio email al cliente
  safeSendEmail(recipient, customerSubject, plainCustomer, customerHtml, props);

  // 2. Invio email all'amministratore (info@bowlingvaldera.it)
  if (adminEmail) {
    safeSendEmail(adminEmail, adminSubject, plainCustomer, adminHtml, props);
  }
}

/**
 * Funzione di utilità da eseguire nell'editor Google Apps Script
 * per testare l'invio dell'email e autorizzare gli scope di Gmail / Mail.
 */
function testSendEmail() {
  const props = getProps();
  const myEmail = props.adminEmail || Session.getActiveUser().getEmail();
  
  const testData = {
    cliente: 'Mario Rossi (Test)',
    email: myEmail,
    festeggiato: 'Luca',
    anni: 10,
    data_festa: '25-11-2026',
    ora: '18:00',
    durata: '1.5h',
    partecipanti: 15,
    menu: 'Basic',
    patatine: 'Sì',
    torta: 'Pan di Spagna Chantilly',
    scritta_torta: 'Auguri Luca!',
    foto_torta: 'No',
    dettagli_allergie: 'Nessuna',
    altre_richieste: 'Nessuna richiesta particolare',
    totale: 225.0,
    telefono: '3401234567'
  };

  console.log('Avvio test invio email a:', myEmail);
  sendConfirmationEmail(testData, props);
  console.log('Test invio email completato!');
}

/**
 * Funzione di pulizia automatica: elimina tutti gli eventi e le righe di test
 * contrassegnati con 'TEST' su Google Calendar e Google Sheets.
 */
function cleanTestEvents() {
  const props = getProps();
  const calendar = CalendarApp.getCalendarById(props.calendarId) || CalendarApp.getDefaultCalendar();

  // 1. Pulizia Google Calendar
  const startDate = new Date('2026-10-01T00:00:00');
  const endDate   = new Date('2026-12-31T23:59:59');
  const events    = calendar.getEvents(startDate, endDate);
  let calCount    = 0;

  for (let i = 0; i < events.length; i++) {
    const title = events[i].getTitle().toUpperCase();
    if (title.includes('TEST')) {
      events[i].deleteEvent();
      calCount++;
    }
  }
  console.log('Google Calendar: eliminati ' + calCount + ' eventi di test.');

  // 2. Pulizia Google Sheets
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  const sheet      = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const lastRow    = sheet.getLastRow();
  let sheetCount   = 0;

  for (let r = lastRow; r >= 2; r--) {
    const festeggiato = String(sheet.getRange(r, 2).getValue() || '').toUpperCase();
    const cliente     = String(sheet.getRange(r, 4).getValue() || '').toUpperCase();
    if (festeggiato.includes('TEST') || cliente.includes('TEST')) {
      sheet.deleteRow(r);
      sheetCount++;
    }
  }
  console.log('Google Sheets: eliminate ' + sheetCount + ' righe di test.');
  console.log('>>> PULIZIA COMPLETATA CON SUCCESSO! <<<');
}
