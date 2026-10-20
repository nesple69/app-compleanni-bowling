# 🎳 App Compleanni Bowling Valdera - Documentazione e Configurazione

**Versione:** 3.0 (Security & Architecture Hardened)  
**Data Aggiornamento:** Ottobre 2026  
**Stato:** ✅ TESTATO E SICURO

---

## 📋 Informazioni Architettura

- **Frontend:** SPA statica in HTML5, CSS3 e JavaScript Vanilla ES6+
- **Hosting Frontend:** Vercel (`https://app-compleanni-bowling.vercel.app/`)
- **Backend:** Google Apps Script Web App (REST API)
- **Database:** Google Sheets (Foglio: `dati_compleanno`)
- **Calendario:** Google Calendar (tramite CalendarApp)
- **Email:** GmailApp (da `info@bowlingvaldera.it`)

---

## 🔧 Configurazione Google Apps Script

Nessuna credenziale sensibile è hardcodata nel codice. Tutto è gestito tramite **Proprietà dello Script** (Impostazioni progetto → Proprietà dello script):

| Chiave | Valore Esempio | Descrizione |
| :--- | :--- | :--- |
| `API_SECRET` | `BV2026-f8e3a7d2b9c4-k7p1` | Token condiviso tra frontend (`API_TOKEN` in `script.js`) e backend |
| `CALENDAR_ID` | `titolare@bowlingvaldera.it` | ID o email del Google Calendar in cui segnare le feste |
| `ADMIN_EMAIL` | `info@bowlingvaldera.it` | Email che riceve la notifica interna con recapiti cliente |
| `SENDER_EMAIL` | `info@bowlingvaldera.it` | Indirizzo email mittente configurato come alias in Gmail |

---

## 📊 Mappatura Colonne Google Sheets (21 Colonne)

Il foglio di calcolo (`dati_compleanno`) accetta le seguenti colonne ordinate:

```
Col 1  (A): Timestamp (Data e ora di registrazione)
Col 2  (B): Festeggiato
Col 3  (C): Anni
Col 4  (D): Cliente (Nome e Cognome genitore)
Col 5  (E): Telefono
Col 6  (F): Email
Col 7  (G): Data Festa (DD-MM-YYYY)
Col 8  (H): Ora Inizio
Col 9  (I): Partecipanti
Col 10 (J): Menu Scelto
Col 11 (K): Patatine (Sì / No)
Col 12 (L): Torta
Col 13 (M): Scritta Torta
Col 14 (N): Altre Richieste / Note
Col 15 (O): Durata (1h, 1.5h, 2h, 2.5h)
Col 16 (P): Totale Calcolato (€#,##0.00)
Col 17 (Q): Allergie Dichiarate (Confermato / No)
Col 18 (R): GDPR (Accettato / No)
Col 19 (S): Marketing (Sì / No)
Col 20 (T): Foto Torta (Sì / No)
Col 21 (U): Dettagli Allergie (Specifica delle intolleranze comunicate)
```

---

## 🛡️ Miglioramenti di Sicurezza e Affidabilità Introdotti

1. **Lock di Concorrenza:** `LockService.getScriptLock()` impedisce collisioni e doppie prenotazioni simultanee.
2. **Ricalcolo Prezzi Autorevole:** Il prezzo finale viene ricalcolato dal backend in base al listino ufficiale, eliminando il rischio di price tampering dal browser.
3. **Protezione da Formula Injection:** Ogni stringa salvata su Google Sheets viene sanificata per prevenire l'esecuzione di formule malevole (`=`, `+`, `-`, `@`).
4. **Isolamento Notifiche Email:** Gli errori di quota o invio email non compromettono il salvataggio su database e calendario.
5. **Buffer di Pulizia Simmetrico:** Controllo di disponibilità a 30 minuti prima e dopo per garantire il setup delle piste.
6. **GDPR & Privacy:** Informativa completa visualizzabile direttamente nel form.
7. **Rimozione Passaggio WhatsApp:** Flusso semplificato con scheda di conferma chiara e senza countdown forzati.

---

## ✉️ Verifica e Collaudo dell'Invio Email (Customer & Admin)

Per garantire al 100% che l'email di conferma arrivi al cliente senza blocchi o errori di autorizzazione di Google:

### 1. Sistema di Invio a 3 Livelli di Fallback Automatico (`safeSendEmail`)
Google Apps Script blocca le chiamate a `GmailApp.sendEmail({ from: 'info@bowlingvaldera.it' })` se quell'indirizzo non è stato preventivamente registrato e verificato come "Invia messaggio come" nelle Impostazioni Gmail dell'account Google.
Per evitare che l'email fallisca silenciosamente:
1. **Livello 1 (Con Alias verificato):** Se `info@bowlingvaldera.it` è configurato come alias nell'account, l'email parte con il mittente personalizzato.
2. **Livello 2 (Mittente nativo con Nome e Reply-To):** Se l'alias non è configurato, Google Apps Script invia l'email direttamente dall'account Google proprietario con:
   - **Nome visualizzato:** *"Bowling Valdera"*
   - **Rispondi a (Reply-To):** *info@bowlingvaldera.it*
   In questo modo il cliente vede come mittente "Bowling Valdera", riceve l'HTML completo e cliccando "Rispondi" scrive direttamente a info@bowlingvaldera.it.
3. **Livello 3 (MailApp Fallback):** Se GmailApp incontra limiti di quota temporanei, viene attivato automaticamente il motore secondario `MailApp`.

### 2. Come Collaudare l'Invio in 10 Secondi
1. Apri il progetto in **Google Apps Script** collegato al Google Sheet.
2. Incolla il codice aggiornato da `BACKUP_GOOGLE_APPS_SCRIPT.js` nel file `Code.gs`.
3. Nel menu a tendina in alto seleziona la funzione **`testSendEmail`** e premi **Esegui** (icona Play).
4. Se è la prima esecuzione, Google mostrerà la finestra *"Autorizzazione richiesta"*: clicca su **Avanzate → Apri Bowling Valdera (non sicuro) → Consenti**.
5. Controlla la tua casella di posta: riceverai subito l'email di test con la grafica ufficiale, il riepilogo e il totale stimato.
6. Effettua il Deploy finale: **Distribuisci → Gestisci distribuzioni → Modifica → Nuova versione → Distribuisci**.
