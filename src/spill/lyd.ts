// Lydene til Papirklipp-stilen, laget med Web Audio. Ingen lydfiler lastes.
// Oppskriftene følger designets spesifikasjon for bevegelse og lyd: klangen er
// en myk marimba, og tonen for riktig svar klatrer med komboen.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const semi = (f: number, n: number) => f * Math.pow(2, n / 12);
// Takten: grunntone per takt (C, C, A, G), bassrytme per takt og en pentaton melodi. -1 er pause.
const TAKTROT = [0, 0, -3, -5];
const TAKTBASS = [1, 0, 0, 1, 0, 1, 0, 0];
const TAKTMELODI = [
  0, -1, 4, -1, 7, -1, 4, -1, 9, -1, 7, -1, 4, -1, 2, -1,
  0, -1, 4, -1, 7, -1, 9, -1, 12, -1, 9, 7, 4, -1, 2, -1,
];

interface Tone {
  f: number;
  f2?: number;
  t?: number;
  d?: number;
  type?: OscillatorType;
  g?: number;
}
interface Sus {
  f: number;
  f2?: number;
  t?: number;
  d: number;
  g: number;
  q?: number;
  type?: BiquadFilterType;
}

export class Lyd {
  av = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private støy: AudioBuffer | null = null;
  private holdOsc: OscillatorNode | null = null;
  private holdGain: GainNode | null = null;
  private taktBpm = 0;
  private taktNeste = 0;
  private taktSteg = 0;

