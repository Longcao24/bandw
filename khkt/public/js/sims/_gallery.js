// QA gallery: mounts every sim with sample props (public/sims-gallery.html).
const SAMPLES = [
  ['system-flow', { gesture: 'cycle', showLatency: true }],
  ['system-flow', { gesture: 'HELP', focus: 'mcu' }],
  ['imu-axes-3d', { mode: 'both', preset: 'left' }],
  ['imu-axes-3d', { tour: true }],
  ['tilt-angle', { initialDeg: -30, showFilter: true }],
  ['gyro-speed', { initialDps: 150 }],
  ['gyro-speed', { tour: true }],
  ['calibration', { tremor: 0.3 }],
  ['calibration', { tremor: 0.8 }],
  ['threshold-hysteresis', { signal: 'noisy', compareSingle: true }],
  ['threshold-hysteresis', { signal: 'slider' }],
  ['hold-timer', { preset: 'both' }],
  ['hold-timer', { preset: 'hold' }],
  ['hold-timer', { preset: 'both', gesture: 'help' }],
  ['gesture-state-machine', { scenario: 'water' }],
  ['gesture-state-machine', { scenario: 'held-no-repeat' }],
  ['gesture-state-machine', { scenario: 'shake', showCode: false }],
  ['gesture-state-machine', { scenario: 'tap' }],
  ['gesture-state-machine', { scenario: 'help' }],
  ['gesture-state-machine', { scenario: 'flick' }],
  ['shake-counter', { preset: 'good-shake' }],
  ['shake-counter', { preset: 'too-slow' }],
  ['shake-counter', { preset: 'single-jolt' }],
  ['shake-counter', { preset: 'same-direction' }],
  ['double-tap', { preset: 'double-tap' }],
  ['double-tap', { preset: 'tap-after-shake' }],
  ['double-tap', { preset: 'single-tap' }],
  ['double-tap', { preset: 'tap-while-tilted' }],
  ['double-tap', { preset: 'set-down' }],
  ['double-tap', { preset: 'table-knock' }],
  ['forward-flex', {}],
  ['forward-flex', { tour: true }],
  ['main-loop', { scenario: 'water' }],
  ['code-stepper', {
    title: 'Hàm wrap() đưa góc về −180…180', visual: 'loop',
    code: 'float wrap(float degrees) {\n  while (degrees > 180) degrees -= 360;\n  while (degrees < -180) degrees += 360;\n  return degrees;\n}',
    steps: [
      { line: 1, vars: { degrees: 560 }, note: 'Gọi wrap(560): hộp degrees nhận giá trị 560.' },
      { line: 2, vars: { degrees: 200 }, cond: { expr: '560 > 180', value: true }, note: '560 > 180 đúng → trừ 360, còn 200.' },
      { line: 2, vars: { degrees: -160 }, cond: { expr: '200 > 180', value: true }, note: 'Vẫn > 180 → trừ tiếp, còn −160.' },
      { line: 2, cond: { expr: '-160 > 180', value: false }, note: '−160 > 180 sai → thoát vòng while.' },
      { line: 3, cond: { expr: '-160 < -180', value: false }, note: 'Không nhỏ hơn −180 nên bỏ qua.' },
      { line: 4, out: 'wrap(560) = -160', note: 'Trả kết quả −160.' },
    ],
  }],
  ['code-stepper', {
    visual: 'branch', language: 'cpp',
    code: 'float gy = -120;\nint sign = gy > SHAKE_DPS ? 1\n         : gy < -SHAKE_DPS ? -1 : 0;',
    steps: [
      { line: 1, vars: { gy: -120 }, note: 'Con quay đo gy = −120 °/s.' },
      { line: 2, cond: { expr: 'gy > 100', value: false }, note: '−120 > 100? Sai, xét tiếp.' },
      { line: 3, cond: { expr: 'gy < -100', value: true }, vars: { sign: -1 }, note: '−120 < −100? Đúng → sign = −1.' },
    ],
  }],
  ['code-stepper', {
    visual: 'boxes',
    code: 'int shakePulses = 0;\nshakePulses = shakePulses + 1;\n++shakePulses;\nbool armed = false;',
    steps: [
      { line: 1, vars: { shakePulses: 0 } }, { line: 2, vars: { shakePulses: 1 } }, { line: 3, vars: { shakePulses: 2 }, out: '2' }, { line: 4, vars: { armed: false } },
    ],
  }],
  ['ble-flow', { phase: 'all', showUuids: true }],
  ['ble-flow', { phase: 'notify', command: 'HELP' }],
  ['ble-flow', { phase: 'disconnect', showBytes: false }],
  ['tts-pipeline', { command: 'WATER', showInvalid: true }],
  ['tts-pipeline', { command: 'FOOD', showQueueFlush: true }],
  ['confusion-matrix', { data: 'demo' }],
  ['imu-chart', { preset: 'all' }],
  ['imu-chart', { preset: 'no', signals: ['gy', 'mag'] }],
  ['imu-chart', { preset: 'walk' }],
  ['imu-chart', { preset: 'help-short', signals: ['pitch'] }],
  ['gesture-gallery', { highlight: 'HELP' }],
];

