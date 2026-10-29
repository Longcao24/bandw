// public/content/unit11.js — Chương 11: TinyML, học máy tí hon trên vòng tay
// Đây là chương NGHIÊN CỨU: firmware 0.5.0 chưa có học máy. Kế hoạch đầy đủ ở firmware/TINYML.md.
// Mô phỏng tinyml-* chạy trên dữ liệu TỔNG HỢP (public/js/sims/_tinyml.js): con số trong đó minh hoạ
// phương pháp, không phải độ chính xác của BandW. Số flash/RAM lấy từ firmware/README.md.

const SVG_WHERE = `<svg viewBox="0 0 600 280" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <text x="300" y="26" text-anchor="middle" font-size="17" font-weight="700" style="fill:var(--c-text)">Mô hình chạy ở đâu?</text>
  <g data-hotspot="cloud" data-label="Máy chủ trên Internet">
    <rect x="20" y="50" width="170" height="170" rx="16" style="fill:var(--c-surface-2);stroke:var(--c-muted);stroke-width:2;stroke-dasharray:8 6"/>
    <text x="105" y="84" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Máy chủ</text>
    <text x="105" y="116" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">cần Internet</text>
    <text x="105" y="140" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">gửi dữ liệu thô</text>
    <text x="105" y="164" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">trễ, lộ dữ liệu</text>
  </g>
  <g data-hotspot="phone" data-label="Điện thoại">
    <rect x="215" y="50" width="170" height="170" rx="16" style="fill:var(--c-surface-2);stroke:var(--c-muted);stroke-width:2"/>
    <text x="300" y="84" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Điện thoại</text>
    <text x="300" y="116" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">máy mạnh</text>
    <text x="300" y="140" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">nhưng BLE phải gửi</text>
    <text x="300" y="164" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">50 mẫu mỗi giây</text>
  </g>
  <g data-hotspot="band" data-label="Chip trên vòng tay (TinyML)">
    <rect x="410" y="50" width="170" height="170" rx="16" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:3"/>
    <text x="495" y="84" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Vòng tay</text>
    <text x="495" y="116" text-anchor="middle" font-size="14" style="fill:var(--c-text)">TinyML</text>
    <text x="495" y="140" text-anchor="middle" font-size="14" style="fill:var(--c-text)">chip tự quyết định</text>
    <text x="495" y="164" text-anchor="middle" font-size="14" style="fill:var(--c-text)">vẫn chỉ gửi 1 từ</text>
  </g>
  <text x="300" y="260" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">Huấn luyện luôn làm trên máy tính; chỉ phần “đoán” mới chạy trên thiết bị</text>
</svg>`;

const SVG_WINDOW = `<svg viewBox="0 0 600 270" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <text x="300" y="24" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Cửa sổ trượt trên dòng dữ liệu 50 Hz</text>
  <path d="M20 130 C 70 130, 90 130, 120 128 S 170 70, 220 66 S 300 66, 330 70 S 370 128, 420 130 S 520 132, 580 130" style="fill:none;stroke:var(--viz-x);stroke-width:3"/>
  <g data-hotspot="win" data-label="Một cửa sổ: 75 mẫu, 1,5 giây">
    <rect x="110" y="44" width="270" height="110" rx="8" style="fill:var(--c-primary-soft);fill-opacity:.45;stroke:var(--c-primary);stroke-width:3"/>
    <text x="245" y="176" text-anchor="middle" font-size="14" font-weight="700" style="fill:var(--c-text)">1 cửa sổ = 1,5 s = 75 mẫu</text>
  </g>
  <g data-hotspot="step" data-label="Trượt 200 ms rồi đoán lại">
    <rect x="160" y="50" width="270" height="98" rx="8" style="fill:none;stroke:var(--c-muted);stroke-width:2;stroke-dasharray:7 5"/>
    <path d="M384 196 L 430 196" style="stroke:var(--c-muted);stroke-width:3"/>
    <path d="M424 188 L 436 196 L 424 204 Z" style="fill:var(--c-muted)"/>
    <text x="445" y="201" font-size="14" style="fill:var(--c-muted)">trượt 200 ms</text>
  </g>
  <g data-hotspot="label" data-label="Nhãn: cửa sổ này là WATER">
    <rect x="200" y="214" width="90" height="34" rx="17" style="fill:#7fb2ff;stroke:var(--c-primary);stroke-width:2"/>
    <text x="245" y="236" text-anchor="middle" font-size="15" font-weight="700" style="fill:#21242c">WATER</text>
    <text x="300" y="236" font-size="14" style="fill:var(--c-muted)">← nhãn do người ghi</text>
  </g>
</svg>`;

const SVG_MEMORY = `<svg viewBox="0 0 600 250" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <text x="300" y="24" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Bộ nhớ của nRF52840 (theo firmware/README.md)</text>
  <g data-hotspot="flash" data-label="Flash 1 MB: firmware dùng 41%">
    <text x="20" y="66" font-size="15" font-weight="700" style="fill:var(--c-text)">Flash 1 MB</text>
    <rect x="130" y="48" width="440" height="28" rx="6" style="fill:var(--c-surface-2)"/>
    <rect x="130" y="48" width="180" height="28" rx="6" style="fill:var(--c-primary)"/>
    <text x="220" y="67" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--c-primary-ink)">firmware 41%</text>
  </g>
  <g data-hotspot="ram" data-label="RAM 256 KB: firmware dùng 30%">
    <text x="20" y="126" font-size="15" font-weight="700" style="fill:var(--c-text)">RAM 256 KB</text>
    <rect x="130" y="108" width="440" height="28" rx="6" style="fill:var(--c-surface-2)"/>
    <rect x="130" y="108" width="132" height="28" rx="6" style="fill:var(--c-primary)"/>
    <text x="196" y="127" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--c-primary-ink)">30%</text>
  </g>
  <g data-hotspot="model" data-label="Mô hình nhỏ: vài chục byte đến khoảng 15 KB">
    <rect x="310" y="44" width="7" height="36" style="fill:var(--viz-enter)"/>
    <text x="324" y="98" font-size="13" font-weight="700" style="fill:var(--viz-enter)">mô hình B int8 ≈ 15 KB (vạch đỏ)</text>
    <text x="20" y="186" font-size="14" style="fill:var(--c-text)">Mô hình A (9 đặc trưng → 5 nơ-ron): 50 tham số, int8 chưa tới 100 byte</text>
    <text x="20" y="210" font-size="14" style="fill:var(--c-text)">Mô hình B (450 số → 32 → 16 → 5): khoảng 15.000 tham số</text>
  </g>
  <text x="300" y="240" text-anchor="middle" font-size="13" style="fill:var(--c-muted)">Ước tính trên giấy, chưa biên dịch thử</text>
</svg>`;

