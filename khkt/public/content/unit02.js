// public/content/unit02.js — Chương 2: Bức tranh toàn hệ thống (Writer #1)
// Số liệu lấy từ firmware/BandW_Sense/BandW_Sense.ino, GestureDetector.h, app/.../*.java và README.

const SVG_LED = `<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <text x="250" y="24" font-size="14" style="fill:var(--c-muted)">0 s</text>
  <text x="590" y="24" font-size="14" text-anchor="end" style="fill:var(--c-muted)">2 s</text>
  <g>
    <text x="8" y="66" font-size="15" font-weight="700" style="fill:var(--c-text)">Đang hiệu chuẩn</text>
    <text x="8" y="86" font-size="14" style="fill:var(--c-muted)">nháy nhanh 150 ms</text>
    <rect x="250" y="52" width="340" height="30" rx="4" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <rect x="250" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
    <rect x="301" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
    <rect x="352" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
    <rect x="403" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
    <rect x="454" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
    <rect x="505" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
    <rect x="556" y="52" width="25.5" height="30" style="fill:var(--c-energy)"/>
  </g>
  <g>
    <text x="8" y="136" font-size="15" font-weight="700" style="fill:var(--c-text)">Chờ app kết nối</text>
    <text x="8" y="156" font-size="14" style="fill:var(--c-muted)">nháy chậm 800 ms</text>
    <rect x="250" y="122" width="340" height="30" rx="4" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <rect x="250" y="122" width="136" height="30" style="fill:var(--c-energy)"/>
    <rect x="522" y="122" width="68" height="30" style="fill:var(--c-energy)"/>
  </g>
  <g>
    <text x="8" y="206" font-size="15" font-weight="700" style="fill:var(--c-text)">Sẵn sàng</text>
    <text x="8" y="226" font-size="14" style="fill:var(--c-muted)">chớp 60 ms mỗi ~2 s</text>
    <rect x="250" y="192" width="340" height="30" rx="4" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
    <rect x="250" y="192" width="10" height="30" style="fill:var(--c-energy)"/>
  </g>
  <text x="250" y="246" font-size="14" style="fill:var(--c-muted)">Ô màu vàng = đèn sáng</text>
</svg>`;

const SVG_SPLIT = `<svg viewBox="0 0 640 330" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <rect x="8" y="8" width="236" height="314" rx="14" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
  <text x="126" y="36" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">⌚ Firmware (C++)</text>
  <text x="126" y="58" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">chạy trên vòng tay</text>
  <g data-hotspot="f-detector" data-label="GestureDetector.h">
    <rect x="22" y="76" width="208" height="96" rx="10" style="fill:var(--c-surface);stroke:var(--c-primary)"/>
    <text x="126" y="104" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">GestureDetector.h</text>
    <text x="126" y="128" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">tính góc, ngưỡng,</text>
    <text x="126" y="148" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">nhận dạng cử chỉ</text>
  </g>
  <g data-hotspot="f-ino" data-label="BandW_Sense.ino">
    <rect x="22" y="188" width="208" height="120" rx="10" style="fill:var(--c-surface);stroke:var(--c-primary)"/>
    <text x="126" y="216" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">BandW_Sense.ino</text>
    <text x="126" y="240" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">vòng lặp chính,</text>
    <text x="126" y="260" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">đọc cảm biến, LED,</text>
    <text x="126" y="280" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">gửi lệnh Bluetooth</text>
  </g>
  <g data-hotspot="contract" data-label="Hợp đồng giữa hai bên">
    <rect x="254" y="100" width="132" height="150" rx="12" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-dasharray:6 4"/>
    <text x="320" y="128" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">Hợp đồng</text>
    <text x="320" y="152" text-anchor="middle" font-size="14" style="fill:var(--c-text)">UUID c91b0001…</text>
    <text x="320" y="176" text-anchor="middle" font-size="14" style="fill:var(--c-text)">WATER · FOOD</text>
    <text x="320" y="198" text-anchor="middle" font-size="14" style="fill:var(--c-text)">NO · YES</text>
    <text x="320" y="220" text-anchor="middle" font-size="14" style="fill:var(--c-text)">HELP</text>
    <text x="320" y="88" text-anchor="middle" font-size="20" style="fill:var(--c-primary)">⇄</text>
  </g>
  <rect x="396" y="8" width="236" height="314" rx="14" style="fill:var(--c-surface-2);stroke:var(--c-border)"/>
  <text x="514" y="36" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">📱 App (Java)</text>
  <text x="514" y="58" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">chạy trên Android</text>
  <g data-hotspot="f-ble" data-label="BandBleClient.java">
    <rect x="410" y="76" width="208" height="70" rx="10" style="fill:var(--c-surface);stroke:var(--c-success)"/>
    <text x="514" y="104" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">BandBleClient.java</text>
    <text x="514" y="128" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">quét, kết nối, nhận lệnh</text>
  </g>
  <g data-hotspot="f-main" data-label="MainActivity.java">
    <rect x="410" y="156" width="208" height="70" rx="10" style="fill:var(--c-surface);stroke:var(--c-success)"/>
    <text x="514" y="184" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">MainActivity.java</text>
    <text x="514" y="208" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">giao diện, giọng đọc</text>
  </g>
  <g data-hotspot="f-command" data-label="GestureCommand.java">
    <rect x="410" y="236" width="208" height="72" rx="10" style="fill:var(--c-surface);stroke:var(--c-success)"/>
    <text x="514" y="264" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--c-text)">GestureCommand.java</text>
    <text x="514" y="288" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">bảng lệnh → câu nói</text>
  </g>
</svg>`;

