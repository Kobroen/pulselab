// Småeffekter utenfor spillflaten: engangsanimasjoner, konfetti og opptelling
// på menyskjermene. I selve spillet tegnes alt på tegneflaten.
import { ROLIG } from './felles';

const FARGER = ['#8ab2ff', '#fba0dc', '#ffd466', '#ffa24b', '#fa6049', '#66d3a8'];

/** Spiller en engangsanimasjon: legger på klassen og fjerner den når animasjonen er ferdig. */
export function spillAv(el: HTMLElement, klasse: string) {
  el.classList.remove(klasse);
  void el.offsetWidth;
  el.classList.add(klasse);
  el.addEventListener('animationend', () => el.classList.remove(klasse), { once: true });
}

/** Papirkonfetti fra et punkt i vinduet. Maks 24 biter. Rolig bevegelse gir dryss i stedet. */
export function konfetti(x: number, y: number, antall = 24) {
  if (ROLIG) return dryss(x, y, antall);
  for (let i = 0; i < Math.min(antall, 24); i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 90;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r - 40;
    const rot = Math.random() * 300 - 150;
    const bit = lagBit(x, y, i, i % 3 ? 12 : 10, i % 3 ? 8 : 10);
    if (i % 3 === 0) bit.style.clipPath = 'polygon(50% 0,100% 100%,0 100%)';
    bit.animate(
      [
        { transform: 'translate(-50%,-50%)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.8}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px,${dy + 90}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 1700 + Math.random() * 500, easing: 'cubic-bezier(.15,.6,.3,1)' },
    ).onfinish = () => bit.remove();
  }
}

/** Rolig variant av konfetti: færre, runde biter som siger sakte ut og toner bort. Ingen snurring, ingen fall. */
function dryss(x: number, y: number, antall: number) {
  const n = Math.min(Math.ceil(antall / 2), 12);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const r = 70 + Math.random() * 45;
    const bit = lagBit(x, y, i, 10, 10);
    bit.style.borderRadius = '50%';
    bit.animate(
      [
        { transform: 'translate(-50%,-50%)', opacity: 0.9 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px),calc(-50% + ${Math.sin(a) * r}px))`, opacity: 0 },
      ],
      { duration: 1500, easing: 'cubic-bezier(.2,.8,.2,1)' },
    ).onfinish = () => bit.remove();
  }
}

function lagBit(x: number, y: number, i: number, b: number, h: number): HTMLElement {
  const bit = document.createElement('i');
  bit.style.cssText =
    `position:fixed;left:${x}px;top:${y}px;width:${b}px;height:${h}px;` +
    `background:${FARGER[i % 6]};pointer-events:none;z-index:999;border-radius:1px`;
  document.body.appendChild(bit);
  return bit;
}

/** Teller opp et tall på 800 ms, for eksempel poeng på resultatskjermen. */
export function tellOpp(el: HTMLElement, til: number, før = '', etter = '') {
  const t0 = performance.now();
  const steg = (t: number) => {
    const p = Math.max(0, Math.min((t - t0) / 800, 1));
    el.textContent = `${før}${Math.round(til * (1 - Math.pow(1 - p, 3)))}${etter}`;
    if (p < 1) requestAnimationFrame(steg);
  };
  steg(t0);
}
