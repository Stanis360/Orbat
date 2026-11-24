# Baustellen-App

Damit erfasst du deine Baustellen auf **Handy und PC**. Alle Daten liegen **direkt auf dem Gerät**, deshalb funktioniert die App auch auf der Baustelle ohne Empfang.
Sobald ein Gerät den **kleinen Server auf deinem PC zu Hause** erreicht, gleicht es die Daten automatisch mit den anderen Geräten ab. Eine Cloud oder ein Konto brauchst du dafür nicht.

**Funktionen**
- **Baustellen** mit Kunde, Telefon (antippen ruft an), Adresse (öffnet die Karte), Status, Zeitraum und Notizen
- **Maße** nach Raum/Bereich (L × B × H × Anzahl). Fläche (m²) und Volumen (m³) rechnet die App selbst aus.
- **Grundriss zeichnen**: Wände, Fenster, Türen, Hilfslinien und Raumnamen. Die Längen erscheinen automatisch, und eine Wand lässt sich auch exakt per Zahl auf Länge bringen. Alles rastet im 10-cm-Raster und an vorhandenen Ecken ein. Zoomen geht mit zwei Fingern oder dem Mausrad, außerdem gibt es Rückgängig und den Export als Bild (PNG).
- **Preisliste** (einmal anlegen, dann nur noch auswählen):
  - **Materialien** mit Einheit, Einkaufspreis, Kundenpreis, Kategorie, Lieferant und Artikelnummer. Fehlt der Kundenpreis, rechnet die App ihn automatisch aus Einkauf + Aufschlag aus (Standard 20 %, einstellbar).
  - **Ganze Liste einfügen**: Zeilen in Excel markieren, kopieren und einfügen, fertig. Vorhandene Materialien werden dabei aktualisiert. Ein **„-“ als Kundenpreis** bedeutet „wird nicht verrechnet“, z.B. für Silikon-Tuben, wenn der Kunde pro lm Silikon zahlt.
  - Material **ohne Kundenpreis** erscheint nicht auf Angebot und Rechnung. Es bleibt aber auf der Baustelle, in der Bestellliste und bei den Einkaufskosten. Die Preisliste lässt sich auch als Excel-Datei (CSV) speichern, bearbeiten und wieder einfügen.
  - **Stundensätze** (z.B. Facharbeiter 55 €/h, Helfer 38,50 €/h), einer davon als Standard
- **Stunden**: Datum, wer, von–bis, Pause, Tätigkeit und **Stundensatz zum Auswählen**. Aus von–bis und Pause werden die Stunden berechnet, der Betrag erscheint sofort.
- **Material** auf der Baustelle:
  - **„Aus Preisliste wählen“**: mehrere Materialien auf einmal mit ＋/− oder Menge antippen und übernehmen
  - **„Freie Eingabe“**: Kennt die App das Material schon, füllt sie Einheit und Preise selbst aus. Neues Material landet auf Wunsch gleich in der Preisliste.
  - **Bestellstatus**: 🔴 Zu bestellen → 🟠 Bestellt → 🟢 Vorhanden. Den Status antippen schaltet weiter.
  - Summe für den Kunden, Einkauf und Aufschlag
- **Bestellungen** (Startseite): alles, was auf allen Baustellen noch zu bestellen oder schon bestellt ist. Mit **„Liste senden“** geht die Bestellliste, nach Lieferant sortiert, per WhatsApp oder E-Mail raus.
- **Preise bleiben fest**: Änderst du später einen Preis in der Preisliste, bleiben bereits eingetragene Stunden und Materialien beim alten Preis.
- **Fotos** pro Baustelle: direkt mit der Kamera aufnehmen oder mehrere aus der Galerie wählen. Die Fotos sind nach Tag sortiert und bekommen eine Notiz. In der Vollbild-Ansicht blätterst du per Wischen oder mit den Pfeiltasten und kannst ein Foto herunterladen. Die App verkleinert jedes Foto automatisch auf max. 1920 px (ca. 200–400 KB).
- **Angebot und Rechnung** pro Baustelle zum Drucken oder als PDF, im klassischen Layout:
  - Firmenkopf, Datum, Nummer, Zielort, Empfänger, Kundennummer
  - Positionen mit Code, Beschreibung, ME, Menge, Einzelpreis, Betrag und USt.
  - Unten Zahlungsart, Bank/IBAN, MwSt.-Aufstellung, Betrag Details und „Zu zahlen gesamt“
  - **Aufgeteilt in „Material“ und „Arbeit“**, jeweils mit Zwischensumme, darunter die Gesamtsumme. Das lässt sich abschalten. Ob ein Eintrag zu Material oder Arbeit gehört, stellst du in der Preisliste ein („Im Angebot unter“). Beim Einfügen einer Liste zählt alles mit der Kategorie „Arbeit“ (oder z.B. „Verlegen“, „Montage“) zur Arbeit. Stunden sind immer Arbeit.
  - Die Positionen kommen automatisch aus Material/Leistungen und Stunden der Baustelle. Die Stunden lassen sich pro Eintrag (mit Tätigkeit) oder pro Stundensatz zusammengefasst ausweisen.
  - Nummern laufen automatisch weiter, getrennt für Angebote und Rechnungen. Die Nummer wird beim ersten Drucken vergeben und lässt sich ändern.
  - Die Einleitungszeile (z.B. „Liefern und verlegen der Wand- und Bodenfliesen für das Bad“) und die MwSt. stellst du pro Baustelle ein.
  - Deine **Firmendaten** trägst du einmal unter ⚙ Einstellungen ein. Sie werden auf alle Geräte synchronisiert.
