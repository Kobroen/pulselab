# Learnlab Puls (pulselab)

Bevegelsesbasert læringsspill for Learnlab. Brukeren (Erlend) skriver norsk.
All tekst i grensesnitt, README og kodekommentarer er på norsk (bokmål).

## Kommandoer

- `npm run build` – typesjekk og bygging. Skal alltid gå grønt før innsjekking.
- `npm run preview` – serverer `dist/` på port 4173.
- `npm run smoke` – røyktest av spillet med falskt kamera (krever Playwright og bygget `dist/`).
- `npm run smoke:sporing` – røyktest av sporingstesten (`sporingstest.html`).

## Faste regler

- **Målenhet:** skole-Chromebook med Celeron N4020, 2 tråder, 4 GB minne. Alt
  skal føles bra der. Bedre enheter får penere grafikk, ikke omvendt.
- **Personvern:** kamerabilder og kroppspunkter forlater aldri enheten og lagres
  ikke. Ingen tredjepartsskript, ingen analyseverktøy, ingen eksterne skrifter.
  Modeller og WebAssembly serveres fra egen adresse.
- **Sporing på egen tråd:** all bildetolkning skjer i en arbeider. Hovedtråden
  tegner bare.
- **Ingen minnetildeling i spilløkka** der det kan unngås.
- **Kamerafri modus er likeverdig:** spill skal få abstrakte signaler, aldri
  snakke direkte med kameraet.
- **Originalt uttrykk:** ikke kopier navn, figurer, grafikk eller baner fra
  eksisterende spill eller produkter.
- Arbeideren bygges som klassisk arbeider (`worker.format: 'iife'`) og er bare
  verifisert slik, så
  test alltid mot bygget utgave, ikke bare utviklingstjeneren.

## Arbeidsflyt

- `main` publiseres automatisk til GitHub Pages. Endringer går via gren og
  endringsforespørsel.
- Learnlabs øvrige apper er Angular 16 og .NET 8 i Azure DevOps. Spillmotoren
  holdes rammeverksfri slik at den kan legges inn i et Angular-skall senere.

## Oppbygging

- `index.html` og `src/spill/` er spillet. `sporingstest.html`, `src/main.ts` og
  `src/worker.ts` er målesiden fra fase 0.
- Spillene (`rekk.ts`, `sveip.ts`) leser bare `Signaler` fra `signaler.ts`.
  Kildene er `kamerakilde.ts` og `pekerkilde.ts`.
- Fellesmodus for klassen (`klasse.ts`) kjører ferdige økter fra `okter.ts` på storskjerm, uten kamera.
  Nye økter er bare data. `?fart=12` spoler økta i røyktesten.
  Et steg med `velg` trekker én av flere øvelser hver gang økta startes.
- Aldersnivåene (`niva.ts`: småskole, mellomtrinn og ungdom, voksen) følger valgt trinn og styrer
  uttrykk, tekst og tall, ikke spillereglene.
- Oppgavebanken ligger i `innhold/` og eies av en egen arbeidsstrøm. Spillet leser den
  gjennom `src/spill/bank.ts` og endrer ikke filene der.
- Skriften er Hurme Geometric Sans 3 (`src/spill/skrift/`). Learnlab har
  bruksrett. Filene er lisensiert og skal ikke gjenbrukes utenfor Learnlab.
