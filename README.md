# ⚡ LinkedIn Games Solver Turbo (v2.2)

Extension Chrome & Firefox rapide et moderne pour résoudre les 7 jeux quotidiens LinkedIn :
- 👑 **Queens**
- ☀️ **Tango**
- ⚡ **Zip**
- 🔢 **Mini Sudoku**
- 🧩 **Patches**
- 🔤 **Wend**
- 🧮 **Sumbreak**

## 🆕 Nouveautés v2.2 (3 nouveaux jeux)

- **🧩 Patches** : grille lue dans les données du jeu (`patchesGamePuzzle`), pavage exact en rectangles (forme carré / large / haut, aire imposée, pas de 1×1), chaque patch tracé par glisser coin à coin.
- **🔤 Wend** : lettres, cases vides et longueurs lues dans la page ; mots trouvés avec un dictionnaire anglais embarqué (SCOWL, 73 000 mots) et une recherche de couverture exacte ; en cas d'égalité, les mots courants l'emportent sur les noms propres et mots rares. Si la page fournit la liste des réponses, elle est utilisée en priorité. Chaque mot est tracé puis vérifié.
- **🧮 Sumbreak** : tuiles et jokers (`×2`, `+3`) lus dans la page, recherche d'un ordre de fusion qui laisse une seule tuile, chaque fusion vérifiée en attendant la fin de l'animation.
- Barre flottante, popup, suivi quotidien (`0/7`) et navigation interne mis à jour pour les 7 jeux.
- Tests unitaires sur de vraies grilles LinkedIn (Patches 20/11/2026, Sumbreak 18 et 20/11/2026, Wend 143 et 18/11/2026).
- Crédits : voir `THIRD_PARTY_NOTICES.md`.

## 🛠️ Nouveautés v2.1 (compatibilité LinkedIn 2026)

- **Correctif « Could not extract target element from document or iframes »** : LinkedIn a modifié ses jeux en 2026 (`#rehydrate-data`, `#queens-grid`, `.lotka-grid`, `.grid-game-board` n'existent plus). Chaque jeu dispose d'une nouvelle méthode **V2**, essayée en premier ; les anciennes (V1/V0) restent en secours.
- **Lecture des données du jeu** : nouveau script `pageReader.js` (monde `MAIN`, toutes les frames) qui lit la grille directement dans l'état React de LinkedIn (`queensGamePuzzle`, `lotkaGamePuzzle`, `trailGamePuzzle`), y compris quand le jeu est dans une iframe.
- **Queens** : plateau `#queens-game-board` / `[data-cell-idx]`, zones lues via les données du jeu, puis classes, aria-label ou couleurs CSS ; chaque reine posée est vérifiée, les reines mal placées sont retirées.
- **Tango** : cases `#tango-cell-N`, états `cell-zero` / `cell-one` / `cell-empty`, signes `=` / `×` lus dans les données du jeu, chaque clic vérifié.
- **Zip** : murs et numéros lus dans les données du jeu ; tracé au clavier (flèches), sinon glisser, sinon clics.
- **Mini Sudoku** : cases `.sudoku-cell`, désactivation automatique du mode Notes, saisie au clavier ou via les boutons chiffres, chaque valeur vérifiée.
- **Clics réalistes** : séquence complète `pointer*` / `mouse*` / `click` sur le centre de la case.
- **Raccourci Alt+S réparé sur Mac** (la touche Option produisait « ß »).
- **Navigation interne LinkedIn** : `pageReader.js` est aussi injecté lors d'un changement de jeu sans rechargement.
- **Messages d'erreur clairs** en français, avec le détail de chaque méthode dans la console (F12).
- Firefox : version minimale 128.

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

## 📄 Licence

Distribué sous licence **MIT** — © 2026 Thomas Marsa. Voir [`LICENSE`](LICENSE).

Ce projet est dérivé de [brohitbrose/linkedin-games](https://github.com/brohitbrose/linkedin-games) (MIT, © 2025 brohitbrose), dont la mention de copyright est conservée comme l'exige la licence. Les autres crédits (algorithmes Patches / Sumbreak / Wend, dictionnaire SCOWL) figurent dans [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
