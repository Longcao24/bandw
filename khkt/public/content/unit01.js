// public/content/unit01.js — Chương 1: Vấn đề & ý tưởng (Writer #1)
// Số liệu lấy từ firmware/BandW_Sense/GestureDetector.h, BandW_Sense.ino, app/.../GestureCommand.java và README.

const SVG_COMIC = `<svg viewBox="0 0 640 270" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <g>
    <rect x="8" y="8" width="148" height="254" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <text x="82" y="36" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">1. Khát nước</text>
    <text x="82" y="120" text-anchor="middle" font-size="56">🥤</text>
    <text x="82" y="180" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">Bác Hoà nằm viện,</text>
    <text x="82" y="200" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">cổ họng khô.</text>
  </g>
  <g>
    <rect x="166" y="8" width="148" height="254" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <text x="240" y="36" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">2. Khó nói</text>
    <text x="240" y="120" text-anchor="middle" font-size="56">😶</text>
    <text x="240" y="180" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">Hiểu hết mọi chuyện</text>
    <text x="240" y="200" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">nhưng không nói</text>
    <text x="240" y="220" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">thành lời được.</text>
  </g>
  <g>
    <rect x="324" y="8" width="148" height="254" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <text x="398" y="36" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">3. Cử động</text>
    <text x="398" y="120" text-anchor="middle" font-size="56">🤚</text>
    <text x="398" y="160" text-anchor="middle" font-size="22" style="fill:var(--c-primary)">← nghiêng</text>
    <text x="398" y="190" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">Nghiêng cổ tay trái,</text>
    <text x="398" y="210" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">giữ một chút.</text>
  </g>
  <g>
    <rect x="482" y="8" width="150" height="254" rx="12" style="fill:var(--c-primary-soft);stroke:var(--c-primary)"/>
    <text x="557" y="36" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">4. Điện thoại nói</text>
    <text x="557" y="120" text-anchor="middle" font-size="56">📱</text>
    <text x="557" y="170" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">“Tôi muốn</text>
    <text x="557" y="192" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">uống nước.”</text>
    <text x="557" y="226" text-anchor="middle" font-size="22">🔊</text>
  </g>
</svg>`;

const SVG_OPTIONS = `<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <g data-hotspot="camera" data-label="Camera quay cử chỉ">
    <rect x="8" y="8" width="200" height="284" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <text x="108" y="40" text-anchor="middle" font-size="17" font-weight="700" style="fill:var(--c-text)">Camera</text>
    <text x="108" y="100" text-anchor="middle" font-size="48">📷</text>
    <text x="24" y="150" font-size="14" style="fill:var(--c-text)">✗ Quay hình người dùng</text>
    <text x="24" y="178" font-size="14" style="fill:var(--c-text)">✗ Cần đủ ánh sáng</text>
    <text x="24" y="206" font-size="14" style="fill:var(--c-text)">✗ Phải đặt cố định</text>
    <text x="24" y="234" font-size="14" style="fill:var(--c-text)">✗ Xử lý ảnh nặng</text>
  </g>
  <g data-hotspot="emg" data-label="Cảm biến điện cơ EMG">
    <rect x="220" y="8" width="200" height="284" rx="12" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <text x="320" y="40" text-anchor="middle" font-size="17" font-weight="700" style="fill:var(--c-text)">Điện cơ (EMG)</text>
    <text x="320" y="100" text-anchor="middle" font-size="48">⚡</text>
    <text x="236" y="150" font-size="14" style="fill:var(--c-text)">✗ Dán điện cực lên da</text>
    <text x="236" y="178" font-size="14" style="fill:var(--c-text)">✗ Tín hiệu rất nhỏ</text>
    <text x="236" y="206" font-size="14" style="fill:var(--c-text)">✗ Cần mạch khuếch đại</text>
    <text x="236" y="234" font-size="14" style="fill:var(--c-text)">✓ Đeo được</text>
  </g>
  <g data-hotspot="imu" data-label="Cảm biến IMU trên bo mạch">
    <rect x="432" y="8" width="200" height="284" rx="12" style="fill:var(--c-success-bg);stroke:var(--c-success)"/>
    <text x="532" y="40" text-anchor="middle" font-size="17" font-weight="700" style="fill:var(--c-text)">IMU (BandW chọn)</text>
    <text x="532" y="100" text-anchor="middle" font-size="48">🧭</text>
    <text x="448" y="150" font-size="14" style="fill:var(--c-text)">✓ Có sẵn trên bo mạch</text>
    <text x="448" y="178" font-size="14" style="fill:var(--c-text)">✓ Không quay hình</text>
    <text x="448" y="206" font-size="14" style="fill:var(--c-text)">✓ Không cần ánh sáng</text>
    <text x="448" y="234" font-size="14" style="fill:var(--c-text)">✓ Đeo trên cổ tay</text>
  </g>
</svg>`;

