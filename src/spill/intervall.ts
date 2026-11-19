// Intervall: Powerbreak uten fagstoff. Fire korte øvelser etter tur, der
// bevegelsene telles og sola vokser med energien.
import type { Lyd } from './lyd';
import {
  type Signaler,
  SKALA, SKULDER_Y,
} from './signaler';
import {
  type Effekter, type Resultat, type Spill,
  Konfetti, sprett, tallsprett, tegnBakgrunn, tegnHender, tegnHint, tegnPille, tegnStartboble, tegnÅs, tilpassSkrift, Toppkort,
} from './felles';
import { tegnOvelse } from './ovelsesvisning';
import { FARGE, SKRIFT, avrundet, papirkort, sirkel, tegnFigur } from './tegning';

type Type = 'hopp' | 'sprell' | 'boy' | 'boks';

interface Ovelse {
  type: Type;
  navn: string;
  enhet: string;
  mål: number;
  medKamera: string;
  utenKamera: string;
}

const OVELSER: Ovelse[] = [
  { type: 'hopp', navn: 'Hopp!', enhet: 'hopp', mål: 12, medKamera: 'Hopp så høyt du kan', utenKamera: 'Trykk, eller bruk mellomrom' },
  { type: 'sprell', navn: 'Sprellemann!', enhet: 'sprell', mål: 10, medKamera: 'Armene over hodet og ned igjen', utenKamera: 'Dra pekeren over hodet og ned igjen' },
  { type: 'boy', navn: 'Knebøy!', enhet: 'knebøy', mål: 8, medKamera: 'Ned i knærne og opp igjen', utenKamera: 'Trykk, eller bruk mellomrom' },
  { type: 'boks', navn: 'Boks i lufta!', enhet: 'slag', mål: 30, medKamera: 'Slå raskt med begge hender', utenKamera: 'Rist pekeren fort fram og tilbake' },
];

const PAUSE = 3;
const START_X = 748;
const START_Y = 300;
const RADIUS = 58;
const SOL_X = 480;
const SOL_Y = 300;
const NEDTELLING = ['3', '2', '1'];
/** Tasten mellomrom, slik pekerkilden melder den. */
const MELLOMROM = 9;

type Fase = 'start' | 'klar' | 'arbeid' | 'slutt';

export class Intervall implements Spill {
  ferdig = false;
  private fase: Fase = 'start';
  private t = 0;
  private klokke = 0;
  private nr = 0;
  private reps = 0;
  private totalt = 0;
  private andelSum = 0;
  private energi = 0;
  private energiSum = 0;
  private energiTid = 0;
  private tid = 0;
  private oppe = false;
  private nede = false;
  private forrigeLøft = 0;
  private forrigeX = new Float32Array(2);
  private forrigeY = new Float32Array(2);
  private forrigeAktiv = new Uint8Array(2);
  private slagpause = new Float32Array(2);
  private sidenRep = 9;
  private tikk = -1;
  private startHoldt = 0;
  private borteTid = 0;
  private konfetti = new Konfetti();
  private startkort = new Toppkort();
  private navnSkrift = '';
  private tellerTekst = '0';
  private underTekst = '';
  private pilleTekst = '';
  private energiTekst = '0';
  private trengerSkrift = true;

  constructor(
    private signaler: Signaler,
    private lyd: Lyd,
    private medKamera: boolean,
    private effekter: Effekter,
    private arbeidstid = 15,
  ) {}

  private begynn(nr: number) {
    this.nr = nr;
    this.fase = 'klar';
    this.t = 0;
    this.tikk = -1;
    this.reps = 0;
    this.oppe = false;
    this.nede = false;
    const o = OVELSER[nr];
    this.tellerTekst = '0';
    this.underTekst = `av ${o.mål} ${o.enhet}`;
    this.pilleTekst = `Powerbreak · ${nr + 1} av ${OVELSER.length}`;
    this.trengerSkrift = true;
  }

  private rep() {
    if (this.sidenRep < 0.12) return;
    this.sidenRep = 0;
    this.reps++;
    this.totalt++;
    this.energi = Math.min(100, this.energi + 3);
    this.tellerTekst = String(this.reps);
    const mål = OVELSER[this.nr].mål;
    if (this.reps === mål) {
      // Målet er nådd. Det går fint å fortsette, men nå kommer belønningen.
      this.konfetti.kast(815, 130, 16);
      this.effekter.dunk();
      this.lyd.riktig(10);
    } else {
      this.lyd.rep(this.reps);
    }
  }

