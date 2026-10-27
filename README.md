# XVoid

Responsives 2.5D-Sci-Fi-Taktikspiel mit React, Three.js und React Three Fiber.

## Start

```sh
npm install
npm run dev
```

Production-Build und Engine-Tests:

```sh
npm test
npm run build
```

Vite schreibt die statischen Dateien nach `dist/`. Die relative Asset-Basis (`base: './'`) unterstützt GitHub-Pages-Projektseiten. Der Workflow unter `.github/workflows/deploy.yml` testet und veröffentlicht `dist` bei Pushes auf `main`; in den Repository-Einstellungen muss unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** ausgewählt sein. `.github/workflows/deployci.yml` führt Tests und Build als CI-Prüfung für Pushes und Pull Requests aus.

## Steuerung

- Maus/Touch: Spielereinheit antippen zum Auswählen. Ein erreichbares Feld antippen, Route prüfen und mit **Bestätigen** bewegen.
- Sichtbaren Gegner antippen, um ihn anzuvisieren. Der Feuern-Button löst den Schuss aus; ein Tap oder Doppeltap feuert nicht.
- Ein Finger zieht die Karte; zwei Finger zoomen und drehen. Mausrad zoomt.
- WASD/Pfeiltasten bewegen die Kamera, Q/E drehen sie. M schaltet den Bewegungsmodus, O aktiviert Overwatch, Enter beendet den Zug. Deckung entsteht automatisch durch Wände, Pfeiler und Konsolen an jeder Seite eines Feldes; wer von einer ungedeckten Seite schießt, flankiert und umgeht die Deckung.
- Escape verwirft die Bewegungsroute oder schließt die Warnung vor einem Zugende mit verbleibenden Aktionspunkten.

## Gegner-KI und Sicht

Lebende Spielereinheiten decken Felder bis zu 10 Felder weit auf. Wände und Säulen blockieren die Sichtlinie. Gegner und Gebäude im Nebel werden nicht angezeigt. Die Sicht wird pro Runde und nach jeder Bewegung neu aus den Positionen des Teams berechnet.

Während des Feindzugs handelt jeder lebende Gegner einmal. Er wählt zunächst die nächste lebende Spielereinheit. Ist der Gegner aufgedeckt und hat er zu einer Spielereinheit innerhalb von 13 Feldern freie Sicht, schießt er mit 52 % Trefferchance für 1–2 Schaden. Andernfalls sucht der BFS-Pfadfinder einen begehbaren Weg von bis zu 5 Feldern und rückt auf ein Feld vor, das den Abstand zum Team verringert. Gegner bewegen sich somit auch verborgen im Nebel, können dort aber nicht schießen. Bewegungen werden Feld für Feld abgespielt.

Die Zuglogik und Gegnerentscheidungen liegen in `src/engine/game.js`; Sichtbereich, Sichtlinie und Pfadfinder liegen in `src/engine/map.js`. `npm test` führt die Engine-Tests aus.

Die Sprites werden lokal als Pixel-Art-Texturen erzeugt. Die Spiel-Engine für Karte, BFS-Pfadfinder, Ebenenwechsel, Sichtlinie, seitenbezogene Deckung, Flankierung und Zuglogik liegt in `src/engine/`.

## Grafikassets

Die Roguelike-Umgebungstiles stammen aus Kenneys [Roguelike/RPG pack](https://kenney.nl/assets/roguelike-rpg-pack) und stehen unter CC0. Die Lizenz liegt bei `public/assets/kenney-roguelike/License.txt`. Das Paket enthält Umgebungskacheln, aber keine passenden Spielfiguren; die Einheiten-Sprites werden weiterhin lokal erzeugt.
