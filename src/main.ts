// Fase 0: måler kroppssporing på enheten. Se README for bakgrunn.
import TrackerWorker from './worker?worker';
import { CONFIGS, type Config, type FromWorker, type ToWorker } from './types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const canvas = $<HTMLCanvasElement>('scene');
const g = canvas.getContext('2d', { alpha: false })!;
const statusEl = $('status');
const rowsEl = $('rows');
const startBtn = $<HTMLButtonElement>('start');
const stopBtn = $<HTMLButtonElement>('stop');

const params = new URLSearchParams(location.search);
const MEASURE_MS = Math.max(1, Number(params.get('dur') ?? 12)) * 1000;
const BASELINE_MS = Math.min(4000, MEASURE_MS);
const WARMUP_FRAMES = 5;
const CAPTURE_W = 320;
const CAPTURE_H = 240;
const BASE = new URL('./', location.href).href;

// ---------- Sporingsarbeider ----------

class Tracker {
  private worker = new TrackerWorker();
  private pending: { resolve: (m: FromWorker) => void; reject: (e: Error) => void } | null = null;
  private nextId = 1;

  constructor() {
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const p = this.pending;
      this.pending = null;
      if (!p) return;
      if (ev.data.type === 'error') p.reject(new Error(ev.data.message));
      else p.resolve(ev.data);
    };
    this.worker.onerror = (ev) => {
      const p = this.pending;
      this.pending = null;
      p?.reject(new Error(ev.message || 'Sporingsarbeideren stoppet'));
    };
  }

  private send(msg: ToWorker, transfer: Transferable[], timeoutMs: number): Promise<FromWorker> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error('Tidsavbrudd'));
      }, timeoutMs);
      this.pending = {
        resolve: (m) => (clearTimeout(timer), resolve(m)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      };
      this.worker.postMessage(msg, transfer);
    });
  }

  async load(config: Config) {
    const m = await this.send({ type: 'load', config, base: BASE }, [], 90_000);
    if (m.type !== 'loaded') throw new Error('Uventet svar ved lasting');
    return m;
  }

  async detect(bitmap: ImageBitmap) {
    const m = await this.send({ type: 'frame', id: this.nextId++, bitmap }, [bitmap], 20_000);
    if (m.type !== 'result') throw new Error('Uventet svar ved tolkning');
    return m;
  }

  dispose() {
    this.worker.terminate();
  }
}

// ---------- Tegning ----------
// En liten, representativ scene: bevegelige former og en figur av kroppspunktene.
// Den tegnes hele tiden, slik at vi måler bildeflyten under realistisk last.

const EDGES: Record<Config['model'], [number, number][]> = {
  movenet: [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]],
  mediapipe: [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]],
};
const TORSO: Record<Config['model'], number[]> = { movenet: [5, 6, 11, 12], mediapipe: [11, 12, 23, 24] };
const UPPER: Record<Config['model'], number[]> = { movenet: [5, 6], mediapipe: [11, 12] };
const MIN_SCORE = 0.3;

const blobs = Array.from({ length: 36 }, (_, i) => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: 6 + Math.random() * 16,
  vx: (Math.random() - 0.5) * 90,
  vy: (Math.random() - 0.5) * 90,
  color: ['#5ce1c2', '#7aa8ff', '#ffcf5c', '#ff8ab4'][i % 4],
}));

let pose: { keypoints: Float32Array; model: Config['model'] } | null = null;
let frameDeltas: number[] | null = null;
let lastFrame = performance.now();

