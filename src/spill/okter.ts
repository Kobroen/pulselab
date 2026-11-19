// Ferdige økter til fellesmodus. En økt er en liste med steg: en øvelse alle gjør
// sammen, eller en bolk spørsmål som klassen svarer på med kroppen.
import type { BankOppgave, Fag, Settoppforing } from './bank';
import type { Oppgave } from './oppgaver';
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
  farge: string;
  /** Settet i oppgavebanken som spørsmålene hentes fra. */
  sett?: Settoppforing;
  /** Lærerens egne spørsmål fra Pugg og prøv. */
  oppgaver?: BankOppgave[];
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
];

export type Steg = { ovelse: Ovelse; sek: number; oppgave: null } | { ovelse: null; sek: number; oppgave: Oppgave };

/** Det læreren kan justere: tempoet i spørsmålene og hvor mange svar som vises. */
export interface Klasseinnstillinger {
  /** Sekunder til å lese, til å svare med kroppen, og til å se fasit. */
  les: number;
  svar: number;
  fasit: number;
  antallSvar: number;
}
export const TEMPO: Record<string, { navn: string; les: number; svar: number; fasit: number }> = {
  rolig: { navn: 'Rolig', les: 6, svar: 10, fasit: 5 },
  vanlig: { navn: 'Vanlig', les: 4, svar: 7, fasit: 4 },
  rask: { navn: 'Raskt', les: 3, svar: 5, fasit: 3 },
};

/** Takten for hver øvelse, i slag per minutt. Figurens bevegelse går i samme tempo. */
export const TAKT: Record<Ovelsestype, number> = { lop: 150, hopp: 120, sprell: 120, boks: 150, boy: 109, strekk: 72 };

export const FAGFARGE: Record<Fag, string> = {
  matematikk: 'blaa', norsk: 'rosa', engelsk: 'gronn', naturfag: 'oransje', samfunnsfag: 'gul', krle: 'blaalys',
};

/** En læreøkt på fem minutter rundt et sett fra oppgavebanken: tolv spørsmål og fire øvelser. */
export function laereokt(sett: Settoppforing, fagnavn: string): Okt {
  return {
    id: sett.id,
    navn: sett.tittel,
    minutter: 5,
    tekst: sett.beskrivelse,
    merke: fagnavn,
    farge: FAGFARGE[sett.fag],
    sett,
    steg: [{ ovelse: 'lop', sek: 20 }, { sporsmal: 6 }, { ovelse: 'sprell', sek: 20 }, { sporsmal: 6 }, { ovelse: 'boks', sek: 20 }, { ovelse: 'strekk', sek: 20 }],
  };
}

const LAERESTEG: Stegmal[] = [{ ovelse: 'lop', sek: 20 }, { sporsmal: 6 }, { ovelse: 'sprell', sek: 20 }, { sporsmal: 6 }, { ovelse: 'boks', sek: 20 }, { ovelse: 'strekk', sek: 20 }];

/** En læreøkt med lærerens egne spørsmål. */
export function egenokt(oppgaver: BankOppgave[]): Okt {
  return { id: 'egne', navn: 'Egne spørsmål', minutter: 5, tekst: '', merke: 'Pugg og prøv', farge: 'rosa', oppgaver, steg: LAERESTEG };
}

/** Hvor mange spørsmål økta trenger. */
export function antallSporsmal(okt: Okt): number {
  let antall = 0;
  for (const s of okt.steg) if ('sporsmal' in s) antall += s.sporsmal;
  return antall;
}

/** Gjør oppskriften om til stegene som skal spilles. */
export function lagSteg(okt: Okt, oppgaver: Oppgave[], inn: Klasseinnstillinger): Steg[] {
  const steg: Steg[] = [];
  let nr = 0;
  for (const s of okt.steg) {
    if ('ovelse' in s) steg.push({ ovelse: OVELSER[s.ovelse], sek: s.sek, oppgave: null });
    else for (let i = 0; i < s.sporsmal && nr < oppgaver.length; i++) steg.push({ ovelse: null, sek: inn.les + inn.svar + inn.fasit, oppgave: medFærreSvar(oppgaver[nr++], inn.antallSvar) });
  }
  return steg;
}

/** Beholder det riktige svaret og så mange gale som det er plass til. */
function medFærreSvar(o: Oppgave, antall: number): Oppgave {
  if (o.svar.length <= antall) return o;
  const riktig = o.svar[o.riktig];
  const svar = o.svar.filter((_, i) => i !== o.riktig).slice(0, antall - 1);
  svar.splice(Math.floor(Math.random() * (svar.length + 1)), 0, riktig);
  return { ...o, svar, riktig: svar.indexOf(riktig) };
}
