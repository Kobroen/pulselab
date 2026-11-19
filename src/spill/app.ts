// Learnlab Puls, demoutgave. Styrer skjermene og spilløkka. Hovedtråden tegner
// bare. All bildetolkning skjer i sporingsarbeideren.
import './stil.css';
import { konfetti, spillAv, tellOpp } from './effekter';
import { lagLenke, lesLenke, tolk } from './egne';
import type { Effekter, Spill } from './felles';
import { figurSvg } from './figur';
import { Intervall } from './intervall';
import { Kamerakilde } from './kamerakilde';
import { Klasseokt } from './klasse';
import { logoSvg } from './logo';
import { Lyd } from './lyd';
import { type BankOppgave, INDEKS, type Trinn, hentSett, trekk } from './bank';
import { OKTER, type Okt, TEMPO, antallSporsmal, egenokt, laereokt } from './okter';
import { type Tema, lagRunde } from './oppgaver';
import { Pekerkilde } from './pekerkilde';
import { Rekk } from './rekk';
import { type Signaler, SCENE_B, SCENE_H, nyeSignaler } from './signaler';
import { Sveip } from './sveip';
import { FARGE, SKRIFT, tegnFigur } from './tegning';

type Skjerm = 'start' | 'klasse' | 'pugg' | 'velg' | 'klar' | 'spill' | 'resultat';
type Spilltype = 'rekk' | 'sveip' | 'intervall' | 'klasse';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);

const scene = $<HTMLCanvasElement>('scene');
const g = scene.getContext('2d', { alpha: false })!;
const speil = $<HTMLCanvasElement>('speil');
const gSpeil = speil.getContext('2d')!;
const hint = $('hint');
const erKlar = $<HTMLButtonElement>('er-klar');
const kameraPå = $<HTMLButtonElement>('kamera-paa');
const målEl = $('maal');

const lyd = new Lyd();
let skjerm: Skjerm = 'start';
let spilltype: Spilltype = 'rekk';
let okt: Okt = OKTER[0];
let medKamera = false;
let signaler: Signaler = nyeSignaler();
let kamera: Kamerakilde | null = null;
let peker: Pekerkilde | null = null;
let spill: Spill | null = null;
let skala = 1;

// Risting og dunk kan skrus av. Valget huskes på enheten.
const lagret = (navn: string) => {
  try {
    return localStorage.getItem(navn);
  } catch {
    return null;
  }
};
const lagre = (navn: string, verdi: string) => {
  try {
    localStorage.setItem(navn, verdi);
  } catch {
    // Lagring er ikke tilgjengelig. Valget gjelder da bare denne økta.
  }
};
const effekter: Effekter = {
  risting: lagret('puls-risting') !== 'av',
  dunk() {
    if (this.risting) spillAv(scene, 'dunk');
  },
};
lyd.av = lagret('puls-lyd') === 'av';

$('logo').innerHTML = logoSvg();
$('pyntefigur').innerHTML = figurSvg('vink');

// ---------- Skjermbytte ----------

const REKKEFØLGE: Skjerm[] = ['start', 'klasse', 'pugg', 'velg', 'klar', 'spill', 'resultat'];
let førsteVisning = true;

function vis(ny: Skjerm) {
  const tilbake = REKKEFØLGE.indexOf(ny) < REKKEFØLGE.indexOf(skjerm);
  if (!førsteVisning) lyd.overgang();
  if (ny !== 'spill') spillAv($(ny), !førsteVisning && tilbake ? 'ark-inn-tilbake' : 'ark-inn');
  førsteVisning = false;
  skjerm = ny;
  for (const id of REKKEFØLGE) $(id).hidden = id !== ny;
  document.body.dataset.skjerm = ny;
  document.body.dataset.modus = spilltype;
  $('pyntefigur').innerHTML = figurSvg(ny === 'resultat' ? 'hopp' : 'vink');
  if (ny === 'spill') tilpassScene();
  window.scrollTo(0, 0);
  ($(ny).querySelector('h1, canvas') as HTMLElement | null)?.focus?.();
}

