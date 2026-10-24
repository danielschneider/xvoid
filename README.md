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

Vite schreibt die statischen Dateien nach `dist/`. Die relative Asset-Basis (`base: './'`) unterstützt GitHub-Pages-Projektseiten; der Workflow unter `.github/workflows/deploy.yml` veröffentlicht `dist` bei Pushes auf `main`.

## Steuerung

- Maus/Touch: Feld antippen zum Auswählen oder Bewegen; Gegner zweimal antippen zum Zielen und Feuern.
- Ein Finger zieht die Karte; zwei Finger zoomen und drehen. Mausrad zoomt.
- WASD/Pfeiltasten bewegen die Kamera, Q/E drehen sie.
- M schaltet den Bewegungsmodus, F feuert, O aktiviert Overwatch, H sucht Deckung, Enter beendet den Zug.

Die Sprites werden lokal als Pixel-Art-Texturen erzeugt. Die Spiel-Engine für Karte, BFS-Pfadfinder, Ebenenwechsel, Sichtlinie, Deckung und Zuglogik liegt in `src/engine/`.