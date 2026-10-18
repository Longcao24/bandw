#!/usr/bin/env node
// BandW narrated explainer videos.
//   node video-src/render.mjs all                  render every video in the catalogue
//   node video-src/render.mjs v-ble v-app-tts      render some
//   node video-src/render.mjs v-ble --preview 5,12 only write PNG previews (.build/<id>/preview-*.png)
//   node video-src/render.mjs all --jobs 3         parallel renders (default 2)
//   node video-src/render.mjs all --vtt-only       rewrite subtitles only (no frame capture)
// Output: khkt/public/videos/<id>.mp4 / .vtt / .jpg, plus video-src/chapters.json (chapter times for lesson writers).
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');                 // khkt/
const OUT = path.join(ROOT, 'public', 'videos');
const BUILD = path.join(HERE, '.build');
const CATALOG = ['v-system-overview', 'v-imu-tilt', 'v-calibration', 'v-gesture-state-machine', 'v-main-loop', 'v-ble', 'v-app-tts', 'v-experiment'];
const VOICE = process.env.BW_VOICE || 'Linh';
const RATE = Number(process.env.BW_RATE || 172);        // words/min for `say`; tuned for clarity
const LEAD = 1.0, GAP = 0.4, END_CARD = 2.5, FPS = 30, MAX_BYTES = 8 * 1024 * 1024;

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const preview = opt('--preview');
const vttOnly = args.includes('--vtt-only');
const jobs = Number(opt('--jobs') || 2);
let ids = args.filter((a) => !a.startsWith('--'));
if (!ids.length || ids.includes('all')) ids = CATALOG;
for (const id of ids) if (!CATALOG.includes(id)) { console.error(`Không có video "${id}". Hợp lệ: ${CATALOG.join(', ')}`); process.exit(1); }

function run(cmd, a, o = {}) {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 64 << 20, ...o });
  if (r.status !== 0) throw new Error(`${cmd} ${a.join(' ')}\n${r.stderr || r.error}`);
  return r.stdout;
}
const probeDur = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

