# Firmware BandW — XIAO nRF52840 Sense

MVP rule-based, không train AI. Dùng IMU LSM6DS3 tích hợp và BLE để gửi lệnh tới app Android BandW 0.3.0 (`YES`/`HELP` cần app 0.5.0 trở lên).

| Cử chỉ | Payload ASCII | Câu trên Android |
|---|---|---|
| Nghiêng tay trái, giữ khoảng 0,4–0,6 giây | `WATER` | Tôi muốn uống nước. |
| Nghiêng tay phải, giữ khoảng 0,4–0,6 giây | `FOOD` | Tôi muốn ăn. |
| Lắc cổ tay qua lại, 3 pha đảo chiều nhanh | `NO` | Không. |
| Gõ nhẹ 2 lần lên vòng tay khi tay ở tư thế trung tính | `YES` | Có. |
| Hạ cả cẳng tay xuống rồi nâng về trung tính (gập ở khuỷu tay), nhanh 2 lần liên tiếp trong 2 giây; hướng ngược lại (nâng lên rồi hạ về, 2 lần) cũng được | `HELP` | Tôi cần giúp đỡ. |

## Nạp bằng Arduino IDE

1. Trong Preferences → Additional Boards Manager URLs, thêm `https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json`.
2. Cài **Seeed nRF52 mbed-enabled Boards 2.9.3** trong Boards Manager.
3. Chọn **XIAO nRF52840 Sense (No Updates)** trong nhóm mbed. Không chọn nhóm **Seeed nRF52 Boards** cho sketch này.
4. Trong Library Manager, cài **ArduinoBLE 2.1.0** và **Seeed Arduino LSM6DS3 2.0.7**. Đây là các phiên bản đã dùng để compile.
5. Mở `BandW_Sense/BandW_Sense.ino`. Giữ `GestureDetector.h` cùng thư mục sketch.
6. Cắm XIAO bằng cáp USB truyền dữ liệu, chọn port của XIAO rồi Upload. Nếu không thấy port, nhấn Reset hai lần để vào bootloader rồi chọn lại port.
7. Giữ cổ tay ở tư thế trung tính, board đứng yên ít nhất 2 giây để hiệu chuẩn. Nếu board đã hiệu chuẩn trước khi app kết nối (ví dụ nằm trên bàn sau khi bật), firmware tự hiệu chuẩn lại một lần khi app đăng ký nhận lệnh. Firmware chạy cả khi không mở Serial Monitor.

Không cần nối thêm IMU. Hướng khởi đầu: mặt linh kiện hướng lên, đầu USB hướng về ngón tay. Hướng trục thực tế cần kiểm tra với cách đeo của bạn; nếu trái/phải bị đảo, đổi `TILT_SIGN` từ `1.0f` sang `-1.0f` trong `GestureDetector.h`; rồi nạp lại. `HELP` nhận cả hai chiều lên/xuống nên không phụ thuộc trục Y của board hướng về ngón tay hay khuỷu tay. Board nằm trên cẳng tay nên chỉ gập cổ tay (bàn tay) gần như không đổi góc đo được; cần nghiêng cả cẳng tay.

## Kết nối điện thoại

1. Cài APK BandW **0.3.0** đi kèm (bản 0.1.0 chỉ mô phỏng).
2. Bật Bluetooth. Trong app, bấm **Kết nối vòng tay**, cấp quyền nếu được hỏi.
3. Đợi quét 8 giây, chọn **BandW-Sense** đúng địa chỉ. Không cần pair trong Cài đặt Bluetooth.
4. Android 8–11 cần quyền và dịch vụ Vị trí bật để quét BLE. Android 12+ hỏi quyền Thiết bị ở gần.
5. Khi app báo sẵn sàng, giữ tay trung tính khoảng nửa giây rồi thử cử chỉ.
6. Sau mỗi lệnh, trở về trung tính và chờ khoảng 1 giây trước cử chỉ tiếp theo.

Bản app 0.3.0/0.4.0 ngắt BLE khi rời app, khóa màn hình hoặc xoay màn hình; đây là nguyên nhân chính của lỗi "tự ngắt sau vài câu". Bản app mới (0.5.0) giữ kết nối bằng dịch vụ nền có thông báo và giữ màn hình sáng khi đang kết nối. Mất kết nối không lưu hay phát lại cử chỉ cũ.

## Hiệu chỉnh và theo dõi

