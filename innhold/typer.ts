// Typer for oppgavebanken i innhold/. Se innhold/LESMEG.md.

export type Fag = 'matematikk' | 'norsk' | 'engelsk' | 'naturfag' | 'samfunnsfag' | 'krle';
export type Trinn = '1-4' | '5-7' | '8-10' | 'vgs';
export type Sprak = 'nb' | 'nn' | 'en';

export interface BankOppgave {
  /** Fast innenfor settet. Brukes til å koble samme oppgave på tvers av språk. */
  id: string;
  /** Spørsmålet. Maks 60 tegn. */
  tekst: string;
  /** Riktig svar. Maks 14 tegn. */
  riktig: string;
  /** 1 til 3 gale svar, nesten alltid 3. Spillet stokker rekkefølgen selv. */
  gale: string[];
  /** Kort merkelapp til «Øv mer på». */
  nokkel: string;
}

export interface Oppgavesett {
  id: string;
  versjon: 1;
  sprak: Sprak;
  fag: Fag;
  trinn: Trinn;
  tittel: string;
  beskrivelse: string;
  /** Hvor i LK20 settet hører hjemme: læreplankode, trinn og tema med egne ord. Ikke sitat fra læreplanen. */
  lk20: string[];
  oppgaver: BankOppgave[];
}

/** En linje i indeks.json: alt menyen trenger uten å laste selve oppgavene. */
export interface Settoppforing {
  id: string;
  fag: Fag;
  trinn: Trinn;
  tittel: string;
  beskrivelse: string;
  antall: number;
  /** Sti til settet, regnet fra språkmappa, for eksempel «matematikk/matematikk-1-4-pluss-til-20.json». */
  fil: string;
}

export interface Indeks {
  versjon: 1;
  sprak: Sprak;
  fag: { id: Fag; navn: string }[];
  trinn: { id: Trinn; navn: string }[];
  /** Sortert etter trinn, så fag, så id. */
  sett: Settoppforing[];
}
