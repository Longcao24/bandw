// public/content/unit07.js: Chương 7, Ứng dụng Android và giọng nói (Writer D)
// Code trích từ app/src/main/java/com/bandw/demo/{GestureCommand,MainActivity,BandBleClient,BandLinkService}.java (bản 0.5.0).

const T = 'style="fill:var(--c-text)"';
const MUTED = 'style="fill:var(--c-muted)"';

// Màn hình app vẽ giản lược (thứ tự khối giống buildScreen() trong MainActivity, phần Tùy chọn đang mở).
function phoneSvg() {
  const btn = (id, label, y, text, primary) =>
    `<g data-hotspot="${id}" data-label="${label}"><rect x="170" y="${y}" width="260" height="34" rx="10" style="fill:${primary ? 'var(--c-primary-soft)' : 'var(--c-surface-2)'};stroke:var(--c-border)"/>` +
    `<text x="300" y="${y + 23}" font-size="15" font-weight="700" text-anchor="middle" ${T}>${text}</text></g>`;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 640" font-family="inherit" role="img">';
  s += '<rect x="150" y="6" width="300" height="628" rx="34" style="fill:var(--c-surface);stroke:var(--c-text);stroke-width:3"/>';
  s += `<g data-hotspot="demo" data-label="Nút Demo"><rect x="170" y="30" width="70" height="30" rx="8" style="fill:var(--c-surface-2);stroke:var(--c-border)"/><text x="205" y="51" font-size="15" font-weight="700" text-anchor="middle" ${T}>Demo</text></g>`;
  s += `<text x="430" y="52" font-size="20" font-weight="700" text-anchor="end" ${T}>bandw</text>`;
  s += `<text x="170" y="86" font-size="14" ${MUTED}>● Đã kết nối BandW-Sense</text>`;
  s += btn('connect', 'Nút Kết nối vòng tay', 96, 'Kết nối vòng tay', true);
  s += btn('calibrate', 'Nút Hiệu chuẩn', 138, 'Hiệu chuẩn');
  s += '<g data-hotspot="phrase" data-label="Thẻ lời nhắn">';
  s += '<rect x="170" y="184" width="260" height="128" rx="16" style="fill:var(--c-primary);opacity:.92"/>';
  s += '<text x="186" y="208" font-size="14" font-weight="700" style="fill:var(--c-primary-ink)">LỜI NHẮN CỦA BẠN</text>';
  s += '<text x="186" y="240" font-size="20" font-weight="700" style="fill:var(--c-primary-ink)">Tôi muốn uống nước.</text>';
  s += '<text x="186" y="264" font-size="14" style="fill:var(--c-primary-ink)">← Nghiêng tay trái · Vòng tay</text></g>';
  s += `<g data-hotspot="replay" data-label="Nút Đọc lại"><rect x="186" y="274" width="110" height="30" rx="8" style="fill:var(--c-surface)"/><text x="241" y="295" font-size="15" font-weight="700" text-anchor="middle" ${T}>Đọc lại</text></g>`;
  s += `<text x="170" y="336" font-size="14" ${MUTED}>Đang đọc…</text>`;
  s += btn('stop', 'Nút Dừng đọc', 346, 'Dừng đọc');
  s += `<text x="170" y="404" font-size="14" font-weight="700" ${MUTED}>TÙY CHỌN</text>`;
  s += `<g data-hotspot="auto" data-label="Công tắc Tự động đọc"><text x="170" y="434" font-size="15" ${T}>Tự động đọc khi nhận lệnh</text><rect x="388" y="420" width="42" height="22" rx="11" style="fill:var(--c-success)"/><circle cx="419" cy="431" r="8" style="fill:var(--c-surface)"/></g>`;
  s += '<g data-hotspot="history" data-label="Danh sách lệnh gần đây">';
  s += `<text x="170" y="472" font-size="14" font-weight="700" ${MUTED}>LỆNH GẦN ĐÂY</text>`;
  ['10:02:15 · WATER · Vòng tay', '10:01:40 · YES · Vòng tay', '10:00:58 · NO · Mô phỏng'].forEach((r, i) => {
    s += `<text x="170" y="${500 + i * 34}" font-size="14" ${T}>${r}</text>`;
  });
  s += `<text x="170" y="602" font-size="14" ${MUTED}>(giữ tối đa 5 dòng)</text></g>`;
  return s + '</svg>';
}

// Dữ liệu đi đâu: chỉ vòng tay → điện thoại → loa, có "bức tường" chặn Internet.
function dataFlowSvg() {
  const box = (id, label, x, y, w, icon, text) =>
    `<g data-hotspot="${id}" data-label="${label}"><rect x="${x}" y="${y}" width="${w}" height="80" rx="14" style="fill:var(--c-surface-2);stroke:var(--c-text);stroke-width:2"/>` +
    `<text x="${x + w / 2}" y="${y + 34}" font-size="24" text-anchor="middle">${icon}</text><text x="${x + w / 2}" y="${y + 64}" font-size="15" font-weight="700" text-anchor="middle" ${T}>${text}</text></g>`;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 320" font-family="inherit" role="img">';
  s += '<defs><marker id="u07a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--c-primary)"/></marker></defs>';
  s += box('cloud', 'Máy chủ trên Internet', 210, 14, 180, '☁️', 'Máy chủ / Internet');
  s += '<line x1="60" y1="128" x2="540" y2="128" style="stroke:var(--c-danger);stroke-width:4;stroke-dasharray:12 8"/>';
  s += '<text x="300" y="152" font-size="15" font-weight="700" text-anchor="middle" style="fill:var(--c-danger)">✗ Không gửi dữ liệu cử chỉ lên mạng</text>';
  s += box('band', 'Vòng tay', 20, 200, 150, '⌚', 'Vòng tay');
  s += box('phone', 'Điện thoại', 225, 200, 150, '📱', 'Điện thoại');
  s += box('speaker', 'Loa điện thoại', 430, 200, 150, '🔊', 'Loa');
  s += '<line x1="172" y1="240" x2="222" y2="240" style="stroke:var(--c-primary);stroke-width:3" marker-end="url(#u07a)"/>';
  s += '<line x1="377" y1="240" x2="427" y2="240" style="stroke:var(--c-primary);stroke-width:3" marker-end="url(#u07a)"/>';
  s += `<text x="197" y="300" font-size="14" text-anchor="middle" ${MUTED}>BLE: "WATER"</text>`;
  s += `<text x="403" y="300" font-size="14" text-anchor="middle" ${MUTED}>giọng đọc</text>`;
  return s + '</svg>';
}