function slåAvKamera() {
  kamera?.stopp();
  kamera = null;
}

function tilStart() {
  spill = null;
  peker?.stopp();
  peker = null;
  slåAvKamera();
  vis('start');
}

// ---------- Kamera og kalibrering ----------

const sjekk = { kamera: $('sjekk-kamera'), sporing: $('sjekk-sporing'), ramme: $('sjekk-ramme') };
let forrigeHint = '';

function settHint(tekst: string) {
  if (tekst === forrigeHint) return;
  forrigeHint = tekst;
  hint.textContent = tekst;
  spillAv(hint, 'lapp-inn');
}

function åpneKlar() {
  slåAvKamera();
  forrigeHint = '';
  settHint('Kameraet er av');
  for (const el of Object.values(sjekk)) el.classList.remove('ok');
  kameraPå.hidden = false;
  kameraPå.disabled = false;
  erKlar.disabled = true;
  gSpeil.clearRect(0, 0, speil.width, speil.height);
  vis('klar');
}

async function startKamera() {
  lyd.vekk();
  kameraPå.disabled = true;
  settHint('Starter kameraet …');
  signaler = nyeSignaler();
  const k = new Kamerakilde(signaler);
  k.ramme = { x: 0, y: 0, b: speil.width, h: speil.height };
  kamera = k;
  try {
    await k.start();
    if (kamera === k) erKlar.disabled = false;
  } catch (e) {
    if (kamera !== k) return;
    slåAvKamera();
    kameraPå.hidden = false;
    kameraPå.disabled = false;
    const navn = e instanceof DOMException ? e.name : '';
    settHint(
      navn === 'NotAllowedError'
        ? 'Kameraet er blokkert. Du kan spille uten.'
        : navn === 'NotFoundError'
          ? 'Fant ikke noe kamera. Du kan spille uten.'
          : 'Sporingen startet ikke. Du kan spille uten.',
    );
  }
}

function oppdaterKlar() {
  const k = kamera;
  if (!k) return;
  sjekk.kamera.classList.toggle('ok', k.kameraPå);
  sjekk.sporing.classList.toggle('ok', k.modellKlar);
  sjekk.ramme.classList.toggle('ok', k.avstand === 'bra');
  if (k.kameraPå) kameraPå.hidden = true;
  if (k.status === 'feil') return;
  settHint(
    !k.kameraPå
      ? 'Starter kameraet …'
      : !k.modellKlar
        ? 'Laster sporingen …'
        : k.avstand === 'bra'
          ? 'Perfekt! Der står du fint'
          : k.avstand === 'for nær'
            ? 'Nesten! Litt bakover'
            : k.avstand === 'for langt unna'
              ? 'Kom litt nærmere'
              : 'Vi ser deg ikke ennå',
  );
  gSpeil.clearRect(0, 0, speil.width, speil.height);
  tegnFigur(gSpeil, signaler.kropp);
}

// ---------- Spill ----------

function tilpassScene() {
  const bar = 52;
  const b = Math.max(240, Math.min(window.innerWidth - 12, ((window.innerHeight - bar - 12) * SCENE_B) / SCENE_H));
  const h = (b * SCENE_H) / SCENE_B;
  scene.style.width = `${b}px`;
  scene.style.height = `${h}px`;
  // Tegneflaten holdes moderat også på skarpe skjermer, av hensyn til svake maskiner.
  const tetthet = Math.min(window.devicePixelRatio || 1, 2, 1600 / b);
  scene.width = Math.round(b * tetthet);
  scene.height = Math.round(h * tetthet);
  skala = scene.width / SCENE_B;
}
window.addEventListener('resize', () => skjerm === 'spill' && tilpassScene());

