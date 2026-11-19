// Learnlab Puls, demoutgave. Styrer skjermene og spilløkka. Hovedtråden tegner
// bare. All bildetolkning skjer i sporingsarbeideren.
import './stil.css';
import { konfetti, spillAv, tellOpp } from './effekter';
import type { Effekter, Spill } from './felles';
import { figurSvg } from './figur';
import { Intervall } from './intervall';
import { Kamerakilde } from './kamerakilde';
import { logoSvg } from './logo';
import { Lyd } from './lyd';
import { type Tema, lagRunde } from './oppgaver';
import { Pekerkilde } from './pekerkilde';
import { Rekk } from './rekk';
import { type Signaler, SCENE_B, SCENE_H, nyeSignaler } from './signaler';
import { Sveip } from './sveip';
import { FARGE, SKRIFT, tegnFigur } from './tegning';

type Skjerm = 'start' | 'velg' | 'klar' | 'spill' | 'resultat';
type Spilltype = 'rekk' | 'sveip' | 'intervall';

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

const REKKEFØLGE: Skjerm[] = ['start', 'velg', 'klar', 'spill', 'resultat'];
let førsteVisning = true;

function vis(ny: Skjerm) {
  const tilbake = REKKEFØLGE.indexOf(ny) < REKKEFØLGE.indexOf(skjerm);
  if (!førsteVisning) lyd.overgang();
  if (ny !== 'spill') spillAv($(ny), !førsteVisning && tilbake ? 'ark-inn-tilbake' : 'ark-inn');
  førsteVisning = false;
  skjerm = ny;
  for (const id of ['start', 'velg', 'klar', 'spill', 'resultat']) $(id).hidden = id !== ny;
  document.body.dataset.skjerm = ny;
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
  const tema = (document.querySelector('input[name="tema"]:checked') as HTMLInputElement).value as Tema;
  spill =
    spilltype === 'intervall'
      ? new Intervall(signaler, lyd, kameraMed, effekter, Number(params.get('intervall')) || 15)
      : spilltype === 'rekk'
      ? new Rekk(signaler, lagRunde(tema, Number(params.get('antall')) || 10), lyd, kameraMed, effekter)
      : new Sveip(signaler, lagRunde(tema, 30), lyd, kameraMed, effekter, Number(params.get('varighet')) || 60);
  vis('spill');
  $('skjermleser').textContent = kameraMed
    ? 'Spillet er i gang. Styr med hendene foran kameraet.'
    : spilltype === 'intervall'
      ? 'Powerbreak er i gang. Trykk, bruk mellomrom eller flytt pekeren for å gjøre øvelsene.'
      : 'Spillet er i gang. Pek, trykk eller bruk tastene 1 til 4 for å velge svar.';
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

$('start-laere').addEventListener('click', () => vis('velg'));
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
    vis(spilltype === 'intervall' ? 'start' : (knapp.dataset.til as Skjerm));
  });
}
kameraPå.addEventListener('click', startKamera);
erKlar.addEventListener('click', () => startSpill(true));
$('uten-kamera').addEventListener('click', () => startSpill(false));
$('avslutt').addEventListener('click', tilStart);
$('igjen').addEventListener('click', () => startSpill(medKamera && kamera !== null));
$('bytt').addEventListener('click', () => {
  // Kameraet får stå på, slik at neste spill starter uten ny kalibrering.
  vis('velg');
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
    vis('start');
    requestAnimationFrame(løkke);
  });
