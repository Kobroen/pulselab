// Sjekker oppgavebanken i innhold/ og holder indeks.json ved like.
//
//   node scripts/sjekk-innhold.mjs           sjekker alt, feiler hvis noe er galt
//   node scripts/sjekk-innhold.mjs --skriv   skriver også indeks.json på nytt
//
// Ren Node uten avhengigheter. Regnestykker regnes ut på nytt og sammenlignes med fasit.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..', 'innhold');
const SKRIV = process.argv.includes('--skriv');

const FAG = [
  { id: 'matematikk', navn: 'Matematikk' },
  { id: 'norsk', navn: 'Norsk' },
  { id: 'engelsk', navn: 'Engelsk' },
  { id: 'naturfag', navn: 'Naturfag' },
  { id: 'samfunnsfag', navn: 'Samfunnsfag' },
  { id: 'krle', navn: 'KRLE' },
];
const TRINN = [
  { id: '1-4', navn: '1.–4. trinn' },
  { id: '5-7', navn: '5.–7. trinn' },
  { id: '8-10', navn: '8.–10. trinn' },
  { id: 'vgs', navn: 'Vgs og voksne' },
];

const MAKS_TEKST = 60;
const MAKS_SVAR = 14;
const MIN_OPPGAVER = 12;

const feil = [];
const merknader = [];

// ---------- Regning ----------

const OPPHØYD = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };

