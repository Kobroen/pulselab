// Learnlab Puls, demoutgave. Styrer skjermene og spilløkka. Hovedtråden tegner
// bare. All bildetolkning skjer i sporingsarbeideren.
import '@fontsource/jost/latin-400.css';
import '@fontsource/jost/latin-600.css';
import './stil.css';
import type { Spill } from './felles';
import { figurSvg } from './figur';
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
type Spilltype = 'rekk' | 'sveip';

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

$('logo').innerHTML = logoSvg();
$('pyntefigur').innerHTML = figurSvg('vink');

// ---------- Skjermbytte ----------

function vis(ny: Skjerm) {
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
    spilltype === 'rekk'
      ? new Rekk(signaler, lagRunde(tema, Number(params.get('antall')) || 10), lyd, kameraMed)
      : new Sveip(signaler, lagRunde(tema, 30), lyd, kameraMed, Number(params.get('varighet')) || 60);
  vis('spill');
  $('skjermleser').textContent = kameraMed
    ? 'Spillet er i gang. Styr med hendene foran kameraet.'
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

function visResultat() {
  if (!spill) return;
  const r = spill.resultat();
  spill = null;
  peker?.stopp();
  peker = null;
  const stjerner = $('stjerner');
  stjerner.innerHTML = [0, 1, 2].map((i) => STJERNE(i < r.stjerner)).join('');
  stjerner.setAttribute('aria-label', `${r.stjerner} av 3 stjerner`);
  const fliser = $('fliser');
  fliser.textContent = '';
  for (const f of r.fliser) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = f.verdi;
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
    vis(knapp.dataset.til as Skjerm);
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
lydknapp.addEventListener('click', () => {
  lyd.av = !lyd.av;
  lydknapp.setAttribute('aria-pressed', String(!lyd.av));
  lydknapp.textContent = lyd.av ? 'Lyd av' : 'Lyd på';
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