function startSpill(kameraMed: boolean) {
  lyd.vekk();
  medKamera = kameraMed;
  if (kameraMed && kamera) {
    kamera.ramme = null;
  } else {
    slåAvKamera();
    signaler = nyeSignaler();
  }
  peker?.stopp();
  peker = new Pekerkilde(scene, signaler, !kameraMed);
  // Temaet er enten et sett fra oppgavebanken eller en av de to regelbaserte rundene.
  const tema = ((document.querySelector('input[name="tema"]:checked') as HTMLInputElement | null)?.value ?? 'gange') as Tema;
  const kilde = egne ?? bankoppgaver;
  const runde = (antall: number) => (kilde ? trekk(kilde, antall) : lagRunde(tema, antall));
  spill =
    spilltype === 'intervall'
      ? new Intervall(signaler, lyd, kameraMed, effekter, Number(params.get('intervall')) || 15)
      : spilltype === 'rekk'
      ? new Rekk(signaler, runde(Number(params.get('antall')) || 10), lyd, kameraMed, effekter)
      : new Sveip(signaler, runde(30), lyd, kameraMed, effekter, Number(params.get('varighet')) || 60);
  vis('spill');
  $('skjermleser').textContent = kameraMed
    ? 'Spillet er i gang. Styr med hendene foran kameraet.'
    : spilltype === 'intervall'
      ? 'Powerbreak er i gang. Trykk, bruk mellomrom eller flytt pekeren for å gjøre øvelsene.'
      : 'Spillet er i gang. Pek, trykk eller bruk tastene 1 til 4 for å velge svar.';
}

// Tempo og antall svar kan læreren justere. Valgene huskes på enheten.
let tempo = lagret('puls-tempo') ?? 'vanlig';
let antallSvar = Math.min(4, Math.max(2, Number(lagret('puls-svar')) || 4));

/** Fellesmodus: ingen kamera og ingen kalibrering, rett til økta. */
let starter = 0;
async function startKlasse(valgt: Okt) {
  lyd.vekk();
  const denne = ++starter;
  let oppgaver: ReturnType<typeof trekk> = [];
  if (valgt.oppgaver) oppgaver = trekk(valgt.oppgaver, antallSporsmal(valgt));
  else if (valgt.sett) {
    try {
      oppgaver = trekk(await hentSett(valgt.sett), antallSporsmal(valgt));
    } catch {
      // Uten nett kan settet mangle. Da går økta med bare øvelsene.
    }
    if (denne !== starter) return;
  }
  okt = valgt;
  spilltype = 'klasse';
  medKamera = false;
  slåAvKamera();
  signaler = nyeSignaler();
  peker?.stopp();
  peker = new Pekerkilde(scene, signaler, false);
  const t = TEMPO[tempo] ?? TEMPO.vanlig;
  const inn = { les: t.les, svar: t.svar, fasit: t.fasit, antallSvar };
  // Knappen som startet økta skal ikke sitte igjen med fokus, ellers går mellomrom til den.
  (document.activeElement as HTMLElement | null)?.blur?.();
  spill = new Klasseokt(signaler, okt, oppgaver, lyd, effekter, inn, Number(params.get('fart')) || 1);
  vis('spill');
  $('skjermleser').textContent = `${okt.navn} for klassen. Trykk mellomrom for å starte og for å pause. Pil høyre hopper til neste steg.`;
}

// Klassemålet: hvert minutt i bevegelse gir 10 meter mot Galdhøpiggen. Summen ligger bare på denne enheten.
const TOPP = 2469;
const DELMÅL = 1841;
function visKlassemål(aktivSek: number | undefined) {
  const boks = $('klassemaal');
  boks.hidden = aktivSek === undefined;
  if (aktivSek === undefined) return;
  const før = Number(lagret('puls-klassemeter')) || 0;
  const nye = Math.round(aktivSek / 6);
  const nå = før + nye;
  lagre('puls-klassemeter', String(nå));
  // Når toppen er nådd, starter en ny tur.
  const tur = nå % TOPP;
  const fyll = $('fjellfyll');
  fyll.style.transform = `scaleX(${Math.min(1, (før % TOPP) / TOPP)})`;
  requestAnimationFrame(() => requestAnimationFrame(() => (fyll.style.transform = `scaleX(${tur / TOPP})`)));
  $('fjelltekst').textContent =
    Math.floor(nå / TOPP) > Math.floor(før / TOPP)
      ? `Dere nådde toppen, ${TOPP.toLocaleString('nb')} meter! Neste tur er i gang.`
      : `+${nye} meter i denne økta. Klassen er på ${tur.toLocaleString('nb')} av ${TOPP.toLocaleString('nb')} meter` +
        (tur < DELMÅL ? `, og det er ${(DELMÅL - tur).toLocaleString('nb')} meter til Juvasshytta.` : ', forbi Juvasshytta.');
}