const SVG_HYBRID = `<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <text x="300" y="24" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Kế hoạch: mô hình đề xuất, luật kiểm soát</text>
  <g data-hotspot="buffer" data-label="Bộ đệm 75 mẫu gần nhất">
    <rect x="20" y="50" width="150" height="70" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-muted);stroke-width:2"/>
    <text x="95" y="80" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">Bộ đệm</text>
    <text x="95" y="102" text-anchor="middle" font-size="13" style="fill:var(--c-muted)">75 mẫu, 50 Hz</text>
  </g>
  <path d="M172 85 L 214 85" style="stroke:var(--c-muted);stroke-width:3"/>
  <path d="M208 77 L 220 85 L 208 93 Z" style="fill:var(--c-muted)"/>
  <g data-hotspot="model" data-label="Mô hình TinyML (mới)">
    <rect x="222" y="50" width="160" height="70" rx="12" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:3;stroke-dasharray:8 5"/>
    <text x="302" y="80" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">Mô hình (mới)</text>
    <text x="302" y="102" text-anchor="middle" font-size="13" style="fill:var(--c-text)">mỗi 200 ms, ≥ 80%</text>
  </g>
  <path d="M302 122 L 302 160" style="stroke:var(--c-muted);stroke-width:3"/>
  <path d="M294 154 L 302 166 L 310 154 Z" style="fill:var(--c-muted)"/>
  <g data-hotspot="rules" data-label="Luật an toàn giữ nguyên: trung tính, nghỉ 650 ms, HELP, YES">
    <rect x="150" y="168" width="304" height="78" rx="12" style="fill:var(--c-surface);stroke:var(--c-text);stroke-width:3"/>
    <text x="302" y="196" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">Luật giữ nguyên</text>
    <text x="302" y="218" text-anchor="middle" font-size="13" style="fill:var(--c-muted)">về trung tính · nghỉ 650 ms · không lặp lệnh</text>
    <text x="302" y="236" text-anchor="middle" font-size="13" style="fill:var(--c-muted)">HELP 2 lần nhấp · YES gõ đôi phần cứng</text>
  </g>
  <path d="M456 207 L 494 207" style="stroke:var(--c-muted);stroke-width:3"/>
  <path d="M488 199 L 500 207 L 488 215 Z" style="fill:var(--c-muted)"/>
  <g data-hotspot="ble" data-label="BLE gửi 1 từ như cũ">
    <rect x="502" y="172" width="84" height="70" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-muted);stroke-width:2"/>
    <text x="544" y="202" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">BLE</text>
    <text x="544" y="224" text-anchor="middle" font-size="13" style="fill:var(--c-muted)">1 từ</text>
  </g>
  <text x="300" y="282" text-anchor="middle" font-size="13" style="fill:var(--c-muted)">Nét đứt = phần chưa có, đang là kế hoạch</text>
</svg>`;

