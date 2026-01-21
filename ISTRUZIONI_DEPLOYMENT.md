# 🔧 ISTRUZIONI PER DEPLOYMENT GOOGLE APPS SCRIPT

## ✅ Cosa è stato fatto

Ho risolto i seguenti problemi:

1. **✅ Configurato lo Spreadsheet ID** corretto: `1O_0-qpQFpEby4LsLlyC8xUwFLwrixd_-tNIrMeuA9Ro`
2. **✅ Fixato il bug del formato data** nella funzione `doGet` (ora usa DD-MM-YYYY invece di YYYY-MM-DD)
3. **✅ Aggiunto logging completo** per debug e monitoraggio

## 📋 PASSI PER IL DEPLOYMENT

### 1. Apri Google Apps Script

1. Vai su: https://script.google.com
2. Apri il tuo progetto esistente (quello con l'URL che finisce con `...Ov33-k6w/exec`)

### 2. Sostituisci il Codice

1. **Seleziona TUTTO il codice** esistente (Ctrl+A)
2. **Cancellalo**
3. **Copia TUTTO il contenuto** del file `SCRIPT_PRONTO_PER_DEPLOYMENT.gs`
4. **Incollalo** nell'editor di Google Apps Script
5. **Salva** (Ctrl+S o icona del dischetto)

### 3. Deploy come Web App

**IMPORTANTE**: Devi creare un **NUOVO deployment** per applicare le modifiche!

1. Clicca su **"Deploy"** → **"New deployment"** (in alto a destra)
2. Clicca sull'icona ⚙️ (ingranaggio) accanto a "Select type"
3. Seleziona **"Web app"**
4. Configura:
   - **Description**: `Fix Spreadsheet ID e formato data - v2`
   - **Execute as**: `Me (il tuo account)`
   - **Who has access**: `Anyone`
5. Clicca **"Deploy"**
6. **COPIA IL NUOVO URL** che ti viene mostrato (sarà diverso da quello vecchio!)

### 4. Aggiorna l'URL nel Frontend

1. Apri il file `script.js` nella cartella del progetto
2. Cerca la riga 470 e 665 dove c'è:
   ```javascript
   const scriptUrl = 'https://script.google.com/macros/s/AKfycbw0eCmBcUuEb__AN77hltyO8gEGGbASeevz75pqUtA0RAyhSB275fjkS-SpOv33-k6w/exec';
   ```
3. **Sostituisci questo URL** con il nuovo URL che hai copiato al passo 3.6
4. Salva il file

### 5. Testa il Sistema

1. **Apri l'applicazione** nel browser
2. **Compila il form** con dati di test
3. **Conferma la prenotazione**
4. **Verifica** che:
   - ✅ I dati appaiano nel foglio Google Sheets "Prenotazioni"
   - ✅ Venga creato un evento nel Google Calendar
   - ✅ Arrivi l'email di conferma

### 6. Controlla i Log (se qualcosa non funziona)

1. In Google Apps Script, vai su **"Executions"** (icona orologio a sinistra)
2. Clicca sull'ultima esecuzione
3. Guarda i log per vedere dove si è fermato
4. I log ora sono molto dettagliati e ti diranno esattamente cosa sta succedendo

## 🐛 Troubleshooting

### Se i dati non vengono salvati:

1. **Controlla i permessi**: Quando fai il primo deployment, Google ti chiederà di autorizzare lo script. Devi accettare tutti i permessi.
2. **Controlla il nome del foglio**: Il foglio deve chiamarsi "Prenotazioni" (o verrà creato automaticamente)
3. **Controlla i log**: Vai su Executions e guarda cosa dicono i log

### Se il controllo disponibilità non funziona:

1. Verifica che il Calendar ID sia corretto (di default usa 'primary')
2. Controlla i log per vedere se ci sono errori di parsing della data

### Se l'email non arriva:

1. Controlla lo spam
2. Verifica che l'indirizzo email sia corretto
3. Controlla i log per vedere se ci sono errori nell'invio

## 📞 Supporto

Se hai problemi, controlla sempre i log in Google Apps Script → Executions.
I log ora sono molto dettagliati e ti diranno esattamente dove si è verificato il problema.
