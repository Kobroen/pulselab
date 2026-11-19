// Oppgavebanken i innhold/. Indeksen er liten og følger med fra start. Hvert sett
// er sin egen fil og hentes først når det skal brukes.
import indeksfil from '../../innhold/nb/indeks.json';
import type { BankOppgave, Fag, Indeks, Oppgavesett, Settoppforing, Trinn } from '../../innhold/typer';
import type { Oppgave } from './oppgaver';

export type { BankOppgave, Fag, Settoppforing, Trinn };
export const INDEKS = indeksfil as unknown as Indeks;

const filer = import.meta.glob<Oppgavesett>('../../innhold/nb/*/*.json', { import: 'default' });

export async function hentSett(oppforing: Settoppforing): Promise<BankOppgave[]> {
  const last = filer[`../../innhold/nb/${oppforing.fil}`];
  if (!last) throw new Error(`Fant ikke settet ${oppforing.id}`);
  return (await last()).oppgaver;
}

function stokk<T>(liste: T[]): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/** Trekker oppgaver i tilfeldig rekkefølge og stokker svarene. Er settet for lite, går det rundt en gang til. */
export function trekk(sett: BankOppgave[], antall: number): Oppgave[] {
  const ut: Oppgave[] = [];
  while (ut.length < antall && sett.length) {
    for (const o of stokk([...sett])) {
      if (ut.length === antall) break;
      const svar = stokk([o.riktig, ...o.gale]);
      ut.push({ tekst: o.tekst, svar, riktig: svar.indexOf(o.riktig), nokkel: o.nokkel });
    }
  }
  return ut;
}
