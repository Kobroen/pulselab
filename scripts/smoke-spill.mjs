// Røyktest for spillet: går gjennom skjermene i Chromium med falskt kamera,
// spiller Rekk med en innmatet kropp og Sveip med pekeren. Krever at
// `npm run build` er kjørt og at Playwright med Chromium er installert.
//
//   node scripts/smoke-spill.mjs
//
// Sett SHOTS=mappe for å lagre skjermbilder underveis.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });

const server = await preview({ preview: { port: 4174, strictPort: true } });
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (navn) => shots && (await page.screenshot({ path: `${shots}/${navn}.png` }));
const tilstand = () => page.evaluate(() => window.__puls.tilstand());
const vent = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 60_000 });

// En kropp i modellens format. Hendene plasseres ut fra hvor de skal havne i scenen.
await page.addInitScript(() => {
  window.__hand = { x: 480, y: 700 };
  window.__lagKropp = () => {
    const forhold = 4 / 3, bredde = 0.2, cx = forhold / 2, cy = 0.5;
    const p = new Array(51).fill(0);
    const sett = (i, sx, sy) => {
      p[i * 3] = 1 - (cx + ((sx - 480) / 150) * bredde) / forhold;
      p[i * 3 + 1] = cy + ((sy - 330) / 150) * bredde;
      p[i * 3 + 2] = 0.9;
    };
    const h = window.__hand;
    sett(0, 480, 235);
    sett(5, 405, 330);
    sett(6, 555, 330);
    sett(7, 380, 440);
    sett(9, 370, 560);
    // Håndpunktet ligger 35 % forbi håndleddet. Håndleddet settes slik at hånda havner på målet.
    const ax = (555 + h.x) / 2, ay = (330 + h.y) / 2 + 30;
    sett(8, ax, ay);
    sett(10, (h.x + 0.35 * ax) / 1.35, (h.y + 0.35 * ay) / 1.35);
    return p;
  };
});

await page.goto('http://localhost:4174/?antall=3&varighet=7&intervall=2&maal=1');
await page.waitForSelector('#start:not([hidden])');
await shot('1-start');
await page.click('#start-laere');
await shot('2-velg');
await page.click('[data-spill="rekk"]');
await shot('3-klar-av');
await page.click('#kamera-paa');
await vent(() => {
  const k = window.__puls.tilstand().kamera;
  return k && k.modellKlar && k.sporinger > 3;
});
console.log('Sporing i gang:', JSON.stringify((await tilstand()).kamera));
await page.evaluate(() => {
  window.__mating = setInterval(() => window.__puls.matKropp(window.__lagKropp()), 50);
});
await vent(() => window.__puls.tilstand().kamera.avstand === 'bra');
await page.waitForTimeout(400);
await shot('4-klar-paa');
await page.click('#er-klar');

// Rekk med kamera: hold hånda i startsirkelen, så i svarene. Ett svar er med vilje feil.
const hold = async (b) => {
  await page.evaluate((b) => (window.__hand = { x: b.x, y: b.y }), b);
};
const slipp = () => page.evaluate(() => (window.__hand = { x: 480, y: 700 }));
await vent(() => window.__puls.tilstand().spill?.fase === 'start');
await page.waitForTimeout(300);
await shot('5-rekk-start');
await hold((await tilstand()).spill.bobler[0]);
await vent(() => window.__puls.tilstand().spill?.fase === 'aktiv');
for (let nr = 0; nr < 3; nr++) {
  await slipp();
  await vent((nr) => {
    const s = window.__puls.tilstand().spill;
    return s && s.nr === nr && s.fase === 'aktiv';
  }, nr);
  await page.waitForTimeout(650);
  const s = (await tilstand()).spill;
  const valg = nr === 1 ? (s.riktig + 1) % 4 : s.riktig;
  await hold(s.bobler[valg]);
  await page.waitForTimeout(350);
  if (nr === 0) await shot('6-rekk-holder');
  await vent(() => window.__puls.tilstand().spill?.fase !== 'aktiv');
  await page.waitForTimeout(250);
  if (nr === 0) await shot('7-rekk-riktig');
  if (nr === 1) await shot('8-rekk-feil');
}
await page.waitForSelector('#resultat:not([hidden])', { timeout: 20_000 });
await page.waitForTimeout(1700); // stjerner og opptelling
await shot('9-resultat-rekk');
const rekk = await page.locator('#fliser').innerText();
console.log('Rekk:', rekk.replace(/\s+/g, ' '));
if (!rekk.includes('2 av 3')) errors.push(`Rekk ga uventet resultat: ${rekk}`);