export default {
  id: 'u01',
  title: 'Vấn đề & ý tưởng',
  description: 'BandW giúp ai, 5 cử chỉ thành 5 câu nói, và vì sao nhóm chọn cách làm đơn giản, dựa trên luật.',
  color: 'blue',
  icon: '💬',
  glossary: [
    { term: 'giao tiếp hỗ trợ', en: 'AAC: augmentative and alternative communication', def: 'Các cách giúp người khó nói diễn đạt ý muốn: bảng hình, bảng chữ, thiết bị phát giọng nói… BandW là một công cụ giao tiếp hỗ trợ đeo trên cổ tay.' },
    { term: 'cử chỉ', en: 'gesture', def: 'Một cử động có quy ước của cổ tay, ví dụ nghiêng trái, lắc, gõ 2 lần. Mỗi cử chỉ của BandW ứng với đúng một lệnh.' },
    { term: 'lệnh', en: 'command', def: 'Một từ tiếng Anh ngắn vòng tay gửi cho điện thoại: WATER, FOOD, NO, YES hoặc HELP. Điện thoại đổi lệnh thành câu tiếng Việt.' },
    { term: 'tư thế trung tính', en: 'neutral pose', def: 'Tư thế cổ tay để nghỉ thoải mái của chính người dùng. Vòng tay ghi lại tư thế này và đo mọi góc so với nó.' },
    { term: 'dựa trên luật', en: 'rule-based', def: 'Cách lập trình mà con người tự viết ra các điều kiện rõ ràng (ngưỡng góc, thời gian, thứ tự bước) để máy làm theo, không cần huấn luyện bằng dữ liệu.' },
    { term: 'học máy', en: 'machine learning', def: 'Cách cho máy tự tìm quy luật từ rất nhiều dữ liệu mẫu đã gắn nhãn. BandW KHÔNG dùng học máy.' },
  ],
  lessons: [
    // ───────────────────────────── L1 ─────────────────────────────
    {
      id: 'l1',
      title: 'Ai cần BandW?',
      minutes: 8,
      goal: 'Sau bài này, em sẽ nói được BandW giúp ai, giúp việc gì và không thay thế được điều gì.',
      steps: [
        { type: 'diagram', title: 'Một câu chuyện 4 khung', svg: SVG_COMIC,
          caption: 'Bác Hoà là nhân vật minh hoạ: khát nước nhưng không nói được, chỉ cần nghiêng cổ tay là điện thoại nói thay.',
          alt: 'Truyện tranh 4 khung: 1 bệnh nhân khát nước; 2 không nói thành lời được; 3 nghiêng cổ tay sang trái; 4 điện thoại phát câu "Tôi muốn uống nước."' },
        { type: 'text', title: 'Người khó nói vẫn có điều muốn nói',
          body: 'Có những người hiểu hết mọi chuyện nhưng **khó nói thành lời**, ví dụ sau đột quỵ, người bại não hay người bệnh nằm viện. Nhu cầu hằng ngày của họ thường rất cơ bản: uống nước, ăn, trả lời có hoặc không, gọi người giúp.\n\n> BandW là một công cụ [[giao tiếp hỗ trợ]] (AAC) đeo trên cổ tay.' },
        { type: 'sim', title: 'Năm cử chỉ của BandW', sim: 'gesture-gallery', props: { showCommands: true, showPhrases: true },
          caption: 'Chạm vào từng thẻ để xem cử chỉ chuyển động và bấm "Nghe" để nghe câu nói. Mỗi [[cử chỉ]] (gesture) ứng với đúng một câu.' },
        { type: 'text', title: 'Vì sao lại là cổ tay?',
          body: 'Bảng chữ cái giấy cần người khác cầm và dò từng chữ, màn hình cảm ứng lại cần mắt nhìn và ngón tay khéo. BandW chỉ cần **một cử động cổ tay**: không cần nhìn, không cần chạm đúng chỗ, và vòng tay luôn ở trên người.' },
        { type: 'mcq', id: 'u01.l1.q1', prompt: 'Người dùng chính mà BandW hướng tới là ai?',
          options: ['Người khó nói hoặc không nói được nhưng còn cử động được cổ tay', 'Người bị liệt hoàn toàn cả hai tay', 'Người khiếm thị cần đọc chữ', 'Vận động viên muốn đo nhịp tim'], answer: 0,
          explanation: 'BandW đổi cử động cổ tay thành câu nói, nên người dùng phải **còn cử động cổ tay**. Người liệt hoàn toàn cổ tay chưa dùng được: đây là một hạn chế cần nói thật khi phản biện.' },
        { type: 'truefalse', id: 'u01.l1.q2', prompt: 'BandW thay thế hoàn toàn việc chăm sóc của người nhà và nhân viên y tế.',
          answer: false,
          explanation: 'Sai. BandW chỉ là **công cụ hỗ trợ giao tiếp**: giúp người bệnh nói ra nhu cầu. Người chăm sóc vẫn phải có mặt để đáp ứng, và BandW chưa phải thiết bị y tế được chứng nhận.' },
        { type: 'multi', id: 'u01.l1.q3', prompt: 'Chọn **tất cả** lý do hợp lý để dùng cử chỉ cổ tay thay vì màn hình cảm ứng.',
          options: ['Không cần nhìn vào màn hình', 'Không cần ngón tay khéo léo để chạm đúng nút', 'Vòng tay luôn đeo sẵn trên người', 'Vòng tay chắc chắn rẻ hơn mọi điện thoại', 'Cổ tay luôn chính xác 100%'], answers: [0, 1, 2],
          hint: 'Loại các câu khẳng định tuyệt đối hoặc chưa có số liệu.',
          explanation: 'Ba ý đầu đúng với cách BandW hoạt động. BandW vẫn **cần một điện thoại** để nói, nên không thể nói "rẻ hơn điện thoại"; còn "chính xác 100%" là chưa đo, không được khẳng định.' },
        { type: 'hotspot', id: 'u01.l1.q4', prompt: 'Bác Hoà đang khát nước. Chạm vào cử chỉ bác nên dùng.',
          target: { kind: 'sim', sim: 'gesture-gallery', props: { showCommands: true, showPhrases: true } }, answer: 'water',
          explanation: 'Nghiêng tay **trái** gửi lệnh `WATER`, điện thoại đọc "Tôi muốn uống nước."' },
        { type: 'mcq', id: 'u01.l1.q5', prompt: 'Nhu cầu nào **không** nằm trong 5 câu hiện có của BandW?',
          options: ['Muốn uống nước', 'Muốn ăn', 'Muốn xem ti vi', 'Cần giúp đỡ'], answer: 2,
          explanation: 'Năm câu hiện có: "Tôi muốn uống nước.", "Tôi muốn ăn.", "Không.", "Có.", "Tôi cần giúp đỡ.". Câu khác chưa có: đây là hạn chế và cũng là hướng phát triển.' },
        { type: 'flashcard', id: 'u01.l1.q6', prompt: 'Giám khảo hỏi: "Em giới thiệu dự án trong 30 giây được không?"',
          modelAnswer: 'BandW là vòng tay giúp **người khó nói** diễn đạt 5 nhu cầu cơ bản. Cảm biến trên cổ tay nhận ra 5 cử chỉ: nghiêng trái, nghiêng phải, lắc, gõ 2 lần, nhấp cẳng tay 2 lần. Vòng tay gửi lệnh qua Bluetooth, điện thoại đọc câu **tiếng Việt** thành tiếng. Thuật toán **dựa trên luật**, không dùng học máy.',
          keyPoints: ['Giúp ai: người khó nói, còn cử động cổ tay', '5 cử chỉ → 5 câu tiếng Việt', 'Vòng tay → Bluetooth → điện thoại đọc', 'Dựa trên luật, không học máy'],
          explanation: 'Câu giới thiệu tốt có: vấn đề, giải pháp, cách hoạt động, điểm khác biệt. Tập nói thành tiếng và bấm giờ.' },
      ],
    },
    // ───────────────────────────── L2 ─────────────────────────────
    {
      id: 'l2',
      title: '5 cử chỉ, 5 câu nói',
      minutes: 10,
      goal: 'Sau bài này, em sẽ ghép đúng mỗi cử chỉ với lệnh và câu nói, và biết vì sao giữ tay không lặp câu.',
      steps: [
        { type: 'diagram', title: 'Bảng ánh xạ', name: 'gesture-map',
          caption: 'Cử chỉ → lệnh ngắn → câu tiếng Việt. Chạm vào từng hàng để xem kỹ.',
          alt: 'Năm hình cử chỉ: nghiêng trái ra WATER "Tôi muốn uống nước.", nghiêng phải ra FOOD "Tôi muốn ăn.", lắc ra NO "Không.", gõ 2 lần ra YES "Có.", hạ cẳng tay rồi nâng lại 2 lần ra HELP "Tôi cần giúp đỡ."' },
        { type: 'sim', title: 'Xem cả 5 cử chỉ chạy qua hệ thống', sim: 'system-flow', props: { gesture: 'cycle' },
          caption: 'Bấm ▶ Phát: hoạt hình lần lượt chạy 5 cử chỉ, từ cổ tay tới loa điện thoại. Để ý chữ trên "gói tin" đổi theo từng cử chỉ.' },
        { type: 'text', title: 'Một cử chỉ, đúng một lệnh',
          body: 'Mỗi cử chỉ phát **đúng một** [[lệnh]] (command) ngắn như `WATER`, rồi điện thoại tra bảng để đổi ra câu tiếng Việt. Sau đó tay phải về [[tư thế trung tính]] (neutral pose) thì vòng tay mới nhận cử chỉ tiếp theo.' },
        { type: 'code', title: 'Bảng câu nói nằm trong app', language: 'java', source: 'app/src/main/java/com/bandw/demo/GestureCommand.java',
          code: `public enum GestureCommand {
    WATER("Tôi muốn uống nước.", "← Nghiêng tay trái", "#E4EFF9"),
    FOOD("Tôi muốn ăn.", "→ Nghiêng tay phải", "#F6EFCF"),
    NO("Không.", "↔ Lắc cổ tay", "#FCEAE5"),
    YES("Có.", "✌ Gõ 2 lần", "#E3F2DF"),
    HELP("Tôi cần giúp đỡ.", "↕ Hạ cẳng tay rồi nâng lại, 2 lần", "#F7C6C0");`,
          highlight: [2, 3, 4, 5, 6],
          caption: 'Mỗi dòng là một lệnh: tên lệnh, câu sẽ đọc, nhãn hiện trên app và màu thẻ. Em chưa cần hiểu cú pháp, chỉ cần thấy 5 cặp lệnh – câu.',
          notes: [{ lines: [6, 6], note: 'HELP là lệnh khẩn nên dùng cử chỉ khó xảy ra tình cờ: nhấp cẳng tay xuống rồi lên, nhanh 2 lần.' }] },
        { type: 'sim', title: 'Giữ tay mãi có lặp câu không?', sim: 'gesture-state-machine', props: { scenario: 'held-no-repeat', showCode: false, showTimers: true },
          caption: 'Tay nghiêng trái và **giữ nguyên**: vòng tay phát WATER một lần rồi chờ tay về trung tính. Chương 5 sẽ học kỹ mô hình đơn giản hoá này.' },
        { type: 'match', id: 'u01.l2.q1', prompt: 'Ghép mỗi cử chỉ với câu điện thoại sẽ nói.',
          pairs: [['Nghiêng tay trái', 'Tôi muốn uống nước.'], ['Nghiêng tay phải', 'Tôi muốn ăn.'], ['Lắc cổ tay', 'Không.'], ['Gõ 2 lần', 'Có.'], ['Hạ cẳng tay rồi nâng lại, 2 lần', 'Tôi cần giúp đỡ.']],
          explanation: 'Mẹo nhớ: trái – nước, phải – ăn; lắc đầu là "không" nên lắc tay cũng là "Không."; gõ 2 lần như gật đầu "Có."; nhấp tay 2 lần như vẫy gọi người tới "giúp đỡ".' },
        { type: 'match', id: 'u01.l2.q2', prompt: 'Ghép mỗi câu với **lệnh** vòng tay gửi qua Bluetooth.',
          pairs: [['Tôi muốn uống nước.', 'WATER'], ['Tôi muốn ăn.', 'FOOD'], ['Không.', 'NO'], ['Có.', 'YES'], ['Tôi cần giúp đỡ.', 'HELP']],
          explanation: 'Vòng tay chỉ gửi 5 từ tiếng Anh ngắn (nước = water, thức ăn = food…). Câu tiếng Việt nằm trong app `GestureCommand.java`.' },
        { type: 'sim-predict', id: 'u01.l2.q3', prompt: 'Chip vừa nhận ra cử chỉ **hạ cẳng tay rồi nâng lại, 2 lần**. Gói tin bay qua Bluetooth sẽ chứa gì?',
          sim: 'system-flow', props: { gesture: 'HELP' }, pauseAt: 'decided', revealTo: 'sent',
          options: ['Chữ `HELP`', 'Cả câu "Tôi cần giúp đỡ."', 'Góc của cẳng tay, ví dụ 35°', 'Một đoạn âm thanh đã ghi sẵn'], answer: 0,
          explanation: 'Vòng tay chỉ gửi **lệnh** `HELP` (4 chữ cái). Câu tiếng Việt và giọng đọc đều do điện thoại tạo ra.' },
        { type: 'mcq', id: 'u01.l2.q4', prompt: 'Người dùng nghiêng tay trái rồi **giữ nguyên 3 giây**. Điện thoại nói "Tôi muốn uống nước." mấy lần?',
          options: ['1 lần', '3 lần', 'Nói liên tục cho đến khi hạ tay', '0 lần'], answer: 0,
          explanation: 'Chỉ 1 lần. Sau mỗi lệnh, vòng tay nghỉ 650 ms rồi **bắt buộc tay về trung tính** mới nhận lệnh mới. Bài kiểm thử trong `gesture_test.cpp` có đúng ca này: giữ tư thế không lặp lệnh.' },
        { type: 'truefalse', id: 'u01.l2.q5', prompt: 'Người dùng đặt cẳng tay lên đùi (cẳng tay chúi xuống) và **giữ yên** 3 giây. Vòng tay sẽ phát HELP.',
          answer: false,
          explanation: 'Sai. HELP cần **2 lần nhấp nhanh** cùng chiều (mỗi lần ra quá 25° rồi về dưới 12° trong tối đa 0,7 giây, cả hai trong 2 giây). Giữ yên một góc, như đặt tay lên đùi hay đưa cốc lên miệng, không bao giờ tạo HELP, nên không gọi giúp nhầm.' },
        { type: 'mcq', id: 'u01.l2.q6', prompt: 'Vì sao "Có." dùng **gõ 2 lần** chứ không phải gõ 1 lần?',
          options: ['Một cú va chạm vô tình (đập tay vào thành giường) rất dễ xảy ra, còn hai cú gõ liền nhịp thì khó xảy ra tình cờ', 'Vì cảm biến không đo được cú gõ đơn', 'Vì gõ 2 lần nhanh hơn gõ 1 lần', 'Vì điện thoại chỉ hiểu số chẵn'], answer: 0,
          hint: 'Nghĩ xem trong một ngày, tay em vô tình va vào đồ vật bao nhiêu lần.',
          explanation: 'Gõ 2 lần có **nhịp đặc trưng** (hai cú trong khoảng ngắn), nên ít bị nhầm với va chạm vô tình. Vòng tay còn kiểm tra thêm là tay đang yên, không vừa lắc.' },
        { type: 'flashcard', id: 'u01.l2.q7', prompt: 'Giám khảo hỏi: "Vì sao nhóm chọn đúng 5 câu này mà không nhiều hơn?"',
          modelAnswer: 'Đây là các nhu cầu **thiết yếu** nhất: uống, ăn, trả lời có/không và gọi giúp. Ít cử chỉ thì người dùng **dễ nhớ**, các cử chỉ khác nhau rõ nên **ít nhầm**. Muốn đổi câu chỉ cần sửa bảng `GestureCommand` trong app; thêm cử chỉ mới thì phải sửa cả firmware.',
          keyPoints: ['Nhu cầu thiết yếu', 'Dễ nhớ, ít nhầm', 'Đổi câu: sửa app', 'Thêm cử chỉ: sửa cả firmware'],
          explanation: 'Thừa nhận thẳng thắn: 5 câu là ít, mở rộng câu là hướng phát triển.' },
      ],
    },
    // ───────────────────────────── L3 ─────────────────────────────
    {
      id: 'l3',
      title: 'Tiêu chí thiết kế & cách làm khoa học',
      minutes: 10,
      goal: 'Sau bài này, em sẽ giải thích được vì sao BandW chọn IMU, chọn cách dựa trên luật và giữ riêng tư.',
      steps: [
        { type: 'video', id: 'v-system-overview', title: 'Xem trước toàn cảnh',
          caption: 'Xem lướt cả hệ thống trong khoảng 90 giây. Chương 2 sẽ đi kỹ từng chặng.',
          fallbackSim: { sim: 'system-flow', props: { gesture: 'cycle' } } },
        { type: 'diagram', title: 'Ba cách nhận biết cử động', svg: SVG_OPTIONS,
          caption: 'So sánh ba phương án: camera, điện cơ (EMG) và IMU. BandW chọn IMU vì có sẵn trên bo mạch, đeo được và không quay hình ai cả.',
          alt: 'Ba cột so sánh. Camera: quay hình người dùng, cần ánh sáng, đặt cố định, xử lý ảnh nặng. Điện cơ EMG: dán điện cực, tín hiệu nhỏ, cần khuếch đại, đeo được. IMU: có sẵn trên bo, không quay hình, không cần ánh sáng, đeo trên cổ tay.' },
        { type: 'text', title: 'Luật do người viết, không phải học máy',
          body: 'BandW nhận cử chỉ theo cách [[dựa trên luật]] (rule-based): nhóm tự đặt ngưỡng góc, thời gian giữ và thứ tự các bước. Không có [[học máy]] (machine learning), không cần thu dữ liệu huấn luyện, và mỗi quyết định đều **giải thích được** bằng một con số.' },
        { type: 'sim', title: 'Một luật trông như thế nào?', sim: 'imu-chart', props: { signals: ['roll'], preset: 'water', thresholds: true, readout: true },
          caption: 'Đường cong là góc nghiêng cổ tay. Khi góc vượt vạch 22° về phía trái và giữ đủ 250 ms, dấu WATER xuất hiện: đó chính là một "luật".' },
        { type: 'text', title: 'Riêng tư và trung thực',
          body: 'Vòng tay không có camera, app không dùng micro, và lịch sử câu nói chỉ nằm trong phiên app, không gửi lên máy chủ. Các ngưỡng hiện tại là **giá trị khởi đầu**: độ chính xác trên người đeo thật **chưa được đo**, nhóm phải tự làm thí nghiệm để có số liệu.' },
        { type: 'multi', id: 'u01.l3.q1', prompt: 'Chọn **tất cả** tiêu chí mà thiết kế BandW thực sự hướng tới.',
          options: ['Riêng tư: không camera, không micro', 'Dễ dùng: một cử động cổ tay', 'Nói tiếng Việt', 'Cần Internet mạnh để chạy AI trên máy chủ', 'Dùng một bo mạch có sẵn cảm biến, không phải hàn thêm'], answers: [0, 1, 2, 4],
          explanation: 'BandW không gửi dữ liệu lên máy chủ và không dùng AI. Vòng tay nói chuyện trực tiếp với điện thoại qua Bluetooth; bo XIAO nRF52840 **Sense** đã có sẵn IMU.' },
        { type: 'order', id: 'u01.l3.q2', prompt: 'Sắp xếp các bước của một dự án KHKT theo đúng thứ tự.',
          items: ['Xác định vấn đề', 'Đề xuất giải pháp', 'Chế tạo mẫu thử', 'Thử nghiệm và đo đạc', 'Đánh giá và cải tiến'],
          explanation: 'Vấn đề (người khó nói) → giải pháp (vòng tay cử chỉ) → chế tạo (firmware + app) → thử nghiệm → cải tiến. BandW đã có kiểm thử phần mềm; thử nghiệm với người đeo thật là bước nhóm cần làm và báo cáo trung thực.' },
        { type: 'truefalse', id: 'u01.l3.q3', prompt: 'BandW dùng micro để nghe người dùng.',
          answer: false,
          explanation: 'Sai. README của dự án ghi rõ app **không sử dụng microphone**. Vòng tay chỉ đo chuyển động bằng cảm biến IMU.' },
        { type: 'mcq', id: 'u01.l3.q4', prompt: 'Lý do tốt nhất để chọn IMU thay vì camera là gì?',
          options: ['Đeo được trên người, không cần ánh sáng và không quay hình người dùng', 'IMU nhìn thấy được khuôn mặt người dùng', 'Camera không thể nhận ra cử động tay', 'IMU cần kết nối Internet'], answer: 0,
          explanation: 'IMU đo chuyển động ngay trên cổ tay, hoạt động cả trong bóng tối, và không ghi lại hình ảnh nào, nên tốt cho **riêng tư** của người bệnh.' },
        { type: 'hotspot', id: 'u01.l3.q5', prompt: 'Chạm vào phương án **phải quay hình** người dùng.',
          target: { kind: 'diagram', svg: SVG_OPTIONS }, answer: 'camera',
          explanation: 'Camera phải ghi hình mới nhận ra cử chỉ, ảnh hưởng riêng tư và phụ thuộc ánh sáng. IMU và EMG đều không quay hình.' },
        { type: 'truefalse', id: 'u01.l3.q6', prompt: 'Các ngưỡng của BandW (22°, 250 ms…) đã được tối ưu trên bệnh nhân thật.',
          answer: false,
          explanation: 'Sai. README ghi: các ngưỡng là **giá trị khởi đầu**, chưa đo với cử chỉ thực tế của người dùng. Nói thật điều này khiến giám khảo tin em hơn.' },
        { type: 'flashcard', id: 'u01.l3.q7', prompt: 'Giám khảo hỏi: "Bây giờ ai cũng dùng AI, sao nhóm không dùng?"',
          modelAnswer: 'Năm cử chỉ khác nhau rất rõ nên **luật đơn giản là đủ**. Luật chạy nhẹ ngay trên chip nhỏ, **giải thích được** từng quyết định, dễ kiểm thử và chỉnh ngưỡng. Học máy cần **nhiều dữ liệu có nhãn** mà nhóm chưa có. Khi có dữ liệu thí nghiệm thật, học máy có thể là hướng phát triển.',
          keyPoints: ['5 cử chỉ khác biệt rõ', 'Chạy nhẹ trên vi điều khiển', 'Giải thích và kiểm thử được', 'Học máy cần nhiều dữ liệu', 'Hướng phát triển sau này'],
          explanation: 'Không chê AI; hãy nói đây là lựa chọn phù hợp với điều kiện hiện tại.' },
      ],
    },
  ],
  defense: [
    { type: 'flashcard', id: 'u01.d.q1', prompt: 'Giám khảo hỏi: "Dự án của em giải quyết vấn đề gì?"',
      modelAnswer: 'Người **khó nói** (sau đột quỵ, bại não, đang nằm viện…) khó diễn đạt nhu cầu cơ bản. BandW đổi **cử chỉ cổ tay** thành **câu nói tiếng Việt** trên điện thoại, cho 5 nhu cầu: uống nước, ăn, không, có, cần giúp đỡ.',
      keyPoints: ['Người khó nói', 'Nhu cầu cơ bản', 'Cử chỉ → câu nói tiếng Việt'],
      explanation: 'Mở đầu bằng con người và vấn đề, sau đó mới đến công nghệ.' },
    { type: 'flashcard', id: 'u01.d.q2', prompt: 'Giám khảo hỏi: "Tính mới của dự án nằm ở đâu?"',
      modelAnswer: 'Kết hợp **cảm biến IMU đeo tay**, **luật nhận dạng giải thích được** có chống lệnh nhầm (về trung tính, giữ, nghỉ) và **giọng đọc tiếng Việt** trên điện thoại sẵn có. Có hiệu chuẩn theo tư thế của từng người. Em không khẳng định "đầu tiên trên thế giới".',
      keyPoints: ['IMU đeo tay + tiếng Việt', 'Luật giải thích được, chống nhầm', 'Hiệu chuẩn theo người dùng', 'Không phóng đại'],
      explanation: 'Tránh các từ "đầu tiên", "duy nhất" nếu không có bằng chứng.' },
    { type: 'flashcard', id: 'u01.d.q3', prompt: 'Giám khảo hỏi: "Vòng tay chính xác bao nhiêu phần trăm? Pin dùng được bao lâu?"',
      modelAnswer: 'Thuật toán đã qua **kiểm thử trên máy tính bằng dữ liệu tổng hợp**. Độ chính xác trên người đeo thật và thời lượng pin **chưa có số đo** trong dự án, nên em không đưa con số. Cách đo: mỗi cử chỉ làm nhiều lần, ghi vào ma trận nhầm lẫn; pin thì sạc đầy rồi chạy liên tục đến khi tắt và ghi thời gian.',
      keyPoints: ['Đã kiểm thử phần mềm', 'Chưa đo trên người thật / chưa đo pin', 'Không bịa số', 'Nêu được cách đo'],
      explanation: 'Nếu nhóm đã tự đo, hãy thay bằng số liệu thật kèm điều kiện đo.' },
  ],
};