function draw(now: number) {
  const dt = now - lastFrame;
  lastFrame = now;
  frameDeltas?.push(dt);
  const s = Math.min(dt, 100) / 1000;
  const W = canvas.width;
  const H = canvas.height;

  g.fillStyle = '#0a0e17';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.55;
  for (const b of blobs) {
    b.x += b.vx * s;
    b.y += b.vy * s;
    if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
    if (b.y < b.r || b.y > H - b.r) b.vy *= -1;
    g.fillStyle = b.color;
    g.beginPath();
    g.arc(b.x, b.y, b.r, 0, 6.283);
    g.fill();
  }
  g.globalAlpha = 1;

  if (pose && pose.keypoints.length) {
    const k = pose.keypoints;
    // Kamerabildet er 4:3. Det plasseres midt i 16:9-flaten og speilvendes.
    const pw = (H * CAPTURE_W) / CAPTURE_H;
    const px = (W - pw) / 2;
    const X = (i: number) => px + (1 - k[i * 3]) * pw;
    const Y = (i: number) => k[i * 3 + 1] * H;
    g.strokeStyle = '#eef2fb';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    for (const [a, b] of EDGES[pose.model]) {
      if (k[a * 3 + 2] < MIN_SCORE || k[b * 3 + 2] < MIN_SCORE) continue;
      g.moveTo(X(a), Y(a));
      g.lineTo(X(b), Y(b));
    }
    g.stroke();
    if (k[2] >= MIN_SCORE) {
      g.fillStyle = '#eef2fb';
      g.beginPath();
      g.arc(X(0), Y(0), 16, 0, 6.283);
      g.fill();
    }
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// ---------- Måling ----------

interface Row {
  config: Config;
  error?: string;
  loadMs?: number;
  detail?: string;
  inferMedian?: number;
  inferP90?: number;
  latencyMedian?: number;
  trackHz?: number;
  fps?: number;
  jankPct?: number;
  foundPct?: number;
  upperPct?: number;
  verdict?: 'good' | 'ok' | 'bad';
}

const quantile = (values: number[], q: number) => {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nextVideoFrame(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => resolve());
    else requestAnimationFrame(() => resolve());
  });
}

function frameStats(deltas: number[], refreshMs: number) {
  const total = deltas.reduce((a, b) => a + b, 0);
  const fps = deltas.length ? (deltas.length * 1000) / total : NaN;
  // Hakk: bilder som brukte mer enn halvannen gang normal bildetid.
  const jank = deltas.filter((d) => d > refreshMs * 1.5).length;
  return { fps, jankPct: deltas.length ? (jank / deltas.length) * 100 : NaN };
}

let stopRequested = false;
let baseline: { fps: number; refreshMs: number } | null = null;

async function measureBaseline() {
  setStatus('Måler bildeflyt uten sporing …');
  frameDeltas = [];
  await sleep(BASELINE_MS);
  const deltas = frameDeltas.slice(2);
  frameDeltas = null;
  const refreshMs = quantile(deltas, 0.5) || 16.7;
  baseline = { fps: frameStats(deltas, refreshMs).fps, refreshMs };
}

async function runConfig(config: Config, durationMs: number): Promise<Row> {
  const row: Row = { config };
  const tracker = new Tracker();
  try {
    setStatus(`${config.label}: laster modellen …`);
    const loaded = await tracker.load(config);
    row.loadMs = loaded.ms;
    row.detail = loaded.detail;

    const capture = () =>
      createImageBitmap(video, { resizeWidth: CAPTURE_W, resizeHeight: CAPTURE_H, resizeQuality: 'low' });

    for (let i = 0; i < WARMUP_FRAMES; i++) {
      await nextVideoFrame();
      const r = await tracker.detect(await capture());
      pose = { keypoints: r.keypoints, model: config.model };
    }

    const infer: number[] = [];
    const latency: number[] = [];
    let found = 0;
    let upper = 0;
    const has = (k: Float32Array, idx: number[]) =>
      k.length > 0 && idx.every((i) => k[i * 3 + 2] >= MIN_SCORE);

    frameDeltas = [];
    const t0 = performance.now();
    const live = !isFinite(durationMs);
    setStatus(live ? `${config.label}: kjører. Trykk Stopp for å avslutte.` : `${config.label}: måler …`);
    while (!stopRequested && performance.now() - t0 < durationMs) {
      await nextVideoFrame();
      const tCapture = performance.now();
      const r = await tracker.detect(await capture());
      latency.push(performance.now() - tCapture);
      infer.push(r.inferMs);
      if (has(r.keypoints, TORSO[config.model])) found++;
      if (has(r.keypoints, UPPER[config.model])) upper++;
      pose = { keypoints: r.keypoints, model: config.model };
      if (live && infer.length % 15 === 0) {
        const hz = (infer.length * 1000) / (performance.now() - t0);
        setStatus(`${config.label}: ${hz.toFixed(0)} sporinger per sekund, ${quantile(latency.slice(-30), 0.5).toFixed(0)} ms forsinkelse. Trykk Stopp for å avslutte.`);
      }
    }
    const elapsed = performance.now() - t0;
    const deltas = frameDeltas.slice(2);
    frameDeltas = null;

    const fs = frameStats(deltas, baseline?.refreshMs ?? 16.7);
    row.inferMedian = quantile(infer, 0.5);
    row.inferP90 = quantile(infer, 0.9);
    row.latencyMedian = quantile(latency, 0.5);
    row.trackHz = (infer.length * 1000) / elapsed;
    row.fps = fs.fps;
    row.jankPct = fs.jankPct;
    row.foundPct = infer.length ? (found / infer.length) * 100 : 0;
    row.upperPct = infer.length ? (upper / infer.length) * 100 : 0;
    const fpsOk = baseline ? row.fps >= baseline.fps * 0.85 : true;
    row.verdict = row.trackHz >= 15 && fpsOk ? 'good' : row.trackHz >= 8 ? 'ok' : 'bad';
  } catch (e) {
    row.error = e instanceof Error ? e.message : String(e);
    row.verdict = 'bad';
  } finally {
    frameDeltas = null;
    tracker.dispose();
    pose = null;
  }
  return row;
}

