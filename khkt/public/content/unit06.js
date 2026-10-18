// public/content/unit06.js: Chương 6, Bluetooth Low Energy (Writer D)
// Số liệu lấy từ firmware/BandW_Sense/BandW_Sense.ino và app/src/main/java/com/bandw/demo/BandBleClient.java.

// Bảng so sánh định tính BLE / Bluetooth cổ điển / Wi-Fi (không có số đo, chỉ là đặc điểm chung).
function compareSvg() {
  const rows = [
    ['Tốn ít điện', '✓ Rất ít', 'Nhiều hơn', 'Nhiều'],
    ['Có sẵn trên điện thoại', '✓', '✓', '✓'],
    ['Không cần bộ phát Wi-Fi', '✓', '✓', '✗ Cần'],
    ['Hợp gửi vài byte', '✓', 'Thừa', 'Thừa'],
    ['Truyền âm thanh, video', '✗', '✓', '✓'],
  ];
  const head = ['', 'BLE', 'Bluetooth cổ điển', 'Wi-Fi'];
  const colX = [10, 250, 360, 510];
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" font-family="inherit" role="img">';
  s += '<rect x="240" y="8" width="110" height="284" rx="10" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:2"/>';
  head.forEach((h, i) => {
    if (h) s += `<text x="${colX[i] + (i ? 45 : 0)}" y="38" font-size="15" font-weight="700" text-anchor="${i ? 'middle' : 'start'}" style="fill:var(--c-text)">${h}</text>`;
  });
  rows.forEach((r, j) => {
    const y = 88 + j * 46;
    s += `<line x1="10" y1="${y - 28}" x2="590" y2="${y - 28}" style="stroke:var(--c-border)"/>`;
    r.forEach((c, i) => {
      s += `<text x="${colX[i] + (i ? 45 : 0)}" y="${y}" font-size="15" text-anchor="${i ? 'middle' : 'start'}" style="fill:${i === 1 ? 'var(--c-primary)' : 'var(--c-text)'}"${i === 1 ? ' font-weight="700"' : ''}>${c}</text>`;
    });
  });
  return s + '</svg>';
}

// Bài 6: dòng thời gian của lỗi "tự ngắt sau khoảng 3 câu" ở app cũ (0.3.0/0.4.0). Mỗi khối là một hotspot.
function bugTimelineSvg() {
  const ev = [
    { id: 'connect', x: 10, t: '0 s', title: 'Kết nối', sub: 'app nhận lệnh', fill: 'var(--c-primary-soft)', stroke: 'var(--c-primary)' },
    { id: 'phrases', x: 160, t: '≈ 0–30 s', title: '3 câu', sub: 'đọc bình thường', fill: 'var(--c-primary-soft)', stroke: 'var(--c-primary)' },
    { id: 'screen-off', x: 310, t: '≈ 30 s', title: 'Màn hình tắt', sub: 'tự tắt khi không chạm', fill: 'var(--c-surface)', stroke: 'var(--c-border)' },
    { id: 'onstop', x: 460, t: 'ngay sau đó', title: 'onStop()', sub: 'ble.disconnect(…)', fill: 'var(--c-danger-bg)', stroke: 'var(--c-danger)' },
  ];
  let s = '<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">';
  s += '<line x1="20" y1="150" x2="590" y2="150" style="stroke:var(--c-muted);stroke-width:2"/>';
  ev.forEach((e) => {
    s += `<g data-hotspot="${e.id}" data-label="${e.title}"><rect x="${e.x}" y="40" width="130" height="80" rx="12" style="fill:${e.fill};stroke:${e.stroke};stroke-width:2"/>`;
    s += `<text x="${e.x + 65}" y="74" font-size="16" font-weight="700" text-anchor="middle" style="fill:var(--c-text)">${e.title}</text>`;
    s += `<text x="${e.x + 65}" y="98" font-size="13" text-anchor="middle" style="fill:var(--c-muted)">${e.sub}</text>`;
    s += `<circle cx="${e.x + 65}" cy="150" r="6" style="fill:${e.stroke}"/><text x="${e.x + 65}" y="176" font-size="13" text-anchor="middle" style="fill:var(--c-text)">${e.t}</text></g>`;
  });
  s += '<text x="525" y="30" font-size="15" font-weight="700" text-anchor="middle" style="fill:var(--c-danger)">✗ Mất kết nối</text>';
  s += '<text x="300" y="208" font-size="13" text-anchor="middle" style="fill:var(--c-muted)">App cũ: tắt màn hình = Android gọi onStop() = đóng Bluetooth</text>';
  return s + '</svg>';
}

// Bài 6: bốn nguy cơ phía vòng tay và cách firmware đã sửa (theo firmware/README.md, mục "Chống mất kết nối").
function firmwareFixesSvg() {
  const rows = [
    ['Log Serial chờ máy tính đọc', 'BLE.poll() bị treo', 'Log không bao giờ chờ'],
    ['Bộ đếm gói _pendingPkt kẹt', 'gửi lệnh kẹt sau vài lần ngắt', 'Đặt lại khi mất kết nối'],
    ['Ngắt rồi im lặng', 'app không tìm thấy', 'Quảng bá lại (ADVERTISING)'],
    ['Treo vì lỗi bất kỳ', 'vòng tay "chết"', 'Watchdog 4 s tự khởi động lại'],
  ];
  let s = '<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">';
  s += '<text x="150" y="24" font-size="15" font-weight="700" text-anchor="middle" style="fill:var(--c-danger)">Nguy cơ</text>';
  s += '<text x="450" y="24" font-size="15" font-weight="700" text-anchor="middle" style="fill:var(--c-success)">Đã sửa</text>';
  rows.forEach(([risk, effect, fix], i) => {
    const y = 38 + i * 64;
    s += `<rect x="8" y="${y}" width="284" height="54" rx="10" style="fill:var(--c-danger-bg);stroke:var(--c-danger)"/>`;
    s += `<text x="150" y="${y + 23}" font-size="14" font-weight="700" text-anchor="middle" style="fill:var(--c-text)">${risk}</text>`;
    s += `<text x="150" y="${y + 43}" font-size="13" text-anchor="middle" style="fill:var(--c-muted)">→ ${effect}</text>`;
    s += `<line x1="296" y1="${y + 27}" x2="304" y2="${y + 27}" style="stroke:var(--c-muted);stroke-width:2"/>`;
    s += `<rect x="308" y="${y}" width="284" height="54" rx="10" style="fill:var(--c-surface);stroke:var(--c-success);stroke-width:2"/>`;
    s += `<text x="450" y="${y + 33}" font-size="14" font-weight="700" text-anchor="middle" style="fill:var(--c-text)">✓ ${fix}</text>`;
  });
  return s + '</svg>';
}

