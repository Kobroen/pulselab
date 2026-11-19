// Fellesmodus: hele klassen foran én storskjerm, uten kamera. Skjermen leder
// økta, og læreren styrer med mellomrom (pause) og pil høyre (neste).
import type { Lyd } from './lyd';
import type { Oppgave } from './oppgaver';
import { type Klasseinnstillinger, type Okt, type Steg, TAKT, lagSteg } from './okter';
import { type Ovelsestype, tegnOvelsesfigur } from './ovelsesvisning';
import { type Signaler, SCENE_B } from './signaler';
import {
  type Effekter, type Resultat, type Spill,
  Konfetti, sprett, tegnBakgrunn, tegnHint, tegnPille, tegnStartboble, tegnÅs, tilpassSkrift,
} from './felles';
import { FARGE, SKRIFT, avrundet, papirkort, papirsirkel, sirkel } from './tegning';

/** Sekunder til å gjøre seg klar før en øvelse. */
const KLAR = 4;
/** Sekunder med forklaring på hvordan klassen svarer, før en økt med spørsmål. */
const INTRO = 9;
const MELLOMROM = 9;
const NESTE = 8;
const START_X = 480;
const START_Y = 318;
const START_R = 72;

// Hvert svar har sin bevegelse og sin farge.
const SVARBEVEGELSE: Ovelsestype[] = ['hopp', 'boy', 'sprell', 'boks'];
const SVARNAVN = ['Hopp', 'Knebøy', 'Sprellemann', 'Boks'];
const SVARVERB = ['hopper', 'gjør knebøy', 'spreller', 'bokser'];
const SVARFARGE = ['#c4d8ff', '#ffe9b2', '#fccfed', '#b2e8d3'];
const KORT_B = 200;
const KORT_H = 284;
const KORT_Y = 196;
const KORT_GAP = 20;
const KLARTEKST = ['Reis dere opp', 'Skyv inn stolen', 'En armlengde plass'];
const KLARFARGE = ['#c4d8ff', '#fccfed', '#b2e8d3'];

type Fase = 'start' | 'intro' | 'klar' | 'arbeid' | 'slutt';

export class Klasseokt implements Spill {
  ferdig = false;
  private steg: Steg[];
  private fase: Fase = 'start';
  private nr = 0;
  private t = 0;
  private klokke = 0;
  private pause = false;
  private tikk = -1;
  private underfase = -1;
  private gått = 0;
  private total = 0;
  private aktiv = 0;
  private sidenFasit = 9;
  private antallOvelser = 0;
  private antallSporsmal = 0;
  private ovelseNr = 0;
  private sporsmalNr = 0;
  private konfetti = new Konfetti();
  private pille = '';
  private neste = '';
  private tittelSkrift = '';
  private tittelBredde = 0;
  private linje1 = '';
  private linje2 = '';
  private svarSkrift: string[] = ['', '', '', ''];
  private fasit = '';
  private sekTekst = '';
  private sekVist = -1;
  private intro = 0;

  constructor(
    private signaler: Signaler,
    private okt: Okt,
    oppgaver: Oppgave[],
    private lyd: Lyd,
    private effekter: Effekter,
    private inn: Klasseinnstillinger,
    /** Tidsfaktor. Bare røyktesten bruker noe annet enn 1. */
    private fart = 1,
  ) {
    this.steg = lagSteg(okt, oppgaver, inn);
    for (const s of this.steg) {
      if (s.ovelse) this.antallOvelser++;
      else this.antallSporsmal++;
      this.total += s.sek + (s.ovelse ? KLAR : 0);
    }
    if (this.antallSporsmal) this.intro = INTRO;
    this.total += this.intro;
  }

