// Regelbaserte oppgaver til demoen. Senere kommer oppgavene fra en egen oppgavemotor.

export interface Oppgave {
  /** Spørsmålet som vises på kortet. */
  tekst: string;
  svar: string[];
  riktig: number;
  /** Kort merkelapp til «Øv mer på». */
  nokkel: string;
}

export type Tema = 'gange' | 'ordklasser';

export const TEMAER: { id: Tema; navn: string }[] = [
  { id: 'gange', navn: 'Gangetabellen' },
  { id: 'ordklasser', navn: 'Ordklasser' },
];

const tilfeldig = (n: number) => Math.floor(Math.random() * n);

function stokk<T>(liste: T[]): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = tilfeldig(i + 1);
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

function gange(brukt: Set<string>): Oppgave {
  let a = 0;
  let b = 0;
  // Unngår gjentakelser så langt det går. Etter noen forsøk godtas en gjentakelse.
  for (let forsøk = 0; forsøk < 30; forsøk++) {
    a = 2 + tilfeldig(9);
    b = 2 + tilfeldig(9);
    if (!brukt.has(`${Math.min(a, b)}x${Math.max(a, b)}`)) break;
  }
  brukt.add(`${Math.min(a, b)}x${Math.max(a, b)}`);
  const p = a * b;
  // Gale svar som ligner på vanlige feil: nabo i tabellen eller ti ved siden av.
  const nære = stokk([a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b]);
  const fjerne = stokk([p + 10, p - 10, p + 2, p - 2, p + 1]);
  const gale: number[] = [];
  for (const v of [...nære, ...fjerne]) {
    if (v > 0 && v !== p && !gale.includes(v)) gale.push(v);
    if (gale.length === 3) break;
  }
  const svar = stokk([p, ...gale]);
  return { tekst: `Hva er ${a} × ${b}?`, svar: svar.map(String), riktig: svar.indexOf(p), nokkel: `${a} × ${b}` };
}

const ORD = {
  verb: ['løpe', 'hoppe', 'lese', 'synge', 'spise', 'sove', 'danse', 'skrive', 'tegne', 'svømme', 'klatre', 'le'],
  substantiv: ['hus', 'bil', 'katt', 'bok', 'stol', 'eple', 'skole', 'ball', 'vindu', 'fjell', 'sykkel', 'hund'],
  adjektiv: ['blå', 'glad', 'stor', 'rask', 'myk', 'kald', 'snill', 'lang', 'gul', 'morsom', 'sterk', 'liten'],
};
type Ordklasse = keyof typeof ORD;
const KLASSER: Ordklasse[] = ['verb', 'substantiv', 'adjektiv'];

function ordklasse(brukt: Set<string>): Oppgave {
  const klasse = KLASSER[tilfeldig(3)];
  let riktig = '';
  for (let forsøk = 0; forsøk < 30; forsøk++) {
    riktig = ORD[klasse][tilfeldig(ORD[klasse].length)];
    if (!brukt.has(riktig)) break;
  }
  brukt.add(riktig);
  const andre = KLASSER.filter((k) => k !== klasse);
  const gale = stokk([...stokk([...ORD[andre[0]]]).slice(0, 2), ...stokk([...ORD[andre[1]]]).slice(0, 2)]).slice(0, 3);
  const svar = stokk([riktig, ...gale]);
  return {
    tekst: `Hvilket ord er et ${klasse}?`,
    svar,
    riktig: svar.indexOf(riktig),
    nokkel: `${riktig} (${klasse})`,
  };
}

export function lagRunde(tema: Tema, antall = 10): Oppgave[] {
  const brukt = new Set<string>();
  const runde: Oppgave[] = [];
  for (let i = 0; i < antall; i++) runde.push(tema === 'gange' ? gange(brukt) : ordklasse(brukt));
  return runde;
}
