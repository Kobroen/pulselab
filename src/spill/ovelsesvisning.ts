// En liten rute der en papirfigur viser øvelsen i Powerbreak.
// Figuren er blå, så den ikke forveksles med spilleren, som er korallrød.
import { ROLIG } from './felles';
import { FARGE, avrundet, papirkort, sirkel } from './tegning';

export type Ovelsestype = 'hopp' | 'sprell' | 'boy' | 'boks' | 'lop' | 'strekk';

const B = 170;
const H = 180;
const BAKKE = 62;
const BEIN = 23;
const ARM = 19;
const KROPP = 38;
const SKULDER = 15;
const HOFTE = 8;
const TAU = Math.PI * 2;

// Stillingen fylles ut på nytt for hvert bilde, uten å lage nye objekter.
let luft = 0;
let senk = 0;
let fot = 12;
let løftV = 0;
let løftH = 0;
let vx = 0;
let vy = 0;
let hx = 0;
let hy = 0;

function stilling(type: Ovelsestype, t: number) {
  luft = 0;
  senk = 0;
  fot = 12;
  løftV = 0;
  løftH = 0;
  if (type === 'hopp') {
    const p = (t / 1.0) % 1;
    let bøy = 0;
    if (p < 0.25) bøy = Math.sin((p / 0.25) * Math.PI * 0.5);
    else if (p < 0.75) {
      const q = (p - 0.25) / 0.5;
      luft = Math.sin(q * Math.PI) * 26;
      bøy = q < 0.2 ? 1 - q / 0.2 : q > 0.85 ? (q - 0.85) / 0.15 : 0;
    } else bøy = 1 - (p - 0.75) / 0.25;
    senk = bøy * 11;
    const a = luft / 26;
    vx = -(5 + 9 * a);
    vy = 35 - 52 * a;
    hx = -vx;
    hy = vy;
  } else if (type === 'sprell') {
    const p = (t / 1.0) % 1;
    const a = 0.5 - 0.5 * Math.cos(p * TAU);
    const v = 1.3 - 2.55 * a;
    luft = 5 * Math.abs(Math.sin(p * TAU));
    fot = 8 + 15 * a;
    hx = Math.cos(v) * 36;
    hy = Math.sin(v) * 36;
    vx = -hx;
    vy = hy;
  } else if (type === 'boy') {
    const p = (t / 2.2) % 1;
    const a = 0.5 - 0.5 * Math.cos(p * TAU);
    senk = 25 * a;
    fot = 15;
    hx = 4 + 20 * a;
    hy = 35 - 33 * a;
    vx = -hx;
    vy = hy;
  } else if (type === 'lop') {
    // Løping på stedet: knærne løftes annenhver gang, og armene pendler imot.
    const p = (t / 0.8) % 1;
    const sving = Math.sin(p * TAU);
    løftV = Math.max(0, sving) * 22;
    løftH = Math.max(0, -sving) * 22;
    luft = 3 * Math.abs(sving);
    fot = 10;
    vx = -7;
    vy = 14 + 16 * sving;
    hx = 7;
    hy = 14 - 16 * sving;
  } else if (type === 'strekk') {
    // Strekk mot taket og lén rolig fra side til side.
    const sving = Math.sin(((t / 3.33) % 1) * TAU);
    vx = -5 + 13 * sving;
    vy = -35;
    hx = 5 + 13 * sving;
    hy = -35;
  } else {
    const p = (t / 0.8) % 1;
    const venstre = p < 0.5 ? Math.sin((p / 0.5) * Math.PI) : 0;
    const høyre = p >= 0.5 ? Math.sin(((p - 0.5) / 0.5) * Math.PI) : 0;
    vx = 3 - 25 * venstre;
    vy = -8 - 22 * venstre;
    hx = -3 + 25 * høyre;
    hy = -8 - 22 * høyre;
  }
}