export default {
  id: 'u07',
  title: 'Ứng dụng Android và giọng nói (TTS)',
  description: 'App nhận chữ "WATER", tra ra câu tiếng Việt, hiện lên màn hình và đọc thành tiếng bằng giọng vi-VN.',
  color: 'teal',
  icon: '📱',
  glossary: [
    { term: 'chuỗi', en: 'string', def: 'Một dãy ký tự (chữ, số, dấu cách) mà chương trình xử lý như văn bản, ví dụ "WATER".' },
    { term: 'enum', en: 'enumeration', def: 'Danh sách cố định các giá trị có tên. GestureCommand là enum gồm WATER, FOOD, NO, YES, HELP; mỗi giá trị mang theo câu nói, nhãn và màu.' },
    { term: 'phân tích lệnh', en: 'parse', def: 'Đọc một chuỗi thô và đổi nó thành dữ liệu có nghĩa. GestureCommand.parse() đổi " water " thành giá trị WATER, chuỗi lạ thành null.' },
    { term: 'null', en: 'null', def: 'Giá trị đặc biệt nghĩa là "không có gì". parse() trả null khi chuỗi không phải lệnh hợp lệ, và app bỏ qua.' },
    { term: 'TTS', en: 'Text-to-Speech', def: 'Chuyển văn bản thành giọng nói. BandW dùng bộ máy TextToSpeech có sẵn trong Android với ngôn ngữ vi-VN.' },
    { term: 'QUEUE_FLUSH', en: 'queue flush', def: 'Chế độ đọc của TextToSpeech: câu mới xoá hàng đợi và cắt câu đang đọc, thay vì xếp hàng chờ.' },
    { term: 'tiêu điểm âm thanh', en: 'audio focus', def: 'Cơ chế Android cho một app "xin nói". BandW xin tạm thời và cho phép app khác nhỏ tiếng lại (duck) trong lúc đọc.' },
    { term: 'chế độ Demo', en: 'Demo mode', def: 'Chế độ của app có 5 nút mô phỏng cử chỉ, chạy cùng đường xử lý với BLE. Khi bật, lệnh từ vòng tay bị bỏ qua.' },
    { term: 'dịch vụ nền', en: 'foreground service', def: 'Thành phần Android chạy kèm một thông báo cố định, giữ app hoạt động khi tắt màn hình. BandW dùng BandLinkService.' },
    { term: 'TalkBack', en: 'TalkBack screen reader', def: 'Trình đọc màn hình có sẵn của Android dành cho người khiếm thị, đọc to nội dung đang hiện.' },
    { term: 'quyền', en: 'permission', def: 'Sự cho phép người dùng cấp cho app để dùng một tính năng nhạy cảm của điện thoại, ví dụ Bluetooth hay vị trí.' },
  ],
  lessons: [
    // ───────────────────────── L1 ─────────────────────────
    {
      id: 'l1',
      title: 'Từ "WATER" đến câu tiếng Việt',
      minutes: 10,
      goal: 'Sau bài này, em giải thích được app biến 5 byte "WATER" thành câu "Tôi muốn uống nước." ra sao.',
      steps: [
        { type: 'diagram', name: 'tts-chain', title: 'Chuỗi xử lý trong app',
          caption: 'Byte nhận qua BLE → chuỗi chữ → parse() → giá trị enum → câu tiếng Việt → TextToSpeech → loa.',
          alt: 'Sơ đồ sáu khối nối nhau: byte "WATER", parse, enum, câu nói, TextToSpeech, loa.' },
        { type: 'text', title: 'App là "người phiên dịch"',
          body: 'Vòng tay chỉ gửi một từ tiếng Anh viết hoa. App đổi byte thành [[chuỗi]], cắt dấu cách thừa, rồi tra trong bảng [[enum]] để lấy câu tiếng Việt.\n\n> Giống tra từ điển: thấy chữ "WATER" thì đọc to câu đã ghi sẵn bên cạnh.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/GestureCommand.java',
          code: 'public enum GestureCommand {\n    WATER("Tôi muốn uống nước.", "← Nghiêng tay trái", "#E4EFF9"),\n    FOOD("Tôi muốn ăn.", "→ Nghiêng tay phải", "#F6EFCF"),\n    NO("Không.", "↔ Lắc cổ tay", "#FCEAE5"),\n    // … [chú thích] YES và HELP viết theo đúng mẫu này\n    public static GestureCommand parse(String raw) {\n        if (raw == null) return null;\n        try { return valueOf(raw.trim().toUpperCase(Locale.ROOT)); }\n        catch (IllegalArgumentException e) { return null; }\n    }\n}',
          highlight: [8],
          caption: 'Mỗi giá trị mang ba thứ: câu nói, nhãn cử chỉ và màu thẻ. Hàm parse() tìm giá trị có tên trùng với chữ nhận được.',
          notes: [
            { lines: [2, 2], note: 'Đổi câu "Tôi muốn uống nước." chỉ cần sửa dòng này trong app, không phải nạp lại firmware.' },
            { lines: [8, 9], note: 'trim() cắt dấu cách, toUpperCase() viết hoa, valueOf() tìm tên. Không tìm thấy thì trả null.' },
          ] },
        { type: 'sim', sim: 'code-stepper', title: 'Chạy thử parse(" water ")',
          props: {
            language: 'java', title: 'Mã rút gọn từ GestureCommand.parse()', visual: 'boxes',
            code: 'String raw = " water ";\nif (raw == null) return null;\nString s = raw.trim();\ns = s.toUpperCase(Locale.ROOT);\nGestureCommand c = GestureCommand.valueOf(s);\nreturn c;',
            steps: [
              { line: 1, vars: { raw: '" water "' }, note: 'Chuỗi nhận được có dấu cách hai đầu và viết thường.' },
              { line: 2, cond: { expr: 'raw == null', value: false }, note: 'Có dữ liệu nên đi tiếp.' },
              { line: 3, vars: { s: '"water"' }, note: 'trim() cắt dấu cách ở hai đầu.' },
              { line: 4, vars: { s: '"WATER"' }, note: 'toUpperCase() đổi sang chữ hoa.' },
              { line: 5, vars: { c: 'WATER' }, note: 'valueOf() tìm thấy giá trị tên WATER trong enum.' },
              { line: 6, out: 'WATER → "Tôi muốn uống nước."', note: 'Trả về WATER, từ đó lấy được câu nói.' },
            ],
          },
          caption: 'Bấm ⏭ để xem chuỗi đổi dạng qua từng dòng: " water " → "water" → "WATER" → giá trị WATER.' },
        { type: 'sim', sim: 'tts-pipeline', props: { command: 'WATER', allowPick: true, showInvalid: true },
          caption: 'Chọn từng lệnh để xem đường đi. Thử cả chuỗi lạ "HELLO": [[phân tích lệnh]] trả [[null]] nên app không làm gì.' },
        { type: 'predict', id: 'u07.l1.q1', language: 'java', prompt: 'Kết quả của dòng này là gì?',
          code: 'GestureCommand c = GestureCommand.parse(" food ");', highlight: [1],
          options: ['FOOD', 'null', '" food "', 'Báo lỗi và tắt app'],
          answer: 0,
          explanation: 'trim() bỏ dấu cách, toUpperCase() đổi thành "FOOD", valueOf() tìm thấy FOOD. Nhờ vậy app không khó tính với dấu cách hay chữ thường.' },
        { type: 'predict', id: 'u07.l1.q2', language: 'java', prompt: 'Nếu vì lỗi nào đó app nhận chữ `WATR`, chuyện gì xảy ra?',
          code: 'GestureCommand command = GestureCommand.parse("WATR");\nif (command == null) return;\nphraseView.setText(command.phrase);', highlight: [2],
          options: ['Hiện "Tôi muốn uống nước." vì gần giống', 'parse trả null, app dừng ở dòng 2, không hiện và không đọc gì', 'App đọc to chữ "WATR"', 'App bị treo'],
          answer: 1,
          hint: '`valueOf` chỉ chấp nhận tên **trùng khớp hoàn toàn**.',
          explanation: '"WATR" không trùng tên nào nên `valueOf` báo lỗi, `parse` bắt lỗi đó và trả null. Thà im lặng còn hơn đọc sai một câu.' },
        { type: 'match', id: 'u07.l1.q3', prompt: 'Ghép mỗi giá trị enum với câu app sẽ đọc.',
          pairs: [['WATER', 'Tôi muốn uống nước.'], ['FOOD', 'Tôi muốn ăn.'], ['NO', 'Không.'], ['YES', 'Có.'], ['HELP', 'Tôi cần giúp đỡ.']],
          explanation: 'Năm câu này nằm trong `GestureCommand.java` của app, không nằm trong firmware.' },
        { type: 'flashcard', id: 'u07.l1.q8', topic: 'Android', prompt: 'Giám khảo hỏi: "Sao vòng tay gửi chữ như WATER mà không gửi số 1, 2, 3 cho gọn?"',
          modelAnswer: 'Gửi số thì gọn hơn vài byte, nhưng gửi chữ có ba cái lợi. Một, **dễ gỡ lỗi**: nhìn log "TX WATER" là hiểu ngay, không phải tra bảng. Hai, **khó nhầm**: `GestureCommand.parse()` chỉ nhận chuỗi trùng đúng tên lệnh; chuỗi sai hay thiếu chữ trả `null` và bị bỏ qua, còn một con số bị lỗi vẫn có thể trông như số hợp lệ. Ba, từ dài nhất chỉ 5 byte, vẫn vừa giới hạn 8 byte của đặc tính. Với vài lệnh mỗi giờ, chênh lệch vài byte không đáng kể.',
          keyPoints: ['Dễ đọc log, dễ gỡ lỗi', 'parse() khớp đúng tên, chuỗi lạ thành null', 'Tối đa 5 byte, vừa 8 byte', 'Chênh vài byte không đáng kể'],
          explanation: 'Gắn với bảng enum vừa ghép: tên giá trị enum trùng với chữ vòng tay gửi.' },
        { type: 'sim-predict', id: 'u07.l1.q4', prompt: 'App vừa nhận chữ `HELP` và parse() xong. Màn hình sẽ hiện câu nào?',
          sim: 'tts-pipeline', props: { command: 'HELP', allowPick: false }, pauseAt: 'parse', revealTo: 'end',
          options: ['"Tôi cần giúp đỡ."', '"HELP"', '"Có."', 'Không hiện gì'],
          answer: 0,
          explanation: 'parse("HELP") ra giá trị HELP, app lấy `command.phrase` là "Tôi cần giúp đỡ." để hiện và đọc.' },
        { type: 'mcq', id: 'u07.l1.q5', prompt: 'Muốn đổi câu "Tôi muốn ăn." thành "Tôi đói." thì sửa ở đâu?',
          options: ['GestureCommand.java trong app, không cần nạp lại firmware', 'GestureDetector.h rồi nạp lại firmware', 'Đổi UUID dịch vụ BLE', 'Không đổi được'],
          answer: 0,
          explanation: 'Vòng tay vẫn gửi `FOOD`. Chỉ có câu nói đổi, và câu nằm trong enum của app.' },
        { type: 'multi', id: 'u07.l1.q6', prompt: 'Muốn thêm một cử chỉ **mới**, ví dụ "Tôi muốn đi vệ sinh", cần sửa **những** chỗ nào?',
          options: ['GestureDetector.h: luật nhận dạng cử chỉ mới', 'BandW_Sense.ino: từ lệnh mới để gửi đi', 'GestureCommand.java: thêm giá trị và câu nói', 'Đổi CCCD 0x2902', 'Không cần sửa gì, app tự hiểu'],
          answers: [0, 1, 2],
          hint: 'Nghĩ theo đường đi: nhận dạng → gửi → tra câu.',
          explanation: 'Firmware phải nhận ra cử chỉ và gửi một từ mới (nhớ là tối đa 8 byte), còn app phải có giá trị enum trùng tên với câu tương ứng. CCCD không liên quan.' },
        { type: 'flashcard', id: 'u07.l1.q7', topic: "App Android & giọng nói", prompt: 'Giám khảo hỏi: "Nếu vòng tay gửi một chữ lạ thì app làm gì?"',
          modelAnswer: "App đổi byte thành chuỗi, `trim()`, rồi gọi `GestureCommand.parse()`. Hàm này viết hoa và tìm tên trùng khớp trong enum. Chữ lạ không trùng tên nào nên parse trả **null**, và app **bỏ qua**: không hiện chữ, không đọc. Thiết kế này tránh đọc nhầm một câu sai cho người chăm sóc. Firmware mới chỉ gửi đúng 5 từ, nên trường hợp này chủ yếu xảy ra với firmware lạ hoặc app cũ.",
          keyPoints: ['trim + viết hoa + valueOf', 'Chữ lạ → null → bỏ qua', 'Không đọc sai còn hơn đọc nhầm'],
          explanation: 'Có thể chỉ vào dòng `catch (IllegalArgumentException e) { return null; }`.' },
        { type: "flashcard", id: "u07.l1.q9", topic: "Android", prompt: "Giám khảo hỏi: \"Muốn đổi câu “Tôi muốn ăn.” thành câu khác thì sửa ở đâu? Có phải nạp lại vòng tay không?\"",
          modelAnswer: "Chỉ sửa **app**. Năm câu nằm trong enum `GestureCommand.java`: mỗi dòng gồm tên lệnh như `FOOD`, câu đọc \"Tôi muốn ăn.\", nhãn và màu nút. Em đổi chữ trong ngoặc rồi build lại app. Vòng tay **không cần nạp lại**, vì nó chỉ gửi chữ `FOOD`, không biết câu tiếng Việt là gì. Đây là lợi ích của việc tách cử chỉ khỏi câu nói. Còn muốn **thêm lệnh thứ sáu** thì phải sửa cả hai bên: firmware nhận cử chỉ mới và gửi tên mới, app thêm một dòng vào enum; app cũ gặp tên lạ sẽ bỏ qua.",
          keyPoints: ["Câu nằm trong enum GestureCommand của app", "Đổi câu: chỉ build lại app", "Vòng tay chỉ gửi chữ FOOD, không cần nạp lại", "Thêm lệnh mới: sửa cả firmware và app"],
          explanation: "Mở `GestureCommand.java` cho giám khảo xem năm dòng enum." },
      ],
    },

    // ───────────────────────── L2 ─────────────────────────
    {
      id: 'l2',
      title: 'Đọc thành tiếng: Text-to-Speech',
      minutes: 10,
      goal: 'Sau bài này, em giải thích được TTS tiếng Việt, tốc độ 0,9 và vì sao câu mới cắt câu cũ.',
      steps: [
        { type: 'video', id: 'v-app-tts', title: 'Ứng dụng nhận lệnh và đọc thành tiếng',
          caption: 'Xem app nhận lệnh, hiểu lệnh, hiện chữ và đọc thành tiếng, kể cả khi lệnh mới đến lúc đang đọc.',
          fallbackSim: { sim: 'tts-pipeline', props: { command: 'WATER', showQueueFlush: true } } },
        { type: 'text', title: 'Giọng đọc có sẵn trong Android',
          body: 'App dùng bộ máy [[TTS]] có sẵn của Android, đặt ngôn ngữ `vi-VN` và tốc độ `0.9`, chậm hơn bình thường một chút cho dễ nghe. Nếu điện thoại chưa có giọng tiếng Việt, app báo rõ và hướng dẫn mở Cài đặt giọng đọc để tải.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/MainActivity.java',
          code: 'int language = speech.setLanguage(Locale.forLanguageTag("vi-VN"));\nif (language < TextToSpeech.LANG_AVAILABLE) {\n    speechStatus.setText("Chưa có giọng tiếng Việt. Mở Cài đặt giọng đọc, chọn hoặc tải tiếng Việt rồi bấm Kiểm tra lại.");\n    return;\n}\nspeech.setAudioAttributes(speechAudio);\nspeech.setSpeechRate(0.9f);',
          highlight: [1, 7],
          caption: 'Chọn tiếng Việt; thiếu giọng thì báo và dừng. Có giọng thì đặt tốc độ 0,9.' },
        { type: 'sim', sim: 'tts-pipeline', props: { command: 'WATER', allowPick: true, showQueueFlush: true },
          caption: 'Bật mô phỏng hai lệnh liên tiếp: lệnh thứ hai đến khi câu đầu đang đọc dở. Nhờ [[QUEUE_FLUSH]], câu cũ bị cắt và câu mới được đọc ngay.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/MainActivity.java',
          code: 'private void speakCurrent() {\n    if (!speechReady || current == null) return;\n    activeUtterance = "command-" + System.nanoTime();\n    speechStatus.setText("Đang chuẩn bị đọc…");\n    stop.setEnabled(true);\n    if (audio != null) audio.requestAudioFocus(focus);\n    if (speech.speak(current.phrase, TextToSpeech.QUEUE_FLUSH, null, activeUtterance) == TextToSpeech.ERROR) {\n        activeUtterance = null;\n        releaseFocus();\n        stop.setEnabled(false);\n        speechStatus.setText("Không phát được âm thanh. Hãy kiểm tra lại giọng đọc.");\n    }\n}',
          highlight: [6, 7],
          caption: 'Xin [[tiêu điểm âm thanh]] rồi đọc câu với QUEUE_FLUSH. Lỗi thì trả lại tiêu điểm và báo trên màn hình.',
          notes: [
            { lines: [6, 6], note: 'Xin nói tạm thời và cho phép app khác nhỏ tiếng lại (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK). Đọc xong thì trả lại.' },
            { lines: [7, 7], note: 'QUEUE_FLUSH: câu mới thay câu đang đọc, không xếp hàng.' },
          ] },
        { type: 'mcq', id: 'u07.l2.q1', prompt: 'Đang đọc dở "Tôi muốn uống nước." thì lệnh FOOD tới. App làm gì?',
          visual: { kind: 'sim', sim: 'tts-pipeline', props: { command: 'WATER', showQueueFlush: true } },
          options: ['Dừng câu cũ, đọc ngay "Tôi muốn ăn."', 'Đọc hết câu cũ rồi mới đọc câu mới', 'Bỏ qua FOOD', 'Đọc hai câu cùng lúc'],
          answer: 0,
          explanation: '`QUEUE_FLUSH` xoá hàng đợi và cắt câu đang đọc. Người dùng vừa đổi ý thì người nghe nhận ngay ý mới nhất, không phải chờ.' },
        { type: 'flashcard', id: 'u07.l2.q8', topic: 'TTS', prompt: 'Giám khảo hỏi: "Sao lệnh mới lại cắt ngang câu đang đọc? Đọc hết câu cũ rồi mới đọc câu mới không tốt hơn sao?"',
          modelAnswer: "Câu **mới nhất** mới là điều người dùng muốn nói **bây giờ**. Nếu xếp hàng, người dùng vừa ra hiệu NO để sửa một lệnh nhầm, hay ra hiệu HELP, vẫn phải chờ câu cũ đọc xong. App gọi `speak(..., QUEUE_FLUSH, ...)`: câu mới xoá hàng đợi và thay câu đang đọc. Câu cũ vẫn còn trong mục **Tùy chọn → Lệnh gần đây** (5 lệnh mới nhất), và nút Đọc lại đọc lại câu gần nhất nếu người chăm sóc nghe chưa rõ. Vòng tay còn nghỉ 650 ms và phải về trung tính giữa hai lệnh, nên câu không bị cắt liên tục.",
          keyPoints: ["Câu mới nhất là nhu cầu hiện tại", "HELP hay NO không phải chờ", "QUEUE_FLUSH thay câu đang đọc", "Câu cũ vẫn ở mục Lệnh gần đây, có nút Đọc lại"],
          explanation: 'Mô phỏng hai lệnh liên tiếp ở trên cho thấy đúng hành vi này.' },
        { type: 'number', id: 'u07.l2.q2', prompt: 'App đặt tốc độ đọc (`setSpeechRate`) là bao nhiêu? (1 là tốc độ bình thường)',
          answer: 0.9, tolerance: 0, unit: '×',
          explanation: '`setSpeechRate(0.9f)`: chậm hơn bình thường 10%, giúp người lớn tuổi hay người đang mệt nghe rõ hơn.' },
        { type: 'truefalse', id: 'u07.l2.q3', prompt: 'Khi đang mở nhạc, BandW đọc câu thì nhạc bị tắt hẳn và không bật lại.',
          answer: false,
          explanation: 'App chỉ xin tiêu điểm âm thanh **tạm thời** và cho phép nhạc nhỏ lại. Đọc xong hoặc dừng đọc, app trả lại tiêu điểm (`releaseFocus()`).' },
        { type: 'order', id: 'u07.l2.q4', prompt: 'Sắp xếp những việc `receiveCommand()` làm sau khi parse thành công.',
          items: ['Hiện câu nói lên thẻ lớn', 'Hiện nhãn cử chỉ và nguồn', 'Thêm vào lịch sử 5 lệnh', 'Nếu bật tự động đọc thì đọc thành tiếng'],
          explanation: 'Câu hiện lên trước để người chăm sóc nhìn thấy ngay, lịch sử ghi lại, rồi mới đọc nếu công tắc "Tự động đọc" đang bật.' },
        { type: 'mcq', id: 'u07.l2.q5', prompt: 'Điện thoại **chưa** có giọng tiếng Việt. App làm gì?',
          options: ['Báo "Chưa có giọng tiếng Việt…" và hướng dẫn mở Cài đặt giọng đọc để tải', 'Tự đọc bằng giọng tiếng Anh', 'Tự tải giọng từ máy chủ BandW', 'Tắt luôn app'],
          answer: 0,
          explanation: 'App kiểm tra `setLanguage` và báo rõ ràng. Có sẵn nút "Cài đặt giọng đọc" và "Kiểm tra lại giọng đọc" trong phần Tùy chọn.' },
        { type: 'flashcard', id: 'u07.l2.q9', topic: 'TTS', prompt: 'Giám khảo hỏi: "Giọng máy đọc có rõ không? Ở chỗ ồn, người chăm sóc có nghe được không?"',
          modelAnswer: 'Giọng phụ thuộc bộ máy đọc tiếng Việt cài trên điện thoại, mỗi hãng nghe một khác. App đặt tốc độ **0,9** cho chậm hơn một chút, và xin tiêu điểm âm thanh để nhạc đang mở **nhỏ lại** trong lúc đọc. Nếu vẫn không nghe rõ, câu đã hiện **chữ to** trên thẻ lời nhắn và có nút đọc lại. Nhóm **chưa đo** độ dễ nghe. Cách đo: mời vài người nghe ở phòng yên và phòng ồn, ở vài khoảng cách, ghi số lần họ nghe đúng câu.',
          keyPoints: ['Giọng tùy bộ máy đọc trên máy', 'Tốc độ 0,9, nhạc nhỏ lại khi đọc', 'Có chữ to và nút đọc lại', 'Chưa đo, nêu cách đo'],
          explanation: 'Trả lời bằng cả âm thanh lẫn hình ảnh: người chăm sóc có hai kênh để nhận tin.' },
        { type: 'hotspot', id: 'u07.l2.q6', prompt: 'Chạm vào khâu biến **chữ** thành **âm thanh**.',
          target: { kind: 'diagram', name: 'tts-chain' }, answer: 'tts',
          explanation: 'TextToSpeech nhận câu "Tôi muốn uống nước." và tạo ra giọng nói, sau đó loa phát ra.' },
        { type: 'flashcard', id: 'u07.l2.q7', topic: "An toàn, riêng tư, đạo đức & chi phí", prompt: 'Giám khảo hỏi: "Giọng đọc lấy từ đâu? Có cần Internet không?"',
          modelAnswer: "Giọng đọc là bộ máy **TextToSpeech có sẵn của Android**, ngôn ngữ `vi-VN`, tốc độ 0,9. Có cần mạng hay không **tùy giọng** mà điện thoại đang dùng; nhóm khuyên tải giọng tiếng Việt ngoại tuyến (offline) để không phụ thuộc Internet. Nếu thiếu giọng, app báo và hướng dẫn tải. Nếu điện thoại không có giọng tiếng Việt, app báo rõ và có nút mở cài đặt giọng đọc.",
          keyPoints: ['TTS có sẵn của Android, vi-VN', 'Tốc độ 0,9', 'Tùy giọng; nên tải giọng offline', 'Thiếu giọng thì app báo rõ'],
          explanation: 'Đừng khẳng định "không bao giờ cần mạng": điều đó phụ thuộc giọng đọc trên từng máy.' },
        { type: "flashcard", id: "u07.l2.q10", topic: "TTS", prompt: "Giám khảo hỏi: \"Trong app có công tắc “Tự động đọc khi nhận lệnh”. Tắt nó đi thì sao? Sao lại cần?\"",
          modelAnswer: "Mặc định công tắc **bật**: nhận lệnh là đọc ngay. Tắt đi thì app **vẫn nhận lệnh**, vẫn hiện câu bằng chữ lớn và thêm vào mục Lệnh gần đây, chỉ **không phát tiếng**; muốn nghe thì bấm **Đọc lại**. Lúc tắt, câu đang đọc cũng dừng ngay. App ghi nhớ lựa chọn này cho lần mở sau, và khi không tự đọc thì vùng chữ được đánh dấu để trình đọc màn hình báo câu mới. Công tắc này hữu ích ở nơi cần yên tĩnh, ví dụ ban đêm trong phòng bệnh, khi người chăm sóc chỉ cần nhìn màn hình.",
          keyPoints: ["Mặc định bật: nhận lệnh là đọc", "Tắt: vẫn nhận và hiện câu, không phát tiếng", "Bấm Đọc lại để nghe; lựa chọn được ghi nhớ", "Dùng khi cần yên tĩnh"],
          explanation: "Công tắc nằm trong Tùy chọn; biến `autoSpeak` trong `MainActivity` lưu lựa chọn." },
      ],
    },

    // ───────────────────────── L3 ─────────────────────────
    {
      id: 'l3',
      title: 'Giao diện cho người dùng và người chăm sóc',
      minutes: 9,
      goal: 'Sau bài này, em chỉ được trên màn hình app từng nút làm gì và giải thích chế độ Demo.',
      steps: [
        { type: 'sim', sim: 'system-flow', props: { gesture: 'cycle', focus: 'phone' },
          caption: 'Điện thoại là nơi lệnh trở thành chữ và tiếng. Bấm ▶ để xem lần lượt cả 5 lệnh đến điện thoại.' },
        { type: 'diagram', title: 'Màn hình app BandW (vẽ giản lược)', svg: phoneSvg(),
          caption: 'Thẻ lớn hiện câu vừa nhận, có nút Đọc lại. Phần Tùy chọn có công tắc tự động đọc và 5 lệnh gần đây.',
          alt: 'Màn hình điện thoại: nút Demo, nút Kết nối vòng tay, nút Hiệu chuẩn, thẻ lời nhắn "Tôi muốn uống nước." với nút Đọc lại, nút Dừng đọc, công tắc Tự động đọc và danh sách lệnh gần đây.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/MainActivity.java',
          code: 'private void receiveCommand(String raw, String source) {\n    GestureCommand command = GestureCommand.parse(raw);\n    if (command == null) return;\n    current = command;\n    phraseView.setText(command.phrase);\n    commandView.setText(command.label + " · " + source);\n    String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());\n    history.add(0, time + "   ·   " + command.name() + " · " + source + "\\n" + command.phrase);\n    if (history.size() > 5) history.remove(history.size() - 1);\n    renderHistory();\n    replay.setEnabled(speechReady);\n    if (autoSpeak) speakCurrent();\n}',
          highlight: [8, 9],
          caption: 'Lệnh mới được chèn lên đầu lịch sử kèm giờ. Quá 5 dòng thì xoá dòng cũ nhất.',
          notes: [{ lines: [6, 6], note: 'source là "Vòng tay" hoặc "Mô phỏng", để người chăm sóc biết lệnh đến từ đâu.' }] },
        { type: 'text', title: 'Chế độ Demo',
          body: 'Nút **Demo** góc trên trái mở 5 nút mô phỏng để trình diễn hay tập luyện khi không có vòng tay, và các nút này đi **đúng cùng đường** `receiveCommand()` như lệnh BLE.\n\n>! Trong [[chế độ Demo]], lệnh thật từ vòng tay bị bỏ qua để hai nguồn không lẫn nhau.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/MainActivity.java',
          code: 'public void command(String value) {\n    if (!demoMode) { receiveCommand(value, "Vòng tay"); return; }\n    GestureCommand ignored = GestureCommand.parse(value);\n    if (ignored != null) commandView.setText("Demo mode · Bỏ qua " + ignored.label + " từ vòng tay");\n}',
          highlight: [2],
          caption: 'Không ở Demo thì xử lý bình thường. Ở Demo thì chỉ hiện dòng nhỏ báo đã bỏ qua lệnh từ vòng tay.' },
        { type: 'hotspot', id: 'u07.l3.q1', prompt: 'Người chăm sóc nghe không rõ. Chạm vào nút để **đọc lại** câu gần nhất.',
          target: { kind: 'diagram', svg: phoneSvg() }, answer: 'replay',
          explanation: 'Nút "Đọc lại" nằm ngay trong thẻ lời nhắn và gọi lại `speakCurrent()` với câu hiện tại.' },
        { type: 'hotspot', id: 'u07.l3.q2', prompt: 'Chạm vào chỗ xem được **các lệnh đã nhận trước đó**.',
          target: { kind: 'diagram', svg: phoneSvg() }, answer: 'history',
          explanation: 'Mục "LỆNH GẦN ĐÂY" trong Tùy chọn giữ tối đa 5 lệnh, mỗi dòng có giờ, tên lệnh và nguồn.' },
        { type: 'number', id: 'u07.l3.q3', prompt: 'Lịch sử trong app giữ tối đa bao nhiêu lệnh?',
          answer: 5, tolerance: 0, unit: 'lệnh',
          explanation: '`if (history.size() > 5) history.remove(history.size() - 1);` nên luôn còn tối đa 5 dòng.' },
        { type: 'truefalse', id: 'u07.l3.q4', prompt: 'Lịch sử lệnh được gửi lên máy chủ để người nhà xem từ xa.',
          answer: false,
          explanation: 'Lịch sử chỉ nằm trong bộ nhớ của app trên điện thoại. App không có máy chủ và không gửi dữ liệu lên mạng.' },
        { type: 'flashcard', id: 'u07.l3.q8', topic: 'Pin', prompt: 'Giám khảo hỏi: "Giữ màn hình sáng và chạy nền suốt thì điện thoại có nhanh hết pin không?"',
          modelAnswer: 'Có tốn hơn, và em nói thẳng đó là **đánh đổi** nhóm chọn. Lỗi cũ "ngắt sau 3 câu" xảy ra đúng lúc màn hình tự tắt, nên bản 0.5.0 ưu tiên **không mất lệnh**: khi đang dùng vòng tay, app bật `FLAG_KEEP_SCREEN_ON` và chạy dịch vụ nền `BandLinkService`. Màn hình sáng thường là phần tốn pin nhất. Nhóm **chưa đo** điện thoại tụt bao nhiêu phần trăm mỗi giờ; cách đo là sạc đầy, kết nối liên tục, ghi % pin mỗi 30 phút. Hướng cải tiến: cho phép tắt giữ sáng khi đã chắc dịch vụ nền đủ ổn định.',
          keyPoints: ['Có tốn hơn: đánh đổi để không mất lệnh', 'FLAG_KEEP_SCREEN_ON và BandLinkService', 'Chưa đo; cách đo % pin theo thời gian', 'Cải tiến: tuỳ chọn tắt giữ sáng'],
          explanation: 'Thừa nhận cái giá của một quyết định thiết kế là dấu hiệu hiểu sâu.' },
        { type: 'predict', id: 'u07.l3.q5', language: 'java', prompt: 'App đang ở chế độ Demo (`demoMode = true`) và vòng tay gửi `WATER`. Kết quả là gì?',
          code: 'if (!demoMode) { receiveCommand(value, "Vòng tay"); return; }\nGestureCommand ignored = GestureCommand.parse(value);\nif (ignored != null) commandView.setText("Demo mode · Bỏ qua " + ignored.label + " từ vòng tay");',
          highlight: [1, 3],
          options: ['App đọc "Tôi muốn uống nước."', 'Chỉ hiện dòng "Demo mode · Bỏ qua ← Nghiêng tay trái từ vòng tay", không đọc', 'App tự thoát chế độ Demo', 'App báo lỗi kết nối'],
          answer: 1,
          explanation: '`!demoMode` là sai nên không gọi `receiveCommand`. App chỉ ghi chú là đã bỏ qua, không đổi câu, không đọc.' },
        { type: 'mcq', id: 'u07.l3.q6', prompt: 'Khi bật "Tự động đọc", app tắt chế độ đọc tự động của [[TalkBack]] cho thẻ câu nói. Vì sao?',
          options: ['Để TalkBack và giọng TTS không đọc cùng một câu hai lần', 'Để tiết kiệm pin', 'Vì TalkBack không đọc được tiếng Việt', 'Để giấu câu khỏi người khiếm thị'],
          answer: 0,
          hint: 'Nếu cả hai cùng đọc thì người nghe sẽ nghe gì?',
          explanation: 'Hàm `phraseLiveRegion()` chỉ để TalkBack tự đọc khi **tắt** tự động đọc. Bật thì TTS đã đọc rồi, tránh đọc trùng.' },
        { type: 'flashcard', id: 'u07.l3.q7', topic: "App Android & giọng nói", prompt: 'Giám khảo hỏi: "Tắt màn hình điện thoại thì app còn nhận lệnh không?"',
          modelAnswer: 'Ở **phiên bản mới** (app 0.5.0), app chạy một [[dịch vụ nền]] `BandLinkService` với thông báo "BandW đang lắng nghe vòng tay", và giữ màn hình sáng khi đang kết nối, nên tắt màn hình hay bấm Home vẫn nhận và đọc lệnh. Bản cũ 0.3.0/0.4.0 bị ngắt khi khoá màn hình. Nhóm nên tự thử trên đúng điện thoại sẽ mang đi thi.',
          keyPoints: ['Phiên bản mới có dịch vụ nền', 'Thông báo "BandW đang lắng nghe vòng tay"', 'Bản cũ bị ngắt khi khoá màn hình', 'Tự thử trên máy thật'],
          explanation: 'Phân biệt rõ bản cũ và bản mới; đây là chỗ code vừa được sửa.' },
        { type: 'flashcard', id: 'u07.l3.q9', topic: 'Android', prompt: 'Giám khảo hỏi: "Nếu người dùng vuốt tắt app khỏi danh sách ứng dụng gần đây thì sao?"',
          modelAnswer: 'Khi đó kết nối **dừng**. Trong `AndroidManifest.xml`, `BandLinkService` khai báo `stopWithTask="true"`, nên vuốt tắt app thì dịch vụ nền dừng theo, và khi màn hình bị huỷ, `onDestroy()` gọi `ble.release()` để trả Bluetooth gọn gàng. Nhóm chọn vậy để người dùng luôn **tắt được** app khi muốn, không có gì chạy ngầm mãi. Vòng tay không sao: mất kết nối thì nó quảng bá lại, mở app và bấm Kết nối là dùng tiếp. Hạn chế: người chăm sóc cần được dặn không vuốt tắt app khi người dùng đang cần.',
          keyPoints: ['stopWithTask="true": dịch vụ dừng theo app', 'onDestroy() gọi ble.release()', 'Người dùng luôn tắt được app', 'Vòng tay quảng bá lại, mở app là nối tiếp'],
          explanation: 'Phân biệt "tắt màn hình" (vẫn chạy) với "vuốt tắt app" (dừng hẳn).' },
        { type: "flashcard", id: "u07.l3.q10", topic: "Android", prompt: "Giám khảo hỏi: \"Người chăm sóc vừa ra ngoài, quay lại thì xem người bệnh đã yêu cầu gì ở đâu?\"",
          modelAnswer: "Màn hình chính luôn hiện **câu gần nhất** bằng chữ lớn, có nút **Đọc lại**. Các lệnh trước đó nằm trong mục **Tùy chọn → Lệnh gần đây**: app giữ **5 lệnh** mới nhất, mỗi dòng có giờ, tên lệnh, nguồn và câu đọc. Lịch sử chỉ giữ trong phiên dùng, xoay màn hình vẫn còn, và **không lưu lên máy chủ**. Hạn chế: phải bấm Tùy chọn mới thấy và chỉ có 5 dòng. Nếu người chăm sóc cần xem lâu hơn thì đó là tính năng nên thêm, kèm câu hỏi về quyền riêng tư.",
          keyPoints: ["Màn hình chính: câu gần nhất, nút Đọc lại", "Lệnh cũ ở Tùy chọn → Lệnh gần đây", "Giữ 5 lệnh mới nhất, có giờ", "Chỉ trong phiên, không lưu lên máy chủ"],
          explanation: "Mục \"LỆNH GẦN ĐÂY\" ẩn trong bảng Tùy chọn của `MainActivity`." },
      ],
    },

    // ───────────────────────── L4 ─────────────────────────
    {
      id: 'l4',
      title: 'Quyền và riêng tư trên điện thoại',
      minutes: 8,
      goal: 'Sau bài này, em giải thích được vì sao app xin quyền Bluetooth hay Vị trí, và dữ liệu không rời khỏi điện thoại.',
      steps: [
        { type: 'sim', sim: 'code-stepper', title: 'App xin quyền gì?',
          props: {
            language: 'java', title: 'Mã rút gọn từ BandBleClient.permissions()', visual: 'branch',
            code: 'int sdk = 29;            // Android 10\nString need;\nif (sdk >= 31) {\n    need = "Thiết bị ở gần";\n} else {\n    need = "Vị trí";\n}',
            steps: [
              { line: 1, vars: { sdk: 29 }, note: 'Điện thoại chạy Android 10 (mã phiên bản 29).' },
              { line: 2, vars: { need: '?' } },
              { line: 3, cond: { expr: 'sdk >= 31', value: false }, note: '29 nhỏ hơn 31 nên đi nhánh else.' },
              { line: 6, vars: { need: 'Vị trí' }, note: 'Android 8–11 bắt buộc quyền Vị trí mới quét được BLE.' },
            ],
          },
          caption: 'Bấm ⏭ để xem nhánh nào sáng lên. Android 12 trở lên (mã 31) hỏi quyền "Thiết bị ở gần", máy cũ hơn hỏi quyền Vị trí.' },
        { type: 'code', language: 'java', source: 'app/src/main/java/com/bandw/demo/BandBleClient.java',
          code: 'private String[] permissions() {\n    return Build.VERSION.SDK_INT >= 31\n            ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}\n            : new String[]{Manifest.permission.ACCESS_FINE_LOCATION};\n}',
          highlight: [2],
          caption: 'Code thật: chỉ xin đúng các [[quyền]] cần cho Bluetooth, tùy phiên bản Android.' },
        { type: 'text', title: 'Vì sao lại là "Vị trí"?',
          body: 'Trên Android 8–11, hệ điều hành bắt app phải có quyền Vị trí mới được quét BLE, dù BandW không hề đọc vị trí. Từ Android 12, app khai báo quét Bluetooth "không dùng để định vị" (`neverForLocation`). Quyền thông báo trên Android 13 là tuỳ chọn, từ chối thì BLE vẫn chạy.' },
        { type: 'diagram', title: 'Dữ liệu đi đâu?', svg: dataFlowSvg(),
          caption: 'Dữ liệu chỉ đi từ vòng tay sang điện thoại rồi ra loa. Không có máy chủ, không micro, không camera.',
          alt: 'Sơ đồ: vòng tay gửi "WATER" qua BLE tới điện thoại, điện thoại phát giọng đọc ra loa. Phía trên là máy chủ Internet bị chặn bởi đường gạch đỏ ghi "Không gửi dữ liệu cử chỉ lên mạng".' },
        { type: 'flashcard', id: 'u07.l4.q7', topic: 'Offline', prompt: 'Giám khảo hỏi: "Em nói BandW không cần Internet. Em chứng minh điều đó thế nào?"',
          modelAnswer: "Bằng chứng chắc nhất nằm trong code: `AndroidManifest.xml` **không xin quyền INTERNET**, nên chính app BandW không thể gửi gì lên mạng; lệnh đi thẳng từ vòng tay sang điện thoại qua BLE, không qua máy chủ nào. Bằng chứng thứ hai là một phép thử trên máy thật, nhóm sẽ làm khi chạy trọn hệ thống: bật **chế độ máy bay**, bật lại riêng Bluetooth, kết nối vòng tay và làm đủ 5 cử chỉ. Riêng giọng đọc là bộ máy của Android, có giọng cần mạng, nên phải cài sẵn **giọng tiếng Việt ngoại tuyến**.",
          keyPoints: ['Manifest không có quyền INTERNET', 'BLE nối thẳng, không máy chủ', 'Thử ở chế độ máy bay, bật lại Bluetooth', 'Cài sẵn giọng tiếng Việt ngoại tuyến'],
          explanation: "Khi đã làm phép thử chế độ máy bay, quay video làm bằng chứng và nói \"đã thử\" kèm ngày thử." },
        { type: 'mcq', id: 'u07.l4.q1', prompt: 'Vì sao trên Android 10, app BandW lại xin quyền **Vị trí**?',
          options: ['Vì Android 8–11 yêu cầu quyền này để quét thiết bị BLE', 'Vì app gửi vị trí người dùng cho người nhà', 'Vì cần GPS để đo góc nghiêng', 'Vì Wi-Fi cần vị trí'],
          answer: 0,
          explanation: 'Đây là quy định của hệ điều hành cho việc quét BLE. App không đọc hay lưu vị trí. Code còn nhắc người dùng bật dịch vụ Vị trí trên Android 8–11.' },
        { type: 'truefalse', id: 'u07.l4.q2', prompt: 'App BandW ghi âm người dùng để hiểu lệnh.',
          answer: false,
          explanation: 'App không xin quyền micro. Lệnh đến từ cử chỉ cổ tay qua BLE; README cũng ghi rõ "Không sử dụng microphone".' },
        { type: 'multi', id: 'u07.l4.q3', prompt: 'Chọn **tất cả** những thứ BandW **không** dùng.',
          options: ['Micro', 'Camera', 'Máy chủ lưu dữ liệu trên Internet', 'Bluetooth', 'Loa điện thoại'],
          answers: [0, 1, 2],
          explanation: 'BandW cần Bluetooth để nhận lệnh và loa để đọc. Không có micro, camera hay máy chủ.' },
        { type: 'hotspot', id: 'u07.l4.q4', prompt: 'Chạm vào nơi mà dữ liệu cử chỉ **không bao giờ** được gửi tới.',
          target: { kind: 'diagram', svg: dataFlowSvg() }, answer: 'cloud',
          explanation: 'App không có máy chủ. Lệnh chỉ đi vòng tay → điện thoại → loa, lịch sử 5 lệnh chỉ nằm trong app.' },
        { type: 'truefalse', id: 'u07.l4.q5', prompt: 'Trên Android 13, nếu người dùng từ chối quyền **thông báo**, vòng tay vẫn kết nối và đọc lệnh được.',
          answer: true,
          hint: 'Đọc ghi chú trong code: "Optional … never blocks BLE".',
          explanation: 'Quyền thông báo chỉ để hiện dòng "đã kết nối". Code ghi rõ quyền này là tuỳ chọn và không bao giờ chặn BLE.' },
        { type: 'flashcard', id: 'u07.l4.q8', topic: 'Android', prompt: 'Giám khảo hỏi: "Nếu người dùng bấm từ chối cấp quyền Bluetooth thì app làm gì?"',
          modelAnswer: 'App **không treo, không tự thoát**. Nếu chỉ từ chối một lần, app báo "Chưa cấp quyền tìm vòng tay" và vẫn cho dùng **các nút mô phỏng** để luyện tập. Nếu quyền đã bị chặn hẳn, app hiện hộp thoại giải thích vì sao cần quyền **Thiết bị lân cận** và mở giúp trang Cài đặt. App chỉ xin đúng quyền cần cho Bluetooth theo từng phiên bản: Android 12 trở lên là Thiết bị lân cận, Android 8–11 là Vị trí do hệ điều hành bắt buộc khi quét BLE. Từ chối quyền thông báo thì vẫn kết nối được.',
          keyPoints: ['Không treo, báo rõ trạng thái', 'Vẫn dùng được nút mô phỏng', 'Bị chặn hẳn: hộp thoại mở Cài đặt', 'Chỉ xin quyền Bluetooth cần thiết'],
          explanation: 'Các dòng báo lỗi này nằm trong `BandBleClient.java`, phần xử lý kết quả xin quyền.' },
        { type: 'flashcard', id: 'u07.l4.q6', topic: "App Android & giọng nói", prompt: 'Giám khảo hỏi: "App có thu thập dữ liệu cá nhân của người dùng không?"',
          modelAnswer: '**Không.** App không dùng micro, camera, không có máy chủ, không gửi gì lên mạng. Dữ liệu duy nhất đi qua BLE là một từ lệnh như `WATER`. Lịch sử 5 lệnh gần nhất chỉ nằm trong app trên điện thoại. Quyền Vị trí trên Android 8–11 là do hệ điều hành bắt buộc khi quét BLE, app không đọc vị trí.',
          keyPoints: ['Không micro, không camera', 'Không máy chủ, không gửi lên mạng', 'Chỉ một từ lệnh qua BLE', 'Quyền Vị trí là quy định Android'],
          explanation: 'Có thể chỉ vào sơ đồ "Dữ liệu đi đâu?" khi trả lời.' },
        { type: "flashcard", id: "u07.l4.q9", topic: "Android", prompt: "Giám khảo hỏi: \"Sao lúc kết nối vòng tay, điện thoại luôn hiện thông báo “BandW đang lắng nghe vòng tay”?\"",
          modelAnswer: "Để vẫn nhận lệnh khi tắt màn hình, app chạy một **dịch vụ nền** `BandLinkService`, và Android **bắt buộc** dịch vụ kiểu này phải hiện thông báo thường trực, để người dùng luôn biết có app đang chạy. Với BandW, đó cũng là điều tốt: người chăm sóc nhìn là biết vòng tay còn được lắng nghe. Thông báo để mức quan trọng thấp nên **không kêu**, chạm vào thì mở lại app. Khi người dùng ngắt kết nối, dịch vụ dừng và thông báo biến mất. Nếu Android không cho chạy nền, kết nối vẫn chạy khi app đang mở.",
          keyPoints: ["Dịch vụ nền BandLinkService giữ kết nối khi tắt màn hình", "Android bắt buộc dịch vụ nền hiện thông báo", "Thông báo không kêu, chạm để mở app", "Ngắt kết nối thì dịch vụ dừng"],
          explanation: "Kiểu dịch vụ là \"thiết bị đã kết nối\" (connectedDevice), khai báo trong `BandLinkService.java`." },
      ],
    },
  ],
  defense: [
    { type: 'flashcard', id: 'u07.d.q1', prompt: 'Giám khảo hỏi: "Sao chỉ làm app Android, không có iPhone?"',
      modelAnswer: 'Nhóm chọn Android vì có sẵn thiết bị, công cụ miễn phí và cài thử APK dễ dàng. Phần vòng tay dùng BLE chuẩn nên về nguyên tắc iPhone cũng kết nối được; làm app iOS là hướng phát triển.',
      keyPoints: ['Điều kiện thiết bị và công cụ', 'BLE là chuẩn chung', 'iOS là hướng phát triển'],
      explanation: 'Nói lý do thực tế, không chê hệ điều hành khác.' },
    { type: 'flashcard', id: 'u07.d.q2', prompt: 'Giám khảo hỏi: "Không có điện thoại thì BandW dùng được không?"',
      modelAnswer: 'Hiện tại **chưa**: điện thoại đảm nhận phần hiện chữ và đọc thành tiếng. Đổi lại, nhóm tận dụng thiết bị người dùng đã có nên vòng tay rẻ và nhỏ. Hướng phát triển là gắn loa nhỏ hoặc màn hình trên vòng tay.',
      keyPoints: ['Hiện cần điện thoại', 'Tận dụng thiết bị có sẵn', 'Hướng phát triển: loa trên vòng tay'],
      explanation: 'Thừa nhận phụ thuộc rồi nêu lý do thiết kế.' },
    { type: 'flashcard', id: 'u07.d.q3', prompt: 'Giám khảo hỏi: "Từ lúc làm cử chỉ đến lúc nghe tiếng mất bao lâu?"',
      modelAnswer: 'Gồm nhiều phần: thời gian giữ cử chỉ theo luật (ví dụ nghiêng cần giữ 250 ms sau khi tay đã lắng), thời gian gửi BLE, và thời gian TTS bắt đầu đọc. Nếu chưa đo thì không đưa số. Cách đo: quay video có cả tay và tiếng, đếm số khung hình từ lúc bắt đầu cử chỉ đến lúc nghe tiếng, chia cho số khung hình mỗi giây.',
      keyPoints: ['Giữ cử chỉ + gửi BLE + TTS', 'Chưa đo thì không đưa số', 'Đo bằng quay video, đếm khung hình'],
      explanation: 'Chương 8 (bài "Trình bày kết quả trung thực") có bài tập tính thời gian phản hồi từ số khung hình.' },
  ],
};