// Sveip uten kamera: pekeren følger det riktige svaret.
await page.evaluate(() => clearInterval(window.__mating));
await page.click('#ferdig');
await page.click('#start-laere');
// Sveip spilles med et sett fra oppgavebanken.
await page.selectOption('#banktrinn', '5-7');
await page.selectOption('#banksett', 'samfunnsfag-5-7-europas-hovedsteder');
await page.waitForTimeout(400);
await page.click('[data-spill="sveip"]');
await page.click('#uten-kamera');
const flate = await page.locator('#scene').boundingBox();
const pek = (b) => page.mouse.move(flate.x + (b.x / 960) * flate.width, flate.y + (b.y / 540) * flate.height);
await pek((await tilstand()).spill.bobler[0]);
await vent(() => window.__puls.tilstand().spill?.fase === 'spill');
let tatt = false;
for (;;) {
  const t = await tilstand();
  if (t.skjerm !== 'spill') break;
  const mål = t.spill.bobler.find((b) => b.riktig && b.x > 60 && b.x < 900 && b.y < 500);
  if (mål) await pek(mål);
  else await pek({ x: 480, y: 530 });
  if (!tatt && t.spill.riktige >= 2 && t.spill.bobler.length >= 2) {
    await shot('10-sveip');
    tatt = true;
  }
  await page.waitForTimeout(30);
}
await page.waitForSelector('#resultat:not([hidden])');
await page.waitForTimeout(1700);
await shot('11-resultat-sveip');
const sveip = await page.locator('#fliser').innerText();
console.log('Sveip:', sveip.replace(/\s+/g, ' '));
if (!(parseInt(sveip, 10) >= 1)) errors.push(`Sveip ga ingen treff: ${sveip}`);

// Powerbreak uten kamera: mellomrom og pekeren gjør øvelsene.
await page.click('#ferdig');
await page.click('#start-power');
await page.click('#uten-kamera');
await pek((await tilstand()).spill.bobler[0]);
await vent(() => window.__puls.tilstand().spill?.fase !== 'start');
let tattPower = false;
for (let i = 0; ; i++) {
  const t = await tilstand();
  if (t.skjerm !== 'spill') break;
  if (i % 4 === 0) await page.keyboard.press('Space');
  await pek({ x: 620 + (i % 2) * 160, y: i % 6 < 3 ? 120 : 400 });
  if (!tattPower && t.spill.fase === 'arbeid' && t.spill.reps >= 3) {
    await shot('13-powerbreak');
    tattPower = true;
  }
  await page.waitForTimeout(40);
}
await page.waitForSelector('#resultat:not([hidden])');
await page.waitForTimeout(1700);
await shot('14-resultat-powerbreak');
const power = await page.locator('#fliser').innerText();
console.log('Powerbreak:', power.replace(/\s+/g, ' '));
if (!(parseInt(power, 10) >= 4)) errors.push(`Powerbreak telte for få bevegelser: ${power}`);

// Fellesmodus: læreren velger en økt, og skjermen leder klassen uten kamera.
await page.click('#ferdig');
await page.goto('http://localhost:4174/?fart=12&maal=1');
await page.click('#start-klasse');
await page.waitForTimeout(900);
await shot('15-klasse');
for (const okt of ['powerbreak', 'matematikk-5-7-gange-6-9']) {
  await page.click(`[data-okt="${okt}"]`);
  await vent(() => window.__puls.tilstand().spill?.fase === 'start');
  await shot(`16-${okt}-start`);
  await page.keyboard.press('Space');
  await vent(() => window.__puls.tilstand().spill?.fase !== 'start');
  // Pause skal stoppe økta, og mellomrom skal starte den igjen.
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const før = (await tilstand()).spill;
  await page.waitForTimeout(700);
  const etter = (await tilstand()).spill;
  if (!før.pause || etter.nr !== før.nr || etter.fase !== før.fase) errors.push(`Pause virket ikke i ${okt}`);
  await page.keyboard.press('Space');
  const sett = new Set();
  for (;;) {
    const t = await tilstand();
    if (t.skjerm !== 'spill') break;
    const merke = `${t.spill.nr}`;
    if (!sett.has(merke) && t.spill.fase === 'arbeid') {
      sett.add(merke);
      if (sett.size <= 3) await shot(`17-${okt}-steg-${t.spill.nr}`);
    }
    await page.waitForTimeout(60);
  }
  await page.waitForSelector('#resultat:not([hidden])');
  await page.waitForTimeout(1700);
  await shot(`18-${okt}-resultat`);
  const fliser = (await page.locator('#fliser').innerText()).replace(/\s+/g, ' ');
  console.log(`Klasseøkt ${okt}:`, fliser);
  if (okt !== 'powerbreak' && !/12 spørsmål/.test(fliser)) errors.push(`Klasseøkta ${okt} fikk ikke spørsmål fra oppgavebanken: ${fliser}`);
  if (!/øvelser/.test(fliser) || !/i bevegelse/.test(fliser)) errors.push(`Klasseøkta ${okt} ga ikke resultat: ${fliser}`);
  if (okt === 'powerbreak') await page.click('#bytt');
}

