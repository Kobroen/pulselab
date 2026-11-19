// Kamerafri styring: mus, finger og tastatur gir de samme signalene som kameraet.
import {
  type Signaler, type Signalkilde,
  H_ALBUE, H_HAND, H_SKULDER, SCENE_B, SCENE_H, SKALA, SKULDER_X, SKULDER_Y, V_ALBUE, V_HAND, V_SKULDER,
} from './signaler';

const OVERARM = SKALA * 0.85;
const UNDERARM = SKALA * 0.85;

export class Pekerkilde implements Signalkilde {
  private px = 0;
  private py = 0;
  private inne = false;
  private lyttere: [EventTarget, string, EventListener][] = [];

  /**
   * @param styrerHand Når kameraet styrer hendene, gir pekeren bare direkte trykk og tastevalg.
   */
  constructor(
    private flate: HTMLElement,
    private signaler: Signaler,
    private styrerHand: boolean,
  ) {
    const lytt = (mål: EventTarget, type: string, fn: (e: never) => void) => {
      mål.addEventListener(type, fn as EventListener);
      this.lyttere.push([mål, type, fn as EventListener]);
    };
    lytt(flate, 'pointermove', (e: PointerEvent) => this.flytt(e));
    lytt(flate, 'pointerdown', (e: PointerEvent) => {
      this.flytt(e);
      const t = signaler.trykk;
      t.x = this.px;
      t.y = this.py;
      t.ny = true;
    });
    lytt(flate, 'pointerup', (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') this.inne = false;
    });
    lytt(flate, 'pointerleave', () => (this.inne = false));
    lytt(flate, 'pointercancel', () => (this.inne = false));
    lytt(window, 'keydown', (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') signaler.tast = Number(e.key) - 1;
    });

    if (styrerHand) {
      // En stillestående figur som strekker armen etter pekeren.
      const k = signaler.kropp;
      k.synlig = true;
      k.skala = SKALA;
      k.x[V_SKULDER] = SKULDER_X - SKALA / 2;
      k.x[H_SKULDER] = SKULDER_X + SKALA / 2;
      k.y[V_SKULDER] = k.y[H_SKULDER] = SKULDER_Y;
      k.ok[V_SKULDER] = k.ok[H_SKULDER] = 1;
      k.ok[V_ALBUE] = k.ok[H_ALBUE] = k.ok[V_HAND] = k.ok[H_HAND] = 1;
    }
  }

  private flytt(e: PointerEvent) {
    const r = this.flate.getBoundingClientRect();
    this.px = ((e.clientX - r.left) / r.width) * SCENE_B;
    this.py = ((e.clientY - r.top) / r.height) * SCENE_H;
    this.inne = true;
  }

  oppdater(dt: number) {
    if (!this.styrerHand) return;
    const hand = this.signaler.hender[0];
    hand.aktiv = this.inne;
    hand.x = this.px;
    hand.y = this.py;

    const k = this.signaler.kropp;
    const høyre = this.px >= SKULDER_X;
    const a = 1 - Math.exp(-dt * 18);
    for (let side = 0; side < 2; side++) {
      const skulder = side ? H_SKULDER : V_SKULDER;
      const albue = side ? H_ALBUE : V_ALBUE;
      const håndledd = side ? H_HAND : V_HAND;
      const retning = side ? 1 : -1;
      const sx = k.x[skulder];
      const sy = k.y[skulder];
      let ax = sx + retning * 22;
      let ay = sy + OVERARM;
      let hx = sx + retning * 34;
      let hy = sy + OVERARM + UNDERARM;
      if (this.inne && (side === 1) === høyre) {
        // Toleddet arm: albuen plasseres slik at over- og underarm når fram til pekeren.
        const dx = this.px - sx;
        const dy = this.py - sy;
        const full = Math.hypot(dx, dy);
        const d = Math.min(Math.max(full, 20), OVERARM + UNDERARM - 1);
        const vinkel = Math.atan2(dy, dx);
        const bøy = Math.acos((OVERARM * OVERARM + d * d - UNDERARM * UNDERARM) / (2 * OVERARM * d));
        ax = sx + OVERARM * Math.cos(vinkel + retning * bøy);
        ay = sy + OVERARM * Math.sin(vinkel + retning * bøy);
        hx = sx + (dx / (full || 1)) * d;
        hy = sy + (dy / (full || 1)) * d;
      }
      k.x[albue] += (ax - k.x[albue]) * a;
      k.y[albue] += (ay - k.y[albue]) * a;
      k.x[håndledd] += (hx - k.x[håndledd]) * a;
      k.y[håndledd] += (hy - k.y[håndledd]) * a;
    }
  }

  stopp() {
    for (const [mål, type, fn] of this.lyttere) mål.removeEventListener(type, fn);
    this.lyttere.length = 0;
  }
}
