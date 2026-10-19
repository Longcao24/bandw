// public/content/exam/bank.js — Ngân hàng câu hỏi CHỈ dùng cho "Thi thử" (không xuất hiện trong bài học).
// Mọi con số lấy từ HEAD 4a0285a: firmware/BandW_Sense/GestureDetector.h, BandW_Sense.ino, firmware/README.md
// và app/src/main/java/com/bandw/demo/*.java. Mỗi câu gắn với một chương (`unit`) và bài cần ôn (`lesson`)
// (`unitId`, `lessonId`; KHÔNG dùng `unit` vì bài tập `number` dùng `unit` cho đơn vị đo) để trang kết quả chỉ đúng chỗ. Id dạng x.qNN (tự chấm) và x.d.qNN (câu hỏi mở cho Phản biện thử).
// Không đánh số lại id đã phát hành: kết quả thi cũ của học sinh trỏ tới các id này.

// ---------- hình vẽ riêng của đề thi (chỉ dùng biến màu CSS nên chạy được ở chế độ tối) ----------
const SVG_BACKOFF = `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img">
  <line x1="30" y1="150" x2="620" y2="150" stroke="currentColor" stroke-width="2"/>
  <text x="30" y="30" font-size="15" font-weight="700" fill="currentColor">App tự nối lại sau khi mất kết nối (giây chờ trước mỗi lần thử)</text>
  <g font-size="14" fill="currentColor" text-anchor="middle">
    <rect x="40" y="128" width="16" height="22" rx="3" fill="var(--c-primary)"/><text x="48" y="120">1</text>
    <rect x="66" y="116" width="16" height="34" rx="3" fill="var(--c-primary)"/><text x="74" y="108">2</text>
    <rect x="92" y="100" width="16" height="50" rx="3" fill="var(--c-primary)"/><text x="100" y="92">4</text>
    <rect x="118" y="80" width="16" height="70" rx="3" fill="var(--c-primary)"/><text x="126" y="72">8</text>
    <rect x="144" y="62" width="16" height="88" rx="3" fill="var(--c-primary)"/><text x="152" y="54">15</text>
    <rect x="170" y="62" width="16" height="88" rx="3" fill="var(--c-primary)"/><text x="178" y="54">15</text>
    <rect x="230" y="44" width="16" height="106" rx="3" fill="var(--c-warn)"/><text x="238" y="38">30</text>
    <rect x="290" y="44" width="16" height="106" rx="3" fill="var(--c-warn)"/><text x="298" y="38">30</text>
    <rect x="350" y="44" width="16" height="106" rx="3" fill="var(--c-warn)"/><text x="358" y="38">30</text>
    <text x="440" y="100">…</text>
  </g>
  <text x="40" y="176" font-size="14" fill="currentColor">6 lần thử nhanh</text>
  <text x="230" y="176" font-size="14" fill="currentColor">sau đó: 30 giây một lần, không giới hạn</text>
  <rect x="470" y="58" width="150" height="56" rx="10" fill="var(--c-danger-bg)" stroke="var(--c-danger)" stroke-width="2"/>
  <text x="545" y="82" font-size="14" font-weight="700" text-anchor="middle" fill="currentColor">Chỉ dừng khi bấm</text>
  <text x="545" y="102" font-size="14" font-weight="700" text-anchor="middle" fill="currentColor">"Ngắt kết nối"</text>
</svg>`;

const SVG_DIPS = `<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img">
  <line x1="50" y1="200" x2="620" y2="200" stroke="currentColor" stroke-width="2"/>
  <line x1="50" y1="20" x2="50" y2="200" stroke="currentColor" stroke-width="2"/>
  <text x="58" y="34" font-size="14" fill="currentColor">|góc gập| đã lọc</text>
  <line x1="50" y1="90" x2="620" y2="90" stroke="var(--viz-enter)" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="6" y="95" font-size="14" fill="var(--viz-enter)">25°</text>
  <line x1="50" y1="150" x2="620" y2="150" stroke="var(--viz-exit)" stroke-width="2" stroke-dasharray="2 5"/>
  <text x="6" y="155" font-size="14" fill="var(--viz-exit)">12°</text>
  <polyline points="50,190 90,190 110,60 150,60 170,190 250,190 270,60 470,60 500,190 620,190" fill="none" stroke="var(--viz-y)" stroke-width="4" stroke-linejoin="round"/>
  <text x="96" y="50" font-size="14" fill="currentColor">A: 0,4 s</text>
  <text x="300" y="50" font-size="14" fill="currentColor">B: cẳng tay giữ yên 1,5 s rồi mới về</text>
</svg>`;

const SVG_BUG = `<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img">
  <line x1="30" y1="110" x2="610" y2="110" stroke="currentColor" stroke-width="2"/>
  <g font-size="14" fill="currentColor">
    <circle cx="60" cy="110" r="9" fill="var(--c-success)"/><text x="40" y="90">Nối xong</text>
    <circle cx="160" cy="110" r="9" fill="var(--c-primary)"/><text x="132" y="140">đọc 1</text>
    <circle cx="240" cy="110" r="9" fill="var(--c-primary)"/><text x="212" y="140">đọc 2</text>
    <circle cx="320" cy="110" r="9" fill="var(--c-primary)"/><text x="292" y="140">đọc 3</text>
    <rect x="380" y="96" width="110" height="28" rx="6" fill="var(--c-surface-2)" stroke="currentColor"/><text x="392" y="115">🌙 màn hình tắt</text>
    <circle cx="560" cy="110" r="11" fill="var(--c-danger)"/><text x="512" y="90">mất kết nối</text>
    <text x="390" y="160">khoảng 30 giây không chạm</text>
  </g>
</svg>`;

const SVG_PRIORITY = `<svg viewBox="0 0 640 120" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img">
  <g font-size="14" font-weight="700" text-anchor="middle" fill="currentColor">
    <rect x="10" y="30" width="110" height="56" rx="10" fill="var(--c-surface-2)" stroke="currentColor"/><text x="65" y="63">Chờ trung tính</text>
    <rect x="140" y="30" width="110" height="56" rx="10" fill="var(--c-surface-2)" stroke="currentColor"/><text x="195" y="63">? (1)</text>
    <rect x="270" y="30" width="110" height="56" rx="10" fill="var(--c-surface-2)" stroke="currentColor"/><text x="325" y="63">? (2)</text>
    <rect x="400" y="30" width="110" height="56" rx="10" fill="var(--c-surface-2)" stroke="currentColor"/><text x="455" y="63">? (3)</text>
    <rect x="530" y="30" width="100" height="56" rx="10" fill="var(--c-surface-2)" stroke="currentColor"/><text x="580" y="63">Nghiêng</text>
  </g>
</svg>`;

