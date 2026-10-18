# video-src: dựng video thuyết minh BandW

Thư mục này **không được triển khai**. Nó chỉ chứa nguồn để dựng 8 video có lời đọc tiếng Việt. Kết quả nằm ở `../public/videos/<id>.mp4`, `.vtt` và `.jpg`, và đã được commit sẵn.

## Chạy lại

Chỉ chạy được trên macOS. Cần `ffmpeg`/`ffprobe`, giọng `Linh` (vi_VN) cho lệnh `say`, và Chromium (bản trong `~/Library/Caches/ms-playwright`, hoặc Chrome, hoặc đặt biến `BW_CHROME`).

```bash
npm run videos                              # từ khkt/: dựng cả 8 video
npm run videos -- v-ble v-app-tts           # chỉ dựng vài video
cd video-src && node render.mjs all --jobs 4
node render.mjs v-ble --preview 5,12.5      # chỉ chụp ảnh PNG vào .build/v-ble/ để xem nhanh
BW_RATE=165 node render.mjs v-imu-tilt      # đọc chậm hơn (mặc định 172 từ/phút)
```

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `narration/<id>.txt` | Kịch bản lời đọc. `@mark \| Chương` mở một đoạn. Dòng thường là phụ đề (dùng chữ số). `~ …` là lời cho giọng Linh đọc (số viết bằng chữ, thuật ngữ đánh vần). `!min 3` là thời lượng tối thiểu tính bằng giây. |
| `scenes/<id>.html` | Cảnh SVG tất định: `window.BW_SCENE.init(timeline)` rồi `seek(t)`. Không dùng rAF hay `Date.now()`, nên mỗi khung hình chỉ phụ thuộc vào `t`. |
| `scenes/scene-lib.js` | Thư viện vẽ dùng chung: cổ tay và nhân vật vòng tay, điện thoại, biểu đồ, khung code, máy trạng thái, đồng hồ đo. Có thêm **bản port JS của `GestureDetector.h`** với cùng hằng số, nên các thời điểm phát lệnh trong video đều do thuật toán thật tính ra. |
| `render.mjs` | Đọc kịch bản rồi chạy qua các bước sau. **1.** `say` tạo từng đoạn âm thanh và `ffprobe` đo thời lượng. **2.** Xếp timeline: bắt đầu ở 1 s, mỗi đoạn = thời lượng + 0,4 s, cuối video có 2,5 s thẻ kết. **3.** Ghép âm thanh và chuẩn hoá về −16 LUFS. **4.** Chromium headless chụp 30 hình/giây. **5.** Mã hoá H.264 High, yuv420p, CRF 28, kèm AAC 96 kbps mono 44,1 kHz và `+faststart`. Nếu tệp ≥ 8 MB thì tăng CRF và mã hoá lại. **6.** Ghi tệp WebVTT (mỗi câu một cue, ≤ 2 dòng × 42 ký tự) và ảnh poster. |
| `chapters.json` | Thời lượng và mốc chương (giây) của từng video, để người viết bài điền `chapters` trong bước `video`. |
| `.build/` | Tệp tạm (âm thanh, bản master). Đã gitignore. |

Sửa lời: đổi `narration/<id>.txt`, chạy lại, rồi cập nhật `chapters` trong bài học theo `chapters.json`. Mốc thời gian chỉ đổi khi lời đọc đổi.
Số liệu trong `v-experiment` là **minh hoạ**, và video luôn ghi rõ điều đó.
