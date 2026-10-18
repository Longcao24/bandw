# Học BandW: trang ôn tập KHKT

Trang web giáo trình trực quan giúp đội thi KHKT (học sinh lớp 10–12, chưa cần biết lập trình) hiểu toàn bộ dự án vòng tay **BandW** và tự tin trả lời phản biện. Nội dung đi theo đường tín hiệu: cổ tay → cảm biến IMU → chip nRF52840 → Bluetooth Low Energy → điện thoại → giọng nói.

- Giao diện kiểu Khan Academy: **khoá học → chương → bài**. Mỗi bài gồm các thẻ ngắn, hoạt hình/mô phỏng, video có thuyết minh và bài tập chấm ngay.
- Có điểm năng lượng ⚡, chuỗi ngày học 🔥, mức thành thạo và chế độ **Luyện phản biện** bằng thẻ lật.
- **Không cần đăng nhập.** Mỗi máy tự tạo một *mã học tập* (128 bit ngẫu nhiên). Máy chủ chỉ lưu tiến độ, khoá bằng mã băm SHA-256 của mã đó.
- Câu hỏi và đáp án nằm sẵn trong mã giao diện (`public/content/`), không lưu trên máy chủ.

## Cấu trúc thư mục

```
khkt/
  public/              trang tĩnh (HTML + CSS + ES modules, không có bước build)
    content/           unit01.js … unit10.js: nội dung từng chương (người soạn nội dung)
    js/                router, renderer, bài tập, tiến độ, đồng bộ
    js/sims/           mô phỏng hoạt hình (người dựng mô phỏng)
    videos/            video .mp4 + ảnh bìa .jpg + phụ đề .vtt
  functions/api/       Cloudflare Pages Function: /api/progress
  schema.sql           bảng D1
  tests/               node --test
  video-src/           nguồn dựng video thuyết minh (không triển khai)
```

## Yêu cầu

- Node.js ≥ 20
- Tài khoản Cloudflare (chỉ khi triển khai thật)

## Chạy trên máy

```bash
cd khkt
npm install
```

### Tạo cơ sở dữ liệu D1 (một lần)

```bash
npx wrangler d1 create bandw-khkt-progress
```

Lệnh trên in ra `database_id`. Dán giá trị đó vào `wrangler.toml` (thay `REPLACE_WITH_D1_DATABASE_ID`).

### Chạy đầy đủ cả backend

```bash
npm run db:local     # tạo bảng trong D1 cục bộ
npm run dev          # http://localhost:8788
```

### Chỉ xem trang tĩnh (không có backend)

```bash
npm run serve        # http://localhost:8788
```

Khi không có backend, tiến độ vẫn lưu trong trình duyệt và thanh trạng thái hiện "📱 Chỉ lưu trên máy này".

## Kiểm thử

```bash
npm test
```

Bộ kiểm thử gồm:

| Tệp | Kiểm tra |
|---|---|
| `tests/content.test.mjs` | Toàn bộ giáo trình thật: định dạng id, id không trùng, đáp án hợp lệ, giới hạn độ dài, quy tắc "trực quan trước", thuật ngữ `[[…]]` tra được, SVG an toàn, hotspot và checkpoint tồn tại, mọi sim trong registry đã có tệp |
| `tests/api.test.mjs` | Pages Function với D1 giả lập: 404/200, tạo và gộp tiến độ, 400/413/415/403/429 (theo mã và theo IP)/405/503, hai thiết bị ghi cùng lúc không mất dữ liệu (so khớp `version`), OPTIONS không có header CORS, DB chỉ chứa mã băm |
| `tests/merge.test.mjs` | Gộp tiến độ giao hoán, lặp lại không đổi, làm sạch dữ liệu, điểm được tính lại |
| `tests/code.test.mjs` | Mã học tập: định dạng, chuẩn hoá (chữ thường, O/I/L), checksum, 1000 mã không trùng, mã băm cố định |
| `tests/exam.test.mjs` | Thi thử: sinh đề có hạt giống (cùng seed → cùng đề), phủ đủ mọi chương, giới hạn câu mô phỏng, chấm điểm từng dạng, gộp `exams` (hợp theo id, giao hoán, giữ 30 lần mới nhất), store, phiên làm bài, router, API |
| `tests/exam-bank.test.mjs` | Mọi câu trong `content/exam/bank.js`: định dạng, đáp án tự chấm đúng, hotspot/sim/checkpoint tồn tại, SVG an toàn, chương/bài liên kết có thật, đúng sự thật của HEAD (HELP = 2 lần nhấp, app nối lại không giới hạn) |
| `tests/detector.test.mjs` | Bản JS của thuật toán (dùng cho mô phỏng) chạy lại mọi ca trong `firmware/tests/gesture_test.cpp` |

