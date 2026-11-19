# Oppgavebank for Learnlab Puls

Korte flervalgsoppgaver som passer spillene: ett spørsmål, ett riktig svar og tre
gale. Alt er laget for å leses på avstand, så spørsmål og svar er korte.

## Oppbygging

```
innhold/
  typer.ts              typene for sett, oppgaver og indeks
  nb/                   bokmål
    indeks.json         liste over alle sett, uten oppgavene
    matematikk/         ett sett per fil, filnavn = sett-id
    norsk/
    engelsk/
    naturfag/
    samfunnsfag/
    krle/
```

Settene er ordnet etter fag og trinn (`1-4`, `5-7`, `8-10`, `vgs`). `indeks.json`
har det menyen trenger, så spillet kan vente med å laste et sett til det er valgt.

## Et sett

```json
{
  "id": "samfunnsfag-5-7-europas-hovedsteder",
  "versjon": 1,
  "sprak": "nb",
  "fag": "samfunnsfag",
  "trinn": "5-7",
  "tittel": "Europas hovedsteder",
  "beskrivelse": "Koble land og hovedstad.",
  "lk20": ["SAF01-04, etter 7. trinn: geografiske hovedtrekk i Europa"],
  "oppgaver": [
    {
      "id": "01",
      "tekst": "Hva heter hovedstaden i Sverige?",
      "riktig": "Stockholm",
      "gale": ["Roma", "Brussel", "Paris"],
      "nokkel": "Sverige – Stockholm"
    }
  ]
}
```

Spillet stokker svarene selv. `nokkel` er merkelappen som vises under «Øv mer på».

`lk20` sier hvor settet hører hjemme: læreplankode, trinn og tema med egne ord.
Det er ikke sitater fra læreplanen, og formuleringene er ikke kontrollert mot
udir.no.

## Regler

- Spørsmål: maks 60 tegn. Svar: maks 14 tegn, helst under 10.
- Tre gale svar per oppgave. Færre er lov når det ikke finnes flere rimelige.
- Minst 12 oppgaver per sett, helst rundt 20.
- Bare ett svar skal kunne forsvares som riktig. Unngå gale svar som er riktige
  i en annen betydning, på nynorsk eller i en annen bøyningsform.
- I rettskrivingsoppgaver skal de gale svarene ikke være ekte ord.
- Desimaltall skrives med komma, minus med «−» og gange med «×».
- Ingen oppgaver om ting som endrer seg ofte, som hvem som er statsminister.

## Sjekk

```
npm run innhold:sjekk             sjekker alle sett
npm run innhold:sjekk -- --skriv  skriver også indeks.json på nytt
```

Sjekken ser på format, lengder, like svar og like oppgaver. Regnestykker,
prosentoppgaver, avrunding og likninger regnes ut på nytt og sammenlignes med
fasit, og den sjekker at ingen av de gale svarene også er riktige. Kjør den med
`--skriv` etter hver endring, så følger indeksen med.

## Flere språk

Nynorsk og engelsk legges i `innhold/nn/` og `innhold/en/` med samme mapper, samme
sett-id og samme oppgave-id. Da kan spillet bytte språk uten å miste hvor eleven
er. Sett som bare gir mening på ett språk, som rettskriving, lages bare der.