export default {
  id: 'u11',
  title: 'TinyML: học máy tí hon trên vòng tay',
  description: 'Học máy chạy ngay trên chip: dữ liệu, đặc trưng, huấn luyện, thu nhỏ int8 và kế hoạch thử TinyML cho BandW.',
  color: 'pink',
  icon: '🤖',
  glossary: [
    { term: 'mô hình', en: 'model', def: 'Bộ con số (trọng số) mà máy rút ra từ dữ liệu. Đưa dữ liệu mới vào, mô hình tính ra câu trả lời, ví dụ xác suất của từng cử chỉ.' },
    { term: 'huấn luyện', en: 'training', def: 'Bước cho máy tính xem thật nhiều dữ liệu có nhãn để chỉnh trọng số của mô hình. Làm trên máy tính, không làm trên vòng tay.' },
    { term: 'suy luận', en: 'inference', def: 'Bước dùng mô hình đã huấn luyện để đoán trên dữ liệu mới. Với TinyML, bước này chạy ngay trên vi điều khiển.' },
    { term: 'cửa sổ', en: 'window', def: 'Một đoạn dữ liệu cảm biến liên tiếp, ví dụ 1,5 giây = 75 mẫu. Mô hình đoán trên từng cửa sổ, cửa sổ trượt dần theo thời gian.' },
    { term: 'đặc trưng', en: 'feature', def: 'Một con số tóm tắt cửa sổ, ví dụ “ax trung bình” hay “gy dao động mạnh cỡ nào”. Giúp mô hình nhỏ mà vẫn đủ thông tin.' },
    { term: 'nơ-ron', en: 'neuron', def: 'Phép tính nhỏ nhất của mạng: nhân mỗi đầu vào với một trọng số, cộng lại, cộng thêm độ lệch (bias).' },
    { term: 'độ tự tin', en: 'confidence', def: 'Xác suất cao nhất mà mô hình đưa ra. Dưới ngưỡng tự tin thì vòng tay nên im lặng thay vì đoán bừa.' },
    { term: 'lớp không làm gì', en: 'NONE class', def: 'Nhãn cho mọi cử động đời thường không phải lệnh: nghỉ, đi bộ, gãi đầu, nâng cốc. Thiếu lớp này mô hình sẽ phát lệnh nhầm.' },
    { term: 'tập kiểm tra', en: 'test set', def: 'Phần dữ liệu giữ riêng, không dùng để huấn luyện, để đo mô hình công bằng. Tốt nhất là dữ liệu của người mô hình chưa từng thấy.' },
    { term: 'quá khớp', en: 'overfitting', def: 'Mô hình “thuộc bài”: rất đúng trên dữ liệu huấn luyện nhưng kém với dữ liệu mới. Dấu hiệu: điểm huấn luyện cao hơn hẳn điểm kiểm tra.' },
    { term: 'lượng tử hoá', en: 'quantization', def: 'Lưu mỗi trọng số bằng số nguyên 8 bit (int8, 1 byte) thay vì số thực 32 bit (4 byte). Mô hình nhỏ đi khoảng 4 lần, tính nhanh hơn.' },
    { term: 'TensorFlow Lite Micro', en: 'TFLite Micro', def: 'Thư viện chạy mô hình học máy trên vi điều khiển, không cần hệ điều hành. Một lựa chọn để nạp mô hình vào BandW.' },
    { term: 'Edge Impulse', en: 'Edge Impulse', def: 'Nền tảng trên web giúp thu dữ liệu, huấn luyện mô hình TinyML và xuất ra thư viện Arduino.' },
  ],
  lessons: [
    // ───────────────────────── L1 ─────────────────────────
    {
      id: 'l1',
      title: 'TinyML là gì? Học máy chạy ngay trên chip',
      minutes: 9,
      goal: 'Sau bài này, em giải thích được TinyML là gì, vì sao nên chạy trên vòng tay, và BandW hiện có dùng nó chưa.',
      steps: [
        { type: 'sim', title: 'Nhắc lại: quyết định nằm trên chip', sim: 'system-flow', props: { gesture: 'WATER', focus: 'mcu' },
          caption: 'Hiện nay chip nRF52840 dùng luật để quyết định, rồi chỉ gửi một từ qua BLE. TinyML là thay (một phần) bộ luật đó bằng một mô hình nhỏ, vẫn chạy ở đúng chỗ này.' },
        { type: 'text', title: 'TinyML trong một câu',
          body: '[[TinyML]] là chạy một [[mô hình]] học máy ngay trên [[vi điều khiển]], chỉ cần vài chục KB bộ nhớ và rất ít điện. [[huấn luyện]] (training) vẫn làm trên máy tính; trên chip chỉ có [[suy luận]] (inference), tức là đoán.\n\n>! BandW 0.5.0 **chưa có** TinyML: chương này là hướng nghiên cứu.' },
        { type: 'diagram', title: 'Ba chỗ có thể chạy mô hình', svg: SVG_WHERE,
          caption: 'Chạy trên vòng tay giữ được ba điểm mạnh của thiết kế hiện tại: không cần mạng, ít tốn pin vì chỉ gửi một từ, và dữ liệu chuyển động không rời khỏi cổ tay.',
          alt: 'Ba hộp. Máy chủ: cần Internet, gửi dữ liệu thô, trễ và lộ dữ liệu. Điện thoại: máy mạnh nhưng BLE phải gửi 50 mẫu mỗi giây. Vòng tay: TinyML, chip tự quyết định, vẫn chỉ gửi 1 từ. Ghi chú: huấn luyện luôn làm trên máy tính.' },
        { type: 'hotspot', id: 'u11.l1.q1', prompt: 'Chạm vào chỗ chạy mô hình **giữ nguyên** cách BandW chỉ gửi một từ qua Bluetooth.',
          target: { kind: 'diagram', svg: SVG_WHERE }, answer: 'band',
          explanation: 'Chạy trên vòng tay thì chip tự đoán cử chỉ rồi gửi `WATER`, `FOOD`… như cũ. Chạy trên điện thoại hay máy chủ thì phải gửi số liệu thô liên tục.' },
        { type: 'mcq', id: 'u11.l1.q2', prompt: 'Điều nào **không** phải lợi ích của việc chạy mô hình ngay trên vòng tay?',
          options: ['Không cần Internet', 'Không phải gửi số liệu thô qua Bluetooth', 'Không cần dữ liệu có nhãn để huấn luyện', 'Dữ liệu chuyển động không rời cổ tay'],
          answer: 2,
          explanation: 'Chạy ở đâu thì mô hình vẫn phải được huấn luyện bằng [[dữ liệu có nhãn]]. TinyML chỉ thay đổi chỗ chạy bước đoán, không bỏ được bước thu dữ liệu.' },
        { type: 'flashcard', id: 'u11.l1.q3', topic: 'TinyML', prompt: 'Giám khảo hỏi: “TinyML là gì? Nó khác AI trên điện thoại hay ChatGPT thế nào?”',
          modelAnswer: '**TinyML** là học máy thu nhỏ để chạy ngay trên **vi điều khiển** như nRF52840: bộ nhớ chỉ 256 KB RAM, 1 MB flash, không có Internet. ChatGPT là mô hình khổng lồ chạy trên máy chủ. Với TinyML, **huấn luyện làm trên máy tính**, rồi chỉ nạp phần **đoán** (suy luận) vào chip. Mô hình cho BandW chỉ cần nhận ra vài cử chỉ, nên có thể nhỏ tới vài chục đến vài nghìn tham số. BandW hiện **chưa dùng** TinyML, đây là hướng nghiên cứu.',
          keyPoints: ['Học máy chạy trên vi điều khiển', 'Huấn luyện trên máy tính, chip chỉ suy luận', 'Mô hình rất nhỏ, không cần Internet', 'BandW hiện chưa dùng'],
          explanation: 'Câu “chưa dùng” rất quan trọng: đừng để giám khảo nghĩ sản phẩm đã có AI.' },
        { type: 'truefalse', id: 'u11.l1.q4', prompt: 'Firmware BandW 0.5.0 đã nhận cử chỉ bằng một mô hình TinyML.',
          answer: false,
          explanation: 'Sai. Firmware 0.5.0 dùng luật viết sẵn trong `GestureDetector.h` (22°, 250 ms, 2 lần nhấp…). TinyML là kế hoạch ghi trong `firmware/TINYML.md`.' },
        { type: 'match', id: 'u11.l1.q5', prompt: 'Ghép mỗi bước với nơi nó diễn ra trong kế hoạch TinyML.',
          pairs: [
            ['Thu dữ liệu cử chỉ', 'Vòng tay ghi, máy tính lưu'],
            ['Huấn luyện mô hình', 'Máy tính, làm một lần'],
            ['Suy luận (đoán cử chỉ)', 'Chip trên vòng tay, mỗi 200 ms'],
            ['Đọc câu thành tiếng', 'App Android, không đổi'],
          ],
          explanation: 'Huấn luyện tốn nhiều phép tính nên làm trên máy tính. Vòng tay chỉ chạy bước đoán. App vẫn nhận một từ và đọc câu như cũ.' },
        { type: 'flashcard', id: 'u11.l1.q6', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Nếu thêm TinyML thì em có được nói là vòng tay có AI không?”',
          modelAnswer: 'Nếu thêm thì đúng là vòng tay có **một mô hình học máy nhỏ**, nhưng em sẽ nói rõ phạm vi: nó chỉ **phân loại vài cử chỉ** từ dữ liệu IMU, không hiểu ngôn ngữ, không “thông minh” theo nghĩa rộng. Em cũng nói rõ phần nào vẫn là **luật**: về trung tính, thời gian nghỉ, HELP và YES. Còn **hiện nay** BandW 0.5.0 chưa có học máy, nên em không nói là có AI.',
          keyPoints: ['Hiện nay chưa có, không nói là có AI', 'Nếu thêm: mô hình nhỏ phân loại cử chỉ', 'Nói rõ phần nào vẫn là luật', 'Không thổi phồng khả năng'],
          explanation: 'Giám khảo đánh giá cao đội nói đúng phạm vi hơn đội dùng chữ “AI” cho kêu.' },
      ],
    },
    // ───────────────────────── L2 ─────────────────────────
    {
      id: 'l2',
      title: 'Dữ liệu: cửa sổ, nhãn và lớp “không làm gì”',
      minutes: 11,
      goal: 'Sau bài này, em mô tả được dữ liệu một mô hình cử chỉ cần: cửa sổ bao nhiêu mẫu, gán nhãn thế nào, vì sao cần lớp “không làm gì”.',
      steps: [
        { type: 'sim', title: 'Dòng dữ liệu một cử chỉ WATER', sim: 'imu-chart', props: { preset: 'water', signals: ['roll', 'gy'] },
          caption: 'Vòng tay đọc cảm biến 50 lần mỗi giây. Với luật, ta tự đặt ngưỡng trên đường này; với học máy, ta cắt đường này thành từng đoạn và dạy máy tự nhận ra hình dạng.' },
        { type: 'diagram', title: 'Cửa sổ trượt', svg: SVG_WINDOW,
          caption: 'Mỗi [[cửa sổ]] dài 1,5 giây (75 mẫu), đủ chứa một cử chỉ. Cứ 200 ms cửa sổ trượt tiếp và mô hình đoán lại. Khi thu dữ liệu, người làm thí nghiệm ghi nhãn cho từng đoạn.',
          alt: 'Một đường tín hiệu đi xuống rồi lên lại. Khung chữ nhật đánh dấu một cửa sổ 1,5 giây gồm 75 mẫu; khung nét đứt bên cạnh là cửa sổ sau khi trượt 200 ms. Bên dưới là nhãn WATER do người ghi.' },
        { type: 'number', id: 'u11.l2.q1', prompt: 'Vòng tay đọc 50 mẫu mỗi giây. Một cửa sổ dài **1,5 giây** chứa bao nhiêu mẫu?',
          answer: 75, tolerance: 0, unit: 'mẫu',
          explanation: '50 mẫu/giây × 1,5 giây = 75 mẫu. Vòng lặp firmware đọc IMU mỗi 20 ms, tức 50 lần mỗi giây.' },
        { type: 'number', id: 'u11.l2.q2', prompt: 'Mỗi mẫu có 6 số (ax, ay, az, gx, gy, gz). Một cửa sổ 75 mẫu có tất cả bao nhiêu con số?',
          answer: 450, tolerance: 0, unit: 'số',
          explanation: '75 × 6 = 450 con số. Mô hình nhỏ thường không dùng thẳng cả 450 số mà tóm tắt thành vài [[đặc trưng]].' },
        { type: 'text', title: 'Lớp quan trọng nhất là lớp “không làm gì”',
          body: 'Người dùng phần lớn thời gian **không** ra lệnh: họ ăn, uống, gãi đầu, đi lại. Nếu chỉ dạy 4 cử chỉ, mô hình buộc phải chọn một trong 4, nên sẽ phát lệnh nhầm. Vì vậy cần [[lớp không làm gì]] (NONE) với thật nhiều ví dụ đời thường.' },
        { type: 'multi', id: 'u11.l2.q3', prompt: 'Những đoạn dữ liệu nào nên gán nhãn **NONE** (không làm gì)?',
          options: ['Đi bộ', 'Nâng cốc lên miệng rồi giữ', 'Nghiêng trái 40° và giữ', 'Gãi đầu', 'Lắc cổ tay 3 pha nhanh'],
          answers: [0, 1, 3],
          explanation: 'Nghiêng trái giữ là WATER, lắc 3 pha là NO. Đi bộ, nâng cốc, gãi đầu là cử động đời thường: mô hình phải học để im lặng với chúng.' },
        { type: 'hotspot', id: 'u11.l2.q4', prompt: 'Chạm vào phần do **con người** cung cấp, máy không tự biết.',
          target: { kind: 'diagram', svg: SVG_WINDOW }, answer: 'label',
          explanation: 'Nhãn (WATER, FOOD, NONE…) do người làm thí nghiệm ghi, ví dụ nhờ quay video hoặc bấm nút trên app. Không có nhãn đúng thì không huấn luyện được.' },
        { type: 'flashcard', id: 'u11.l2.q5', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Vì sao mô hình của em cần thêm một lớp ‘không làm gì’?”',
          modelAnswer: 'Vì người dùng **phần lớn thời gian không ra lệnh**. Nếu chỉ dạy WATER, FOOD, NO, HELP thì với mỗi cửa sổ mô hình luôn phải chọn một lệnh, nên đi bộ hay gãi đầu cũng thành lệnh: đó là **lệnh nhầm**. Lớp NONE gom các cử động đời thường như nghỉ, đi bộ, nâng cốc, gãi đầu, nghiêng nhẹ thoáng qua. Lớp này cần **nhiều ví dụ nhất**, và em đo số lệnh nhầm trong phiên “không làm gì” dài.',
          keyPoints: ['Phần lớn thời gian không ra lệnh', 'Thiếu NONE thì luôn chọn một lệnh, gây lệnh nhầm', 'NONE gồm cử động đời thường', 'Cần nhiều ví dụ, đo lệnh nhầm'],
          explanation: 'Luật hiện tại cũng có ý tương tự: giữ yên một tư thế không bao giờ thành HELP, nghiêng thoáng qua dưới 250 ms bị bỏ qua.' },
        { type: 'mcq', id: 'u11.l2.q6', prompt: 'Chế độ debug hiện tại của firmware in số liệu IMU **10 lần mỗi giây** và có thể bỏ dòng khi máy tính bận. Muốn thu dữ liệu huấn luyện thì nên làm gì?',
          options: ['Dùng luôn, 10 lần/giây là đủ', 'Thêm chế độ ghi riêng đủ 50 lần/giây, mỗi dòng có thời gian millis() để phát hiện mẫu mất', 'Chụp màn hình Serial Monitor', 'Gửi số liệu qua loa điện thoại'],
          answer: 1,
          explanation: 'Mô hình chạy trên dữ liệu 50 Hz thì phải huấn luyện bằng dữ liệu 50 Hz. Thời gian `millis()` trên từng dòng giúp phát hiện mẫu bị rơi.' },
        { type: 'flashcard', id: 'u11.l2.q7', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Em gán nhãn dữ liệu thế nào để chắc là đúng?”',
          modelAnswer: 'Em ghi dữ liệu và **quay video cùng lúc**, hoặc người hỗ trợ **bấm nút trên app** để đánh dấu lúc bắt đầu và kết thúc mỗi cử chỉ. Mỗi dòng dữ liệu có thời gian `millis()` nên khớp được với video. Sau đó **một bạn khác kiểm tra lại** một phần nhãn. Đoạn nào không rõ thì bỏ, không đoán. Em ghi rõ dữ liệu của ai để sau này chia tập kiểm tra theo người.',
          keyPoints: ['Quay video hoặc bấm nút đánh dấu', 'Khớp thời gian millis() với video', 'Người khác kiểm tra lại nhãn', 'Đoạn không rõ thì bỏ, ghi rõ của ai'],
          explanation: 'Nhãn sai thì mô hình học sai. Đây là phần tốn công nhất của học máy.' },
      ],
    },
    // ───────────────────────── L3 ─────────────────────────
    {
      id: 'l3',
      title: 'Đặc trưng, nơ-ron và độ tự tin',
      minutes: 13,
      goal: 'Sau bài này, em giải thích được một mô hình nhỏ biến cửa sổ dữ liệu thành quyết định, và vì sao cần ngưỡng tự tin.',
      steps: [
        { type: 'sim', title: 'Phòng thí nghiệm: mô hình đoán cử chỉ', sim: 'tinyml-classifier', props: { label: 'WATER', showInt8: false },
          caption: 'Thử từng cử chỉ, bấm “Mẫu khác” vài lần. Rồi chọn “Không làm gì” và kéo ngưỡng tự tin xuống 50%: xem lúc nào vòng tay phát lệnh nhầm.' },
        { type: 'text', title: 'Từ 450 số còn 9 số',
          body: 'Thay vì đưa cả 450 số, ta tóm tắt cửa sổ thành 9 [[đặc trưng]], ví dụ “ax trung bình” (nghiêng trái hay phải) hay “gy dao động” (có lắc không). Mỗi [[nơ-ron]] nhân 9 số này với 9 trọng số rồi cộng lại thành điểm cho một lớp.' },
        { type: 'code', title: 'Một nơ-ron = một phép cộng có trọng số', language: 'text',
          code: 'điểm_WATER = w1 × (ax trung bình) + w2 × (ax nhỏ nhất) + …\n           + w9 × (|a| dao động) + b\n\n5 lớp → 5 nơ-ron → 5 điểm\nsoftmax(5 điểm) → 5 xác suất, cộng lại = 100%\nlớp cao nhất ≥ ngưỡng tự tin? → phát lệnh, không thì im lặng',
          highlight: [1, 6],
          caption: 'Trọng số w1…w9 và b không do người đặt: máy tự tìm khi huấn luyện. Đây là phác thảo minh hoạ, không phải code trong kho.' },
        { type: 'mcq', id: 'u11.l3.q1', prompt: 'Đặc trưng nào giúp mô hình phân biệt **WATER** (nghiêng trái) với **FOOD** (nghiêng phải) rõ nhất?',
          options: ['ax trung bình', 'gy dao động', '|a| dao động', 'ay lớn nhất'],
          answer: 0,
          explanation: 'Nghiêng trái làm ax âm, nghiêng phải làm ax dương, nên “ax trung bình” trái dấu giữa hai lớp. gy dao động hợp để nhận lắc (NO), ay lớn nhất hợp để nhận chúc tay (HELP).' },
        { type: 'number', id: 'u11.l3.q2', prompt: 'Mô hình có 9 đặc trưng và 5 nơ-ron. Mỗi nơ-ron có 9 trọng số và 1 độ lệch. Mô hình có tất cả bao nhiêu tham số?',
          answer: 50, tolerance: 0, unit: 'tham số',
          hint: 'Tính trọng số của 5 nơ-ron, rồi cộng 5 độ lệch.',
          explanation: '9 × 5 = 45 trọng số, cộng 5 độ lệch = 50 tham số. Rất nhỏ so với bộ nhớ của chip.' },
        { type: 'hotspot', id: 'u11.l3.q3', prompt: 'Trong mô phỏng, chạm vào thứ quyết định vòng tay có **dám** phát lệnh hay không.',
          target: { kind: 'sim', sim: 'tinyml-classifier', props: { label: 'NO', showInt8: false } }, answer: 'threshold',
          explanation: 'Mô hình luôn đưa ra xác suất, nhưng chỉ khi xác suất cao nhất vượt **ngưỡng tự tin** thì vòng tay mới phát lệnh. Dưới ngưỡng thì im lặng.' },
        { type: 'order', id: 'u11.l3.q4', prompt: 'Sắp xếp đường đi từ cảm biến đến quyết định.',
          items: ['Lấy cửa sổ 75 mẫu gần nhất', 'Tính 9 đặc trưng', '5 nơ-ron tính 5 điểm', 'Đổi điểm thành xác suất', 'So xác suất cao nhất với ngưỡng tự tin'],
          explanation: 'Dữ liệu → đặc trưng → nơ-ron → xác suất → ngưỡng. Bước cuối giống tinh thần của luật hiện tại: không chắc thì không phát.' },
        { type: 'truefalse', id: 'u11.l3.q5', prompt: 'Nâng ngưỡng tự tin lên cao thì vòng tay ít phát lệnh nhầm hơn, nhưng dễ bỏ sót cử chỉ thật hơn.',
          answer: true,
          explanation: 'Đúng. Ngưỡng cao thì chỉ những cửa sổ rất rõ mới thành lệnh: ít [[lệnh nhầm]] hơn nhưng nhiều lần [[bỏ sót]] hơn. Chọn ngưỡng nào phải dựa trên số đo với người thật.' },
        { type: 'flashcard', id: 'u11.l3.q6', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Mô hình TinyML của em hoạt động thế nào, giải thích đơn giản?”',
          modelAnswer: 'Mỗi 200 ms, chip lấy **75 mẫu gần nhất** (1,5 giây). Em tóm tắt chúng thành **9 đặc trưng** như ax trung bình, gy dao động. Mỗi lớp có một **nơ-ron**: nhân 9 đặc trưng với 9 trọng số, cộng thêm độ lệch, ra một điểm. Năm điểm được đổi thành **xác suất**. Nếu lớp cao nhất là một lệnh và vượt **ngưỡng tự tin** thì mới thành lệnh. Trọng số do máy tự tìm khi huấn luyện trên máy tính. Hiện đây là thí nghiệm trên dữ liệu tổng hợp, chưa có trong firmware.',
          keyPoints: ['Cửa sổ 75 mẫu, mỗi 200 ms', '9 đặc trưng tóm tắt cửa sổ', 'Nơ-ron: tổng có trọng số → xác suất', 'Chỉ phát khi vượt ngưỡng tự tin'],
          explanation: 'Mở mô phỏng ở đầu bài khi trình bày: giám khảo thấy được từng bước.' },
        { type: 'flashcard', id: 'u11.l3.q7', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Nếu mô hình không chắc chắn thì vòng tay làm gì?”',
          modelAnswer: 'Vòng tay **im lặng**. Có ba lớp bảo vệ: xác suất cao nhất phải vượt **ngưỡng tự tin** (khởi đầu 80%); **hai cửa sổ liền nhau** phải cùng đoán một lệnh; và lệnh vẫn phải qua **các luật cũ**: về trung tính, nghỉ 650 ms, không lặp lệnh khi giữ tay. Với người dùng, im lặng rồi làm lại cử chỉ ít hại hơn nói nhầm một câu.',
          keyPoints: ['Không chắc thì im lặng', 'Ngưỡng tự tin, khởi đầu 80%', 'Hai cửa sổ liền nhau đồng ý', 'Vẫn qua luật trung tính, nghỉ 650 ms'],
          explanation: 'Con số 80% là điểm khởi đầu trong kế hoạch, sẽ chỉnh theo số đo thật.' },
      ],
    },
    // ───────────────────────── L4 ─────────────────────────
    {
      id: 'l4',
      title: 'Huấn luyện và kiểm tra công bằng',
      minutes: 12,
      goal: 'Sau bài này, em giải thích được vì sao phải kiểm tra trên người mới và nhận ra mô hình “thuộc bài”.',
      steps: [
        { type: 'sim', title: 'Ít dữ liệu: thuộc bài', sim: 'tinyml-training', props: { people: 1, takes: 1 },
          caption: 'Chỉ 1 người, mỗi cử chỉ 1 lần: cột huấn luyện 100% nhưng với người mới thì sai nhiều. Kéo hai thanh trượt lên để xem cột kiểm tra tăng dần.' },
        { type: 'text', title: 'Hai phần dữ liệu, không được trộn',
          body: '[[tập kiểm tra]] (test set) phải giữ riêng, mô hình không được thấy khi huấn luyện. Với vòng tay, “riêng” nghĩa là **người khác**: kiểm tra trên chính người đã huấn luyện cho con số đẹp nhưng không thật.' },
        { type: 'sim', title: 'Phép thử không công bằng', sim: 'tinyml-training', props: { people: 6, takes: 10, samePeople: true },
          caption: 'Bật “kiểm tra trên chính người đã huấn luyện” rồi tắt đi để so. Đây là dữ liệu tổng hợp nên số nào cũng cao; với dữ liệu thật, khoảng cách thường lớn hơn nhiều.' },
        { type: 'hotspot', id: 'u11.l4.q1', prompt: 'Chạm vào cột cho biết mô hình làm tốt thế nào với **người nó chưa từng thấy**.',
          target: { kind: 'sim', sim: 'tinyml-training', props: { people: 2, takes: 3 } }, answer: 'test-bar',
          explanation: 'Cột “Kiểm tra” đo trên 2 người mới. Đó là con số gần với lúc dùng thật nhất. Cột “Huấn luyện” luôn đẹp hơn vì mô hình đã thấy những dữ liệu đó.' },
        { type: 'mcq', id: 'u11.l4.q2', prompt: 'Mô hình đạt 100% trên dữ liệu huấn luyện nhưng chỉ 70% với người mới. Điều này cho thấy gì?',
          options: ['Mô hình hoàn hảo', 'Mô hình bị quá khớp: thuộc bài, chưa tổng quát', 'Người mới đeo sai', 'Cần bỏ tập kiểm tra đi'],
          answer: 1,
          explanation: 'Khoảng cách lớn giữa huấn luyện và kiểm tra là dấu hiệu [[quá khớp]] (overfitting). Cách sửa: thêm người, thêm mẫu, dùng mô hình nhỏ hơn hoặc đặc trưng tốt hơn.' },
        { type: 'truefalse', id: 'u11.l4.q3', prompt: 'Con số độ chính xác trong mô phỏng của trang học là độ chính xác của BandW trên người thật.',
          answer: false,
          explanation: 'Sai. Mô phỏng dùng [[dữ liệu tổng hợp]] do máy tạo, dễ hơn dữ liệu thật nhiều. Nó minh hoạ cách làm. Độ chính xác thật chỉ có sau khi thu và kiểm tra trên người đeo thật.' },
        { type: 'multi', id: 'u11.l4.q4', prompt: 'Muốn biết mô hình có tốt hơn luật hiện tại không, nhóm cần so những gì **trên cùng một tập kiểm tra**?',
          options: ['Ma trận nhầm lẫn từng cử chỉ', 'Số lệnh nhầm mỗi giờ khi không làm gì', 'Độ trễ từ lúc làm cử chỉ tới lúc phát lệnh', 'Màu giao diện app', 'Thời gian suy luận và pin'],
          answers: [0, 1, 2, 4],
          explanation: 'Màu app không liên quan. Bốn thứ còn lại quyết định người dùng có được lợi không. Riêng lệnh nhầm và HELP bị bỏ sót quan trọng hơn con số trung bình.' },
        { type: 'flashcard', id: 'u11.l4.q5', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Mô hình ‘thuộc bài’ là gì? Làm sao em phát hiện?”',
          modelAnswer: '“Thuộc bài” hay **quá khớp** là mô hình nhớ đúng dữ liệu huấn luyện nhưng **kém với dữ liệu mới**. Em phát hiện bằng cách giữ riêng **tập kiểm tra gồm những người mô hình chưa thấy**, rồi so điểm: huấn luyện cao hơn hẳn kiểm tra là dấu hiệu quá khớp. Cách sửa: thêm người và mẫu, nhất là mẫu “không làm gì”, chọn mô hình nhỏ hơn. Mô phỏng trên trang học cho thấy điều này với dữ liệu tổng hợp.',
          keyPoints: ['Đúng dữ liệu cũ, kém dữ liệu mới', 'Giữ riêng tập kiểm tra theo người', 'Điểm huấn luyện cao hơn hẳn kiểm tra', 'Sửa: thêm người, thêm mẫu, mô hình nhỏ'],
          explanation: 'Kéo thanh “số người” trong mô phỏng từ 1 lên 6 để có ví dụ minh hoạ.' },
        { type: 'flashcard', id: 'u11.l4.q6', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Cần bao nhiêu dữ liệu thì đủ để huấn luyện?”',
          modelAnswer: 'Em **không nêu một con số cố định** khi chưa thử. Cách làm là tăng dần: huấn luyện với ít người, đo trên người mới, rồi thêm người và mẫu, vẽ điểm kiểm tra theo lượng dữ liệu. Khi thêm mà điểm **không tăng nữa** thì gần đủ. **Thêm người khác nhau** thường giúp nhiều hơn bắt một người làm thật nhiều lần, và lớp “không làm gì” cần nhiều mẫu nhất.',
          keyPoints: ['Không nêu số cố định khi chưa thử', 'Tăng dần và đo trên người mới', 'Dừng khi điểm kiểm tra không tăng', 'Nhiều người quan trọng hơn nhiều lần'],
          explanation: 'Bẫy cần tránh: nói “1000 mẫu” hay “10.000 mẫu” mà không có căn cứ.' },
      ],
    },
    // ───────────────────────── L5 ─────────────────────────
    {
      id: 'l5',
      title: 'Thu nhỏ cho vừa chip: int8 và bộ nhớ',
      minutes: 10,
      goal: 'Sau bài này, em ước lượng được mô hình chiếm bao nhiêu bộ nhớ và giải thích lượng tử hoá int8.',
      steps: [
        { type: 'sim', title: 'Bật int8 và so', sim: 'tinyml-classifier', props: { label: 'FOOD', int8: true },
          caption: 'Bật tắt “Trọng số int8” với vài mẫu khác nhau: xác suất gần như không đổi, nhưng mô hình nhỏ đi khoảng 4 lần. Trên chip thật vẫn phải đo lại sau khi lượng tử hoá.' },
        { type: 'text', title: 'Lượng tử hoá',
          body: 'Máy tính lưu mỗi trọng số bằng số thực 32 bit (4 byte). [[lượng tử hoá]] (quantization) đổi nó thành số nguyên 8 bit (1 byte) cộng một hệ số tỉ lệ chung, nên mô hình nhỏ đi khoảng 4 lần và tính nhanh hơn.' },
        { type: 'diagram', title: 'Còn bao nhiêu chỗ trên chip?', svg: SVG_MEMORY,
          caption: 'Firmware hiện dùng 41% flash và 30% RAM. Mô hình 50 tham số gần như không chiếm chỗ; ngay cả mạng khoảng 15.000 tham số cũng chỉ cỡ 15 KB khi dùng int8.',
          alt: 'Thanh Flash 1 MB, firmware chiếm 41%. Thanh RAM 256 KB, firmware chiếm 30%. Một vạch đỏ mảnh đánh dấu mô hình B int8 khoảng 15 KB. Ghi chú: mô hình A 50 tham số chưa tới 100 byte; mô hình B khoảng 15.000 tham số. Ước tính trên giấy.' },
        { type: 'number', id: 'u11.l5.q1', prompt: 'Mô hình có 50 tham số, mỗi tham số lưu bằng số thực 32 bit (4 byte). Mô hình chiếm bao nhiêu byte?',
          visual: { kind: 'diagram', svg: SVG_MEMORY, alt: 'Thanh bộ nhớ flash 1 MB và RAM 256 KB của nRF52840, firmware dùng 41% flash và 30% RAM; ghi chú mô hình A có 50 tham số.' },
          answer: 200, tolerance: 0, unit: 'byte',
          explanation: '50 × 4 = 200 byte. Với int8, 45 trọng số còn 45 byte (độ lệch thường vẫn để 32 bit), tổng khoảng 65 byte.' },
        { type: 'mcq', id: 'u11.l5.q2', prompt: '“int8” trong lượng tử hoá nghĩa là gì?',
          options: ['Mô hình có 8 nơ-ron', 'Mỗi trọng số lưu bằng số nguyên 8 bit, từ −128 đến 127', 'Mô hình chạy 8 lần mỗi giây', 'Mô hình cần 8 KB RAM'],
          answer: 1,
          explanation: 'int8 là số nguyên 8 bit. Trọng số thật ≈ số nguyên × hệ số tỉ lệ. Mất một chút độ chính xác nhưng gọn và nhanh hơn trên vi điều khiển.' },
        { type: 'match', id: 'u11.l5.q3', prompt: 'Ghép mỗi công cụ hoặc thiết bị với vai trò của nó.',
          pairs: [
            ['Edge Impulse', 'Thu dữ liệu, huấn luyện, xuất thư viện Arduino'],
            ['TensorFlow Lite Micro', 'Chạy mô hình trên vi điều khiển'],
            ['Máy tính của nhóm', 'Huấn luyện và lượng tử hoá'],
            ['Chip nRF52840', 'Suy luận mỗi 200 ms'],
          ],
          explanation: '[[Edge Impulse]] và [[TensorFlow Lite Micro]] là hai lựa chọn phổ biến. Với mô hình 50 tham số, nhóm thậm chí có thể tự chép trọng số vào một mảng C.' },
        { type: 'truefalse', id: 'u11.l5.q4', prompt: 'Với TinyML, vòng tay tự huấn luyện mô hình mỗi khi người dùng đeo.',
          answer: false,
          explanation: 'Sai. Huấn luyện cần nhiều phép tính và dữ liệu có nhãn, nên làm trên máy tính. Vòng tay chỉ nhận trọng số đã huấn luyện và chạy bước đoán.' },
        { type: 'flashcard', id: 'u11.l5.q5', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Chip nhỏ như vậy có đủ bộ nhớ chạy mô hình không?”',
          modelAnswer: 'nRF52840 có **1 MB flash và 256 KB RAM**; firmware hiện dùng **41% flash, 30% RAM**. Mô hình nhỏ nhất em thử có **50 tham số**, chỉ khoảng 200 byte nếu dùng số thực, 65 byte nếu int8. Bộ đệm 75 mẫu × 6 trục × 4 byte là 1.800 byte RAM. Kể cả mạng lớn hơn khoảng 15.000 tham số cũng chỉ cỡ 15 KB int8. Đây là **ước tính trên giấy**, em sẽ xác nhận bằng cách biên dịch và đo thời gian suy luận bằng `micros()`.',
          keyPoints: ['1 MB flash, 256 KB RAM; đang dùng 41%, 30%', 'Mô hình 50 tham số: khoảng 200 byte', 'Bộ đệm 1.800 byte RAM', 'Ước tính, phải biên dịch và đo'],
          explanation: 'Số 41% và 30% lấy từ `firmware/README.md`. Phần còn lại là tính toán, nói rõ là ước tính.' },
        { type: 'flashcard', id: 'u11.l5.q6', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Lượng tử hoá int8 có làm mô hình kém đi không?”',
          modelAnswer: '**Có thể kém đi một chút**, vì mỗi trọng số bị làm tròn về 256 mức. Với mô hình nhỏ như của em, trong mô phỏng trên dữ liệu tổng hợp, xác suất gần như không đổi. Nhưng em không lấy đó làm kết luận: sau khi lượng tử hoá, em **chạy lại toàn bộ tập kiểm tra** trên bản int8 và so với bản số thực. Nếu kém đi rõ thì giữ số thực, vì chip có FPU và mô hình đủ nhỏ.',
          keyPoints: ['Có thể kém đi chút vì làm tròn', 'Mô phỏng: gần như không đổi', 'Đo lại tập kiểm tra trên bản int8', 'Kém rõ thì giữ số thực, chip có FPU'],
          explanation: 'Cortex-M4F có bộ tính số thực (FPU), nên với mô hình rất nhỏ, int8 không bắt buộc.' },
      ],
    },
    // ───────────────────────── L6 ─────────────────────────
    {
      id: 'l6',
      title: 'Kế hoạch đưa TinyML vào BandW',
      minutes: 13,
      goal: 'Sau bài này, em trình bày được kế hoạch từng bước áp dụng TinyML vào BandW và vì sao giữ lại các luật an toàn.',
      steps: [
        { type: 'sim', title: 'Phần luật sẽ được giữ lại', sim: 'gesture-state-machine', props: { scenario: 'water', showCode: false, showTimers: true },
          caption: 'Máy trạng thái hiện tại lo việc chờ về trung tính, nghỉ 650 ms và không lặp lệnh khi giữ tay. Trong kế hoạch, mô hình chỉ thay bước “nhận ra cử chỉ”, còn các luật này giữ nguyên.' },
        { type: 'diagram', title: 'Kiến trúc lai: mô hình đề xuất, luật kiểm soát', svg: SVG_HYBRID,
          caption: 'Mô hình (nét đứt, chưa có) đoán mỗi 200 ms và chỉ đưa ra ứng viên khi đủ tự tin. Luật cũ quyết định có phát hay không. BLE và app không đổi.',
          alt: 'Bộ đệm 75 mẫu đưa vào Mô hình (mới, nét đứt) chạy mỗi 200 ms với ngưỡng 80%. Mũi tên xuống khối Luật giữ nguyên: về trung tính, nghỉ 650 ms, không lặp lệnh, HELP 2 lần nhấp, YES gõ đôi phần cứng. Sau đó BLE gửi 1 từ.' },
        { type: 'code', title: 'Phác thảo vòng lặp có mô hình', language: 'cpp', source: 'firmware/TINYML.md',
          code: '// PHÁC THẢO: chưa có trong BandW_Sense.ino\nstatic float ring[WINDOW][6];            // 75 mẫu gần nhất\nstatic int head = 0, sinceInfer = 0, lastBest = NONE;\n\nvoid onSample(const float s[6]) {        // gọi mỗi 20 ms\n  memcpy(ring[head], s, sizeof(ring[0]));\n  head = (head + 1) % WINDOW;\n  if (++sinceInfer < 10) return;          // 10 mẫu = 200 ms\n  sinceInfer = 0;\n  float feat[9], prob[5];\n  computeFeatures(ring, head, feat);      // 9 đặc trưng như trang học\n  runModel(feat, prob);                   // trọng số int8\n  int best = argmax(prob, 5);\n  if (best != NONE && prob[best] >= 0.80f && best == lastBest)\n    candidate = best;                     // 2 cửa sổ liền nhau đồng ý\n  lastBest = best;                        // luật cũ quyết định có phát hay không\n}',
          highlight: [8, 14],
          caption: 'Trích từ kế hoạch trong firmware/TINYML.md, chưa biên dịch. Dòng 8: chỉ đoán mỗi 10 mẫu. Dòng 14: đủ tự tin và hai cửa sổ liền nhau đồng ý mới thành ứng viên.',
          notes: [
            { lines: [6, 7], note: 'Bộ đệm vòng: ghi đè mẫu cũ nhất, luôn giữ 75 mẫu gần nhất.' },
            { lines: [14, 15], note: 'candidate là biến ứng viên mà máy trạng thái đã có; mô hình chỉ đề xuất.' },
          ] },
        { type: 'hotspot', id: 'u11.l6.q1', prompt: 'Chạm vào khối chứa các **luật an toàn** được giữ nguyên như firmware 0.5.0.',
          target: { kind: 'diagram', svg: SVG_HYBRID }, answer: 'rules',
          explanation: 'Luật an toàn (trung tính, nghỉ 650 ms, HELP, YES) và BLE gửi một từ đều giữ nguyên. Chỉ bộ đệm và mô hình là phần mới.' },
        { type: 'mcq', id: 'u11.l6.q2', prompt: 'Vì sao trong giai đoạn đầu, **HELP** vẫn nhận bằng luật thay vì giao cho mô hình?',
          options: ['Vì mô hình không nhận được chuyển động chúc tay', 'Vì HELP là lệnh quan trọng nhất; luật hai lần nhấp đã có kiểm thử chống nhầm, mô hình chỉ thay khi số đo chứng minh an toàn hơn', 'Vì HELP không gửi qua BLE', 'Vì giám khảo yêu cầu'],
          answer: 1,
          explanation: 'Nhầm hoặc bỏ sót HELP gây hại lớn nhất. Không thay một cách làm đã kiểm thử bằng một cách chưa đo.' },
        { type: 'order', id: 'u11.l6.q3', prompt: 'Sắp xếp các bước của kế hoạch TinyML theo đúng thứ tự.',
          items: ['Ghi dữ liệu 50 Hz và gán nhãn, từ nhiều người', 'Cắt cửa sổ, tính đặc trưng', 'Huấn luyện trên máy tính, giữ riêng người để kiểm tra', 'Lượng tử hoá, nạp vào vòng tay', 'So với luật hiện tại trên cùng tập kiểm tra'],
          explanation: 'Không có dữ liệu thì không có mô hình. Bước cuối là so công bằng: mô hình chỉ thay luật khi tốt hơn rõ.' },
        { type: 'truefalse', id: 'u11.l6.q4', prompt: 'Thêm TinyML vào firmware thì app Android phải viết lại để nhận số liệu mới.',
          answer: false,
          explanation: 'Sai. Vòng tay vẫn gửi đúng một từ như `WATER` qua characteristic lệnh. App không cần biết lệnh đến từ luật hay từ mô hình.' },
        { type: 'flashcard', id: 'u11.l6.q5', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Em sẽ áp dụng TinyML vào BandW cụ thể thế nào?”',
          modelAnswer: 'Em làm theo kế hoạch trong `firmware/TINYML.md`. Một: thêm chế độ **ghi dữ liệu 50 Hz**, gán nhãn bằng video, thu từ **nhiều người**, có nhiều đoạn “không làm gì”. Hai: cắt **cửa sổ 1,5 giây**, tính 9 đặc trưng, **huấn luyện trên máy tính**, kiểm tra trên người mới. Ba: **lượng tử hoá** rồi nạp vào chip, đoán mỗi 200 ms. Mô hình chỉ **đề xuất** ứng viên; luật trung tính, nghỉ 650 ms, HELP và YES giữ nguyên, BLE và app không đổi. Cuối cùng so với luật trên cùng tập kiểm tra.',
          keyPoints: ['Ghi dữ liệu 50 Hz, nhiều người, có NONE', 'Cửa sổ, đặc trưng, huấn luyện trên máy tính', 'Lượng tử hoá, nạp chip, mỗi 200 ms', 'Mô hình đề xuất, luật giữ an toàn', 'So với luật trên cùng tập kiểm tra'],
          explanation: 'Mở sơ đồ kiến trúc lai khi trả lời. Nói rõ đây là kế hoạch, chưa làm.' },
        { type: 'flashcard', id: 'u11.l6.q6', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Khi nào nhóm mới thay luật bằng mô hình?”',
          modelAnswer: 'Chỉ khi **số đo chứng minh** mô hình tốt hơn rõ, trên **cùng một tập kiểm tra gồm người mới**: ít lệnh nhầm hơn trong phiên “không làm gì”, nhận đúng nhiều hơn, độ trễ không tệ hơn, và vẫn giải thích được khi sai. Nếu chỉ hơn chút ít, em giữ luật vì luật dễ giải thích và đã có kiểm thử. Mô hình hợp nhất khi luật gặp khó: ví dụ người cử động yếu, hoặc muốn thêm cử chỉ phức tạp.',
          keyPoints: ['Cùng tập kiểm tra, người mới', 'Ít lệnh nhầm hơn, nhận đúng hơn', 'Độ trễ và khả năng giải thích', 'Hơn chút ít thì giữ luật'],
          explanation: 'Câu này nối với bài “Dựa trên luật hay học máy?” ở chương 9.' },
        { type: 'flashcard', id: 'u11.l6.q7', topic: 'TinyML', prompt: 'Giám khảo hỏi: “Sao YES (gõ 2 lần) không đưa vào mô hình luôn?”',
          modelAnswer: 'YES dùng **bộ nhận gõ đôi có sẵn trong cảm biến LSM6DS3**, chạy ở 416 Hz bên trong chip cảm biến. Cú gõ là một cú sốc **rất ngắn**, còn cửa sổ của mô hình lấy mẫu 50 Hz, mỗi 20 ms một lần, nên **dễ lọt mất cú gõ**. Phần cứng đã làm việc này tốt và gần như không tốn sức chip chính. Vì vậy em giữ YES bằng phần cứng và luật kiểm tra tay yên, chỉ giao cho mô hình các cử chỉ dài hơn như nghiêng và lắc.',
          keyPoints: ['YES dùng bộ gõ đôi phần cứng', 'Cú gõ rất ngắn, 50 Hz dễ lọt', 'Phần cứng làm tốt, tốn ít sức chip', 'Mô hình lo cử chỉ dài: nghiêng, lắc'],
          explanation: 'Trong firmware, gia tốc kế đặt 416 Hz để nhận gõ, nhưng vòng lặp chỉ đọc mẫu mỗi 20 ms.' },
      ],
    },
  ],
};
