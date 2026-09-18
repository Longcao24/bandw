# Firmware BandW — XIAO nRF52840 Sense

MVP rule-based, không train AI. Dùng IMU LSM6DS3 tích hợp và BLE để gửi lệnh tới app Android BandW 0.3.0.

| Cử chỉ | Payload ASCII | Câu trên Android |
|---|---|---|
| Nghiêng tay trái, giữ khoảng 0,4–0,6 giây | `WATER` | Tôi muốn uống nước. |
| Nghiêng tay phải, giữ khoảng 0,4–0,6 giây | `FOOD` | Tôi muốn ăn. |
| Lắc cổ tay qua lại, 3 pha đảo chiều nhanh | `NO` | Không. |

## Nạp bằng Arduino IDE

1. Trong Preferences → Additional Boards Manager URLs, thêm `https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json`.
2. Cài **Seeed nRF52 mbed-enabled Boards 2.9.3** trong Boards Manager.
3. Chọn **XIAO nRF52840 Sense (No Updates)** trong nhóm mbed. Không chọn nhóm **Seeed nRF52 Boards** cho sketch này.
4. Trong Library Manager, cài **ArduinoBLE 2.1.0** và **Seeed Arduino LSM6DS3 2.0.7**. Đây là các phiên bản đã dùng để compile.
5. Mở `BandW_Sense/BandW_Sense.ino`. Giữ `GestureDetector.h` cùng thư mục sketch.
6. Cắm XIAO bằng cáp USB truyền dữ liệu, chọn port của XIAO rồi Upload. Nếu không thấy port, nhấn Reset hai lần để vào bootloader rồi chọn lại port.
7. Giữ cổ tay ở tư thế trung tính, board đứng yên ở tư thế trung tính ít nhất 2 giây sau khi khởi động để hiệu chuẩn. Firmware chạy cả khi không mở Serial Monitor.

Không cần nối thêm IMU. Hướng khởi đầu: mặt linh kiện hướng lên, đầu USB hướng về ngón tay. Hướng trục thực tế cần kiểm tra với cách đeo của bạn; nếu trái/phải bị đảo, đổi `TILT_SIGN` từ `1.0f` sang `-1.0f` trong `GestureDetector.h`, rồi nạp lại.

## Kết nối điện thoại

1. Cài APK BandW **0.3.0** đi kèm (bản 0.1.0 chỉ mô phỏng).
2. Bật Bluetooth. Trong app, bấm **Kết nối vòng tay**, cấp quyền nếu được hỏi.
3. Đợi quét 8 giây, chọn **BandW-Sense** đúng địa chỉ. Không cần pair trong Cài đặt Bluetooth.
4. Android 8–11 cần quyền và dịch vụ Vị trí bật để quét BLE. Android 12+ hỏi quyền Thiết bị ở gần.
5. Khi app báo sẵn sàng, giữ tay trung tính khoảng nửa giây rồi thử cử chỉ.
6. Sau mỗi lệnh, trở về trung tính và chờ khoảng 1 giây trước cử chỉ tiếp theo.

Giữ app ở foreground trong bản demo. Rời app, khóa màn hình hoặc xoay màn hình sẽ ngắt BLE; quay lại bấm Kết nối. App không chạy dịch vụ nền. Mất kết nối không lưu hay phát lại cử chỉ cũ.

## Hiệu chỉnh và theo dõi

Serial Monitor **115200 baud**:
- `CALIBRATE`: cần giữ tay yên.
- `CALIBRATED`: đã lấy tư thế trung tính.
- `APP READY`: điện thoại đã đăng ký nhận notification.
- `TX WATER`, `TX FOOD`, `TX NO`: firmware đã cập nhật characteristic; đây không phải xác nhận điện thoại đã đọc thành tiếng.
- Gửi ký tự `c` để hiệu chuẩn lại tư thế trung tính.
- Gửi `d` để bật/tắt log IMU 10 Hz (ax, ay, az tính bằng g; gx, gy, gz tính bằng °/giây), phục vụ hiệu chỉnh theo cử chỉ thực tế.

LED tích hợp: nháy nhanh khi hiệu chuẩn, nháy chậm khi chờ app, sáng liên tục khi đã hiệu chuẩn và app đã subscribe. Lỗi khởi tạo IMU/BLE sẽ nháy nhanh liên tục; kiểm tra Serial và đúng loại board.

Thông số trong `GestureDetector.h`:
- `TILT_ENTER_DEG = 22`: góc nghiêng tối thiểu so với tư thế trung tính.
- `HOLD_MS = 250`: giữ góc đủ lâu sau khi chuyển động đã lắng; tổng thao tác thực tế thường lâu hơn 250 ms.
- `TILT_EXIT_DEG = 12`, `NEUTRAL_MS = 200`: ngưỡng và thời gian trở về trung tính.
- `SHAKE_DPS = 100`: tốc độ góc trục Y để đếm một pha lắc. Cần 3 pha luân phiên trong 900 ms, cách nhau ít nhất 80 ms.
- `COOLDOWN_MS = 650`: khoảng nghỉ sau một lệnh, sau đó vẫn phải về trung tính.

Board phải gắn chắc trên cổ tay. Nếu đặt xoay 90° so với hướng trên, cần đổi trục đọc cho tilt/shake; hiệu chuẩn chỉ đặt góc trung tính, không tự suy ra hướng đeo. Các ngưỡng là giá trị khởi đầu, chưa được đo với cử chỉ thực tế của người dùng.

## Giao thức BLE