const REGNETEGN = /^[\d\s,+−×:()√⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+$/;

/** Leser et tall slik det skrives i oppgavene: «−5», «0,25», «10 000», «1/2». Gir NaN hvis det ikke er et tall. */
function lesTall(s) {
  const t = s.replace(/\s/g, '').replace('−', '-').replace(',', '.');
  const brøk = /^(-?\d+)\/(\d+)$/.exec(t);
  if (brøk) return Number(brøk[1]) / Number(brøk[2]);
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  // Svar som selv er et lite uttrykk, for eksempel «5⁴».
  if (REGNETEGN.test(s)) {
    try {
      return regn(s);
    } catch {
      return NaN;
    }
  }
  return NaN;
}

/** Regner ut et uttrykk med + − × : parenteser, potenser skrevet opphøyd og kvadratrot. */
function regn(uttrykk) {
  const s = uttrykk.replace(/\s/g, '');
  let i = 0;
  const tall = () => {
    const start = i;
    while (i < s.length && /[\d,]/.test(s[i])) i++;
    if (start === i) throw new Error(`uventet tegn «${s[i] ?? 'slutt'}»`);
    return Number(s.slice(start, i).replace(',', '.'));
  };
  const grunn = () => {
    let v;
    if (s[i] === '(') {
      i++;
      v = sum();
      if (s[i] !== ')') throw new Error('mangler )');
      i++;
    } else if (s[i] === '√') {
      i++;
      v = Math.sqrt(tall());
    } else v = tall();
    let neg = false;
    if (s[i] === '⁻') {
      neg = true;
      i++;
    }
    if (s[i] in OPPHØYD) {
      let e = 0;
      while (s[i] in OPPHØYD) e = e * 10 + OPPHØYD[s[i++]];
      v = v ** (neg ? -e : e);
    } else if (neg) throw new Error('minus uten eksponent');
    return v;
  };
  const fortegn = () => {
    if (s[i] === '−') {
      i++;
      return -fortegn();
    }
    return grunn();
  };
  const produkt = () => {
    let v = fortegn();
    while (s[i] === '×' || s[i] === ':') v = s[i++] === '×' ? v * fortegn() : v / fortegn();
    return v;
  };
  const sum = () => {
    let v = produkt();
    while (s[i] === '+' || s[i] === '−') v = s[i++] === '+' ? v + produkt() : v - produkt();
    return v;
  };
  const v = sum();
  if (i !== s.length) throw new Error(`uventet tegn «${s[i]}»`);
  return v;
}

const lik = (a, b) => Math.abs(a - b) < 1e-9;

/** Gir fasit regnet ut fra oppgaveteksten, eller null når teksten ikke er et regnestykke vi kjenner. */
function utregnet(tekst) {
  let m;
  if ((m = /^Hva er (.+)\?$/.exec(tekst)) && REGNETEGN.test(m[1]) && /[+−×:√⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(m[1])) return regn(m[1]);
  if ((m = /^Hva er (\d+) % av (\d+)\?$/.exec(tekst))) return (Number(m[1]) * Number(m[2])) / 100;
  if ((m = /^Hva er det dobbelte av (\d+)\?$/.exec(tekst))) return 2 * Number(m[1]);
  if ((m = /^Hva er halvparten av (\d+)\?$/.exec(tekst))) return Number(m[1]) / 2;
  if ((m = /^(\d+) \+ \? = (\d+)$/.exec(tekst))) return Number(m[2]) - Number(m[1]);
  if ((m = /^Rund av (\d+) til nærmeste (tier|hundrer)$/.exec(tekst))) {
    const steg = m[2] === 'tier' ? 10 : 100;
    return Math.round(Number(m[1]) / steg) * steg;
  }
  if ((m = /^Rund av (\d+,\d+) til nærmeste hele tall$/.exec(tekst))) return Math.round(lesTall(m[1]));
  return null;
}

/** Sjekker «Løs: 3x + 2 = 14» ved å sette inn svaret. Gir null når teksten ikke er en likning. */
function likningStemmer(tekst, svar) {
  const m = /^Løs: (.+) = (.+)$/.exec(tekst);
  const x = /^x = (.+)$/.exec(svar);
  if (!m || !x) return null;
  const verdi = lesTall(x[1]);
  const sett = (side) => regn(side.replace(/(\d)x/g, '$1×x').replace(/x/g, verdi < 0 ? `(−${-verdi})` : String(verdi)));
  return lik(sett(m[1]), sett(m[2]));
}

// ---------- Sjekk av ett sett ----------

function sjekkSett(sett, sti, språk, fagmappe) {
  const her = (melding) => feil.push(`${sti}: ${melding}`);
  for (const felt of ['id', 'fag', 'trinn', 'tittel', 'beskrivelse']) {
    if (typeof sett[felt] !== 'string' || !sett[felt]) her(`mangler «${felt}»`);
  }
  if (sett.versjon !== 1) her('versjon skal være 1');
  if (sett.sprak !== språk) her(`sprak skal være «${språk}»`);
  if (sett.fag !== fagmappe) her(`fag «${sett.fag}» stemmer ikke med mappa «${fagmappe}»`);
  if (!FAG.some((f) => f.id === sett.fag)) her(`ukjent fag «${sett.fag}»`);
  if (!TRINN.some((t) => t.id === sett.trinn)) her(`ukjent trinn «${sett.trinn}»`);
  if (!sti.endsWith(`${sett.id}.json`)) her('filnavnet skal være sett-id-en');
  if (!Array.isArray(sett.lk20) || sett.lk20.some((l) => typeof l !== 'string')) her('lk20 skal være en liste med tekster');
  if (!Array.isArray(sett.oppgaver) || sett.oppgaver.length < MIN_OPPGAVER) {
    her(`skal ha minst ${MIN_OPPGAVER} oppgaver`);
    return;
  }

  const idér = new Set();
  const par = new Set();
  for (const o of sett.oppgaver) {
    const ved = (melding) => her(`oppgave ${o.id} («${o.tekst}»): ${melding}`);
    if (typeof o.id !== 'string' || !o.id) ved('mangler id');
    if (idér.has(o.id)) ved('id-en er brukt to ganger');
    idér.add(o.id);
    if (typeof o.tekst !== 'string' || !o.tekst.trim()) ved('mangler tekst');
    else if (o.tekst.length > MAKS_TEKST) ved(`teksten er ${o.tekst.length} tegn, grensen er ${MAKS_TEKST}`);
    if (typeof o.nokkel !== 'string' || !o.nokkel) ved('mangler nokkel');
    if (typeof o.riktig !== 'string' || !o.riktig) ved('mangler riktig svar');
    if (!Array.isArray(o.gale) || o.gale.length < 1 || o.gale.length > 3) {
      ved('skal ha 1 til 3 gale svar');
      continue;
    }
    if (o.gale.length < 3) merknader.push(`${sti}: oppgave ${o.id} har bare ${o.gale.length} gale svar`);
    const svar = [o.riktig, ...o.gale];
    for (const s of svar) {
      if (typeof s !== 'string' || !s.trim()) ved('tomt svar');
      else if (s !== s.trim() || o.tekst !== o.tekst.trim()) ved('mellomrom først eller sist');
      else if (s.length > MAKS_SVAR) ved(`svaret «${s}» er ${s.length} tegn, grensen er ${MAKS_SVAR}`);
    }
    if (new Set(svar.map((s) => s.toLowerCase())).size !== svar.length) ved('to like svar');
    const nøkkel = `${o.tekst}|${o.riktig}`;
    if (par.has(nøkkel)) ved('samme oppgave står to ganger');
    par.add(nøkkel);

    // Regn ut fasit på nytt der oppgaven er et regnestykke.
    try {
      const fasit = utregnet(o.tekst);
      if (fasit !== null) {
        if (!lik(lesTall(o.riktig), fasit)) ved(`fasit er «${o.riktig}», men utregningen gir ${fasit}`);
        for (const g of o.gale) if (lik(lesTall(g), fasit)) ved(`det gale svaret «${g}» er også riktig`);
        regnet++;
      }
      const likning = likningStemmer(o.tekst, o.riktig);
      if (likning !== null) {
        if (!likning) ved(`«${o.riktig}» løser ikke likningen`);
        for (const g of o.gale) if (likningStemmer(o.tekst, g)) ved(`det gale svaret «${g}» løser også likningen`);
        regnet++;
      }
    } catch (e) {
      ved(`klarte ikke å regne ut: ${e.message}`);
    }
  }

  // Samme spørsmål med ulike fasitsvar: et riktig svar fra én oppgave må ikke stå som galt i en annen.
  const riktigePerTekst = new Map();
  for (const o of sett.oppgaver) {
    if (!riktigePerTekst.has(o.tekst)) riktigePerTekst.set(o.tekst, new Set());
    riktigePerTekst.get(o.tekst).add(o.riktig);
  }
  for (const o of sett.oppgaver) {
    for (const g of o.gale ?? []) {
      if (riktigePerTekst.get(o.tekst).has(g)) her(`oppgave ${o.id} («${o.tekst}»): «${g}» er fasit i en annen oppgave med samme spørsmål`);
    }
  }
}

// ---------- Kjør ----------

let regnet = 0;
let antallSett = 0;
let antallOppgaver = 0;

for (const språk of readdirSync(ROT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const alleIdér = new Set();
  const oppføringer = [];
  for (const fag of readdirSync(join(ROT, språk), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    for (const fil of readdirSync(join(ROT, språk, fag)).filter((f) => f.endsWith('.json')).sort()) {
      const sti = `${språk}/${fag}/${fil}`;
      let sett;
      try {
        sett = JSON.parse(readFileSync(join(ROT, sti), 'utf8'));
      } catch (e) {
        feil.push(`${sti}: ugyldig JSON (${e.message})`);
        continue;
      }
      sjekkSett(sett, sti, språk, fag);
      if (alleIdér.has(sett.id)) feil.push(`${sti}: sett-id-en «${sett.id}» er brukt to ganger`);
      alleIdér.add(sett.id);
      antallSett++;
      antallOppgaver += sett.oppgaver?.length ?? 0;
      oppføringer.push({
        id: sett.id,
        fag: sett.fag,
        trinn: sett.trinn,
        tittel: sett.tittel,
        beskrivelse: sett.beskrivelse,
        antall: sett.oppgaver?.length ?? 0,
        fil: `${fag}/${fil}`,
      });
    }
  }
  const plass = (liste, id) => liste.findIndex((x) => x.id === id);
  oppføringer.sort((a, b) => plass(TRINN, a.trinn) - plass(TRINN, b.trinn) || plass(FAG, a.fag) - plass(FAG, b.fag) || a.id.localeCompare(b.id, 'nb'));
  const indeks = JSON.stringify({ versjon: 1, sprak: språk, fag: FAG, trinn: TRINN, sett: oppføringer }, null, 2) + '\n';
  const indeksfil = join(ROT, språk, 'indeks.json');
  if (SKRIV) writeFileSync(indeksfil, indeks);
  else if (!existsSync(indeksfil) || readFileSync(indeksfil, 'utf8') !== indeks) {
    feil.push(`${språk}/indeks.json er ikke oppdatert. Kjør «npm run innhold:sjekk -- --skriv».`);
  }
}

for (const m of merknader) console.log(`Merknad: ${m}`);
console.log(`${antallSett} sett, ${antallOppgaver} oppgaver. ${regnet} regnestykker regnet ut på nytt.`);
if (feil.length) {
  for (const f of feil) console.error(`FEIL: ${f}`);
  console.error(`${feil.length} feil.`);
  process.exit(1);
}
console.log('Alt i orden.');