const STJERNE = (fylt: boolean) =>
  `<svg viewBox="-22 -22 44 44" aria-hidden="true"><polygon fill="${fylt ? FARGE.gul : FARGE.linje}" points="${Array.from(
    { length: 10 },
    (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 9.5 : 21;
      return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
    },
  ).join(' ')}"/></svg>`;

let resultatrunde = 0;

function visResultat() {
  if (!spill) return;
  const r = spill.resultat();
  spill = null;
  peker?.stopp();
  peker = null;
  const stjerner = $('stjerner');
  stjerner.innerHTML = [0, 1, 2].map((i) => STJERNE(i < r.stjerner)).join('');
  stjerner.setAttribute('aria-label', `${r.stjerner} av 3 stjerner`);
  // Stjernene lander én etter én med hver sin tone. Til slutt kommer fanfare og konfetti.
  const runde = ++resultatrunde;
  [...stjerner.children].forEach((el, i) =>
    setTimeout(() => {
      if (runde !== resultatrunde || skjerm !== 'resultat') return;
      el.classList.add('stjerne-inn');
      if (i < r.stjerner) lyd.stjerne(i);
    }, 400 + i * 260),
  );
  setTimeout(() => {
    if (runde !== resultatrunde || skjerm !== 'resultat') return;
    lyd.fanfare();
    const flate = stjerner.getBoundingClientRect();
    konfetti(flate.left + flate.width / 2, flate.top + flate.height / 2, 24);
  }, 1300);
  const fliser = $('fliser');
  fliser.textContent = '';
  for (const f of r.fliser) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    // Rene tall telles opp. Resten, som «9 av 10» og tid, vises med en gang.
    const tall = /^(×?)(\d+)$/.exec(f.verdi);
    if (tall) tellOpp(b, Number(tall[2]), tall[1]);
    else b.textContent = f.verdi;
    li.append(b, f.tekst);
    fliser.appendChild(li);
  }
  $('ovmer').hidden = r.øvMer.length === 0;
  const liste = $('ovliste');
  liste.textContent = '';
  for (const t of r.øvMer) {
    const li = document.createElement('li');
    li.textContent = t;
    liste.appendChild(li);
  }
  $('bytt').hidden = spilltype === 'intervall';
  const klasse = spilltype === 'klasse';
  $('bytt').textContent = klasse ? 'Kjør en til' : 'Bytt spill';
  $('igjen').textContent = klasse ? 'Samme økt igjen' : 'Spill igjen';
  $('resultattittel').textContent = klasse ? 'Økta er ferdig. Bra jobba!' : 'Bra jobba!';
  visKlassemål(klasse ? r.aktivSek : undefined);
  vis('resultat');
  $('igjen').focus();
}

// ---------- Spilløkka ----------

let forrige = performance.now();
let bilder = 0;
let sporingerSist = 0;
let målTid = 0;
let visMål = params.has('maal');
målEl.hidden = !visMål;

function løkke(nå: number) {
  const dt = Math.min(0.1, (nå - forrige) / 1000);
  forrige = nå;
  bilder++;
  if (skjerm === 'klar') {
    kamera?.oppdater(dt);
    oppdaterKlar();
  } else if (skjerm === 'spill' && spill) {
    kamera?.oppdater(dt);
    peker?.oppdater(dt);
    spill.oppdater(dt);
    g.setTransform(skala, 0, 0, skala, 0, 0);
    spill.tegn(g);
    if (spill.ferdig) visResultat();
  }
  if (visMål && nå - målTid >= 1000) {
    const sek = (nå - målTid) / 1000;
    const spor = kamera ? kamera.sporinger - sporingerSist : 0;
    sporingerSist = kamera ? kamera.sporinger : 0;
    målEl.textContent =
      `${(bilder / sek).toFixed(0)} bilder/s` +
      (kamera
        ? `\n${(spor / sek).toFixed(1)} sporinger/s\ntolkning ${kamera.tolkMs.toFixed(0)} ms\nforsinkelse ${kamera.forsinkelseMs.toFixed(0)} ms`
        : '\nuten kamera');
    bilder = 0;
    målTid = nå;
  }
  requestAnimationFrame(løkke);
}

