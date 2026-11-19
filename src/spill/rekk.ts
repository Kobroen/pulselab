// Rekk: rolig flervalg. Strekk hånda inn i riktig sirkel og hold til ringen er full.
import type { Lyd } from './lyd';
import type { Oppgave } from './oppgaver';
import type { Signaler } from './signaler';
import {
  type Effekter, type Resultat, type Spill,
  Konfetti, Toppkort, blunk, land, landingsfall, puls, rist, sprett, tallsprett, tegnBakgrunn, tegnHender, tegnHint, tegnLapp, tegnPille, tegnRing, tegnStartboble, tegnÅs, tilpassSkrift,
} from './felles';
import { FARGE, SKRIFT, papirsirkel, stjerne, tegnFigur } from './tegning';

// Sirklene ligger innenfor behagelig rekkevidde, omtrent halvannen skulderbredde fra skuldrene.
const PLASSER = [[212, 202], [238, 404], [748, 212], [722, 406]];
const BOBLEFARGER = [FARGE.gul, FARGE.blaa, FARGE.gronn, FARGE.rosa];
const RADIUS = 58;
const TREFFSLAKK = 14;
const HOLDETID = 0.5;
const SLIPPTID = 0.18;
const START_X = 748;
const START_Y = 300;

const VANLIG = 0;
const RIKTIG = 1;
const FEIL = 2;
const DEMPET = 3;

type Fase = 'start' | 'aktiv' | 'svar' | 'slutt';

interface Boble {
  x: number;
  y: number;
  tekst: string;
  skrift: string;
  farge: string;
  holdt: number;
  armert: boolean;
  status: number;
}

export class Rekk implements Spill {
  ferdig = false;
  private fase: Fase = 'start';
  private t = 0;
  private nr = -1;
  private bobler: Boble[] = PLASSER.map(([x, y], i) => ({
    x, y, tekst: '', skrift: '', farge: BOBLEFARGER[i], holdt: 0, armert: false, status: VANLIG,
  }));
  private startHoldt = 0;
  private kort = new Toppkort();
  private konfetti = new Konfetti();
  private poeng = 0;
  private riktige = 0;
  private rekke = 0;
  private besteRekke = 0;
  private tid = 0;
  private bom: string[] = [];
  private borteTid = 0;
  private fremdrift = '';
  private poengTekst = '0';
  private rekkeTekst = '';
  private starttekst = '';

  constructor(
    private signaler: Signaler,
    private oppgaver: Oppgave[],
    private lyd: Lyd,
    private medKamera: boolean,
    private effekter: Effekter,
  ) {}

  private holder = -1;
  private rekkeTid = 9;

  /** Holdetonen følger sirkelen spilleren holder hånda i. */
  private settHolder(i: number) {
    if (i === this.holder) return;
    this.holder = i;
    if (i >= 0) this.lyd.holdStart(HOLDETID);
    else this.lyd.holdStopp();
  }

  private iBoble(x: number, y: number, r: number): boolean {
    const h = this.signaler.hender;
    for (let i = 0; i < 2; i++) {
      if (h[i].aktiv && Math.hypot(h[i].x - x, h[i].y - y) < r + TREFFSLAKK) return true;
    }
    return false;
  }

  private neste(g: CanvasRenderingContext2D | null) {
    this.nr++;
    if (this.nr >= this.oppgaver.length) {
      this.fase = 'slutt';
      this.t = 0;
      return;
    }
    const o = this.oppgaver[this.nr];
    for (let i = 0; i < 4; i++) {
      const b = this.bobler[i];
      b.tekst = o.svar[i];
      b.skrift = g ? tilpassSkrift(g, b.tekst, RADIUS * 2 - 22, 28) : `600 22px ${SKRIFT}`;
      b.holdt = 0;
      b.armert = false;
      b.status = VANLIG;
    }
    this.fremdrift = `${this.nr + 1} av ${this.oppgaver.length}`;
    this.fase = 'aktiv';
    this.t = 0;
    this.trengerSkrift = !g;
  }
  private trengerSkrift = false;