export default {
  id: 'u02',
  title: 'Bức tranh toàn hệ thống',
  description: 'Sáu chặng từ cổ tay đến loa: linh kiện nào làm gì, dữ liệu đổi dạng ra sao, phần nào là firmware, phần nào là app.',
  color: 'teal',
  icon: '🧩',
  glossary: [
    { term: 'vi điều khiển', en: 'microcontroller', def: 'Một máy tính tí hon trên một con chip, chạy mãi một chương trình duy nhất. Trên BandW là chip nRF52840, có sẵn sóng Bluetooth.' },
    { term: 'IMU', en: 'inertial measurement unit', def: 'Cảm biến đo chuyển động, gồm gia tốc kế và con quay hồi chuyển. BandW dùng IMU LSM6DS3 gắn sẵn trên bo XIAO nRF52840 Sense.' },
    { term: 'I2C', en: 'Inter-Integrated Circuit', def: 'Một kiểu "đường dây nói chuyện" giữa các chip trên cùng bo mạch, chỉ dùng 2 dây. Chip nRF52840 đọc IMU qua I2C ở địa chỉ 0x6A.' },
    { term: 'firmware', en: 'firmware', def: 'Chương trình nạp vào chip của vòng tay. Firmware BandW viết bằng C++ (Arduino), gồm BandW_Sense.ino và GestureDetector.h.' },
    { term: 'ứng dụng', en: 'app', def: 'Chương trình chạy trên điện thoại Android, viết bằng Java: kết nối vòng tay, hiện câu và đọc thành tiếng.' },
    { term: 'ASCII', en: 'American Standard Code for Information Interchange', def: 'Bảng quy ước đổi mỗi chữ cái thành một con số 1 byte. Ví dụ W = 0x57, A = 0x41. Lệnh "WATER" là 5 byte ASCII.' },
    { term: 'UUID', en: 'universally unique identifier', def: 'Mã định danh dài 128 bit, gần như không thể trùng. App tìm đúng vòng tay BandW nhờ UUID dịch vụ c91b0001-7d7a-4f8c-9d29-6e44c786a321.' },
    { term: 'watchdog', en: 'watchdog timer', def: 'Bộ hẹn giờ "chó canh cửa": chương trình phải báo "vẫn sống" thường xuyên; nếu treo quá 4000 ms, chip tự khởi động lại.' },
  ],
  lessons: [
    // ───────────────────────────── L1 ─────────────────────────────
    {
      id: 'l1',
      title: 'Từ cổ tay đến giọng nói',
      minutes: 12,
      goal: 'Sau bài này, em sẽ kể đúng 6 chặng của tín hiệu và dữ liệu ở mỗi chặng trông như thế nào.',
      steps: [
        { type: 'video', id: 'v-system-overview', title: 'Toàn cảnh BandW',
          caption: 'Xem trọn video: một cử động cổ tay đi qua 6 chặng để thành một câu nói.',
          fallbackSim: { sim: 'system-flow', props: { gesture: 'cycle' } } },
        { type: 'diagram', title: 'Sáu chặng', name: 'system-blocks',
          caption: 'Cổ tay → cảm biến IMU → chip nRF52840 → sóng Bluetooth → điện thoại → loa.',
          alt: 'Sơ đồ khối: cổ tay, cảm biến IMU, chip nRF52840, sóng BLE, điện thoại Android, loa, nối bằng mũi tên từ trái sang phải.' },
        { type: 'sim', title: 'Đi từng chặng với WATER', sim: 'system-flow', props: { gesture: 'WATER', showLatency: false },
          caption: 'Bấm ⏭ Bước tiếp để dừng ở từng chặng. Nhìn chữ trên gói sáng: lúc đầu là chuyển động, sau thành chữ `WATER`, cuối cùng thành câu nói.' },
        { type: 'text', title: 'Dữ liệu đổi hình dạng',
          body: 'Ở mỗi chặng, dữ liệu **đổi dạng**: chuyển động → số gia tốc → góc → lệnh `WATER` → câu tiếng Việt → âm thanh. Qua sóng Bluetooth chỉ có vài chữ cái, không có dữ liệu cảm biến thô, vì chip trên vòng tay đã tự quyết định cử chỉ.' },
        { type: 'code', title: 'Chặng "quyết định và gửi" trong firmware', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: `    Gesture event = detector.update(x, y, z, gx, gy, gz, now, doubleTap);
    if (!subscribed) return;
    const char* command = event == Gesture::Water ? "WATER" : event == Gesture::Food ? "FOOD" : event == Gesture::No ? "NO"
        : event == Gesture::Yes ? "YES" : event == Gesture::Help ? "HELP" : nullptr;
    if (command) log(String(gestureCharacteristic.writeValue(command) ? "TX " : "TX FAILED ") + command);`,
          highlight: [1, 5],
          caption: 'Dòng 1: đưa 6 số cảm biến vào bộ nhận dạng. Dòng 3–4: đổi kết quả thành chữ. Dòng 5: gửi chữ đó qua Bluetooth.',
          notes: [
            { lines: [2, 2], note: 'Nếu app chưa đăng ký nhận lệnh thì dừng ở đây: không gửi, cũng không lưu lại để gửi sau.' },
            { lines: [3, 4], note: 'Chuỗi dấu ? : giống "nếu là Water thì chữ WATER, nếu là Food thì FOOD…", không khớp gì thì nullptr (không có lệnh).' },
          ] },
        { type: 'order', id: 'u02.l1.q1', prompt: 'Kéo thả để xếp đúng đường đi của tín hiệu.',
          items: ['Cổ tay cử động', 'Cảm biến IMU đo', 'Chip nRF52840 nhận dạng', 'Sóng Bluetooth (BLE)', 'Điện thoại Android', 'Loa phát câu nói'],
          explanation: 'Cổ tay → IMU → nRF52840 → BLE → điện thoại → loa. Nhớ: **nhận dạng xảy ra trên vòng tay**, trước khi gửi.' },
        { type: 'hotspot', id: 'u02.l1.q2', prompt: 'Chạm vào khối **quyết định** người dùng vừa làm cử chỉ nào.',
          target: { kind: 'diagram', name: 'system-blocks' }, answer: 'mcu',
          explanation: 'Chip **nRF52840** chạy bộ nhận dạng `GestureDetector`. IMU chỉ đo số, điện thoại chỉ nhận chữ đã có sẵn kết quả.' },
        { type: 'mcq', id: 'u02.l1.q3', prompt: 'Ở chặng sóng Bluetooth, dữ liệu bay đi là gì?',
          options: ['Một chữ ASCII ngắn như `WATER`', 'Câu tiếng Việt "Tôi muốn uống nước."', 'Toàn bộ số đo cảm biến 50 lần mỗi giây', 'Một đoạn ghi âm giọng nói'], answer: 0,
          explanation: 'Mỗi thông báo Bluetooth chứa đúng một chuỗi [[ASCII]] như `WATER` (tối đa 8 byte). Câu tiếng Việt và giọng đọc đều nằm ở điện thoại.' },
        { type: 'truefalse', id: 'u02.l1.q4', prompt: 'Điện thoại nhận dữ liệu cảm biến thô rồi tự đoán cử chỉ.',
          answer: false,
          explanation: 'Sai. Vòng tay **tự nhận dạng** rồi chỉ gửi kết quả. Điện thoại không bao giờ thấy số gia tốc hay góc.' },
        { type: 'mcq', id: 'u02.l1.q5', prompt: 'Câu "Tôi muốn ăn." được lưu ở đâu?',
          options: ['Trong app, tệp `GestureCommand.java`', 'Trong firmware, tệp `GestureDetector.h`', 'Trong chip cảm biến IMU', 'Trên một máy chủ Internet'], answer: 0,
          explanation: 'Bảng lệnh → câu nằm trong `GestureCommand.java` của app. Firmware chỉ biết 5 chữ `WATER`, `FOOD`, `NO`, `YES`, `HELP`.' },
        { type: 'sim-predict', id: 'u02.l1.q6', prompt: 'Điện thoại vừa nhận chữ `FOOD`. Loa sắp nói gì?',
          sim: 'system-flow', props: { gesture: 'FOOD' }, pauseAt: 'received', revealTo: 'spoken',
          options: ['"Tôi muốn ăn."', '"Tôi muốn uống nước."', '"Food."', 'Không nói gì'], answer: 0,
          explanation: 'App tra bảng: `FOOD` → "Tôi muốn ăn." rồi dùng giọng đọc tiếng Việt để nói.' },
        { type: 'flashcard', id: 'u02.l1.q7', prompt: 'Giám khảo hỏi: "Em trình bày đường đi của tín hiệu từ lúc cử động đến lúc có tiếng nói."',
          modelAnswer: 'Cổ tay cử động → **IMU** đo gia tốc và tốc độ xoay; chip đọc IMU 50 lần mỗi giây → chip **nRF52840** tính góc, so ngưỡng, nhận ra cử chỉ → gửi một chữ như `WATER` qua **Bluetooth Low Energy** → app Android tra bảng ra "Tôi muốn uống nước." → **giọng đọc** tiếng Việt phát ra loa.',
          keyPoints: ['6 chặng đúng thứ tự', 'Nhận dạng trên vòng tay', 'Chỉ gửi một chữ ngắn', 'Câu và giọng nằm ở app'],
          explanation: 'Khi trả lời, hãy chỉ tay vào sơ đồ khối từ trái sang phải.' },
      ],
    },
    // ───────────────────────────── L2 ─────────────────────────────
    {
      id: 'l2',
      title: 'Phần cứng: bo XIAO nRF52840 Sense',
      minutes: 10,
      goal: 'Sau bài này, em sẽ chỉ được chip, cảm biến, ăng-ten, LED trên bo và đọc được 3 kiểu nháy đèn.',
      steps: [
        { type: 'diagram', title: 'Nhìn từ trên xuống', name: 'xiao-board',
          caption: 'Bo mạch nhỏ cỡ đầu ngón tay cái, có sẵn chip, cảm biến IMU, ăng-ten Bluetooth, đèn LED và cổng USB-C.',
          alt: 'Mặt trên bo XIAO nRF52840 Sense: cổng USB-C, chip nRF52840, cảm biến IMU, đèn LED, ăng-ten, chân pin.' },
        { type: 'text', title: 'Bộ não và giác quan',
          body: '[[vi điều khiển]] (microcontroller) nRF52840 là "bộ não nhỏ": chạy mãi một chương trình và có sẵn sóng Bluetooth. Cảm biến [[IMU]] LSM6DS3 gắn ngay trên bo, nói chuyện với chip qua đường dây [[I2C]] ở địa chỉ `0x6A`, nên không phải hàn thêm cảm biến nào.' },
        { type: 'code', title: 'Cài đặt cảm biến khi bật nguồn', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: `LSM6DS3 imu(I2C_MODE, 0x6A);
// …
    imu.settings.accelRange = 4;
    imu.settings.gyroRange = 500;
    imu.settings.accelSampleRate = 416; // tap detection needs >= 416 Hz
    imu.settings.gyroSampleRate = 104;`,
          highlight: [1],
          caption: 'Gia tốc đo tới ±4 g, cập nhật 416 lần/giây (đủ nhanh để bắt cú gõ); tốc độ xoay đo tới ±500 °/s, 104 lần/giây.',
          notes: [{ lines: [5, 5], note: 'Chú thích gốc tiếng Anh: "nhận gõ cần ít nhất 416 Hz". Cú gõ rất ngắn nên phải đo dày.' }] },
        { type: 'sim', title: 'Khối nào đang làm việc?', sim: 'system-flow', props: { gesture: 'WATER', focus: 'imu' },
          caption: 'Khối IMU được làm nổi bật: nó chỉ **đo**, còn quyết định là việc của chip bên cạnh. Bấm ▶ để xem số đo chạy sang chip.' },
        { type: 'diagram', title: 'Đèn LED nói gì?', svg: SVG_LED,
          caption: 'Ba kiểu nháy trong 2 giây: nháy nhanh khi hiệu chuẩn, nháy chậm khi chờ app, chớp rất ngắn khi đã sẵn sàng (đỡ tốn pin).',
          alt: 'Ba dải thời gian dài 2 giây. Hàng 1: đèn bật tắt mỗi 150 ms khi đang hiệu chuẩn. Hàng 2: đèn bật tắt mỗi 800 ms khi chờ app. Hàng 3: chỉ một chớp 60 ms trong khoảng 2 giây khi sẵn sàng.' },
        { type: 'hotspot', id: 'u02.l2.q1', prompt: 'Chạm vào **cảm biến IMU** trên bo mạch.',
          target: { kind: 'diagram', name: 'xiao-board' }, answer: 'imu',
          explanation: 'IMU LSM6DS3 là con chip nhỏ đo gia tốc và tốc độ xoay. Nó có sẵn trên bản **Sense**, nên nhóm không phải nối thêm dây.' },
        { type: 'match', id: 'u02.l2.q2', prompt: 'Ghép kiểu nháy đèn với trạng thái của vòng tay.',
          pairs: [['Nháy nhanh (150 ms)', 'Đang hiệu chuẩn'], ['Nháy chậm (800 ms)', 'Đã hiệu chuẩn, chờ app'], ['Chớp ngắn mỗi ~2 giây', 'Sẵn sàng nhận cử chỉ']],
          explanation: 'Trong code: `!calibrated ? 150U : !subscribed ? 800U : ledOn ? 60U : 1940U`. Đọc là: chưa hiệu chuẩn thì 150 ms; chưa có app thì 800 ms; còn lại sáng 60 ms, tắt 1940 ms.' },
        { type: 'mcq', id: 'u02.l2.q3', prompt: 'Vì sao nhóm không phải hàn thêm cảm biến chuyển động?',
          options: ['Bo XIAO nRF52840 **Sense** đã có sẵn IMU LSM6DS3', 'Điện thoại tự đo chuyển động cổ tay', 'Chip nRF52840 tự đoán được chuyển động mà không cần cảm biến', 'Vì BandW không cần đo chuyển động'], answer: 0,
          explanation: 'Bản **Sense** gắn sẵn IMU (và nối sẵn với chip qua I2C). Nhờ vậy phần cứng gọn: một bo mạch, không dây nối thêm.' },
        { type: 'truefalse', id: 'u02.l2.q4', prompt: 'Vòng tay cần Wi-Fi để gửi lệnh cho điện thoại.',
          answer: false,
          explanation: 'Sai. Vòng tay và điện thoại nói chuyện trực tiếp qua **Bluetooth Low Energy**, không cần Wi-Fi hay router.' },
        { type: 'hotspot', id: 'u02.l2.q5', prompt: 'Chạm vào bộ phận **phát và thu sóng Bluetooth**.',
          target: { kind: 'diagram', name: 'xiao-board' }, answer: 'antenna',
          hint: 'Sóng vô tuyến cần một "cái loa" bằng kim loại để phát ra không khí.',
          explanation: 'Ăng-ten phát sóng Bluetooth do chip nRF52840 tạo ra. Vật cản (cơ thể, tường) có thể làm sóng yếu đi, nên phạm vi thực tế cần đo.' },
        { type: 'mcq', id: 'u02.l2.q6', prompt: 'Firmware bật một [[watchdog]] 4000 ms. Nó dùng để làm gì?',
          options: ['Nếu chương trình bị treo, bo tự khởi động lại thay vì "chết" luôn', 'Đếm số bước chân của người dùng', 'Tắt vòng tay sau 4 giây để tiết kiệm pin', 'Đo thời gian người dùng giữ cử chỉ'], answer: 0,
          explanation: 'Mỗi vòng lặp, chương trình "báo vẫn sống" cho watchdog. Nếu quá 4 giây không báo (ví dụ kẹt giao tiếp), chip tự khởi động lại.' },
        { type: 'flashcard', id: 'u02.l2.q7', prompt: 'Giám khảo hỏi: "Phần cứng gồm những gì, vì sao chọn bo này?"',
          modelAnswer: 'Một bo **Seeed XIAO nRF52840 Sense**: chip nRF52840 có sẵn **Bluetooth Low Energy**, cảm biến **IMU LSM6DS3** gắn sẵn (gia tốc kế + con quay), đèn LED báo trạng thái, cổng USB-C để nạp chương trình. Chọn vì nhỏ, đủ để đeo, không phải hàn thêm cảm biến, và có thư viện Arduino.',
          keyPoints: ['XIAO nRF52840 Sense', 'Bluetooth có sẵn trong chip', 'IMU gắn sẵn trên bo', 'Nhỏ gọn, không hàn thêm'],
          explanation: 'Nếu bị hỏi giá, chỉ nêu số trên hoá đơn thật của nhóm.' },
      ],
    },
    // ───────────────────────────── L3 ─────────────────────────────
    {
      id: 'l3',
      title: 'Ai làm việc gì: firmware và app',
      minutes: 10,
      goal: 'Sau bài này, em sẽ biết muốn sửa câu nói hay sửa góc nghiêng thì phải sửa ở tệp nào.',
      steps: [
        { type: 'diagram', title: 'Hai bên và một "hợp đồng"', svg: SVG_SPLIT,
          caption: 'Bên trái là [[firmware]] trên vòng tay, bên phải là [[ứng dụng]] (app) trên điện thoại. Ở giữa là thứ hai bên phải thống nhất: mã UUID và 5 chữ lệnh.',
          alt: 'Hai khung. Firmware C++ trên vòng tay gồm GestureDetector.h (nhận dạng cử chỉ) và BandW_Sense.ino (vòng lặp chính, gửi Bluetooth). App Java trên Android gồm BandBleClient.java (kết nối), MainActivity.java (giao diện, giọng đọc), GestureCommand.java (bảng câu nói). Giữa hai khung là hợp đồng: UUID c91b0001 và 5 lệnh.' },
        { type: 'text', title: 'Hợp đồng nhỏ, hai bên độc lập',
          body: 'Firmware viết bằng C++ chỉ lo đo, nhận dạng và gửi một chữ. App viết bằng Java lo kết nối, hiện chữ và đọc thành tiếng. Chỉ cần giữ đúng [[UUID]] và 5 chữ lệnh, mỗi bên có thể sửa mà không đụng tới bên kia.' },
        { type: 'code', title: 'Hợp đồng viết trong firmware', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: `// Custom BandW service; Android uses the same UUIDs. One notification = one ASCII command.
BLEService gestureService("c91b0001-7d7a-4f8c-9d29-6e44c786a321");
BLEStringCharacteristic gestureCharacteristic("c91b0002-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLENotify, 8);
BLEStringCharacteristic controlCharacteristic("c91b0003-7d7a-4f8c-9d29-6e44c786a321", BLERead | BLEWrite | BLENotify, 20);`,
          highlight: [2],
          caption: 'Chú thích gốc: "Android dùng cùng các UUID này. Một thông báo = một lệnh ASCII." App dùng đúng những mã này để tìm và nghe vòng tay.',
          notes: [
            { lines: [3, 3], note: 'Ngăn gửi lệnh: chỉ đọc và thông báo (Read, Notify), tối đa 8 byte.' },
            { lines: [4, 4], note: 'Ngăn điều khiển: app ghi "CALIBRATE" vào đây để yêu cầu hiệu chuẩn lại.' },
          ] },
        { type: 'sim', title: 'Phía app làm gì với chữ nhận được?', sim: 'tts-pipeline', props: { command: 'FOOD', allowPick: true },
          caption: 'Chọn một lệnh rồi bấm ▶: chữ đi qua `parse()`, tìm ra câu tiếng Việt, hiện lên màn hình và được đọc thành tiếng.' },
        { type: 'text', title: 'Demo mode để luyện trình bày',
          body: 'App có nút **Demo** mở các nút mô phỏng 5 cử chỉ, chạy cùng đường xử lý như lệnh từ vòng tay. Khi đang ở Demo mode, lệnh thật từ vòng tay bị bỏ qua, nên em có thể tập thuyết trình mà không cần đeo vòng.' },
        { type: 'match', id: 'u02.l3.q1', prompt: 'Ghép mỗi tệp với nhiệm vụ chính của nó.',
          pairs: [['GestureDetector.h', 'Thuật toán nhận dạng cử chỉ'], ['BandW_Sense.ino', 'Vòng lặp chính và gửi Bluetooth'], ['BandBleClient.java', 'Quét và kết nối vòng tay'], ['MainActivity.java', 'Giao diện và giọng đọc'], ['GestureCommand.java', 'Bảng lệnh → câu nói']],
          explanation: 'Đuôi `.h`, `.ino` là firmware C++ trên vòng tay; đuôi `.java` là app trên điện thoại.' },
        { type: 'mcq', id: 'u02.l3.q2', prompt: 'Muốn đổi câu "Tôi muốn ăn." thành "Tôi đói." thì sửa ở đâu?',
          options: ['`GestureCommand.java` trong app, không cần nạp lại firmware', '`GestureDetector.h` rồi nạp lại firmware', 'Phải sửa cả hai bên', 'Không sửa được'], answer: 0,
          explanation: 'Câu nói chỉ nằm trong app. Vòng tay vẫn gửi `FOOD` như cũ, nên chỉ cần cài lại app.' },
        { type: 'mcq', id: 'u02.l3.q3', prompt: 'Muốn vòng tay chỉ nhận nghiêng khi góc vượt **30°** thay vì 22° thì sửa ở đâu?',
          options: ['Hằng số `TILT_ENTER_DEG` trong `GestureDetector.h`, rồi nạp lại firmware', '`MainActivity.java` trong app', '`GestureCommand.java` trong app', 'Cài đặt Bluetooth của điện thoại'], answer: 0,
          hint: 'Ai là người quyết định cử chỉ: vòng tay hay điện thoại?',
          explanation: 'Ngưỡng góc là một phần của thuật toán chạy trên vòng tay: `static const float TILT_ENTER_DEG = 22.0f;`. Sửa xong phải nạp lại firmware vào bo.' },
        { type: 'hotspot', id: 'u02.l3.q4', prompt: 'Chạm vào tệp chứa **thuật toán nhận dạng** cử chỉ.',
          target: { kind: 'diagram', svg: SVG_SPLIT }, answer: 'f-detector',
          explanation: '`GestureDetector.h` chứa bộ hiệu chuẩn và lớp `GestureDetector` với tất cả ngưỡng (22°, 250 ms, 100 °/s…).' },
        { type: 'truefalse', id: 'u02.l3.q5', prompt: 'Demo mode trong app giúp trình diễn khi không có vòng tay.',
          answer: true,
          explanation: 'Đúng. Các nút mô phỏng đi qua cùng đường hiện chữ và đọc câu như lệnh thật; lúc đó lệnh từ vòng tay bị bỏ qua.' },
        { type: 'flashcard', id: 'u02.l3.q6', prompt: 'Giám khảo hỏi: "Phần nào chạy trên vòng tay, phần nào chạy trên điện thoại?"',
          modelAnswer: '**Vòng tay** (firmware C++): đọc cảm biến 50 lần/giây, hiệu chuẩn, nhận dạng 5 cử chỉ, gửi một chữ qua Bluetooth. **Điện thoại** (app Java): quét và kết nối, nhận chữ, tra ra câu tiếng Việt, hiện chữ lớn và đọc thành tiếng. Hai bên chỉ cần thống nhất UUID và 5 chữ lệnh.',
          keyPoints: ['Firmware C++: đo + nhận dạng + gửi', 'App Java: kết nối + hiện + đọc', 'Hợp đồng: UUID + 5 lệnh'],
          explanation: 'Câu trả lời này cũng cho thấy em hiểu vì sao đổi câu không cần nạp lại firmware.' },
      ],
    },
    // ───────────────────────────── L4 ─────────────────────────────
    {
      id: 'l4',
      title: 'Ôn tập: đoán lỗi nằm ở chặng nào',
      minutes: 8,
      goal: 'Sau bài này, em sẽ dùng sơ đồ 6 chặng để đoán nhanh nguyên nhân khi demo trục trặc.',
      steps: [
        { type: 'sim', title: 'Cả hệ thống, có ước lượng thời gian', sim: 'system-flow', props: { gesture: 'cycle', showLatency: true },
          caption: 'Các con số thời gian có dấu ≈ chỉ là **ước lượng minh hoạ**, không phải số đo. Muốn có số thật, nhóm phải tự đo, ví dụ quay video rồi đếm khung hình.' },
        { type: 'text', title: 'Dò lỗi như thợ điện dò dây',
          body: 'Khi demo trục trặc, hãy lần theo từng chặng: chặng nào còn thấy dữ liệu, chặng nào mất. Ba dấu hiệu nhìn thấy được là **đèn LED** trên bo, **chữ** hiện trên app và **tiếng** từ loa.' },
        { type: 'diagram', title: 'Sơ đồ để dò lỗi', name: 'system-blocks',
          caption: 'Đèn LED cho biết tình trạng vòng tay; chữ trên app cho biết Bluetooth đã tới nơi; tiếng nói cho biết giọng đọc hoạt động.',
          alt: 'Sơ đồ khối 6 chặng: cổ tay, IMU, chip nRF52840, sóng BLE, điện thoại, loa.' },
        { type: 'hotspot', id: 'u02.l4.q1', prompt: 'Đèn trên bo **nháy chậm đều** (800 ms) và app không nhận được lệnh nào. Chạm vào chặng đang bị "đứt".',
          target: { kind: 'diagram', name: 'system-blocks' }, answer: 'ble',
          hint: 'Nháy chậm nghĩa là đã hiệu chuẩn xong nhưng đang chờ ai đó?',
          explanation: 'Nháy chậm = đã hiệu chuẩn nhưng **chưa có app đăng ký nhận lệnh**. Vấn đề ở kết nối Bluetooth: hãy bấm "Kết nối vòng tay" trong app.' },
        { type: 'mcq', id: 'u02.l4.q2', prompt: 'Chữ "Tôi muốn uống nước." hiện đúng trên app nhưng **loa im lặng**. Nghi ngờ hợp lý nhất là gì?',
          options: ['Giọng đọc tiếng Việt chưa cài, âm lượng media nhỏ, hoặc đã tắt tự động đọc', 'Cảm biến IMU bị hỏng', 'Vòng tay chưa hiệu chuẩn', 'Sóng Bluetooth bị đứt'], answer: 0,
          explanation: 'Chữ đã hiện tức là các chặng trước (IMU, chip, Bluetooth, app) đều chạy. Lỗi nằm ở chặng cuối: giọng đọc (TTS) hoặc âm lượng.' },
        { type: 'mcq', id: 'u02.l4.q3', prompt: 'App quét 8 giây mà **không thấy** BandW-Sense. Việc nào nên kiểm tra **đầu tiên**?',
          options: ['Vòng tay có nguồn và đèn có nháy không; Bluetooth và quyền quét của điện thoại đã bật chưa', 'Đổi câu trong GestureCommand.java', 'Tăng ngưỡng nghiêng lên 30°', 'Kết nối Wi-Fi cho điện thoại'], answer: 0,
          explanation: 'Không thấy khi quét là chuyện của chặng Bluetooth: vòng tay phải đang chạy và quảng bá tên, điện thoại phải bật Bluetooth và được cấp quyền (Android 12+ hỏi quyền Thiết bị ở gần).' },
        { type: 'order', id: 'u02.l4.q4', prompt: 'Sắp xếp các dạng của dữ liệu theo thứ tự chúng xuất hiện.',
          items: ['Chuyển động của cổ tay', 'Số gia tốc x, y, z', 'Góc nghiêng (độ)', 'Lệnh `WATER`', 'Câu "Tôi muốn uống nước."', 'Âm thanh từ loa'],
          explanation: 'Mỗi chặng biến dữ liệu thành một dạng mới, từ vật lý (chuyển động) → số → chữ → âm thanh.' },
        { type: 'truefalse', id: 'u02.l4.q5', prompt: 'Nếu mất kết nối, các cử chỉ làm trong lúc đó sẽ được đọc bù khi nối lại.',
          answer: false,
          explanation: 'Sai. Firmware **không lưu và không phát lại** cử chỉ khi mất kết nối, vì một câu cũ đọc muộn có thể gây hiểu nhầm.' },
        { type: 'number', id: 'u02.l4.q6', prompt: 'Chip đọc cảm biến mỗi `SAMPLE_MS = 20` mili giây. Mỗi giây đọc bao nhiêu lần?',
          answer: 50, tolerance: 0, unit: 'lần',
          hint: '1 giây = 1000 ms.',
          explanation: '1000 / 20 = **50 lần mỗi giây** (50 Hz).' },
        { type: 'flashcard', id: 'u02.l4.q7', prompt: 'Giám khảo hỏi: "Em trình bày sơ đồ hệ thống trong 1 phút."',
          modelAnswer: 'Hệ thống có **6 chặng**: cổ tay → IMU LSM6DS3 (chip đọc 50 lần/giây) → chip nRF52840 (tính góc, so ngưỡng, máy trạng thái) → Bluetooth Low Energy (gửi một chữ như `WATER`) → app Android (tra bảng ra câu) → giọng đọc tiếng Việt qua loa. Nhận dạng làm trên vòng tay; câu nói nằm trong app.',
          keyPoints: ['Đủ 6 chặng', 'Dữ liệu đổi dạng mỗi chặng', 'Nhận dạng trên vòng tay', 'Câu nói trong app'],
          explanation: 'Luyện nói kèm chỉ tay vào sơ đồ, bấm giờ không quá 60 giây.' },
      ],
    },
  ],
  defense: [
    { type: 'flashcard', id: 'u02.d.q1', prompt: 'Giám khảo hỏi: "Sao không gửi số đo cảm biến lên điện thoại cho điện thoại tự xử lý?"',
      modelAnswer: 'Nhóm chọn **nhận dạng ngay trên vòng tay** để chỉ phải gửi một chữ ngắn cho mỗi cử chỉ, thay vì gửi liên tục 50 mẫu mỗi giây. App nhờ vậy đơn giản, và thuật toán nằm ở một chỗ, dễ kiểm thử. Lợi ích về pin là hợp lý nhưng **chưa đo**, nên em không đưa con số.',
      keyPoints: ['Gửi một chữ thay vì dữ liệu liên tục', 'App đơn giản', 'Thuật toán một chỗ, dễ kiểm thử', 'Không khẳng định số pin'],
      explanation: 'Phân biệt "lý do thiết kế" với "kết quả đã đo".' },
    { type: 'flashcard', id: 'u02.d.q2', prompt: 'Giám khảo hỏi: "Không có điện thoại thì vòng tay có dùng được không?"',
      modelAnswer: 'Hiện tại **chưa**: vòng tay không có loa, giọng đọc nằm trên điện thoại. Hướng phát triển có thể là gắn loa nhỏ lên vòng tay hoặc một thiết bị nhận riêng.',
      keyPoints: ['Thành thật: chưa dùng được', 'Giọng đọc ở điện thoại', 'Nêu hướng phát triển'],
      explanation: 'Thừa nhận hạn chế rồi đưa hướng khắc phục là cách trả lời tốt.' },
  ],
};
