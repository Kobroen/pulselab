# Learnlab Puls

Bevegelsesbasert læringsspill for Learnlab. Kroppen er kontrolleren: webkameraet
leser bevegelsene dine på enheten, og du løser fagoppgaver ved å bevege deg.
Engelsk navn: Learnlab Pulse.

Publiseres til GitHub Pages fra `main`: https://kobroen.github.io/pulselab/

## Demoen

Dette er en tidlig demo i den grafiske retningen «Papirklipp». Den har
Læremodus med to spill og to temaer (gangetabellen og ordklasser):

| Spill | Tempo | Slik spilles det |
|---|---|---|
| Rekk | Rolig | Strekk hånda inn i riktig svar og hold den der til ringen er full. Ti spørsmål. |
| Sveip | Høyt | Svarene flyr forbi i buer. Slå til det riktige og la de gale passere. Ett minutt, og farten øker med komboen. |

Begge kan spilles med kamera eller uten. Uten kamera styrer du med mus eller
finger, og i Rekk også med tastene 1 til 4. Powerbreak og Pugg og prøv er ikke
laget ennå.

Nyttig under testing:

- Tasten `M` (eller `?maal=1` i adressen) viser en måleskjerm med bilder per
  sekund, sporinger per sekund og forsinkelse.
- Under spillet kan lyd og risting skrus av hver for seg. Rolig bevegelse følger
  innstillingen i operativsystemet.
- `?antall=3` gir kortere runder i Rekk, og `?varighet=20` kortere runder i Sveip.

### Slik virker styringen

Sporingen (MoveNet Lightning på prosessoren) kjører i en egen arbeidertråd.
Kroppspunktene gjøres om til abstrakte signaler: hvor hendene er, og en
kroppsfigur til tegning. Hendene måles i skulderbredder ut fra skuldrene, så
det spiller liten rolle hvor langt unna kameraet du står. Står du så nær at
utstrakte armer ikke får plass i bildet, brukes bildebredden som målestokk i
stedet, slik at mindre bevegelser rekker like langt.

## Sporingstesten

Målesiden fra fase 0 ligger på https://kobroen.github.io/pulselab/sporingstest.html

Den kjører fire oppsett etter tur og viser tallene i en tabell:

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
- Modeller, WebAssembly-filer og skrift serveres fra samme adresse som siden.
  Ingenting hentes fra tredjepart når siden kjører.
- Kameraet slås av når fanen skjules, og når du går ut av spillet.
- Kameraet er frivillig. Det slås først på når du trykker «Slå på kameraet».

## Utvikling

```bash
npm install
npm run dev            # utviklingstjener. Arbeiderne er bare testet i bygget utgave
npm run build          # typesjekk og bygging til dist/
npm run preview        # serverer dist/ på port 4173
npm run smoke          # røyktest av spillet i Chromium med falskt kamera, krever Playwright
npm run smoke:sporing  # røyktest av sporingstesten
```

Røyktesten av spillet kan lagre skjermbilder: `SHOTS=mappe npm run smoke`.
Røyktesten av sporingstesten kan få en MJPEG-fil med en person som argument:
`node scripts/smoke.mjs person.mjpeg`.

## Oppbygging

```
index.html                 spillet
sporingstest.html          målesiden fra fase 0
src/spill/app.ts           skjermene og spilløkka (hovedtråd)
src/spill/signaler.ts      de abstrakte signalene spillene leser
src/spill/kamerakilde.ts   kamera og kroppspunkter gjort om til signaler
src/spill/pekerkilde.ts    mus, finger og tastatur gjort om til de samme signalene
src/spill/sporing.worker.ts  sporingsarbeider: laster modellen og tolker bilder
src/spill/rekk.ts, sveip.ts  de to spillene
src/spill/felles.ts, tegning.ts  papirklipp-tegning, figur, konfetti
src/spill/lyd.ts, effekter.ts  lyd (Web Audio, ingen lydfiler) og småeffekter i menyene
src/spill/oppgaver.ts      regelbaserte oppgaver
src/main.ts, worker.ts, types.ts  sporingstesten
public/models              modellfiler, se README der for kilde og lisens
scripts/                   kopiering av WebAssembly-filer og røyktester
```

Skriften er Hurme Geometric Sans 3, som Learnlab har bruksrett på. Fontfilene
i `src/spill/skrift/` er lisensiert og kan ikke gjenbrukes utenfor Learnlab.