// Câu hỏi "xoáy" của giám khảo cho thẻ phản biện có sẵn trong giáo trình: chọn theo từ khoá trong câu hỏi.
export const FOLLOW_UPS = [
  { match: 'HELP|giúp đỡ|nhấp|gập', prompt: 'Bản đầu tiên của HELP là “gập cổ tay về trước và giữ 400 ms”. Vì sao nhóm bỏ cách đó?',
    answer: 'Giữ một góc là tư thế rất hay gặp: đưa tay lên miệng uống nước, đặt cẳng tay lên đùi. Bản cũ vì vậy dễ gọi giúp nhầm. Bản mới cần **2 lần nhấp nhanh cùng chiều** (qua 25°, về dưới 12°, mỗi lần ≤ 700 ms, cả hai trong 2 giây), nên giữ yên một tư thế không bao giờ thành HELP.' },
  { match: 'ngắt|kết nối|Bluetooth|BLE|nối lại', prompt: 'Trước đây app hay mất kết nối sau khoảng 3 lần đọc. Nguyên nhân thật là gì và nhóm sửa thế nào?',
    answer: 'Nguyên nhân chính: hàm `onStop()` của app đóng BLE khi **màn hình tự tắt** (~30 giây). Nhóm chuyển kết nối vào **dịch vụ chạy nền** `BandLinkService`, giữ màn hình sáng khi đang nối, và tự nối lại 1, 2, 4, 8, 15, 15 giây rồi 30 giây một lần. Firmware cũng được sửa: log USB không chặn, xoá bộ đếm gói `_pendingPkt` bị kẹt, thêm watchdog 4 giây.' },
  { match: 'gõ|YES', prompt: 'Gõ 2 lần lên mặt bàn trong khi tay nằm yên thì sao?',
    answer: 'Đó là **hạn chế đã biết**: tay nằm yên thì con quay không thấy cử động, nên hai cú gõ lên bàn có thể giống gõ đôi và ra YES. Firmware đã chặn trường hợp **đặt tay xuống bàn** (xoay > 50 °/s trong 2 mẫu liền trong 300 ms trước cú gõ), nhưng chưa chặn được gõ bàn khi tay yên. Nhóm nói thẳng và đưa vào kế hoạch thử nghiệm.' },
  { match: 'lắc|\\bNO\\b', prompt: 'Một cú giật tay mạnh có bị đếm là một pha lắc không?',
    answer: 'Không. Một pha lắc cần tốc độ quay trục Y vượt ±100 °/s trong **2 mẫu liên tiếp** (40 ms). Cú giật hay cú gõ chỉ chạm 1 mẫu nên không được đếm. Các pha còn phải đổi chiều, cách nhau ≥ 80 ms và đủ 3 pha trong 900 ms.' },
  { match: 'hiệu chuẩn|trung tính|calib', prompt: 'Nếu bật vòng tay khi nó đang nằm trên bàn rồi mới đeo thì mốc trung tính có sai không?',
    answer: 'Firmware xử lý trường hợp này: lần hiệu chuẩn làm **trước khi app kết nối** sẽ được **làm lại một lần** khi app đăng ký nhận lệnh, lúc đó vòng tay thường đã được đeo. Người dùng cũng có thể bấm “Hiệu chuẩn” trong app bất cứ lúc nào.' },
  { match: 'code|loop\\(|firmware|watchdog|treo', prompt: 'Nếu chip bị treo giữa chừng thì vòng tay có “chết” luôn không?',
    answer: 'Không. Firmware bật **watchdog 4 giây** của nRF52: mỗi vòng `loop()` đều “cho ăn” watchdog. Nếu chương trình kẹt quá 4 giây (I2C, ngăn xếp BLE…), chip tự khởi động lại thay vì đứng im.' },
  { match: 'thí nghiệm|độ chính xác|kết quả|kiểm thử|chạy đúng', prompt: 'Kiểm thử tổng hợp đạt hết thì có nghĩa là vòng tay chính xác 100% không?',
    answer: 'Không. Kiểm thử tổng hợp chỉ chứng minh **thuật toán làm đúng luật** với dữ liệu do máy tính tạo ra. Độ chính xác trên người thật phải đo bằng thí nghiệm: nhiều người, nhiều lần, có ghi lệnh nhầm và lệnh bị bỏ sót, rồi báo cáo bằng ma trận nhầm lẫn.' },
  { match: 'pin|chi phí|bao nhiêu tiền', prompt: 'Vòng tay dùng pin được bao lâu?',
    answer: 'Mã nguồn **không có số đo pin**, nên em không đoán. Em nói cách đo: sạc đầy, đeo và kết nối liên tục, ghi thời điểm vòng tay tắt; lặp lại vài lần. Nếu chưa đo thì nói rõ “nhóm chưa đo”.' },
];
export const GENERIC_FOLLOW_UP = {
  prompt: 'Con số em vừa nói lấy từ đâu? Nếu giá trị đó sai thì điều gì xảy ra?',
  answer: 'Chỉ ra **tên hằng số** trong `GestureDetector.h` hoặc dòng code trong app (ví dụ `HOLD_MS = 250`). Rồi nói tác động: số nhỏ quá thì dễ phát lệnh nhầm, lớn quá thì chậm và mỏi tay. Kết thúc bằng: đây là giá trị khởi đầu, nhóm chỉnh qua thí nghiệm.',
};

