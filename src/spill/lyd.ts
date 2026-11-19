// Små lydsignaler laget med Web Audio. Ingen lydfiler lastes.

export class Lyd {
  av = false;
  private ctx: AudioContext | null = null;

  /** Må kalles fra et klikk første gang, ellers får ikke nettleseren lov til å spille lyd. */
  vekk() {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(frekvens: number, start: number, lengde: number, styrke = 0.12, form: OscillatorType = 'sine') {
    const ctx = this.ctx;
    if (!ctx || this.av) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = form;
    osc.frequency.value = frekvens;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(styrke, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + lengde);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + lengde + 0.02);
  }

  riktig() {
    this.tone(660, 0, 0.14, 0.12, 'triangle');
    this.tone(990, 0.09, 0.22, 0.12, 'triangle');
  }

  feil() {
    this.tone(220, 0, 0.26, 0.09);
  }

  start() {
    this.tone(523, 0, 0.12, 0.1, 'triangle');
  }

  ferdig() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, 0.3, 0.11, 'triangle'));
  }
}
