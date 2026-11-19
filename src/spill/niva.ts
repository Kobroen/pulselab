// Aldersnivåer: samme motor i tre drakter. Nivået følger valgt trinn og kan
// overstyres av læreren. Det styrer uttrykk, tekst og tall, ikke spillereglene.
export type Niva = 'liten' | 'mellom' | 'voksen';

export interface Nivavalg {
  navn: string;
  /** Svar per spørsmål i fellesmodus. */
  svar: number;
  /** Tempoet som passer best, se TEMPO i okter.ts. */
  tempo: string;
  /** Sekunder hånda må holdes i svaret i Rekk. */
  holdetid: number;
}

export const NIVAER: Record<Niva, Nivavalg> = {
  liten: { navn: 'Småskole', svar: 3, tempo: 'rolig', holdetid: 0.7 },
  mellom: { navn: 'Mellomtrinn og ungdom', svar: 4, tempo: 'vanlig', holdetid: 0.5 },
  voksen: { navn: 'Voksen', svar: 4, tempo: 'vanlig', holdetid: 0.5 },
};

export function nivaForTrinn(trinn: string): Niva {
  return trinn === '1-4' ? 'liten' : trinn === 'vgs' ? 'voksen' : 'mellom';
}
