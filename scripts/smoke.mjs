// Røyktest: kjører testsiden i Chromium med falskt kamera og sjekker at alle
// oppsett gir måletall. Krever at `npm run build` er kjørt og at Playwright
// med Chromium er installert på maskinen.
//
//   node scripts/smoke.mjs [video.mjpeg]
//
// Uten videofil brukes Chromiums testmønster. Da finnes ingen kropp i bildet,
// men lasting og tidsmåling testes likevel.
import { createRequire } from 'node:module';
import { preview } from 'vite';

// require() finner også en globalt installert Playwright (via NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

const videoFile = process.argv[2];
const server = await preview({ preview: { port: 4173, strictPort: true } });
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
if (videoFile) args.push(`--use-file-for-fake-video-capture=${videoFile}`);

const browser = await chromium.launch({ args });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// MediaPipe skriver informasjonslinjer til feilkanalen. De er ikke feil.
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('INFO:') && errors.push(m.text()));

await page.goto('http://localhost:4173/?auto=1&dur=3');
await page.waitForFunction(() => window.__pulsResults?.length === 4, null, { timeout: 180_000 });
const results = await page.evaluate(() => window.__pulsResults);
console.log(await page.locator('#report').inputValue());
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
await browser.close();
await server.close();

const failed = results.filter((r) => r.error || !(r.trackHz > 0));
if (errors.length) console.error('Feil i konsollen:\n' + errors.join('\n'));
if (failed.length || errors.length) {
  console.error(`Røyktesten feilet for: ${failed.map((r) => r.config.id).join(', ') || 'konsollfeil'}`);
  process.exit(1);
}
console.log('\nRøyktesten er bestått: alle fire oppsett ga måletall.');
