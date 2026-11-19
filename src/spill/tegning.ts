// Felles tegnehjelpere i papirklipp-stilen: flate former med en forskjøvet skygge.
import {
  type Kropp,
  H_ALBUE, H_HAND, H_HOFTE, H_SKULDER, NESE, V_ALBUE, V_HAND, V_HOFTE, V_SKULDER,
} from './signaler';

export const FARGE = {
  bakgrunn: '#f7f1ec',
  blekk: '#1e1e1e',
  dempet: '#6f6a66',
  linje: '#ece4dc',
  hvit: '#ffffff',
  blaa: '#8ab2ff',
  gronn: '#66d3a8',
  gul: '#ffd466',
  oransje: '#ffa24b',
  korall: '#fa6049',
  korallLys: '#fcafa3',
  rosa: '#fba0dc',
  skygge: 'rgba(30,30,30,0.13)',
} as const;

export const SKRIFT = "Jost, 'Helvetica Neue', Arial, sans-serif";
export const SKYGGE_FORSKYVNING = 7;
const TAU = Math.PI * 2;

export function sirkel(g: CanvasRenderingContext2D, x: number, y: number, r: number, farge: string) {
  g.fillStyle = farge;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

export function papirsirkel(g: CanvasRenderingContext2D, x: number, y: number, r: number, farge: string) {
  sirkel(g, x + SKYGGE_FORSKYVNING, y + SKYGGE_FORSKYVNING, r, FARGE.skygge);
  sirkel(g, x, y, r, farge);
}

export function avrundet(g: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + b, y, x + b, y + h, r);
  g.arcTo(x + b, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + b, y, r);
  g.closePath();
}

export function papirkort(
  g: CanvasRenderingContext2D, x: number, y: number, b: number, h: number, r: number, farge: string,
) {
  g.fillStyle = FARGE.skygge;
  avrundet(g, x + SKYGGE_FORSKYVNING, y + SKYGGE_FORSKYVNING, b, h, r);
  g.fill();
  g.fillStyle = farge;
  avrundet(g, x, y, b, h, r);
  g.fill();
}

export function stjerne(g: CanvasRenderingContext2D, x: number, y: number, r: number, farge: string) {
  g.fillStyle = farge;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.45 : r;
    if (i === 0) g.moveTo(x + q * Math.cos(a), y + q * Math.sin(a));
    else g.lineTo(x + q * Math.cos(a), y + q * Math.sin(a));
  }
  g.closePath();
  g.fill();
}

// ---------- Spillerfiguren ----------

function linje(g: CanvasRenderingContext2D, k: Kropp, a: number, b: number, dx: number, dy: number) {
  if (!k.ok[a] || !k.ok[b]) return;
  g.moveTo(k.x[a] + dx, k.y[a] + dy);
  g.lineTo(k.x[b] + dx, k.y[b] + dy);
}

function figurlag(g: CanvasRenderingContext2D, k: Kropp, farge: string, dx: number, dy: number) {
  const s = k.skala;
  const mx = (k.x[V_SKULDER] + k.x[H_SKULDER]) / 2 + dx;
  const my = (k.y[V_SKULDER] + k.y[H_SKULDER]) / 2 + dy;
  // Hodet følger nesa når den er funnet. Ellers står det rett over skuldrene.
  const hx = k.ok[NESE] ? k.x[NESE] + dx : mx;
  const hy = k.ok[NESE] ? k.y[NESE] + dy : my - s * 0.62;

  // Hoftene er ofte utenfor bildet når spilleren sitter. Da klippes kroppen rett ned.
  const vhx = k.ok[V_HOFTE] ? k.x[V_HOFTE] + dx : k.x[V_SKULDER] + dx + s * 0.12;
  const vhy = k.ok[V_HOFTE] ? k.y[V_HOFTE] + dy : k.y[V_SKULDER] + dy + s * 1.6;
  const hhx = k.ok[H_HOFTE] ? k.x[H_HOFTE] + dx : k.x[H_SKULDER] + dx - s * 0.12;
  const hhy = k.ok[H_HOFTE] ? k.y[H_HOFTE] + dy : k.y[H_SKULDER] + dy + s * 1.6;

  g.strokeStyle = farge;
  g.fillStyle = farge;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = s * 0.21;
  // Overkroppen er ett utklipt stykke. Kanten strekes med samme bredde som armene.
  g.beginPath();
  g.moveTo(k.x[V_SKULDER] + dx, k.y[V_SKULDER] + dy);
  g.lineTo(k.x[H_SKULDER] + dx, k.y[H_SKULDER] + dy);
  g.lineTo(hhx, hhy);
  g.lineTo(vhx, vhy);
  g.closePath();
  g.fill();
  g.moveTo(hx, hy);
  g.lineTo(mx, my);
  for (let side = 0; side < 2; side++) {
    const skulder = side ? H_SKULDER : V_SKULDER;
    const albue = side ? H_ALBUE : V_ALBUE;
    const hand = side ? H_HAND : V_HAND;
    if (k.ok[hand]) {
      g.moveTo(k.x[skulder] + dx, k.y[skulder] + dy);
      if (k.ok[albue]) g.lineTo(k.x[albue] + dx, k.y[albue] + dy);
      g.lineTo(k.x[hand] + dx, k.y[hand] + dy);
    } else {
      linje(g, k, skulder, albue, dx, dy);
    }
  }
  g.stroke();
  sirkel(g, hx, hy, s * 0.31, farge);
}

/** Tegner spilleren som korallrød papirfigur med skygge. */
export function tegnFigur(g: CanvasRenderingContext2D, k: Kropp) {
  if (!k.synlig || !k.ok[V_SKULDER] || !k.ok[H_SKULDER]) return;
  const f = (SKYGGE_FORSKYVNING * k.skala) / 150;
  figurlag(g, k, FARGE.skygge, f, f);
  figurlag(g, k, FARGE.korall, 0, 0);
}
