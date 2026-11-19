// Sveip: raskere variant. Svarene flyr inn i buer, og spilleren slår til det
// riktige med hånda. Gale svar skal få passere. Runden varer ett minutt.
import type { Lyd } from './lyd';
import type { Oppgave } from './oppgaver';
import type { Signaler } from './signaler';
import {
  type Effekter, type Resultat, type Spill,
  Konfetti, Toppkort, avstandTilLinje, tallsprett, tegnBakgrunn, tegnHender, tegnHint, tegnLapp, tegnPille, tegnStartboble, tegnÅs, tilpassSkrift,
} from './felles';
import { FARGE, avrundet, papirsirkel, tegnFigur } from './tegning';

const RADIUS = 48;
const TREFFSLAKK = 20;
const TYNGDE = 340;
const ANTALL = 8;
const FARGER = [FARGE.rosa, FARGE.blaa, FARGE.gul, FARGE.oransje];
const START_X = 748;
const START_Y = 300;

const LEDIG = 0;
const FLYR = 1;
const TRUFFET = 2;
const BOMMET = 3;
const UTGÅTT = 4;

type Fase = 'start' | 'spill' | 'slutt';

interface Flyger {
  status: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  tekst: string;
  skrift: string;
  farge: string;
  riktig: boolean;
}

export class Sveip implements Spill {
  ferdig = false;
  private fase: Fase = 'start';
  private t = 0;
  private tidIgjen: number;
  private nr = -1;
  private flygere: Flyger[] = Array.from({ length: ANTALL }, () => ({
    status: LEDIG, x: 0, y: 0, vx: 0, vy: 0, t: 0, tekst: '', skrift: '', farge: FARGE.blaa, riktig: false,
  }));
  private pose: number[] = [];
  private nesteKast = 0;
  private kast = 0;
  private fraVenstre = true;
  private forrigeX = new Float32Array(2);
  private forrigeY = new Float32Array(2);
  private forrigeAktiv = new Uint8Array(2);
  private skrifter: string[] = ['', '', '', ''];
  private trengerSkrift = false;
  private startHoldt = 0;
  private kort = new Toppkort();
  private konfetti = new Konfetti();
  private poeng = 0;
  private riktige = 0;
  private kombo = 0;
  private komboTid = 9;
  private besteKombo = 0;
  private bom: string[] = [];
  private borteTid = 0;
  private poengTekst = '0 poeng';
  private komboTekst = '';
  private starttekst = '';

  constructor(
    private signaler: Signaler,
    private oppgaver: Oppgave[],
    private lyd: Lyd,
    private medKamera: boolean,
    private effekter: Effekter,
    private varighet = 60,
  ) {
    this.tidIgjen = varighet;
  }

  private nesteOppgave() {
    this.nr = (this.nr + 1) % this.oppgaver.length;
    this.pose.length = 0;
    this.trengerSkrift = true;
    this.nesteKast = 0.35;
    for (const f of this.flygere) {
      if (f.status === FLYR) {
        f.status = UTGÅTT;
        f.t = 0;
      }
    }
  }

  /** Kaster ett svar inn fra siden. Det riktige svaret kommer minst hver tredje gang. */
  private kastInn() {
    const o = this.oppgaver[this.nr];
    if (!this.pose.length) {
      const gale = [0, 1, 2, 3].filter((i) => i !== o.riktig);
      gale.splice(Math.floor(Math.random() * 3), 1);
      this.pose.push(o.riktig, gale[0], gale[1]);
      for (let i = 2; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = this.pose[i];
        this.pose[i] = this.pose[j];
        this.pose[j] = tmp;
      }
    }
    let ledig: Flyger | null = null;
    for (const f of this.flygere) {
      if (f.status === LEDIG) {
        ledig = f;
        break;
      }
    }
    if (!ledig) return;
    const svar = this.pose.pop()!;
    const retning = this.fraVenstre ? 1 : -1;
    this.fraVenstre = !this.fraVenstre;
    ledig.status = FLYR;
    ledig.t = 0;
    ledig.x = retning > 0 ? -RADIUS : 960 + RADIUS;
    ledig.y = 330 + Math.random() * 110;
    ledig.vx = retning * (215 + Math.random() * 90);
    ledig.vy = -(300 + Math.random() * 85);
    ledig.tekst = o.svar[svar];
    ledig.skrift = this.skrifter[svar];
    ledig.farge = FARGER[this.kast++ % FARGER.length];
    ledig.riktig = svar === o.riktig;
  }