  private velg(valgt: number) {
    this.settHolder(-1);
    const o = this.oppgaver[this.nr];
    const riktig = valgt === o.riktig;
    for (let i = 0; i < 4; i++) {
      this.bobler[i].status = i === o.riktig ? RIKTIG : i === valgt ? FEIL : DEMPET;
      this.bobler[i].holdt = i === o.riktig ? 1 : 0;
    }
    if (riktig) {
      this.riktige++;
      this.rekke++;
      this.besteRekke = Math.max(this.besteRekke, this.rekke);
      // Raskt svar gir litt ekstra, men riktig svar er alltid det viktigste.
      this.poeng += 100 + 10 * Math.round(5 * Math.max(0, 1 - this.t / 8));
      this.konfetti.kast(this.bobler[valgt].x, this.bobler[valgt].y, 16);
      this.lyd.riktig(this.rekke - 1);
      this.effekter.dunk();
      this.rekkeTid = 0;
    } else {
      this.rekke = 0;
      this.bom.push(o.nokkel);
      this.lyd.feil();
    }
    this.poengTekst = String(this.poeng);
    this.rekkeTekst = this.rekke >= 2 ? `${this.rekke} på rad` : '';
    this.fase = 'svar';
    this.t = 0;
  }

  oppdater(dt: number) {
    const s = this.signaler;
    this.t += dt;
    this.rekkeTid += dt;
    this.konfetti.oppdater(dt);
    this.borteTid = s.kropp.synlig ? 0 : this.borteTid + dt;

    if (this.fase === 'start') {
      const inne = this.iBoble(START_X, START_Y, RADIUS);
      this.settHolder(inne ? 4 : -1);
      this.startHoldt = Math.max(0, Math.min(1, this.startHoldt + (inne ? dt / HOLDETID : -dt / SLIPPTID)));
      const trykket = s.trykk.ny && Math.hypot(s.trykk.x - START_X, s.trykk.y - START_Y) < RADIUS + TREFFSLAKK;
      if (this.startHoldt >= 1 || trykket || s.tast >= 0) {
        this.settHolder(-1);
        this.lyd.start();
        this.neste(null);
      }
    } else if (this.fase === 'aktiv') {
      this.tid += dt;
      let valgt = s.tast;
      let holder = -1;
      for (let i = 0; i < 4; i++) {
        const b = this.bobler[i];
        const inne = this.iBoble(b.x, b.y, RADIUS);
        // En hånd som allerede ligger i sirkelen når spørsmålet kommer, teller ikke før den har vært ute.
        if (!b.armert) {
          if (!inne && this.t > 0.45) b.armert = true;
        } else {
          b.holdt = Math.max(0, Math.min(1, b.holdt + (inne ? dt / HOLDETID : -dt / SLIPPTID)));
          if (b.holdt >= 1) valgt = i;
          if (inne) holder = i;
        }
        if (s.trykk.ny && Math.hypot(s.trykk.x - b.x, s.trykk.y - b.y) < RADIUS + TREFFSLAKK) valgt = i;
      }
      if (valgt >= 0 && this.t > 0.45) this.velg(valgt);
      else this.settHolder(holder);
    } else if (this.fase === 'svar') {
      const riktig = this.bobler[this.oppgaver[this.nr].riktig].status === RIKTIG && this.rekke > 0;
      if (this.t > (riktig ? 1.15 : 2.1)) this.neste(null);
    } else if (this.t > 0.5) {
      this.ferdig = true;
    }
    s.trykk.ny = false;
    s.tast = -1;
  }