export default {
  id: 'u06',
  title: 'Bluetooth Low Energy: gửi một từ qua không khí',
  description: 'Quảng bá, kết nối, đăng ký và thông báo: cách vòng tay gửi "WATER" sang điện thoại chỉ bằng vài byte.',
  color: 'blue',
  icon: '📡',
  glossary: [
    { term: 'BLE', en: 'Bluetooth Low Energy', def: 'Bluetooth năng lượng thấp: kiểu Bluetooth tiết kiệm điện, dành cho thiết bị nhỏ chỉ cần gửi ít dữ liệu như vòng tay, đồng hồ.' },
    { term: 'quảng bá', en: 'advertising', def: 'Thiết bị BLE liên tục phát những gói tin ngắn để báo "tôi ở đây, tên tôi là BandW-Sense" cho điện thoại xung quanh tìm thấy.' },
    { term: 'GATT', en: 'Generic Attribute Profile', def: 'Cách BLE sắp xếp dữ liệu, giống một tủ hồ sơ: dịch vụ là ngăn tủ, đặc tính là tờ giấy chứa giá trị.' },
    { term: 'dịch vụ', en: 'service', def: 'Một nhóm dữ liệu có chung mục đích trong GATT. BandW có một dịch vụ riêng với UUID c91b0001-…' },
    { term: 'đặc tính', en: 'characteristic', def: 'Một ô chứa giá trị trong dịch vụ BLE, có quyền đọc/ghi/thông báo. BandW có đặc tính lệnh c91b0002 và đặc tính điều khiển c91b0003.' },
    { term: 'UUID', en: 'Universally Unique Identifier', def: 'Mã định danh dài 128 bit, gần như không thể trùng, dùng để gọi đúng tên một dịch vụ hay đặc tính.' },
    { term: 'CCCD', en: 'Client Characteristic Configuration Descriptor', def: 'Thẻ cấu hình có mã 0x2902 gắn vào đặc tính. Điện thoại ghi vào đây để bật "báo cho tôi khi có giá trị mới".' },
    { term: 'đăng ký', en: 'subscribe', def: 'Việc điện thoại bật thông báo cho một đặc tính bằng cách ghi vào CCCD. Firmware BandW chỉ gửi lệnh khi app đã đăng ký.' },
    { term: 'thông báo', en: 'notify', def: 'Thiết bị BLE chủ động đẩy giá trị mới sang điện thoại, điện thoại không cần hỏi đi hỏi lại.' },
    { term: 'ASCII', en: 'American Standard Code for Information Interchange', def: 'Bảng mã quy định mỗi chữ cái Latinh là một số 1 byte. Ví dụ W = 0x57, A = 0x41.' },
    { term: 'byte', en: 'byte', def: 'Đơn vị dữ liệu gồm 8 bit, đủ để chứa một chữ cái ASCII. Chữ "WATER" dài 5 byte.' },
    { term: 'ghép đôi', en: 'pairing / bonding', def: 'Bước hai thiết bị trao đổi khoá để mã hoá và nhận ra nhau. Bản MVP của BandW chưa dùng ghép đôi.' },
    { term: 'nguyên nhân gốc', en: 'root cause', def: 'Lý do sâu nhất làm lỗi xảy ra. Sửa nguyên nhân gốc thì lỗi hết hẳn; chỉ sửa triệu chứng thì lỗi sẽ quay lại.' },
    { term: 'chờ tăng dần', en: 'backoff', def: 'Cách thử lại sau lỗi: mỗi lần thất bại thì chờ lâu hơn lần trước. App BandW chờ 1, 2, 4, 8, 15, 15 giây, sau đó 30 giây mỗi lần.' },
  ],
  lessons: [
    // ───────────────────────── L1 ─────────────────────────
    {
      id: 'l1',
      title: 'BLE là gì? Bức thư chỉ có một từ',
      minutes: 8,
      goal: 'Sau bài này, em kể được 5 giai đoạn BLE và biết vòng tay chỉ gửi một từ như "WATER".',
      steps: [
        { type: 'video', id: 'v-ble', title: 'Bluetooth Low Energy gửi "WATER"',
          caption: 'Xem vòng tay quảng bá, điện thoại kết nối, đăng ký rồi nhận gói "WATER" chỉ dài 5 byte.',
          fallbackSim: { sim: 'ble-flow', props: { phase: 'all', command: 'WATER', showBytes: true } } },
        { type: 'text', title: 'Gửi tin nhắn ngắn, không gọi video',
          body: '[[BLE]] là kiểu Bluetooth tiết kiệm điện, hợp với thiết bị nhỏ chỉ gửi ít dữ liệu. BandW **không** gửi số đo cảm biến, mà chỉ gửi **một từ** như `WATER` mỗi khi nhận ra cử chỉ.\n\n> Giống nhắn một tin "Khát" thay vì gọi video cả ngày cho người nhà.' },
        { type: 'sim', sim: 'ble-flow', props: { phase: 'all', command: 'WATER', showBytes: true, showUuids: false },
          caption: 'Bấm ▶ để xem đủ các giai đoạn: [[quảng bá]], kết nối, khám phá dịch vụ, [[đăng ký]], [[thông báo]]. Bấm ⏭ để đi từng bước.' },
        { type: 'hotspot', id: 'u06.l1.q1', prompt: 'Trong sơ đồ toàn hệ thống, chạm vào chặng dùng **BLE**.',
          target: { kind: 'diagram', name: 'system-blocks' }, answer: 'ble',
          explanation: 'BLE là "sợi dây vô hình" giữa chip nRF52840 và điện thoại. Chip nRF52840 có sẵn sóng Bluetooth nên không cần gắn thêm mô-đun.' },
        { type: 'mcq', id: 'u06.l1.q2', prompt: 'Qua BLE, vòng tay gửi **gì** cho điện thoại?',
          options: ['Số đo gia tốc và con quay, 50 lần mỗi giây', 'Một từ ASCII như `WATER`', 'Câu "Tôi muốn uống nước." dưới dạng âm thanh', 'Một tệp ghi âm giọng người dùng'],
          answer: 1,
          explanation: 'Vòng tay tự nhận dạng cử chỉ rồi chỉ gửi kết quả là một từ ngắn. Câu tiếng Việt và giọng đọc nằm ở app, nên gói tin rất nhỏ.' },
        { type: 'truefalse', id: 'u06.l1.q3', prompt: 'Vòng tay cần Wi-Fi hoặc Internet để gửi lệnh tới điện thoại.',
          answer: false,
          explanation: 'BLE nối thẳng vòng tay với điện thoại ở gần, không cần bộ phát Wi-Fi hay Internet.' },
        { type: 'sim-predict', id: 'u06.l1.q4',
          prompt: 'Điện thoại vừa **đăng ký** nhận thông báo. Người dùng nghiêng tay trái, điều gì xảy ra tiếp theo?',
          sim: 'ble-flow', props: { phase: 'all', command: 'WATER', showBytes: true }, pauseAt: 'subscribe', revealTo: 'notify',
          options: ['Vòng tay tự đẩy gói "WATER" sang điện thoại', 'Điện thoại phải hỏi vòng tay mỗi giây xem có gì mới', 'Vòng tay gửi cả câu "Tôi muốn uống nước."', 'Không có gì, vì phải ghép đôi trước'],
          answer: 0,
          explanation: 'Đã đăng ký thì vòng tay dùng **notify**: có lệnh mới là chủ động đẩy sang ngay. Bản MVP không cần ghép đôi.' },
        { type: 'order', id: 'u06.l1.q5', prompt: 'Sắp xếp các giai đoạn BLE theo đúng thứ tự.',
          items: ['Quảng bá tên BandW-Sense', 'Kết nối', 'Khám phá dịch vụ', 'Đăng ký nhận thông báo', 'Thông báo "WATER"'],
          hint: 'Phải tìm thấy nhau trước, rồi mới "mở tủ" xem có gì, cuối cùng mới nhận tin.',
          explanation: 'Quảng bá để được tìm thấy, kết nối, xem vòng tay có dịch vụ gì, bật công tắc thông báo, rồi mới nhận lệnh.' },
        { type: 'flashcard', id: 'u06.l1.q6', prompt: 'Giám khảo hỏi: "Vòng tay và điện thoại nói chuyện với nhau bằng cách nào?"',
          modelAnswer: 'Bằng **Bluetooth Low Energy**. Vòng tay quảng bá tên `BandW-Sense`, app quét và kết nối, rồi đăng ký nhận thông báo. Mỗi khi nhận ra cử chỉ, vòng tay gửi **một từ ASCII** như `WATER` (5 byte). App tra từ đó ra câu tiếng Việt và đọc thành tiếng. Không cần Wi-Fi hay Internet.',
          keyPoints: ['BLE, tiết kiệm điện', 'Quảng bá → kết nối → đăng ký → notify', 'Chỉ gửi một từ, vài byte', 'Câu nói nằm trong app'],
          explanation: 'Nêu được thứ tự các bước và kích thước gói tin sẽ cho thấy em hiểu thật.' },
      ],
    },

    // ───────────────────────── L2 ─────────────────────────
    {
      id: 'l2',
      title: 'Tủ GATT: dịch vụ, đặc tính và UUID',
      minutes: 10,
      goal: 'Sau bài này, em chỉ được trên sơ đồ đâu là dịch vụ, đặc tính lệnh, đặc tính điều khiển và CCCD.',
      steps: [
        { type: 'diagram', name: 'gatt-tree', title: 'Bên trong vòng tay có gì?',
          caption: 'Thiết bị BandW-Sense → một dịch vụ c91b0001 → hai đặc tính: lệnh c91b0002 và điều khiển c91b0003 → CCCD 0x2902.',
          alt: 'Cây GATT: thiết bị BandW-Sense chứa dịch vụ c91b0001, bên trong có đặc tính c91b0002 (Notify) và c91b0003 (Write/Notify), mỗi đặc tính có CCCD 0x2902.' },
        { type: 'text', title: 'Tủ hồ sơ GATT',
          body: '[[GATT]] giống một tủ hồ sơ: [[dịch vụ]] là ngăn tủ "BandW", mỗi [[đặc tính]] là một tờ giấy ghi giá trị. [[CCCD]] là chiếc công tắc dán trên tờ giấy: bật lên nghĩa là "có gì mới thì báo tôi".' },
        { type: 'sim', sim: 'ble-flow', props: { phase: 'discover', showUuids: true, showBytes: false },
          caption: 'Điện thoại "mở tủ" để khám phá dịch vụ. Để ý các mã [[UUID]] hiện lên cạnh từng ngăn.' },
        { type: 'code', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: 'BLEService gestureService("c91b0001-7d7a-4f8c-9d29-6e44c786a321");\nBLEStringCharacteristic gestureCharacteristic("c91b0002-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLENotify, 8);\nBLEStringCharacteristic controlCharacteristic("c91b0003-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLEWrite | BLENotify, 20);',
          highlight: [2],
          caption: 'Ba dòng tạo ra cả "tủ": một dịch vụ và hai đặc tính. Số cuối là độ dài tối đa (byte).',
          notes: [
            { lines: [2, 2], note: 'Đặc tính lệnh: chỉ Read + Notify, tối đa 8 byte. App không ghi được vào đây.' },
            { lines: [3, 3], note: 'Đặc tính điều khiển có thêm BLEWrite: app ghi "CALIBRATE", vòng tay trả "CALIBRATING" rồi "READY".' },
          ] },
        { type: 'match', id: 'u06.l2.q1', prompt: 'Ghép mỗi khái niệm BLE với hình ảnh so sánh.',
          pairs: [['Dịch vụ (service)', 'Ngăn tủ "BandW"'], ['Đặc tính (characteristic)', 'Tờ giấy chứa giá trị'], ['CCCD 0x2902', 'Công tắc "báo cho tôi"'], ['UUID', 'Mã số không trùng của ngăn hay tờ giấy']],
          explanation: 'Tủ chứa ngăn, ngăn chứa tờ giấy, tờ giấy có công tắc thông báo. Mỗi ngăn và tờ có mã UUID riêng để tìm đúng.' },
        { type: 'hotspot', id: 'u06.l2.q2', prompt: 'Chạm vào đặc tính mà app **ghi** chữ `CALIBRATE` vào.',
          target: { kind: 'diagram', name: 'gatt-tree' }, answer: 'ctrl-char',
          hint: 'Đặc tính nào có quyền Write?',
          explanation: 'Đặc tính điều khiển `c91b0003` có Read + Write + Notify. App ghi `CALIBRATE`, vòng tay trả lời `CALIBRATING` rồi `READY` qua chính đặc tính này.' },
        { type: 'hotspot', id: 'u06.l2.q3', prompt: 'Chạm vào chỗ app "bật công tắc" để được báo mỗi khi có lệnh mới.',
          target: { kind: 'diagram', name: 'gatt-tree' }, answer: 'cccd',
          explanation: 'App ghi giá trị bật thông báo vào CCCD `0x2902`. Từ lúc đó firmware thấy `subscribed()` là đúng và mới gửi lệnh.' },
        { type: 'truefalse', id: 'u06.l2.q4', prompt: 'Đặc tính lệnh `c91b0002` cho phép app **ghi** dữ liệu vào.',
          answer: false,
          explanation: 'Nó được khai báo `BLERead | BLENotify`: app chỉ đọc và nhận thông báo. Chỉ đặc tính điều khiển `c91b0003` có `BLEWrite`.' },
        { type: 'mcq', id: 'u06.l2.q5', prompt: 'Xung quanh có tai nghe, đồng hồ, loa Bluetooth… App tìm **đúng** vòng tay BandW bằng cách nào?',
          options: ['Lọc kết quả quét theo UUID dịch vụ c91b0001', 'Chọn thiết bị có sóng mạnh nhất', 'Nhập mật khẩu Wi-Fi', 'Dựa vào số điện thoại của người dùng'],
          answer: 0,
          explanation: '`BandBleClient` quét với `ScanFilter` theo UUID dịch vụ, nên chỉ thiết bị chạy firmware BandW mới hiện ra trong danh sách chọn.' },
        { type: 'number', id: 'u06.l2.q6', prompt: 'Đặc tính lệnh chứa tối đa bao nhiêu byte?',
          answer: 8, tolerance: 0, unit: 'byte',
          hint: 'Nhìn số cuối cùng trên dòng khai báo `gestureCharacteristic`.',
          explanation: 'Số `8` cuối dòng là độ dài tối đa. Từ dài nhất là `WATER` (5 byte) nên vẫn còn dư.' },
        { type: 'flashcard', id: 'u06.l2.q7', prompt: 'Giám khảo hỏi: "UUID là gì? Sao không đặt tên là BandW cho dễ?"',
          modelAnswer: 'UUID là mã định danh **128 bit**, gần như không thể trùng với thiết bị khác trên thế giới. Tên "BandW-Sense" ai cũng đặt được, nhưng app lọc theo UUID dịch vụ `c91b0001-7d7a-4f8c-9d29-6e44c786a321` nên chỉ tìm đúng vòng tay chạy firmware BandW. Firmware và app phải dùng **cùng** bộ UUID thì mới hiểu nhau.',
          keyPoints: ['Mã 128 bit, không trùng', 'App lọc quét theo UUID dịch vụ', 'Firmware và app dùng chung UUID'],
          explanation: 'Có thể chỉ vào dòng `BLEService gestureService(...)` trong firmware khi trả lời.' },
      ],
    },

    // ───────────────────────── L3 ─────────────────────────
    {
      id: 'l3',
      title: 'Từ quảng bá đến "WATER": từng bước kết nối',
      minutes: 12,
      goal: 'Sau bài này, em đọc được các dòng code quét, đăng ký và gửi lệnh, và giải mã được 5 byte của "WATER".',
      steps: [
        { type: 'sim', sim: 'ble-flow', props: { phase: 'advertise', showBytes: false },
          title: 'Bước 1: Quảng bá và quét',
          caption: 'Vòng tay phát liên tục tên BandW-Sense. App quét trong 8 giây rồi cho người dùng chọn đúng vòng tay.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/BandBleClient.java',
          code: 'private static final int SCAN_MS = 8000, CONNECT_MS = 15000, CALIBRATION_MS = 30000, SLOW_RETRY_MS = 30000;\n// …\nscanner.startScan(Collections.singletonList(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build()),\n        new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scan);',
          highlight: [3],
          caption: 'Quét 8 000 ms, kết nối chờ tối đa 15 000 ms. Bộ lọc chỉ giữ thiết bị có UUID dịch vụ BandW.',
          notes: [{ lines: [1, 1], note: 'Các hằng số thời gian (ms): quét 8 giây, chờ kết nối 15 giây, chờ hiệu chuẩn 30 giây, thử lại chậm mỗi 30 giây.' }] },
        { type: 'sim', sim: 'ble-flow', props: { phase: 'subscribe', showUuids: true },
          title: 'Bước 2: Đăng ký',
          caption: 'Sau khi kết nối và khám phá dịch vụ, điện thoại ghi 0x0001 vào CCCD 0x2902 để bật thông báo.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/BandBleClient.java',
          code: 'private boolean subscribe(BluetoothGatt source, BluetoothGattCharacteristic characteristic) {\n    BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CCCD);\n    if (descriptor == null || !source.setCharacteristicNotification(characteristic, true)) return false;\n    if (Build.VERSION.SDK_INT >= 33)\n        return source.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS;\n    descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);\n    return source.writeDescriptor(descriptor);\n}',
          highlight: [2, 5],
          caption: 'Hàm đăng ký: tìm CCCD của đặc tính, rồi ghi giá trị "bật thông báo". Android 13 trở lên dùng cách ghi mới.',
          notes: [{ lines: [4, 7], note: 'Hai nhánh làm cùng một việc; chỉ khác cách gọi giữa Android mới và cũ.' }] },
        { type: 'sim', sim: 'ble-flow', props: { phase: 'notify', command: 'WATER', showBytes: true },
          title: 'Bước 3: Thông báo "WATER"',
          caption: 'Bấm vào gói tin để xem 5 byte 57 41 54 45 52. Mỗi byte là mã [[ASCII]] của một chữ: W, A, T, E, R.' },
        { type: 'code', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: 'bool subscribed = connected && gestureCharacteristic.subscribed();\n// …\nif (!subscribed) doubleTap = false; // No buffering or replay of gestures performed while disconnected.\nGesture event = detector.update(x, y, z, gx, gy, gz, now, doubleTap);\nif (!subscribed) return;\nconst char* command = event == Gesture::Water ? "WATER" : event == Gesture::Food ? "FOOD" : event == Gesture::No ? "NO"\n    : event == Gesture::Yes ? "YES" : event == Gesture::Help ? "HELP" : nullptr;\nif (command) log(String(gestureCharacteristic.writeValue(command) ? "TX " : "TX FAILED ") + command);',
          highlight: [5, 8],
          caption: 'Chưa đăng ký thì `return`: không gửi, không lưu. Có lệnh thì `writeValue` cập nhật đặc tính và BLE tự gửi thông báo.',
          notes: [
            { lines: [6, 7], note: 'Chuỗi "? :" chọn từ cần gửi theo cử chỉ. Không có cử chỉ thì command = nullptr, không gửi gì.' },
            { lines: [8, 8], note: 'Log "TX WATER" chỉ nghĩa là firmware đã cập nhật đặc tính, chưa chắc điện thoại đã đọc xong câu.' },
          ] },
        { type: 'order', id: 'u06.l3.q1', prompt: 'Sắp xếp những việc xảy ra từ lúc bật vòng tay đến lúc điện thoại nhận lệnh.',
          items: ['Vòng tay quảng bá', 'App quét 8 giây', 'Kết nối', 'Khám phá dịch vụ', 'Ghi CCCD để đăng ký', 'Thông báo "WATER"'],
          explanation: 'Firmware log "APP READY" ngay khi thấy app đã đăng ký. Chỉ từ lúc đó lệnh mới được gửi đi.' },
        { type: 'number', id: 'u06.l3.q2', prompt: 'Nhìn gói tin trong hình. Từ `WATER` gửi qua BLE dài bao nhiêu byte?',
          visual: { kind: 'sim', sim: 'ble-flow', props: { phase: 'notify', command: 'WATER', showBytes: true } },
          answer: 5, tolerance: 0, unit: 'byte',
          explanation: 'Mỗi chữ ASCII là 1 byte, W-A-T-E-R là 5 chữ nên 5 byte: 57 41 54 45 52. Không có ký tự xuống dòng hay byte 0 ở cuối.' },
        { type: 'match', id: 'u06.l3.q3', prompt: 'Ghép chữ cái với mã ASCII (hệ 16) mà em vừa thấy trong gói "WATER".',
          pairs: [['W', '0x57'], ['A', '0x41'], ['T', '0x54'], ['R', '0x52']],
          hint: 'Đọc lần lượt 57 41 54 45 52 theo thứ tự chữ W, A, T, E, R.',
          explanation: 'Gói tin là 57 41 54 45 52. Nhờ bảng ASCII, app đổi đúng 5 byte này thành chuỗi "WATER".' },
        { type: 'mcq', id: 'u06.l3.q4', prompt: '**Notify** (thông báo) khác **Read** (đọc) ở điểm nào?',
          options: ['Với notify, vòng tay chủ động đẩy giá trị mới sang; với read, app phải tự hỏi', 'Notify chỉ dùng cho Wi-Fi', 'Read nhanh hơn nên BandW chỉ dùng read', 'Hai cách giống hệt nhau'],
          answer: 0,
          explanation: 'Nhờ notify, app không phải hỏi liên tục "có gì mới không?", vừa nhanh vừa đỡ tốn pin. Lệnh đến ngay khi cử chỉ được nhận ra.' },
        { type: 'predict', id: 'u06.l3.q5', language: 'cpp',
          prompt: 'App **chưa** đăng ký (`subscribed = false`) và người dùng vừa nghiêng tay trái. Đoạn code này làm gì?',
          code: 'Gesture event = detector.update(x, y, z, gx, gy, gz, now, doubleTap);\nif (!subscribed) return;\nconst char* command = event == Gesture::Water ? "WATER" : nullptr;\nif (command) gestureCharacteristic.writeValue(command);',
          highlight: [2],
          options: ['Gửi "WATER" ngay', 'Thoát ở dòng 2, không gửi gì', 'Lưu "WATER" để gửi khi app kết nối', 'Gửi chữ "NONE"'],
          answer: 1,
          explanation: '`!subscribed` là đúng nên `return` chạy luôn, các dòng sau bị bỏ qua. Cử chỉ lúc chưa kết nối bị bỏ, không được xếp hàng chờ.' },
        { type: 'truefalse', id: 'u06.l3.q6', prompt: 'Thấy log "TX WATER" trên máy tính nghĩa là điện thoại chắc chắn đã đọc xong câu.',
          answer: false,
          explanation: 'README firmware ghi rõ: "TX" chỉ là firmware đã cập nhật đặc tính. Muốn biết điện thoại đã đọc chưa thì phải xem trên app.' },
        { type: 'flashcard', id: 'u06.l3.q7', prompt: 'Giám khảo hỏi: "Gói tin BLE của em chứa gì? Dài bao nhiêu?"',
          modelAnswer: 'Mỗi thông báo chứa đúng **một từ ASCII**: `WATER`, `FOOD`, `NO`, `YES` hoặc `HELP`. Ví dụ `WATER` là 5 byte `57 41 54 45 52`, không có ký tự xuống dòng. Đặc tính lệnh cho tối đa 8 byte. Câu tiếng Việt không đi qua BLE mà nằm sẵn trong app.',
          keyPoints: ['Một từ ASCII mỗi thông báo', 'WATER = 5 byte 57 41 54 45 52', 'Tối đa 8 byte', 'Câu tiếng Việt nằm trong app'],
          explanation: 'Con số cụ thể (5 byte, 8 byte) giúp câu trả lời đáng tin hơn.' },
      ],
    },

    // ───────────────────────── L4 ─────────────────────────
    {
      id: 'l4',
      title: 'Mất kết nối và tự nối lại',
      minutes: 10,
      goal: 'Sau bài này, em giải thích được app tự nối lại thế nào và vì sao cử chỉ lúc mất sóng không được phát lại.',
      steps: [
        { type: 'sim', sim: 'ble-flow', props: { phase: 'disconnect', showBytes: false },
          caption: 'Khi sóng bị đứt, vòng tay quay lại quảng bá để app có thể tìm thấy và kết nối lại.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/BandBleClient.java',
          code: 'private static final int SCAN_MS = 8000, CONNECT_MS = 15000, CALIBRATION_MS = 30000, SLOW_RETRY_MS = 30000;\n/** Fast retries first; after that the band is retried every SLOW_RETRY_MS until the user disconnects. */\nprivate static final int[] BACKOFF_MS = {1000, 2000, 4000, 8000, 15000, 15000};\n// …\n// Never give up on our own (band out of range or flat battery for a while): only disconnect()/release() stop it.\nint delay = retries < BACKOFF_MS.length ? BACKOFF_MS[retries] : SLOW_RETRY_MS;\nretries++;',
          highlight: [3, 6],
          caption: 'Sáu lần thử nhanh chờ 1, 2, 4, 8, 15, 15 giây. Sau đó app cứ 30 giây thử một lần, đến khi người dùng tự ngắt kết nối.',
          notes: [
            { lines: [5, 5], note: 'App không tự bỏ cuộc (vòng tay ở xa hay hết pin một lúc): chỉ khi người dùng bấm ngắt kết nối mới dừng.' },
            { lines: [6, 6], note: 'Còn trong bảng thì lấy thời gian chờ trong bảng, hết bảng thì dùng SLOW_RETRY_MS = 30 000 ms.' },
          ] },
        { type: 'sim', sim: 'code-stepper', title: 'Đếm số lần thử lại',
          props: {
            language: 'java', title: 'Mã rút gọn từ BandBleClient.java', visual: 'loop',
            code: 'int[] BACKOFF_MS = {1000, 2000, 4000, 8000, 15000, 15000};\nint retries = 0;\nwhile (wanted) {              // người dùng vẫn muốn kết nối\n    int delay = retries < 6 ? BACKOFF_MS[retries] : 30000;\n    retries++;                // chờ delay ms rồi thử lại\n}\n// người dùng bấm ngắt kết nối: dừng',
            steps: [
              { line: 1, note: 'Bảng thời gian chờ (ms) cho 6 lần thử nhanh.' },
              { line: 2, vars: { retries: 0, wanted: true }, note: 'Vừa mất kết nối, chưa thử lại lần nào.' },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 1000 }, note: 'Lần 1: chờ 1 giây.' },
              { line: 5, vars: { retries: 1 } },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 2000 }, note: 'Lần 2: chờ 2 giây.' },
              { line: 5, vars: { retries: 2 } },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 4000 }, note: 'Lần 3: chờ 4 giây.' },
              { line: 5, vars: { retries: 3 } },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 8000 }, note: 'Lần 4: chờ 8 giây.' },
              { line: 5, vars: { retries: 4 } },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 15000 }, note: 'Lần 5: chờ 15 giây.' },
              { line: 5, vars: { retries: 5 } },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 15000 }, note: 'Lần 6: vẫn 15 giây, hết bảng thử nhanh.' },
              { line: 5, vars: { retries: 6 } },
              { line: 3, cond: { expr: 'wanted', value: true } },
              { line: 4, vars: { delay: 30000 }, note: 'Từ lần 7: retries không còn nhỏ hơn 6, chờ 30 giây.' },
              { line: 5, vars: { retries: 7 } },
              { line: 3, cond: { expr: 'wanted', value: false }, vars: { wanted: false }, note: 'Người dùng bấm "Ngắt kết nối vòng tay".' },
              { line: 7, out: 'Đã ngắt kết nối', note: 'Chỉ lúc này app mới thôi thử lại.' },
            ],
          },
          caption: 'Bấm ⏭ để xem `retries` tăng và `delay` dài dần rồi dừng ở 30 giây. Đây là cách [[chờ tăng dần]].' },
        { type: 'text', title: 'Phía vòng tay làm gì?',
          body: 'Khi mất kết nối, firmware chủ động quảng bá lại, mỗi lần thử cách nhau ít nhất 1 giây. Khi app đăng ký lại, firmware gọi `detector.disarm()`, nên người dùng phải đưa tay về trung tính trước cử chỉ mới.\n\n>! Cử chỉ làm lúc mất kết nối bị **bỏ đi**, không được lưu để phát lại' },
        { type: 'code', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: 'if (linkDropped && !connected && uint32_t(millis() - advertiseAt) >= 1000) {\n    advertiseAt = millis();\n    if (BLE.advertise()) { linkDropped = false; log("ADVERTISING"); }\n}\n// …\nif (subscribed != wasSubscribed) {\n    detector.disarm(); // Require a neutral wrist before each new connection session.\n    log(subscribed ? "APP READY" : "APP DISCONNECTED");',
          highlight: [3, 7],
          caption: 'Dòng 3: quảng bá lại sau khi rớt kết nối. Dòng 7: mỗi phiên kết nối mới đều bắt đầu từ tư thế trung tính.' },
        { type: 'truefalse', id: 'u06.l4.q1', prompt: 'Cử chỉ làm lúc mất sóng sẽ được đọc lên khi điện thoại nối lại.',
          answer: false,
          explanation: 'Firmware không có hàng đợi: chưa đăng ký thì `return`, lệnh bị bỏ. App cũng chỉ xử lý thông báo mới, không đọc lại giá trị cũ.' },
        { type: 'mcq', id: 'u06.l4.q2', prompt: 'Vì sao BandW **không** phát lại lệnh cũ sau khi nối lại?',
          options: ['Vì câu cũ có thể không còn đúng lúc, người nghe dễ hiểu nhầm', 'Vì BLE không gửi được hai lần', 'Vì điện thoại hết bộ nhớ', 'Vì làm vậy tốn Internet'],
          answer: 0,
          explanation: 'Ví dụ người dùng ra hiệu "Tôi muốn uống nước" lúc mất sóng, 1 phút sau đã được uống rồi. Đọc lại câu cũ lúc đó gây hiểu nhầm, nên thiết kế chọn bỏ đi.' },
        { type: 'number', id: 'u06.l4.q3', prompt: 'App thử kết nối lại **nhanh** bao nhiêu lần trước khi chuyển sang chờ 30 giây?',
          answer: 6, tolerance: 0, unit: 'lần',
          explanation: 'Bảng `BACKOFF_MS` có 6 giá trị: 1, 2, 4, 8, 15, 15 giây. Hết bảng, app dùng `SLOW_RETRY_MS = 30000`.' },
        { type: 'number', id: 'u06.l4.q4', prompt: 'Cộng tất cả thời gian chờ của 6 lần thử nhanh, được bao nhiêu giây?',
          answer: 45, tolerance: 0, unit: 's',
          hint: 'Cộng bảng chờ: 1 + 2 + 4 + 8 + 15 + 15.',
          explanation: '1 + 2 + 4 + 8 + 15 + 15 = 45 giây, chưa kể thời gian của chính mỗi lần thử kết nối (tối đa 15 giây mỗi lần).' },
        { type: 'truefalse', id: 'u06.l4.q8', prompt: 'Sau 6 lần thử nhanh thất bại, app bỏ cuộc và không bao giờ tự thử lại nữa.',
          answer: false,
          explanation: 'Phiên bản hiện tại không tự bỏ cuộc: cứ 30 giây thử lại một lần. Chỉ khi người dùng bấm "Ngắt kết nối vòng tay" thì app mới dừng.' },
        { type: 'mcq', id: 'u06.l4.q5', prompt: 'Vì sao thời gian chờ **tăng dần** thay vì thử lại liên tục?',
          options: ['Để không làm nghẽn Bluetooth và đỡ tốn pin khi vòng tay ở xa lâu', 'Để người dùng chờ cho quen', 'Vì Android cấm thử lại', 'Vì BLE chỉ hoạt động mỗi 15 giây'],
          answer: 0,
          explanation: 'Mất sóng ngắn thì nối lại nhanh sau 1 giây. Nếu vòng tay ở xa lâu, chờ lâu hơn giúp đỡ phí pin và đỡ làm nghẽn Bluetooth.' },
        { type: 'sim-predict', id: 'u06.l4.q6',
          prompt: 'Lệnh "WATER" vừa gửi xong. Nếu ngay sau đó sóng bị đứt, vòng tay sẽ làm gì?',
          sim: 'ble-flow', props: { phase: 'all', command: 'WATER', showBytes: true }, pauseAt: 'notify', revealTo: 'end',
          options: ['Quay lại quảng bá để app tìm thấy', 'Tắt nguồn để tiết kiệm pin', 'Gửi lệnh qua Wi-Fi', 'Lưu mọi cử chỉ để gửi bù'],
          answer: 0,
          explanation: 'Firmware quảng bá lại (log "ADVERTISING"), còn app tự nối lại theo bảng chờ tăng dần.' },
        { type: 'flashcard', id: 'u06.l4.q7', prompt: 'Giám khảo hỏi: "Đang dùng mà mất kết nối thì sao?"',
          modelAnswer: 'App tự kết nối lại: 6 lần đầu chờ 1, 2, 4, 8, 15, 15 giây, sau đó cứ **30 giây** thử một lần cho đến khi người dùng tự ngắt. Vòng tay chủ động quảng bá lại. Cử chỉ làm lúc mất sóng **bị bỏ**, không phát lại, để tránh đọc câu cũ sai lúc. Khi nối lại, người dùng phải về tư thế trung tính trước khi lệnh mới được nhận.',
          keyPoints: ['Tự nối lại, chờ tăng dần rồi 30 giây/lần', 'Vòng tay quảng bá lại', 'Không phát lại lệnh cũ', 'Phải về trung tính sau khi nối lại'],
          explanation: 'Thêm một ý trung thực: nhóm nên thử thực tế bằng cách mang vòng tay ra xa rồi quay lại.' },
      ],
    },

    // ───────────────────────── L5 ─────────────────────────
    {
      id: 'l5',
      title: 'Vì sao chọn BLE? Phạm vi, pin và bảo mật',
      minutes: 9,
      goal: 'Sau bài này, em so sánh được BLE với Wi-Fi và trả lời trung thực về phạm vi, pin và bảo mật.',
      steps: [
        { type: 'sim', sim: 'system-flow', props: { gesture: 'cycle', focus: 'ble' },
          caption: 'Chặng BLE được làm nổi bật: dữ liệu ở đây chỉ là một từ ngắn, nên một kết nối tiết kiệm điện là đủ.' },
        { type: 'diagram', title: 'So sánh ba cách kết nối', svg: compareSvg(),
          caption: 'So sánh định tính, không phải số đo. BLE hợp nhất với việc gửi vài byte từ một thiết bị chạy pin.',
          alt: 'Bảng so sánh BLE, Bluetooth cổ điển và Wi-Fi theo năm tiêu chí: tốn ít điện, có sẵn trên điện thoại, không cần bộ phát Wi-Fi, hợp gửi vài byte, truyền âm thanh video. BLE được tô nổi bật.' },
        { type: 'text', title: 'Thẳng thắn về bảo mật',
          body: 'Bản MVP **chưa** dùng [[ghép đôi]] hay mã hoá, nên một điện thoại lạ ở gần có cài app BLE vẫn có thể kết nối thử. Dữ liệu chỉ là 5 từ lệnh, không có tên hay thông tin cá nhân.\n\n> Hướng khắc phục: bật ghép đôi (bonding) để vòng tay chỉ nói chuyện với điện thoại đã quen.' },
        { type: 'mcq', id: 'u06.l5.q1', prompt: 'Ưu điểm **chính** của BLE đối với một vòng tay là gì?',
          options: ['Tốn rất ít điện và điện thoại nào cũng có sẵn', 'Truyền được video chất lượng cao', 'Kết nối xa hàng cây số', 'Không cần điện thoại'],
          answer: 0,
          explanation: 'Vòng tay chạy pin và chỉ gửi vài byte mỗi lần, nên BLE là lựa chọn hợp lý. Không cần bộ phát Wi-Fi hay Internet.' },
        { type: 'truefalse', id: 'u06.l5.q2', prompt: 'Bản MVP của BandW đã có ghép đôi và mã hoá BLE.',
          answer: false,
          explanation: 'README firmware ghi: "MVP không pairing/bonding". Đây là hạn chế đã biết và là hướng phát triển.' },
        { type: 'hotspot', id: 'u06.l5.q3', prompt: 'Một người lạ muốn làm vòng tay **hiệu chuẩn lại** ngoài ý muốn. Họ phải ghi vào đâu? Chạm vào đó.',
          target: { kind: 'sim', sim: 'ble-flow', props: { phase: 'discover', showUuids: true } }, answer: 'ctrl-char',
          hint: 'Chữ CALIBRATE được ghi vào đặc tính nào?',
          explanation: 'Đặc tính điều khiển `c91b0003` nhận lệnh `CALIBRATE`. Vì chưa có ghép đôi, đây là điểm cần bảo vệ trong phiên bản sau.' },
        { type: 'multi', id: 'u06.l5.q4', prompt: 'Chọn **tất cả** các câu trả lời trung thực về pin và phạm vi.',
          options: ['"Pin dùng được 3 ngày."', '"Nhóm chưa đo thời lượng pin. Cách đo: sạc đầy, chạy liên tục đến khi tắt và ghi thời gian."', '"Phạm vi phụ thuộc vật cản; nhóm đo bằng cách lùi xa dần và ghi khoảng cách còn nhận được lệnh."', '"BLE của BandW luôn kết nối xa 100 m."'],
          answers: [1, 2],
          hint: 'Câu nào có con số mà repo không hề đo?',
          explanation: 'Repo chưa có số đo pin hay phạm vi, nên không được đưa con số. Hãy nói cách đo, hoặc điền số thật nếu nhóm đã đo.' },
        { type: 'mcq', id: 'u06.l5.q5', prompt: 'Vì sao vòng tay gửi `WATER` chứ **không** gửi luôn câu "Tôi muốn uống nước."?',
          options: ['Từ ngắn vừa 8 byte, và đổi câu chỉ cần sửa app, không phải nạp lại firmware', 'Vì BLE không gửi được chữ', 'Vì vòng tay không biết tiếng Việt nên phát âm sai', 'Vì câu dài làm hỏng pin'],
          answer: 0,
          explanation: 'Câu tiếng Việt có dấu dài hơn 8 byte. Giữ câu trong `GestureCommand.java` còn giúp đổi lời nói dễ dàng mà không động tới vòng tay.' },
        { type: 'flashcard', id: 'u06.l5.q6', prompt: 'Giám khảo hỏi: "Người khác có kết nối trộm vào vòng tay được không?"',
          modelAnswer: 'Có thể, vì bản MVP **chưa ghép đôi, chưa mã hoá**. Đây là hạn chế nhóm đã biết. Dữ liệu chỉ là 5 từ lệnh, không có tên hay thông tin cá nhân, nhưng người lạ có thể ghi `CALIBRATE` để làm vòng tay hiệu chuẩn lại. Hướng khắc phục là bật ghép đôi (bonding) để vòng tay chỉ chấp nhận điện thoại đã quen.',
          keyPoints: ['Thừa nhận: chưa ghép đôi, chưa mã hoá', 'Dữ liệu không có thông tin cá nhân', 'Rủi ro: ghi CALIBRATE', 'Hướng khắc phục: bonding'],
          explanation: 'Giám khảo đánh giá cao việc em tự nói ra hạn chế và có hướng sửa.' },
        { type: 'flashcard', id: 'u06.l5.q7', prompt: 'Giám khảo hỏi: "Pin của vòng tay dùng được bao lâu?"',
          modelAnswer: 'Nếu nhóm **chưa đo** thì nói thẳng là chưa đo, không đoán. Nêu cách đo: sạc đầy, bật vòng tay và kết nối app, để chạy liên tục đến khi tắt, ghi lại thời gian. Firmware đã có vài bước tiết kiệm điện: nghỉ `delay(1)` giữa các mẫu, LED chỉ chớp ngắn khi sẵn sàng, và dùng BLE. Nếu đã đo, đọc con số thật kèm điều kiện đo.',
          keyPoints: ['Không bịa số', 'Cách đo: sạc đầy, chạy đến khi tắt', 'Đã có delay(1), LED chớp ngắn, BLE', 'Có số thật thì nêu kèm điều kiện'],
          explanation: 'Một câu "chưa đo, đây là cách đo" thuyết phục hơn một con số không có bằng chứng.' },
      ],
    },
    // ───────────────────────── L6 ─────────────────────────
    {
      id: 'l6',
      title: 'Câu chuyện gỡ lỗi: vì sao app tự ngắt sau vài câu?',
      minutes: 12,
      goal: 'Sau bài này, em kể được lỗi mất kết nối: triệu chứng, nguyên nhân gốc, cách sửa ở app và firmware.',
      steps: [
        { type: 'sim', title: 'Triệu chứng: đang chạy thì rớt', sim: 'ble-flow', props: { phase: 'disconnect', showBytes: false },
          caption: 'Bản app cũ: kết nối được, đọc được khoảng 3 câu rồi mất kết nối, phải bấm Kết nối lại. Hãy cùng làm "thám tử" tìm nguyên nhân.' },
        { type: 'diagram', title: 'Dòng thời gian của lỗi', svg: bugTimelineSvg(),
          caption: 'Ba câu tốn khoảng nửa phút, gần đúng lúc điện thoại tự tắt màn hình. Khi đó Android gọi `onStop()`, và app cũ đóng Bluetooth ngay trong hàm này.',
          alt: 'Dòng thời gian bốn khối: 0 giây kết nối; khoảng 0 đến 30 giây đọc 3 câu; khoảng 30 giây màn hình tự tắt; ngay sau đó onStop() gọi ble.disconnect, có nhãn đỏ mất kết nối.' },
        { type: 'text', title: 'Manh mối: thời gian, không phải số câu',
          body: 'Lỗi luôn đến sau **khoảng cùng một thời gian**, dù nói câu gì, nên nghi phạm là một thứ **hẹn giờ** chứ không phải gói tin. Thứ hẹn giờ quen nhất trên điện thoại là **tự tắt màn hình**. Đọc code, nhóm thấy hàm `onStop()` (chạy khi màn hình tắt, bấm Home hay xoay máy) gọi `ble.disconnect(...)`: đó là **[[nguyên nhân gốc]]** (root cause).' },
        { type: 'code', title: 'Thủ phạm trong app cũ', language: 'java', source: 'app/src/main/java/com/bandw/demo/MainActivity.java (bản cũ, commit 9c8c919)',
          code: '@Override protected void onStop() {\n    stopSpeech();\n    if (ble != null) ble.disconnect("Chưa kết nối · Bấm Kết nối vòng tay để nhận cử chỉ");\n    super.onStop();\n}',
          highlight: [3],
          caption: 'Dòng 3: mỗi lần màn hình rời khỏi tầm nhìn (tắt màn hình, Home, xoay máy), app tự cắt Bluetooth.' },
        { type: 'hotspot', id: 'u06.l6.q1', prompt: 'Trên dòng thời gian, chạm vào bước **trực tiếp đóng** kết nối Bluetooth.',
          target: { kind: 'diagram', svg: bugTimelineSvg() }, answer: 'onstop',
          explanation: 'Màn hình tắt chỉ là "công tắc". Thứ thật sự cắt kết nối là dòng `ble.disconnect(...)` trong `onStop()` của app cũ.' },
        { type: 'mcq', id: 'u06.l6.q2', prompt: 'Vì sao lỗi trông giống "cứ 3 câu là ngắt"?',
          options: ['Vì 3 câu mất khoảng nửa phút, đúng lúc màn hình tự tắt và app cũ đóng Bluetooth', 'Vì BLE chỉ gửi được 3 gói tin', 'Vì vòng tay hết pin sau 3 câu', 'Vì app chỉ nhớ được 3 câu'], answer: 0,
          explanation: 'Con số 3 chỉ là trùng hợp về thời gian. Đổi thời gian tắt màn hình thì "số câu" trước khi ngắt cũng đổi theo: dấu hiệu lỗi gắn với hẹn giờ.' },
        { type: 'code', title: 'Cách sửa trong app mới', language: 'java', source: 'app/src/main/java/com/bandw/demo/MainActivity.java',
          code: 'public void link(boolean active, boolean connected) {\n    bandConnected = connected;\n    // Keep the screen on and the process in the foreground while the band is in use.\n    if (active) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);\n    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);\n    BandLinkService.update(MainActivity.this, active, connected ? "Đã kết nối BandW-Sense" : "Đang kết nối lại vòng tay…");\n    if (current == null) applyMode();\n}',
          highlight: [4, 6],
          caption: '`onStop()` không còn đóng Bluetooth. Khi đang dùng vòng tay, app giữ màn hình sáng (dòng 4) và chạy [[dịch vụ nền]] `BandLinkService` (dòng 6) để vẫn nhận lệnh khi tắt màn hình.',
          notes: [
            { lines: [6, 6], note: 'Dịch vụ nền hiện thông báo "BandW đang lắng nghe vòng tay". Xoay máy cũng không còn tạo lại màn hình (configChanges trong AndroidManifest).' },
          ] },
        { type: 'multi', id: 'u06.l6.q3', prompt: 'Ở **app cũ**, những việc nào từng làm mất kết nối? Chọn tất cả.',
          options: ['Màn hình tự tắt', 'Bấm Home hoặc rời app', 'Xoay điện thoại', 'Hiệu chuẩn quá 30 giây', 'Nhận được lệnh HELP'],
          answers: [0, 1, 2, 3],
          explanation: 'Ba việc đầu đều làm Android gọi `onStop()`. Hiệu chuẩn quá 30 giây từng bị coi là lỗi và cắt kết nối; bản mới chỉ báo lỗi, giữ kết nối. Lệnh HELP không liên quan.' },
        { type: 'diagram', title: 'Phía vòng tay cũng được "gia cố"', svg: firmwareFixesSvg(),
          caption: 'Ngoài lỗi chính ở app, nhóm rà firmware và sửa thêm 4 nguy cơ có thể làm vòng tay ngắt hoặc treo.',
          alt: 'Bảng hai cột. Nguy cơ: log Serial chờ máy tính đọc làm BLE.poll treo; bộ đếm gói _pendingPkt kẹt sau vài lần ngắt; ngắt rồi im lặng nên app không tìm thấy; treo vì lỗi bất kỳ. Đã sửa: log không bao giờ chờ; đặt lại bộ đếm khi mất kết nối; quảng bá lại; watchdog 4 giây tự khởi động lại.' },
        { type: 'match', id: 'u06.l6.q4', prompt: 'Ghép mỗi nguy cơ phía vòng tay với cách firmware đã sửa.',
          pairs: [['Serial.println chờ máy tính đọc', 'Log "best-effort": không chờ, bận thì bỏ dòng'], ['_pendingPkt không được trả lại khi ngắt', 'Đặt lại bộ đếm gói trong onDisconnected'], ['Mất kết nối rồi im lặng', 'Chủ động quảng bá lại'], ['Chương trình treo vì lỗi lạ', 'Watchdog 4 giây khởi động lại board']],
          explanation: 'Mỗi lỗi một "thuốc" riêng. [[watchdog]] là lưới an toàn cuối cùng: dù treo vì lý do gì, 4 giây sau board tự chạy lại.' },
        { type: 'truefalse', id: 'u06.l6.q5', prompt: 'Chỉ cần bật watchdog 4 giây trên vòng tay là đã sửa được lỗi tắt màn hình.',
          answer: false,
          explanation: 'Sai. Lỗi tắt màn hình nằm ở **app** (điện thoại tự cắt Bluetooth); vòng tay không hề treo, nên watchdog không giúp được. Phải sửa đúng chỗ: bỏ `disconnect` trong `onStop()` và thêm dịch vụ nền.' },
        { type: 'order', id: 'u06.l6.q6', prompt: 'Sắp xếp các bước gỡ lỗi mà nhóm đã làm.',
          items: ['Mô tả triệu chứng: rớt sau khoảng 3 câu', 'Tìm quy luật: luôn sau một khoảng thời gian gần giống nhau', 'Đặt giả thuyết: màn hình tự tắt', 'Đọc code: onStop() gọi disconnect', 'Sửa app, rà thêm firmware, rồi thử lại'],
          explanation: 'Đây là quy trình gỡ lỗi khoa học: quan sát → tìm quy luật → giả thuyết → kiểm chứng trong code → sửa → thử lại.' },
        { type: 'flashcard', id: 'u06.l6.q7', prompt: 'Giám khảo hỏi: "Lỗi khó nhất nhóm gặp là gì? Nhóm giải quyết thế nào?"',
          modelAnswer: 'Bản app cũ cứ đọc được **khoảng 3 câu là mất kết nối**. Nhóm nhận ra lỗi gắn với **thời gian** chứ không phải số câu: khoảng 30 giây là lúc màn hình **tự tắt**. Khi đó Android gọi `onStop()`, và code cũ gọi `ble.disconnect()` ngay trong đó. Bản mới giữ kết nối bằng **dịch vụ nền**, giữ màn hình sáng khi đang dùng, xoay máy không ngắt, và **tự nối lại** nếu rớt. Nhóm còn sửa firmware: log không chặn vòng lặp, vá bộ đếm gói của ArduinoBLE, quảng bá lại, và **watchdog 4 giây**.',
          keyPoints: ['Triệu chứng: rớt sau ~3 câu', 'Nguyên nhân gốc: tắt màn hình → onStop() → disconnect', 'Sửa app: dịch vụ nền, giữ màn hình sáng, tự nối lại', 'Gia cố firmware: log, _pendingPkt, quảng bá lại, watchdog'],
          explanation: 'Kể theo mạch "triệu chứng → manh mối → nguyên nhân gốc → sửa". Giám khảo thích nghe nhóm tự tìm ra lỗi.' },
        { type: 'flashcard', id: 'u06.l6.q8', prompt: 'Giám khảo hỏi: "Làm sao em chắc là lỗi mất kết nối đã hết?"',
          modelAnswer: 'Nói trung thực: code đã sửa đúng nguyên nhân gốc, và kiểm thử trên máy tính có ca **kết nối lại**. Nhưng để **chắc chắn** thì cần thử dài trên máy thật: kết nối, tắt màn hình, để 15–30 phút, làm cử chỉ định kỳ và đếm số lần rớt; thử thêm mang vòng tay ra xa rồi quay lại để xem app tự nối lại. Em chỉ nói "đã hết lỗi" khi có số liệu từ phép thử đó.',
          keyPoints: ['Đã sửa đúng nguyên nhân gốc', 'Cần phép thử dài trên máy thật', 'Đếm số lần rớt, thử ra xa rồi quay lại', 'Không khẳng định khi chưa đo'],
          explanation: 'Phân biệt "đã sửa code" với "đã đo và chứng minh" là dấu hiệu tư duy khoa học.' },
      ],
    },
  ],
  defense: [
    { type: 'flashcard', id: 'u06.d.q1', prompt: 'Giám khảo hỏi: "Sao không dùng Wi-Fi cho tiện?"',
      modelAnswer: 'Wi-Fi cần bộ phát và tốn điện hơn, trong khi vòng tay chỉ gửi vài byte mỗi lần. BLE có sẵn trên điện thoại, nối thẳng với vòng tay, không cần Internet, nên hợp với thiết bị đeo chạy pin và dùng được cả ở nơi không có Wi-Fi như phòng bệnh.',
      keyPoints: ['Wi-Fi cần bộ phát, tốn điện', 'Chỉ gửi vài byte', 'BLE nối thẳng, không cần Internet'],
      explanation: 'So sánh theo đúng nhu cầu của dự án, không nói Wi-Fi "kém".' },
    { type: 'flashcard', id: 'u06.d.q2', prompt: 'Giám khảo hỏi: "Phạm vi kết nối xa bao nhiêu mét?"',
      modelAnswer: 'BLE thường dùng trong phạm vi một căn phòng, khoảng cách thực tế phụ thuộc vật cản và điện thoại. Nếu nhóm đã đo thì nêu số đo và điều kiện. Nếu chưa, nói cách đo: lùi xa dần, mỗi mốc thử 10 cử chỉ, ghi khoảng cách cuối cùng còn nhận đủ lệnh.',
      keyPoints: ['Phụ thuộc vật cản', 'Có số đo thì nêu kèm điều kiện', 'Cách đo: lùi xa dần, thử ở từng mốc'],
      explanation: 'Không đưa con số chung chung lấy từ mạng như thể đó là kết quả của nhóm.' },
    { type: 'flashcard', id: 'u06.d.q3', prompt: 'Giám khảo hỏi: "Firmware và app thống nhất với nhau bằng gì?"',
      modelAnswer: 'Bằng một "hợp đồng" nhỏ: tên `BandW-Sense`, UUID dịch vụ `c91b0001-…`, đặc tính lệnh `c91b0002-…` (Read + Notify, tối đa 8 byte) gửi 5 từ `WATER`, `FOOD`, `NO`, `YES`, `HELP`, và đặc tính điều khiển `c91b0003-…` cho `CALIBRATE` / `CALIBRATING` / `READY`. Hai bên dùng chung các UUID này.',
      keyPoints: ['UUID dịch vụ và hai đặc tính', '5 từ lệnh ASCII', 'Kênh điều khiển CALIBRATE/READY'],
      explanation: 'Có thể chỉ vào sơ đồ cây GATT khi trả lời.' },
  ],
};
