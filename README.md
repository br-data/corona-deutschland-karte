# Corona-Deutschlandkarte

Interaktive Deutschlandkarte, die die COVID19-Infektionszahlen auf Landkreis-/Stadtebene zeigt.

## Verwendung

### Installation

Repository klonen und Node packages installieren  

```bash
git clone https://github.com/br-data/corona-deutschland-karte.git
cd corona-deutschland-karte
npm install
```

### lokal als Webserver starten

```bash
npm start
```

### Daten aktualisieren, alles komprimieren und auf Google Cloud deployen

```bash
npm run-script build
```

### Die Build-Skripte im Detail

`npm run-script build` führt hintereinander vier Build-Skripte aus, die auch einzeln ausgeführt werden können:

- `bin/1_fetch_data.js` lädt aus dem [RKI-Corona-Daten-Archiv von ARD-Data](https://github.com/ard-data/2020-rki-archive) die aktuellen Zahlen runter.
- `bin/2_prepare_data.js` parsed die aktuellen Zahlen, holt sich noch notwendige Geodaten aus den `data/*.geo.json`, und speichert alles in der `docs/data.js`. Damit sind die Daten aktuell und können lokal mit `npm start` betrachtet werden.
- `bin/3_build.js` sammelt alle notwendigen HTML-, JavaScript- und CSS-Dateien, merged und minified sie, und generiert in `publish/` eine kompakte Version, die bereit für das Deployment ist.
- `bin/4_deploy.sh` komprimiert die Daten, um den Server bei der Auslieferung von gzip-komprimierten Versionen zu unterstützen, und lädt die Dateien in die Google Cloud hoch. Der Upload funktioniert natürlich nur für BR-Mitarbeiter\*innen mit den entsprechenden Berechtigungen.

## Datenquelle

Die Daten stammen indirekt vom [RKI-Corona-Datenportal](https://npgeo-corona-npgeo-de.hub.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0), die täglich über das [RKI-Corona-Daten-Archiv von ARD-Data](https://github.com/ard-data/2020-rki-archive) gesäubert werden und von dort heruntergeladen werden (`bin/1_fetch_data.js`).