// Pugg og prøv: læreren limer inn egne spørsmål og kjører dem med klassen.
await page.click('#ferdig');
await page.click('#start-pugg');
await page.fill('#egnetekst', 'Hovedstaden i Norge?; Oslo\nHovedstaden i Sverige?; Stockholm\nHovedstaden i Danmark?; København\nHovedstaden i Finland?; Helsingfors\nHovedstaden i Island?; Reykjavik');
await page.waitForTimeout(700);
await shot('19-pugg');
const status = await page.locator('#egnestatus').innerText();
if (!status.startsWith('5 spørsmål')) errors.push(`Pugg og prøv tolket ikke linjene: ${status}`);
await page.click('#egne-klasse');
await vent(() => window.__puls.tilstand().spill?.fase === 'start');
await page.keyboard.press('Space');
await page.waitForSelector('#resultat:not([hidden])', { timeout: 60_000 });
await page.waitForTimeout(1200);
const egne = (await page.locator('#fliser').innerText()).replace(/\s+/g, ' ');
console.log('Egne spørsmål:', egne);
if (!/12 spørsmål/.test(egne)) errors.push(`Økta med egne spørsmål ga uventet resultat: ${egne}`);

// Smal skjerm.
await page.click('#ferdig');
await page.setViewportSize({ width: 390, height: 780 });
await shot('12-mobil-start');

await browser.close();

// Uten kamera: en nettleser som ikke har noe kamera skal få en forklaring og en tydelig vei videre.
const uten = await chromium.launch();
const side = await uten.newPage({ viewport: { width: 1280, height: 720 } });
side.on('pageerror', (e) => errors.push(String(e)));
await side.goto('http://localhost:4174/?antall=1');
await side.click('#start-laere');
await side.click('[data-spill="rekk"]');
await side.click('#kamera-paa');
await side.waitForSelector('#kamerahjelp:not([hidden])', { timeout: 20_000 });
console.log('Uten kamera:', (await side.locator('#kamerahjelp-tittel').innerText()).trim());
if (!(await side.locator('#uten-kamera').getAttribute('class')).includes('mork')) errors.push('Spill uten kamera ble ikke løftet fram da kameraet manglet');
await side.click('#uten-kamera');
await side.waitForFunction(() => window.__puls.tilstand().skjerm === 'spill');

// Opplesing: med en norsk stemme på enheten leses spørsmålene for de yngste. Stemmer som bruker nettet velges aldri.
await side.addInitScript(() => {
  window.__lest = [];
  const stemmer = [
    { name: 'Nett', lang: 'nb-NO', localService: false },
    { name: 'Lokal', lang: 'nb-NO', localService: true },
  ];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', {
    value: { getVoices: () => stemmer, addEventListener() {}, cancel() {}, speak: (y) => window.__lest.push(`${y.voice.name}: ${y.text}`) },
  });
});
await side.goto('http://localhost:4174/?fart=12');
await side.click('#start-klasse');
await side.click('#trinnvalg input[value="1-4"]', { force: true });
await side.click('[data-forslag]');
await side.waitForFunction(() => window.__puls.tilstand().spill?.fase === 'start');
await side.keyboard.press('Space');
await side.waitForSelector('#resultat:not([hidden])', { timeout: 60_000 });
const lest = await side.evaluate(() => window.__lest);
console.log(`Opplesing: ${lest.length} ytringer, for eksempel «${lest[2]}»`);
if (lest.length < 12) errors.push(`Opplesingen leste for lite: ${lest.length} ytringer`);
if (lest.some((l) => !l.startsWith('Lokal: '))) errors.push('Opplesingen brukte en stemme som ikke ligger på enheten');
await uten.close();
await server.close();
if (errors.length) {
  console.error('Røyktesten feilet:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nRøyktesten er bestått: Rekk med kamera, og Sveip og Powerbreak uten kamera, ble spilt gjennom, og tre klasseøkter gikk fra start til resultat, én av dem med egne spørsmål.');
