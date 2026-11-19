// Stillestående papirfigur til skjermene utenfor spillet, tegnet som SVG.

type Punkt = [number, number];
type Ledd = Record<string, Punkt>;

const GRUNN: Ledd = {
  head: [0, -152], shL: [-32, -118], shR: [32, -118], hipL: [-20, -20], hipR: [20, -20],
  kneeL: [-26, 50], kneeR: [26, 50], footL: [-30, 120], footR: [30, 120],
  elL: [-58, -78], haL: [-72, -34], elR: [58, -78], haR: [72, -34],
};
const POSITURER: Record<string, Ledd> = {
  vink: { elR: [72, -140], haR: [100, -192] },
  hopp: {
    elL: [-72, -158], haL: [-88, -212], elR: [72, -158], haR: [88, -212],
    kneeL: [-36, 40], footL: [-48, 98], kneeR: [36, 40], footR: [48, 98],
  },
  staa: {},
};
const STREKER: [string, string][] = [
  ['nk', 'sc'], ['shL', 'shR'], ['shL', 'hipL'], ['shR', 'hipR'], ['hipL', 'hipR'],
  ['shL', 'elL'], ['elL', 'haL'], ['shR', 'elR'], ['elR', 'haR'],
  ['hipL', 'kneeL'], ['kneeL', 'footL'], ['hipR', 'kneeR'], ['kneeR', 'footR'],
];

export function figurSvg(positur: 'vink' | 'hopp' | 'staa'): string {
  const j: Ledd = { ...GRUNN, ...POSITURER[positur] };
  j.nk = [j.head[0], j.head[1] + 22];
  j.sc = [(j.shL[0] + j.shR[0]) / 2, j.shL[1]];
  const d = STREKER.map(([a, b]) => `M${j[a]}L${j[b]}`).join('');
  const lag = (farge: string, flytt: string) =>
    `<g${flytt} stroke="${farge}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
    `<path d="${d}"/><circle cx="${j.head[0]}" cy="${j.head[1]}" r="22" fill="${farge}"/></g>`;
  return (
    `<svg viewBox="-130 -250 280 400" aria-hidden="true">` +
    lag('rgba(30,30,30,.13)', ' transform="translate(7 7)"') +
    lag('#fa6049', '') +
    `</svg>`
  );
}
