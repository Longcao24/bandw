// public/content/unit08.js: Chương 8, Thử nghiệm, đánh giá, hạn chế và luyện phản biện (Writer D)
// Mọi số liệu ma trận trong chương này là SỐ LIỆU MINH HOẠ, không phải kết quả thật của dự án.

const T = 'style="fill:var(--c-text)"';
const MUTED = 'style="fill:var(--c-muted)"';

const GESTURES = ['WATER', 'FOOD', 'NO', 'YES', 'HELP'];
const COLS = [...GESTURES, 'NONE'];
// Số liệu minh hoạ: mỗi cử chỉ 20 lần. Hàng = cử chỉ định làm, cột = máy nhận được (NONE = không nhận).
const DEMO = [
  [18, 0, 0, 0, 0, 2],
  [0, 19, 0, 0, 0, 1],
  [0, 0, 17, 1, 0, 2],
  [0, 0, 0, 15, 0, 5],
  [0, 3, 0, 0, 16, 1],
];

function matrixSvg() {
  const x0 = 112, y0 = 74, w = 78, h = 44;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" font-family="inherit" role="img">';
  s += `<text x="300" y="20" font-size="15" font-weight="700" text-anchor="middle" style="fill:var(--c-warn)">⚠ Số liệu minh hoạ, không phải kết quả thật</text>`;
  s += `<text x="${x0 + 3 * w}" y="44" font-size="14" text-anchor="middle" ${MUTED}>Máy nhận được →</text>`;
  COLS.forEach((c, j) => {
    s += `<text x="${x0 + j * w + w / 2}" y="${y0 - 8}" font-size="14" font-weight="700" text-anchor="middle" ${T}>${c === 'NONE' ? 'Không nhận' : c}</text>`;
  });
  GESTURES.forEach((r, i) => {
    const y = y0 + i * h;
    s += `<text x="${x0 - 10}" y="${y + 28}" font-size="15" font-weight="700" text-anchor="end" ${T}>${r}</text>`;
    COLS.forEach((c, j) => {
      const n = DEMO[i][j];
      const fill = i === j ? 'var(--c-success-bg)' : n ? 'var(--c-danger-bg)' : 'var(--c-surface)';
      const stroke = i === j ? 'var(--c-success)' : 'var(--c-border)';
      const label = `Làm ${r}, máy ${c === 'NONE' ? 'không nhận' : 'nhận ' + c}: ${n} lần`;
      s += `<g data-hotspot="cell-${r}-${c}" data-label="${label}"><rect x="${x0 + j * w + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="6" style="fill:${fill};stroke:${stroke};stroke-width:2"/>`;
      s += `<text x="${x0 + j * w + w / 2}" y="${y + 28}" font-size="16" font-weight="${n ? 700 : 400}" text-anchor="middle" ${n ? T : MUTED}>${n}</text></g>`;
    });
  });
  s += `<text x="20" y="${y0 + 5 * h + 30}" font-size="14" ${MUTED}>↑ Hàng: cử chỉ định làm (mỗi hàng 20 lần). Ô viền xanh: nhận đúng.</text>`;
  s += `<text x="20" y="${y0 + 5 * h + 54}" font-size="14" ${MUTED}>Ô nền đỏ nhạt: nhận sai hoặc không nhận.</text>`;
  return s + '</svg>';
}

function recordSheetSvg() {
  const cols = [
    ['col-trial', 'Cột Lần thử', 'Lần', 56],
    ['col-intended', 'Cột Cử chỉ dự định', 'Dự định', 116],
    ['col-detected', 'Cột Máy nhận được', 'Máy nhận', 116],
    ['col-time', 'Cột Thời điểm', 'Thời điểm', 112],
    ['col-note', 'Cột Ghi chú', 'Ghi chú', 196],
  ];
  const rows = [
    ['1', 'FOOD', 'FOOD', '09:12:05', 'Ngồi ghế'],
    ['2', 'NO', 'Không nhận', '09:12:21', 'Lắc hơi chậm'],
    ['3', 'WATER', 'WATER', '09:12:40', ''],
  ];
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 260" font-family="inherit" role="img">';
  s += `<text x="300" y="22" font-size="15" font-weight="700" text-anchor="middle" ${T}>Phiếu ghi kết quả (ví dụ, người thử A)</text>`;
  let x = 2;
  cols.forEach(([id, label, head, cw], j) => {
    s += `<g data-hotspot="${id}" data-label="${label}"><rect x="${x}" y="40" width="${cw - 4}" height="210" rx="8" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>`;
    s += `<text x="${x + 8}" y="66" font-size="15" font-weight="700" ${T}>${head}</text>`;
    rows.forEach((r, i) => { s += `<text x="${x + 8}" y="${110 + i * 48}" font-size="14" ${T}>${r[j]}</text>`; });
    s += '</g>';
    x += cw;
  });
  s += '<line x1="2" y1="80" x2="598" y2="80" style="stroke:var(--c-border);stroke-width:2"/>';
  return s + '</svg>';
}

function ladderSvg() {
  const rungs = [
    ['compile', 'Bậc 1: Biên dịch được', 'Biên dịch được (41% flash, 30% RAM)'],
    ['synthetic', 'Bậc 2: Kiểm thử tổng hợp', 'Qua kiểm thử tổng hợp trên máy tính'],
    ['board', 'Bậc 3: Thử trên board thật', 'Nạp lên board, thử đủ 5 cử chỉ qua BLE'],
    ['healthy', 'Bậc 4: Đo trên người khỏe', 'Đo độ chính xác trên người khỏe đeo thử'],
    ['target', 'Bậc 5: Người dùng mục tiêu', 'Thử với người dùng mục tiêu, có giám sát'],
  ];
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 330" font-family="inherit" role="img">';
  s += `<text x="300" y="22" font-size="15" font-weight="700" text-anchor="middle" ${T}>Thang bằng chứng: leo từ dưới lên</text>`;
  rungs.forEach(([id, label, text], i) => {
    const y = 270 - i * 56, x = 40 + i * 28;
    s += `<g data-hotspot="${id}" data-label="${label}"><rect x="${x}" y="${y}" width="${520 - i * 28}" height="44" rx="10" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:2"/>`;
    s += `<text x="${x + 14}" y="${y + 28}" font-size="15" ${T}><tspan font-weight="700">${i + 1}.</tspan> ${text}</text></g>`;
  });
  return s + '</svg>';
}

