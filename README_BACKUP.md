# 🎳 App Compleanni Bowling Valdera - Backup Configurazione

**Data Backup:** 12 Gennaio 2026  
**Stato:** ✅ FUNZIONANTE

## 📋 Informazioni Deployment

### Google Apps Script
- **URL Deployment:** `https://script.google.com/macros/s/AKfycbzBUSpATfJw5nK7Ja-z8tY3K5qocNLTDm3yXptoaZcT3Ywx7H4LtfkzyVb7PAPeB7mM/exec`
- **Foglio Google Sheets:** `compleanni`
- **Calendar ID:** `federicacircelli25@gmail.com`
- **Email Mittente:** `info@bowlingvaldera.it`

### File Backup
- **Codice Google Apps Script:** `BACKUP_GOOGLE_APPS_SCRIPT.js`
- **Frontend (GitHub):** Repository già aggiornato

## ✅ Funzionalità Attive

- ✅ Salvataggio dati su Google Sheets (foglio "compleanni")
- ✅ Email di conferma da info@bowlingvaldera.it
- ✅ Data in formato italiano (DD-MM-YYYY)
- ✅ Creazione eventi Google Calendar
- ✅ Validazione date passate (frontend)
- ✅ Email admin a federicacircelli25@gmail.com

## 🔧 Configurazione Critica

### Parametro Email Fondamentale
Lo script usa il parametro `from: "info@bowlingvaldera.it"` nella funzione `GmailApp.sendEmail()`.

**IMPORTANTE:** Questo funziona solo se:
1. L'alias `info@bowlingvaldera.it` è configurato in Gmail
2. È impostato come indirizzo predefinito nelle impostazioni Gmail

### Ordine Colonne Google Sheets
```
A: Timestamp
B: Festeggiato
C: Anni
D: Cliente
E: Telefono
F: Email
G: Data Festa (DD-MM-YYYY)
H: Ora
I: Partecipanti
J: Menu
K: Patatine
L: Torta
M: Scritta Torta
N: Altre Richieste
O: Durata
P: Totale
Q: GDPR
R: Marketing
S: Foto Torta
```

## 🚨 In Caso di Problemi

### Se l'email non arriva da info@bowlingvaldera.it:
1. Verifica che l'alias sia ancora configurato in Gmail
2. Verifica che sia impostato come predefinito
3. Usa il codice in `BACKUP_GOOGLE_APPS_SCRIPT.js` per ripristinare

### Se i dati non vengono salvati:
1. Verifica che il foglio si chiami esattamente "compleanni"
2. Verifica che lo script sia collegato al foglio Google Sheets corretto
3. Controlla i log delle esecuzioni nel Google Apps Script

### Per ripristinare completamente:
1. Copia il codice da `BACKUP_GOOGLE_APPS_SCRIPT.js`
2. Incollalo nel Google Apps Script
3. Fai un nuovo deployment
4. Aggiorna l'URL nel file `script.js` (frontend)
5. Carica su GitHub

## 📝 Note Tecniche

- Il frontend invia la data in formato DD-MM-YYYY
- Lo script converte la data in YYYY-MM-DD per il calendario
- La data rimane in formato DD-MM-YYYY per Google Sheets e email
- Il parametro `from` è essenziale per l'email corretta

---

**NON MODIFICARE IL FILE `BACKUP_GOOGLE_APPS_SCRIPT.js` - È UN BACKUP DI SICUREZZA**