  oppdater(dt: number) {
    const s = this.signaler;
    this.t += dt;
    this.klokke += dt;
    this.sidenRep += dt;
    this.konfetti.oppdater(dt);
    this.borteTid = s.kropp.synlig ? 0 : this.borteTid + dt;
    const trykk = s.trykk.ny || s.tast === MELLOMROM;

    // Energien følger hvor mye spilleren beveger seg, og synker rolig når det er stille.
    let fart = Math.abs(s.løft - this.forrigeLøft) / Math.max(dt, 0.001) / 2;
    for (let i = 0; i < 2; i++) {
      const h = s.hender[i];
      this.slagpause[i] -= dt;
      if (h.aktiv && this.forrigeAktiv[i]) {
        const v = Math.hypot(h.x - this.forrigeX[i], h.y - this.forrigeY[i]) / Math.max(dt, 0.001);
        fart += v / 1500;
        if (this.fase === 'arbeid' && OVELSER[this.nr].type === 'boks' && v > 750 && this.slagpause[i] <= 0) {
          this.slagpause[i] = 0.22;
          this.rep();
        }
      }
      this.forrigeX[i] = h.x;
      this.forrigeY[i] = h.y;
      this.forrigeAktiv[i] = h.aktiv ? 1 : 0;
    }
    this.forrigeLøft = s.løft;

    if (this.fase === 'start') {
      let inne = false;
      for (let i = 0; i < 2; i++) {
        const h = s.hender[i];
        if (h.aktiv && Math.hypot(h.x - START_X, h.y - START_Y) < RADIUS + 20) inne = true;
      }
      this.startHoldt = Math.max(0, Math.min(1, this.startHoldt + (inne ? dt / 0.5 : -dt / 0.18)));
      const trykket = s.trykk.ny && Math.hypot(s.trykk.x - START_X, s.trykk.y - START_Y) < RADIUS + 20;
      if (this.startHoldt >= 1 || trykket || s.tast >= 0) this.begynn(0);
    } else if (this.fase === 'klar') {
      const steg = Math.floor(this.t);
      if (steg !== this.tikk && steg < PAUSE) {
        this.tikk = steg;
        this.lyd.tikk();
      }
      if (this.t >= PAUSE) {
        this.fase = 'arbeid';
        this.t = 0;
        this.lyd.start();
      }
    } else if (this.fase === 'arbeid') {
      this.tid += dt;
      this.energi = Math.max(0, Math.min(100, this.energi + (Math.min(fart, 1.5) * 45 - 8) * dt));
      this.energiSum += this.energi * dt;
      this.energiTid += dt;
      const type = OVELSER[this.nr].type;
      const l = s.løft;
      if (type === 'hopp') {
        if (!this.oppe && l > 0.2) {
          this.oppe = true;
          this.rep();
        } else if (this.oppe && l < 0.07) this.oppe = false;
        if (trykk) this.rep();
      } else if (type === 'boy') {
        if (!this.nede && l < -0.3) this.nede = true;
        else if (this.nede && l > -0.1) {
          this.nede = false;
          this.rep();
        }
        if (trykk) this.rep();
      } else if (type === 'sprell') {
        // Ett sprell er hendene over hodet og ned under skuldrene igjen.
        let over = false;
        let under = true;
        for (let i = 0; i < 2; i++) {
          const h = s.hender[i];
          if (!h.aktiv) continue;
          if (h.y < SKULDER_Y - SKALA * 0.75) over = true;
          if (h.y < SKULDER_Y) under = false;
        }
        if (!this.oppe && over) {
          this.oppe = true;
          this.rep();
        } else if (this.oppe && under) this.oppe = false;
      }
      if (this.t >= this.arbeidstid) {
        this.andelSum += Math.min(1, this.reps / OVELSER[this.nr].mål);
        if (this.nr + 1 < OVELSER.length) this.begynn(this.nr + 1);
        else {
          this.fase = 'slutt';
          this.t = 0;
        }
      }
    } else if (this.t > 0.8) {
      this.ferdig = true;
    }
    const e = String(Math.round(this.energi));
    if (e !== this.energiTekst) this.energiTekst = e;
    s.trykk.ny = false;
    s.tast = -1;
  }

