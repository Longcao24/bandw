# BandW — Android demo

App Android native cho prototype vòng tay XIAO nRF52840 Sense. Bản 0.3.0 hỗ trợ mô phỏng và nhận BLE từ firmware rule-based trong thư mục `firmware/`. Không cần train AI.

## Nạp firmware từ trình duyệt

[BandW Web Flasher](https://longcao24.github.io/bandw/) — dành cho XIAO nRF52840 Sense thường và Sense Plus (chọn đúng loại board), dùng Chrome/Edge trên máy tính. Trang tự gửi yêu cầu chuyển sang bootloader qua USB, sau đó bạn chọn cổng mới và bấm Nạp. Không cần Arduino IDE hoặc nhấn Reset khi firmware hiện tại hỗ trợ 1200-baud touch; Reset hai lần chỉ là phương án khôi phục.

## Tải và cài APK

[Tải APK v0.3.0](https://github.com/Longcao24/bandw/releases/download/v0.3.0/BandW-0.3.0-debug.apk) · [Tất cả bản phát hành](https://github.com/Longcao24/bandw/releases)

Mở link APK trên điện thoại Android 8.0+, tải xuống rồi mở file để cài. Nếu Android hỏi, cho phép trình duyệt hoặc ứng dụng quản lý file **Cài đặt ứng dụng không rõ nguồn gốc**. Đây là APK debug dành cho demo, chưa phát hành trên Play Store.

Gói ZIP trong Release gồm APK, mã nguồn firmware, binary và hướng dẫn nạp XIAO Sense.

## Chạy app

- Android 8.0 trở lên.
- Mở thư mục dự án trong Android Studio, đợi Gradle sync, chọn điện thoại rồi Run.
- Hoặc dùng JDK 17, Android SDK 35 và chạy `./gradlew assembleDebug` (đặt `sdk.dir` trong `local.properties` theo máy).
- APK: `app/build/outputs/apk/debug/app-debug.apk`.
- Cài APK trên điện thoại, mở **BandW**, bật âm lượng media.
- Nếu app báo thiếu giọng tiếng Việt: bấm **Cài đặt giọng đọc**, chọn bộ máy hỗ trợ tiếng Việt và tải giọng, quay lại bấm **Kiểm tra lại giọng đọc**. Một số giọng cần mạng; tải giọng offline để demo không phụ thuộc mạng.

## Thử demo

1. Bấm **← Nghiêng tay trái → WATER**: hiện và đọc “Tôi muốn uống nước.”
2. Bấm **→ Nghiêng tay phải → FOOD**: hiện và đọc “Tôi muốn ăn.”
3. Bấm **↔ Lắc cổ tay → NO**: hiện và đọc “Không.”
4. Bấm **Đọc lại** để đọc câu gần nhất; **Dừng đọc** để ngắt.
5. Tắt **Tự động đọc khi nhận lệnh**: các lệnh chỉ cập nhật nội dung, vẫn có thể bấm Đọc lại.
6. Bấm nhanh nhiều lệnh: câu mới thay thế câu đang đọc, không xếp hàng.
7. Xoay màn hình: giữ câu gần nhất và 5 lệnh gần đây, không tự đọc lại.
8. Rời app: dừng giọng đọc. Lịch sử chỉ giữ trong phiên, không lưu lên server.

## Dùng vòng tay thật

Nạp firmware theo [hướng dẫn firmware](firmware/README.md). Bật Bluetooth, bấm **Kết nối vòng tay**, cấp quyền và chọn BandW-Sense sau khi quét. Android 8–11 cần quyền Vị trí và bật dịch vụ Vị trí để quét; Android 12+ cần quyền Thiết bị ở gần. Không sử dụng microphone.

App chỉ nhận BLE khi mở ở foreground. Rời app, khóa hoặc xoay màn hình sẽ ngắt kết nối; bấm Kết nối để nối lại. Nút mô phỏng vẫn hoạt động khi không có vòng tay.

## Hiệu chuẩn từ app

Sau khi kết nối, bấm **Hiệu chuẩn vòng tay**, giữ tay ở tư thế trung tính khoảng 2 giây và chờ **Đã hiệu chuẩn**. Trong lúc hiệu chuẩn, board tạm ngừng nhận cử chỉ. Nếu quá 30 giây chưa xong, app báo lỗi và ngắt kết nối để thử lại. Firmware cũ vẫn nhận cử chỉ nhưng nút hiệu chuẩn bị tắt; cần nạp firmware mới đi kèm v0.3.0.

## Cấu trúc

- `GestureCommand.java`: ánh xạ WATER / FOOD / NO sang câu tiếng Việt.
- `MainActivity.java`: giao diện, lịch sử và Text-to-Speech.
- `BandBleClient.java`: quyền, scan theo UUID, chọn thiết bị, connect, subscribe và ngắt kết nối.
- `firmware/BandW_Sense/`: sketch cho XIAO nRF52840 Sense và bộ nhận cử chỉ.
- `firmware/tests/gesture_test.cpp`: kiểm thử thuật toán bằng dữ liệu tổng hợp.

Đã build APK và firmware, lint Android không có lỗi. Chưa xác nhận BLE, hướng cử chỉ và giọng đọc trên phần cứng thật. Xem hướng dẫn firmware để biết quy ước hướng đeo và cách hiệu chỉnh ngưỡng.
