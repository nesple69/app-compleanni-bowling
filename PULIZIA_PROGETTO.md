# 🧹 Pulizia Progetto - File da Eliminare

## File Obsoleti da Rimuovere

### Script Google Apps Obsoleti
- [ ] SCRIPT_COMPLETO_PRONTO.gs
- [ ] SCRIPT_FINALE_CONFIGURATO.gs
- [ ] SCRIPT_GOOGLE_APPS_AGGIORNATO_FINALE.gs
- [ ] SCRIPT_PRONTO_PER_DEPLOYMENT.gs
- [ ] SCRIPT_RIPRISTINATO_FUNZIONANTE.gs
- [ ] google-apps-script-updated.gs
- [ ] DEBUG_SCRIPT.gs

### File di Istruzioni Obsoleti
- [ ] CODICE_DA_AGGIUNGERE.js
- [ ] DEBUG_PERMESSI.md
- [ ] DEPLOYMENT_GET_METHOD.md
- [ ] ISTRUZIONI_DEPLOYMENT.md
- [ ] ISTRUZIONI_MODIFICA_SCRIPT.txt
- [ ] ISTRUZIONI_RIPRISTINO.md
- [ ] NUOVO_DEPLOYMENT_NECESSARIO.md
- [ ] SOLUZIONE_FINALE.md

### Backup Vecchi (Opzionale)
- [ ] BACKUP_FUNZIONANTE_2026-01-13/
- [ ] BACKUP_FUNZIONANTE_2026-01-20_22-55/
- [ ] BACKUP_FUNZIONANTE_2026-01-20_22-56/
- [ ] BACKUP/ (se vuoto o obsoleto)

### Immagini Non Utilizzate (Verifica prima!)
- [ ] background.jpg (se non usato)
- [ ] ball.png (se non usato)
- [ ] cake.png (se non usato)
- [ ] deco-pizza.png (se non usato)
- [ ] pin.png (se non usato)

## ✅ File da MANTENERE

### File Essenziali App
- ✅ index.html
- ✅ script.js
- ✅ style.css
- ✅ manifest.json
- ✅ Lobster-Regular.ttf
- ✅ logo_bowling.png
- ✅ icon.png

### File Documentazione
- ✅ BACKUP_GOOGLE_APPS_SCRIPT.js (script funzionante)
- ✅ README_BACKUP.md (se contiene info utili)
- ✅ BACKUP_FUNZIONANTE_2026-01-22_18-44/ (backup appena creato)

### Cartelle
- ✅ .git/
- ✅ assets/ (se contiene file usati)
- ✅ 1.Link della app/

## 🚀 Comando per Eliminare (ESEGUI CON CAUTELA!)

```powershell
# Elimina file obsoleti
Remove-Item "SCRIPT_*.gs" -Force
Remove-Item "google-apps-script-updated.gs" -Force
Remove-Item "DEBUG_*.gs","DEBUG_*.md" -Force
Remove-Item "DEPLOYMENT_*.md","ISTRUZIONI_*.md","ISTRUZIONI_*.txt" -Force
Remove-Item "NUOVO_*.md","SOLUZIONE_*.md","CODICE_*.js" -Force

# Elimina backup vecchi (OPZIONALE - verifica prima!)
# Remove-Item "BACKUP_FUNZIONANTE_2026-01-13" -Recurse -Force
# Remove-Item "BACKUP_FUNZIONANTE_2026-01-20_22-55" -Recurse -Force
# Remove-Item "BACKUP_FUNZIONANTE_2026-01-20_22-56" -Recurse -Force
```

## ⚠️ IMPORTANTE

Prima di eliminare:
1. Verifica di avere il backup del 22/01/2026 completo
2. Verifica che le immagini non siano usate nell'app
3. Fai un commit Git prima di eliminare
