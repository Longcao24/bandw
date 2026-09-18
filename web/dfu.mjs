/* Nordic legacy serial DFU / HCI framing, derived from Adafruit_nRF52_nrfutil.
 * Copyright (c) 2015, Nordic Semiconductor. BSD-3-Clause; see LICENSE-NORDIC.txt.
 * Only application updates. Never sends bootloader or SoftDevice images.
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const words = (...values) => {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setUint32(i * 4, value, true));
  return bytes;
};
export function crc16(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc;
}
export function encodeSlip(bytes) {
  const encoded = [0xc0];
  for (const byte of bytes) {
    if (byte === 0xc0) encoded.push(0xdb, 0xdc);
    else if (byte === 0xdb) encoded.push(0xdb, 0xdd);
    else encoded.push(byte);
  }
  return Uint8Array.from([...encoded, 0xc0]);
}
export function packet(payload, sequence) {
  if (payload.length > 4095 || sequence < 0 || sequence > 7) throw new Error('Invalid HCI packet');
  const data = new Uint8Array(4 + payload.length + 2);
  data[0] = sequence | (((sequence + 1) % 8) << 3) | 0xc0;
  data[1] = 14 | ((payload.length & 15) << 4);
  data[2] = payload.length >> 4;
  data[3] = -(data[0] + data[1] + data[2]) & 255;
  data.set(payload, 4);
  const crc = crc16(data.subarray(0, -2));
  data[data.length - 2] = crc & 255;
  data[data.length - 1] = crc >> 8;
  return encodeSlip(data);
}
export class SlipDecoder {
  constructor(onFrame) { this.onFrame = onFrame; this.reset(); }
  reset() { this.bytes = []; this.started = false; this.escaped = false; }
  feed(chunk) {
    for (const byte of chunk) {
      if (byte === 0xc0) {
        if (this.started && this.bytes.length && !this.escaped) this.onFrame(Uint8Array.from(this.bytes));
        this.bytes = []; this.started = true; this.escaped = false;
      } else if (this.started) {
        if (this.escaped) {
          if (byte === 0xdc) this.bytes.push(0xc0);
          else if (byte === 0xdd) this.bytes.push(0xdb);
          else { this.reset(); continue; }
          this.escaped = false;
        } else if (byte === 0xdb) this.escaped = true;
        else this.bytes.push(byte);
        if (this.bytes.length > 4101) this.reset();
      }
    }
  }
}
export function ackNumber(frame) {
  if (frame.length !== 4 || frame[1] !== 0 || frame[2] !== 0 || (frame[0] & 0xc7)) return null;
  if ((frame.reduce((a, b) => a + b, 0) & 255) !== 0) return null;
  return (frame[0] >> 3) & 7;
}
export class DfuTransport {
  constructor(port, { wait = sleep, ackTimeout = 5000, onLog = () => {} } = {}) {
    this.port = port; this.wait = wait; this.ackTimeout = ackTimeout; this.onLog = onLog;
    this.sequence = 0; this.pending = null; this.closed = false; this.failure = null;
  }
  async open() {
    await this.port.open({ baudRate: 115200, flowControl: 'none' });
    try {
      await this.port.setSignals({ dataTerminalReady: false });
      await this.wait(50);
      await this.port.setSignals({ dataTerminalReady: true });
      await this.wait(100);
      this.reader = this.port.readable.getReader(); this.writer = this.port.writable.getWriter();
      const decoder = new SlipDecoder(frame => {
        const ack = ackNumber(frame);
        if (this.pending && ack === this.pending.expected) this.pending.resolve();
      });
      this.readLoop = (async () => {
        try {
          while (!this.closed) {
            const { value, done } = await this.reader.read();
            if (done) throw new Error('Board đã ngắt USB. Nhấn Reset hai lần và thử lại.');
            decoder.feed(value);
          }
        } catch (error) {
          if (!this.closed) { this.failure = error; this.pending?.reject(error); }
        }
      })();
    } catch (error) { await this.close(); throw error; }
  }
  async send(payload, timeout = this.ackTimeout) {
    if (this.closed || this.failure) throw this.failure || new Error('Cổng USB đã đóng.');
    if (this.pending) throw new Error('A packet is already in flight');
    this.sequence = (this.sequence + 1) % 8;
    const encoded = packet(payload, this.sequence);
    const expected = (this.sequence + 1) % 8;
    // Retransmission uses the SAME sequence; bootloader discards duplicates and re-ACKs.
    for (let attempt = 0; attempt < 3; attempt++) {
      let timer;
      const acknowledgement = new Promise((resolve, reject) => {
        this.pending = { expected, resolve, reject };
        timer = setTimeout(() => reject(new Error('ACK_TIMEOUT')), timeout);
      });
      // Mark rejection handled even if USB write is still pending when timeout expires.
      acknowledgement.catch(() => {});
      try {
        await Promise.all([this.writer.write(encoded), acknowledgement]);
        return;
      } catch (error) {
        if (error.message !== 'ACK_TIMEOUT') throw error;
        if (attempt === 2) throw new Error('Board không phản hồi. Đóng Serial Monitor, nhấn Reset hai lần rồi chọn lại cổng bootloader.');
        this.onLog('Đang gửi lại gói chưa được xác nhận…');
      } finally {
        clearTimeout(timer); this.pending = null;
      }
    }
  }
  async flash(firmware, init, onProgress = () => {}) {
    validateImage(firmware, init);
    onProgress(0, 'Đang chuẩn bị bộ nhớ…');
    await this.send(words(3, 4, 0, 0, firmware.length), 15000);
    await this.wait(Math.max(500, (Math.floor(firmware.length / 4096) + 1) * 89.7));
    await this.send(Uint8Array.from([...words(1), ...init, 0, 0]));
    for (let offset = 0, index = 0; offset < firmware.length; offset += 512, index++) {
      const chunk = firmware.subarray(offset, offset + 512);
      await this.send(Uint8Array.from([...words(4), ...chunk]));
      onProgress(Math.min(98, Math.floor((offset + chunk.length) / firmware.length * 98)), 'Đang nạp firmware…');
      if (index % 8 === 0) await this.wait(103);
    }
    await this.wait(103);
    onProgress(99, 'Đang hoàn tất — giữ nguyên cáp USB…');
    await this.send(words(5));
    // ACK is transport acceptance, not proof the application booted. UI states this accurately.
    await this.wait(800);
    onProgress(100, 'Đã truyền xong firmware');
  }
  async close() {
    this.closed = true;
    this.pending?.reject(new Error('Cổng USB đã đóng.'));
    try { await this.reader?.cancel(); } catch { /* unplugged */ }
    await this.readLoop;
    try { this.reader?.releaseLock(); } catch { /* already released */ }
    try { this.writer?.releaseLock(); } catch { /* already released */ }
    try { await this.port.close(); } catch { /* unplugged */ }
  }
}
export function validateImage(firmware, init) {
  if (!(firmware instanceof Uint8Array) || firmware.length < 1024 || firmware.length > 811008 || firmware.length % 4)
    throw new Error('Kích thước firmware không hợp lệ.');
  if (!(init instanceof Uint8Array) || init.length < 12 || init.length > 128) throw new Error('Gói khởi tạo DFU không hợp lệ.');
  const view = new DataView(init.buffer, init.byteOffset, init.byteLength);
  const count = view.getUint16(8, true);
  if (view.getUint16(0, true) !== 82 || init.length !== 12 + count * 2)
    throw new Error('Gói DFU không đúng định dạng nRF52840.');
  if (view.getUint16(10 + count * 2, true) !== crc16(firmware)) throw new Error('CRC firmware không khớp.');
}
export async function checkHash(bytes, expected) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) throw new Error('File firmware không khớp SHA-256. Hãy tải lại trang.');
}