const list = document.getElementById('g-list');
const toc = document.getElementById('g-toc');
const handles = [];
let reduce = false;

async function mountAll() {
  handles.splice(0).forEach((h) => { try { h.destroy(); } catch {} });
  list.innerHTML = ''; toc.innerHTML = '';
  for (const [i, [id, props]] of SAMPLES.entries()) {
    const sec = document.createElement('section');
    sec.className = 'g-item'; sec.id = `s-${i}`;
    const head = document.createElement('div');
    head.innerHTML = `<h2></h2><div class="g-meta"><code></code></div>`;
    head.querySelector('code').textContent = `${id} ${JSON.stringify(props)}`;
    const box = document.createElement('div');
    const picked = document.createElement('span'); picked.className = 'g-picked';
    const hsBtn = document.createElement('button'); hsBtn.type = 'button'; hsBtn.className = 'bw-btn bw-btn--small'; hsBtn.textContent = 'Chế độ chọn vùng';
    head.querySelector('.g-meta').append(hsBtn, picked);
    sec.append(head, box); list.append(sec);
    const li = document.createElement('li'); li.innerHTML = `<a href="#s-${i}"></a>`; li.firstChild.textContent = id; toc.append(li);
    try {
      const mod = await import(`./${id}.js`);
      head.querySelector('h2').textContent = mod.meta.title;
      const ctx = { reducedMotion: reduce, speed: 1, onEvent: () => {} };
      const handle = mod.mount(box, props, ctx);
      handles.push(handle);
      let on = false; const sel = new Set();
      hsBtn.onclick = () => {
        on = !on; sel.clear(); picked.textContent = on ? 'Bấm vào một vùng…' : '';
        hsBtn.setAttribute('aria-pressed', String(on));
        box.querySelectorAll('[data-hotspot]').forEach((n) => n.classList.remove('is-selected'));
        handle.setHotspotMode(on, (hid) => {
          sel.has(hid) ? sel.delete(hid) : sel.add(hid);
          box.querySelectorAll('[data-hotspot]').forEach((n) => n.classList.toggle('is-selected', sel.has(n.getAttribute('data-hotspot'))));
          picked.textContent = `Đã chọn: ${[...sel].join(', ') || '—'}`;
        });
      };
    } catch (e) {
      const p = document.createElement('p'); p.className = 'g-err'; p.textContent = `Lỗi: ${e.stack || e}`; box.append(p);
      console.error(id, e);
    }
  }
}

document.getElementById('g-theme').onchange = (e) => {
  if (e.target.value) document.documentElement.dataset.theme = e.target.value; else delete document.documentElement.dataset.theme;
};
document.getElementById('g-motion').onchange = (e) => {
  reduce = e.target.value === 'reduce';
  document.documentElement.classList.toggle('reduce-motion', reduce);
  mountAll();
};
const params = new URLSearchParams(location.search);
if (params.get('theme')) { document.documentElement.dataset.theme = params.get('theme'); document.getElementById('g-theme').value = params.get('theme'); }
if (params.get('motion') === 'reduce') { reduce = true; document.getElementById('g-motion').value = 'reduce'; }
if (params.get('only')) {
  const only = params.get('only').split(',');
  for (let i = SAMPLES.length - 1; i >= 0; i--) if (!only.includes(SAMPLES[i][0])) SAMPLES.splice(i, 1);
}
mountAll();