export default {
  id: 'exam',
  // ───────────────────────── câu hỏi tự chấm ─────────────────────────
  questions: [
    // ---- Chương 1: ý tưởng ----
    { id: 'x.q01', unitId: 'u01', lessonId: 'l2', type: 'match', prompt: 'Ghép mỗi cử chỉ với **lệnh** vòng tay gửi qua Bluetooth.',
      pairs: [['Nghiêng tay trái', 'WATER'], ['Nghiêng tay phải', 'FOOD'], ['Lắc cổ tay', 'NO'], ['Gõ 2 lần', 'YES'], ['Hạ cẳng tay rồi nâng lại, 2 lần', 'HELP']],
      explanation: 'Năm cử chỉ ứng với năm lệnh trong `GestureCommand.java`. HELP là hai lần nhấp cẳng tay nhanh, không còn là “gập cổ tay rồi giữ”.' },
    { id: 'x.q02', unitId: 'u01', lessonId: 'l2', type: 'mcq', prompt: 'Trên màn hình app, nhãn của lệnh HELP ghi gì?',
      options: ['↓ Gập cổ tay xuống', '↕ Hạ cẳng tay rồi nâng lại, 2 lần', '✌ Gõ 2 lần', '⤓ Giữ cổ tay 400 ms'], answer: 1,
      explanation: 'Trong `GestureCommand.java`: `HELP("Tôi cần giúp đỡ.", "↕ Hạ cẳng tay rồi nâng lại, 2 lần", …)`. “Gập và giữ” là bản nháp cũ đã bị thay.' },
    { id: 'x.q03', unitId: 'u01', lessonId: 'l1', type: 'multi', prompt: 'Câu nào là cách giới thiệu **trung thực** về BandW trước giám khảo?',
      options: ['Vòng tay dựa trên luật, giải thích được từng quyết định', 'Đã kiểm thử bằng dữ liệu tổng hợp; độ chính xác trên người thật đang cần đo', 'Thiết bị AI y tế được chứng nhận', 'Không cần Internet: chỉ vòng tay và điện thoại', 'Nhận đúng 100% cử chỉ'],
      answers: [0, 1, 3],
      explanation: 'BandW dùng luật (không phải AI), chưa là thiết bị y tế và chưa có số đo độ chính xác trên người. Lệnh đi thẳng từ vòng tay tới điện thoại qua BLE nên không cần Internet.' },

    // ---- Chương 2: toàn hệ thống ----
    { id: 'x.q04', unitId: 'u02', lessonId: 'l1', type: 'order', prompt: 'Sắp xếp đường đi của lệnh HELP từ cổ tay tới loa.',
      items: ['Cẳng tay nhấp xuống 2 lần', 'IMU đo gia tốc và tốc độ xoay', 'nRF52840 chạy GestureDetector, ra HELP', 'BLE gửi thông báo chữ "HELP"', 'App đổi thành "Tôi cần giúp đỡ." và đọc to'],
      explanation: 'Vòng tay tự quyết định cử chỉ và chỉ gửi 4 chữ cái. Câu tiếng Việt và giọng đọc do điện thoại tạo ra.' },
    { id: 'x.q05', unitId: 'u02', lessonId: 'l2', type: 'hotspot', prompt: 'Một cái máy kẹt quá 4 giây sẽ bị **watchdog** khởi động lại. Watchdog nằm trong chip nào? Chạm vào chip đó.',
      target: { kind: 'diagram', name: 'xiao-board' }, answer: 'mcu',
      explanation: 'Watchdog (WDT) là một khối phần cứng của chip nRF52840. Firmware cấu hình nó 4000 ms và “cho ăn” ở đầu mỗi vòng loop().' },
    { id: 'x.q06', unitId: 'u02', lessonId: 'l4', type: 'mcq', prompt: 'Vòng tay đang nối, đèn chớp ngắn mỗi 2 giây, nhưng điện thoại **không phát tiếng** dù màn hình hiện đúng lệnh. Lỗi nằm ở chặng nào?',
      visual: { kind: 'diagram', name: 'system-blocks', alt: 'Sơ đồ khối: cổ tay, IMU, chip nRF52840, sóng BLE, điện thoại, loa.' },
      options: ['Cảm biến IMU', 'Thuật toán trên chip', 'Sóng Bluetooth', 'Giọng đọc (TTS) hoặc loa của điện thoại'], answer: 3,
      explanation: 'Màn hình đã hiện đúng lệnh nghĩa là cảm biến, thuật toán và BLE đều chạy. Chỉ còn chặng cuối: TextToSpeech tiếng Việt (vi-VN) chưa cài hoặc âm lượng/loa.' },
    { id: 'x.q07', unitId: 'u02', lessonId: 'l3', type: 'truefalse', prompt: 'Muốn đổi câu “Tôi muốn ăn.” thành “Cho tôi ăn với.”, nhóm phải nạp lại firmware cho vòng tay.',
      answer: false,
      explanation: 'Sai. Firmware chỉ gửi chữ `FOOD`. Câu tiếng Việt nằm trong bảng `GestureCommand` của app, nên chỉ cần sửa và cài lại app.' },

    // ---- Chương 3: cảm biến ----
    { id: 'x.q08', unitId: 'u03', lessonId: 'l3', type: 'hotspot', prompt: 'HELP đo góc **gập** của cẳng tay bằng `asin(y/|a|)`. Chạm vào trục mà công thức này dùng.',
      target: { kind: 'diagram', name: 'imu-axes' }, answer: 'axis-y',
      explanation: 'Trục Y chạy dọc cẳng tay. Hạ hay nâng cẳng tay làm Y chúi xuống hoặc ngóc lên, nên y/|a| đổi nhiều nhất.' },
    { id: 'x.q09', unitId: 'u03', lessonId: 'l3', type: 'mcq', prompt: 'Bộ lọc góc gập (pitch) **bỏ qua** một mẫu khi nào?',
      options: ['Khi con quay vượt 100 °/s', 'Khi độ lớn gia tốc |a| nằm ngoài 0,5–1,5 g', 'Khi góc nghiêng trái/phải vượt 22°', 'Không bao giờ bỏ qua'], answer: 1,
      explanation: 'Cú va (|a| khác xa 1 g) không nói gì về góc cẳng tay. Firmware chỉ cập nhật `filteredPitch` khi 0,5 < |a| < 1,5 g, nên một cú đập không giả được một lần nhấp HELP.' },
    { id: 'x.q10', unitId: 'u03', lessonId: 'l4', type: 'number', prompt: 'Một pha lắc cần tốc độ quay trục Y vượt ngưỡng trong **2 mẫu liên tiếp**. Lấy mẫu 50 lần mỗi giây, 2 mẫu kéo dài bao nhiêu mili giây?',
      answer: 40, tolerance: 0, unit: 'ms', hint: 'Mỗi mẫu cách nhau `SAMPLE_MS = 20` ms.',
      explanation: '2 × 20 ms = 40 ms. Cú giật hay cú gõ thường chỉ chạm 1 mẫu, nên không bị đếm thành pha lắc.' },
    { id: 'x.q11', unitId: 'u03', lessonId: 'l6', type: 'multi', prompt: 'Một mẫu được nhận vào **hiệu chuẩn** khi thoả những điều kiện nào?',
      options: ['|a| trong khoảng 0,85–1,15 g', 'Cả ba trục con quay dưới 20 °/s', 'Sát trung bình đang có (lệch dưới 0,08 g mỗi trục)', 'Góc nghiêng vượt 22°', 'Đã có app kết nối'],
      answers: [0, 1, 2],
      explanation: 'Đó là điều kiện trong `Calibrator::add()` (thêm √(x²+z²) > 0,6). Hiệu chuẩn chạy cả khi chưa có app; nếu làm trước khi app nối, nó được làm lại một lần khi app đăng ký nhận lệnh.' },
    { id: 'x.q12', unitId: 'u03', lessonId: 'l6', type: 'number', prompt: 'Hiệu chuẩn chịu được tối đa bao nhiêu mẫu rung (bị loại) trước khi đếm lại từ đầu?',
      answer: 10, tolerance: 0, unit: 'mẫu',
      explanation: '`MAX_REJECTS = 10`: một chút run tay không làm hỏng cả lần hiệu chuẩn, nhưng quá 10 mẫu xấu thì bắt đầu lại 100 mẫu.' },
    { id: 'x.q13', unitId: 'u03', lessonId: 'l2', type: 'mcq', prompt: 'Cẳng tay dựng gần thẳng đứng thì √(x²+z²) nhỏ. Dưới **0,4 g** firmware làm gì?',
      options: ['Phát HELP', 'Đóng băng góc nghiêng và khoá WATER/FOOD', 'Tự hiệu chuẩn lại', 'Gửi lệnh lỗi cho app'], answer: 1,
      explanation: 'Khi `level` sai (`MIN_PLANE_G = 0.4`), góc atan2(x, z) chỉ còn nhiễu, nên firmware giữ nguyên góc đã lọc và không xét nghiêng.' },

    // ---- Chương 4: lập trình ----
    { id: 'x.q14', unitId: 'u04', lessonId: 'l2', type: 'match', prompt: 'Ghép hằng số trong `GestureDetector.h` với giá trị của nó.',
      pairs: [['PITCH_ENTER_DEG', '25°'], ['DIP_MAX_MS', '700 ms'], ['HELP_WINDOW_MS', '2000 ms'], ['TAP_STILL_DPS', '50 °/s'], ['COOLDOWN_MS', '650 ms']],
      explanation: 'Đọc thẳng từ đầu tệp GestureDetector.h. Đổi số là đổi hành vi, nên đây là những “núm vặn” của thuật toán.' },
    { id: 'x.q15', unitId: 'u04', lessonId: 'l3', type: 'predict', prompt: 'Một lần nhấp vừa xong: `pitch` vừa xuống dưới 12°, `now - dipStart = 820`. Biến `dips` sau đoạn này bằng mấy? (trước đó `dips = 1`)',
      language: 'cpp', code: 'else if (pitch < PITCH_EXIT_DEG) {\n    if (uint32_t(now - dipStart) > DIP_MAX_MS) dips = 0;\n    else {\n        if (!dips) { firstDipAt = dipStart; pairDir = dipDir; }\n        if (++dips >= 2) return emit(Gesture::Help, now);\n    }\n    dipDir = 0;\n}', highlight: [2],
      options: ['0: lần nhấp quá chậm nên bị huỷ', '1: giữ nguyên', '2: phát HELP', '3'], answer: 0,
      explanation: '820 > 700 (`DIP_MAX_MS`) nên lần nhấp quá chậm và `dips = 0`. Hạ tay chậm, như khi uống nước, không được tính.' },
    { id: 'x.q16', unitId: 'u04', lessonId: 'l5', type: 'hotspot', prompt: 'Trong vòng `loop()`, bước nào giữ cho watchdog **không** khởi động lại chip? Chạm vào bước đó.',
      target: { kind: 'diagram', name: 'loop-flow' }, answer: 'kick',
      explanation: 'Dòng đầu loop(): `NRF_WDT->RR[0] = WDT_RR_RR_Reload;` “cho ăn” watchdog. Nếu loop() kẹt quá 4 giây, không ai cho ăn nữa và chip tự khởi động lại.' },
    { id: 'x.q17', unitId: 'u04', lessonId: 'l6', type: 'predict', prompt: 'Tay vừa xoay mạnh 60 °/s trong 2 mẫu liền rồi gõ đôi ngay sau đó 100 ms (tay đang ở trung tính). Cú gõ có được ghi nhận chờ xác nhận không?',
      language: 'cpp', code: 'stirRun = speed > TAP_STILL_DPS ? stirRun + 1 : 0;\nif (stirRun >= 2) lastStir = now;\n// …\nif (doubleTap && !tapPending && rest\n    && uint32_t(now - lastStir) >= TAP_QUIET_BEFORE_MS) {\n    tapPending = true; tapAt = now;\n}', highlight: [5],
      options: ['Có, vì tay đang ở trung tính', 'Không, vì mới 100 ms kể từ lần cử động (cần 300 ms)', 'Có, nhưng phát NO', 'Không, vì 60 °/s vượt ngưỡng lắc'], answer: 1,
      explanation: '60 > 50 (`TAP_STILL_DPS`) trong 2 mẫu nên `lastStir` được cập nhật. 100 ms < 300 ms (`TAP_QUIET_BEFORE_MS`) nên bỏ qua cú gõ, ví dụ khi vừa đặt tay xuống bàn.' },
    { id: 'x.q18', unitId: 'u04', lessonId: 'l1', type: 'mcq', prompt: 'Trong firmware, biến `dips` dùng để làm gì?',
      options: ['Đếm số lần nhấp cẳng tay hợp lệ đang có cho HELP', 'Đếm số pha lắc', 'Lưu góc nghiêng đã lọc', 'Đếm số mẫu hiệu chuẩn'], answer: 0,
      explanation: '`dips` tăng sau mỗi lần nhấp hợp lệ; đủ 2 (cùng chiều, trong 2000 ms) thì phát HELP. Pha lắc dùng `shakePulses`.' },

    // ---- Chương 5: thuật toán ----
    { id: 'x.q19', unitId: 'u05', lessonId: 'l6', type: 'mcq', prompt: 'Nhìn đồ thị. Tín hiệu nào được tính là **một lần nhấp** HELP?',
      visual: { kind: 'diagram', svg: SVG_DIPS, alt: 'Đồ thị góc gập: đoạn A vọt qua 25° rồi về dưới 12° sau 0,4 giây; đoạn B vượt 25° rồi giữ yên 1,5 giây mới về.' },
      options: ['Chỉ A', 'Chỉ B', 'Cả A và B', 'Không đoạn nào'], answer: 0,
      explanation: 'Một lần nhấp phải ra quá 25° rồi về dưới 12° trong tối đa 700 ms. A mất 0,4 s nên hợp lệ; B giữ 1,5 s, như đưa tay lên miệng uống nước, nên bị bỏ.' },
    { id: 'x.q20', unitId: 'u05', lessonId: 'l6', type: 'truefalse', prompt: 'Một lần nhấp **xuống** rồi một lần nhấp **lên** (ngược chiều) trong 1 giây vẫn phát HELP.',
      answer: false,
      explanation: 'Sai. Hai lần nhấp phải **cùng chiều** (`dipDir == pairDir`). Lần nhấp ngược chiều làm `dips = 0`. Nhờ vậy một động tác đưa tay lên rồi xuống bình thường không thành HELP.' },
    { id: 'x.q21', unitId: 'u05', lessonId: 'l6', type: 'truefalse', prompt: 'HELP nhận cả hai chiều: hai lần nhấp **xuống** hoặc hai lần nhấp **lên** đều được.',
      answer: true,
      explanation: 'Đúng. Firmware dùng |góc gập| để bắt đầu một lần nhấp và chỉ yêu cầu hai lần cùng chiều. Vì vậy HELP không phụ thuộc chiều +Y trên bo mạch, không cần hằng số đổi chiều riêng như `TILT_SIGN`.' },
    { id: 'x.q22', unitId: 'u05', lessonId: 'l8', type: 'mcq', prompt: 'Vì sao nhóm **bỏ** bản HELP cũ “gập cổ tay về trước và giữ 400 ms”?',
      options: ['Vì chip không đủ nhanh để đếm 400 ms', 'Vì giữ một góc là tư thế hay gặp (uống nước, đặt tay lên đùi) nên dễ gọi giúp nhầm', 'Vì giám khảo yêu cầu', 'Vì cảm biến không đo được góc gập'], answer: 1,
      explanation: 'Thử với tình huống thật cho thấy tư thế giữ yên rất phổ biến. HELP là lệnh khẩn nên phải khó xảy ra tình cờ: hai lần nhấp nhanh cùng chiều.' },
    { id: 'x.q23', unitId: 'u05', lessonId: 'l8', type: 'multi', prompt: 'Tình huống nào **không** tạo HELP với luật mới?',
      options: ['Đưa cốc lên miệng uống nước 2 lần, mỗi lần giữ 1 giây', 'Đặt cẳng tay lên đùi và để yên', 'Hạ cẳng tay nhanh rồi nâng lại, 2 lần trong 1,5 giây', 'Một cú đập tay xuống bàn (|a| > 1,5 g)'],
      answers: [0, 1, 3],
      explanation: 'Giữ lâu hơn 700 ms không phải lần nhấp; để yên không bao giờ là lần nhấp; cú đập bị bộ lọc pitch bỏ qua. Chỉ hai lần nhấp nhanh cùng chiều trong 2 giây mới là HELP.' },
    { id: 'x.q24', unitId: 'u05', lessonId: 'l5', type: 'mcq', prompt: 'Người dùng **đặt tay xuống bàn** (tay quay nhanh khoảng 80 °/s), cú chạm bàn làm chip báo gõ đôi. Firmware làm gì?',
      options: ['Phát YES ngay', 'Phát YES sau 150 ms', 'Bỏ qua: tay vừa cử động > 50 °/s trong 2 mẫu liền trong 300 ms trước', 'Phát NO'], answer: 2,
      explanation: 'Đây là lý do có `TAP_STILL_DPS = 50` và `TAP_QUIET_BEFORE_MS = 300`. Cú gõ chỉ được nhận khi tay đã yên ít nhất 300 ms.' },
    { id: 'x.q25', unitId: 'u05', lessonId: 'l5', type: 'truefalse', prompt: 'Hạn chế đã biết: khi tay nằm **yên** trên bàn, hai lần gõ vào mặt bàn có thể bị hiểu là gõ đôi và phát YES.',
      answer: true,
      explanation: 'Đúng. Tay yên nên con quay không thấy cử động gì, còn chip IMU chỉ thấy hai cú sốc. Nhóm nêu thẳng hạn chế này và đưa vào thí nghiệm.' },
    { id: 'x.q26', unitId: 'u05', lessonId: 'l4', type: 'number', prompt: 'Lắc cổ tay cần đủ bao nhiêu **pha** đổi chiều trong 900 ms để phát NO?',
      answer: 3, tolerance: 0, unit: 'pha',
      explanation: '`if (shakePulses >= 3) return emit(Gesture::No, now);`. Mỗi pha: trục Y vượt ±100 °/s trong 2 mẫu liền, đổi chiều so với pha trước, cách nhau ≥ 80 ms.' },
    { id: 'x.q27', unitId: 'u05', lessonId: 'l7', type: 'order', prompt: 'Sau khi đã sẵn sàng, `update()` kiểm tra các cử chỉ theo **thứ tự** nào?',
      visual: { kind: 'diagram', svg: SVG_PRIORITY, alt: 'Năm ô liền nhau: Chờ trung tính, ba ô dấu hỏi, Nghiêng.' },
      items: ['Lắc (NO)', 'Gõ đôi (YES)', 'Nhấp cẳng tay (HELP)', 'Nghiêng (WATER/FOOD)'],
      explanation: 'Trong code: lắc → gõ → nhấp HELP → lắng 150 ms → nghiêng. Lắc đứng trước nên mọi xoay nhanh đều xoá ứng viên nghiêng.' },
    { id: 'x.q28', unitId: 'u05', lessonId: 'l2', type: 'hotspot', prompt: 'Sau khi phát một lệnh, vòng tay vào trạng thái nào **trước** khi phải về trung tính? Chạm vào trạng thái đó.',
      target: { kind: 'diagram', name: 'state-machine' }, answer: 'cooldown',
      explanation: '`emit()` bật `cooling` trong 650 ms (`COOLDOWN_MS`). Hết nghỉ, tay vẫn phải về dưới 12° và yên 200 ms mới sẵn sàng lại.' },
    { id: 'x.q29', unitId: 'u05', lessonId: 'l5', type: 'sim-predict', prompt: 'Tay đang **nghiêng 18°** thì gõ 2 lần. Chip IMU bật cờ gõ đôi. Điều gì xảy ra tiếp?',
      sim: 'double-tap', props: { preset: 'tap-while-tilted' }, pauseAt: 'tap2', revealTo: 'end',
      options: ['Phát YES sau 150 ms', 'Không phát YES vì tay chưa ở trung tính (dưới 12°)', 'Phát FOOD'], answer: 1,
      explanation: 'Cú gõ chỉ được nhận khi `rest` đúng: góc nghiêng và góc gập đều dưới 12°. 18° chưa đủ 22° để thành FOOD nhưng cũng không phải trung tính, nên không có lệnh nào.' },
    { id: 'x.q30', unitId: 'u05', lessonId: 'l4', type: 'sim-predict', prompt: 'Người dùng lắc rất **chậm**: mỗi pha cách nhau khoảng 1 giây. Pha đầu tiên vừa được đếm. Kết quả cuối cùng là gì?',
      sim: 'shake-counter', props: { preset: 'too-slow' }, pauseAt: 'pulse1', revealTo: 'end',
      options: ['Phát NO sau pha thứ 3', 'Không phát NO vì cửa sổ 900 ms hết trước khi đủ 3 pha', 'Phát YES'], answer: 1,
      explanation: 'Quá 900 ms kể từ pha đầu mà chưa đủ 3 pha thì bộ đếm về 0. Lắc chậm không thành NO, nên vẫy tay chào người khác cũng khó gây lệnh nhầm.' },
    { id: 'x.q31', unitId: 'u05', lessonId: 'l1', type: 'number', prompt: 'Vì sao nghiêng cũng cần lề 8°? Góc gập đang là 15°. Góc **nghiêng** phải tối thiểu bao nhiêu độ thì mới được tính là WATER/FOOD?',
      answer: 23, tolerance: 0, unit: '°', hint: 'Phải vượt 22° **và** lớn hơn góc gập + 8°.',
      explanation: 'Cần `roll > 22` và `roll ≥ pitch + 8 = 23`. Điều kiện chặt hơn là 23°. Lề trục giúp tư thế chéo không bị đoán bừa.' },

    // ---- Chương 6: Bluetooth ----
    { id: 'x.q32', unitId: 'u06', lessonId: 'l2', type: 'hotspot', prompt: 'App bấm “Hiệu chuẩn” thì ghi chữ `CALIBRATE` vào đâu? Chạm vào đó.',
      target: { kind: 'diagram', name: 'gatt-tree' }, answer: 'ctrl-char',
      explanation: 'Characteristic điều khiển (…0003) có quyền Read | Write | Notify. App ghi `CALIBRATE`, vòng tay trả `CALIBRATING` rồi `READY`.' },
    { id: 'x.q33', unitId: 'u06', lessonId: 'l4', type: 'mcq', prompt: 'Nhìn biểu đồ. Sau khi mất kết nối, app làm gì?',
      visual: { kind: 'diagram', svg: SVG_BACKOFF, alt: 'Cột thời gian chờ: 1, 2, 4, 8, 15, 15 giây, sau đó 30 giây một lần, không giới hạn, chỉ dừng khi bấm Ngắt kết nối.' },
      options: ['Thử 6 lần rồi bỏ cuộc', 'Thử 1, 2, 4, 8, 15, 15 giây rồi cứ 30 giây một lần, đến khi người dùng bấm ngắt kết nối', 'Thử liên tục mỗi giây, không nghỉ', 'Không tự nối lại'], answer: 1,
      explanation: '`BACKOFF_MS = {1000, 2000, 4000, 8000, 15000, 15000}`, sau đó `SLOW_RETRY_MS = 30000`. Chỉ `disconnect()` hoặc `release()` mới dừng việc nối lại.' },
    { id: 'x.q34', unitId: 'u06', lessonId: 'l4', type: 'number', prompt: 'Sau 6 lần thử nhanh, app chờ bao nhiêu **giây** giữa các lần nối lại tiếp theo?',
      answer: 30, tolerance: 0, unit: 'giây',
      explanation: '`SLOW_RETRY_MS = 30000`. App tiếp tục thử mãi với nhịp 30 giây, nên vòng tay vừa có pin lại là tự nối, không cần người chăm sóc bấm.' },
    { id: 'x.q35', unitId: 'u06', lessonId: 'l6', type: 'mcq', prompt: 'Nhìn dòng thời gian: app hay **mất kết nối sau khoảng 3 lần đọc**. Nguyên nhân gốc là gì?',
      visual: { kind: 'diagram', svg: SVG_BUG, alt: 'Dòng thời gian: nối xong, đọc 1, đọc 2, đọc 3, màn hình tắt sau khoảng 30 giây không chạm, rồi mất kết nối.' },
      options: ['Pin vòng tay yếu', 'Hàm onStop() của app đóng kết nối BLE khi màn hình tự tắt', 'Sóng Bluetooth chỉ chịu được 3 tin nhắn', 'Bộ lọc góc bị tràn số'], answer: 1,
      explanation: 'Khi màn hình tự tắt (~30 giây), Android gọi `onStop()`, và bản cũ đóng BLE ở đó. Bản mới giữ kết nối trong dịch vụ nền `BandLinkService`, giữ màn hình sáng khi đang nối.' },
    { id: 'x.q36', unitId: 'u06', lessonId: 'l6', type: 'match', prompt: 'Ghép mỗi **lỗi cũ** với **cách sửa** trong HEAD 4a0285a.',
      pairs: [['App đóng BLE khi màn hình tắt', 'Dịch vụ nền BandLinkService'], ['Log USB chặn chương trình khi máy tính không đọc', 'Gửi không chặn (send_nb)'], ['ArduinoBLE kẹt bộ đếm gói _pendingPkt sau khi rớt mạng', 'Đặt lại bộ đếm khi không có kết nối'], ['Chip treo thì đứng im mãi', 'Watchdog 4 giây tự khởi động lại']],
      explanation: 'Một lỗi “ngắt sau 3 lần đọc” hoá ra là nhiều nguyên nhân ở cả app và firmware. Sửa từng cái, kiểm tra lại từng cái.' },
    { id: 'x.q37', unitId: 'u06', lessonId: 'l4', type: 'truefalse', prompt: 'Lúc mất kết nối, vòng tay vẫn ghi nhớ các cử chỉ người dùng làm, rồi gửi bù khi nối lại.',
      answer: false,
      explanation: 'Sai, và đó là chủ ý. Firmware ghi rõ: không đệm, không phát lại cử chỉ làm lúc mất kết nối. Một câu “Tôi muốn uống nước” cũ nói ra muộn sẽ gây hiểu lầm.' },
    { id: 'x.q38', unitId: 'u06', lessonId: 'l3', type: 'mcq', prompt: 'Ngay khi app **bắt đầu hoặc thôi** đăng ký nhận lệnh, firmware gọi `detector.disarm()`. Để làm gì?',
      options: ['Để tắt Bluetooth', 'Để bắt tay về trung tính trước mỗi phiên kết nối mới, tránh phát lệnh dở dang', 'Để xoá mốc hiệu chuẩn', 'Để đổi tên thiết bị'], answer: 1,
      explanation: 'Một cử chỉ dở dang từ trước khi nối không được thành lệnh. Mốc hiệu chuẩn vẫn giữ (trừ khi nó được làm trước lần nối app đầu tiên).' },
    { id: 'x.q39', unitId: 'u06', lessonId: 'l3', type: 'order', prompt: 'Sắp xếp các bước app nối với vòng tay.',
      items: ['Quét tìm thiết bị có service c91b0001… (tối đa 8 giây)', 'Kết nối GATT (chờ tối đa 15 giây)', 'Tìm service và hai characteristic', 'Ghi CCCD 0x2902 để bật thông báo', 'Nhận thông báo "WATER" và đọc to'],
      explanation: 'App lọc khi quét theo UUID service (`SCAN_MS = 8000`), kết nối (`CONNECT_MS = 15000`), rồi bật notify qua CCCD 0x2902.' },
    { id: 'x.q40', unitId: 'u06', lessonId: 'l3', type: 'mcq', prompt: 'Sau khi rớt mạng, ai khiến vòng tay **quảng bá lại** để app tìm thấy?',
      options: ['App gửi lệnh bật quảng bá', 'Firmware tự gọi BLE.advertise() lại (thử mỗi giây) khi thấy link đã rớt', 'Phải rút pin cắm lại', 'Watchdog'], answer: 1,
      explanation: 'Ngăn xếp BLE có tự bật lại quảng bá nhưng bỏ qua lỗi. Firmware gọi `BLE.advertise()` lại, mỗi lần cách ít nhất 1000 ms, đến khi thành công.' },

    // ---- Chương 7: app ----
    { id: 'x.q41', unitId: 'u07', lessonId: 'l3', type: 'multi', prompt: 'Khi đang nối với vòng tay, app làm gì để **không bị mất kết nối** lúc người chăm sóc để điện thoại một bên?',
      options: ['Chạy dịch vụ nền BandLinkService (có thông báo cố định)', 'Giữ màn hình sáng khi đang kết nối', 'Không ngắt khi xoay màn hình hay tắt màn hình', 'Tắt Bluetooth sau mỗi lệnh để tiết kiệm pin', 'Ngắt kết nối nếu 30 giây chưa hiệu chuẩn xong'],
      answers: [0, 1, 2],
      explanation: 'Dịch vụ nền loại “connected device” giữ link khi màn hình tắt. Hết 30 giây hiệu chuẩn chỉ báo “Chưa hiệu chuẩn xong”, không còn làm rớt kết nối.' },
    { id: 'x.q42', unitId: 'u07', lessonId: 'l1', type: 'mcq', prompt: 'App nhận được chuỗi `" help "` (có dấu cách, chữ thường). `GestureCommand.parse()` trả về gì?',
      options: ['null, vì sai chữ hoa', 'HELP, vì parse() cắt khoảng trắng và đổi sang chữ hoa', 'Lỗi làm app dừng', 'WATER'], answer: 1,
      explanation: '`valueOf(raw.trim().toUpperCase(Locale.ROOT))`. Chuỗi lạ như `"HELLO"` thì `valueOf` ném lỗi, parse() bắt lỗi và trả `null`, app bỏ qua.' },
    { id: 'x.q43', unitId: 'u07', lessonId: 'l2', type: 'hotspot', prompt: 'Lệnh mới tới khi câu cũ đang đọc dở thì câu cũ bị cắt (`QUEUE_FLUSH`). Chạm vào khối thực hiện việc đó.',
      target: { kind: 'diagram', name: 'tts-chain' }, answer: 'tts',
      explanation: '`speech.speak(phrase, TextToSpeech.QUEUE_FLUSH, …)`: câu mới thay câu cũ ngay, vì nhu cầu mới nhất mới là điều người dùng muốn nói.' },
    { id: 'x.q44', unitId: 'u07', lessonId: 'l2', type: 'number', prompt: 'App đặt tốc độ đọc tiếng Việt (`setSpeechRate`) là bao nhiêu?',
      answer: 0.9, tolerance: 0, hint: '1,0 là tốc độ bình thường.',
      explanation: '`speech.setSpeechRate(0.9f)`: chậm hơn bình thường một chút cho người lớn tuổi dễ nghe. Ngôn ngữ đặt là vi-VN.' },
    { id: 'x.q45', unitId: 'u07', lessonId: 'l1', type: 'sim-predict', prompt: 'Vòng tay vừa gửi chữ `YES`. Điện thoại sẽ nói câu gì?',
      sim: 'system-flow', props: { gesture: 'YES' }, pauseAt: 'received', revealTo: 'spoken',
      options: ['“Có.”', '“Tôi đồng ý.”', '“Yes.”', '“Tôi cần giúp đỡ.”'], answer: 0,
      explanation: '`YES("Có.", "✌ Gõ 2 lần", …)` trong GestureCommand.java. App đọc bằng giọng tiếng Việt.' },

    // ---- Chương 8: thử nghiệm ----
    { id: 'x.q46', unitId: 'u08', lessonId: 'l2', type: 'multi', prompt: 'Thí nghiệm nào cần làm để kiểm tra **luật HELP mới** trên người thật?',
      options: ['Đếm số lần HELP nhầm khi người đeo uống nước, ăn, đặt tay lên đùi', 'Đếm tỉ lệ người đeo làm HELP thành công khi cố ý', 'Đo thời gian từ lần nhấp thứ 2 đến khi điện thoại nói', 'Chạy lại gesture_test.cpp là đủ, không cần người thật'],
      answers: [0, 1, 2],
      explanation: 'Cần cả lệnh nhầm (false positive), lệnh bị bỏ sót và độ trễ. Kiểm thử tổng hợp chỉ chứng minh luật chạy đúng, không thay được người thật.' },
    { id: 'x.q47', unitId: 'u08', lessonId: 'l4', type: 'mcq', prompt: 'Giám khảo hỏi: “HELP mới chính xác bao nhiêu phần trăm?”. Câu trả lời đúng nhất là:',
      options: ['99%', 'Nhóm chưa có số đo trên người thật; kiểm thử tổng hợp cho thấy giữ tư thế hay uống nước chậm không ra HELP, và nhóm có kế hoạch đo', '100% vì đã có kiểm thử', 'Không trả lời được'], answer: 1,
      explanation: 'Không bịa số. Nói điều đã kiểm chứng (kiểm thử tổng hợp) và điều chưa đo, kèm kế hoạch đo cụ thể.' },
    { id: 'x.q48', unitId: 'u06', lessonId: 'l6', type: 'truefalse', prompt: 'Câu chuyện sửa lỗi “ngắt sau 3 lần đọc” là điểm **yếu** nên giấu đi khi phản biện.',
      answer: false,
      explanation: 'Sai. Kể rõ triệu chứng → tìm nguyên nhân (onStop, log USB, _pendingPkt, thiếu watchdog) → sửa → kiểm tra lại cho thấy nhóm làm kỹ thuật thật và trung thực.' },

    // ---- Chương 9: hạn chế, đạo đức ----
    { id: 'x.q49', unitId: 'u09', lessonId: 'l1', type: 'multi', prompt: 'Đâu là **hạn chế thật** của BandW ở phiên bản hiện tại?',
      options: ['Gõ bàn 2 lần khi tay yên có thể ra YES', 'Chỉ có 5 câu cố định', 'Chưa đo thời lượng pin', 'Không chạy được khi không có Internet', 'Chưa thử với người dùng mục tiêu thật (nếu nhóm chưa thử)'],
      answers: [0, 1, 2, 4],
      explanation: 'BandW không cần Internet: lệnh đi thẳng qua BLE và giọng đọc chạy trên máy. Các ý còn lại là hạn chế nên nói thẳng kèm hướng khắc phục.' },
    { id: 'x.q50', unitId: 'u09', lessonId: 'l4', type: 'mcq', prompt: 'Vì sao firmware **không** gửi số liệu cảm biến thô lên điện thoại, chỉ gửi một từ như `WATER`?',
      options: ['Vì Bluetooth không gửi được số', 'Gọn, ít tốn pin, và điện thoại không nhận dữ liệu chuyển động chi tiết của người dùng', 'Vì app không hiển thị được đồ thị', 'Vì giám khảo yêu cầu'], answer: 1,
      explanation: 'Characteristic lệnh chỉ dài tối đa 8 byte. Gửi một từ vừa nhẹ vừa bảo vệ riêng tư: không có dữ liệu chuyển động thô rời khỏi vòng tay.' },
  ],

  // ───────────────────────── câu hỏi mở cho "Phản biện thử" ─────────────────────────
  open: [
    { id: 'x.d.q01', topic: "Nhận diện cử chỉ", unitId: 'u05', lessonId: 'l8', type: 'flashcard', prompt: 'Giám khảo hỏi: “HELP đã thay đổi thế nào so với bản đầu? Vì sao?”',
      modelAnswer: "Bản đầu: **gập cổ tay về trước và giữ 400 ms**. Khi xét các động tác đời thường, nhóm thấy những tư thế như **đưa tay lên miệng uống nước** hay **đặt cẳng tay lên đùi** cũng là “giữ một góc”, nên dễ gọi giúp nhầm. Bản mới: **2 lần nhấp cẳng tay nhanh, cùng chiều**: mỗi lần qua 25° rồi về dưới 12° trong ≤ 700 ms, cả hai trong 2 giây. Giữ yên một tư thế không bao giờ thành HELP; kiểm thử tổng hợp đã có ca cho các tư thế này.",
      keyPoints: ['Bản cũ: gập và giữ 400 ms', 'Lỗi: uống nước, đặt tay lên đùi gây HELP nhầm', 'Bản mới: 2 lần nhấp cùng chiều', '25°/12°, ≤ 700 ms, trong 2 giây'],
      followUp: { prompt: 'Nếu người dùng run tay thì hai lần nhấp có xảy ra tình cờ không?', answer: 'Run tay nhẹ thường không đẩy góc gập đã lọc vượt 25° rồi về dưới 12°. Run mạnh thì có thể, và đó là điều **phải đo** với người thật. Em nói rõ: chưa thử với người run tay, đó là hạn chế và là thí nghiệm tiếp theo.' } },
    { id: 'x.d.q02', topic: "Bluetooth & kết nối", unitId: 'u06', lessonId: 'l6', type: 'flashcard', prompt: 'Giám khảo hỏi: “Nhóm đã gặp lỗi kỹ thuật khó nhất nào? Tìm ra nguyên nhân thế nào?”',
      modelAnswer: "Lỗi **“ngắt kết nối sau vài câu”**. Phía app, nguyên nhân chính là bản 0.3.0/0.4.0 đóng Bluetooth trong `onStop()`, mà `onStop()` chạy khi **khoá hoặc tự tắt màn hình**, khi **xoay màn hình** và khi **rời app**. Sửa: kết nối chạy trong **dịch vụ nền** `BandLinkService` có thông báo, giữ màn hình sáng khi nối. Rà firmware còn thấy log USB có thể chặn vòng lặp, bộ đếm gói `_pendingPkt` của ArduinoBLE kẹt sau khi rớt, và chưa có watchdog: đều đã sửa (log không chặn, đặt lại bộ đếm, watchdog 4 giây).",
      keyPoints: ["Triệu chứng: ngắt sau vài câu", "onStop() đóng BLE khi tắt màn hình, xoay máy, rời app", "Sửa app: BandLinkService, giữ màn hình sáng", "Sửa firmware: log không chặn, _pendingPkt, watchdog 4 s"],
      followUp: { prompt: 'Làm sao em chắc là đã sửa xong?', answer: 'Thử lại đúng tình huống gây lỗi: để điện thoại tự tắt màn hình, làm cử chỉ nhiều lần trong nhiều phút, tắt bật vòng tay để xem app tự nối lại (1, 2, 4, 8, 15, 15 giây rồi 30 giây một lần). Ghi lại số lần thử và kết quả, không chỉ nói “đã ổn”.' } },
    { id: 'x.d.q03', topic: "Nhận diện cử chỉ", unitId: 'u05', lessonId: 'l5', type: 'flashcard', prompt: 'Giám khảo hỏi: “Làm sao để đặt tay xuống bàn không bị hiểu là gõ 2 lần?”',
      modelAnswer: 'Đặt tay xuống là một cử động xoay. Firmware đếm: nếu tốc độ quay vượt **50 °/s trong 2 mẫu liền** thì ghi lại thời điểm cử động. Cú gõ đôi chỉ được nhận khi tay **đã yên ít nhất 300 ms** trước đó, ở **trung tính**, và còn yên thêm **150 ms** sau. Hạn chế còn lại: tay nằm yên mà gõ bàn 2 lần thì vẫn có thể ra YES.',
      keyPoints: ['Cử động > 50 °/s trong 2 mẫu liền', 'Yên 300 ms trước cú gõ', 'Xác nhận thêm 150 ms', 'Nói rõ hạn chế gõ bàn'],
      followUp: { prompt: 'Sao không bắt cú gõ phải mạnh hơn để loại gõ bàn?', answer: 'Gõ bàn và gõ lên vòng tay đều là cú sốc ngắn, mạnh tương tự; nâng ngưỡng (đang 750 mg) thì người tay yếu khó gõ được YES. Hướng tốt hơn là đo dữ liệu thật của hai trường hợp rồi mới chọn cách phân biệt.' } },
    { id: 'x.d.q04', topic: "Firmware, code & phần cứng", unitId: 'u06', lessonId: 'l4', type: 'flashcard', prompt: 'Giám khảo hỏi: “Nếu đang dùng mà vòng tay hết pin rồi được sạc lại thì sao?”',
      modelAnswer: "Hết pin thì vòng tay tắt, app thấy mất kết nối và **tự thử lại**: 1, 2, 4, 8, 15, 15 giây rồi 30 giây một lần, không bỏ cuộc. Sạc lại là vòng tay **khởi động từ đầu**: nó phải **hiệu chuẩn lại** (LED nháy nhanh), người dùng giữ tay yên khoảng 2 giây; nếu hiệu chuẩn xong trước khi app nối, firmware còn tự hiệu chuẩn thêm một lần khi app vào. Sau đó phải **về trung tính** mới ra lệnh được. Cử chỉ làm lúc vòng tay tắt thì mất hẳn, **không gửi bù**. Thời lượng pin chưa đo.",
      keyPoints: ["App tự thử lại, rồi 30 giây một lần", "Bật lại: hiệu chuẩn lại, giữ yên khoảng 2 giây", "Phải về trung tính trước lệnh đầu tiên", "Cử chỉ lúc vòng tay tắt không gửi bù"],
      followUp: { prompt: 'Thử mãi như vậy có tốn pin điện thoại không?', answer: 'Sau 6 lần đầu, app chỉ thử 30 giây một lần nên tốn rất ít. Nhóm chưa đo mức tiêu thụ cụ thể; nếu cần, em nói đó là phép đo sẽ làm.' } },
    { id: 'x.d.q05', topic: "Nhận diện cử chỉ", unitId: 'u04', lessonId: 'l5', type: 'flashcard', prompt: 'Giám khảo hỏi: “Watchdog là gì? Vì sao vòng tay cần nó?”',
      modelAnswer: "**Watchdog** là bộ đếm giờ phần cứng trong chip nRF52840. Mỗi vòng `loop()` chương trình “cho ăn” nó. Nếu chương trình **kẹt quá 4 giây** (I2C treo, ngăn xếp BLE kẹt), không ai cho ăn nên chip **tự khởi động lại**. Với người dùng không tự sửa được thiết bị, tự hồi phục quan trọng hơn là đứng im. Khởi động lại thì vòng tay hiệu chuẩn lại và app tự nối lại.",
      keyPoints: ['Bộ đếm giờ phần cứng', 'loop() cho ăn mỗi vòng', 'Kẹt > 4 giây thì tự khởi động lại', 'Người dùng không tự sửa được'],
      followUp: { prompt: 'Khởi động lại thì có mất hiệu chuẩn không?', answer: 'Có: sau khởi động, vòng tay hiệu chuẩn lại (đèn chớp nhanh) và cần giữ tay yên khoảng 2 giây. App sẽ tự nối lại. Đây là cái giá chấp nhận được so với treo hẳn.' } },
    { id: 'x.d.q06', topic: "Thử nghiệm, độ chính xác & hạn chế", unitId: 'u08', lessonId: 'l2', type: 'flashcard', prompt: 'Giám khảo hỏi: “Em sẽ thiết kế thí nghiệm thế nào để đo lệnh nhầm của HELP?”',
      modelAnswer: 'Mời nhiều người đeo, ghi **tình huống hằng ngày** có kịch bản: uống nước, ăn, gãi đầu, đặt tay lên đùi, đi lại, mỗi việc nhiều lần, **không** làm HELP. Đếm số lần app nói “Tôi cần giúp đỡ.” (**lệnh nhầm**). Rồi cho họ cố ý làm HELP nhiều lần để đếm tỉ lệ **thành công** và thời gian phản hồi. Báo cáo bằng bảng và ma trận nhầm lẫn, ghi rõ số người, số lần.',
      keyPoints: ['Kịch bản việc hằng ngày', 'Đếm lệnh nhầm', 'Đếm tỉ lệ làm HELP thành công', 'Báo cáo số người, số lần, ma trận nhầm lẫn'],
      followUp: { prompt: 'Bao nhiêu người là đủ?', answer: 'Không có con số thần kỳ. Em nói số người thực tế nhóm làm được, cố gắng đa dạng (tuổi, tay thuận), và nói rõ kết quả chỉ đúng cho nhóm đó. Nhiều lần thử trên mỗi người giúp số liệu ổn định hơn.' } },
    { id: 'x.d.q08', topic: "Nhận diện cử chỉ", unitId: 'u05', lessonId: 'l4', type: 'flashcard', prompt: 'Giám khảo hỏi: “Vì sao một pha lắc phải kéo dài 2 mẫu?”',
      modelAnswer: 'Một cú **gõ** hay cú **giật** chỉ làm tốc độ quay vọt lên trong **1 mẫu** (20 ms). Nếu đếm cả những cú đó, gõ 2 lần có thể bị tính thành pha lắc. Yêu cầu **2 mẫu liền** (40 ms) vượt ±100 °/s cùng chiều thì chỉ chuyển động xoay thật mới được đếm. Nhờ vậy lắc và gõ không giẫm chân nhau.',
      keyPoints: ['Cú gõ/giật chỉ 1 mẫu', '2 mẫu liền = 40 ms', 'Vượt ±100 °/s cùng chiều', 'Lắc và gõ tách bạch'] },
    { id: 'x.d.q10', topic: "An toàn, riêng tư, đạo đức & chi phí", unitId: 'u09', lessonId: 'l4', type: 'flashcard', prompt: 'Giám khảo hỏi: “Nếu BandW nói nhầm “Tôi cần giúp đỡ” thì có nguy hiểm không?”',
      modelAnswer: 'Gọi giúp **nhầm** làm người chăm sóc chạy tới vô ích và dần **mất tin tưởng**; **bỏ sót** HELP thì nguy hiểm hơn. Vì vậy HELP được thiết kế khó xảy ra tình cờ (2 lần nhấp nhanh cùng chiều) nhưng vẫn dễ làm khi cố ý. BandW là **công cụ hỗ trợ**, không thay người chăm sóc hay chuông báo y tế; điều này phải nói rõ với người dùng.',
      keyPoints: ['Nhầm: mất tin tưởng', 'Bỏ sót: nguy hiểm hơn', 'Thiết kế khó tình cờ, dễ cố ý', 'Chỉ hỗ trợ, không thay người chăm sóc'] },
  ],
};
