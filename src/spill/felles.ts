// Det spillene har felles: landskap, kort, piller, håndmarkører og konfetti.
import { type Signaler, SCENE_B, SCENE_H } from './signaler';
import { FARGE, SKRIFT, SKYGGE_FORSKYVNING, avrundet, papirkort, sirkel } from './tegning';

export interface Resultat {
  stjerner: number;
  fliser: { verdi: string; tekst: string }[];
  øvMer: string[];
}

export interface Spill {
  ferdig: boolean;
  oppdater(dt: number): void;
  tegn(g: CanvasRenderingContext2D): void;
  resultat(): Resultat;
  /** Til røyktesten og måleskjermen. Kalles ikke i spilløkka. */
  tilstand(): Record<string, unknown>;
}

export const ROLIG = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Det spillene ber omgivelsene om. Risting og dunk kan skrus av av spilleren. */
export interface Effekter {
  risting: boolean;
  /** Scenen dunker 5 px ned og tilbake ved treff. */
  dunk(): void;
}

// Bevegelsene under følger designets spesifikasjon. Alle tar tid i sekunder siden hendelsen.
// Tempoet er satt litt lavt med vilje: saktere og tydeligere, men ikke kjedeligere.
// Med rolig bevegelse byttes sprett mot et mykt pust, risting mot et blunk og landing mot toning.

const pust = (t: number) => (t > 0 && t < 0.52 ? 1 + 0.07 * Math.sin((t / 0.52) * Math.PI) : 1);

/** Riktig svar: sprett 1 → 1,18 → 0,96 → 1 på 440 ms. */
export function sprett(t: number): number {
  if (ROLIG) return pust(t);
  const p = t / 0.44;
  if (p >= 1 || p <= 0) return 1;
  if (p < 0.35) return 1 + 0.18 * (p / 0.35);
  if (p < 0.65) return 1.18 - 0.22 * ((p - 0.35) / 0.3);
  return 0.96 + 0.04 * ((p - 0.65) / 0.35);
}

/** Feil svar: risting ±8 px som avtar over 420 ms. */
export function rist(t: number, på: boolean): number {
  if (!på || ROLIG || t >= 0.42) return 0;
  return Math.sin((t / 0.42) * Math.PI * 4.5) * -8 * (1 - t / 0.42);
}

/** Feil svar med rolig bevegelse: et blunk i gjennomsiktighet i stedet for risting. */
export function blunk(t: number): number {
  if (!ROLIG || t >= 0.52) return 1;
  return 1 - 0.55 * Math.sin((t / 0.52) * Math.PI);
}

/** Riktig svar pulserer to ganger (800 ms) etter at spilleren har svart feil. */
export function puls(t: number): number {
  if (ROLIG) return t < 0.52 ? pust(t) : pust(t - 0.52);
  if (t <= 0 || t >= 0.8) return 1;
  return 1 + 0.1 * Math.abs(Math.sin((t / 0.8) * Math.PI * 2));
}

/** Kombotallet spretter 1 → 1,3 → 1 på 260 ms. */
export function tallsprett(t: number): number {
  if (ROLIG) return pust(t);
  if (t >= 0.26) return 1;
  return 1 + 0.3 * Math.sin((t / 0.26) * Math.PI);
}

/** Element som lander: 0 → 1 på 300 ms med lite oversving. Med rolig bevegelse tones det inn på 360 ms. */
export function land(t: number): number {
  if (t <= 0) return 0;
  if (ROLIG) return Math.min(1, t / 0.36);
  if (t >= 0.3) return 1;
  const p = t / 0.3 - 1;
  return 1 + 2.2 * p * p * p + 1.2 * p * p;
}

/** Hvor langt under plassen sin et landende element står. Ingen forflytning med rolig bevegelse. */
export const landingsfall = (inn: number) => (ROLIG ? 0 : (1 - inn) * 16);

const ÅS = new Path2D('M0 505Q240 465 480 500T960 485V540H0Z');

