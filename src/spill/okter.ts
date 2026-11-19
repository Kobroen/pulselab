// Ferdige økter til fellesmodus. En økt er en liste med steg: en øvelse alle gjør
// sammen, eller en bolk spørsmål som klassen svarer på med kroppen.
import { type Oppgave, type Tema, lagRunde } from './oppgaver';
import type { Ovelsestype } from './ovelsesvisning';

export interface Ovelse {
  type: Ovelsestype;
  navn: string;
  /** Kort beskjed til klassen, lesbar på avstand. */
  tekst: string;
}

export const OVELSER: Record<Ovelsestype, Ovelse> = {
  lop: { type: 'lop', navn: 'Løp på stedet', tekst: 'Høye knær!' },
  hopp: { type: 'hopp', navn: 'Hopp', tekst: 'Så høyt du kan' },
  sprell: { type: 'sprell', navn: 'Sprellemann', tekst: 'Armene over hodet og ned' },
  boy: { type: 'boy', navn: 'Knebøy', tekst: 'Ned i knærne og opp' },
  boks: { type: 'boks', navn: 'Boks i lufta', tekst: 'Raske slag med begge hender' },
  strekk: { type: 'strekk', navn: 'Strekk deg', tekst: 'Mot taket, og rolig til siden' },
};

/** Oppskriften på et steg: en øvelse i et antall sekunder, eller et antall spørsmål. */
type Stegmal = { ovelse: Ovelsestype; sek: number } | { sporsmal: number };

export interface Okt {
  id: string;
  navn: string;
  minutter: number;
  tekst: string;
  merke: string;
  farge: 'gul' | 'blaa' | 'rosa' | 'gronn' | 'oransje';
  tema?: Tema;
  steg: Stegmal[];
}

export const OKTER: Okt[] = [
  {
    id: 'powerbreak',
    navn: 'Powerbreak',
    minutter: 3,
    tekst: 'Seks øvelser på rad. Alle står ved pulten og gjør det figuren gjør.',
    merke: 'Bare bevegelse',
    farge: 'gul',
    steg: [
      { ovelse: 'lop', sek: 25 },
      { ovelse: 'hopp', sek: 20 },
      { ovelse: 'sprell', sek: 25 },
      { ovelse: 'boks', sek: 25 },
      { ovelse: 'boy', sek: 20 },
      { ovelse: 'strekk', sek: 25 },
    ],
  },
  {
    id: 'gange',
    navn: 'Gangetabellen',
    minutter: 5,
    tekst: 'Klassen svarer med kroppen: hvert svar har sin bevegelse. Tolv spørsmål og fire øvelser.',
    merke: 'Matematikk',
    farge: 'blaa',
    tema: 'gange',
    steg: [{ ovelse: 'lop', sek: 20 }, { sporsmal: 6 }, { ovelse: 'sprell', sek: 20 }, { sporsmal: 6 }, { ovelse: 'boks', sek: 20 }, { ovelse: 'strekk', sek: 20 }],
  },
  {
    id: 'ordklasser',
    navn: 'Ordklasser',
    minutter: 5,
    tekst: 'Verb, substantiv eller adjektiv? Klassen svarer med kroppen. Tolv spørsmål og fire øvelser.',
    merke: 'Norsk',
    farge: 'rosa',
    tema: 'ordklasser',
    steg: [{ ovelse: 'lop', sek: 20 }, { sporsmal: 6 }, { ovelse: 'sprell', sek: 20 }, { sporsmal: 6 }, { ovelse: 'boks', sek: 20 }, { ovelse: 'strekk', sek: 20 }],
  },
];

export type Steg = { ovelse: Ovelse; sek: number; oppgave: null } | { ovelse: null; sek: number; oppgave: Oppgave };

/** Sekunder per spørsmål: lese, svare med kroppen, og se fasit. */
export const LES = 4;
export const SVAR = 7;
export const FASIT = 4;

/** Gjør oppskriften om til stegene som skal spilles, med ferske spørsmål. */
export function lagSteg(okt: Okt): Steg[] {
  let antall = 0;
  for (const s of okt.steg) if ('sporsmal' in s) antall += s.sporsmal;
  const oppgaver = okt.tema ? lagRunde(okt.tema, antall) : [];
  const steg: Steg[] = [];
  let nr = 0;
  for (const s of okt.steg) {
    if ('ovelse' in s) steg.push({ ovelse: OVELSER[s.ovelse], sek: s.sek, oppgave: null });
    else for (let i = 0; i < s.sporsmal && nr < oppgaver.length; i++) steg.push({ ovelse: null, sek: LES + SVAR + FASIT, oppgave: oppgaver[nr++] });
  }
  return steg;
}
