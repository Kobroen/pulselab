// Kamerakilden: henter bilder fra kameraet, lar arbeideren tolke dem og gjør
// kroppspunktene om til abstrakte signaler. Bildene forlater aldri enheten.
import Sporingsarbeider from './sporing.worker?worker';
import type { FraArbeider, TilArbeider } from './sporing.worker';
import {
  type Signaler, type Signalkilde,
  ANTALL_LEDD, H_ALBUE, H_HAND, H_HANDLEDD, H_SKULDER, SKALA, SKULDER_X, SKULDER_Y,
  V_ALBUE, V_HAND, V_HANDLEDD, V_SKULDER,
} from './signaler';

const BILDEBREDDE = 192;
const MIN_SIKKERHET = 0.3;
const MIN_SIKKERHET_HAND = 0.2;
/** Hvor langt hånda ligger forbi håndleddet, som andel av underarmen. */
const HAND_FORLENGELSE = 0.35;
const GLATTING = 22;
const GLATTING_KROPP = 6;
/** Hvilestillingen i høyden følger sakte med, slik at hopp og knebøy synes på figuren. */
const GLATTING_HØYDE = 1.2;
const TÅLMODIGHET = 0.35;

export type Kamerastatus = 'av' | 'starter' | 'klar' | 'feil';
export type Avstand = 'ukjent' | 'for nær' | 'for langt unna' | 'bra';

export interface Ramme {
  x: number;
  y: number;
  b: number;
  h: number;
}

export class Kamerakilde implements Signalkilde {
  status: Kamerastatus = 'av';
  kameraPå = false;
  modellKlar = false;
  feilmelding = '';
  avstand: Avstand = 'ukjent';
  /** Når satt, tegnes kroppen slik kameraet ser den, inni denne ramma. Ellers i spillscenen. */
  ramme: Ramme | null = null;
  /** Når satt, hoppes målingene fra kameraet over. Brukes av røyktesten, som mater inn en kropp selv. */
  frys = false;

  // Måletall til den skjulte måleskjermen.
  sporinger = 0;
  tolkMs = 0;
  forsinkelseMs = 0;

  private video = document.createElement('video');
  private arbeider = new Sporingsarbeider();
  private buffer: Float32Array | null = new Float32Array(17 * 3);
  private opptatt = false;
  private aktiv = false;
  private sendt = 0;
  private forhold = 4 / 3;

  // Mål (siste måling) og glattet verdi, i speilvendte kameraenheter (høyden er 1).
  private målX = new Float32Array(ANTALL_LEDD);
  private målY = new Float32Array(ANTALL_LEDD);
  private målOk = new Uint8Array(ANTALL_LEDD);
  private gx = new Float32Array(ANTALL_LEDD);
  private gy = new Float32Array(ANTALL_LEDD);
  private borte = new Float32Array(ANTALL_LEDD).fill(9);
  private målMidtX = 0;
  private målMidtY = 0;
  private målBredde = 0;
  private midtX = 0;
  private midtY = 0;
  private bredde = 0;
  private settKropp = 9;

  private klarLøs: (() => void) | null = null;
  private klarFeil: ((e: Error) => void) | null = null;

  constructor(private signaler: Signaler) {
    const v = this.video;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('aria-hidden', 'true');
    v.className = 'kameravideo';
    document.body.appendChild(v);
    this.arbeider.onmessage = (ev: MessageEvent<FraArbeider>) => this.fraArbeider(ev.data);
    this.arbeider.onerror = (ev) => this.feil(ev.message || 'Sporingen stoppet');
    document.addEventListener('visibilitychange', this.synlighet);
  }