// ---------- Knapper ----------

$('start-laere').addEventListener('click', () => {
  egne = null;
  vis('velg');
});
$('start-klasse').addEventListener('click', () => vis('klasse'));
// Øktene tegnes fra data: Powerbreak fra lista, og læreøktene fra oppgavebanken for valgt trinn og fag.
function oktkort(o: Okt): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'kort oktkort';
  const merke = document.createElement('span');
  merke.className = `merke ${o.farge}`;
  merke.textContent = o.merke;
  const tittel = document.createElement('h2');
  tittel.textContent = o.navn;
  const tid = document.createElement('p');
  tid.className = 'okttid';
  tid.textContent = `${o.minutter} minutter`;
  const tekst = document.createElement('p');
  tekst.textContent = o.tekst;
  const knapp = document.createElement('button');
  knapp.className = 'pille mork';
  knapp.type = 'button';
  knapp.dataset.okt = o.id;
  knapp.textContent = 'Start';
  knapp.addEventListener('click', () => startKlasse(o));
  li.append(merke, tittel, tid, tekst, knapp);
  return li;
}
for (const o of OKTER) $('okter').appendChild(oktkort(o));

function valgknapp(gruppe: string, verdi: string, navn: string, valgt: boolean, ved: () => void): HTMLLabelElement {
  const label = document.createElement('label');
  const inn = document.createElement('input');
  inn.type = 'radio';
  inn.name = gruppe;
  inn.value = verdi;
  inn.checked = valgt;
  inn.addEventListener('change', ved);
  const span = document.createElement('span');
  span.textContent = navn;
  label.append(inn, span);
  return label;
}

// Trinnet huskes på enheten, så læreren slipper å velge det hver gang.
let trinn = (INDEKS.trinn.find((t) => t.id === lagret('puls-trinn'))?.id ?? '5-7') as Trinn;
let fag = '';
function visSett() {
  const iTrinn = INDEKS.sett.filter((s) => s.trinn === trinn);
  if (fag && !iTrinn.some((s) => s.fag === fag)) fag = '';
  const fagvalg = $('fagvalg');
  fagvalg.querySelectorAll('label').forEach((el) => el.remove());
  fagvalg.appendChild(valgknapp('fag', '', 'Alle fag', fag === '', () => ((fag = ''), visSett())));
  for (const f of INDEKS.fag) {
    if (iTrinn.some((s) => s.fag === f.id)) fagvalg.appendChild(valgknapp('fag', f.id, f.navn, fag === f.id, () => ((fag = f.id), visSett())));
  }
  $('laeretittel').textContent = `Læreøkter for ${INDEKS.trinn.find((t) => t.id === trinn)?.navn ?? ''}`;
  const liste = $('settliste');
  liste.textContent = '';
  for (const s of iTrinn) {
    if (fag && s.fag !== fag) continue;
    liste.appendChild(oktkort(laereokt(s, INDEKS.fag.find((f) => f.id === s.fag)?.navn ?? '')));
  }
}
for (const t of INDEKS.trinn) {
  $('trinnvalg').appendChild(
    valgknapp('trinn', t.id, t.navn, t.id === trinn, () => {
      trinn = t.id;
      lagre('puls-trinn', trinn);
      visSett();
    }),
  );
}
visSett();
for (const [id, t] of Object.entries(TEMPO)) {
  $('tempovalg').appendChild(
    valgknapp('tempo', id, t.navn, id === tempo, () => {
      tempo = id;
      lagre('puls-tempo', id);
    }),
  );
}
for (const n of [2, 3, 4]) {
  $('svarvalg').appendChild(
    valgknapp('antallsvar', String(n), String(n), n === antallSvar, () => {
      antallSvar = n;
      lagre('puls-svar', String(n));
    }),
  );
}