export function tegnBakgrunn(g: CanvasRenderingContext2D) {
  g.fillStyle = FARGE.bakgrunn;
  g.fillRect(0, 0, SCENE_B, SCENE_H);
}

export function tegnÅs(g: CanvasRenderingContext2D) {
  g.fillStyle = FARGE.gronn;
  g.fill(ÅS);
}

export function tegnHender(g: CanvasRenderingContext2D, s: Signaler) {
  for (let i = 0; i < 2; i++) {
    const h = s.hender[i];
    if (!h.aktiv) continue;
    sirkel(g, h.x + 4, h.y + 4, 17, FARGE.skygge);
    sirkel(g, h.x, h.y, 17, FARGE.blekk);
    sirkel(g, h.x, h.y, 13, FARGE.hvit);
  }
}

/** Finner en skrift som får teksten til å passe innenfor en bredde. Kalles når teksten byttes, ikke per bilde. */
export function tilpassSkrift(g: CanvasRenderingContext2D, tekst: string, maks: number, start: number, vekt = 600): string {
  let størrelse = start;
  for (;;) {
    const skrift = `${vekt} ${størrelse}px ${SKRIFT}`;
    g.font = skrift;
    if (størrelse <= 12 || g.measureText(tekst).width <= maks) return skrift;
    størrelse -= 2;
  }
}

/** Spørsmålskortet øverst: et hvitt papirkort som ligger litt på skrå. */
export class Toppkort {
  private tekst = '';
  private skrift = '';
  private bredde = 500;

  sett(g: CanvasRenderingContext2D, tekst: string) {
    if (tekst === this.tekst) return;
    this.tekst = tekst;
    this.skrift = tilpassSkrift(g, tekst, 520, 26);
    g.font = this.skrift;
    this.bredde = Math.max(200, Math.min(600, g.measureText(tekst).width + 80));
  }

  tegn(g: CanvasRenderingContext2D) {
    g.save();
    g.translate(SCENE_B / 2, 60);
    g.rotate(-0.017);
    papirkort(g, -this.bredde / 2, -32, this.bredde, 64, 14, FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.font = this.skrift;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(this.tekst, 0, 2);
    g.restore();
  }
}

const SKRIFT_PILLE = `600 15px ${SKRIFT}`;

export function tegnPille(g: CanvasRenderingContext2D, x: number, y: number, b: number, tekst: string) {
  g.fillStyle = FARGE.hvit;
  avrundet(g, x, y, b, 34, 17);
  g.fill();
  g.strokeStyle = FARGE.blekk;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = FARGE.blekk;
  g.font = SKRIFT_PILLE;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tekst, x + b / 2, y + 18);
}

/** Gul papirlapp på skrå, til rekke og kombo. */
export function tegnLapp(g: CanvasRenderingContext2D, x: number, y: number, b: number, tekst: string, skala = 1) {
  g.save();
  g.translate(x + b / 2, y + 23);
  g.rotate(0.05);
  g.scale(skala, skala);
  papirkort(g, -b / 2, -23, b, 46, 23, FARGE.gul);
  g.fillStyle = FARGE.blekk;
  g.font = `600 18px ${SKRIFT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tekst, 0, 1);
  g.restore();
}

const SKRIFT_HINT = `600 17px ${SKRIFT}`;

export function tegnHint(g: CanvasRenderingContext2D, tekst: string) {
  g.font = SKRIFT_HINT;
  const b = g.measureText(tekst).width + 48;
  papirkort(g, SCENE_B / 2 - b / 2, 448, b, 40, 20, FARGE.gul);
  g.fillStyle = FARGE.blekk;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(tekst, SCENE_B / 2, 469);
}

/** Startsirkelen som lærer bort grepet før runden begynner. */
export function tegnStartboble(g: CanvasRenderingContext2D, x: number, y: number, r: number, holdt: number) {
  sirkel(g, x + SKYGGE_FORSKYVNING, y + SKYGGE_FORSKYVNING, r, FARGE.skygge);
  sirkel(g, x, y, r, FARGE.gronn);
  g.fillStyle = FARGE.blekk;
  g.font = `600 28px ${SKRIFT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Start', x, y + 2);
  tegnRing(g, x, y, r + 12, holdt);
}

export function tegnRing(g: CanvasRenderingContext2D, x: number, y: number, r: number, andel: number) {
  if (andel <= 0.01) return;
  g.strokeStyle = FARGE.blekk;
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, andel));
  g.stroke();
}