  private begynn(nr: number) {
    if (nr >= this.steg.length) {
      this.fase = 'slutt';
      this.t = 0;
      return;
    }
    // Hopper læreren over et steg, følger framdriften med.
    let før = this.intro;
    for (let i = 0; i < nr; i++) før += this.steg[i].sek + (this.steg[i].ovelse ? KLAR : 0);
    this.gått = før;
    this.nr = nr;
    const s = this.steg[nr];
    this.fase = s.ovelse ? 'klar' : 'arbeid';
    this.t = 0;
    this.tikk = -1;
    this.underfase = -1;
    this.sekVist = -1;
    this.sidenFasit = 9;
    if (s.ovelse) {
      this.ovelseNr++;
      this.pille = `${this.okt.navn} · øvelse ${this.ovelseNr} av ${this.antallOvelser}`;
    } else {
      this.sporsmalNr++;
      this.pille = `${this.okt.navn} · spørsmål ${this.sporsmalNr} av ${this.antallSporsmal}`;
      this.fasit = `Riktig svar: ${s.oppgave.svar[s.oppgave.riktig]}. Alle ${SVARVERB[s.oppgave.riktig]}!`;
    }
    const n = this.steg[nr + 1];
    this.neste = !n ? 'Siste steg' : n.ovelse ? `Neste: ${n.ovelse.navn}` : 'Neste: spørsmål';
    this.tittelSkrift = '';
  }

  /** Piper de tre siste sekundene før noe skifter. */
  private nedtelling(igjen: number) {
    const hele = Math.ceil(igjen);
    if (hele !== this.tikk && hele <= 3 && hele >= 1) {
      this.tikk = hele;
      this.lyd.tikk();
    }
  }

  oppdater(dt: number) {
    const s = this.signaler;
    const trykk = s.trykk.ny || s.tast === MELLOMROM;
    const hopp = s.tast === NESTE;
    s.trykk.ny = false;
    s.tast = -1;
    this.konfetti.oppdater(dt);

    if (this.fase === 'start') {
      this.lyd.takt(0);
      this.klokke += dt;
      if (trykk || hopp) {
        if (this.intro) {
          this.fase = 'intro';
          this.t = 0;
          this.klokke = 0;
          this.pille = `${this.okt.navn} · slik svarer dere`;
        } else this.begynn(0);
      }
      return;
    }
    if (this.fase === 'slutt') {
      this.lyd.takt(0);
      this.t += dt;
      if (this.t > 0.8) this.ferdig = true;
      return;
    }
    if (hopp) {
      this.pause = false;
      this.begynn(this.fase === 'intro' ? 0 : this.nr + 1);
      return;
    }
    if (trykk) {
      this.pause = !this.pause;
      this.lyd.bryter(!this.pause);
    }
    if (this.pause) {
      this.lyd.takt(0);
      return;
    }

    dt *= this.fart;
    this.t += dt;
    this.klokke += dt;
    this.gått += dt;
    this.sidenFasit += dt;
    if (this.fase === 'intro') {
      this.lyd.takt(0);
      this.nedtelling(INTRO - this.t);
      if (this.t >= INTRO) this.begynn(0);
      return;
    }
    const steg = this.steg[this.nr];
    if (this.fase === 'klar') {
      this.lyd.takt(0);
      this.nedtelling(KLAR - this.t);
      if (this.t >= KLAR) {
        this.fase = 'arbeid';
        this.t = 0;
        // Figuren og takten starter samtidig, så de går i lag.
        this.klokke = 0;
        this.tikk = -1;
        this.lyd.start();
      }
      return;
    }
    if (steg.ovelse) {
      this.lyd.takt(TAKT[steg.ovelse.type], steg.ovelse.type === 'strekk');
      this.aktiv += dt;
      this.nedtelling(steg.sek - this.t);
    } else {
      const under = this.t < this.inn.les ? 0 : this.t < this.inn.les + this.inn.svar ? 1 : 2;
      if (under !== this.underfase) {
        this.underfase = under;
        this.tikk = -1;
        if (under === 1) this.lyd.start();
        if (under === 2) {
          this.sidenFasit = 0;
          this.lyd.riktig(4);
          this.effekter.dunk();
          this.konfetti.kast(this.kortX(steg.oppgave.riktig, steg.oppgave.svar.length) + KORT_B / 2, KORT_Y + 60, 16);
        }
      }
      this.lyd.takt(under === 1 ? 120 : 0);
      if (under >= 1) this.aktiv += dt;
      if (under === 1) this.nedtelling(this.inn.les + this.inn.svar - this.t);
    }
    if (this.t >= steg.sek) this.begynn(this.nr + 1);
  }