Serial Monitor **115200 baud**:
- `CALIBRATE`: cần giữ tay yên.
- `CALIBRATED`: đã lấy tư thế trung tính.
- `APP READY`: điện thoại đã đăng ký nhận notification.
- `TX WATER`, `TX FOOD`, `TX NO`, `TX YES`, `TX HELP`: firmware đã cập nhật characteristic; đây không phải xác nhận điện thoại đã đọc thành tiếng. `TX FAILED ...` nghĩa là gửi thất bại.
- `APP DISCONNECTED`, `ADVERTISING`: app đã ngắt, firmware đã quảng bá lại để kết nối lại được.
- `WARN: tap config failed`: không cấu hình được nhận gõ 2 lần; `YES` tắt, các cử chỉ khác vẫn chạy.
- Gửi ký tự `c` để hiệu chuẩn lại tư thế trung tính.
- Gửi `d` để bật/tắt log IMU 10 Hz (ax, ay, az tính bằng g; gx, gy, gz tính bằng °/giây), phục vụ hiệu chỉnh theo cử chỉ thực tế.

Log Serial là best-effort: chỉ gửi khi cổng USB đang mở, không bao giờ chờ máy tính đọc (gói quá 64 byte bị cắt, máy tính bận thì bỏ dòng log). Vì vậy log có thể thiếu dòng, nhưng không còn làm treo vòng lặp BLE.

LED tích hợp: nháy nhanh khi hiệu chuẩn, nháy chậm khi chờ app, chớp ngắn mỗi 2 giây khi đã hiệu chuẩn và app đã subscribe (tiết kiệm pin). Lỗi khởi tạo IMU/BLE: chớp ngắn mỗi giây; kiểm tra Serial và đúng loại board.

Thông số trong `GestureDetector.h`:
- `TILT_ENTER_DEG = 22`: góc nghiêng tối thiểu so với tư thế trung tính.
- `HOLD_MS = 250`: giữ góc đủ lâu sau khi chuyển động đã lắng; tổng thao tác thực tế thường lâu hơn 250 ms.
- `TILT_EXIT_DEG = 12`, `NEUTRAL_MS = 200`: ngưỡng và thời gian trở về trung tính.
- `SHAKE_DPS = 100`: tốc độ góc trục Y để đếm một pha lắc. Cần 3 pha luân phiên trong 900 ms, cách nhau ít nhất 80 ms.
- `COOLDOWN_MS = 650`: khoảng nghỉ sau một lệnh, sau đó vẫn phải về trung tính (cả nghiêng trái/phải lẫn gập trước/sau).
- Một pha lắc cần ít nhất 2 mẫu liên tiếp vượt `SHAKE_DPS`, nên một cú giật đơn lẻ (ví dụ cú gõ) không được tính.
- `MIN_PLANE_G = 0,4`: khi cẳng tay gần thẳng đứng (trọng lực dồn vào trục Y), góc trái/phải không xác định nên bị khóa, không phát `WATER`/`FOOD`.
- `PITCH_ENTER_DEG = 25`, `PITCH_EXIT_DEG = 12`, `DIP_MAX_MS = 700`, `HELP_WINDOW_MS = 2000`: `HELP` cần 2 lần nhấp cẳng tay cùng chiều, mỗi lần vượt 25° rồi về dưới 12° trong tối đa 0,7 giây, cả hai trong 2 giây. Giữ cẳng tay ở một góc (đặt tay lên đùi, đưa cốc lên miệng) không bao giờ tạo `HELP`.
- `AXIS_MARGIN_DEG = 8`: trục đang nghiêng phải lớn hơn trục kia ít nhất 8°; nghiêng chéo không tạo lệnh.
- `YES`: IMU tự nhận gõ 2 lần (accelerometer 416 Hz, ngưỡng `TAP_THS_6D = 0x06` ≈ 750 mg, khoảng cách 2 cú gõ tối đa ~540 ms). Firmware chỉ nhận khi tay ở trung tính, cánh tay không chuyển động (> `TAP_STILL_DPS` = 50°/giây, 2 mẫu liên tiếp) trong 300 ms trước (`TAP_QUIET_BEFORE_MS`) và không xoay nhanh trong 150 ms sau (`TAP_CONFIRM_MS`), nên lắc tay hay đặt tay xuống bàn không bị nhầm thành `YES`; cú giật 1 mẫu do chính cú gõ không làm mất `YES`. Gõ/đập 2 lần lên mặt bàn khi tay đang nằm yên trên bàn vẫn có thể bị nhận là `YES` (IMU không phân biệt được); cần kiểm tra trên vòng tay thật. Nếu hay bỏ sót, giảm ngưỡng xuống `0x04`; nếu nhận nhầm, tăng lên `0x0A` (hàm `setupTap()` trong sketch).
- Hiệu chuẩn: 100 mẫu (2 giây) quanh giá trị trung bình, sai lệch < 0,08 g, gyro < 20°/giây; cho phép tối đa 10 mẫu rung lắc trước khi đếm lại. Lưu cả X, Y, Z (Y dùng làm mốc cho `HELP`).

