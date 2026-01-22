# BACKUP VERSIONE FUNZIONANTE - 22 Gennaio 2026
==============================================

## ✅ Stato: COMPLETAMENTE FUNZIONANTE

Questo backup contiene la versione COMPLETA e TESTATA dell'app con:

✅ Integrazione Google Sheets funzionante
✅ Salvataggio dati nel foglio 'dati_compleanno'
✅ Creazione eventi Google Calendar
✅ Invio email di conferma
✅ Invito WhatsApp
✅ Validazione campi obbligatori
✅ Formattazione Euro per totale
✅ Campo allergie dichiarate

## 📋 File Inclusi

- index.html (form completo con validazione)
- script.js (logica frontend con parsing totale corretto)
- style.css (stili completi)
- manifest.json (PWA)
- Lobster-Regular.ttf (font locale)
- logo_bowling.png
- icon.png
- BACKUP_GOOGLE_APPS_SCRIPT.js (script Google Apps funzionante)

## 🔧 Configurazione Google Apps Script

**Nome foglio:** dati_compleanno
**Calendar ID:** federicacircelli25@gmail.com
**Email mittente:** info@bowlingvaldera.it

**URL Deployment:**
https://script.google.com/macros/s/AKfycbxX8Q62YfrjpCc38lDM3478-PEGk-iiG6080RLb5vnt3cYFWIDAq1D4suMoL_RKObkmLw/exec

## 🚀 Come Ripristinare

1. Copia tutti i file da questa cartella
2. Incolla nella cartella principale del progetto
3. Push su GitHub
4. Vercel farà il deploy automatico

## 📝 Note Tecniche

- Lo script Google Apps è collegato al foglio (usa getActiveSpreadsheet())
- Il totale viene parsato correttamente rimuovendo € e spazi
- Tutti i campi hanno attributo 'required'
- La colonna Totale ha formattazione €#,##0.00
