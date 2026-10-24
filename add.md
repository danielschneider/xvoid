# XVoid: Roadmap für Spielbarkeit und taktische Tiefe

## Bereits vorhanden

- Prozedural generierte Karten mit 32, 40 oder 48 Feldern pro Seite und passenden Gegnerzahlen von 5, 10 oder 20.
- Seedabhängige Karten, Startpositionen und Spawnzonen.
- Aktionspunkte, bestätigte Bewegungsrouten, Sichtlinien und Fog of War.
- Getrennte Spieler- und Gegnerphasen; Gegner rücken verborgen vor und schießen nur, wenn sie aufgedeckt sind.

## Priorität 1: Ein vollständiger Missionsablauf

Das Spiel braucht ein klares Ziel über das Ausschalten aller Gegner hinaus. Eine Mission sollte ein sichtbares Primärziel, optionale Ziele, einen Extraktionspunkt und eindeutige Sieg- und Niederlagebedingungen besitzen.

**Vorschlag:** Ein Datensatz pro Mission mit Zielposition, Extraktionszone, Gegnerbudget und optionalen Regeln. Nach Erfüllung des Ziels muss mindestens eine lebende Einheit die Extraktion erreichen. Die UI zeigt Zielstatus und Fortschritt, ohne den Kampfbereich zu verdecken.

**Warum zuerst:** Ein konkretes Ziel macht Positionierung, Aktionspunkte und Risiko unmittelbar bedeutsam und gibt jeder Karte einen spielerischen Zweck.

## Priorität 2: Fähigkeiten mit echten taktischen Folgen

Overwatch und Deckung sollten mehr sein als AP-verbrauchende Statuswerte.

- **Overwatch:** Die Einheit gibt AP aus und reagiert einmal mit einem Schuss, wenn ein sichtbarer Gegner eine definierte Reichweite betritt oder sich darin bewegt.
- **Deckung suchen:** Verringert bis zum nächsten Spielerzug eingehenden Schaden oder verbessert die Deckungsstufe.
- **Flankieren:** Schüsse von der Seite oder von hinten umgehen einen Teil des Deckungsbonus.
- **Höhe:** Erhöht Sichtweite oder Trefferchance, während niedrige Deckung weniger schützt.

Fähigkeiten brauchen klare Dauer, Auslöser und Kosten. Der HUD sollte vor dem Einsatz anzeigen, was sich ändert.

## Priorität 3: Entscheidungen vor dem Zug sichtbar machen

Vor einer Bestätigung sollten Spieler die Kosten und das Risiko verstehen können:

- Bewegungsroute mit AP-Kosten, Endposition und möglicher Sichtänderung.
- Trefferchance, Deckung, Höhenbonus und Reichweite vor dem Schuss.
- Gefahrenfelder, in denen ein sichtbarer Gegner schießen kann.
- Markierung, ob eine Bewegung Sicht auf neue Gegner eröffnet oder die Einheit exponiert.

Die Vorschau darf keine verborgenen Gegner oder Informationen aus dem Nebel verraten. Anzeige und Engine müssen dieselbe Sicht- und Trefferlogik verwenden.

## Priorität 4: Gegner mit unterscheidbaren Rollen

**Umgesetzt:** Rollen werden pro Karten-Seed zufällig, aber reproduzierbar zugewiesen. In jeder Gruppe kommen Raider, Scout, Guard und Stalker vor; bei mehr Gegnern wiederholen sich die Rollen in variierter Reihenfolge.

- **Scout:** Kann bis zu 7 Felder laufen und zieht sich bei halbem Leben oder weniger zurück, wenn ein Spieler höchstens 5 Felder entfernt ist. Bei der Flucht bevorzugt er verborgene Felder.
- **Raider:** Nähert sich aggressiv und priorisiert bei Schüssen Spieler mit weniger Deckung.
- **Guard:** Hält seinen Spawnposten, solange er kein gültiges Ziel zum Beschuss hat.
- **Stalker:** Kann bis zu 6 Felder laufen und bevorzugt beim Vorrücken erreichbare Felder außerhalb der aktuellen Spielersicht.

