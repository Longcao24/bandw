// Profile: learner code (copy / download / restore / new), sync status, settings, stats, reset.
import { el, fmtNumber, timeAgo } from '../util.js';
import { pageHeader } from './_ui.js';
import { confirmDialog, toast, setMotionPref, applyTheme } from '../a11y.js';
import { normalize } from '../core/learnerCode.js';
import { VIDEO_CATALOG } from '../videos.js';
import { icon } from '../icons.js';

export function render(root, _p, { course, store, sync }) {
  const page = el('div.page.narrow.profile');
  page.append(pageHeader('Hồ sơ học tập', 'Không cần đăng nhập. Mã học tập giúp em mang tiến độ sang máy khác.'));
  const offs = [];

  // ---- learner code ----
  const codeBox = el('output.code-box', { 'aria-label': 'Mã học tập của em', tabindex: '0' }, store.code);
  const copyHint = el('p.ex-sub', { hidden: true }, 'Nhấn giữ (hoặc bôi đen) mã để sao chép.');
  const copyBtn = el('button.btn.primary', { type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(store.code); toast('Đã sao chép mã học tập'); }
    catch {
      const r = document.createRange(); r.selectNodeContents(codeBox);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      copyHint.hidden = false;
    }
  } }, icon('copy', 16), 'Sao chép');
  const dlBtn = el('button.btn', { type: 'button', onclick: () => {
    const text = `Mã học tập BandW KHKT\n${store.code}\n\nDán mã này vào mục "Khôi phục tiến độ" ở trang Hồ sơ để học tiếp trên máy khác.\nAi có mã đều xem được tiến độ của em, hãy giữ kín.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = el('a', { href: url, download: 'ma-hoc-tap-bandw.txt' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, icon('download', 16), 'Lưu thành tệp');
  page.append(el('section.card.code-card', { 'aria-labelledby': 'code-h' },
    el('h2#code-h', null, icon('key', 18), 'Mã học tập'),
    codeBox, el('div.row-actions', null, copyBtn, dlBtn), copyHint,
    el('p', null, 'Giữ mã này để học tiếp trên máy khác. Ai có mã đều xem được tiến độ của em.'),
    store.storage.ok ? null : el('div.callout.warn', { role: 'note' }, el('span.callout-icon', { 'aria-hidden': 'true' }, icon('alert', 18)), el('p', null, 'Trình duyệt không cho lưu: hãy giữ mã học tập.'))));

  // ---- sync status ----
  const pill = el('span.sync-pill');
  const last = el('small.ex-sub');
  const paint = () => { pill.textContent = sync.label.replace(/^\S+\s/, ''); pill.dataset.status = sync.status; last.textContent = `Lần đồng bộ gần nhất: ${timeAgo(sync.lastSync)}`; };
  paint();
  offs.push(sync.onStatus(paint));
  page.append(el('section.card', { 'aria-labelledby': 'sync-h' },
    el('h2#sync-h', null, icon('cloud', 18), 'Đồng bộ'),
    el('div.row-actions', null, pill, el('button.btn.sm', { type: 'button', onclick: () => sync.syncNow() }, icon('refresh', 16), 'Đồng bộ ngay')), last,
    el('p.ex-sub', null, 'Máy chủ chỉ lưu tiến độ (điểm, bài đã học) theo mã băm SHA-256 của mã học tập. Không có tên, email hay câu trả lời.')));

  // ---- restore ----
  const input = el('input.text-input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'BW-XXXX-XXXX-…', 'aria-describedby': 'restore-msg', id: 'restore-in' });
  const msg = el('p#restore-msg.form-msg', { 'aria-live': 'polite' });
  const restoreBtn = el('button.btn.primary', { type: 'submit' }, 'Khôi phục');
  const form = el('form.restore', { onsubmit: async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    const code = normalize(input.value);
    if (!code) { msg.textContent = 'Mã không hợp lệ, kiểm tra lại các ký tự'; msg.classList.add('error'); input.setAttribute('aria-invalid', 'true'); return; }
    input.removeAttribute('aria-invalid');
    if (code === store.code) { msg.textContent = 'Đây đã là mã đang dùng trên máy này.'; return; }
    restoreBtn.disabled = true; msg.textContent = 'Đang tìm tiến độ…';
    const res = await sync.lookup(code);
    restoreBtn.disabled = false;
    if (res === 'invalid') { msg.textContent = 'Mã không hợp lệ, kiểm tra lại các ký tự'; msg.classList.add('error'); return; }
    if (res === 'not_found') { msg.textContent = 'Không tìm thấy tiến độ cho mã này'; msg.classList.add('error'); return; }
    if (res === 'error') { msg.textContent = 'Không kết nối được máy chủ. Em thử lại sau nhé.'; msg.classList.add('error'); return; }
    const ok = await confirmDialog('Gộp tiến độ trên máy này vào mã đã nhập?', { ok: 'Gộp và dùng mã này' });
    if (!ok) { msg.textContent = 'Đã huỷ.'; return; }
    sync.adopt(res);
    codeBox.textContent = store.code;
    input.value = '';
    msg.textContent = 'Đã khôi phục và gộp tiến độ. Từ giờ máy này dùng mã vừa nhập.';
    msg.classList.add('success');
    drawStats();
  } }, el('label', { for: 'restore-in' }, 'Dán mã học tập từ máy khác'), el('div.row-actions', null, input, restoreBtn), msg);
  page.append(el('section.card', { 'aria-labelledby': 'restore-h' }, el('h2#restore-h', null, icon('rotate-ccw', 18), 'Khôi phục tiến độ'), form));

  // ---- stats ----
  const statsBox = el('div.stats-grid');
  function drawStats() {
    const p = store.progress;
    const cs = store.courseStats(course);
    const watched = VIDEO_CATALOG.filter((v) => p.videos[v.id]).length;
    const correct = Object.values(p.ex).filter((e) => e.c).length;
    statsBox.replaceChildren(
      stat('zap', fmtNumber(store.points), 'điểm năng lượng'),
      stat('flame', `${p.streak?.cur || 0}`, `ngày liên tiếp (kỷ lục ${p.streak?.best || 0})`),
      stat('trophy', `${cs.mastered}/${cs.total}`, 'bài thành thạo'),
      stat('check-circle', `${correct}`, 'bài tập làm đúng'),
      stat('video', `${watched}/${VIDEO_CATALOG.length}`, 'video đã xem'),
      stat('mic', `${Object.keys(p.cards).length}`, 'thẻ phản biện đã luyện'));
  }
  drawStats();
  page.append(el('section.card', { 'aria-labelledby': 'stats-h' }, el('h2#stats-h', null, icon('chart', 18), 'Thành tích'), statsBox));

  // ---- settings ----
  const theme = el('select#set-theme', { onchange: (e) => { store.setPrefs({ theme: e.target.value }); applyTheme(e.target.value); } },
    [['auto', 'Tự động'], ['light', 'Sáng'], ['dark', 'Tối']].map(([v, t]) => el('option', { value: v, selected: store.prefs.theme === v }, t)));
  const motion = el('select#set-motion', { onchange: (e) => { store.setPrefs({ motion: e.target.value }); setMotionPref(e.target.value); } },
    [['auto', 'Tự động'], ['reduce', 'Giảm chuyển động']].map(([v, t]) => el('option', { value: v, selected: store.prefs.motion === v }, t)));
  const speed = el('select#set-speed', { onchange: (e) => store.setPrefs({ speed: Number(e.target.value) }) },
    [0.5, 1, 1.5].map((v) => el('option', { value: v, selected: Number(store.prefs.speed) === v }, `${String(v).replace('.', ',')}×`)));
  page.append(el('section.card', { 'aria-labelledby': 'set-h' }, el('h2#set-h', null, icon('settings', 18), 'Cài đặt'),
    el('div.settings', null,
      el('label', { for: 'set-theme' }, 'Giao diện'), theme,
      el('label', { for: 'set-motion' }, 'Chuyển động'), motion,
      el('label', { for: 'set-speed' }, 'Tốc độ mô phỏng'), speed)));

  // ---- danger zone ----
  page.append(el('section.card.danger-zone', { 'aria-labelledby': 'dz-h' }, el('h2#dz-h', null, icon('key', 18), 'Quản lý mã và dữ liệu'),
    el('div.row-actions', null,
      el('button.btn', { type: 'button', onclick: async () => {
        if (!(await confirmDialog('Tạo mã học tập mới? Tiến độ trên máy này được giữ nguyên và sẽ lưu theo mã mới. Mã cũ vẫn giữ bản đã lưu trên máy chủ.', { ok: 'Tạo mã mới' }))) return;
        store.newCode(); codeBox.textContent = store.code; toast('Đã tạo mã mới. Nhớ sao chép mã nhé!');
      } }, 'Tạo mã mới'),
      el('button.btn.danger', { type: 'button', onclick: async () => {
        if (!(await confirmDialog('Xoá toàn bộ tiến độ trên máy này? Bản trên máy chủ (nếu có) không bị xoá.', { ok: 'Tiếp tục', danger: true }))) return;
        if (!(await confirmDialog('Chắc chắn chưa? Nếu chưa lưu mã học tập, em sẽ không lấy lại được tiến độ.', { ok: 'Xoá trên máy này', danger: true }))) return;
        store.clearLocal(); codeBox.textContent = store.code; drawStats(); toast('Đã xoá tiến độ trên máy này');
      } }, icon('trash', 16), 'Xoá tiến độ trên máy này'))));

  root.append(page);
  return { title: 'Hồ sơ', destroy() { offs.forEach((f) => f()); } };
}

function stat(ic, value, label) {
  return el('div.stat', null, el('span.stat-icon', { 'aria-hidden': 'true' }, icon(ic, 20)), el('span.stat-value', null, value), el('span.stat-label', null, label));
}
