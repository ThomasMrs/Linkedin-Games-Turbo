# ⚡ LinkedIn Games Solver Turbo (v2.0)

Extension Chrome & Firefox rapide et moderne pour résoudre les 4 jeux quotidiens LinkedIn :
- 👑 **Queens**
- ☀️ **Tango**
- ⚡ **Zip**
- 🔢 **Mini Sudoku**

## ✨ Nouveautés v2.0

- **Interface Popup Dark Glass** : suivi quotidien `0/4` avec barre de progression, temps de résolution en millisecondes, lancement rapide des 4 jeux et bouton **« Enchaîner → »**.
- **Barre flottante (HUD) directement sur LinkedIn** : isolée via Shadow DOM, repliable, bouton **⚡ Résoudre** en 1 clic, sélecteur de vitesse et raccourcis vers les autres jeux.
- **3 modes de vitesse** : `⚡ Turbo` (instantané), `🚀 Rapide` (~18 ms/coup), `🧑 Humain` (délai naturel aléatoire).
- **Auto-Start & Auto-Solve** : clique automatiquement sur « Commencer / Play » et peut résoudre automatiquement dès l'arrivée sur le jeu.
- **Raccourci clavier global** : `Alt + S` pour résoudre instantanément.
- **Nouveau logo vectoriel + icônes HD** (`16` à `128 px`) + badge coloré sur l'icône d'extension.
- **Correctifs de stabilité & support FR/EN** : détection multilingue (français & anglais), gestion multi-iframes sécurisée, correction des `await` manquants et erreurs de références.

## 🚀 Installation directe (prêt à l'emploi)

Les dossiers `chrome-dist/` et `firefox-dist/` sont **déjà compilés** dans cette archive !

### Chrome / Brave / Edge / Arc
1. Ouvre `chrome://extensions/`
2. Active le **Mode développeur** (en haut à droite)
3. Clique sur **Charger l'extension non empaquetée**
4. Sélectionne le dossier `chrome-dist/`

### Firefox
1. Ouvre `about:debugging#/runtime/this-firefox`
2. Clique sur **Charger un module complémentaire temporaire…**
3. Sélectionne le fichier `firefox-dist/manifest.json`

## 🛠️ Développement & Build depuis `src/`

```bash
npm install
node build.js          # Compile chrome-dist/ et firefox-dist/
node build.js --watch  # Recompile automatiquement à chaque sauvegarde
npm test               # Lance les tests unitaires Jest
```