// ---------- Visning ----------

const VERDICT = { good: 'Bra', ok: 'Brukbart', bad: 'For tregt' } as const;
const n = (v: number | undefined, d = 0) => (v === undefined || isNaN(v) ? '–' : v.toFixed(d));
const setStatus = (text: string) => (statusEl.textContent = text);
const results: Row[] = [];

function renderRow(row: Row) {
  let tr = document.getElementById(`row-${row.config.id}`);
  if (!tr) {
    tr = document.createElement('tr');
    tr.id = `row-${row.config.id}`;
    rowsEl.appendChild(tr);
  }
  tr.textContent = '';
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = row.config.label;
  tr.appendChild(th);
  const cell = (text: string, sub?: string, cls?: string) => {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      td.appendChild(s);
    }
    tr!.appendChild(td);
    return td;
  };
  if (row.error) {
    const td = cell('Virker ikke på denne enheten', row.error, 'bad');
    td.colSpan = 8;
  } else if (row.verdict === undefined) {
    const td = cell('Venter …');
    td.colSpan = 8;
  } else {
    cell(`${n((row.loadMs ?? NaN) / 1000, 1)} s`);
    cell(`${n(row.inferMedian)} ms`, `verste tidel ${n(row.inferP90)} ms`);
    cell(`${n(row.latencyMedian)} ms`);
    cell(n(row.trackHz, 1));
    cell(`${n(row.fps)} bilder/s`);
    cell(`${n(row.jankPct, 1)} %`);
    cell(`${n(row.foundPct)} %`, `overkropp ${n(row.upperPct)} %`);
    cell(VERDICT[row.verdict], undefined, row.verdict);
  }
  const td = document.createElement('td');
  if (!row.error && row.verdict !== undefined) {
    const btn = document.createElement('button');
    btn.textContent = 'Prøv';
    btn.setAttribute('aria-label', `Prøv ${row.config.label}`);
    btn.addEventListener('click', () => runLive(row.config));
    td.appendChild(btn);
  }
  tr.appendChild(td);
}

function webglRenderer(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'ikke tilgjengelig';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return 'ukjent';
  }
}

function buildReport(): string {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0]?.getSettings();
  const lines = [
    'Learnlab Puls – sporingstest',
    `Tidspunkt: ${new Date().toISOString()}`,
    `Nettleser: ${navigator.userAgent}`,
    `Prosessortråder: ${navigator.hardwareConcurrency ?? 'ukjent'}, minne: ${nav.deviceMemory ?? 'ukjent'} GB`,
    `Grafikk: ${webglRenderer()}`,
    `Skjerm: ${screen.width}x${screen.height}, piksltetthet ${devicePixelRatio}`,
    `Kamera: ${track?.width ?? '?'}x${track?.height ?? '?'} ved ${n(track?.frameRate)} bilder/s`,
    `Bildeflyt uten sporing: ${n(baseline?.fps)} bilder/s`,
    `Måletid per oppsett: ${MEASURE_MS / 1000} s`,
    '',
  ];
  for (const r of results) {
    lines.push(
      r.error
        ? `${r.config.id}: FEIL – ${r.error}`
        : `${r.config.id}: lasting ${n((r.loadMs ?? NaN) / 1000, 1)} s | tolkning ${n(r.inferMedian)} ms (p90 ${n(r.inferP90)}) | forsinkelse ${n(r.latencyMedian)} ms | sporing ${n(r.trackHz, 1)}/s | bildeflyt ${n(r.fps)}/s | hakk ${n(r.jankPct, 1)} % | kropp ${n(r.foundPct)} % | overkropp ${n(r.upperPct)} % | ${r.detail}`,
    );
  }
  return lines.join('\n');
}