  /** Slår på kameraet og laster modellen. Avvises hvis kameraet er blokkert eller mangler. */
  async start() {
    this.status = 'starter';
    this.aktiv = true;
    const lastet = new Promise<void>((løs, avvis) => {
      this.klarLøs = løs;
      this.klarFeil = avvis;
    });
    lastet.catch(() => {});
    const melding: TilArbeider = { type: 'last', base: new URL('./', location.href).href };
    this.arbeider.postMessage(melding);
    try {
      await this.åpneKamera();
      await lastet;
      this.status = 'klar';
    } catch (e) {
      this.status = 'feil';
      this.feilmelding = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  private async åpneKamera() {
    const strøm = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 }, facingMode: 'user' },
    });
    if (!this.aktiv) {
      strøm.getTracks().forEach((t) => t.stop());
      return;
    }
    this.video.srcObject = strøm;
    await this.video.play();
    this.forhold = this.video.videoWidth / this.video.videoHeight || 4 / 3;
    this.kameraPå = true;
    this.ventPåBilde();
  }

  private lukkKamera() {
    (this.video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.kameraPå = false;
  }

  // Kameraet slås av når fanen skjules, og på igjen når den kommer tilbake.
  private synlighet = () => {
    if (!this.aktiv) return;
    if (document.hidden) this.lukkKamera();
    else if (!this.kameraPå) this.åpneKamera().catch((e) => this.feil(String(e)));
  };

  private ventPåBilde = () => {
    if (!this.aktiv || !this.kameraPå) return;
    if ('requestVideoFrameCallback' in this.video) this.video.requestVideoFrameCallback(this.nyttBilde);
    else requestAnimationFrame(this.nyttBilde);
  };

  private nyttBilde = () => {
    if (!this.aktiv || !this.kameraPå) return;
    if (!this.opptatt && this.modellKlar && this.buffer && this.video.videoWidth) {
      this.opptatt = true;
      this.sendt = performance.now();
      createImageBitmap(this.video, {
        resizeWidth: BILDEBREDDE,
        resizeHeight: Math.round(BILDEBREDDE / this.forhold),
        resizeQuality: 'low',
      }).then(this.sendBilde, this.bildeFeilet);
    }
    this.ventPåBilde();
  };

  private sendBilde = (bitmap: ImageBitmap) => {
    const punkter = this.buffer;
    if (!punkter || !this.aktiv) {
      bitmap.close();
      this.opptatt = false;
      return;
    }
    this.buffer = null;
    const melding: TilArbeider = { type: 'bilde', bitmap, punkter };
    this.arbeider.postMessage(melding, [bitmap, punkter.buffer]);
  };

  private bildeFeilet = () => {
    this.opptatt = false;
  };

  private fraArbeider(m: FraArbeider) {
    if (m.type === 'klar') {
      this.modellKlar = true;
      this.klarLøs?.();
    } else if (m.type === 'feil') {
      this.feil(m.melding);
    } else {
      this.buffer = m.punkter;
      this.opptatt = false;
      this.sporinger++;
      this.tolkMs = m.ms;
      this.forsinkelseMs = performance.now() - this.sendt;
      if (!this.frys) this.mottaPunkter(m.punkter);
    }
  }

  private feil(melding: string) {
    this.opptatt = false;
    this.feilmelding = melding;
    if (!this.modellKlar) this.klarFeil?.(new Error(melding));
  }

  /** Tar imot [x, y, sikkerhet] per ledd fra modellen. Offentlig slik at røyktesten kan mate inn en kropp. */
  mottaPunkter(p: Float32Array) {
    const f = this.forhold;
    for (let i = 0; i < 17; i++) {
      this.målX[i] = (1 - p[i * 3]) * f; // speilvendt, som i et speil
      this.målY[i] = p[i * 3 + 1];
      const min = i === V_HANDLEDD || i === H_HANDLEDD ? MIN_SIKKERHET_HAND : MIN_SIKKERHET;
      this.målOk[i] = p[i * 3 + 2] >= min ? 1 : 0;
    }
    // Håndpunktet ligger litt forbi håndleddet, i underarmens retning.
    for (let side = 0; side < 2; side++) {
      const ledd = side ? H_HANDLEDD : V_HANDLEDD;
      const albue = side ? H_ALBUE : V_ALBUE;
      const hand = side ? H_HAND : V_HAND;
      const forleng = this.målOk[albue] ? HAND_FORLENGELSE : 0;
      this.målX[hand] = this.målX[ledd] + (this.målX[ledd] - this.målX[albue]) * forleng;
      this.målY[hand] = this.målY[ledd] + (this.målY[ledd] - this.målY[albue]) * forleng;
      this.målOk[hand] = this.målOk[ledd];
    }
    if (this.målOk[V_SKULDER] && this.målOk[H_SKULDER]) {
      const dx = this.målX[H_SKULDER] - this.målX[V_SKULDER];
      const dy = this.målY[H_SKULDER] - this.målY[V_SKULDER];
      this.målMidtX = (this.målX[V_SKULDER] + this.målX[H_SKULDER]) / 2;
      this.målMidtY = (this.målY[V_SKULDER] + this.målY[H_SKULDER]) / 2;
      this.målBredde = Math.max(0.04, Math.hypot(dx, dy));
      if (this.settKropp > TÅLMODIGHET) {
        this.midtX = this.målMidtX;
        this.midtY = this.målMidtY;
        this.bredde = this.målBredde;
      }
      this.settKropp = 0;
    }
  }

  oppdater(dt: number) {
    const a = 1 - Math.exp(-dt * GLATTING);
    for (let i = 0; i < ANTALL_LEDD; i++) {
      if (this.målOk[i]) {
        if (this.borte[i] > TÅLMODIGHET) {
          this.gx[i] = this.målX[i];
          this.gy[i] = this.målY[i];
        } else {
          this.gx[i] += (this.målX[i] - this.gx[i]) * a;
          this.gy[i] += (this.målY[i] - this.gy[i]) * a;
        }
        this.borte[i] = 0;
      } else if (this.borte[i] < 9) {
        this.borte[i] += dt;
      }
    }
    if (this.settKropp < 9) this.settKropp += dt;
    const b = 1 - Math.exp(-dt * GLATTING_KROPP);
    this.midtX += (this.målMidtX - this.midtX) * b;
    this.midtY += (this.målMidtY - this.midtY) * (1 - Math.exp(-dt * GLATTING_HØYDE));
    this.bredde += (this.målBredde - this.bredde) * b;

    const synlig = this.settKropp < 0.6 && this.bredde > 0;
    // Armene må få plass i kamerabildet når de strekkes helt ut.
    this.avstand = !synlig
      ? 'ukjent'
      : this.bredde > this.forhold / 4
        ? 'for nær'
        : this.bredde < 0.07
          ? 'for langt unna'
          : 'bra';

    const skulderY = (this.gy[V_SKULDER] + this.gy[H_SKULDER]) / 2;
    this.signaler.løft = synlig && this.bredde > 0 ? (this.midtY - skulderY) / this.bredde : 0;

    const k = this.signaler.kropp;
    k.synlig = synlig;
    const r = this.ramme;
    if (r) {
      // Kalibrering: kroppen vises der kameraet ser den.
      const s = r.b / this.forhold;
      const oy = r.y + (r.h - s) / 2;
      k.skala = this.bredde * s;
      for (let i = 0; i < ANTALL_LEDD; i++) {
        k.ok[i] = this.borte[i] <= TÅLMODIGHET ? 1 : 0;
        k.x[i] = r.x + this.gx[i] * s;
        k.y[i] = oy + this.gy[i] * s;
      }
    } else if (synlig) {
      // Spill: kroppen måles i skulderbredder, slik at avstanden til kameraet ikke spiller noen rolle.
      // Står spilleren tett på kameraet, får ikke utstrakte armer plass i bildet. Da brukes
      // bildebredden som målestokk i stedet, slik at mindre bevegelser rekker like langt.
      const enhet = Math.min(this.bredde, this.forhold / 4.2);
      const s = SKALA / enhet;
      k.skala = this.bredde * s;
      for (let i = 0; i < ANTALL_LEDD; i++) {
        k.ok[i] = this.borte[i] <= TÅLMODIGHET ? 1 : 0;
        k.x[i] = SKULDER_X + (this.gx[i] - this.midtX) * s;
        k.y[i] = SKULDER_Y + (this.gy[i] - this.midtY) * s;
      }
    }
    const hender = this.signaler.hender;
    for (let side = 0; side < 2; side++) {
      const i = side ? H_HAND : V_HAND;
      const h = hender[side];
      h.aktiv = synlig && !r && k.ok[i] === 1;
      h.x = k.x[i];
      h.y = k.y[i];
    }
  }

  stopp() {
    this.aktiv = false;
    this.status = 'av';
    document.removeEventListener('visibilitychange', this.synlighet);
    this.lukkKamera();
    this.arbeider.terminate();
    this.video.remove();
    this.signaler.kropp.synlig = false;
    this.signaler.hender[0].aktiv = this.signaler.hender[1].aktiv = false;
  }
}