Người soạn nội dung **phải chạy `npm test` trước khi bàn giao**. Lỗi được in rõ theo dạng `u03.l2.steps[5] (u03.l2.q4): …`.

## Thi thử

Mục **📝 Thi thử** (nút trên thanh đầu trang, thẻ lớn ở trang chủ, đường dẫn `#/exam`) giúp học sinh luyện như ngày thi:

| Kiểu | Đường dẫn | Nội dung |
|---|---|---|
| Đề tổng hợp | `#/exam/full` | 30 câu / 30 phút |
| Đề nhanh | `#/exam/quick` | 15 câu / 15 phút |
| Theo chương | `#/exam/unit/uNN` | 10 câu / 12 phút của một chương |
| Phản biện thử | `#/exam/defense` | 8 câu hỏi mở, 60 hoặc 90 giây/câu, tự chấm theo ý chính, có "giám khảo hỏi xoáy" |
| Kết quả | `#/exam/result/<id>` | Điểm, biểu đồ theo chương, chương yếu kèm bài cần ôn, xem lại từng câu |

- **Nguồn câu hỏi:** mọi bài tập tự chấm trong `content/unitNN.js` (không lấy flashcard) cộng ngân hàng riêng `content/exam/bank.js` (`questions`: câu tự chấm, `open`: câu hỏi mở, `FOLLOW_UPS`: câu hỏi xoáy). Câu trong ngân hàng ghi `unitId` + `lessonId` (bài cần ôn); **không** dùng khoá `unit` vì bài `number` dùng `unit` cho đơn vị đo.
- **Sinh đề** (`js/exam/generate.js`): ngẫu nhiên có hạt giống (seed = id lần thi), chia số câu theo chương tỉ lệ √(số câu của chương), mỗi chương ít nhất 1 câu, rải đều các bài, tối đa 2–3 câu mô phỏng `sim-predict` mỗi đề.
- **Khi làm bài:** dùng lại các bộ hiển thị bài tập ở chế độ thi (`createExercise(step, { mode: 'exam' })`: không ghi điểm, không báo đúng/sai, có `getAnswer`/`setAnswer`/`review`). Đồng hồ, bảng câu hỏi, đánh dấu xem lại, hỏi lại trước khi nộp, hết giờ tự nộp. Bài đang làm lưu trong trình duyệt (`bw.v1.exam.current`) nên tải lại trang vẫn tiếp tục, đồng hồ vẫn chạy.
- **Lưu và đồng bộ:** tiến độ có thêm `exams: { <id>: { m, at, s, n, d, u: { uNN: [đúng, tổng] }, uu? } }`, chỉ là **bản tóm tắt** (không có câu trả lời), giữ 30 lần mới nhất, gộp theo id. Bài làm chi tiết để xem lại chỉ nằm trên máy đã làm (8 lần gần nhất, `bw.v1.exam.details`).
- Người soạn đề: thêm câu vào `content/exam/bank.js` với id mới `x.qNN` / `x.d.qNN` (không đánh số lại), rồi chạy `npm test`.

## Triển khai lên Cloudflare Pages

Cách 1: dùng dòng lệnh.

```bash
npx wrangler login
npx wrangler d1 create bandw-khkt-progress   # chỉ lần đầu; dán database_id in ra vào wrangler.toml
npm run db:remote    # tạo bảng trên D1 thật
npm run deploy
```

Nếu `wrangler.toml` vẫn còn `REPLACE_WITH_D1_DATABASE_ID`, bản triển khai sẽ không nối được với D1.

**Đã tạo bảng bằng `schema.sql` cũ (giới hạn 32 768 ký tự)?** `CREATE TABLE IF NOT EXISTS` không sửa bảng đã có, nên trước khi triển khai bản này hãy chạy một lần `npm run db:migrate:remote` (và `npm run db:migrate:local` cho D1 cục bộ). Lệnh này dựng lại bảng `progress` với giới hạn 65 536 ký tự, khớp `MAX_BYTES` = 64 KB của API, và giữ nguyên dữ liệu. Nếu bỏ qua, mọi lần lưu từ 32 KB đến 64 KB sẽ bị lỗi `503`.

Cách 2: kết nối kho Git trong Cloudflare Pages dashboard.