Board phải gắn chắc trên cổ tay. Nếu đặt xoay 90° so với hướng trên, cần đổi trục đọc cho tilt/shake; hiệu chuẩn chỉ đặt góc trung tính, không tự suy ra hướng đeo. Các ngưỡng là giá trị khởi đầu, chưa được đo với cử chỉ thực tế của người dùng.

## Chống mất kết nối

Lỗi "tự ngắt sau khoảng 3 câu" có nhiều nguyên nhân; firmware đã sửa các nguyên nhân phía vòng tay:
- Log Serial không còn chặn vòng lặp (trước đây `Serial.println` sau mỗi lệnh có thể treo khi máy tính mở cổng mà không đọc, làm `BLE.poll()` dừng và điện thoại ngắt kết nối).
- ArduinoBLE 2.1.0 không trả lại bộ đếm gói đang gửi (`_pendingPkt`) khi mất kết nối; sau vài lần ngắt, lần gửi tiếp theo bị kẹt vĩnh viễn. Firmware đặt lại bộ đếm khi ngắt và khi không có kết nối.
- Sau khi ngắt, firmware chủ động quảng bá lại (`ADVERTISING`) để app kết nối lại được.
- Watchdog phần cứng 4 giây: nếu vòng tay treo vì bất kỳ lý do nào, board tự khởi động lại thay vì "chết" đến khi tắt nguồn. Bootloader vẫn nạp được qua USB/web.
- Vòng lặp nghỉ 1 ms giữa các mẫu thay vì chạy 100% CPU; LED không sáng liên tục, đỡ sụt pin.
- Một mẫu IMU lỗi (kể cả I2C trả thiếu byte, gia tốc gần 0) chỉ bị bỏ qua; chỉ khi lỗi liên tục 1 giây mới hiệu chuẩn lại (tránh app chờ hiệu chuẩn vô cớ).

Phía app (ngắt khi khóa màn hình/xoay màn hình, ngắt khi hiệu chuẩn quá 30 giây) được sửa trong app Android, không phải trong firmware.

## Giao thức BLE

- Local name: `BandW-Sense`
- Service: `c91b0001-7d7a-4f8c-9d29-6e44c786a321`
- Characteristic: `c91b0002-7d7a-4f8c-9d29-6e44c786a321`
- Properties: Read + Notify; CCCD `0x2902`.
- Mỗi notification chứa đúng một chuỗi ASCII `WATER`, `FOOD`, `NO`, `YES` hoặc `HELP` (tối đa 8 byte), không có newline, không có byte NUL. App cũ không biết `YES`/`HELP` sẽ bỏ qua hai lệnh này.
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

Đã compile thành công với core/thư viện trên: Sense flash 339.216 byte (41%), RAM tĩnh 71.864 byte (30%); Sense Plus flash 338.632 byte, RAM 72.304 byte. Kiểm thử trên máy tính đã qua các trường hợp trái/phải, giữ tư thế không lặp, bắt buộc về trung tính, ưu tiên lắc, chuyển động ngắn/chậm/nhiễu, dữ liệu không hợp lệ, reconnect, bộ đếm thời gian tràn, cẳng tay thẳng đứng, `HELP` (2 lần nhấp cẳng tay; giữ tư thế 30–85° cả hai chiều, đưa cốc lên miệng, hiệu chuẩn nghiêng 45° đều đã thử), `YES` (kể cả cú giật 1 mẫu và đặt tay xuống bàn) và bộ hiệu chuẩn. App Android build + lint không có lỗi (vẫn có warning về phiên bản và chuỗi giao diện).

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

Không thực hiện cử chỉ trong lúc hiệu chuẩn. Nếu thay cách đeo hoặc đổi tư thế tay trung tính, bấm nút này để lấy lại mốc. Nếu chưa xong sau 30 giây, app hướng dẫn giữ yên/đổi tư thế để thử lại (bản app mới không ngắt kết nối). Không có timer giả báo thành công: chỉ `READY` từ board mới báo hoàn tất.

## Nạp qua web (không cần Arduino IDE)

Mở [BandW Web Flasher](https://longcao24.github.io/bandw/) bằng Chrome/Edge trên máy tính. Cắm board, xác nhận Sense Plus, chọn cổng USB. Trang gửi yêu cầu tự chuyển bootloader qua 1200 baud + DTR; chọn cổng nạp mới khi Chrome yêu cầu rồi bấm Nạp. Reset hai lần chỉ là phương án khôi phục khi firmware không phản hồi.

Kiểm thử ngày 2026-09-18: dùng chính `web/dfu.mjs` qua adapter serial trên máy Mac, board thật đã xác nhận toàn bộ gói firmware. Đã thử cả bắt đầu ở bootloader và tự chuyển từ firmware đang chạy (USB 8064 → 0065), không nhấn nút Reset. Đây là kiểm thử bộ nạp với thiết bị thật; chưa phải xác nhận hộp thoại Web Serial trên Windows.
