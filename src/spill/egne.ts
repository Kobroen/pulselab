// Pugg og prøv: læreren limer inn egne spørsmål, én linje per spørsmål.
// Alt blir på enheten. Lenka som kan deles, bærer spørsmålene etter #, og den delen
// av en adresse sendes aldri til tjeneren.
import type { BankOppgave } from './bank';

const SKILLE = ['\t', ';', ' = ', ' – ', ' - ', ': '];

/** Deler en linje i spørsmål og svar ved det første skilletegnet som finnes. Flere felt blir gale svar. */
function del(linje: string): string[] {
  for (const tegn of SKILLE) {
    if (linje.includes(tegn)) return linje.split(tegn).map((d) => d.trim()).filter(Boolean);
  }
  return [];
}

function stokk<T>(liste: T[]): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/**
 * Gjør teksten om til oppgaver. Har en linje bare spørsmål og svar, lånes de gale
 * svarene fra de andre linjene, slik pugging med kort fungerer.
 */
export function tolk(tekst: string): BankOppgave[] {
  const rader = tekst.split('\n').map((l) => del(l.trim())).filter((d) => d.length >= 2);
  const alle = [...new Set(rader.map((d) => d[1]))];
  return rader.map((d, i) => {
    const egneGale = d.slice(2, 5).filter((g) => g !== d[1]);
    const lånt = stokk(alle.filter((s) => s !== d[1] && !egneGale.includes(s)));
    return { id: String(i + 1), tekst: d[0], riktig: d[1], gale: [...egneGale, ...lånt].slice(0, 3), nokkel: d[0] };
  }).filter((o) => o.gale.length >= 1);
}

/** Pakker teksten inn i en lenke til denne siden. */
export function lagLenke(tekst: string): string {
  const bytes = new TextEncoder().encode(tekst);
  let binær = '';
  for (const b of bytes) binær += String.fromCharCode(b);
  const kode = btoa(binær).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}#egne=${kode}`;
}

/** Leser spørsmål fra adressen, hvis siden ble åpnet fra en delt lenke. */
export function lesLenke(): string | null {
  const treff = /^#egne=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!treff) return null;
  try {
    const binær = atob(treff[1].replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(binær, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