Alle Rollen greifen weiterhin nur aufgedeckte Spieler mit freier Sichtlinie an. Rollenvergabe und Verhalten sind in `src/engine/game.js` implementiert und durch Tests abgesichert; Aktionen wie Posten halten und Rückzug erscheinen im Gefechtslog.

## Priorität 5: Zufallskarten fair und lesbar halten

**Umgesetzt:** Die Kartengenerierung prüft Spawns und strategische Verteilung über 60 Seeds, einschließlich 48×48-Karten mit 20 Gegnern.

- Spieler- und Gegnerspawns liegen auf begehbaren Feldern und sind weiter als die gegnerische Erstschussreichweite voneinander entfernt.
- Jeder Spawn ist über das begehbare Wegenetz mit dem anderen Team verbunden.
- Jeder Kartenquadrant enthält Deckung und erhöhte Positionen.
- Drei seedstabile Kontrollpunkt-Markierungen liegen auf begehbaren Feldern entlang der Kartenmitte und bleiben im Nebel verborgen, bis sie aufgedeckt sind.
- Der vollständige Seed ist im HUD sichtbar und lässt sich kopieren.

Ein Test prüft diese Eigenschaften über 60 Seeds. Die Kontrollpunkte sind derzeit strategische Wegmarken; Capture-, Extraktions- und Siegbedingungen bleiben Teil der Missionslogik aus Priorität 1.

## Priorität 6: Große Gefechte flüssig halten

Bei 20 Gegnern kann eine feste Pause pro Gegner die Runde unnötig verlängern. Gegneraktionen sollten in einer überspringbaren Aktionsfolge laufen. Eine kürzere Standardgeschwindigkeit, eine Pause-/Fortsetzen-Taste und eine Option „Gegnerzug beschleunigen“ machen große Gefechte besser spielbar, ohne die Schüsse unsichtbar zu machen.

## Priorität 7: Langfristiger Fortschritt

Wenn der taktische Kern stabil ist, können kurze Kampagnen den Wiederspielwert erhöhen:

- Mehrere verbundene Einsätze mit wechselnden Zielen.
- Verletzungen oder begrenzte Ausrüstung zwischen Missionen.
- Freischaltbare Waffen und Fähigkeiten mit klaren Vor- und Nachteilen.
- Schwierigkeitsstufen, die Gegnerverhalten und Ressourcen verändern statt nur Lebenspunkte zu erhöhen.

## Empfohlene Reihenfolge

1. Missionsziel, Extraktion sowie Sieg- und Niederlagebedingungen.
2. Overwatch, Deckung und Flankieren als funktionierende Regeln.
3. Treffer-, Gefahren- und Sichtvorschauen.
4. Rollenbasierte Gegner-KI und erklärbare Aktionen.
5. Qualitätsprüfungen für prozedurale Karten und große Spawnzahlen.
6. Beschleunigung und weitere Komfortfunktionen.
7. Kampagne und Fortschrittssystem.

## Prüfkriterien

- Eine Mission lässt sich starten, gewinnen, verlieren und neu starten.
- Keine zufällige Karte platziert Einheiten auf unpassierbaren Feldern oder ohne erreichbare Route.
- Jede Fähigkeit verändert nachweisbar Kampf oder Positionierung und erklärt ihre Wirkung.
- Die KI greift keine verborgenen Einheiten an und ihre Entscheidungen sind im Log nachvollziehbar.
- Ein Gefecht mit 20 Gegnern bleibt verständlich und kann beschleunigt oder übersprungen werden.
- Alle Regeln für Sicht, Bewegung, Treffer und Missionsziele besitzen Engine-Tests.

## Implementierung

Die bestehenden Grenzen passen weiterhin: `src/engine/map.js` für Karten, Sicht und Pfade; `src/engine/game.js` für Aktionen, KI und Missionszustand; React-Komponenten für Vorschau und HUD. Neue Regeln sollten zuerst als reine Engine-Funktionen mit Tests entstehen und danach in der Oberfläche sichtbar gemacht werden.
