#!/usr/bin/env bash
# Offline-Ark – Inhalte aktualisieren (nur nötig, wenn Internet verfügbar ist).
#
# Was passiert:
#   1. Gemeinfreie PDFs aus scripts/library.json nach /library laden
#   2. Seiten neu erzeugen: content/*.md -> knowledge/*.html, Suchindex, Quellenseite, Bibliothek
#   3. Quellen-Links prüfen (nur Warnungen)
#
# Voraussetzung: Node.js (https://nodejs.org). Windows: in Git Bash oder WSL ausführen,
# oder die drei "node"-Befehle unten direkt in der Eingabeaufforderung starten.
#
# Benutzung:  ./update-content.sh            (neue/fehlende Dateien laden)
#             ./update-content.sh --force    (PDFs neu laden)
#             ./update-content.sh --offline  (nur Seiten neu erzeugen, ohne Internet)

set -u
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt. Bitte von https://nodejs.org installieren." >&2
  exit 1
fi

MODE="${1:-}"

if [ "$MODE" != "--offline" ]; then
  if curl -fsS -m 8 -o /dev/null https://archive.org >/dev/null 2>&1; then
    echo "== 1/3 Bibliothek laden"
    node scripts/fetch-library.js ${MODE:+$MODE} || echo "Hinweis: Nicht alle Dateien konnten geladen werden."
  else
    echo "Kein Internet erkannt – überspringe Download und Linkprüfung."
    MODE="--offline"
  fi
fi

echo "== 2/3 Seiten erzeugen"
node scripts/build.js

if [ "$MODE" != "--offline" ]; then
  echo "== 3/3 Quellen-Links prüfen"
  node scripts/check-links.js
fi

echo "Fertig. index.html im Browser öffnen."
