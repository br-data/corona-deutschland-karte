# Corona-Deutschlandkarte

Interaktive Deutschlandkarte, die die COVID19-Infektionszahlen auf Landkreis-/Stadtebene zeigt.

## Verwendung

### Installation

Repository klonen Node packages installieren  

```bash
git clone https://github.com/br-data/corona-deutschland-karte.git
cd corona-deutschland-karte
npm install
```

### lokal als Webserver starten

```bash
npm start
```

### Daten aktualisieren, komprimieren und deployen

```bash
npm run-script build
```

## Datenquelle

Die Daten stammen indirekt vom [RKI-Corona-Datenportal](https://npgeo-corona-npgeo-de.hub.arcgis.com/datasets/dd4580c810204019a7b8eb3e0b329dd6_0), die täglich über das [RKI-Corona-Daten-Archiv von ARD-Data](https://github.com/ard-data/2020-rki-archive) gesäubert werden und von dort heruntergeladen werden (`bin/1_fetch_data.js`).
