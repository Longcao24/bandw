import { BOARDS, portIds, matchesManifest } from './boards.mjs';
import { DfuTransport, checkHash, validateImage, sleep } from './dfu.mjs';
const $ = id => document.getElementById(id);
const supported = isSecureContext && 'serial' in navigator;
let board = BOARDS.sense;
let loadGeneration = 0;
let image, selectedPort, flashing = false, busy = false, needBootPort = false;
const logs = [];
function log(message) {
  logs.push(`${new Date().toLocaleTimeString('vi-VN')}  ${message}`);
  if (logs.length > 150) logs.shift();
  $('log').textContent = logs.join('\n');
}
function status(title, detail) { $('status-title').textContent = title; $('status-detail').textContent = detail; }
function updateControls() {
  $('connect').disabled = !supported || !image || busy || !$('model-confirm').checked;
  $('model-confirm').disabled = busy || !!selectedPort;
  $('board-select').disabled = busy || !!selectedPort;
  $('connect').hidden = !!selectedPort || flashing;
  $('flash').hidden = !selectedPort || flashing;
  $('flash').disabled = busy;
}
function errorMessage(error) {
  if (error.name === 'NotFoundError') return 'Bạn chưa chọn cổng USB. Có thể bấm kết nối để thử lại.';
  if (error.name === 'SecurityError') return 'Trình duyệt chưa cho phép truy cập USB. Mở trực tiếp trang bằng Chrome hoặc Edge trên máy tính.';
  if (error.name === 'NetworkError' || error.name === 'InvalidStateError') return 'Không mở được cổng. Đóng Serial Monitor / Arduino IDE và kiểm tra cáp USB.';
  return error.message || String(error);
}
async function fetchBytes(file, size) {
  const response = await fetch(new URL(`./firmware/${file}`, import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Không tải được firmware (${response.status}). Hãy tải lại trang.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== size) throw new Error('File firmware chưa tải đủ. Hãy tải lại trang.');
  return bytes;
}
async function loadFirmware() {
  const generation = ++loadGeneration;
  const requestedBoard = board;
  image = null;
  $('version').textContent = 'Đang tải…';
  $('file-status').textContent = 'Đang kiểm tra SHA-256';
  status('Đang chuẩn bị firmware…', requestedBoard.label);
  updateControls();
  try {
    const response = await fetch(new URL(`./firmware/${requestedBoard.manifest}`, import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('Không tải được thông tin firmware.');
    const manifest = await response.json();
    if (!matchesManifest(requestedBoard, manifest)) throw new Error('Gói firmware không đúng loại board đã chọn.');
    const [firmware, init] = await Promise.all([
      fetchBytes(manifest.firmware.file, manifest.firmware.size), fetchBytes(manifest.init.file, manifest.init.size)
    ]);
    await Promise.all([checkHash(firmware, manifest.firmware.sha256), checkHash(init, manifest.init.sha256)]);
    validateImage(firmware, init);
    if (generation !== loadGeneration) return;
    image = { firmware, init, manifest };
    $('version').textContent = `v${manifest.version}`;
    $('file-status').textContent = `SHA-256 đã kiểm tra · ${Math.round(firmware.length / 1024)} KB`;
    log(`${requestedBoard.label} · Firmware v${manifest.version}: SHA-256 và CRC16 hợp lệ.`);
    status('Sẵn sàng kết nối vòng tay', 'Xác nhận loại board, cắm cáp USB và bấm Kết nối USB.');
  } catch (error) {
    if (generation !== loadGeneration) return;
    $('file-status').textContent = 'Chưa xác minh được firmware';
    status('Không tải được firmware', errorMessage(error)); log(errorMessage(error));
    $('retry').textContent = 'Tải lại trang'; $('retry').hidden = false;
  }
  updateControls();
}
$('compatibility').textContent = supported
  ? '✓ Trình duyệt hỗ trợ nạp qua USB. Firmware được truyền trực tiếp đến board.'
  : 'Trình duyệt này chưa hỗ trợ. Hãy mở trang bằng Chrome hoặc Edge trên máy tính qua HTTPS.';
$('compatibility').classList.toggle('error', !supported);
$('model-confirm').addEventListener('change', updateControls);
$('board-select').addEventListener('change', () => {
  if (busy || selectedPort) return;
  board = BOARDS[$('board-select').value];
  needBootPort = false;
  $('model-confirm').checked = false;
  $('device-name').textContent = board.label;
  $('confirm-name').textContent = board.label;
  $('visual-name').textContent = board.label;
  $('connect').textContent = 'Kết nối USB ↗';
  $('retry').hidden = true; $('progress-wrap').hidden = true;
  for (const id of ['step-connect', 'step-flash', 'step-done']) $(id).classList.toggle('active', id === 'step-connect');
  loadFirmware();
});
$('connect').addEventListener('click', async () => {
  if (busy || !image || !$('model-confirm').checked) return;
  busy = true; updateControls(); $('retry').hidden = true;
  try {
    const pids = portIds(board, needBootPort);
    const port = await navigator.serial.requestPort({ filters: pids.map(usbProductId => ({ usbVendorId: 0x2886, usbProductId })) });
    const { usbVendorId, usbProductId } = port.getInfo();
    if (usbVendorId !== 0x2886 || !pids.includes(usbProductId)) throw new Error('Cổng không đúng loại board đã chọn.');
    log(`Đã chọn USB ${usbVendorId.toString(16)}:${usbProductId.toString(16).padStart(4, '0')}.`);
    if (board.bootPids.includes(usbProductId)) {
      selectedPort = port; needBootPort = false;
      status('Đã chọn cổng nạp', 'Bấm Nạp BandW vào vòng tay. Giữ cáp USB và tab này mở cho đến khi hoàn tất.');
      $('step-connect').classList.remove('active'); $('step-flash').classList.add('active');
      $('connection-hint').textContent = 'Firmware v0.3.0 · Có nút hiệu chuẩn từ app Android.';
    } else {
      status('Đang chuyển sang chế độ nạp…', 'Trang đang khởi động lại board qua USB. Bạn không cần nhấn nút Reset.');
      await port.open({ baudRate: 1200 });
      try {
        await port.setSignals({ dataTerminalReady: true }); await sleep(120);
        await port.setSignals({ dataTerminalReady: false });
      } finally {
        try { await port.close(); } catch { /* USB may disappear as soon as DTR drops. */ }
      }
      await sleep(1800);
      needBootPort = true;
      $('connect').textContent = 'Chọn cổng nạp mới ↗';
      status('Chọn cổng USB vừa xuất hiện', 'Đã gửi yêu cầu vào chế độ nạp. Bấm bên dưới và chọn cổng XIAO mới để tiếp tục. Nếu board mới không hiện cổng, nhấn Reset hai lần.');
      $('connection-hint').textContent = 'Chrome cần bạn cấp quyền cho cổng mới. Không cần nhấn Reset nếu cổng đã hiện.';
      log('Đã gửi yêu cầu bootloader bằng 1200 baud + DTR. Chờ chọn cổng mới.');
    }
  } catch (error) {
    status('Chưa kết nối được', errorMessage(error)); log(errorMessage(error));
    $('retry').hidden = false;
  } finally { busy = false; updateControls(); }
});
$('flash').addEventListener('click', async () => {
  if (busy || !selectedPort || !image) return;
  busy = flashing = true; updateControls(); $('retry').hidden = true;
  $('progress-wrap').hidden = false;
  const transport = new DfuTransport(selectedPort, { onLog: log });
  let succeeded = false;
  try {
    status('Đang nạp BandW', 'Giữ nguyên cáp USB. Tiến trình chỉ tăng khi board xác nhận nhận gói dữ liệu.');
    await transport.open();
    log('Đã mở bootloader. Bắt đầu cập nhật application.');
    await transport.flash(image.firmware, image.init, (percent, label) => {
      $('progress').value = percent; $('progress-percent').textContent = `${percent}%`;
      $('progress-label').textContent = label;
    });
    succeeded = true;
    status('Đã truyền xong firmware', 'Bootloader đã xác nhận các gói nạp. Chờ board khởi động, mở app BandW → Kết nối vòng tay → Hiệu chuẩn vòng tay.');
    log('Truyền DFU hoàn tất. Kiểm tra khởi động và hiệu chuẩn trong app BandW.');
    $('step-flash').classList.remove('active'); $('step-done').classList.add('active');
  } catch (error) {
    status('Nạp chưa hoàn tất', `${errorMessage(error)} Không dùng tiến trình dở dang như xác nhận thành công.`);
    log(`Lỗi: ${errorMessage(error)}`);
    $('progress-label').textContent = 'Đã dừng — cần nạp lại';
  } finally {
    await transport.close();
    selectedPort = null; busy = flashing = false;
    updateControls(); $('connect').hidden = true;
    $('retry').textContent = succeeded ? 'Nạp cho board khác' : 'Thử lại'; $('retry').hidden = false;
  }
});
$('retry').addEventListener('click', () => {
  if (!image) { location.reload(); return; }
  selectedPort = null; needBootPort = false;
  $('connect').textContent = 'Kết nối USB ↗';
  $('progress-wrap').hidden = true; $('progress').value = 0; $('retry').hidden = true;
  for (const id of ['step-connect', 'step-flash', 'step-done']) $(id).classList.toggle('active', id === 'step-connect');
  status('Kết nối lại vòng tay', 'Cắm board vào USB và bấm Kết nối. Nếu lần nạp trước bị gián đoạn, nhấn Reset hai lần để khôi phục cổng bootloader.');
  updateControls();
});
$('download-log').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([logs.join('\n')], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = url; a.download = 'bandw-flash-log.txt'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('beforeunload', event => { if (flashing || busy) { event.preventDefault(); event.returnValue = ''; } });
loadFirmware();