  tegn(g: CanvasRenderingContext2D) {
    const s = this.signaler;
    tegnBakgrunn(g);
    tegnFigur(g, s.kropp);
    tegnÅs(g);

    if (this.fase === 'start') {
      const tekst = this.medKamera && !s.kropp.synlig
        ? 'Still deg så kameraet ser skuldrene dine'
        : this.medKamera
          ? 'Hold hånda i sirkelen for å starte'
          : 'Hold pekeren i sirkelen, eller trykk på den';
      if (tekst !== this.starttekst) this.kort.sett(g, (this.starttekst = tekst));
      this.kort.tegn(g);
      tegnStartboble(g, START_X, START_Y, RADIUS, this.startHoldt);
    } else {
      if (this.trengerSkrift) {
        for (const b of this.bobler) b.skrift = tilpassSkrift(g, b.tekst, RADIUS * 2 - 22, 28);
        this.trengerSkrift = false;
      }
      if (this.nr < this.oppgaver.length) this.kort.sett(g, this.oppgaver[this.nr].tekst);
      this.kort.tegn(g);
      tegnPille(g, 40, 42, 96, this.fremdrift);
      stjerne(g, 866 - (this.poengTekst.length - 3) * 10, 58, 13, FARGE.gul);
      g.fillStyle = FARGE.blekk;
      g.font = `600 18px ${SKRIFT}`;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillText(this.poengTekst, 920, 60);
      if (this.rekkeTekst) tegnLapp(g, 800, 92, 120, this.rekkeTekst, tallsprett(this.rekkeTid));

      if (this.fase !== 'slutt') {
        for (let i = 0; i < 4; i++) {
          const b = this.bobler[i];
          let r = RADIUS;
          let x = b.x;
          let y = b.y;
          let farge = b.farge;
          if (this.fase === 'aktiv') {
            // Sirklene lander én etter én, 70 ms mellom hver.
            const inn = land(this.t - i * 0.07);
            if (inn <= 0) continue;
            y += landingsfall(inn);
            g.globalAlpha = Math.min(1, inn);
          } else if (b.status === RIKTIG) {
            // Etter feil svar pulserer det riktige, slik at spilleren ser hva som var rett.
            r *= this.rekke > 0 ? sprett(this.t) : puls(this.t - 0.4);
          } else if (b.status === FEIL) {
            farge = FARGE.korallLys;
            x += rist(this.t, this.effekter.risting);
            g.globalAlpha = blunk(this.t);
          } else if (b.status === DEMPET) {
            g.globalAlpha = 0.4;
          }
          papirsirkel(g, x, y, r, farge);
          g.fillStyle = FARGE.blekk;
          g.font = b.skrift;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(b.tekst, x, y + 2);
          g.globalAlpha = 1;
          tegnRing(g, x, y, r + 12, b.holdt);
        }
      }
    }
    this.konfetti.tegn(g);
    tegnHender(g, s);
    if (this.medKamera && this.fase !== 'start' && this.borteTid > 1.5) tegnHint(g, 'Vi ser deg ikke. Gå litt bakover.');
  }

  resultat(): Resultat {
    const n = this.oppgaver.length;
    const min = Math.floor(this.tid / 60);
    const sek = String(Math.floor(this.tid % 60)).padStart(2, '0');
    return {
      stjerner: this.riktige >= n * 0.9 ? 3 : this.riktige >= n * 0.6 ? 2 : this.riktige >= n * 0.3 ? 1 : 0,
      fliser: [
        { verdi: `${this.riktige} av ${n}`, tekst: 'riktige' },
        { verdi: `×${this.besteRekke}`, tekst: 'beste rekke' },
        { verdi: `${min}:${sek}`, tekst: 'tid' },
      ],
      øvMer: this.bom.slice(0, 4),
    };
  }

  tilstand() {
    return {
      spill: 'rekk',
      fase: this.fase,
      nr: this.nr,
      poeng: this.poeng,
      riktig: this.nr >= 0 && this.nr < this.oppgaver.length ? this.oppgaver[this.nr].riktig : -1,
      bobler: this.fase === 'start' ? [{ x: START_X, y: START_Y }] : this.bobler.map((b) => ({ x: b.x, y: b.y, tekst: b.tekst })),
    };
  }
}