- Local name: `BandW-Sense`
- Service: `c91b0001-7d7a-4f8c-9d29-6e44c786a321`
- Characteristic: `c91b0002-7d7a-4f8c-9d29-6e44c786a321`
- Properties: Read + Notify; CCCD `0x2902`.
- Mỗi notification chứa đúng một chuỗi ASCII `WATER`, `FOOD` hoặc `NO`, không có newline, không có byte NUL.
- App chỉ xử lý notification mới, không đọc lại giá trị cũ khi reconnect.
- MVP không pairing/bonding; chỉ demo khi app mở.

## Build và kiểm thử

```sh
arduino-cli compile --fqbn Seeeduino:mbed:xiaonRF52840Sense firmware/BandW_Sense
arduino-cli board list
# Thay PORT bằng port thực tế vừa liệt kê:
arduino-cli upload -p PORT --fqbn Seeeduino:mbed:xiaonRF52840Sense firmware/BandW_Sense
c++ -std=c++11 -Wall -Wextra -pedantic firmware/tests/gesture_test.cpp -o /tmp/bandw-gesture-test
/tmp/bandw-gesture-test
```

Đã compile thành công với core/thư viện trên: flash 336.328 byte (41%), RAM tĩnh 71.808 byte (30%). Kiểm thử trên máy tính đã qua các trường hợp trái/phải, giữ tư thế không lặp, bắt buộc về trung tính, ưu tiên lắc, chuyển động ngắn/chậm/nhiễu, dữ liệu không hợp lệ, reconnect và bộ đếm thời gian tràn. App Android build + lint không có lỗi (vẫn có warning về phiên bản và chuỗi giao diện).

Chưa nạp lên board, chưa thử BLE/IMU/TTS end-to-end trên phần cứng thật vì không có thiết bị kết nối ở thời điểm build. File `.bin` trong gói phát hành là binary để dùng với uploader tương thích; không kéo thả vào ổ bootloader UF2. Cách nạp được hướng dẫn ở trên là Upload sketch bằng Arduino IDE/CLI.

Tài liệu tham chiếu: [Seeed IMU](https://wiki.seeedstudio.com/XIAO-BLE-Sense-IMU-Usage/), [Seeed BLE với mbed](https://wiki.seeedstudio.com/XIAO-BLE-Sense-Bluetooth-Usage/), [quyền Bluetooth Android](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions).

## XIAO nRF52840 Sense Plus — core 2.9.3

Trên core 2.9.3 đã kiểm tra ở máy này, `variants/SEEED_XIAO_NRF52840_SENSE_PLUS/defines.txt` khai báo `TARGET_SEEED_XIAO_NRF52840_PLUS` thay vì `TARGET_SEEED_XIAO_NRF52840_SENSE_PLUS`. Thư viện IMU vì vậy chọn Wire (bus ngoài) thay vì Wire1 (IMU tích hợp), gây lỗi `LSM6DS3 not found`.

Dùng script để bổ sung cờ compile cho toàn bộ thư viện, không phải chỉ thêm `#define` vào sketch:

```sh
./firmware/scripts/build-sense-plus.sh
# Build và nạp; thay port nếu khác:
./firmware/scripts/build-sense-plus.sh /dev/cu.usbmodem1101
```

Binary dành cho Sense thường trong v0.2.0 không phải binary Sense Plus. Với Plus, dùng script trên để build và nạp đúng variant. Nếu dùng Arduino IDE, cần cấu hình cờ tương đương hoặc core đã sửa lỗi này.

Kiểm tra USB trên board người dùng ngày 2026-09-18: upload Sense Plus thành công; sau khi thêm cờ ở trên, firmware phản hồi lệnh `c` với `CALIBRATE`, xác nhận đã qua khởi tạo IMU/BLE và vào vòng lặp chính. Chưa xác nhận hiệu chuẩn hoàn tất hoặc các cử chỉ thực tế qua BLE.


Bản điều chỉnh độ nhạy: nghiêng 22°, giữ 250 ms, chờ chuyển động lắng 150 ms; lắc 100°/giây; nghỉ 650 ms và về trung tính 200 ms. Kiểm thử tổng hợp bổ sung xác nhận nghiêng ±25° nhận trong 600 ms, lắc ±110°/giây được nhận, và nhiễu nhỏ ±10°/±70°/giây không tạo lệnh. Chưa xác định tỉ lệ nhận đúng trên người đeo thực tế.

Hiệu chuẩn đã mở rộng để chấp nhận board dựng nghiêng trong mặt phẳng X/Z thay vì bắt buộc gần nằm ngang. Giữ yên ở tư thế bạn muốn dùng làm trung tính trong 2 giây; tránh để trục Y thẳng đứng (khi đó góc X/Z không xác định tốt). Hướng gắn board vẫn quyết định trục nghiêng trái/phải.


## Hiệu chuẩn qua BLE — app 0.3.0

Nút **Hiệu chuẩn vòng tay** gửi ASCII `CALIBRATE` đến characteristic `c91b0003-7d7a-4f8c-9d29-6e44c786a321` (Read + Write + Notify, tối đa 20 byte). Firmware trả `CALIBRATING` khi bắt đầu và `READY` khi đã lấy đủ 100 mẫu đứng yên. App subscribe cả characteristic cử chỉ lẫn trạng thái, rồi đọc trạng thái hiện tại để không bỏ lỡ hiệu chuẩn khi mới kết nối. Các thao tác GATT được thực hiện tuần tự.

Không thực hiện cử chỉ trong lúc hiệu chuẩn. Nếu thay cách đeo hoặc đổi tư thế tay trung tính, bấm nút này để lấy lại mốc. App chờ tối đa 30 giây; nếu chưa xong sẽ ngắt kết nối và hướng dẫn giữ yên/đổi tư thế để thử lại. Không có timer giả báo thành công: chỉ `READY` từ board mới báo hoàn tất.