  private kortX(i: number, antall: number) {
    const bredde = antall * KORT_B + (antall - 1) * KORT_GAP;
    return (SCENE_B - bredde) / 2 + i * (KORT_B + KORT_GAP);
  }

  private settSek(igjen: number) {
    const hele = Math.max(0, Math.ceil(igjen));
    if (hele !== this.sekVist) {
      this.sekVist = hele;
      this.sekTekst = String(hele);
    }
  }

  tegn(g: CanvasRenderingContext2D) {
    tegnBakgrunn(g);
    if (this.fase === 'start') this.tegnStart(g);
    else if (this.fase === 'intro') this.tegnIntro(g);
    else if (this.steg[this.nr].ovelse) this.tegnOvelse(g);
    else this.tegnSporsmal(g);
    this.konfetti.tegn(g);
    if (this.fase !== 'start') {
      // Hvor langt økta er kommet.
      g.fillStyle = FARGE.hvit;
      avrundet(g, 50, 512, 860, 10, 5);
      g.fill();
      const b = 860 * Math.min(1, this.gått / this.total);
      if (b > 10) {
        g.fillStyle = FARGE.blekk;
        avrundet(g, 50, 512, b, 10, 5);
        g.fill();
      }
      tegnPille(g, 40, 20, 290, this.pille);
    }
    if (this.pause) tegnHint(g, 'Pause. Trykk mellomrom for å fortsette.');
  }