  tegn(g: CanvasRenderingContext2D) {
    const s = this.signaler;
    tegnBakgrunn(g);
    // Sola vokser med energien og spretter litt for hver bevegelse.
    const puls = sprett(this.sidenRep);
    sirkel(g, SOL_X, SOL_Y, (140 + this.energi * 0.7) * puls, '#ffe9b2');
    sirkel(g, SOL_X, SOL_Y, (90 + this.energi * 0.5) * puls, FARGE.gul);
    tegnFigur(g, s.kropp);
    tegnÅs(g);

    if (this.fase === 'start') {
      this.startkort.sett(g, this.medKamera && !s.kropp.synlig ? 'Still deg så kameraet ser skuldrene dine' : 'Fire øvelser på rad. Gi alt du har!');
      this.startkort.tegn(g);
      tegnStartboble(g, START_X, START_Y, RADIUS, this.startHoldt);
    } else {
      const o = OVELSER[this.nr];
      if (this.trengerSkrift) {
        this.navnSkrift = tilpassSkrift(g, o.navn, 250, 48);
        this.trengerSkrift = false;
      }
      // Øvelsen, øverst til venstre.
      g.save();
      g.translate(200, 79);
      g.rotate(-0.035);
      papirkort(g, -140, -43, 280, 86, 14, FARGE.hvit);
      g.fillStyle = FARGE.blekk;
      g.font = this.navnSkrift;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(o.navn, 0, 3);
      g.restore();
      tegnPille(g, 60, 144, 190, this.pilleTekst);
      g.fillStyle = FARGE.blekk;
      g.font = `400 16px ${SKRIFT}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(this.fase === 'klar' ? 'Gjør deg klar' : this.medKamera ? o.medKamera : o.utenKamera, 62, 204);

      // Tiden som åtte prikker.
      const andel = this.fase === 'arbeid' ? this.t / this.arbeidstid : this.fase === 'slutt' ? 1 : 0;
      for (let i = 0; i < 8; i++) {
        const x = 72 + i * 30;
        if (andel * 8 > i) sirkel(g, x, 244, 10, FARGE.korall);
        else {
          sirkel(g, x, 244, 10, FARGE.blekk);
          sirkel(g, x, 244, 8, FARGE.hvit);
        }
      }

      // Ruta som viser øvelsen.
      g.fillStyle = FARGE.dempet;
      g.font = `600 15px ${SKRIFT}`;
      g.fillText('Slik gjør du', 62, 284);
      tegnOvelse(g, 147, 392, o.type, this.klokke);

      // Telleren, øverst til høyre.
      g.save();
      g.translate(815, 131);
      g.rotate(0.035);
      papirkort(g, -85, -75, 170, 150, 14, FARGE.hvit);
      g.fillStyle = FARGE.blekk;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (this.fase === 'klar') {
        g.font = `600 72px ${SKRIFT}`;
        g.fillText(NEDTELLING[Math.min(2, Math.floor(this.t))], 0, -6);
        g.font = `400 17px ${SKRIFT}`;
        g.fillStyle = FARGE.dempet;
        g.fillText('Klar?', 0, 46);
      } else {
        const z = tallsprett(this.sidenRep);
        g.save();
        g.translate(0, -8);
        g.scale(z, z);
        g.font = `600 72px ${SKRIFT}`;
        g.fillText(this.tellerTekst, 0, 0);
        g.restore();
        g.font = `400 17px ${SKRIFT}`;
        g.fillStyle = FARGE.dempet;
        g.fillText(this.underTekst, 0, 46);
      }
      g.restore();

      // Energien, under telleren.
      g.save();
      g.translate(815, 291);
      g.rotate(-0.026);
      papirkort(g, -85, -55, 170, 110, 14, FARGE.hvit);
      g.fillStyle = FARGE.blekk;
      g.font = `600 15px ${SKRIFT}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('Energi', -65, -30);
      g.fillStyle = FARGE.linje;
      avrundet(g, -65, -14, 130, 18, 9);
      g.fill();
      if (this.energi > 14) {
        g.fillStyle = FARGE.korall;
        avrundet(g, -65, -14, this.energi * 1.3, 18, 9);
        g.fill();
      }
      g.fillStyle = FARGE.blekk;
      g.font = `600 26px ${SKRIFT}`;
      g.fillText(this.energiTekst, -65, 30);
      g.restore();
    }
    this.konfetti.tegn(g);
    tegnHender(g, s);
    if (this.medKamera && this.fase !== 'start' && this.borteTid > 1.5) tegnHint(g, 'Vi ser deg ikke. Gå litt bakover.');
  }

  resultat(): Resultat {
    const andel = this.andelSum / OVELSER.length;
    const min = Math.floor(this.tid / 60);
    const sek = String(Math.floor(this.tid % 60)).padStart(2, '0');
    return {
      stjerner: andel >= 0.95 ? 3 : andel >= 0.6 ? 2 : andel >= 0.25 ? 1 : 0,
      fliser: [
        { verdi: String(this.totalt), tekst: 'bevegelser' },
        { verdi: String(Math.round(this.energiTid ? this.energiSum / this.energiTid : 0)), tekst: 'energi' },
        { verdi: `${min}:${sek}`, tekst: 'aktiv tid' },
      ],
      øvMer: [],
    };
  }

  tilstand() {
    return {
      spill: 'intervall',
      fase: this.fase,
      nr: this.nr,
      reps: this.reps,
      totalt: this.totalt,
      energi: this.energi,
      bobler: this.fase === 'start' ? [{ x: START_X, y: START_Y }] : [],
    };
  }
}