- **Bericht** pro Baustelle zum Drucken oder als PDF: Arbeitszeit und Material mit Kundenpreisen, Summe netto, MwSt. und brutto. Dazu kommen Maße, Grundrisse und auf Wunsch Fotos. Die Preise lassen sich ausblenden, z.B. für einen reinen Leistungsnachweis. Den MwSt.-Satz stellst du unter ⚙ ein (Standard 20 %).
- **Export** aller Stunden und des Materials als CSV für Excel. Außerdem gibt es eine **Sicherung** als Datei, und der Server legt jeden Tag automatisch eine Sicherung an.

Oben rechts siehst du immer den Sync-Stand:
🟢 **Aktuell** · 🟠 **3 offen** (diese Änderungen warten auf den Sync, z.B. weil du unterwegs bist) · ⚪ **Offline**

---

## Einrichtung

### 1. Server auf dem PC zu Hause

1. **Node.js** installieren: https://nodejs.org → „LTS“ herunterladen und installieren.
2. Die App herunterladen: auf GitHub in diesem Repository **„<> Code“ → „Download ZIP“** klicken, die ZIP-Datei mit Rechtsklick
   → **„Alle extrahieren…“** entpacken und den Ordner dorthin kopieren, wo er bleiben soll, z.B. nach `C:\Baustellen`.
   Bei einem Update die neuen Dateien einfach darüberkopieren. Der Ordner `daten` mit deinen Daten bleibt dabei erhalten.
3. **Windows:** Doppelklick auf `start-windows.bat`.
   **Mac/Linux:** `./start.sh` ausführen.
4. Im Fenster stehen dann die Adressen, z.B.:
   ```
   Auf diesem PC:        http://localhost:8080
   Im Heimnetz (Handy):  http://192.168.178.25:8080
   ```
   Das Fenster muss offen bleiben, solange synchronisiert werden soll.

> **Automatisch mit Windows starten:** Mit `Win + R` den Befehl `shell:startup` öffnen und dort eine
> Verknüpfung zu `start-windows.bat` anlegen.

Wenn beim ersten Start die Windows-Firewall fragt, wähle **„Private Netzwerke“ zulassen**.

### 2. Auf dem PC öffnen

Im Browser **http://localhost:8080** öffnen. In Chrome oder Edge kannst du sie über das Symbol rechts in der Adressleiste
als App installieren.

### 3. Aufs Handy holen

Hier gibt es zwei Wege:

#### Variante A – ganz einfach, nur im Heimnetz
Im WLAN zu Hause die Adresse aus dem Server-Fenster öffnen (z.B. `http://192.168.178.25:8080`) und
sie zum Startbildschirm hinzufügen.

⚠️ **Einschränkung:** Bei einer `http://`-Adresse erlauben Handy-Browser keinen Offline-Speicher für die App selbst.
Die **Daten** bleiben zwar auf dem Handy, aber unterwegs **startet die App nicht**, wenn der Server nicht erreichbar ist.
Ist die App schon offen, kannst du weiterarbeiten. Für den echten Einsatz auf der Baustelle nimm deshalb Variante B.

#### Variante B – empfohlen: mit Tailscale (kostenlos, ca. 10 Min.)
Tailscale verbindet deine Geräte sicher miteinander und liefert eine echte `https://`-Adresse. Damit läuft die App
**komplett offline** auf dem Handy und synchronisiert, sobald der PC erreichbar ist, zu Hause und auf Wunsch auch unterwegs.