1. **Root directory:** `khkt`. **Build command:** để trống. **Build output directory:** `public`.
2. Chạy `npx wrangler d1 create bandw-khkt-progress`, dán `database_id` thật vào `wrangler.toml` (thay `REPLACE_WITH_D1_DATABASE_ID`) rồi **commit** tệp đó. Vì dự án có `wrangler.toml` (có `pages_build_output_dir`), tệp này là nguồn cấu hình chính: binding `DB` lấy từ đây, còn mục D1 bindings trong dashboard chỉ để xem, không sửa được. Muốn quản lý binding trong dashboard thì phải xoá `wrangler.toml` khỏi kho.
3. Chạy `npm run db:remote` một lần để tạo bảng.

`public/_routes.json` chỉ cho `/api/*` chạy qua Function. Mọi tệp khác được phục vụ tĩnh. `public/_headers` đặt CSP và cache.

## API tiến độ

| Phương thức | Mô tả |
|---|---|
| `GET /api/progress` | Header `X-Learner-Code: <mã>` → `200 {progress, updatedAt}` hoặc `404` |
| `PUT /api/progress` | JSON tiến độ (≤ 64 KB) → máy chủ **gộp** với bản cũ và trả về bản đã gộp |

Mã học tập đi trong header, không nằm trong URL. Chỉ chấp nhận yêu cầu cùng nguồn (same-origin). Giới hạn 60 yêu cầu/phút cho mỗi mã học tập và 600 yêu cầu/phút cho mỗi IP (cả lớp dùng chung một IP trường vẫn đủ). Hai thiết bị ghi cùng lúc: máy chủ so khớp cột `version`, đọc lại và gộp lại; nếu vẫn tranh chấp thì trả `409` và trình duyệt tự gửi lại.

## Dựng video thuyết minh

Video nằm ở `public/videos/<id>.mp4|.jpg|.vtt` và được commit sẵn. Nguồn dựng nằm trong `video-src/` (lời đọc tiếng Việt `say -v Linh`, cảnh quay bằng Chromium, ghép bằng ffmpeg; chỉ chạy trên macOS).

```bash
npm run videos       # cd video-src && npm install && node render.mjs
```

Danh mục 8 video cố định nằm trong `public/js/videos.js`. Nếu một video chưa có, bài học tự hiện "Video đang được chuẩn bị" và chạy mô phỏng thay thế.

## Hướng dẫn cho người soạn nội dung

1. Mỗi người chỉ sửa tệp `public/content/unitNN.js` của mình. Tệp `export default` một object chương đúng schema trong tài liệu kỹ thuật (Implementation Spec v1.0, mục 4).
2. **Trực quan trước.** Mọi ý "nó hoạt động thế nào" phải là bước `sim`, `video` hoặc `diagram` kèm chú thích 1–3 câu. Bước `text` tối đa 3 câu, 400 ký tự, và không đứng cạnh một bước `text` khác.
3. Mỗi bài có 4–16 bước, ≥ 1 sim hoặc video, ≥ 2 bài tập có chấm điểm, nên có ≥ 1 bài tập trực quan (`hotspot`, `sim-predict` hoặc bài tập có `visual`), và kết thúc bằng ≥ 1 thẻ `flashcard` "Giám khảo hỏi: …".
4. Số liệu lấy đúng từ bảng sự thật (mục 0 của tài liệu kỹ thuật) và từ `firmware/BandW_Sense/GestureDetector.h`. Đoạn mã phải chép **nguyên văn** từ kho, có nhãn `source`.
5. **Không bịa kết quả thí nghiệm.** Ma trận nhầm lẫn dùng `data: 'demo'` và ghi rõ "minh hoạ". Thời lượng pin chưa đo thì nói là chưa đo.
6. Id dạng `uNN.lN.qN` (thẻ phản biện cấp chương: `uNN.d.qN`). **Không đánh số lại id đã phát hành**, vì tiến độ của học sinh gắn với id.
7. Thuật ngữ mới: lần đầu viết `thuật ngữ (English)`, thêm vào `glossary` của chương, và có thể dùng `[[thuật ngữ]]` để tạo chú giải bật lên.

## Quyền riêng tư

- Máy chủ chỉ lưu: mã băm SHA-256 của mã học tập + tiến độ (điểm, bài đã học, thẻ đã luyện, video đã xem, tóm tắt điểm thi thử). Không có tên, email, câu trả lời hay địa chỉ IP gốc (bộ giới hạn tốc độ chỉ lưu mã băm IP theo từng phút).
- Ai có mã học tập đều xem và ghi được tiến độ gắn với mã đó, nên học sinh cần giữ mã như một mật khẩu nhỏ.
- Nút "Xoá tiến độ trên máy này" chỉ xoá dữ liệu trong trình duyệt.