// ---------- narration parsing ----------
function parseNarration(id) {
  const src = fs.readFileSync(path.join(HERE, 'narration', `${id}.txt`), 'utf8');
  const meta = { id, title: id, posterAt: null }; const cues = []; let cur = null;
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { const m = line.match(/^#\s*(title|poster):\s*(.+)$/); if (m) meta[m[1] === 'poster' ? 'posterAt' : 'title'] = m[2].trim(); continue; }
    if (line.startsWith('@')) { const [mark, chapter] = line.slice(1).split('|').map((s) => s.trim()); cur = { mark, chapter: chapter || null, text: '', say: '', minDur: 0 }; cues.push(cur); continue; }
    if (!cur) throw new Error(`${id}: text before first @mark`);
    if (line.startsWith('~')) cur.say += (cur.say ? ' ' : '') + line.slice(1).trim();
    else if (line.startsWith('!min')) cur.minDur = Number(line.slice(4));
    else cur.text += (cur.text ? ' ' : '') + line;
  }
  return { meta, cues };
}

// ---------- audio ----------
function buildAudio(id, cues, dir) {
  if (!run('say', ['-v', '?']).split('\n').some((l) => l.startsWith(VOICE + ' '))) throw new Error(`Thiếu giọng "${VOICE}" (System Settings → Accessibility → Spoken Content → tải giọng Linh).`);
  let t = LEAD;
  cues.forEach((c, i) => {
    const say = c.say || c.text.replace(/["“”]/g, '');
    const key = createHash('sha1').update(`${VOICE}|${RATE}|${say}`).digest('hex').slice(0, 12);
    const f = path.join(dir, `cue${String(i).padStart(2, '0')}-${key}.aiff`);
    if (!fs.existsSync(f)) {
      const txt = path.join(dir, `cue${i}.txt`); fs.writeFileSync(txt, say);
      run('say', ['-v', VOICE, '-r', String(RATE), '-o', f, '-f', txt]);
    }
    c.audio = f; c.audioDur = probeDur(f);
    c.start = +t.toFixed(3); c.slot = Math.max(c.audioDur, c.minDur) + GAP; c.end = +(t + c.slot).toFixed(3); t = c.end;
  });
  const total = t + END_CARD;
  // concat: lead silence + each cue padded to its slot + end-card silence; then loudness-normalise to -16 LUFS
  const inputs = [], filters = [];
  cues.forEach((c, i) => { inputs.push('-i', c.audio); filters.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,apad=whole_dur=${c.slot.toFixed(3)}[a${i}]`); });
  const n = cues.length;
  filters.push(`anullsrc=r=44100:cl=mono,atrim=0:${LEAD}[lead]`, `anullsrc=r=44100:cl=mono,atrim=0:${END_CARD}[tail]`);
  filters.push(`[lead]${cues.map((_, i) => `[a${i}]`).join('')}[tail]concat=n=${n + 2}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[out]`);
  const wav = path.join(dir, 'narration.wav');
  run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ac', '1', '-ar', '44100', wav]);
  return { total, wav };
}

// ---------- subtitles ----------
const vttTime = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
function wrap42(s) {
  const words = s.split(' '); const lines = []; let cur = '';
  for (const w of words) { if ((cur ? cur + ' ' + w : w).length > 42 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur); return lines;
}
function chunkSubtitle(text) {
  // one chunk per sentence; a sentence longer than 2×42 chars is split at commas/colons, then by words
  const sentences = text.split(/(?<=[.!?]["”]?)\s+(?=[\p{Lu}"“])/u).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  for (const s of sentences) {
    if (wrap42(s).length <= 2) { chunks.push(s); continue; }
    const parts = s.split(/(?<=[,:;])\s+/); let cur = '';
    for (const p of parts) { const cand = cur ? cur + ' ' + p : p; if (wrap42(cand).length <= 2) cur = cand; else { if (cur) chunks.push(cur); cur = p; } }
    if (cur) chunks.push(cur);
  }
  // last resort: split words into k balanced parts (no 1-word orphan cue)
  return chunks.flatMap((c) => {
    const k = Math.ceil(wrap42(c).length / 2); if (k <= 1) return [c];
    const words = c.split(' '), target = c.length / k, out = []; let cur = '';
    for (const w of words) { if (cur && (cur + ' ' + w).length > target && out.length < k - 1) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    out.push(cur); return out;
  });
}
function buildVtt(cues) {
  let out = 'WEBVTT\nKind: subtitles\nLanguage: vi\n\n'; let n = 1;
  for (const c of cues) {
    const chunks = chunkSubtitle(c.text); const span = Math.max(c.audioDur, c.minDur * 0.8, 1.2 * chunks.length);
    const weights = chunks.map((s) => s.length + 8); const sum = weights.reduce((a, b) => a + b, 0);
    let t = c.start;
    chunks.forEach((s, i) => {
      const d = Math.max(1.2, span * weights[i] / sum); const end = i === chunks.length - 1 ? Math.max(t + 1.2, Math.min(c.end - 0.05, c.start + span + 0.2)) : t + d;
      out += `${n++}\n${vttTime(t)} --> ${vttTime(end)}\n${wrap42(s).join('\n')}\n\n`; t = end;
    });
  }
  return out;
}

// ---------- browser ----------
function chromePath() {
  const cands = [];
  if (process.env.BW_CHROME) cands.push(process.env.BW_CHROME);
  const cache = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) cands.push(path.join(cache, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
      path.join(cache, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'), path.join(cache, d, 'chrome-linux', 'chrome'));
  }
  cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  const hit = cands.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Không tìm thấy Chromium. Đặt BW_CHROME=/đường/dẫn/chrome');
  return hit;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      if (req.url.startsWith('/favicon')) { res.writeHead(204); res.end(); return; }
      const p = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
async function loadPlaywright() {
  try { return (await import('playwright-core')).chromium; } catch {
    for (const base of [HERE, ROOT]) { const p = path.join(base, 'node_modules', 'playwright-core', 'index.mjs'); if (fs.existsSync(p)) return (await import(p)).chromium; }
    throw new Error('Thiếu playwright-core: chạy "npm install" trong khkt/ hoặc khkt/video-src/');
  }
}

async function openScene(browser, port, id, timeline, meta) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/video-src/scenes/${id}.html`);
  await page.waitForFunction(() => window.BW_SCENE, null, { timeout: 15000 }).catch(() => { throw new Error(`${id}: scene không khởi tạo được: ${errors.join(' | ')}`); });
  await page.evaluate(([tl, m]) => window.BW_SCENE.init(tl, m), [timeline, meta]);
  if (errors.length) throw new Error(`${id}: lỗi JS trong scene: ${errors.join(' | ')}`);
  return { page, errors };
}

function encode(src, wav, out, crf) {
  run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'slow',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-crf', String(crf), '-r', String(FPS), '-tune', 'animation', '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-ar', '44100', '-movflags', '+faststart', '-shortest', out]);
}

async function renderOne(browser, port, id) {
  const { meta, cues } = parseNarration(id);
  const dir = path.join(BUILD, id); fs.mkdirSync(dir, { recursive: true });
  const { total, wav } = buildAudio(id, cues, dir);
  const timeline = cues.map((c) => ({ mark: c.mark, start: c.start, end: c.end, chapter: c.chapter, text: c.text }));
  const chapters = cues.filter((c) => c.chapter).map((c) => ({ t: Math.max(0, Math.floor(c.start - 0.3)), label: c.chapter, mark: c.mark }));
  const info = { id, title: meta.title, duration: +total.toFixed(2), chapters };
  if (total < 45 || total > 120) console.warn(`⚠️  ${id}: thời lượng ${total.toFixed(1)} s nằm ngoài 45–120 s`);
  if (vttOnly) { fs.writeFileSync(path.join(OUT, `${id}.vtt`), buildVtt(cues)); console.log(`✓ ${id}: chỉ ghi lại phụ đề`); return info; }
  const { page, errors } = await openScene(browser, port, id, timeline, { title: meta.title, total });
  if (preview) {
    for (const t of preview.split(',').map(Number)) { await page.evaluate((x) => window.BW_SCENE.seek(x), t); await page.screenshot({ path: path.join(dir, `preview-${t}.png`) }); }
    console.log(`${id}: ${total.toFixed(1)} s, previews → ${dir}`); console.log(timeline.map((m) => `  ${m.start.toFixed(1).padStart(6)}  ${m.mark}`).join('\n'));
    await page.close(); return info;
  }
  // frames → near-lossless intermediate (so size retries do not need a re-capture)
  const master = path.join(dir, 'master.mkv');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-color_range', 'tv', master], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg master exit ${c}`)))));
  const frames = Math.round(total * FPS); const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((x) => window.BW_SCENE.seek(x), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 600 === 0) process.stdout.write(`  ${id}: frame ${i}/${frames}\n`);
  }
  ff.stdin.end(); await done; await page.close();
  if (errors.length) throw new Error(`${id}: lỗi JS khi dựng: ${errors.join(' | ')}`);
  const mp4 = path.join(OUT, `${id}.mp4`); let crf = 28;
  for (let tries = 0; ; tries++) {
    encode(master, wav, mp4, crf);
    if (fs.statSync(mp4).size < MAX_BYTES) break;
    if (tries >= 3) throw new Error(`${id}: tệp vẫn ≥ 8 MB ở crf ${crf}`);
    crf += 3;
  }
  fs.writeFileSync(path.join(OUT, `${id}.vtt`), buildVtt(cues));
  // poster: a frame inside the cue named by "# poster:" (default: 1.4 s into the title card)
  const pm = meta.posterAt && timeline.find((m) => m.mark === meta.posterAt);
  const pt = pm ? Math.min(pm.end - 0.2, pm.start + 1.5) : 1.4;
  const jpg = path.join(OUT, `${id}.jpg`);
  for (const q of [4, 6, 8, 11]) { run('ffmpeg', ['-y', '-v', 'error', '-ss', String(pt), '-i', master, '-frames:v', '1', '-q:v', String(q), jpg]); if (fs.statSync(jpg).size < 150 * 1024) break; }
  const size = fs.statSync(mp4).size;
  console.log(`✓ ${id}: ${total.toFixed(1)} s, ${(size / 1048576).toFixed(2)} MB (crf ${crf}), poster ${(fs.statSync(jpg).size / 1024).toFixed(0)} KB, ${frames} khung hình trong ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return { ...info, bytes: size, crf };
}

const pw = await loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const srv = await serve(); const port = srv.address().port;
const browser = await pw.launch({ executablePath: chromePath(), args: ['--font-render-hinting=none'] });
const results = []; const failures = [];
const queue = [...ids];
await Promise.all(Array.from({ length: Math.min(jobs, ids.length) }, async () => {
  while (queue.length) {
    const id = queue.shift();
    try { results.push(await renderOne(browser, port, id)); } catch (e) { failures.push(id); console.error(`✗ ${id}: ${e.message}`); }
  }
}));
await browser.close(); srv.close();
if (!preview && !vttOnly && results.length) {
  const manifestPath = path.join(HERE, 'chapters.json');
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  for (const r of results) old[r.id] = { title: r.title, duration: r.duration, chapters: r.chapters.map(({ t, label }) => ({ t, label })) };
  fs.writeFileSync(manifestPath, JSON.stringify(Object.fromEntries(CATALOG.filter((k) => old[k]).map((k) => [k, old[k]])), null, 2) + '\n');
}
if (failures.length) { console.error(`Thất bại: ${failures.join(', ')}`); process.exit(1); }
