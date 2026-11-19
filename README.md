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

**Pugg og prøv** lar læreren lime inn egne spørsmål, ett per linje med semikolon mellom spørsmål
og svar. De blir en klasseøkt eller en runde Rekk eller Sveip, og kan deles med elevene som en
lenke der spørsmålene ligger etter `#`, så ingenting lastes opp.

**Start med klassen** er lærerens vei inn: velg en ferdig økt (Powerbreak på 3 minutter, eller
Gangetabellen og Ordklasser på 5 minutter) og vis den på storskjerm. Klassen gjør øvelsene
figuren viser, og svarer på spørsmål med kroppen: hvert svar har sin bevegelse. Det trengs
verken kamera eller innlogging. Læreøktene hentes fra oppgavebanken i `innhold/`, filtrert på trinn og fag,
og hvert sett lastes først når økta starter. Etter økta teller tiden i bevegelse mot klassemålet
(10 meter per minutt mot Galdhøpiggen), som bare lagres på enheten. Mellomrom pauser, pil høyre hopper videre og Esc avslutter.

Holder ikke enheten bildeflyten, senkes oppløsningen på spillflaten automatisk i to trinn (`?kvalitet=lav`
tvinger det fram). Mangler kameraet eller er det sperret, forklarer skjermen hvorfor og løfter fram «Spill uten kamera».

Øvelsene trekkes fra ti ulike, så økta får ny blanding hver gang. Uttrykket følger trinnet:
småskolen får tre svar, rolig tempo, stjerner for framdrift og ingen tall som teller ned, og voksne
får et nøkternt uttrykk uten åser, konfetti og stjerner. Læreren kan velge et annet uttrykk under «Tilpass økta».

I tillegg har **Powerbreak** spillet Intervall: fire korte øvelser på rad (hopp,
sprellemann, knebøy og boksing i lufta). Bevegelsene telles, og sola vokser med
energien. Uten kamera gjøres øvelsene med trykk, mellomrom og pekeren.

Alle spillene kan spilles med kamera eller uten. Uten kamera styrer du med mus eller
finger, og i Rekk også med tastene 1 til 4. Pugg og prøv er ikke laget ennå.

Nyttig under testing:

- Tasten `M` (eller `?maal=1` i adressen) viser en måleskjerm med bilder per
  sekund, sporinger per sekund og forsinkelse.
- Under spillet kan lyd og risting skrus av hver for seg. Rolig bevegelse følger
  innstillingen i operativsystemet.
- `?antall=3` gir kortere runder i Rekk, `?varighet=20` kortere runder i Sveip og
  `?intervall=5` kortere øvelser i Powerbreak.

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
src/spill/rekk.ts, sveip.ts, intervall.ts  spillene
src/spill/felles.ts, tegning.ts  papirklipp-tegning, figur, konfetti
src/spill/lyd.ts, effekter.ts  lyd (Web Audio, ingen lydfiler) og småeffekter i menyene
src/spill/oppgaver.ts      regelbaserte oppgaver
src/main.ts, worker.ts, types.ts  sporingstesten
public/models              modellfiler, se README der for kilde og lisens
scripts/                   kopiering av WebAssembly-filer og røyktester
```

Skriften er Hurme Geometric Sans 3, som Learnlab har bruksrett på. Fontfilene
i `src/spill/skrift/` er lisensiert og kan ikke gjenbrukes utenfor Learnlab.