  private treff(f: Flyger) {
    if (f.riktig) {
      this.kombo++;
      this.besteKombo = Math.max(this.besteKombo, this.kombo);
      this.riktige++;
      this.poeng += 100 + 25 * Math.min(this.kombo - 1, 8);
      f.status = TRUFFET;
      f.t = 0;
      this.konfetti.kast(f.x, f.y, 16);
      this.lyd.riktig(this.kombo - 1);
      this.effekter.dunk();
      this.komboTid = 0;
      this.nesteOppgave();
    } else {
      this.kombo = 0;
      const nokkel = this.oppgaver[this.nr].nokkel;
      if (!this.bom.includes(nokkel)) this.bom.push(nokkel);
      f.status = BOMMET;
      f.t = 0;
      f.vy = 60;
      f.vx *= 0.3;
      this.lyd.feil();
    }
    this.poengTekst = `${this.poeng} poeng`;
    this.komboTekst = this.kombo >= 2 ? `Kombo ×${this.kombo}` : '';
  }

  oppdater(dt: number) {
    const s = this.signaler;
    this.t += dt;
    this.komboTid += dt;
    this.konfetti.oppdater(dt);
    this.borteTid = s.kropp.synlig ? 0 : this.borteTid + dt;

    if (this.fase === 'start') {
      let inne = false;
      for (let i = 0; i < 2; i++) {
        const h = s.hender[i];
        if (h.aktiv && Math.hypot(h.x - START_X, h.y - START_Y) < RADIUS + 24) inne = true;
      }
      this.startHoldt = Math.max(0, Math.min(1, this.startHoldt + (inne ? dt / 0.6 : -dt / 0.3)));
      const trykket = s.trykk.ny && Math.hypot(s.trykk.x - START_X, s.trykk.y - START_Y) < RADIUS + 24;
      if (this.startHoldt >= 1 || trykket || s.tast >= 0) {
        this.lyd.start();
        this.fase = 'spill';
        this.t = 0;
        this.nesteOppgave();
      }
    } else if (this.fase === 'spill') {
      this.tidIgjen -= dt;
      // Farten øker litt med komboen, slik at det blir travlere når det går bra.
      const tempo = 1 + Math.min(this.kombo, 8) * 0.04;
      this.nesteKast -= dt;
      if (this.nesteKast <= 0) {
        this.kastInn();
        this.nesteKast = 0.9 / tempo;
      }
      for (const f of this.flygere) {
        if (f.status === LEDIG) continue;
        f.t += dt;
        const fart = f.status === FLYR ? tempo : 1;
        f.vy += TYNGDE * dt * fart;
        f.x += f.vx * dt * fart;
        f.y += f.vy * dt * fart;
        if (f.status === FLYR) {
          let truffet = s.trykk.ny && Math.hypot(s.trykk.x - f.x, s.trykk.y - f.y) < RADIUS + TREFFSLAKK;
          for (let i = 0; i < 2 && !truffet; i++) {
            const h = s.hender[i];
            if (!h.aktiv) continue;
            // Hånda kan ha flyttet seg langt siden forrige bilde. Hele streken sjekkes.
            const fx = this.forrigeAktiv[i] ? this.forrigeX[i] : h.x;
            const fy = this.forrigeAktiv[i] ? this.forrigeY[i] : h.y;
            truffet = avstandTilLinje(f.x, f.y, fx, fy, h.x, h.y) < RADIUS + TREFFSLAKK;
          }
          if (truffet) this.treff(f);
          else if (f.y > 620 || f.x < -120 || f.x > 1080) f.status = LEDIG;
        } else if (f.t > (f.status === BOMMET ? 0.9 : 0.3)) {
          f.status = LEDIG;
        }
      }
      if (this.tidIgjen <= 0) {
        this.tidIgjen = 0;
        this.fase = 'slutt';
        this.t = 0;
      }
    } else if (this.t > 0.8) {
      this.ferdig = true;
    }
    for (let i = 0; i < 2; i++) {
      this.forrigeX[i] = s.hender[i].x;
      this.forrigeY[i] = s.hender[i].y;
      this.forrigeAktiv[i] = s.hender[i].aktiv ? 1 : 0;
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
        : 'Slå til riktig svar. La de gale fly forbi.';
      if (tekst !== this.starttekst) this.kort.sett(g, (this.starttekst = tekst));
      this.kort.tegn(g);
      tegnStartboble(g, START_X, START_Y, RADIUS + 10, this.startHoldt);
    } else {
      const o = this.oppgaver[this.nr];
      if (this.trengerSkrift) {
        // Skriften regnes ut én gang per spørsmål, ikke per bilde.
        for (let i = 0; i < 4; i++) this.skrifter[i] = tilpassSkrift(g, o.svar[i], RADIUS * 2 - 18, 30);
        this.trengerSkrift = false;
      }
      this.kort.sett(g, o.tekst);
      this.kort.tegn(g);
      tegnPille(g, 40, 42, 124, this.poengTekst);
      if (this.komboTekst) tegnLapp(g, 786, 36, 134, this.komboTekst, tallsprett(this.komboTid));

      for (const f of this.flygere) {
        if (f.status === LEDIG) continue;
        let r = RADIUS;
        let farge = f.farge;
        if (f.status === TRUFFET) {
          farge = FARGE.gronn;
          r *= 1 + f.t * 1.2;
          g.globalAlpha = Math.max(0, 1 - f.t / 0.3);
        } else if (f.status === BOMMET) {
          farge = FARGE.korallLys;
          g.globalAlpha = Math.max(0, 1 - f.t / 0.9);
        } else if (f.status === UTGÅTT) {
          g.globalAlpha = Math.max(0, 1 - f.t / 0.3);
        }
        papirsirkel(g, f.x, f.y, r, farge);
        g.fillStyle = FARGE.blekk;
        g.font = f.skrift || this.skrifter[0];
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(f.tekst, f.x, f.y + 2);
        g.globalAlpha = 1;
      }

      // Tidslinja nederst.
      g.fillStyle = FARGE.hvit;
      avrundet(g, 40, 518, 880, 10, 5);
      g.fill();
      const b = 880 * (this.tidIgjen / this.varighet);
      if (b > 10) {
        g.fillStyle = FARGE.blekk;
        avrundet(g, 40, 518, b, 10, 5);
        g.fill();
      }
    }
    this.konfetti.tegn(g);
    tegnHender(g, s);
    if (this.medKamera && this.fase === 'spill' && this.borteTid > 1.5) tegnHint(g, 'Vi ser deg ikke. Gå litt bakover.');
  }

  resultat(): Resultat {
    return {
      stjerner: this.riktige >= 15 ? 3 : this.riktige >= 8 ? 2 : this.riktige >= 3 ? 1 : 0,
      fliser: [
        { verdi: String(this.riktige), tekst: 'riktige' },
        { verdi: `×${this.besteKombo}`, tekst: 'beste kombo' },
        { verdi: String(this.poeng), tekst: 'poeng' },
      ],
      øvMer: this.bom.slice(0, 4),
    };
  }

  tilstand() {
    return {
      spill: 'sveip',
      fase: this.fase,
      poeng: this.poeng,
      riktige: this.riktige,
      tidIgjen: this.tidIgjen,
      bobler:
        this.fase === 'start'
          ? [{ x: START_X, y: START_Y }]
          : this.flygere.filter((f) => f.status === FLYR).map((f) => ({ x: f.x, y: f.y, tekst: f.tekst, riktig: f.riktig })),
    };
  }
}
