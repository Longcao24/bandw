# TinyML cho BandW: quy trình

Mô hình nhỏ (softmax 16 đặc trưng → 5 lớp `NONE, WATER, FOOD, NO, HELP`, khoảng 300 byte) thay phần luật ngưỡng cho WATER/FOOD/NO/HELP. YES vẫn dùng bộ gõ đôi trong cảm biến. Kế hoạch và lý do nằm ở [`firmware/TINYML.md`](../firmware/TINYML.md).

**Trạng thái:** quy trình đã chạy được từ đầu đến cuối, nhưng **chưa có dữ liệu cử chỉ thật** nên chưa có mô hình để nạp. Firmware vẫn dùng luật.

## Vì sao cần

Chạy bộ nhận dạng bằng luật trên [UMAHand](https://doi.org/10.6084/m9.figshare.25638246.v3) (3,8 giờ, 25 người làm 29 việc tay thường ngày, cảm biến đeo cổ tay cùng hướng trục với BandW) cho kết quả:

| Firmware | Phát nhầm / giờ | WATER | FOOD | NO | HELP |
|---|---|---|---|---|---|
| v0.4.0 (3 cử chỉ) | 179 | 16 | 72 | 92 | – |
| 0.5.0 | 147 | 8 | 52 | 81 | 6 |
| 0.5.2 / 0.5.3 | 179 | 16 | 71 | 91 | 1 |

Luật ngưỡng không thể vừa nhạy vừa ít nhầm. Mô hình học được sự khác nhau giữa cử chỉ cố ý và sinh hoạt từ dữ liệu.

## Các bước

1. **Ghi dữ liệu:** mở <https://longcao24.github.io/bandw/live/>, kết nối vòng (firmware 0.5.3 trở lên), bấm *Hiệu chuẩn*, nhập mã người (P1, P2…), bấm *Bắt đầu phiên ghi*. Khoảng 10 phút/người với 10 lần mỗi cử chỉ. File `bandw-tinyml-P1-….csv` tự tải về.
2. **Thêm dữ liệu:** chép các file CSV vào `tinyml/data/recordings/`. Càng nhiều người càng tốt; tối thiểu 3–5 người thì phép đánh giá "người chưa thấy" mới có ý nghĩa.
3. **UMAHand** (dữ liệu "không phải cử chỉ"): giải nén `UMAHand_Dataset.zip` (figshare, CC BY 4.0) sao cho có `tinyml/data/umahand/TRACES/output_1/…`.
4. **Huấn luyện + đánh giá + xuất:**
   ```sh
   python3 -m venv tinyml/.venv && tinyml/.venv/bin/pip install numpy scikit-learn   # lần đầu
   tinyml/.venv/bin/python tinyml/bandw_tinyml.py
   ```
   In ra: đúng / nhầm lệnh / bỏ sót theo kiểu **bỏ ra một người** (người kiểm tra không có trong dữ liệu huấn luyện), số lần phát nhầm khi "làm việc bình thường", số lần phát nhầm mỗi giờ trên 7 người UMAHand chưa thấy, và so với luật (cột `event` vòng tay đã ghi). Xuất `tinyml/out/bandw_model.h`.
5. **Kiểm tra C++ khớp Python:**
   ```sh
   c++ -std=c++11 -O2 -Itinyml/out -Ifirmware/BandW_Sense tinyml/parity_test.cpp -o /tmp/parity && /tmp/parity tinyml/out/parity.json
   ```
6. **Đưa lên vòng:** chép `tinyml/out/bandw_model.h` vào `firmware/BandW_Sense/`, nối `TinyGesture.h` vào vòng lặp, build và nạp **bằng trang web như bình thường** (mô hình biên dịch chung vào file `.bin`).

Chỉ thay luật bằng mô hình khi số liệu ở bước 4 tốt hơn rõ ràng trên người chưa thấy.

`--selftest` chạy cả quy trình trên dữ liệu **giả lập** để kiểm tra code; con số in ra khi đó không nói gì về tay thật.

## Dữ liệu và quyền riêng tư

`tinyml/data/` và `tinyml/out/` không được commit (`.gitignore`). File ghi chỉ có số đo chuyển động và mã người tự đặt; nên xin đồng ý của người được ghi và không dùng tên thật.
