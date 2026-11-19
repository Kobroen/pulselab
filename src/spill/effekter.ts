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

/** Papirkonfetti fra et punkt i vinduet. Maks 24 biter. */
export function konfetti(x: number, y: number, antall = 24) {
  if (ROLIG) return;
  for (let i = 0; i < Math.min(antall, 24); i++) {
    const bit = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 90;
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r - 40;
    const rot = Math.random() * 540 - 270;
    bit.style.cssText =
      `position:fixed;left:${x}px;top:${y}px;width:${i % 3 ? 12 : 10}px;height:${i % 3 ? 8 : 10}px;` +
      `background:${FARGER[i % 6]};pointer-events:none;z-index:999;border-radius:1px;` +
      (i % 3 ? '' : 'clip-path:polygon(50% 0,100% 100%,0 100%)');
    document.body.appendChild(bit);
    bit.animate(
      [
        { transform: 'translate(-50%,-50%)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.8}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px,${dy + 110}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)' },
    ).onfinish = () => bit.remove();
  }
}

/** Teller opp et tall på 600 ms, for eksempel poeng på resultatskjermen. */
export function tellOpp(el: HTMLElement, til: number, før = '', etter = '') {
  if (ROLIG) {
    el.textContent = `${før}${til}${etter}`;
    return;
  }
  const t0 = performance.now();
  const steg = (t: number) => {
    const p = Math.min((t - t0) / 600, 1);
    el.textContent = `${før}${Math.round(til * (1 - Math.pow(1 - p, 3)))}${etter}`;
    if (p < 1) requestAnimationFrame(steg);
  };
  requestAnimationFrame(steg);
}
