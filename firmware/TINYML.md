# TinyML cho BandW: ghi chú nghiên cứu và kế hoạch

> **Trạng thái:** đây là *kế hoạch nghiên cứu*. Firmware 0.5.0 **chưa có** học máy: mọi cử chỉ vẫn nhận bằng luật trong `BandW_Sense/GestureDetector.h`. Không có con số nào dưới đây là kết quả đo trên người thật.

## 1. TinyML là gì, vì sao hợp với BandW

TinyML (Tiny Machine Learning) là chạy mô hình học máy **ngay trên vi điều khiển**: vài chục KB bộ nhớ, công suất cỡ mili-oát, không cần Internet. Với BandW, chạy trên vòng tay giữ nguyên thiết kế hiện tại:

- Chip tự quyết định, BLE vẫn chỉ gửi **một từ** (`WATER`, `FOOD`…). App Android không phải sửa.
- Không gửi số liệu thô 50 lần/giây qua Bluetooth: đỡ tốn pin, không lộ dữ liệu chuyển động.
- Không phụ thuộc mạng, độ trễ thấp.

Nếu chạy mô hình trên điện thoại thì máy mạnh hơn, nhưng mất cả ba ưu điểm trên.

## 2. Ngân sách phần cứng

| | XIAO nRF52840 Sense | BandW 0.5.0 đang dùng |
|---|---|---|
| CPU | Arm Cortex-M4F 64 MHz, có FPU | vòng lặp 20 ms (50 Hz) |
| Flash | 1 MB | 339.216 byte (41%) |
| RAM | 256 KB | 71.864 byte RAM tĩnh (30%) |
| Cảm biến | LSM6DS3TR-C, 6 trục | gia tốc 416 Hz, con quay 104 Hz, đọc mỗi 20 ms |

Số liệu flash/RAM lấy từ `firmware/README.md`. Còn hơn một nửa flash và khoảng 2/3 RAM: đủ chỗ cho một mô hình nhỏ.

Ước lượng kích thước (int8 = 1 byte/trọng số):

| Mô hình | Đầu vào | Tham số | int8 | float32 |
|---|---|---|---|---|
| A. 1 lớp, 5 nơ-ron trên 9 đặc trưng (giống trang học) | 9 | 50 | ≈ 65 byte | 200 byte |
| B. Mạng 450 → 32 → 16 → 5 trên cửa sổ thô | 75 × 6 = 450 | 15.045 | ≈ 15 KB | ≈ 60 KB |

Bộ đệm vòng cho 75 mẫu × 6 trục × 4 byte = 1.800 byte RAM. Thời gian suy luận phải **đo** bằng `micros()` trên chip; ước tính mô hình B cần khoảng 15.000 phép nhân-cộng, dự kiến dưới 1 ms, nhưng chưa đo.

## 3. Kiến trúc đề xuất: lai luật + mô hình

```
IMU 50 Hz ─► bộ đệm 75 mẫu ─► (mỗi 10 mẫu = 200 ms) đặc trưng ─► mô hình ─► xác suất 5 lớp
                                                                                   │
            luật hiện có: trung tính, nghỉ 650 ms, không lặp lệnh ◄── ứng viên ◄───┘ (≥ ngưỡng, 2 cửa sổ liền)
                                   │
                                   └─► BLE gửi 1 từ (không đổi)
```

- **Lớp `NONE` (không làm gì) là bắt buộc**: nghỉ, đi bộ, nghiêng nhẹ thoáng qua, chúc tay một lần, nâng tay rồi giữ. Thiếu lớp này mô hình buộc phải chọn một lệnh và sẽ phát nhầm.
- **Ngưỡng tự tin** (khởi đầu 0,80) và **hai cửa sổ liền nhau đồng ý** mới thành ứng viên. Dưới ngưỡng thì im lặng.
- Giữ lại các luật an toàn đã có: phải về trung tính, nghỉ 650 ms, giữ tư thế không lặp lệnh.
- Giai đoạn đầu mô hình chỉ thay phần WATER/FOOD/NO. **HELP vẫn dùng luật** (2 lần nhấp, đã có kiểm thử chống nhầm) và **YES vẫn dùng bộ gõ đôi phần cứng** của LSM6DS3 (tín hiệu 416 Hz bên trong chip, không nằm trong cửa sổ 50 Hz).
- Có thể giữ cả hai đường và bật/tắt mô hình qua kênh điều khiển `c91b0003` để so sánh.

