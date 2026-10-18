// double-tap: two sharp spikes seen by the IMU (416 Hz); the chip latches a "double tap" flag;
// firmware accepts it only from rest with no arm movement (> 50 °/s for 2 samples) in the previous 300 ms, confirmed after 150 ms.
import { frame, s, h, attr, fmt, clamp, lerp, easeOut, Timeline, timelineHandle } from './_shared.js';
import { makeSignal, runTrace, rowAt, findRow, C, COMMANDS } from './_model.js';

export const meta = {
  id: 'double-tap',
  title: 'Gõ 2 lần = Có',
  timeline: true,
  checkpoints: ['tap1', 'tap2', 'flag', 'confirm', 'emit', 'rejected', 'end'],
  hotspots: [{ id: 'spike1', label: 'Cú gõ thứ nhất' }, { id: 'spike2', label: 'Cú gõ thứ hai' }, { id: 'chip-flag', label: 'Cờ gõ đôi trên chip IMU' }, { id: 'confirm-bar', label: 'Thanh xác nhận 150 ms' }],
  defaults: { preset: 'double-tap', confirmMs: 150, quietBeforeMs: 300 },
};

const PRESET = {
  'double-tap': { segs: [{ hold: 840 }, { tap: true }, { hold: 1100 }], taps: 2, name: 'Gõ 2 lần khi tay đang yên' },
  'single-tap': { segs: [{ hold: 840 }, { hold: 1100 }], taps: 1, name: 'Chỉ gõ 1 lần' },
  'tap-after-shake': { segs: [{ hold: 700 }, { gy: 150, n: 2 }, { hold: 100 }, { tap: true }, { hold: 900 }], taps: 2, name: 'Vừa xoay nhanh xong thì gõ 2 lần' },
  'tap-while-tilted': { segs: [{ hold: 400 }, { move: 300, roll: 18 }, { hold: 560 }, { tap: true }, { hold: 900 }], taps: 2, name: 'Gõ 2 lần khi tay đang nghiêng 18°' },
  // gesture_test.cpp "setDown": 10 samples at 60 °/s (> TAP_STILL_DPS) right before the impact flag.
  'set-down': { segs: [{ hold: 640 }, { gy: 60, n: 10, tag: 'set-down' }, { tap: true }, { hold: 900 }], taps: 2, name: 'Hạ tay đặt xuống bàn (cú chạm giống gõ đôi)' },
  // Known limitation: the arm lies still and someone knocks twice on the table → the chip sees a double tap.
  'table-knock': { segs: [{ hold: 840 }, { tap: true }, { hold: 1100 }], taps: 2, name: 'Tay nằm yên, có người gõ 2 lần lên bàn', note: 'Giới hạn đã biết: tay nằm yên mà có 2 cú gõ lên bàn thì trông giống hệt gõ đôi, nên vẫn ra "Có". Nhóm nêu rõ điều này khi phản biện.' },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const pr = PRESET[P.preset] || PRESET['double-tap'];
  const tr = runTrace(makeSignal(pr.segs, { seed: 5 }));
  const rows = tr.rows;
  const flagI = findRow(rows, (r) => r.tap);
  const flagT = flagI >= 0 ? rows[flagI].t : tr.t0 + 860;
  const tap2T = flagT - 14, tap1T = flagT - 260; // the chip sees the shocks between samples (416 Hz)
  const tapsT = pr.taps === 2 ? [tap1T, tap2T] : [tap1T + 10];
  const emitI = findRow(rows, (r) => r.event);
  const accepted = flagI >= 0 && rows[flagI].tapPending;
  const reason = flagI < 0 ? 'nocount' : !rows[flagI].rest ? 'tilt' : !accepted ? 'rotate' : 'ok';

  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[420, 300], [220, 300]],
    alt: `${pr.name}. Đồ thị gia tốc có ${pr.taps} đỉnh nhọn. Chip IMU tự phát hiện gõ đôi (2 cú cách nhau ≤ 538 ms) và bật cờ; firmware kiểm tra tay đang yên, 300 ms trước tay không cử động (con quay không vượt 50 °/s trong 2 mẫu liền), rồi chờ 150 ms mới xác nhận YES.`,
  });
  const [A, B] = f.svgs;
  const T0 = tr.t0, T1 = tr.t1;
  const X0 = 46, X1 = 410;
  const tx = (t) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
  // accel shock lane
  const AY0 = 40, AY1 = 180;
  const ay = (v) => AY1 - (clamp(v, 0, 1.6) / 1.6) * (AY1 - AY0);
  const GY0 = 200, GY1 = 270;
  const gyv = (v) => GY1 - (clamp(Math.abs(v), 0, 200) / 200) * (GY1 - GY0);
  A.append(s('text', { x: X0, y: 24, 'font-size': 15, 'font-weight': 700 }, pr.name));
  A.append(s('rect', { x: X0, y: AY0, width: X1 - X0, height: AY1 - AY0, class: 'panel-bg' }));
  A.append(s('rect', { x: X0, y: GY0, width: X1 - X0, height: GY1 - GY0, class: 'panel-bg' }));
  A.append(s('line', { x1: X0, x2: X1, y1: ay(0.75), y2: ay(0.75), class: 'line-enter' }));
  A.append(s('text', { x: X1 - 4, y: ay(0.75) - 5, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, 'ngưỡng gõ 0,75 g'));
  A.append(s('text', { x: X0 - 6, y: AY0 + 12, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, 'cú'));
  A.append(s('text', { x: X0 - 6, y: AY0 + 26, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, 'sốc'));
  A.append(s('line', { x1: X0, x2: X1, y1: gyv(50), y2: gyv(50), class: 'line-enter' }));
  A.append(s('text', { x: X1 - 4, y: gyv(50) - 4, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, 'cử động 50 °/s'));
  A.append(s('text', { x: X0 - 6, y: GY0 + 18, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, '|gy|'));
  A.append(s('text', { x: X0, y: 292, 'font-size': 12, class: 't-muted' }, 'Chip IMU đo 416 lần/giây; firmware đọc cờ mỗi 20 ms.'));
  // high-rate shock curve
  const shock = (t) => tapsT.reduce((acc, ts) => { const d = t - ts; return acc + (d >= 0 ? 1.25 * Math.exp(-d / 6) * Math.abs(Math.cos(d / 3)) : 0); }, 0) + 0.04 * Math.abs(Math.sin(t * 0.37));
  const hiRes = []; for (let t = T0; t <= T1; t += 2.4) hiRes.push([tx(t), ay(shock(t)), t]);
  const ghostA = s('polyline', { points: hiRes.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 1.5 });
  const quiet = s('rect', { y: AY0, height: GY1 - AY0, opacity: 0 });
  const quietLbl = s('text', { 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle', opacity: 0 });
  const confirm = s('rect', { y: AY0, height: GY1 - AY0, fill: 'var(--c-primary)', opacity: 0 });
  A.append(quiet, quietLbl, confirm, ghostA);
  const liveA = s('polyline', { fill: 'none', stroke: 'var(--viz-z)', 'stroke-width': 2.5 });
  const ghostG = s('polyline', { points: rows.map((r) => `${tx(r.t).toFixed(1)},${gyv(r.gy).toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 1.5 });
  const liveG = s('polyline', { fill: 'none', stroke: 'var(--viz-y)', 'stroke-width': 2.5 });
  const cursor = s('line', { y1: AY0, y2: GY1, stroke: 'var(--c-text)', 'stroke-width': 1.5 });
  A.append(liveA, ghostG, liveG, cursor);
  const spikes = tapsT.map((t, k) => {
    const g = s('g', { 'data-hotspot': `spike${k + 1}`, 'data-label': k ? 'Cú gõ thứ hai' : 'Cú gõ thứ nhất', opacity: 0 },
      s('circle', { cx: tx(t + 2), cy: ay(1.3), r: 16, fill: 'none', stroke: 'var(--c-primary)', 'stroke-width': 2.5 }),
      s('text', { x: tx(t + 2), y: ay(1.3) - 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--c-primary)' }, `gõ ${k + 1}`));
    A.append(g); return g;
  });
  let gapLbl = null;
  if (pr.taps === 2) {
    gapLbl = s('g', { opacity: 0 }, s('line', { x1: tx(tap1T), x2: tx(tap2T), y1: AY1 - 8, y2: AY1 - 8, stroke: 'var(--c-text)', 'stroke-width': 1.5 }),
      s('text', { x: (tx(tap1T) + tx(tap2T)) / 2, y: AY1 - 14, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600 }, `${Math.round(tap2T - tap1T)} ms ≤ 538 ms`));
    A.append(gapLbl);
  }

  // right pane: chip + checklist + verdict
  const chip = s('g', { 'data-hotspot': 'chip-flag', 'data-label': 'Cờ gõ đôi trên chip IMU' });
  chip.append(s('rect', { x: 40, y: 16, width: 140, height: 84, rx: 10, fill: '#2b303b', stroke: '#11141a', 'stroke-width': 2 }));
  for (let k = 0; k < 6; k++) { chip.append(s('rect', { x: 50 + k * 22, y: 8, width: 8, height: 8, fill: '#9aa1ad' })); chip.append(s('rect', { x: 50 + k * 22, y: 100, width: 8, height: 8, fill: '#9aa1ad' })); }
  chip.append(s('text', { x: 110, y: 44, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: '#fff' }, 'LSM6DS3'));
  chip.append(s('text', { x: 110, y: 62, 'text-anchor': 'middle', 'font-size': 11, fill: '#c9ccd3', class: 'bw-mono' }, 'TAP_SRC 0x1C'));
  const flagBox = s('rect', { x: 72, y: 70, width: 76, height: 22, rx: 5, fill: '#444b59' });
  const flagTxt = s('text', { x: 110, y: 86, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: '#c9ccd3', class: 'bw-mono' }, 'bit 0x10');
  chip.append(flagBox, flagTxt);
  B.append(chip);
  const checks = ['Tay ở trung tính', '300 ms trước: tay yên', 'Chờ 150 ms: vẫn yên'].map((t, k) => {
    const y = 132 + k * 34;
    const ic = s('text', { x: 18, y, 'font-size': 18, 'font-weight': 700 }, '·');
    const tt = s('text', { x: 38, y, 'font-size': 13 }, t);
    B.append(ic, tt); return { ic, tt };
  });
  const cbG = s('g', { 'data-hotspot': 'confirm-bar', 'data-label': 'Thanh xác nhận 150 ms' });
  cbG.append(s('rect', { x: 40, y: 206, width: 160, height: 10, rx: 5, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)' }));
  const cbFill = s('rect', { x: 40, y: 206, height: 10, rx: 5, fill: 'var(--c-primary)', width: 0 });
  cbG.append(cbFill); B.append(cbG);
  const vG = s('g', { opacity: 0 });
  const vR = s('rect', { x: 20, y: 240, width: 180, height: 40, rx: 20, stroke: 'rgba(0,0,0,.15)' });
  const vT = s('text', { x: 110, y: 266, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 });
  vG.append(vR, vT); B.append(vG);

  // beats
  const beats = [];
  let t0 = T0;
  const add = (id, t1, caption, dur) => { beats.push({ id, t0, t1, caption, dur: dur || clamp((t1 - t0) * 2.6, 1000, 4000) }); t0 = t1; };
  add('tap1', tapsT[0] + 30, 'Cú gõ thứ nhất: gia tốc nhảy vọt trong vài mili giây.');
  if (pr.taps === 2) {
    add('tap2', tap2T + 10, `Cú gõ thứ hai sau ${Math.round(tap2T - tap1T)} ms (chip cho phép tối đa 538 ms).`);
    add('flag', flagT, 'Chip IMU tự nhận ra "gõ đôi" và bật cờ; firmware đọc thanh ghi 0x1C ở mẫu tiếp theo.');
    if (reason === 'ok') {
      add('confirm', flagT + C.TAP_CONFIRM_MS, 'Tay đang yên, 300 ms trước không cử động → chờ thêm 150 ms để chắc chắn.');
      add('emit', rows[emitI].t + 300, 'Vẫn yên sau 150 ms → emit(Gesture::Yes): gửi "YES", điện thoại nói "Có."', 1500);
    } else {
      add('rejected', flagT + 400, reason === 'tilt' ? 'Cờ gõ đôi bị bỏ qua vì tay đang nghiêng (chưa ở trung tính).' : 'Cờ gõ đôi bị bỏ qua: trong 300 ms trước tay cử động (> 50 °/s, 2 mẫu liền), có thể là vừa đặt tay xuống hay đang lắc.', 1600);
    }
  } else {
    add('rejected', tapsT[0] + 560, 'Qua 538 ms không có cú thứ hai: chip không bật cờ gõ đôi, không có gì xảy ra.', 1800);
  }
  beats.push({ id: 'end', t0, t1: T1, dur: clamp((T1 - t0) * 1.2, 400, 1800), caption: pr.note || (reason === 'ok' ? 'Gõ đôi chỉ được tính khi tay yên: rung lắc hay đặt tay xuống không thành "Có".' : 'Không phát lệnh nào.') });

  const render = ({ beat, t01 }) => {
    const simT = lerp(beat.t0, beat.t1, t01);
    const i = rowAt(rows, simT), r = rows[i];
    liveA.setAttribute('points', hiRes.filter((p) => p[2] <= simT).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
    liveG.setAttribute('points', rows.slice(0, i + 1).map((q) => `${tx(q.t).toFixed(1)},${gyv(q.gy).toFixed(1)}`).join(' '));
    attr(cursor, { x1: tx(simT), x2: tx(simT) });
    spikes.forEach((g, k) => g.setAttribute('opacity', simT >= tapsT[k] ? 1 : 0));
    gapLbl?.setAttribute('opacity', simT >= tap2T ? 1 : 0);
    const flagOn = flagI >= 0 && simT >= tap2T;
    attr(flagBox, { fill: flagOn ? '#f2a900' : '#444b59' });
    attr(flagTxt, { fill: flagOn ? '#21242c' : '#c9ccd3' });
    flagTxt.textContent = flagOn ? 'GÕ ĐÔI ✓' : 'bit 0x10';
    const read = flagI >= 0 && simT >= flagT;
    attr(quiet, { x: tx(flagT - 300), width: tx(flagT) - tx(flagT - 300), opacity: read ? 0.14 : 0, fill: reason === 'rotate' ? 'var(--c-danger)' : 'var(--c-success)' });
    attr(quietLbl, { x: (tx(flagT - 300) + tx(flagT)) / 2, y: GY1 - 6, opacity: read ? 1 : 0, fill: reason === 'rotate' ? 'var(--c-danger)' : 'var(--c-success)' });
    quietLbl.textContent = reason === 'rotate' ? '300 ms: có xoay!' : '300 ms yên lặng';
    const cp = accepted && read ? clamp((simT - flagT) / C.TAP_CONFIRM_MS, 0, 1) : 0;
    attr(confirm, { x: tx(flagT), width: tx(flagT + 150) - tx(flagT), opacity: accepted && read ? 0.16 : 0 });
    cbFill.setAttribute('width', 160 * cp);
    const mark = (k, ok, pending) => { checks[k].ic.textContent = pending ? '·' : ok ? '✓' : '✗'; checks[k].ic.setAttribute('fill', pending ? 'var(--c-muted)' : ok ? 'var(--c-success)' : 'var(--c-danger)'); };
    mark(0, flagI >= 0 && rows[flagI].rest, !read);
    mark(1, reason !== 'rotate', !read || reason === 'tilt');
    mark(2, cp >= 1, !(cp >= 1));
    const emitted = emitI >= 0 && simT >= rows[emitI].t;
    const rejected = beat.id === 'rejected' && t01 > 0.3 || (beat.id === 'end' && !emitted);
    vG.setAttribute('opacity', emitted || rejected ? 1 : 0);
    if (emitted) { vR.setAttribute('fill', COMMANDS.YES.color); vT.textContent = '📡 YES'; vT.setAttribute('fill', 'var(--c-text-on-light, #21242c)'); }
    else { vR.setAttribute('fill', 'var(--c-danger-bg)'); vT.textContent = '✗ Bỏ qua'; vT.setAttribute('fill', 'var(--c-danger)'); }
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf(tl.has('confirm') ? 'confirm' : 'end') - 1 });
}