// Læremodus: flere temaer fra oppgavebanken. Settet hentes når det velges, så spillet kan starte med en gang.
let bankoppgaver: BankOppgave[] | null = null;
const banktrinn = $<HTMLSelectElement>('banktrinn');
const banksett = $<HTMLSelectElement>('banksett');
function fyllBanksett() {
  banksett.textContent = '';
  banksett.appendChild(new Option('Velg tema …', ''));
  for (const f of INDEKS.fag) {
    const sett = INDEKS.sett.filter((s) => s.trinn === banktrinn.value && s.fag === f.id);
    if (!sett.length) continue;
    const gruppe = document.createElement('optgroup');
    gruppe.label = f.navn;
    for (const s of sett) gruppe.appendChild(new Option(s.tittel, s.id));
    banksett.appendChild(gruppe);
  }
  velgBanksett();
}
async function velgBanksett() {
  const oppforing = INDEKS.sett.find((s) => s.id === banksett.value);
  banksett.classList.toggle('valgt', !!oppforing);
  bankoppgaver = null;
  for (const inn of document.querySelectorAll<HTMLInputElement>('input[name="tema"]')) {
    if (oppforing) inn.checked = false;
    else if (inn.value === 'gange' && !document.querySelector('input[name="tema"]:checked')) inn.checked = true;
  }
  if (!oppforing) return;
  try {
    const oppgaver = await hentSett(oppforing);
    if (banksett.value === oppforing.id) bankoppgaver = oppgaver;
  } catch {
    // Settet kunne ikke hentes. Da gjelder den regelbaserte runden.
    banksett.value = '';
    velgBanksett();
  }
}
for (const t of INDEKS.trinn) banktrinn.appendChild(new Option(t.navn, t.id, false, t.id === trinn));
banktrinn.addEventListener('change', () => {
  lagre('puls-trinn', banktrinn.value);
  fyllBanksett();
});
banksett.addEventListener('change', velgBanksett);
for (const inn of document.querySelectorAll<HTMLInputElement>('input[name="tema"]')) {
  inn.addEventListener('change', () => {
    banksett.value = '';
    banksett.classList.remove('valgt');
    bankoppgaver = null;
  });
}
fyllBanksett();
// Pugg og prøv: lærerens egne spørsmål. Teksten lagres på enheten og kan deles som lenke.
let egne: BankOppgave[] | null = null;
const egnetekst = $<HTMLTextAreaElement>('egnetekst');
const egneknapper = ['egne-klasse', 'egne-rekk', 'egne-sveip', 'egne-lenke'].map((id) => $<HTMLButtonElement>(id));
function lesEgne() {
  const antall = tolk(egnetekst.value).length;
  $('egnestatus').textContent = antall >= 2 ? `${antall} spørsmål er klare` : 'Skriv minst to spørsmål';
  for (const k of egneknapper) k.disabled = antall < 2;
}
egnetekst.value = lesLenke() ?? lagret('puls-egne') ?? '';
egnetekst.addEventListener('input', () => {
  lagre('puls-egne', egnetekst.value);
  lesEgne();
});
lesEgne();
$('start-pugg').addEventListener('click', () => vis('pugg'));
$('egne-klasse').addEventListener('click', () => startKlasse(egenokt(tolk(egnetekst.value))));
for (const type of ['rekk', 'sveip'] as const) {
  $(`egne-${type}`).addEventListener('click', () => {
    egne = tolk(egnetekst.value);
    spilltype = type;
    if (medKamera && kamera?.status === 'klar') startSpill(true);
    else åpneKlar();
  });
}
$('egne-lenke').addEventListener('click', async () => {
  const lenke = lagLenke(egnetekst.value);
  try {
    await navigator.clipboard.writeText(lenke);
    $('egnestatus').textContent = 'Lenka er kopiert';
  } catch {
    // Utklippstavla er ikke tilgjengelig. Da legges lenka i adressefeltet, så den kan kopieres derfra.
    history.replaceState(null, '', lenke);
    $('egnestatus').textContent = 'Lenka står i adressefeltet';
  }
});
$('start-power').addEventListener('click', () => {
  spilltype = 'intervall';
  åpneKlar();
});
for (const knapp of document.querySelectorAll<HTMLButtonElement>('[data-spill]')) {
  knapp.addEventListener('click', () => {
    spilltype = knapp.dataset.spill as Spilltype;
    // Står kameraet allerede på fra forrige runde, trengs ingen ny kalibrering.
    if (medKamera && kamera?.status === 'klar') startSpill(true);
    else åpneKlar();
  });
}
for (const knapp of document.querySelectorAll<HTMLButtonElement>('[data-til]')) {
  knapp.addEventListener('click', () => {
    slåAvKamera();
    // Powerbreak har ingen valgskjerm, så derfra går veien tilbake til forsiden.
    vis(spilltype === 'intervall' ? 'start' : knapp.dataset.til === 'velg' && egne ? 'pugg' : (knapp.dataset.til as Skjerm));
  });
}
kameraPå.addEventListener('click', startKamera);
erKlar.addEventListener('click', () => startSpill(true));
$('uten-kamera').addEventListener('click', () => startSpill(false));
$('avslutt').addEventListener('click', tilStart);
$('igjen').addEventListener('click', () => (spilltype === 'klasse' ? startKlasse(okt) : startSpill(medKamera && kamera !== null)));
$('bytt').addEventListener('click', () => {
  // Kameraet får stå på, slik at neste spill starter uten ny kalibrering.
  vis(spilltype === 'klasse' ? (okt.oppgaver ? 'pugg' : 'klasse') : egne ? 'pugg' : 'velg');
});
$('ferdig').addEventListener('click', tilStart);
const lydknapp = $('lydknapp');
const ristknapp = $('ristknapp');
function visBrytere() {
  lydknapp.setAttribute('aria-pressed', String(!lyd.av));
  lydknapp.textContent = lyd.av ? 'Lyd av' : 'Lyd på';
  ristknapp.setAttribute('aria-pressed', String(effekter.risting));
  ristknapp.textContent = effekter.risting ? 'Risting på' : 'Risting av';
}
visBrytere();
lydknapp.addEventListener('click', () => {
  lyd.av = !lyd.av;
  lagre('puls-lyd', lyd.av ? 'av' : 'på');
  lyd.bryter(!lyd.av);
  visBrytere();
});
ristknapp.addEventListener('click', () => {
  effekter.risting = !effekter.risting;
  lagre('puls-risting', effekter.risting ? 'på' : 'av');
  lyd.bryter(effekter.risting);
  visBrytere();
});
// Trykk gir lyd i samme øyeblikk som fingeren treffer, ikke når den slippes.
document.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest?.('button:not(:disabled), .tema label')) {
    lyd.vekk();
    lyd.trykk();
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && skjerm === 'spill') tilStart();
  if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
    visMål = !visMål;
    målEl.hidden = !visMål;
  }
});

// Til røyktesten: lar den lese tilstanden og mate inn en kropp uten ekte kamerabilde.
(window as unknown as { __puls: unknown }).__puls = {
  tilstand: () => ({
    skjerm,
    kamera: kamera && {
      status: kamera.status,
      kameraPå: kamera.kameraPå,
      modellKlar: kamera.modellKlar,
      sporinger: kamera.sporinger,
      avstand: kamera.avstand,
      feil: kamera.feilmelding,
    },
    hender: signaler.hender.map((h) => ({ ...h })),
    spill: spill?.tilstand() ?? null,
  }),
  matKropp: (punkter: number[]) => {
    if (!kamera) return;
    kamera.frys = true;
    kamera.mottaPunkter(new Float32Array(punkter));
  },
};

// Skriften må være lastet før den brukes på tegneflaten.
Promise.all([document.fonts.load(`600 20px ${SKRIFT}`), document.fonts.load(`400 20px ${SKRIFT}`)])
  .catch(() => {})
  .then(() => {
    vis(lesLenke() ? 'pugg' : 'start');
    requestAnimationFrame(løkke);
  });