Phác thảo vòng lặp (chưa có trong `BandW_Sense.ino`, chưa biên dịch):

```cpp
// PHÁC THẢO: chưa có trong BandW_Sense.ino
static float ring[WINDOW][6];            // 75 mẫu gần nhất
static int head = 0, sinceInfer = 0, lastBest = NONE;

void onSample(const float s[6]) {        // gọi mỗi 20 ms
  memcpy(ring[head], s, sizeof(ring[0]));
  head = (head + 1) % WINDOW;
  if (++sinceInfer < 10) return;          // 10 mẫu = 200 ms
  sinceInfer = 0;
  float feat[9], prob[5];
  computeFeatures(ring, head, feat);      // 9 đặc trưng như trang học
  runModel(feat, prob);                   // trọng số int8
  int best = argmax(prob, 5);
  if (best != NONE && prob[best] >= 0.80f && best == lastBest)
    candidate = best;                     // 2 cửa sổ liền nhau đồng ý
  lastBest = best;                        // luật cũ quyết định có phát hay không
}
```

## 4. Quy trình 7 bước

1. **Ghi dữ liệu.** Thêm chế độ ghi riêng: in đủ 6 trục **50 lần/giây** (chế độ debug hiện tại chỉ in 10 lần/giây, và log USB bỏ dòng khi máy tính bận nên không dùng làm dữ liệu được). Mỗi dòng gắn thời gian `millis()` để phát hiện mẫu bị mất.
2. **Gán nhãn.** Quay video cùng lúc hoặc bấm nút trên app để đánh dấu đầu/cuối mỗi cử chỉ. Ghi cả phiên “không làm gì” dài: ăn, uống, gãi đầu, đi bộ, ngồi xe lăn.
3. **Nhiều người.** Thu từ nhiều người, nhiều tư thế đeo; ghi rõ ai là ai. Chia theo **người**: người dùng để kiểm tra không bao giờ có mặt trong dữ liệu huấn luyện (leave-one-person-out).
4. **Cửa sổ và đặc trưng.** Cắt cửa sổ 1,5 s (75 mẫu), trượt 200 ms. Bắt đầu với 9 đặc trưng thống kê (mô hình A); chỉ thử mô hình B khi A không đủ.
5. **Huấn luyện trên máy tính.** Edge Impulse (có xuất thư viện Arduino) hoặc TensorFlow/Keras. Huấn luyện **không** chạy trên vòng tay.
6. **Thu nhỏ và nạp.** Lượng tử hoá int8, chuyển sang TensorFlow Lite for Microcontrollers (hoặc thư viện C do Edge Impulse sinh ra). Với mô hình A có thể chép thẳng 50 số vào mảng C. Biên dịch lại, ghi flash/RAM mới vào README.
7. **Đánh giá công bằng.** Trên cùng tập kiểm tra (người mới), so mô hình với luật hiện tại: ma trận nhầm lẫn, **lệnh nhầm mỗi giờ** trong phiên “không làm gì”, lệnh bị bỏ sót, độ trễ, thời gian suy luận, pin. Mô hình chỉ thay luật khi tốt hơn rõ và vẫn giải thích được lỗi.

## 5. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Ít dữ liệu, mô hình “thuộc bài” | Chia theo người, xem khoảng cách huấn luyện/kiểm tra, ưu tiên mô hình nhỏ |
| Phát nhầm lệnh khi sinh hoạt | Lớp `NONE` nhiều, ngưỡng tự tin, 2 cửa sổ liền, giữ luật nghỉ/trung tính |
| HELP nhầm hoặc bỏ sót | Giữ HELP bằng luật cho tới khi có số đo chứng minh mô hình an toàn hơn |
| Khó giải thích khi sai | Mô hình A: xem được trọng số từng đặc trưng; lưu xác suất khi thử nghiệm |
| Dữ liệu cá nhân | Thu có đồng thuận, ẩn danh, không gửi lên mạng |

## 6. Phòng thí nghiệm trên trang học

Trang ôn tập KHKT có chương **TinyML** với hai mô phỏng chạy ngay trong trình duyệt (`khkt/public/js/sims/_tinyml.js`): tạo dữ liệu cử chỉ **tổng hợp** cho 8 “người”, tính 9 đặc trưng, huấn luyện mô hình A, lượng tử hoá int8 và đo trên 2 người chưa thấy. Đó là minh hoạ phương pháp; độ chính xác trên dữ liệu tổng hợp **không** phải độ chính xác của BandW.
