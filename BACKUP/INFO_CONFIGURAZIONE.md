# 🎳 BACKUP CONFIGURAZIONE APP COMPLEANNI

**Data Backup:** 12 Gennaio 2026  
**Stato:** ✅ FUNZIONANTE

## 📋 URL e Configurazioni

### Google Apps Script
- **URL Deployment:** `https://script.google.com/macros/s/AKfycbzBUSpATfJw5nK7Ja-z8tY3K5qocNLTDm3yXptoaZcT3Ywx7H4LtfkzyVb7PAPeB7mM/exec`
- **Foglio Google Sheets:** `compleanni`
- **Calendar ID:** `federicacircelli25@gmail.com`
- **Email Mittente:** `info@bowlingvaldera.it`

## 🔧 Parametro Fondamentale

Il codice usa:
```javascript
GmailApp.sendEmail(recipient, subject, "", {
  from: "info@bowlingvaldera.it",
  htmlBody: htmlBody
});
```

**CRITICO:** Il parametro `from: "info@bowlingvaldera.it"` è essenziale!

## 📊 Ordine Colonne Google Sheets

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

## 🚨 Come Ripristinare

1. Copia il codice da `google_apps_script_BACKUP.js`
2. Incolla nel Google Apps Script
3. Salva (Ctrl+S)
4. Fai nuovo deployment
5. Aggiorna URL nel `script.js` del frontend
6. Carica su GitHub

## ✅ Checklist Verifica

- [ ] Alias info@bowlingvaldera.it configurato in Gmail
- [ ] Alias impostato come predefinito
- [ ] Foglio Google Sheets chiamato "compleanni"
- [ ] Script collegato al foglio corretto
- [ ] Calendar ID corretto