1. Auf **https://tailscale.com** ein kostenloses Konto anlegen.
2. Tailscale auf dem **PC** und dem **Handy** installieren und mit demselben Konto anmelden.
3. In der Tailscale-Verwaltung (https://login.tailscale.com/admin/dns) **HTTPS Certificates** aktivieren.
4. Auf dem PC eine Eingabeaufforderung öffnen und Folgendes eingeben:
   ```
   tailscale serve --bg 8080
   ```
   Angezeigt wird eine Adresse wie `https://mein-pc.tail1234.ts.net`.
5. Diese Adresse auf dem Handy öffnen und die App installieren:
   - **Android (Chrome):** Menü ⋮ → **„App installieren“**
   - **iPhone (Safari):** Teilen-Symbol → **„Zum Home-Bildschirm“**

Willst du **nur im Heimnetz** synchronisieren, schaltest du Tailscale auf dem Handy einfach aus, wenn du unterwegs bist.
Die App funktioniert trotzdem offline weiter.

### 4. Optional: Passwort für den Sync

Statt per Doppelklick so starten (Windows, Eingabeaufforderung im Ordner):
```
set PASSWORT=meinGeheimnis && node server.js
```
Das gleiche Passwort trägst du dann in der App unter **⚙ Einstellungen → Sync-Passwort** ein.

---

## Wie der Sync funktioniert

- Jede Änderung wird **sofort auf dem Gerät** gespeichert.
- Ist der Server erreichbar, gleicht die App alles innerhalb weniger Sekunden ab. Das passiert auch beim Öffnen der App und danach alle 30 Sekunden.
- Wurde derselbe Eintrag auf zwei Geräten geändert, gewinnt die **neuere Änderung**.
- **Fotos:** Mit den normalen Daten wird nur ein kleines Vorschaubild abgeglichen. Das Foto in voller Größe wird beim Sync
  getrennt hoch- bzw. heruntergeladen. Bis dahin zeigt ein anderes Gerät die Vorschau an.
- Gelöschte Einträge verschwinden auch auf den anderen Geräten. Wird eine Baustelle gelöscht, gehen ihre Maße, Stunden, Materialien und Pläne mit.

## Datensicherung

- Der Server speichert alles in `daten/daten.json`, die Fotos als normale JPG-Dateien in `daten/fotos/`.
  Gelöschte Fotos verschiebt er nach `daten/fotos/geloescht/`, sie sind also nicht sofort weg.
- Von `daten.json` legt er **jeden Tag** eine Kopie in `daten/sicherungen/` ab. Die letzten 30 Tage bleiben erhalten.
- 👉 Den **ganzen** Ordner `daten` (inklusive Fotos) ab und zu auf einen USB-Stick oder in eine Cloud kopieren.
- Wiederherstellen: Server beenden, die gewünschte Sicherung als `daten/daten.json` zurückkopieren und den Server neu starten.
- Zusätzlich lässt sich in der App unter **⚙ → Sicherung speichern** jederzeit alles als Datei sichern und wieder einspielen
  (diese Datei enthält von den Fotos nur die Vorschaubilder).

## Aufbau (für Entwickler)

```
server.js            Sync-Server + Auslieferung der App (Node.js, keine Abhängigkeiten)
start-windows.bat    Startskript Windows
start.sh             Startskript Mac/Linux
app/index.html       Grundgerüst
app/style.css        Design (inkl. Dark Mode, Druckansicht)
app/js/app.js        Ansichten, Formulare, Bericht, Export
app/js/store.js      Lokale Datenhaltung (IndexedDB), Löschmarken
app/js/sync.js       Abgleich mit dem Server (Änderungen seit letzter Sequenznummer)
app/js/grundriss.js  Grundriss-Editor (SVG)
app/js/fotos.js      Fotos verkleinern, Vollbild-Ansicht
app/js/preise.js     Preisliste, Stundensätze, Material + Bestellstatus, Bestellliste
app/js/dokument.js   Angebot / Rechnung, Firmendaten
app/js/ui.js         Gemeinsame Hilfen (Formular-Dialog, Formatierung)
app/sw.js            Service Worker (App offline verfügbar, nur über https/localhost)
daten/               Datenbestand + tägliche Sicherungen (wird angelegt, nicht im Git)
```

Sync-Protokoll: `POST /api/sync { since, changes[] }` liefert `{ seq, records[] }`. Jeder Datensatz trägt
`id`, `typ`, `updatedAt`, `dev` und optional `deleted`. Konflikte entscheidet die neuere Änderung (`updatedAt`).
Fotos: `PUT /api/foto/<id>` (JPEG) und `GET /api/foto/<id>`. Ein Foto-Datensatz enthält ein Vorschaubild (`thumb`).