/** To like lange bein fra a til b. Leddet bøyes mot siden `side`, og litt nedover når `ned` er satt. */
function lem(
  g: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number, lengde: number, side: number, ned: number,
) {
  g.moveTo(ax, ay);
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d > 0.01 && d < lengde * 2) {
    const ut = Math.sqrt(lengde * lengde - (d * d) / 4) / d;
    const px = -dy * ut;
    const py = dx * ut;
    const fortegn = px * side + py * ned >= 0 ? 1 : -1;
    g.lineTo((ax + bx) / 2 + px * fortegn, (ay + by) / 2 + py * fortegn);
  }
  g.lineTo(bx, by);
}

function lag(g: CanvasRenderingContext2D, farge: string, dx: number, dy: number) {
  const hofteY = BAKKE - 45 + senk - luft + dy;
  const skulderY = hofteY - KROPP;
  const fotY = BAKKE - luft + dy;
  g.strokeStyle = farge;
  g.fillStyle = farge;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(dx - SKULDER, skulderY);
  g.lineTo(dx + SKULDER, skulderY);
  g.lineTo(dx + HOFTE, hofteY);
  g.lineTo(dx - HOFTE, hofteY);
  g.closePath();
  g.fill();
  lem(g, dx - HOFTE, hofteY, dx - fot, fotY - løftV, BEIN, -1, 0);
  lem(g, dx + HOFTE, hofteY, dx + fot, fotY - løftH, BEIN, 1, 0);
  lem(g, dx - SKULDER, skulderY, dx - SKULDER + vx, skulderY + vy, ARM, -1, 0.5);
  lem(g, dx + SKULDER, skulderY, dx + SKULDER + hx, skulderY + hy, ARM, 1, 0.5);
  g.stroke();
  sirkel(g, dx, skulderY - 19, 11, farge);
}

/** Tegner ruta med figuren. `t` er tiden i sekunder og driver bevegelsen. */
export function tegnOvelse(g: CanvasRenderingContext2D, x: number, y: number, type: Ovelsestype, t: number) {
  // Med rolig bevegelse går figuren saktere. Den stopper ikke, for da forklarer den ingenting.
  stilling(type, ROLIG ? t * 0.6 : t);
  g.save();
  g.translate(x, y);
  g.rotate(0.03);
  papirkort(g, -B / 2, -H / 2, B, H, 14, FARGE.hvit);
  g.save();
  avrundet(g, -B / 2, -H / 2, B, H, 14);
  g.clip();
  g.fillStyle = FARGE.gronn;
  g.fillRect(-B / 2, BAKKE, B, H / 2 - BAKKE);
  // Skyggen på bakken krymper når figuren er i lufta.
  const k = 1 - luft / 60;
  g.fillStyle = FARGE.skygge;
  g.beginPath();
  g.ellipse(0, BAKKE + 5, (fot + 14) * k, 4 * k, 0, 0, TAU);
  g.fill();
  lag(g, FARGE.skygge, 4, 4);
  lag(g, FARGE.blaa, 0, 0);
  g.restore();
  g.restore();
}

/**
 * Tegner bare figuren, uten rute. (x, y) er punktet på bakken midt under figuren.
 * Brukes i fellesmodus, der figuren er stor.
 */
export function tegnOvelsesfigur(
  g: CanvasRenderingContext2D, x: number, y: number, type: Ovelsestype, t: number, skala: number, farge: string,
) {
  stilling(type, ROLIG ? t * 0.6 : t);
  g.save();
  g.translate(x, y);
  g.scale(skala, skala);
  g.translate(0, -BAKKE);
  const k = 1 - luft / 60;
  g.fillStyle = FARGE.skygge;
  g.beginPath();
  g.ellipse(0, BAKKE + 4, (fot + 14) * k, 4 * k, 0, 0, TAU);
  g.fill();
  lag(g, FARGE.skygge, 3, 3);
  lag(g, farge, 0, 0);
  g.restore();
}
