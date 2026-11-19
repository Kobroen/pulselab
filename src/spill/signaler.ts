// Abstrakte signaler. Spillet leser bare disse og vet ikke om de kommer fra
// kameraet, musa, fingeren eller tastaturet.

export const SCENE_B = 960;
export const SCENE_H = 540;

/** Piksler per skulderbredde i scenen. Styrer hvor langt spilleren må strekke seg. */
export const SKALA = 150;
export const SKULDER_X = 480;
export const SKULDER_Y = 330;

// Leddene følger MoveNet (0–16). I tillegg kommer to beregnede håndpunkter.
export const NESE = 0;
export const V_SKULDER = 5;
export const H_SKULDER = 6;
export const V_ALBUE = 7;
export const H_ALBUE = 8;
export const V_HANDLEDD = 9;
export const H_HANDLEDD = 10;
export const V_HOFTE = 11;
export const H_HOFTE = 12;
export const V_HAND = 17;
export const H_HAND = 18;
export const ANTALL_LEDD = 19;

export interface Hand {
  x: number;
  y: number;
  aktiv: boolean;
}

/** Kroppen som punkter i tegneflatens koordinater. Brukes bare til å tegne figuren. */
export interface Kropp {
  synlig: boolean;
  x: Float32Array;
  y: Float32Array;
  ok: Uint8Array;
  /** Piksler per skulderbredde. */
  skala: number;
}

export interface Signaler {
  hender: [Hand, Hand];
  kropp: Kropp;
  /** Direkte trykk (museklikk eller finger). `ny` settes av kilden og nullstilles av spillet. */
  trykk: { x: number; y: number; ny: boolean };
  /** Valg med talltast, 0–3. -1 betyr ingen. Nullstilles av spillet. */
  tast: number;
}

export interface Signalkilde {
  oppdater(dt: number): void;
  stopp(): void;
}

export function nyKropp(): Kropp {
  return {
    synlig: false,
    x: new Float32Array(ANTALL_LEDD),
    y: new Float32Array(ANTALL_LEDD),
    ok: new Uint8Array(ANTALL_LEDD),
    skala: SKALA,
  };
}

export function nyeSignaler(): Signaler {
  return {
    hender: [
      { x: 0, y: 0, aktiv: false },
      { x: 0, y: 0, aktiv: false },
    ],
    kropp: nyKropp(),
    trykk: { x: 0, y: 0, ny: false },
    tast: -1,
  };
}
