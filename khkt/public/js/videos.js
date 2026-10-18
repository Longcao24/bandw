// Fixed video catalogue (spec §8). Files: videos/<id>.mp4 / .jpg / .vtt
export const VIDEO_CATALOG = [
  { id: 'v-system-overview', title: 'Toàn cảnh BandW trong 90 giây', unit: 'u01', fallbackSim: 'system-flow',
    summary: 'Cổ tay → IMU → chip → BLE → điện thoại → loa, với cả 5 cử chỉ.' },
  { id: 'v-imu-tilt', title: 'Cảm biến IMU và góc nghiêng', unit: 'u03', fallbackSim: 'tilt-angle',
    summary: 'Gia tốc kế, trọng lực, góc nghiêng atan2 và con quay hồi chuyển.' },
  { id: 'v-calibration', title: 'Hiệu chuẩn tư thế trung tính', unit: 'u03', fallbackSim: 'calibration',
    summary: '100 mẫu đứng yên, loại mẫu rung và đèn LED báo trạng thái.' },
  { id: 'v-gesture-state-machine', title: 'Máy trạng thái nhận dạng cử chỉ', unit: 'u05', fallbackSim: 'gesture-state-machine',
    summary: 'Trung tính → sẵn sàng → giữ → phát lệnh → nghỉ; lắc 3 pha, gõ 2 lần, nhấp cẳng tay 2 lần.' },
  { id: 'v-main-loop', title: 'Vòng lặp loop() mỗi 20 ms', unit: 'u04', fallbackSim: 'main-loop',
    summary: 'Mỗi vòng: đọc cảm biến → kiểm tra → gửi lệnh.' },
  { id: 'v-ble', title: 'Bluetooth Low Energy gửi "WATER"', unit: 'u06', fallbackSim: 'ble-flow',
    summary: 'Quảng bá, kết nối, đăng ký và thông báo một gói "WATER".' },
  { id: 'v-app-tts', title: 'Ứng dụng nhận lệnh và đọc thành tiếng', unit: 'u07', fallbackSim: 'tts-pipeline',
    summary: 'App nhận lệnh, hiện chữ và đọc câu tiếng Việt.' },
  { id: 'v-experiment', title: 'Thí nghiệm và ma trận nhầm lẫn', unit: 'u08', fallbackSim: 'confusion-matrix',
    summary: 'Cách làm thí nghiệm, đếm kết quả và đọc ma trận nhầm lẫn (minh hoạ).' },
];
export const VIDEO_IDS = VIDEO_CATALOG.map((v) => v.id);
export const videoById = (id) => VIDEO_CATALOG.find((v) => v.id === id) || null;
export const videoFiles = (id) => ({ mp4: `videos/${id}.mp4`, jpg: `videos/${id}.jpg`, vtt: `videos/${id}.vtt` });