function ruleVsMlSvg() {
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" font-family="inherit" role="img">';
  s += '<g data-hotspot="rules" data-label="Hộp trong suốt: dựa trên luật">';
  s += '<rect x="10" y="40" width="280" height="230" rx="16" style="fill:var(--c-surface);stroke:var(--c-success);stroke-width:3"/>';
  s += '<text x="150" y="28" font-size="16" font-weight="700" text-anchor="middle" style="fill:var(--c-success)">Dựa trên luật (BandW)</text>';
  ['Nghiêng > 22°', 'Giữ ≥ 250 ms', 'Đã về trung tính', '→ WATER / FOOD'].forEach((t, i) => {
    s += `<text x="30" y="${84 + i * 42}" font-size="16" ${T}>${i < 3 ? '✓ ' : ''}${t}</text>`;
  });
  s += `<text x="30" y="254" font-size="14" ${MUTED}>Nhìn thấy từng bước quyết định</text></g>`;
  s += '<g data-hotspot="model" data-label="Hộp đen: học máy">';
  s += '<rect x="310" y="40" width="280" height="230" rx="16" style="fill:var(--c-text);stroke:var(--c-text);stroke-width:3"/>';
  s += '<text x="450" y="28" font-size="16" font-weight="700" text-anchor="middle" ' + T + '>Học máy</text>';
  s += '<text x="450" y="110" font-size="16" text-anchor="middle" style="fill:var(--c-bg)">Rất nhiều dữ liệu có nhãn</text>';
  s += '<text x="450" y="150" font-size="28" text-anchor="middle" style="fill:var(--c-bg)">⬇ ? ⬇</text>';
  s += '<text x="450" y="190" font-size="16" text-anchor="middle" style="fill:var(--c-bg)">Mô hình đoán cử chỉ</text>';
  s += '<text x="450" y="254" font-size="14" text-anchor="middle" style="fill:var(--c-bg)">Khó giải thích từng quyết định</text></g>';
  return s + '</svg>';
}