function renderSummary() {
  const working = results.filter((r) => !r.error);
  const best = [...working].sort((a, b) => (b.trackHz ?? 0) - (a.trackHz ?? 0))[0];
  const summary = $('summary');
  if (!best) summary.textContent = 'Ingen av oppsettene virket på denne enheten. Kopier rapporten under, så ser vi på feilen.';
  else if (best.verdict === 'bad') summary.textContent = `Raskeste oppsett var ${best.config.label} med ${n(best.trackHz, 1)} sporinger per sekund. Det er for tregt for helkroppsspill på denne enheten.`;
  else summary.textContent = `Raskeste oppsett var ${best.config.label} med ${n(best.trackHz, 1)} sporinger per sekund og ${n(best.latencyMedian)} ms forsinkelse. Trykk Prøv for å kjenne hvordan det føles.`;
  $<HTMLTextAreaElement>('report').value = buildReport();
  $('reportSection').hidden = false;
}

// ---------- Flyt ----------

async function ensureCamera() {
  if (video.srcObject) return;
  setStatus('Ber om tilgang til kameraet …');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: { ideal: CAPTURE_W }, height: { ideal: CAPTURE_H }, frameRate: { ideal: 30 }, facingMode: 'user' },
  });
  video.srcObject = stream;
  await video.play();
}

function setBusy(busy: boolean) {
  startBtn.disabled = busy;
  stopBtn.hidden = !busy;
  rowsEl.querySelectorAll('button').forEach((b) => (b.disabled = busy));
}

async function runAll() {
  stopRequested = false;
  setBusy(true);
  try {
    await ensureCamera();
    results.length = 0;
    rowsEl.textContent = '';
    for (const c of CONFIGS) renderRow({ config: c });
    await measureBaseline();
    for (const config of CONFIGS) {
      if (stopRequested) break;
      const row = await runConfig(config, MEASURE_MS);
      results.push(row);
      renderRow(row);
      await sleep(400);
    }
    renderSummary();
    setStatus(stopRequested ? 'Testen ble stoppet.' : 'Testen er ferdig.');
    (window as unknown as { __pulsResults?: Row[] }).__pulsResults = results;
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    setStatus(
      name === 'NotAllowedError'
        ? 'Kameraet er blokkert. Gi siden tilgang til kameraet i nettleseren, og prøv igjen.'
        : name === 'NotFoundError'
          ? 'Fant ikke noe kamera på denne enheten.'
          : `Noe gikk galt: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    setBusy(false);
  }
}

async function runLive(config: Config) {
  stopRequested = false;
  setBusy(true);
  try {
    await ensureCamera();
    const row = await runConfig(config, Infinity);
    setStatus(row.error ? `Noe gikk galt: ${row.error}` : 'Stoppet.');
  } finally {
    setBusy(false);
  }
}

startBtn.addEventListener('click', runAll);
stopBtn.addEventListener('click', () => (stopRequested = true));
$<HTMLInputElement>('showVideo').addEventListener('change', (e) =>
  video.classList.toggle('visible', (e.target as HTMLInputElement).checked),
);
$('copy').addEventListener('click', async () => {
  const ta = $<HTMLTextAreaElement>('report');
  try {
    await navigator.clipboard.writeText(ta.value);
    $('copied').textContent = 'Kopiert.';
  } catch {
    ta.select();
    $('copied').textContent = 'Merk teksten og kopier den selv.';
  }
});
// Kameraet slås av når fanen skjules.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopRequested = true;
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
});

if (params.get('auto') === '1') runAll();
