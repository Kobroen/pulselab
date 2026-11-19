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

await page.goto('http://localhost:4174/?antall=3&varighet=7&maal=1');
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
  await page.waitForTimeout(500);
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
await shot('9-resultat-rekk');
const rekk = await page.locator('#fliser').innerText();
console.log('Rekk:', rekk.replace(/\s+/g, ' '));
if (!rekk.includes('2 av 3')) errors.push(`Rekk ga uventet resultat: ${rekk}`);

// Sveip uten kamera: pekeren følger det riktige svaret.
await page.evaluate(() => clearInterval(window.__mating));
await page.click('#ferdig');
await page.click('#start-laere');
await page.check('input[value="ordklasser"]', { force: true });
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
await shot('11-resultat-sveip');
const sveip = await page.locator('#fliser').innerText();
console.log('Sveip:', sveip.replace(/\s+/g, ' '));
if (!(parseInt(sveip, 10) >= 1)) errors.push(`Sveip ga ingen treff: ${sveip}`);

// Smal skjerm.
await page.click('#ferdig');
await page.setViewportSize({ width: 390, height: 780 });
await shot('12-mobil-start');

await browser.close();
await server.close();
if (errors.length) {
  console.error('Røyktesten feilet:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nRøyktesten er bestått: Rekk med kamera og Sveip uten kamera ble spilt gjennom.');