export default {
  id: 'u08',
  title: 'Thử nghiệm, đánh giá, hạn chế và phản biện',
  description: 'Kiểm thử tự động, thiết kế thí nghiệm, đọc ma trận nhầm lẫn, nói trung thực về kết quả và hạn chế.',
  color: 'orange',
  icon: '🔬',
  glossary: [
    { term: 'kiểm thử tự động', en: 'automated test', def: 'Chương trình tự chạy thuật toán với dữ liệu cho trước và tự kiểm tra kết quả, lặp lại được bao nhiêu lần cũng ra như nhau.' },
    { term: 'dữ liệu tổng hợp', en: 'synthetic data', def: 'Dữ liệu do người viết tạo ra bằng công thức (ví dụ "nghiêng −45° trong 1,6 giây"), không phải đo từ tay người thật.' },
    { term: 'assert', en: 'assertion', def: 'Lệnh kiểm tra "điều này phải đúng". Nếu sai, chương trình kiểm thử dừng lại và báo lỗi ngay.' },
    { term: 'biến độc lập', en: 'independent variable', def: 'Thứ người làm thí nghiệm chủ động thay đổi, ví dụ cử chỉ được làm, người đeo, tư thế ngồi hay nằm.' },
    { term: 'biến phụ thuộc', en: 'dependent variable', def: 'Thứ được đo để xem có thay đổi không, ví dụ lệnh máy nhận được và thời gian phản hồi.' },
    { term: 'cỡ mẫu', en: 'sample size', def: 'Số lần thử (và số người thử) trong thí nghiệm. Cỡ mẫu quá nhỏ thì kết luận không đáng tin.' },
    { term: 'ma trận nhầm lẫn', en: 'confusion matrix', def: 'Bảng đếm: hàng là cử chỉ định làm, cột là lệnh máy nhận được. Đường chéo là các lần nhận đúng.' },
    { term: 'độ chính xác', en: 'accuracy', def: 'Tỉ lệ số lần nhận đúng trên tổng số lần thử, thường ghi bằng phần trăm.' },
    { term: 'lệnh nhầm', en: 'false positive', def: 'Máy phát ra một lệnh khi người dùng không định làm cử chỉ đó (hoặc không làm gì).' },
    { term: 'bỏ sót', en: 'false negative', def: 'Người dùng làm cử chỉ nhưng máy không nhận ra lệnh nào.' },
    { term: 'thời gian phản hồi', en: 'latency', def: 'Khoảng thời gian từ lúc bắt đầu cử chỉ đến lúc nghe được câu nói.' },
    { term: 'sự đồng ý', en: 'informed consent', def: 'Người tham gia được giải thích rõ thí nghiệm và tự nguyện đồng ý trước khi thử.' },
  ],
  lessons: [
    // ───────────────────────── L1 ─────────────────────────
    {
      id: 'l1',
      title: 'Kiểm thử tự động trên máy tính',
      minutes: 10,
      goal: 'Sau bài này, em giải thích được gesture_test.cpp kiểm tra gì và nó chưa chứng minh được gì.',
      steps: [
        { type: 'sim', sim: 'code-stepper', title: 'Chạy thử một đoạn kiểm thử',
          props: {
            language: 'cpp', title: 'Trích từ firmware/tests/gesture_test.cpp',
            code: 'Rig r; r.neutral();\nr.hold(-45, 1600); assert(r.events.size()==1 && r.events[0]==Gesture::Water);\nr.hold(-45, 3000); assert(r.events.size()==1); // Held posture never repeats.\nr.hold(45, 1800); assert(r.events.size()==1); // Must return to neutral first.\nr.neutral(); r.hold(45, 1600); assert(r.events.size()==2 && r.events[1]==Gesture::Food);',
            steps: [
              { line: 1, vars: { events: '[]' }, note: 'Tạo bộ thử, giữ tay trung tính 2,2 giây (dữ liệu giả).' },
              { line: 2, vars: { events: '[WATER]' }, cond: { expr: 'events.size()==1 && events[0]==Water', value: true }, out: '✓ đúng 1 lệnh WATER', note: 'Nghiêng trái 45° trong 1,6 giây.' },
              { line: 3, cond: { expr: 'events.size()==1', value: true }, out: '✓ giữ tiếp 3 giây không lặp lệnh', note: 'Giữ nguyên tư thế không được phát thêm.' },
              { line: 4, cond: { expr: 'events.size()==1', value: true }, out: '✓ sang phải ngay thì không phát', note: 'Chưa về trung tính nên FOOD chưa được phát.' },
              { line: 5, vars: { events: '[WATER, FOOD]' }, cond: { expr: 'events.size()==2 && events[1]==Food', value: true }, out: '✓ về trung tính rồi mới ra FOOD', note: 'Về trung tính trước, sau đó nghiêng phải mới ra FOOD.' },
            ],
          },
          caption: 'Bấm ⏭ để chạy từng dòng. Mỗi [[assert]] đúng thì hiện dấu ✓; chỉ cần một dòng sai là chương trình dừng và báo lỗi.' },
        { type: 'text', title: 'Thử nghiệm "trong phòng lab ảo"',
          body: 'Tệp `gesture_test.cpp` là một bộ [[kiểm thử tự động]]: nó bơm [[dữ liệu tổng hợp]] mỗi 20 ms vào đúng thuật toán của firmware rồi kiểm tra kết quả. Ưu điểm là chạy nhanh, lặp lại y hệt; hạn chế là đây **không phải** tay người thật.' },
        { type: 'code', language: 'cpp', source: 'firmware/tests/gesture_test.cpp',
          code: 'void hold(float tilt, int ms) { for (int t=0; t<ms; t+=20) sample(tilt); }\n// …\nvoid neutral() { hold(0, 2200); }\n// …\nRig brief; brief.neutral(); brief.hold(-45, 200); brief.neutral(); assert(brief.events.empty());\nRig single; single.neutral();\nfor(int i=0;i<15;++i) single.sample(0,200);\nsingle.neutral(); assert(single.events.empty()); // One fast rotation isn\'t a shake.',
          highlight: [5, 8],
          caption: 'hold() đưa một mẫu mỗi 20 ms. Ca "brief": nghiêng chỉ 200 ms thì không được phát lệnh. Ca "single": một cú xoay một chiều không phải lắc.' },
        { type: 'sim', sim: 'imu-chart', props: { signals: ['roll', 'gy'], preset: 'water', thresholds: true, readout: true },
          caption: 'Đồ thị dữ liệu tổng hợp kiểu giống trong kiểm thử: góc nghiêng đi xuống quá −22°, giữ, rồi lệnh WATER hiện lên.' },
        { type: 'match', id: 'u08.l1.q1', prompt: 'Ghép tên ca kiểm thử với điều nó chứng minh.',
          pairs: [['brief', 'Nghiêng quá ngắn (200 ms) thì không phát'], ['single', 'Một cú xoay nhanh một chiều không phải lắc'], ['reconnect', 'Kết nối lại thì phải về trung tính trước'], ['overflow', 'Bộ đếm thời gian tràn số vẫn chạy đúng'], ['diagonal', 'Nghiêng chéo cả hai trục không ra lệnh']],
          explanation: 'Mỗi ca kiểm thử nhắm vào một tình huống dễ gây lỗi. Khi trả lời giám khảo, nêu tên vài ca cụ thể sẽ thuyết phục hơn nói chung chung "đã test".' },
        { type: 'truefalse', id: 'u08.l1.q2', prompt: 'Vì mọi kiểm thử trên máy tính đều qua, vòng tay chắc chắn chính xác 100% với người thật.',
          answer: false,
          explanation: 'Kiểm thử dùng dữ liệu tổng hợp nên chỉ chứng minh **logic** đúng như thiết kế. README ghi rõ tỉ lệ nhận đúng trên người đeo thật chưa được xác định.' },
        { type: 'mcq', id: 'u08.l1.q3', prompt: 'Lệnh `assert(điều kiện)` làm gì?',
          options: ['Nếu điều kiện sai, dừng chương trình kiểm thử và báo lỗi', 'Gửi lệnh qua BLE', 'Tự sửa code cho đúng', 'Đọc dữ liệu từ cảm biến thật'],
          answer: 0,
          explanation: 'assert là "lời khẳng định". Khẳng định sai thì kiểm thử thất bại ngay, nên lỗi không thể lọt qua mà không ai biết.' },
        { type: 'predict', id: 'u08.l1.q4', language: 'cpp', prompt: 'Sau ca kiểm thử này, `brief.events.empty()` là gì?',
          code: 'Rig brief; brief.neutral();\nbrief.hold(-45, 200);\nbrief.neutral();\nassert(brief.events.empty());', highlight: [2],
          options: ['true: không có lệnh nào, assert qua', 'false: có một lệnh WATER', 'false: có lệnh NO', 'Chương trình báo lỗi'],
          answer: 0,
          hint: 'Nghiêng chỉ 200 ms, mà luật cần tay lắng rồi giữ đủ 250 ms.',
          explanation: '200 ms chưa đủ thời gian giữ nên không có lệnh. Danh sách sự kiện rỗng, `empty()` là true và assert qua.' },
        { type: 'number', id: 'u08.l1.q5', prompt: '`r.hold(-45, 1600)` đưa vào thuật toán bao nhiêu mẫu? (mỗi mẫu cách 20 ms)',
          answer: 80, tolerance: 0, unit: 'mẫu',
          explanation: 'Vòng `for (t=0; t<1600; t+=20)` chạy 1600 / 20 = 80 lần, mỗi lần một mẫu.' },
        { type: 'sim-predict', id: 'u08.l1.q6', prompt: 'Dữ liệu tổng hợp: tay nghiêng trái rõ và giữ lâu. Thuật toán sẽ phát gì?',
          sim: 'imu-chart', props: { signals: ['roll'], preset: 'water', thresholds: true }, pauseAt: 'before', revealTo: 'event',
          options: ['WATER', 'FOOD', 'NO', 'Không phát gì'],
          answer: 0,
          explanation: 'Góc đã lọc vượt −22° (trái), giữ đủ lâu sau khi lắng, nên phát WATER. Đồ thị dùng cùng logic với firmware.' },
        { type: 'flashcard', id: 'u08.l1.q7', prompt: 'Giám khảo hỏi: "Em đã kiểm tra thuật toán bằng cách nào?"',
          modelAnswer: 'Nhóm có chương trình kiểm thử tự động `gesture_test.cpp` chạy trên máy tính. Nó bơm dữ liệu tổng hợp mỗi 20 ms vào đúng code `GestureDetector.h` và dùng `assert` kiểm tra: trái ra WATER, phải ra FOOD, giữ không lặp lệnh, phải về trung tính, lắc ra NO, giữ quá ngắn không phát, dữ liệu lỗi bị bỏ, bộ đếm thời gian tràn vẫn đúng… Đây là kiểm thử **phần mềm**; độ chính xác trên **người thật** phải đo bằng thí nghiệm riêng.',
          keyPoints: ['gesture_test.cpp, dữ liệu tổng hợp', 'Nêu 3–4 ca cụ thể', 'assert tự kiểm tra', 'Phân biệt với thử trên người thật'],
          explanation: 'Câu cuối là quan trọng nhất: đừng để giám khảo nghĩ em lẫn lộn hai loại bằng chứng.' },
      ],
    },

    // ───────────────────────── L2 ─────────────────────────
    {
      id: 'l2',
      title: 'Thiết kế thí nghiệm với người đeo',
      minutes: 11,
      goal: 'Sau bài này, em lập được kế hoạch đo độ chính xác: làm gì, bao nhiêu lần, ghi những gì.',
      steps: [
        { type: 'video', id: 'v-experiment', title: 'Thí nghiệm và ma trận nhầm lẫn',
          caption: 'Xem cách tổ chức một buổi thử: kịch bản, đếm kết quả, đọc ma trận và nêu hạn chế. Số liệu trong video là minh hoạ.',
          fallbackSim: { sim: 'confusion-matrix', props: { data: 'demo' } } },
        { type: 'text', title: 'Thay đổi gì, đo gì?',
          body: '[[biến độc lập]] là thứ em chủ động thay đổi: cử chỉ, người đeo, tư thế ngồi hay nằm. [[biến phụ thuộc]] là thứ em đo: máy nhận được lệnh gì và mất bao lâu.\n\n> Giống thí nghiệm Sinh học: đổi lượng nước tưới, đo chiều cao cây.' },
        { type: 'diagram', title: 'Phiếu ghi kết quả', svg: recordSheetSvg(),
          caption: 'Mỗi lần thử là một dòng. Ghi cả lần nhận sai và không nhận, đừng chỉ ghi lần thành công.',
          alt: 'Bảng năm cột: Lần, Dự định, Máy nhận, Thời điểm, Ghi chú, với ba dòng ví dụ: FOOD nhận FOOD, NO không nhận vì lắc chậm, WATER nhận WATER.' },
        { type: 'text', title: 'Một quy trình gợi ý',
          body: 'Mỗi cử chỉ thử ít nhất khoảng 20 lần với nhiều người, theo **thứ tự ngẫu nhiên** để tránh quen tay hay mỏi tay, rồi thêm một phiên vài phút **sinh hoạt bình thường, không cố làm cử chỉ** để đếm [[lệnh nhầm]].\n\n>! Trước khi thử phải giải thích và xin [[sự đồng ý]] của người tham gia.' },
        { type: 'order', id: 'u08.l2.q1', prompt: 'Sắp xếp các bước của một buổi thử nghiệm.',
          items: ['Giải thích và xin sự đồng ý', 'Đeo vòng tay, hiệu chuẩn', 'Làm cử chỉ theo thứ tự ngẫu nhiên, ghi từng lần', 'Phiên sinh hoạt bình thường để đếm lệnh nhầm', 'Tổng hợp vào ma trận nhầm lẫn'],
          explanation: 'Đồng ý trước, hiệu chuẩn rồi mới đo. Phiên "không làm gì" và bước tổng hợp giúp có cả độ chính xác lẫn số lệnh nhầm.' },
        { type: 'multi', id: 'u08.l2.q2', prompt: 'Mỗi lần thử cần ghi **những** gì?',
          options: ['Cử chỉ dự định làm', 'Lệnh máy nhận được (kể cả "không nhận")', 'Thời điểm', 'Ghi chú: tư thế, điều bất thường', 'Chỉ ghi những lần thành công cho gọn'],
          answers: [0, 1, 2, 3],
          explanation: 'Bỏ các lần thất bại sẽ làm kết quả đẹp giả tạo. Ghi đủ mới tính được độ chính xác và biết cặp nào hay nhầm.' },
        { type: 'hotspot', id: 'u08.l2.q3', prompt: 'Trong phiếu ghi, chạm vào cột cho biết máy **thực sự** nhận được gì.',
          target: { kind: 'diagram', svg: recordSheetSvg() }, answer: 'col-detected',
          explanation: 'So cột "Dự định" với cột "Máy nhận" là ra đúng hay sai. Hai cột này chính là hàng và cột của ma trận nhầm lẫn.' },
        { type: 'mcq', id: 'u08.l2.q4', prompt: 'Vì sao cần một phiên **sinh hoạt bình thường, không cố làm cử chỉ**?',
          options: ['Để đếm lệnh nhầm: máy phát lệnh khi người dùng không định nói gì', 'Để người thử nghỉ ngơi cho vui', 'Để sạc pin vòng tay', 'Không cần thiết'],
          answer: 0,
          explanation: 'Với người bệnh, một câu "Tôi cần giúp đỡ" phát nhầm cũng gây phiền. Chỉ đo độ nhận đúng là chưa đủ.' },
        { type: 'truefalse', id: 'u08.l2.q5', prompt: 'Thử mỗi cử chỉ 3 lần trên một người là đủ để kết luận độ chính xác.',
          answer: false,
          explanation: '[[cỡ mẫu]] quá nhỏ: chỉ một lần may rủi đã làm kết quả lệch 33%. Cần nhiều lần và nhiều người hơn.' },
        { type: 'mcq', id: 'u08.l2.q6', prompt: 'Vì sao nên làm cử chỉ theo **thứ tự ngẫu nhiên** thay vì 20 lần WATER liền rồi mới đến FOOD?',
          options: ['Tránh người thử quen tay hay mỏi tay làm lệch kết quả của một cử chỉ', 'Để máy đoán khó hơn', 'Vì BLE yêu cầu', 'Để thí nghiệm nhanh hơn'],
          answer: 0,
          explanation: 'Làm liền 20 lần thì những lần cuối mỏi tay hơn, hoặc quá quen tay. Xáo trộn giúp các cử chỉ được thử trong điều kiện công bằng.' },
        { type: 'number', id: 'u08.l2.q8', prompt: 'Trong phiên 10 phút sinh hoạt bình thường, máy phát 3 lệnh nhầm. Trung bình bao nhiêu lệnh nhầm mỗi phút?',
          answer: 0.3, tolerance: 0.001, unit: 'lệnh/phút',
          explanation: '3 / 10 = 0,3 lệnh nhầm mỗi phút. Khi báo cáo, ghi kèm điều kiện: ngồi, đi lại hay đang ăn.' },
        { type: 'flashcard', id: 'u08.l2.q9', prompt: 'Giám khảo hỏi: "Em đo độ chính xác như thế nào?"',
          modelAnswer: 'Trình bày **quy trình**: xin sự đồng ý; đeo và hiệu chuẩn; mỗi cử chỉ khoảng 20 lần theo thứ tự ngẫu nhiên, với nhiều người; ghi dự định, lệnh nhận, thời điểm, ghi chú; thêm phiên sinh hoạt bình thường để đếm lệnh nhầm; tổng hợp vào ma trận nhầm lẫn. Sau đó nêu **số liệu thật** của nhóm kèm điều kiện đo. Nếu chưa đo đủ thì nói rõ đang ở bước nào.',
          keyPoints: ['Đồng ý, hiệu chuẩn', 'Nhiều lần, nhiều người, thứ tự ngẫu nhiên', 'Ghi cả lần sai', 'Phiên đếm lệnh nhầm', 'Số thật kèm điều kiện'],
          explanation: 'Giám khảo đánh giá cao phương pháp rõ ràng, kể cả khi con số chưa đẹp.' },
      ],
    },

    // ───────────────────────── L3 ─────────────────────────
    {
      id: 'l3',
      title: 'Ma trận nhầm lẫn và độ chính xác',
      minutes: 12,
      goal: 'Sau bài này, em đọc được ma trận nhầm lẫn, tính độ chính xác và chỉ ra cặp cử chỉ hay bị nhầm.',
      steps: [
        { type: 'sim', sim: 'confusion-matrix', props: { data: DEMO, trialsPerGesture: 20, gestures: GESTURES, includeNone: true, label: 'Số liệu minh hoạ, không phải kết quả thật' },
          caption: 'Bấm ▶ để xem từng lần thử "rơi" vào ô. Chạm vào một ô để đọc giải thích. Đây là số liệu minh hoạ.' },
        { type: 'text', title: 'Đọc ma trận thế nào?',
          body: '**Hàng** là cử chỉ người thử định làm, **cột** là lệnh máy nhận được, thêm cột "Không nhận". Ô trên **đường chéo** là nhận đúng; ô ngoài đường chéo cho biết nhầm thành gì hay bị [[bỏ sót]].\n\n> [[độ chính xác]] = số lần đúng ÷ tổng số lần.' },
        { type: 'diagram', title: 'Ma trận minh hoạ (mỗi hàng 20 lần)', svg: matrixSvg(),
          caption: 'Cùng số liệu với mô phỏng phía trên, vẽ tĩnh để em đọc số. Nhớ: đây là số minh hoạ.',
          alt: 'Ma trận nhầm lẫn minh hoạ 5 hàng 6 cột. WATER 18 đúng, 2 không nhận. FOOD 19 đúng, 1 không nhận. NO 17 đúng, 1 thành YES, 2 không nhận. YES 15 đúng, 5 không nhận. HELP 16 đúng, 3 thành FOOD, 1 không nhận.' },
        { type: 'number', id: 'u08.l3.q1', prompt: 'Theo ma trận minh hoạ, độ chính xác của **WATER** là bao nhiêu phần trăm?',
          visual: { kind: 'diagram', svg: matrixSvg(), alt: 'Ma trận nhầm lẫn minh hoạ, hàng WATER: 18 đúng, 2 không nhận.' },
          answer: 90, tolerance: 0, unit: '%',
          explanation: 'Hàng WATER có 18 lần đúng trên 20 lần: 18 ÷ 20 = 0,9 = 90%.' },
        { type: 'hotspot', id: 'u08.l3.q2', prompt: 'Chạm vào ô cho thấy **cặp hay bị nhầm nhất** (nhầm thành một lệnh khác, không tính "Không nhận").',
          target: { kind: 'diagram', svg: matrixSvg() }, answer: 'cell-HELP-FOOD',
          hint: 'Tìm ô nền đỏ có số lớn nhất, bỏ qua cột "Không nhận".',
          explanation: 'Làm HELP nhưng máy nhận FOOD: 3 lần. Đây là gợi ý để xem lại cách hai cử chỉ này được phân biệt.' },
        { type: 'number', id: 'u08.l3.q3', prompt: 'Độ chính xác **chung** của cả 100 lần thử là bao nhiêu phần trăm?',
          answer: 85, tolerance: 0, unit: '%',
          hint: 'Cộng các ô trên đường chéo: 18 + 19 + 17 + 15 + 16.',
          explanation: '18 + 19 + 17 + 15 + 16 = 85 lần đúng trên 100 lần, tức 85%.' },
        { type: 'number', id: 'u08.l3.q4', prompt: 'Cử chỉ **YES** bị bỏ sót (không nhận) bao nhiêu phần trăm số lần?',
          answer: 25, tolerance: 0, unit: '%',
          explanation: '5 lần "Không nhận" trên 20: 5 ÷ 20 = 25%. Với gõ 2 lần, README gợi ý giảm ngưỡng gõ nếu hay bỏ sót, nhưng phải đo lại sau khi chỉnh.' },
        { type: 'truefalse', id: 'u08.l3.q5', prompt: 'Ô nằm **ngoài** đường chéo là những lần máy nhận đúng.',
          answer: false,
          explanation: 'Chỉ đường chéo (hàng và cột cùng tên) là nhận đúng. Ô ngoài chéo là nhầm sang lệnh khác hoặc không nhận.' },
        { type: 'mcq', id: 'u08.l3.q6', prompt: 'Muốn giảm việc HELP bị nhận thành FOOD, hướng nào **hợp lý** nhất?',
          options: ['Xem lại ngưỡng phân biệt hai trục (ví dụ AXIS_MARGIN_DEG) và cách đeo, rồi đo lại', 'Xoá cử chỉ FOOD', 'Ghi vào báo cáo là HELP chính xác 100%', 'Đổi UUID BLE'],
          answer: 0,
          explanation: 'Ma trận chỉ ra chỗ cần sửa; sửa xong phải **thử lại** để xem có thật sự tốt hơn, và không làm cử chỉ khác tệ đi.' },
        { type: 'sim-predict', id: 'u08.l3.q7', prompt: 'Mô phỏng sắp tổng kết. Độ chính xác chung hiện lên sẽ là bao nhiêu?',
          sim: 'confusion-matrix', props: { data: DEMO, trialsPerGesture: 20, gestures: GESTURES, includeNone: true, label: 'Số liệu minh hoạ, không phải kết quả thật' },
          pauseAt: 'row-5', revealTo: 'totals',
          options: ['85%', '90%', '100%', '75%'],
          answer: 0,
          explanation: 'Tổng đường chéo là 85 trên 100 lần thử. Mô phỏng tính giống hệt cách em vừa tính tay.' },
        { type: 'flashcard', id: 'u08.l3.q8', prompt: 'Giám khảo hỏi: "Độ chính xác của sản phẩm là bao nhiêu?"',
          modelAnswer: 'Chỉ trả lời bằng **số liệu thật** của nhóm, kèm điều kiện: bao nhiêu người, mỗi cử chỉ bao nhiêu lần, tư thế nào. Đưa ma trận nhầm lẫn để chỉ ra cử chỉ nào tốt, cặp nào hay nhầm, và số lệnh nhầm khi sinh hoạt bình thường. Nếu chưa đo đủ: "Thuật toán đã qua kiểm thử tổng hợp; độ chính xác trên người đang được đo theo quy trình…". **Không** dùng số minh hoạ của trang này.',
          keyPoints: ['Chỉ số liệu thật', 'Kèm điều kiện đo', 'Dùng ma trận nhầm lẫn', 'Chưa đo thì nói rõ'],
          explanation: 'Số 85% trong bài là minh hoạ để luyện đọc ma trận, không phải kết quả của BandW.' },
      ],
    },

    // ───────────────────────── L4 ─────────────────────────
    {
      id: 'l4',
      title: 'Trình bày kết quả trung thực',
      minutes: 9,
      goal: 'Sau bài này, em phân biệt được "đã kiểm thử phần mềm" với "đã đo trên người" và nói kết quả không phóng đại.',
      steps: [
        { type: 'sim', sim: 'confusion-matrix', props: { data: 'demo' },
          caption: 'Để ý nhãn "Số liệu minh hoạ, không phải kết quả thật" luôn hiện trên ma trận demo. Báo cáo của nhóm cũng cần ghi rõ nguồn gốc mọi con số.' },
        { type: 'diagram', title: 'Thang bằng chứng', svg: ladderSvg(),
          caption: 'Mỗi bậc là một loại bằng chứng khác nhau. Chỉ nói "đã làm được" ở những bậc có bằng chứng thật.',
          alt: 'Thang 5 bậc từ dưới lên: biên dịch được (41% flash, 30% RAM); qua kiểm thử tổng hợp; nạp lên board thử đủ 5 cử chỉ qua BLE; đo trên người khỏe; thử với người dùng mục tiêu có giám sát.' },
        { type: 'text', title: 'Repo đang nói gì?',
          body: 'README firmware ghi đã biên dịch (41% flash, 30% RAM) và đã qua kiểm thử tổng hợp. Nó cũng ghi rõ **chưa xác định** tỉ lệ nhận đúng trên người đeo thật, và các ngưỡng là giá trị khởi đầu.\n\n> Nhóm đo thêm được gì thì cập nhật bằng số thật của mình.' },
        { type: 'hotspot', id: 'u08.l4.q1', prompt: 'Theo README trong repo, bậc **cao nhất** đã có bằng chứng cho thuật toán nhận dạng cử chỉ là bậc nào? Chạm vào bậc đó.',
          target: { kind: 'diagram', svg: ladderSvg() }, answer: 'synthetic',
          hint: 'README viết "Chưa xác định tỉ lệ nhận đúng trên người đeo thực tế".',
          explanation: 'Repo có bằng chứng tới bậc 2: kiểm thử tổng hợp. Nếu nhóm đã tự thử trên board và trên người, hãy mang theo phiếu ghi để chứng minh bậc cao hơn.' },
        { type: 'multi', id: 'u08.l4.q2', prompt: 'Chọn **tất cả** các câu báo cáo **trung thực**.',
          options: ['"Thuật toán đã qua các ca kiểm thử tổng hợp trên máy tính."', '"BandW chính xác tuyệt đối."', '"Trong buổi thử với 3 bạn trong lớp, mỗi cử chỉ 20 lần, WATER đúng 18/20." (nếu nhóm thật sự đo như vậy)', '"BandW đã được bệnh viện chứng nhận."', '"Thời lượng pin chưa được đo."'],
          answers: [0, 2, 4],
          explanation: '"Tuyệt đối" là phóng đại, còn "bệnh viện chứng nhận" là sai sự thật. Câu trung thực nêu rõ đã làm gì, trên ai, bao nhiêu lần.' },
        { type: 'mcq', id: 'u08.l4.q3', prompt: 'Câu nào mô tả **đúng nhất** hiện trạng theo repo?',
          options: ['"Thuật toán đã qua kiểm thử tổng hợp; độ chính xác trên người dùng thật cần được đo."', '"BandW đã được kiểm chứng trên bệnh nhân."', '"BandW dùng AI nên chính xác cao."', '"Chưa có kiểm thử nào."'],
          answer: 0,
          explanation: 'Câu này nói đúng cả cái đã có (kiểm thử tổng hợp) lẫn cái chưa có (đo trên người thật). BandW cũng không dùng AI.' },
        { type: 'truefalse', id: 'u08.l4.q4', prompt: 'Có thể đưa số liệu trong ma trận minh hoạ của trang này vào báo cáo dự án.',
          answer: false,
          explanation: 'Số minh hoạ chỉ để luyện đọc ma trận. Đưa vào báo cáo là bịa số liệu, vi phạm đạo đức nghiên cứu.' },
        { type: 'mcq', id: 'u08.l4.q5', prompt: 'Cách nào đo [[thời gian phản hồi]] từ cử chỉ đến tiếng nói mà không cần thiết bị đắt tiền?',
          options: ['Quay video có cả tay và tiếng, đếm số khung hình từ lúc bắt đầu cử chỉ đến lúc nghe tiếng', 'Đoán theo cảm giác', 'Lấy số trên mạng về BLE', 'Đọc log "TX WATER" là đủ'],
          answer: 0,
          explanation: 'Video 30 khung/giây cho độ phân giải khoảng 33 ms mỗi khung. Đo nhiều lần rồi lấy trung bình.' },
        { type: 'number', id: 'u08.l4.q6', prompt: 'Video quay 30 khung/giây. Từ lúc tay bắt đầu nghiêng đến lúc nghe tiếng là 24 khung. Thời gian phản hồi là bao nhiêu ms?',
          answer: 800, tolerance: 0, unit: 'ms',
          hint: 'Mỗi khung dài 1000 / 30 ms.',
          explanation: '24 ÷ 30 = 0,8 giây = 800 ms. Đây là bài tính ví dụ, không phải số đo của BandW.' },
        { type: 'flashcard', id: 'u08.l4.q7', prompt: 'Giám khảo hỏi: "Kết quả này em đo trên ai, trong điều kiện nào?"',
          modelAnswer: 'Trả lời đúng những gì nhóm đã làm: số người thử, họ là người khỏe mô phỏng hay người dùng mục tiêu, tư thế (ngồi, nằm), số lần mỗi cử chỉ, cách hiệu chuẩn, điện thoại dùng. Phân biệt rõ "kiểm thử phần mềm bằng dữ liệu tổng hợp" với "thử nghiệm trên người". Nếu chưa thử với người dùng mục tiêu thì nói thẳng và nêu kế hoạch.',
          keyPoints: ['Số người, ai thử', 'Điều kiện: tư thế, số lần, thiết bị', 'Phân biệt kiểm thử và thử nghiệm', 'Chưa làm thì nói kế hoạch'],
          explanation: 'Trung thực về giới hạn là điểm cộng, không phải điểm trừ.' },
      ],
    },

    // ───────────────────────── L5 ─────────────────────────
    {
      id: 'l5',
      title: 'Hạn chế và hướng phát triển',
      minutes: 9,
      goal: 'Sau bài này, em nêu được các hạn chế thật của BandW và đề xuất hướng cải tiến có thứ tự ưu tiên.',
      steps: [
        { type: 'sim', sim: 'imu-axes-3d', props: { mode: 'accel', preset: 'vertical', interactive: true, showBars: true },
          caption: 'Khi cẳng tay gần thẳng đứng, √(x²+z²) < 0,4 g nên firmware khoá nghiêng trái/phải. Đây là một giới hạn của cách đo bằng trọng lực.' },
        { type: 'text', title: 'Những hạn chế đã biết',
          body: '- Chỉ có 5 câu cố định\n- Người dùng phải cử động được cổ tay\n- Hướng đeo cố định: xoay vòng tay 90° phải đổi trục trong code\n- Run tay mạnh, xe rung có thể gây nhầm, cần đo thêm\n- Cần điện thoại Android có giọng tiếng Việt\n- Chưa ghép đôi BLE, chưa đo pin, chưa thử với người dùng mục tiêu' },
        { type: 'sim', sim: 'gesture-gallery', props: { showCommands: true, showPhrases: true },
          caption: 'Năm cử chỉ, năm câu: đủ cho nhu cầu cơ bản và dễ nhớ, nhưng chưa nói được điều khác. Thêm câu là một hướng phát triển.' },
        { type: 'text', title: 'Hướng phát triển',
          body: '- Đo trên người thật, rồi chỉnh ngưỡng riêng cho từng người ngay từ app\n- Gửi thông báo cho người chăm sóc khi có HELP\n- Đo pin, thêm chế độ ngủ tiết kiệm điện\n- Vỏ đeo êm, ghép đôi BLE, app iOS, thêm câu theo menu' },
        { type: 'multi', id: 'u08.l5.q1', prompt: 'Chọn **tất cả** các hạn chế **thật** của BandW hiện nay.',
          options: ['Chỉ có 5 câu cố định', 'Bắt buộc phải có Internet', 'Hướng đeo cố định, xoay 90° phải đổi trục trong code', 'Chưa đo thời lượng pin', 'Chỉ chạy trên iPhone'],
          answers: [0, 2, 3],
          explanation: 'BandW không cần Internet (BLE nối thẳng) và app là Android, không phải iPhone. Ba hạn chế còn lại được ghi trong README hoặc chưa có số đo.' },
        { type: 'mcq', id: 'u08.l5.q2', prompt: 'Nhìn các trục X, Y, Z trên cẳng tay. Người dùng đeo vòng tay **xoay 90°** so với hướng thiết kế. Chuyện gì xảy ra?',
          visual: { kind: 'diagram', name: 'imu-axes', alt: 'Bo mạch trên cẳng tay với ba mũi tên trục X, Y, Z.' },
          options: ['Trục đo bị lệch, nghiêng trái/phải có thể không đúng; phải đổi trục trong code', 'Hiệu chuẩn tự sửa hết', 'Vòng tay tự xoay trục', 'Không ảnh hưởng gì'],
          answer: 0,
          explanation: 'README ghi: hiệu chuẩn chỉ đặt góc trung tính, **không tự suy ra hướng đeo**. Đeo ngược trái/phải thì đổi `TILT_SIGN`; xoay 90° phải đổi trục đọc.' },
        { type: 'truefalse', id: 'u08.l5.q3', prompt: 'Bước hiệu chuẩn 2 giây tự nhận ra vòng tay đang đeo theo hướng nào.',
          answer: false,
          explanation: 'Hiệu chuẩn chỉ ghi lại tư thế trung tính (mốc góc). Hướng gắn board vẫn quyết định trục nào là trái/phải.' },
        { type: 'order', id: 'u08.l5.q4', prompt: 'Sắp xếp các việc cải tiến theo thứ tự ưu tiên hợp lý.',
          items: ['Đo độ chính xác trên người thật', 'Chỉnh ngưỡng theo kết quả đo', 'Đo pin và tối ưu tiết kiệm điện', 'Thêm tính năng mới (thêm câu, iOS)'],
          hint: 'Chưa biết nó tốt đến đâu thì sửa theo hướng nào?',
          explanation: 'Phải đo trước mới biết chỉnh gì. Tính năng mới nên làm sau khi phần cốt lõi đã được đánh giá.' },
        { type: 'mcq', id: 'u08.l5.q5', prompt: 'Cải tiến nào **trực tiếp** tăng an toàn khi người dùng ra hiệu HELP?',
          options: ['Gửi thông báo tới điện thoại người chăm sóc', 'Đổi màu thẻ HELP', 'Tăng tốc độ đọc lên 2', 'Bỏ cử chỉ YES'],
          answer: 0,
          explanation: 'Hiện câu "Tôi cần giúp đỡ." chỉ phát ở loa gần người dùng. Nếu người chăm sóc ở phòng khác, một thông báo từ xa giúp họ biết ngay.' },
        { type: 'truefalse', id: 'u08.l5.q6', prompt: 'BandW là thiết bị y tế đã được chứng nhận, có thể thay chuông gọi y tá.',
          answer: false,
          explanation: 'BandW là sản phẩm nghiên cứu học sinh, công cụ hỗ trợ giao tiếp. Dùng trong bệnh viện cần thử nghiệm có giám sát và chứng nhận.' },
        { type: 'flashcard', id: 'u08.l5.q7', prompt: 'Giám khảo hỏi: "Điểm yếu lớn nhất của dự án là gì?"',
          modelAnswer: 'Nói thẳng: **chưa đánh giá trên người dùng mục tiêu**, nên chưa biết độ chính xác thật; ngoài ra hướng đeo cố định và chỉ có 5 câu. Kèm kế hoạch: thử nghiệm có giám sát và có sự đồng ý, dùng ma trận nhầm lẫn để chỉnh ngưỡng theo từng người, rồi mới mở rộng tính năng.',
          keyPoints: ['Chưa thử với người dùng mục tiêu', 'Hướng đeo cố định, 5 câu', 'Kế hoạch đo có giám sát', 'Chỉnh ngưỡng theo dữ liệu'],
          explanation: 'Câu trả lời tốt luôn đi kèm "nhóm sẽ làm gì tiếp".' },
      ],
    },

    // ───────────────────────── L6 ─────────────────────────
    {
      id: 'l6',
      title: 'Luyện phản biện: dựa trên luật hay học máy?',
      minutes: 10,
      goal: 'Sau bài này, em so sánh công bằng cách làm dựa trên luật với học máy và tránh được các "bẫy" khi trả lời.',
      steps: [
        { type: 'sim', sim: 'system-flow', props: { gesture: 'cycle', showLatency: false },
          caption: 'Toàn bộ quyết định nằm ở chip nRF52840: vài phép so sánh ngưỡng và đếm thời gian, chạy 50 lần mỗi giây. Không có mô hình học máy nào.' },
        { type: 'diagram', title: 'Hộp trong suốt và hộp đen', svg: ruleVsMlSvg(),
          caption: 'Luật cho thấy rõ vì sao ra WATER. Học máy có thể linh hoạt hơn, nhưng cần nhiều dữ liệu có nhãn và khó giải thích từng quyết định.',
          alt: 'Hai hộp: bên trái hộp trong suốt "Dựa trên luật" với các dòng nghiêng hơn 22 độ, giữ 250 ms, đã về trung tính, ra WATER hoặc FOOD; bên phải hộp đen "Học máy": dữ liệu có nhãn đi vào, mô hình đoán cử chỉ, khó giải thích.' },
        { type: 'text', title: 'So sánh công bằng',
          body: 'Cách làm dựa trên luật (rule-based) dễ giải thích, không cần dữ liệu huấn luyện, chạy nhẹ trên chip và dễ kiểm thử. Học máy (machine learning) linh hoạt hơn, có thể nhận nhiều cử chỉ và thích nghi theo người, nhưng cần nhiều dữ liệu có nhãn. Không bên nào "luôn tốt hơn": chọn theo bài toán.' },
        { type: 'hotspot', id: 'u08.l6.q1', prompt: 'Chạm vào cách làm mà em có thể chỉ ra **từng bước** vì sao máy quyết định như vậy.',
          target: { kind: 'diagram', svg: ruleVsMlSvg() }, answer: 'rules',
          explanation: 'Với luật, em chỉ vào từng điều kiện: vượt 22°, giữ 250 ms, đã về trung tính. Đây là lợi thế lớn khi bị hỏi "vì sao nó phát lệnh này?".' },
        { type: 'multi', id: 'u08.l6.q2', prompt: 'Chọn **tất cả** các lý do hợp lý khiến BandW chọn cách làm dựa trên luật.',
          options: ['Chưa có nhiều dữ liệu cử chỉ có nhãn', 'Cần giải thích được từng quyết định', 'Chạy nhẹ trên vi điều khiển, phản hồi ngay', '5 cử chỉ khác biệt rõ nên luật là đủ', 'Vì học máy là bất hợp pháp'],
          answers: [0, 1, 2, 3],
          explanation: 'Bốn lý do đầu đều đúng với dự án. Học máy không hề bị cấm; chỉ là chưa phù hợp ở giai đoạn này.' },
        { type: 'truefalse', id: 'u08.l6.q3', prompt: 'Cách làm dựa trên luật lúc nào cũng kém hơn AI.',
          answer: false,
          explanation: 'Với ít cử chỉ khác biệt rõ và ít dữ liệu, luật đơn giản thường đủ tốt, dễ kiểm thử và dễ giải thích. Khi bài toán phức tạp hơn và có nhiều dữ liệu, học máy mới phát huy.' },
        { type: 'mcq', id: 'u08.l6.q4', prompt: 'Khi nào học máy trở nên **đáng thử** cho BandW?',
          options: ['Khi đã có nhiều dữ liệu có nhãn từ người dùng thật và muốn thêm nhiều cử chỉ phức tạp', 'Ngay bây giờ, vì AI là xu hướng', 'Không bao giờ', 'Khi muốn bỏ kiểm thử'],
          answer: 0,
          explanation: 'Dữ liệu từ thí nghiệm của nhóm hôm nay chính là nền móng nếu sau này muốn thử một mô hình nhỏ (TinyML) chạy trên chip.' },
        { type: 'mcq', id: 'u08.l6.q5', prompt: 'Giám khảo hỏi: "BandW dùng AI phải không?" Câu trả lời nào **tốt nhất**?',
          options: ['"Không ạ. BandW dùng luật: ngưỡng góc, thời gian giữ và máy trạng thái. Em có thể chỉ từng điều kiện trong code."', '"Dạ có, BandW dùng trí tuệ nhân tạo."', '"Em không rõ ạ."', '"Có một phần AI ạ."'],
          answer: 0,
          explanation: 'Trả lời đúng sự thật, ngắn gọn, kèm bằng chứng. Nói "có AI" để nghe hay hơn là sai và dễ bị hỏi vặn.' },
        { type: 'multi', id: 'u08.l6.q6', prompt: 'Chọn **tất cả** các câu là **bẫy cần tránh** khi phản biện.',
          options: ['"Sản phẩm chính xác 100%."', '"Đây là thiết bị y tế."', '"Pin dùng được một tuần." (khi chưa đo)', '"Phần này em chưa đo, đây là cách nhóm sẽ đo."', '"Đầu tiên trên thế giới."'],
          answers: [0, 1, 2, 4],
          explanation: 'Câu "chưa đo, đây là cách đo" là câu trung thực nên dùng. Các câu còn lại phóng đại hoặc không có bằng chứng.' },
        { type: 'flashcard', id: 'u08.l6.q7', prompt: 'Giám khảo hỏi: "Sao không dùng AI cho hiện đại?"',
          modelAnswer: 'Vì với 5 cử chỉ khác biệt rõ, **luật** là đủ và có nhiều ưu điểm: không cần tập dữ liệu lớn có nhãn, chạy nhẹ trên chip và phản hồi ngay, giải thích được từng quyết định, dễ kiểm thử bằng `gesture_test.cpp`. Hạn chế là khó mở rộng lên nhiều cử chỉ phức tạp. Khi có dữ liệu thật từ thí nghiệm, nhóm có thể thử mô hình nhỏ chạy trên chip.',
          keyPoints: ['Luật đủ cho 5 cử chỉ rõ', 'Không cần dữ liệu lớn', 'Giải thích và kiểm thử được', 'Thừa nhận giới hạn, nêu hướng'],
          explanation: 'Không chê AI; chỉ ra vì sao lựa chọn hợp với giai đoạn này.' },
        { type: 'flashcard', id: 'u08.l6.q8', prompt: 'Giám khảo hỏi: "Em có tự viết code không?"',
          modelAnswer: 'Trả lời **đúng vai trò thật** của nhóm: phần nào tự viết, phần nào có hướng dẫn, dùng thư viện (ArduinoBLE, LSM6DS3) hay công cụ hỗ trợ. Sau đó chứng minh hiểu bằng cách giải thích một đoạn bất kỳ, ví dụ `loop()` mỗi 20 ms hay `GestureCommand.parse()`. Không nói dối: giám khảo sẽ hỏi sâu.',
          keyPoints: ['Nói đúng vai trò thật', 'Kể thư viện, công cụ đã dùng', 'Giải thích được một đoạn code'],
          explanation: 'Hiểu và giải thích được code quan trọng hơn việc tự gõ từng dòng.' },
      ],
    },
  ],
  defense: [
    { type: 'flashcard', id: 'u08.d.q1', prompt: 'Giám khảo hỏi: "Em đã thử trên bao nhiêu người? Có người bệnh thật không?"',
      modelAnswer: 'Nêu đúng số người nhóm đã thử và họ là ai. Phân biệt rõ người khỏe **mô phỏng** cử chỉ với **người dùng mục tiêu** (người khó nói). Nếu chưa thử với người dùng mục tiêu, nói thẳng và nêu kế hoạch: có sự đồng ý, có người chăm sóc hoặc thầy cô giám sát, an toàn là trên hết.',
      keyPoints: ['Số người thật', 'Phân biệt người khỏe và người dùng mục tiêu', 'Kế hoạch có giám sát, có đồng ý'],
      explanation: 'Không "làm tròn" số người thử cho đẹp.' },
    { type: 'flashcard', id: 'u08.d.q2', prompt: 'Giám khảo hỏi: "Dùng ở bệnh viện có an toàn không?"',
      modelAnswer: 'BandW **chưa phải thiết bị y tế** và không thay thế chuông gọi y tá. Muốn dùng ở bệnh viện cần thử nghiệm có giám sát, xin phép và đánh giá thêm về an toàn và vệ sinh.',
      keyPoints: ['Chưa phải thiết bị y tế', 'Không thay chuông gọi y tá', 'Cần thử nghiệm có giám sát, xin phép'],
      explanation: 'Thận trọng là đúng mực khi nói về sức khoẻ người bệnh.' },
    { type: 'flashcard', id: 'u08.d.q3', prompt: 'Giám khảo hỏi: "Nếu được làm lại, em sẽ đổi gì?"',
      modelAnswer: 'Thử nghiệm với người dùng sớm hơn để chỉnh ngưỡng theo dữ liệu thật; đo pin ngay từ đầu; thiết kế vỏ đeo thoải mái; ghi chép thí nghiệm có hệ thống bằng phiếu và ma trận nhầm lẫn.',
      keyPoints: ['Thử với người dùng sớm', 'Đo pin sớm', 'Vỏ đeo', 'Ghi chép có hệ thống'],
      explanation: 'Cho thấy nhóm biết rút kinh nghiệm.' },
    { type: 'flashcard', id: 'u08.d.q4', prompt: 'Giám khảo hỏi: "Dự án đóng góp gì cho cộng đồng?"',
      modelAnswer: 'Một cách giao tiếp đơn giản bằng tiếng Việt cho người khó nói, dùng một bo mạch nhỏ và chiếc điện thoại Android sẵn có, không cần Internet hay máy chủ. Code và hướng dẫn nạp firmware có trong repo nên người khác có thể làm lại và cải tiến. Nhóm không nói "đầu tiên" hay "tốt nhất" khi chưa có so sánh.',
      keyPoints: ['Tiếng Việt, cho người khó nói', 'Thiết bị đơn giản, điện thoại sẵn có', 'Người khác làm lại được', 'Không phóng đại'],
      explanation: 'Nếu nêu chi phí, chỉ dùng số trên hoá đơn thật của nhóm.' },
  ],
};