  /** Må kalles fra et trykk første gang, ellers får ikke nettleseren lov til å spille lyd. */
  vekk() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone({ f, f2, t = 0, d = 0.15, type = 'sine', g = 0.15 }: Tone) {
    const c = this.ctx;
    if (!c || !this.master || this.av) return;
    const s = c.currentTime + t;
    const o = c.createOscillator();
    const v = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, s);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, s + d);
    v.gain.setValueAtTime(0.0001, s);
    v.gain.exponentialRampToValueAtTime(g, s + 0.005);
    v.gain.exponentialRampToValueAtTime(0.0001, s + d);
    o.connect(v).connect(this.master);
    o.start(s);
    o.stop(s + d + 0.02);
  }

  private sus({ f, f2, t = 0, d, g, q = 1, type = 'bandpass' }: Sus) {
    const c = this.ctx;
    if (!c || !this.master || this.av) return;
    if (!this.støy) {
      this.støy = c.createBuffer(1, c.sampleRate / 2, c.sampleRate);
      const ch = this.støy.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const s = c.currentTime + t;
    const kilde = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const v = c.createGain();
    kilde.buffer = this.støy;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, s);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, s + d);
    v.gain.setValueAtTime(g, s);
    v.gain.exponentialRampToValueAtTime(0.0001, s + d);
    kilde.connect(filter).connect(v).connect(this.master);
    kilde.start(s);
    kilde.stop(s + d + 0.02);
  }

  private klang(f: number, t: number, d: number, g = 0.16) {
    this.tone({ f, t, d, g });
    this.tone({ f, t, d: d * 0.65, type: 'triangle', g: g * 0.4 });
  }

  trykk() {
    this.tone({ f: 520, f2: 380, d: 0.05, type: 'triangle', g: 0.14 });
    this.sus({ d: 0.012, g: 0.05, f: 3000, type: 'highpass' });
  }

  /** Tonen klatrer i en pentaton skala, slik at en lang kombo høres ut som en melodi. */
  riktig(kombo = 0) {
    const b = semi(523.25, PENTA[Math.max(0, Math.min(kombo, 10))]);
    this.klang(b, 0, 0.18);
    this.klang(semi(b, 4), 0.07, 0.22);
  }

  feil() {
    this.tone({ f: 196, f2: 147, d: 0.2, g: 0.18 });
    this.tone({ f: 98, f2: 82, d: 0.16, type: 'triangle', g: 0.06 });
  }

  overgang() {
    this.sus({ d: 0.22, g: 0.07, f: 600, f2: 2400, q: 0.8 });
  }

  stjerne(nr: number) {
    const f = semi(1046.5, [0, 4, 7][nr] ?? 0);
    this.tone({ f, d: 0.3, g: 0.14 });
    this.tone({ f: f * 2, d: 0.12, g: 0.04 });
  }

  fanfare() {
    [0, 4, 7, 12].forEach((n, i) => this.klang(semi(523.25, n), i * 0.09, i === 3 ? 0.55 : 0.16));
    this.sus({ t: 0.27, d: 0.35, g: 0.03, f: 6000, type: 'highpass' });
  }

  tikk() {
    this.tone({ f: 880, d: 0.06, type: 'triangle', g: 0.1 });
  }

  /** Én myk tone per bevegelse i Powerbreak. Den klatrer gjennom skalaen og begynner på nytt. */
  rep(nr: number) {
    this.klang(semi(392, PENTA[nr % PENTA.length]), 0, 0.14, 0.1);
  }

  start() {
    this.klang(1318.5, 0, 0.25, 0.14);
  }

  bryter(på: boolean) {
    this.tone({ f: på ? 440 : 660, d: 0.06, type: 'triangle', g: 0.1 });
    this.tone({ f: på ? 660 : 440, t: 0.06, d: 0.08, type: 'triangle', g: 0.1 });
  }

  /**
   * Takt til øvelsene i fellesmodus. Kalles hvert bilde mens takten skal gå, og med 0 for å stoppe.
   * Slagene legges i lydklokka litt fram i tid, så takten holder seg jevn selv om bildene hakker.
   */
  takt(bpm: number, rolig = false) {
    const c = this.ctx;
    if (!c || this.av || !bpm) {
      this.taktBpm = 0;
      return;
    }
    if (bpm !== this.taktBpm || this.taktNeste < c.currentTime - 0.5) {
      this.taktBpm = bpm;
      this.taktSteg = 0;
      this.taktNeste = c.currentTime + 0.05;
    }
    const åttedel = 30 / bpm;
    while (this.taktNeste < c.currentTime + 0.15) {
      this.taktslag(this.taktSteg, Math.max(0, this.taktNeste - c.currentTime), rolig);
      this.taktSteg = (this.taktSteg + 1) % 32;
      this.taktNeste += åttedel;
    }
  }

  /** Ett steg i takten: åttedeler over fire takter. Stortromme, skarp, hi-hat, bass og en liten marimbamelodi. */
  private taktslag(steg: number, t: number, rolig: boolean) {
    const rot = TAKTROT[steg >> 3];
    if (rolig) {
      if (steg % 4 === 0) this.tone({ f: semi(130.8, rot), t, d: 0.5, g: 0.1 });
      if (TAKTMELODI[steg] >= 0 && steg % 4 === 0) this.klang(semi(523.25, TAKTMELODI[steg]), t, 0.5, 0.05);
      return;
    }
    if (steg % 2 === 0) this.tone({ f: 120, f2: 45, t, d: 0.16, g: 0.24 });
    else this.sus({ f: 7000, t, d: 0.03, g: 0.022, type: 'highpass' });
    if (steg % 8 === 2 || steg % 8 === 6) this.sus({ f: 1800, t, d: 0.09, g: 0.06, q: 0.7 });
    if (TAKTBASS[steg % 8]) this.tone({ f: semi(65.4, rot), t, d: 0.14, type: 'triangle', g: 0.14 });
    if (TAKTMELODI[steg] >= 0) this.klang(semi(523.25, TAKTMELODI[steg]), t, 0.16, 0.05);
  }

  /** Stigende tone mens spilleren holder hånda i en svarsirkel. */
  holdStart(sekunder: number) {
    this.holdStopp();
    const c = this.ctx;
    if (!c || !this.master || this.av) return;
    const s = c.currentTime;
    const o = c.createOscillator();
    const v = c.createGain();
    o.frequency.setValueAtTime(300, s);
    o.frequency.exponentialRampToValueAtTime(600, s + sekunder);
    v.gain.setValueAtTime(0.0001, s);
    v.gain.exponentialRampToValueAtTime(0.05, s + 0.03);
    o.connect(v).connect(this.master);
    o.start(s);
    o.stop(s + sekunder + 0.1);
    this.holdOsc = o;
    this.holdGain = v;
  }

  holdStopp() {
    const c = this.ctx;
    if (!c || !this.holdOsc || !this.holdGain) return;
    try {
      this.holdGain.gain.cancelScheduledValues(c.currentTime);
      this.holdGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.02);
      this.holdOsc.stop(c.currentTime + 0.1);
    } catch {
      // Tonen var allerede ferdig.
    }
    this.holdOsc = null;
    this.holdGain = null;
  }
}