  private tegnStart(g: CanvasRenderingContext2D) {
    tegnÅs(g);
    tegnOvelsesfigur(g, 120, 480, 'strekk', this.klokke, 1.7, FARGE.korall);
    tegnOvelsesfigur(g, 840, 480, 'sprell', this.klokke, 1.7, FARGE.blaa);
    g.save();
    g.translate(480, 92);
    g.rotate(-0.02);
    papirkort(g, -250, -56, 500, 112, 16, FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 46px ${SKRIFT}`;
    g.fillText(this.okt.navn, 0, -12);
    g.font = `400 19px ${SKRIFT}`;
    g.fillStyle = FARGE.dempet;
    g.fillText(`Ca. ${this.okt.minutter} minutter · skru opp lyden`, 0, 30);
    g.restore();
    // Tre beskjeder til klassen før økta starter.
    for (let i = 0; i < 3; i++) {
      const x = 265 + i * 215;
      g.save();
      g.translate(x, 204);
      g.rotate(i === 1 ? 0.02 : -0.02);
      papirkort(g, -98, -27, 196, 54, 27, KLARFARGE[i]);
      g.fillStyle = FARGE.blekk;
      g.font = `600 18px ${SKRIFT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(KLARTEKST[i], 0, 1);
      g.restore();
    }
    tegnStartboble(g, START_X, START_Y + 22, START_R, 0);
    g.font = `400 16px ${SKRIFT}`;
    g.fillStyle = FARGE.blekk;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Trykk her eller på mellomrom når alle står klare.', 480, 446);
    g.fillStyle = FARGE.dempet;
    g.fillText('Mellomrom pauser · pil høyre hopper videre · Esc avslutter', 480, 470);
  }

  /** Forklarer regelen før første spørsmål: hvert svar har sin bevegelse. */
  private tegnIntro(g: CanvasRenderingContext2D) {
    tegnÅs(g);
    g.save();
    g.translate(430, 104);
    g.rotate(-0.012);
    papirkort(g, -350, -46, 700, 92, 14, FARGE.gul);
    g.fillStyle = FARGE.blekk;
    g.font = `600 40px ${SKRIFT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Slik svarer dere', 0, 3);
    g.restore();
    this.settSek(INTRO - this.t);
    papirsirkel(g, 874, 104, 42, FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.font = `600 40px ${SKRIFT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(this.sekTekst, 874, 107);
    g.font = `600 22px ${SKRIFT}`;
    g.fillText('Hvert svar har sin bevegelse. Gjør bevegelsen til svaret du tror er riktig.', 480, 170);
    const antall = this.inn.antallSvar;
    for (let i = 0; i < antall; i++) {
      g.save();
      g.translate(this.kortX(i, antall) + KORT_B / 2, KORT_Y + KORT_H / 2);
      g.rotate(i % 2 ? 0.012 : -0.012);
      papirkort(g, -KORT_B / 2, -KORT_H / 2, KORT_B, KORT_H, 14, FARGE.hvit);
      g.fillStyle = FARGE.dempet;
      g.font = `600 30px ${SKRIFT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`Svar ${i + 1}`, 0, -KORT_H / 2 + 40);
      sirkel(g, 0, 22, 66, SVARFARGE[i]);
      tegnOvelsesfigur(g, 0, 76, SVARBEVEGELSE[i], this.klokke, 0.95, FARGE.blekk);
      g.fillStyle = FARGE.blekk;
      g.font = `600 24px ${SKRIFT}`;
      g.fillText(SVARNAVN[i], 0, KORT_H / 2 - 26);
      g.restore();
    }
  }

  private tegnOvelse(g: CanvasRenderingContext2D) {
    const steg = this.steg[this.nr];
    const o = steg.ovelse!;
    const klar = this.fase === 'klar';
    sirkel(g, 480, 345, 160, '#ffe9b2');
    sirkel(g, 480, 345, 112, FARGE.gul);
    tegnÅs(g);
    tegnOvelsesfigur(g, 480, 488, o.type, this.klokke, 2.3, FARGE.korall);

    // Navnet skal kunne leses bakerst i klasserommet.
    if (!this.tittelSkrift) {
      this.tittelSkrift = tilpassSkrift(g, o.navn, 540, 76);
      g.font = this.tittelSkrift;
      this.tittelBredde = g.measureText(o.navn).width + 70;
    }
    g.save();
    g.translate(480, 116);
    g.rotate(-0.015);
    papirkort(g, -this.tittelBredde / 2, -52, this.tittelBredde, 104, 16, FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.font = this.tittelSkrift;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(o.navn, 0, 4);
    g.restore();

    g.save();
    g.translate(170, 282);
    g.rotate(-0.03);
    papirkort(g, -125, -48, 250, 96, 14, klar ? FARGE.gul : FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 22px ${SKRIFT}`;
    g.fillText(klar ? 'Gjør dere klare' : o.tekst, 0, klar ? 0 : -12);
    if (!klar) {
      g.font = `400 16px ${SKRIFT}`;
      g.fillStyle = FARGE.dempet;
      g.fillText('Gjør som figuren', 0, 20);
    }
    g.restore();
    tegnPille(g, 50, 440, 240, this.neste);

    this.settSek(klar ? KLAR - this.t : steg.sek - this.t);
    g.save();
    g.translate(790, 300);
    g.rotate(0.03);
    papirkort(g, -95, -85, 190, 170, 14, klar ? FARGE.gul : FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 88px ${SKRIFT}`;
    g.fillText(this.sekTekst, 0, -10);
    g.font = `400 18px ${SKRIFT}`;
    g.fillStyle = klar ? FARGE.blekk : FARGE.dempet;
    g.fillText(klar ? 'Klar?' : 'sekunder igjen', 0, 54);
    g.restore();
  }

  private tegnSporsmal(g: CanvasRenderingContext2D) {
    const steg = this.steg[this.nr];
    const o = steg.oppgave!;
    const under = this.t < this.inn.les ? 0 : this.t < this.inn.les + this.inn.svar ? 1 : 2;
    if (!this.tittelSkrift) {
      // Lange spørsmål deles på to linjer, så skriften kan være stor nok til å leses på avstand.
      this.linje1 = o.tekst;
      this.linje2 = '';
      g.font = `600 34px ${SKRIFT}`;
      if (g.measureText(o.tekst).width > 640) {
        let best = -1;
        for (let i = o.tekst.indexOf(' '); i >= 0; i = o.tekst.indexOf(' ', i + 1)) {
          if (best < 0 || Math.abs(i - o.tekst.length / 2) < Math.abs(best - o.tekst.length / 2)) best = i;
        }
        if (best > 0) {
          this.linje1 = o.tekst.slice(0, best);
          this.linje2 = o.tekst.slice(best + 1);
        }
      }
      const lengst = this.linje1.length >= this.linje2.length ? this.linje1 : this.linje2;
      this.tittelSkrift = tilpassSkrift(g, lengst, 640, this.linje2 ? 32 : 40);
      for (let i = 0; i < o.svar.length; i++) this.svarSkrift[i] = tilpassSkrift(g, o.svar[i], KORT_B - 28, 56);
    }
    tegnÅs(g);
    g.save();
    g.translate(430, 104);
    g.rotate(-0.012);
    papirkort(g, -350, -46, 700, 92, 14, FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.font = this.tittelSkrift;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (this.linje2) {
      g.fillText(this.linje1, 0, -17);
      g.fillText(this.linje2, 0, 21);
    } else g.fillText(this.linje1, 0, 3);
    g.restore();

    // Tiden som er igjen av det klassen gjør akkurat nå.
    this.settSek(under === 0 ? this.inn.les - this.t : under === 1 ? this.inn.les + this.inn.svar - this.t : steg.sek - this.t);
    papirsirkel(g, 874, 104, 42, under === 1 ? FARGE.gul : FARGE.hvit);
    g.fillStyle = FARGE.blekk;
    g.font = `600 40px ${SKRIFT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(this.sekTekst, 874, 107);

    g.font = `600 22px ${SKRIFT}`;
    g.fillText(under === 0 ? 'Tenk: hvilket svar er riktig?' : under === 1 ? 'Vis svaret med kroppen!' : this.fasit, 480, 170);

    const antall = o.svar.length;
    for (let i = 0; i < antall; i++) {
      const riktig = under === 2 && i === o.riktig;
      const x = this.kortX(i, antall);
      g.save();
      g.translate(x + KORT_B / 2, KORT_Y + KORT_H / 2);
      g.rotate(i % 2 ? 0.012 : -0.012);
      if (riktig) {
        const z = sprett(this.sidenFasit);
        g.scale(z, z);
      }
      if (under === 2 && !riktig) g.globalAlpha = 0.4;
      papirkort(g, -KORT_B / 2, -KORT_H / 2, KORT_B, KORT_H, 14, riktig ? FARGE.gronn : FARGE.hvit);
      g.fillStyle = FARGE.blekk;
      g.font = this.svarSkrift[i];
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(o.svar[i], 0, -KORT_H / 2 + 46);
      sirkel(g, 0, 22, 66, riktig ? FARGE.hvit : SVARFARGE[i]);
      // Under lesingen står figurene i ro. De viser bevegelsen når klassen skal svare.
      tegnOvelsesfigur(g, 0, 76, SVARBEVEGELSE[i], under === 0 ? 0 : this.klokke, 0.95, FARGE.blekk);
      g.fillStyle = FARGE.blekk;
      g.font = `600 20px ${SKRIFT}`;
      g.fillText(SVARNAVN[i], 0, KORT_H / 2 - 24);
      g.restore();
    }
  }

  resultat(): Resultat {
    const min = Math.floor(this.aktiv / 60);
    const sek = String(Math.floor(this.aktiv % 60)).padStart(2, '0');
    const fliser = [{ verdi: String(this.antallOvelser), tekst: 'øvelser' }];
    if (this.antallSporsmal) fliser.push({ verdi: String(this.antallSporsmal), tekst: 'spørsmål' });
    fliser.push({ verdi: `${min}:${sek}`, tekst: 'i bevegelse' });
    return { stjerner: 3, fliser, øvMer: [], aktivSek: this.aktiv };
  }

  tilstand() {
    return {
      spill: 'klasse',
      okt: this.okt.id,
      fase: this.fase,
      nr: this.nr,
      antall: this.steg.length,
      pause: this.pause,
      bobler: this.fase === 'start' ? [{ x: START_X, y: START_Y + 22 }] : [],
    };
  }
}
