# Offline-Ark Chat-Server

Ein kleiner Server (reines Node.js, **keine Pakete nötig**), mit dem Nachbarn, Familie und Helfer im selben WLAN oder Hotspot schreiben können – ohne Internet. Der Server

1. liefert das Offline-Ark-Projekt aus (nur lesend), damit die Handys die Seiten direkt öffnen können, und
2. bietet die Chat-Schnittstelle unter `/api/chat/…`.

> **Wichtig:** Nur im eigenen WLAN oder Hotspot verwenden. Es gibt **keine Verschlüsselung** (HTTP). Wer im Netz ist, kann mitlesen. Den Server nie ins Internet freigeben (kein Port-Forwarding, keine öffentliche Adresse).

## Schnellstart

1. **Node.js 16 oder neuer** auf dem Laptop oder Raspberry Pi installieren ([nodejs.org](https://nodejs.org/en/download); Raspberry Pi: `sudo apt install nodejs`). Mit `node -v` prüfen.
2. Terminal im Offline-Ark-Ordner öffnen und starten:

   ```
   node server/chat-server.js
   ```
3. Der Server zeigt Adressen an, zum Beispiel `http://192.168.1.23:8080/tools/chat.html` (und einen QR-Code im Terminal). Diese Adresse auf allen Handys im selben WLAN öffnen, Namen eingeben, schreiben.

Beenden mit `Strg+C`.

## Optionen

| Option | Bedeutung |
| --- | --- |
| `--port 8080` | Port (Standard 8080; ändern, falls belegt) |
| `--host 0.0.0.0` | Adresse, auf der gelauscht wird. `127.0.0.1` = nur dieser Rechner |
| `--pin CODE` | Chat nur mit diesem Code (Raumpasswort), wird in der Kopfzeile `X-Chat-Pin` geprüft |
| `--log [Datei]` | Nachrichten dauerhaft sichern (Standard: `server/chat-log.json`); ohne die Option nur im Arbeitsspeicher |
| `--no-qr` | keinen QR-Code im Terminal zeigen |
| `--allow-host NAME` | zusätzlichen Host-Namen erlauben (siehe Sicherheit) |

Die Datei `chat-log.json` kann Gespräche enthalten. Sie wird nie ausgeliefert, sollte aber nicht weitergegeben werden. Löschen = Verlauf löschen.

## Kein WLAN? Hotspot

- **Windows:** Einstellungen → Netzwerk & Internet → Mobiler Hotspot. Der Laptop mit dem Server ist dann das WLAN.
- **Android:** Einstellungen → Netzwerk & Internet → Hotspot & Tethering → WLAN-Hotspot. Funktioniert auch ohne Internet. Auch Android kann den Server ausführen, z. B. mit der App Termux (`pkg install nodejs`); das ist nicht von uns getestet.
- **iPhone:** Der „Persönliche Hotspot“ funktioniert meist nur mit Mobilfunk-Tarif. Besser Laptop oder Android als Hotspot.
- **Raspberry Pi als Access Point (kurz):** Mit Raspberry Pi OS (NetworkManager):

  ```
  sudo nmcli device wifi hotspot ssid Offline-Ark password MeinGeheimesWort
  ```

  Das Passwort muss mindestens 8 Zeichen haben. Die Handys verbinden sich mit „Offline-Ark“; die Adresse des Pi steht beim Serverstart (häufig `10.42.0.1`). Ein WLAN-Chip kann nicht gleichzeitig Hotspot sein und sich mit einem anderen WLAN verbinden; für den Notfall reicht der Hotspot. Doku: <https://networkmanager.dev/docs/api/latest/nmcli.html>

## Raspberry Pi: automatisch starten (systemd)

Beispiel `/etc/systemd/system/offline-ark-chat.service` (Benutzer `pi` und Pfad anpassen):

```ini
[Unit]
Description=Offline-Ark Chat
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/offline-ark
ExecStart=/usr/bin/node server/chat-server.js --port 8080 --log --no-qr
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/pi/offline-ark/server
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Dann:

```
sudo systemctl daemon-reload
sudo systemctl enable --now offline-ark-chat
sudo systemctl status offline-ark-chat
```

Den Pfad zu `node` zeigt `which node`. Beim Start ohne WLAN-Verbindung hört der Server auf alle Adressen und ist erreichbar, sobald das Netz da ist.

## Schnittstelle (für Neugierige)

Alle Antworten sind JSON. Ist `--pin` gesetzt, braucht jeder Aufruf außer `info` die Kopfzeile `X-Chat-Pin: CODE`.

| Aufruf | Zweck |
| --- | --- |
| `GET /api/chat/info` | `{ app, pinRequired, defaultRoom, limits }` |
| `GET /api/chat/rooms` | Liste der Räume |
| `GET /api/chat/messages?room=&since=<id>&wait=<s>&limit=` | Nachrichten mit `id > since`. Ohne `since`: die letzten (bis 100). Mit `wait` (höchstens 25 s) wartet der Server auf neue Nachrichten (Long-Polling) |
| `POST /api/chat/send` | Body `{ "name": "…", "text": "…", "room": "…" }`, `Content-Type: application/json` |

Grenzen: Name ≤ 30 Zeichen, Raum ≤ 30, Text ≤ 1000, höchstens 500 Nachrichten je Raum (ältere fallen weg), höchstens 20 Räume, Body ≤ 8 KB, 20 Nachrichten pro Minute und IP. Zu lange Eingaben werden abgelehnt, nicht gekürzt.

## Sicherheit – was der Server tut (und was nicht)

**Tut:**

- liefert nur Dateien **innerhalb des Projektordners**, nur lesend (GET/HEAD). Pfade mit `..`, `\`, NUL-Zeichen, Windows-Datenströmen und Dateinamen mit Punkt am Anfang (`.git`, `.env` …) werden abgelehnt. Symbolische Links, die aus dem Ordner herausführen, werden nicht gefolgt.
- liefert `server/`, `scripts/`, `scratch/` und `node_modules/` nie aus (auch nicht `chat-log.json`).
- führt nichts aus: keine Skripte, keine Shell, kein `eval`. Nachrichten sind reiner Text; die Seite fügt sie mit Escaping ein. Steuerzeichen und Text-Richtungs-Tricks (RLO) werden entfernt.
- prüft den `Host`-Header (nur IP-Adressen, `localhost`, einfache Namen wie `raspberrypi` und `*.local`/`*.lan`/`*.fritz.box`) gegen DNS-Rebinding; fremde Webseiten können den Chat so nicht aus dem Browser eines Teilnehmers ansprechen. Eigener Name im Netz? Mit `--allow-host mein.name` erlauben.
- verlangt für Senden `application/json` und prüft `Origin` (Schutz vor fremden Formularen).
- begrenzt Body-Größe, Anfragen und Nachrichten je IP, Wartezeiten (Timeouts) und gleichzeitige Long-Polling-Verbindungen; falsche PIN-Versuche werden gebremst. Der PIN-Vergleich ist zeitkonstant.
- setzt `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` und für HTML eine Content-Security-Policy (nur Inhalte vom Server selbst).

**Tut nicht / Grenzen:**

- **Keine Verschlüsselung.** PIN und Nachrichten laufen im Klartext durchs WLAN.
- Namen sind nicht geprüft: Jeder kann sich „Anna“ nennen. Es gibt keine Konten.
- Der PIN schützt den Chat, nicht die ausgelieferten Offline-Ark-Seiten (die sind ohnehin öffentlich im Projekt).
- Das Limit pro IP schützt nicht vor vielen Geräten, die gemeinsam stören. Bei Missbrauch: Server neu starten (ohne `--log`) oder mit neuem `--pin`.
- Kein Schutz vor Menschen, die physisch Zugriff auf den Laptop haben.

## Tests

```
node scripts/test-chat.js
```

startet den Server auf einem zufälligen Port und prüft Nachrichten, Grenzen, PIN, Long-Polling, Pfad-Traversal, XSS-Texte, Host-/Origin-Schutz und die Log-Datei.

## Fehlerbehebung

- **Handy erreicht die Adresse nicht:** Beide im selben WLAN? Manche Gast-WLANs und Router trennen Geräte voneinander („Client-Isolation“) – dann Hotspot nutzen. Die Windows-Firewall muss den Zugriff für „Private Netzwerke“ erlauben.
- **„Port schon belegt“:** `--port 8081` (oder eine andere Zahl über 1024).
- **Mehrere Adressen angezeigt:** Nimm die, die zum WLAN/Hotspot gehört (meist `192.168.…` oder `10.…`).