// ---------- Konfetti ----------

// Maks 24 biter om gangen, som i spesifikasjonen.
const BITER = 24;
const KONFETTIFARGER = [FARGE.blaa, FARGE.rosa, FARGE.gul, FARGE.oransje, FARGE.korall, FARGE.gronn];

export class Konfetti {
  private x = new Float32Array(BITER);
  private y = new Float32Array(BITER);
  private vx = new Float32Array(BITER);
  private vy = new Float32Array(BITER);
  private rot = new Float32Array(BITER);
  private vr = new Float32Array(BITER);
  private liv = new Float32Array(BITER);
  private neste = 0;

  kast(x: number, y: number, antall: number) {
    // Rolig bevegelse gir «dryss»: færre, runde biter som siger ut og toner bort.
    const n = ROLIG ? Math.min(Math.ceil(antall / 2), 12) : antall;
    for (let k = 0; k < n; k++) {
      const i = this.neste;
      this.neste = (this.neste + 1) % BITER;
      const a = Math.random() * Math.PI * 2;
      this.x[i] = x;
      this.y[i] = y;
      this.rot[i] = a;
      if (ROLIG) {
        // Farten bremses jevnt, slik at biten stanser 70 til 115 px ute.
        const fart = (70 + Math.random() * 45) * 3;
        this.vx[i] = Math.cos(a) * fart;
        this.vy[i] = Math.sin(a) * fart;
        this.vr[i] = 0;
        this.liv[i] = 1.5;
      } else {
        // Samme tall som konfettien i menyene: biten siger 60 til 150 px ut, snurrer høyst
        // 150 grader og faller rolig. Den lever 1,7 til 2,2 sekunder.
        const fart = (60 + Math.random() * 90) * 2.5;
        this.vx[i] = Math.cos(a) * fart;
        this.vy[i] = Math.sin(a) * fart - 100;
        this.liv[i] = 1.7 + Math.random() * 0.5;
        this.vr[i] = ((Math.random() - 0.5) * 5.2) / this.liv[i];
      }
    }
  }

  oppdater(dt: number) {
    const brems = Math.exp(-(ROLIG ? 3 : 2.5) * dt);
    for (let i = 0; i < BITER; i++) {
      if (this.liv[i] <= 0) continue;
      this.liv[i] -= dt;
      this.vx[i] *= brems;
      this.vy[i] *= brems;
      if (!ROLIG) this.vy[i] += 150 * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vr[i] * dt;
    }
  }

  tegn(g: CanvasRenderingContext2D) {
    for (let i = 0; i < BITER; i++) {
      if (this.liv[i] <= 0) continue;
      const x = this.x[i];
      const y = this.y[i];
      g.fillStyle = KONFETTIFARGER[i % 6];
      if (ROLIG) {
        g.globalAlpha = Math.min(1, this.liv[i] / 1.2);
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      g.globalAlpha = Math.min(1, this.liv[i] / 0.7);
      // Et lite rektangel, rotert for hånd for å slippe save/restore per bit.
      const c = Math.cos(this.rot[i]);
      const s = Math.sin(this.rot[i]);
      g.beginPath();
      g.moveTo(x - 6 * c + 4 * s, y - 6 * s - 4 * c);
      g.lineTo(x + 6 * c + 4 * s, y + 6 * s - 4 * c);
      g.lineTo(x + 6 * c - 4 * s, y + 6 * s + 4 * c);
      g.lineTo(x - 6 * c - 4 * s, y - 6 * s + 4 * c);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

/** Avstand fra et punkt til linjestykket a–b. Brukes for å fange raske håndbevegelser mellom to bilder. */
export function avstandTilLinje(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
