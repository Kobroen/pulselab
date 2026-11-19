# Learnlab Puls

Bevegelsesbasert læringsspill for Learnlab. Kroppen er kontrolleren: webkameraet
leser bevegelsene dine på enheten, og du løser fagoppgaver ved å bevege deg.
Engelsk navn: Learnlab Pulse.

Prosjektet er i **fase 0**. Det eneste som finnes nå er en testside som måler
hvor godt kroppssporing går på en gitt enhet, særlig billige skole-Chromebooks.

## Testsiden

Publiseres til GitHub Pages fra `main`: https://kobroen.github.io/pulselab/

Siden kjører fire oppsett etter tur og viser tallene i en tabell:

| Oppsett | Modell | Kjøres på |
|---|---|---|
| `movenet-webgl` | MoveNet SinglePose Lightning (TF.js) | grafikkort |
| `movenet-wasm` | MoveNet SinglePose Lightning (TF.js) | prosessor |
| `mediapipe-gpu` | MediaPipe Pose Landmarker lite | grafikkort |
| `mediapipe-cpu` | MediaPipe Pose Landmarker lite | prosessor |

For hvert oppsett måles lastetid, tid per bilde, forsinkelse, sporinger per
sekund, bildeflyt på skjermen mens sporingen går, og hvor ofte kroppen ble
funnet. Etterpå kan hvert oppsett prøves fritt med «Prøv», og rapporten kan
kopieres som tekst.

Nyttige adresseparametre: `?dur=5` setter måletid per oppsett i sekunder
(standard 12), og `?auto=1` starter testen uten klikk.

## Personvern

- Kamerabildet tolkes i nettleseren, i en egen arbeidertråd, og kastes straks.
- Ingenting sendes fra enheten. Siden har ingen tjenerside og ingen analyse.
- Modeller og WebAssembly-filer serveres fra samme adresse som siden. Ingenting
  hentes fra tredjepart når siden kjører.
- Kameraet slås av når fanen skjules.

## Utvikling

```bash
npm install
npm run dev       # utviklingstjener. Arbeideren er bare testet i bygget utgave
npm run build     # typesjekk og bygging til dist/
npm run preview   # serverer dist/ på port 4173
npm run smoke     # røyktest i Chromium med falskt kamera, krever Playwright
```

Røyktesten kan få en MJPEG-fil med en person som argument:
`node scripts/smoke.mjs person.mjpeg`.

## Oppbygging

```
src/main.ts     måleløp, tegning og visning (hovedtråd)
src/worker.ts   sporingsarbeider: laster modell og tolker bilder
src/types.ts    oppsett og meldinger mellom hovedtråd og arbeider
public/models   modellfiler, se README der for kilde og lisens
scripts/        kopiering av WebAssembly-filer og røyktest
```
