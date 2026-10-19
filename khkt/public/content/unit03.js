// public/content/unit03.js — Chương 3: Cảm biến IMU (Writer #1)
// Số liệu lấy từ firmware/BandW_Sense/GestureDetector.h, BandW_Sense.ino và firmware/tests/gesture_test.cpp.

// Ba đồ thị tĩnh (dữ liệu giả lập, dạng giống kiểm thử gesture_test.cpp) cho bài ôn tập.
const chartFrame = (title, unit, lines) => `<svg viewBox="0 0 600 230" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <rect x="1" y="1" width="598" height="228" rx="10" style="fill:var(--c-surface);stroke:var(--c-border)"/>
  <text x="16" y="26" font-size="15" font-weight="700" style="fill:var(--c-text)">${title}</text>
  <text x="584" y="26" font-size="14" text-anchor="end" style="fill:var(--c-muted)">${unit}</text>
  <line x1="60" y1="120" x2="584" y2="120" style="stroke:var(--c-muted);stroke-width:1"/>
  <text x="52" y="125" font-size="14" text-anchor="end" style="fill:var(--c-muted)">0</text>
  <text x="584" y="218" font-size="14" text-anchor="end" style="fill:var(--c-muted)">thời gian →</text>
  ${lines}
</svg>`;

const SVG_CHART_ROLL = chartFrame('Đồ thị A: góc nghiêng trái/phải (roll)', 'độ (°)', `
  <line x1="60" y1="87" x2="584" y2="87" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
  <text x="52" y="92" font-size="14" text-anchor="end" style="fill:var(--viz-enter)">+22</text>
  <line x1="60" y1="153" x2="584" y2="153" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
  <text x="52" y="158" font-size="14" text-anchor="end" style="fill:var(--viz-enter)">−22</text>
  <polyline points="60,120 200,121 230,150 260,178 290,180 470,180 500,150 530,121 584,120" style="fill:none;stroke:var(--c-primary);stroke-width:4;stroke-linejoin:round"/>
  <text x="380" y="204" font-size="14" text-anchor="middle" style="fill:var(--c-text)">≈ −40°, giữ yên</text>`);

const SVG_CHART_GY = chartFrame('Đồ thị B: tốc độ xoay quanh trục Y (gy)', '°/s', `
  <line x1="60" y1="80" x2="584" y2="80" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
  <text x="52" y="85" font-size="14" text-anchor="end" style="fill:var(--viz-enter)">+100</text>
  <line x1="60" y1="160" x2="584" y2="160" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
  <text x="52" y="165" font-size="14" text-anchor="end" style="fill:var(--viz-enter)">−100</text>
  <polyline points="60,120 190,120 200,40 250,40 260,200 310,200 320,40 370,40 380,120 584,120" style="fill:none;stroke:var(--viz-y);stroke-width:4;stroke-linejoin:round"/>
  <text x="285" y="222" font-size="14" text-anchor="middle" style="fill:var(--c-text)">+220, −220, +220</text>`);

const SVG_CHART_PITCH = chartFrame('Đồ thị C: góc chúc cẳng tay (pitch)', 'độ (°)', `
  <line x1="60" y1="82" x2="584" y2="82" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
  <text x="52" y="87" font-size="14" text-anchor="end" style="fill:var(--viz-enter)">+25</text>
  <line x1="60" y1="102" x2="584" y2="102" style="stroke:var(--viz-exit);stroke-width:2;stroke-dasharray:3 4"/>
  <text x="52" y="107" font-size="14" text-anchor="end" style="fill:var(--viz-exit)">+12</text>
  <polyline points="60,120 150,120 170,67 210,67 230,120 270,120 290,67 330,67 350,120 584,120" style="fill:none;stroke:var(--viz-g);stroke-width:4;stroke-linejoin:round"/>
  <text x="250" y="56" font-size="14" text-anchor="middle" style="fill:var(--c-text)">2 lần ≈ +35°, mỗi lần &lt; 0,7 s</text>`);

const SVG_HELP_DIPS = chartFrame('Một lệnh HELP: 2 lần nhấp cẳng tay', 'góc chúc (°)', `
  <line x1="60" y1="82" x2="584" y2="82" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
  <text x="52" y="87" font-size="14" text-anchor="end" style="fill:var(--viz-enter)">25</text>
  <line x1="60" y1="102" x2="584" y2="102" style="stroke:var(--viz-exit);stroke-width:2;stroke-dasharray:3 4"/>
  <text x="52" y="107" font-size="14" text-anchor="end" style="fill:var(--viz-exit)">12</text>
  <polyline points="60,120 130,120 150,64 190,64 210,120 260,120 280,64 320,64 340,120 584,120" style="fill:none;stroke:var(--viz-g);stroke-width:4;stroke-linejoin:round"/>
  <text x="180" y="52" font-size="14" text-anchor="middle" style="fill:var(--c-text)">lần 1 ≤ 0,7 s</text>
  <text x="310" y="52" font-size="14" text-anchor="middle" style="fill:var(--c-text)">lần 2 ≤ 0,7 s</text>
  <line x1="140" y1="160" x2="350" y2="160" style="stroke:var(--c-primary);stroke-width:2"/>
  <text x="245" y="182" font-size="14" text-anchor="middle" style="fill:var(--c-primary)">cả hai trong ≤ 2 s</text>
  <text x="380" y="80" font-size="16" font-weight="700" style="fill:var(--c-success)">→ HELP</text>`);

const helpPanel = (x, label, id, name, pts) => `<g data-hotspot="${id}" data-label="${name}">
    <rect x="${x}" y="8" width="200" height="226" rx="10" style="fill:var(--c-surface);stroke:var(--c-border)"/>
    <text x="${x + 100}" y="34" font-size="18" font-weight="700" text-anchor="middle" style="fill:var(--c-text)">${label}</text>
    <line x1="${x + 12}" y1="200" x2="${x + 188}" y2="200" style="stroke:var(--c-muted);stroke-width:1"/>
    <line x1="${x + 12}" y1="120" x2="${x + 188}" y2="120" style="stroke:var(--viz-enter);stroke-width:2;stroke-dasharray:8 5"/>
    <polyline points="${pts.map(([px, py]) => (x + px) + ',' + py).join(' ')}" style="fill:none;stroke:var(--viz-g);stroke-width:4;stroke-linejoin:round"/>
  </g>`;

const SVG_HELP_CHOICES = `<svg viewBox="0 0 640 262" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  ${helpPanel(8, 'A', 'one-dip', 'Đồ thị A', [[12, 200], [62, 200], [77, 90], [102, 90], [117, 200], [188, 200]])}
  ${helpPanel(220, 'B', 'two-dips', 'Đồ thị B', [[12, 200], [37, 200], [50, 90], [70, 90], [83, 200], [103, 200], [116, 90], [136, 90], [149, 200], [188, 200]])}
  ${helpPanel(432, 'C', 'hold', 'Đồ thị C', [[12, 200], [42, 200], [72, 90], [188, 90]])}
  <text x="320" y="256" font-size="14" text-anchor="middle" style="fill:var(--c-muted)">Vạch đỏ đứt = 25°, trục ngang = thời gian (≈ 3 s)</text>
</svg>`;

export default {
  id: 'u03',
  title: 'Cảm biến IMU: vòng tay "cảm" cổ tay thế nào',
  description: 'Gia tốc kế thấy trọng lực, atan2 đổi x, z thành góc nghiêng, pitch cho HELP, con quay đo tốc độ xoay.',
  color: 'green',
  icon: '🧭',
  glossary: [
    { term: 'gia tốc kế', en: 'accelerometer', def: 'Cảm biến đo gia tốc theo 3 trục X, Y, Z, đơn vị g. Khi đứng yên nó "thấy" trọng lực 1 g, nhờ đó biết vòng tay đang nghiêng thế nào.' },
    { term: 'con quay hồi chuyển', en: 'gyroscope', def: 'Cảm biến đo tốc độ xoay quanh 3 trục, đơn vị °/s (độ mỗi giây). Đứng yên thì gần 0, kể cả khi đang nghiêng.' },
    { term: 'trọng lực', en: 'gravity', def: 'Lực Trái Đất kéo mọi vật xuống dưới. Gia tốc kế đứng yên đo được đúng 1 g hướng thẳng đứng.' },
    { term: 'trục', en: 'axis', def: 'Một hướng đo của cảm biến. Ở tư thế trung tính của BandW: X là trục nghiêng trái/phải, Y chạy dọc cẳng tay, Z hướng lên.' },
    { term: 'góc nghiêng', en: 'roll', def: 'Góc nghiêng cổ tay sang trái hoặc phải, tính bằng atan2(x, z) rồi trừ mốc trung tính. Âm là trái (WATER), dương là phải (FOOD).' },
    { term: 'góc chúc', en: 'pitch', def: 'Góc cẳng tay chúc xuống hoặc ngóc lên (trục Y nghiêng theo), tính bằng asin(y / |a|) rồi trừ mốc trung tính. Lệnh HELP dùng góc này.' },
    { term: 'atan2', en: 'two-argument arctangent', def: 'Hàm nhận hai cạnh (x, z) và trả về hướng của chúng, từ −180° đến 180°. Biết được cả trái/phải và không bị chia cho 0.' },
    { term: 'radian', en: 'radian', def: 'Một đơn vị đo góc: 180° = π radian. Nhân với 57.2957795 (= 180/π) để đổi radian sang độ.' },
    { term: 'hiệu chuẩn', en: 'calibration', def: 'Bước vòng tay ghi lại tư thế nghỉ của người đeo: lấy trung bình 100 mẫu yên (2 giây) làm mốc trung tính.' },
    { term: 'mốc trung tính', en: 'baseline', def: 'Góc của tư thế trung tính, ghi lại lúc hiệu chuẩn. Firmware lấy góc hiện tại trừ mốc này, nên mỗi người có "số 0" của riêng mình.' },
    { term: 'độ lớn gia tốc', en: 'magnitude |a|', def: '|a| = √(x² + y² + z²). Tay đứng yên thì ≈ 1 g; lệch nhiều khỏi 1 g nghĩa là đang va chạm hoặc chuyển động mạnh.' },
  ],
  lessons: [
    // ───────────────────────────── L1 ─────────────────────────────
    {
      id: 'l1',
      title: 'Gia tốc kế và trọng lực',
      minutes: 10,
      goal: 'Sau bài này, em sẽ giải thích được vì sao cảm biến đứng yên vẫn đo được 1 g và 1 g đó chia sang các trục ra sao.',
      steps: [
        { type: 'sim', title: 'Kéo thử bo mạch', sim: 'imu-axes-3d', props: { mode: 'accel', interactive: true, preset: 'neutral', showBars: true },
          caption: 'Kéo bo mạch (hoặc dùng phím mũi tên) để nghiêng. Mũi tên tím là trọng lực, luôn chỉ thẳng xuống; ba thanh ax, ay, az cho biết nó "rơi" vào trục nào.' },
        { type: 'text', title: 'Quả bóng trong hộp',
          body: '[[gia tốc kế]] (accelerometer) giống một quả bóng nhỏ trong hộp: hộp đứng yên thì bóng luôn bị [[trọng lực]] (gravity) kéo về phía thấp. Bo nằm phẳng thì cả 1 g dồn vào [[trục]] (axis) Z; nghiêng sang bên thì 1 g ấy chia một phần sang X.' },
        { type: 'diagram', title: 'Ba trục trên cẳng tay', name: 'imu-axes',
          caption: 'X: trục nghiêng trái/phải, Y: chạy dọc cẳng tay, Z: hướng lên trời khi để tay ở tư thế trung tính.',
          alt: 'Bo mạch trên cẳng tay với ba mũi tên: X đỏ sang ngang, Y xanh lá dọc cẳng tay, Z xanh dương hướng lên.' },
        { type: 'sim', title: 'Tham quan 5 tư thế', sim: 'imu-axes-3d', props: { mode: 'accel', tour: true, showBars: true, interactive: false },
          caption: 'Bấm ▶ để đi qua: trung tính, nghiêng trái, nghiêng phải, chúc trước, dựng đứng. Để ý thanh nào dài ra, thanh nào ngắn lại ở mỗi tư thế.' },
        { type: 'text', title: 'Tổng luôn gần 1 g khi tay yên',
          body: 'Dù nghiêng thế nào, [[độ lớn gia tốc]] |a| = √(x²+y²+z²) vẫn ≈ 1 g khi tay đứng yên. Khi va chạm hoặc lắc mạnh, |a| lệch khỏi 1 g, nên firmware chỉ tin góc khi |a| nằm trong khoảng **0,85–1,15 g**.' },
        { type: 'number', id: 'u03.l1.q1', prompt: 'Bo nằm phẳng, đứng yên ở tư thế trung tính. Thanh **az** chỉ khoảng bao nhiêu g?',
          visual: { kind: 'sim', sim: 'imu-axes-3d', props: { mode: 'accel', preset: 'neutral', interactive: false, showBars: true } },
          answer: 1, tolerance: 0.05, unit: 'g',
          explanation: 'Nằm phẳng thì toàn bộ trọng lực rơi vào trục Z: az ≈ **1 g**, còn ax và ay ≈ 0.' },
        { type: 'hotspot', id: 'u03.l1.q2', prompt: 'Chạm vào trục chạy **dọc theo cẳng tay**.',
          target: { kind: 'diagram', name: 'imu-axes' }, answer: 'axis-y',
          explanation: 'Trục **Y** chạy dọc cẳng tay. Cẳng tay chúc xuống hay ngóc lên thì trục này nghiêng theo: lệnh HELP dựa vào đó (bài 4, "Góc chúc cẳng tay (pitch) cho HELP").' },
        { type: 'sim-predict', id: 'u03.l1.q3', prompt: 'Bo sắp chuyển từ trung tính sang **nghiêng trái**. Ba thanh sẽ thay đổi thế nào?',
          sim: 'imu-axes-3d', props: { mode: 'accel', tour: true, showBars: true, interactive: false }, pauseAt: 'neutral', revealTo: 'left',
          options: ['ax lệch khỏi 0, az giảm bớt', 'Chỉ ay thay đổi', 'Cả ba thanh đứng yên', 'az tăng lên 2 g'], answer: 0,
          explanation: 'Nghiêng trái/phải là xoay trong mặt phẳng X–Z: một phần trọng lực chuyển từ Z sang X, nên ax lệch khỏi 0 còn az nhỏ lại. Tổng vẫn ≈ 1 g.' },
        { type: 'mcq', id: 'u03.l1.q4', prompt: 'Nghiêng hẳn cổ tay sang một bên **90°** (đứng yên). Trục nào đo được ≈ ±1 g?',
          options: ['X', 'Y', 'Z', 'Không trục nào'], answer: 0,
          explanation: 'Nghiêng 90° thì trục X chỉ thẳng xuống đất, nên toàn bộ 1 g rơi vào X; az còn ≈ 0.' },
        { type: 'truefalse', id: 'u03.l1.q5', prompt: 'Khi lắc tay mạnh hoặc va chạm, |a| có thể khác xa 1 g.',
          answer: true,
          explanation: 'Đúng. Lúc đó gia tốc kế đo cả trọng lực lẫn cú giật. Vì vậy firmware coi |a| ngoài 0,85–1,15 g là "đang chuyển động" và chưa tin góc. Bài kiểm thử có ca |a| = 1,7 g: không phát lệnh nào.' },
        { type: 'mcq', id: 'u03.l1.q6', prompt: 'Nghiêng cổ tay 30° rồi giữ yên. So với lúc nằm phẳng, **az** tăng hay giảm?',
          options: ['Giảm, còn khoảng 0,87 g', 'Tăng lên khoảng 1,3 g', 'Giữ nguyên 1 g', 'Giảm về 0'], answer: 0,
          hint: 'Trọng lực phải chia một phần sang trục X.',
          explanation: 'az = cos 30° ≈ **0,87 g**, còn ax ≈ sin 30° = 0,5 g. Một phần trọng lực đã chuyển sang trục X.' },
        { type: 'flashcard', id: 'u03.l1.q7', topic: "Cảm biến IMU & góc", prompt: 'Giám khảo hỏi: "Gia tốc kế đo gì? Vòng tay đứng yên thì gia tốc phải bằng 0 chứ?"',
          modelAnswer: "Gia tốc kế đo gia tốc theo 3 trục, **kể cả trọng lực**. Đứng yên thì nó đo đúng 1 g hướng xuống. Khi nghiêng, 1 g này chia sang các trục X, Z khác nhau, nên từ tỉ lệ x và z ta tính được **góc nghiêng**. Nếu |a| ra ngoài khoảng **0,85–1,15 g** thì tay đang chuyển động, firmware chưa xét nghiêng.",
          keyPoints: ['Đo cả trọng lực: đứng yên ≈ 1 g', 'Nghiêng → 1 g chia sang các trục', 'Từ x, z tính được góc', '|a| ngoài 0,85–1,15 g → chưa tin'],
          explanation: 'Có thể minh hoạ bằng "quả bóng trong hộp" cho giám khảo không chuyên.' },
        { type: 'flashcard', id: 'u03.l1.q8', topic: 'Gia tốc kế & trọng lực', prompt: 'Giám khảo hỏi: "Đặt vòng tay nằm yên trên bàn, mặt linh kiện hướng lên, thì ba trục đọc ra bao nhiêu?"',
          modelAnswer: 'Khoảng **x ≈ 0, y ≈ 0, z ≈ 1 g**, cộng thêm chút nhiễu. Bàn đỡ vòng tay chống lại trọng lực, nên gia tốc kế đo được 1 g dọc theo trục vuông góc với mặt bo, tức trục Z. Lật úp bo thì z ≈ −1 g. Con quay lúc này báo gần 0 °/s vì không xoay. Độ lớn |a| = √(x² + y² + z²) ≈ 1 g, nằm trong khoảng 0,85–1,15 g nên firmware coi đây là mẫu **đứng yên, tin được**. Đây cũng là cách nhanh để kiểm tra cảm biến còn chạy đúng.',
          keyPoints: ['x ≈ 0, y ≈ 0, z ≈ 1 g', 'Trọng lực dồn vào trục vuông góc mặt bo', 'Lật úp: z ≈ −1 g', 'Con quay ≈ 0 °/s', '|a| ≈ 1 g → mẫu tin được'],
          explanation: 'Có thể bật log IMU (gửi `d` qua Serial) để cho giám khảo xem số thật.' },
        { type: "flashcard", id: "u03.l1.q9", topic: "Gia tốc kế & trọng lực", prompt: "Giám khảo hỏi: \"Nói trong một câu: nguyên lý khoa học cốt lõi của BandW là gì?\"",
          modelAnswer: "**Trọng lực luôn hướng xuống và lớn 1 g**, nên khi cẳng tay nghiêng, gia tốc kế thấy 1 g đó chia lại lên các trục, và từ tỉ lệ x với z em tính ra góc nghiêng bằng atan2. Đó là câu chính. Thêm hai ý: **con quay** đo tốc độ xoay để nhận cú lắc, và **ngưỡng cộng thời gian** (22° vào, 12° ra, giữ 250 ms) biến góc và tốc độ thành lệnh. Không có học máy: mọi quyết định giải thích được bằng vật lý và vài hằng số trong `GestureDetector.h`.",
          keyPoints: ["Trọng lực 1 g chia lên các trục khi nghiêng", "Tỉ lệ x, z cho ra góc bằng atan2", "Con quay đo tốc độ xoay cho cú lắc", "Ngưỡng cộng thời gian biến góc thành lệnh"],
          explanation: "Tập nói câu đầu trong 10 giây, rồi mới thêm chi tiết nếu giám khảo hỏi tiếp." },
      ],
    },
    // ───────────────────────────── L2 ─────────────────────────────
    {
      id: 'l2',
      title: 'Từ x, z ra góc nghiêng: atan2',
      minutes: 12,
      goal: 'Sau bài này, em sẽ tính nhẩm được góc nghiêng từ x, z và biết khi nào firmware không tin góc đó.',
      steps: [
        { type: 'video', id: 'v-imu-tilt', title: 'Cảm biến IMU và góc nghiêng',
          caption: 'Xem cách trọng lực chia thành hai cạnh x, z và cách atan2 biến chúng thành một góc.',
          fallbackSim: { sim: 'tilt-angle', props: { showFormula: true, showComponents: true } } },
        { type: 'sim', title: 'Kéo cổ tay, xem góc', sim: 'tilt-angle', props: { enterDeg: 22, exitDeg: 12, initialDeg: 0, showFormula: true, showComponents: true },
          caption: 'Kéo cổ tay hoặc thanh trượt: hai cạnh x (đỏ) và z (xanh) co giãn, công thức tính lại góc. Vượt 22° về bên trái là vùng WATER, về bên phải là vùng FOOD.' },
        { type: 'text', title: 'atan2 là "la bàn mini"',
          body: '[[atan2]] nhận hai cạnh x và z rồi trả về hướng của mũi tên trọng lực, từ −180° đến 180°. Vì dùng **cả hai** cạnh, nó biết cả dấu (trái hay phải) và không bao giờ phải chia cho 0. Kết quả ở đơn vị [[radian]], nên nhân 57.2957795 (= 180/π) để đổi ra độ.' },
        { type: 'code', title: 'Mã thật: tính góc nghiêng', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: `    static float angle(float x, float z) { return atan2f(x, z) * 57.2957795f; }
    static float wrap(float degrees) {
        while (degrees > 180) degrees -= 360;
        while (degrees < -180) degrees += 360;
        return degrees;
    }
// …
        bool level = sqrtf(x*x + z*z) >= MIN_PLANE_G;
        if (level) {
            float tilt = TILT_SIGN * wrap(angle(x, z) - baseline);
            filtered += 0.22f * wrap(tilt - filtered);
            filtered = wrap(filtered);
        }`,
          highlight: [1, 10],
          caption: 'Dòng 1: góc = atan2(x, z) đổi ra độ. Dòng 10: lấy góc hiện tại trừ mốc trung tính. Dòng 11: làm mượt, mỗi mẫu chỉ tiến 22% về giá trị mới.',
          notes: [
            { lines: [2, 6], note: 'wrap() đưa góc về khoảng −180..180°, để 190° được hiểu là −170° chứ không nhảy lung tung.' },
            { lines: [8, 8], note: 'level: hình chiếu trên mặt X–Z phải ≥ 0,4 g. Nhỏ hơn thì cẳng tay gần dựng đứng, góc không tin được.' },
          ] },
        { type: 'sim', title: 'Khi cẳng tay dựng đứng', sim: 'imu-axes-3d', props: { mode: 'accel', preset: 'vertical', showBars: true, interactive: true },
          caption: 'Giơ cẳng tay thẳng đứng: trọng lực dồn hết vào trục Y, x và z gần 0. Khi √(x²+z²) < 0,4 g, firmware **khoá** góc nghiêng, không phát WATER/FOOD.' },
        { type: 'text', title: 'Mỗi người một "số 0"',
          body: 'Mỗi người để tay nghỉ ở một góc khác nhau, nên firmware lấy góc hiện tại **trừ** [[mốc trung tính]] (baseline) ghi lúc hiệu chuẩn. Nhờ vậy, ai đeo lệch một chút thì "số 0" vẫn là tư thế nghỉ của chính người đó.' },
        { type: 'number', id: 'u03.l2.q1', prompt: 'Cảm biến đo x = 0,5 g và z = 0,87 g. Góc `atan2(x, z)` khoảng bao nhiêu độ?',
          answer: 30, tolerance: 2, unit: '°',
          hint: 'sin 30° = 0,5 và cos 30° ≈ 0,87.',
          explanation: 'x = sin θ, z = cos θ, nên θ ≈ **30°**. Kéo thanh trượt trong mô phỏng tới 30° để kiểm chứng.' },
        { type: 'number', id: 'u03.l2.q2', prompt: 'Nếu x = z (cả hai cùng dương), góc nghiêng bằng bao nhiêu độ?',
          answer: 45, tolerance: 1, unit: '°',
          explanation: 'Hai cạnh bằng nhau thì mũi tên nằm đúng giữa hai trục: **45°**.' },
        { type: 'mcq', id: 'u03.l2.q3', prompt: 'Vì sao firmware dùng `atan2(x, z)` thay vì chỉ nhìn giá trị x?',
          options: ['Dùng cả hai cạnh nên biết đúng hướng (trái/phải) và không phụ thuộc tổng độ lớn', 'Vì x luôn bằng 0', 'Vì atan2 chạy nhanh hơn phép cộng', 'Vì điện thoại yêu cầu như vậy'], answer: 0,
          explanation: 'Chỉ nhìn x thì |a| thay đổi một chút là góc sai theo. Tỉ lệ x với z mới cho hướng thật; atan2 còn tránh chia cho 0 khi z = 0.' },
        { type: 'mcq', id: 'u03.l2.q4', prompt: 'Con số `57.2957795` trong hàm `angle()` là gì?',
          options: ['180 / π, dùng để đổi radian sang độ', 'Góc nghiêng tối đa của cổ tay', 'Số mẫu cần để hiệu chuẩn', 'Ngưỡng tốc độ lắc'], answer: 0,
          explanation: '`atan2f` trả kết quả bằng [[radian]]. 1 radian ≈ 57,3°, nên nhân với 180/π để ra độ.' },
        { type: 'truefalse', id: 'u03.l2.q5', prompt: 'Khi cẳng tay dựng thẳng đứng, BandW vẫn đo nghiêng trái/phải chính xác.',
          answer: false,
          explanation: 'Sai. Khi √(x²+z²) < `MIN_PLANE_G` = 0,4 g, x và z quá nhỏ nên góc chỉ toàn nhiễu. Firmware giữ nguyên góc cũ và chặn WATER/FOOD.' },
        { type: 'hotspot', id: 'u03.l2.q6', prompt: 'Chạm vào vùng mà góc phải vượt vào thì mới tính là **nghiêng trái**.',
          target: { kind: 'sim', sim: 'tilt-angle', props: { enterDeg: 22, exitDeg: 12, showFormula: false, showComponents: false } }, answer: 'enter-zone-left',
          explanation: 'Vùng nghiêng trái bắt đầu từ −22° (`TILT_ENTER_DEG`). Dải giữa ±12° là vùng trung tính.' },
        { type: 'mcq', id: 'u03.l2.q7', prompt: 'Góc nghiêng (đã trừ mốc) là **−30°** và được giữ yên. Đây là cử chỉ nào? (với `TILT_SIGN = 1`)',
          options: ['Nghiêng trái → WATER', 'Nghiêng phải → FOOD', 'Không phải cử chỉ nào', 'Nhấp cẳng tay 2 lần → HELP'], answer: 0,
          explanation: 'Góc âm là nghiêng **trái** → WATER; −30° đã vượt ngưỡng 22°. Nếu đeo ngược khiến trái/phải bị đảo, đổi `TILT_SIGN` thành −1 rồi nạp lại.' },
        { type: 'flashcard', id: 'u03.l2.q8', topic: "Cảm biến IMU & góc", prompt: 'Giám khảo hỏi: "atan2 là gì? Em giải thích cho người không học lập trình nghe."',
          modelAnswer: 'Khi vòng tay nghiêng, trọng lực chia thành hai phần: **x** (sang ngang) và **z** (thẳng đứng). atan2 giống một **la bàn**: đưa vào hai phần đó, nó cho biết mũi tên trọng lực đang chỉ hướng nào, tức tay nghiêng bao nhiêu độ và về **bên nào**. Firmware trừ mốc trung tính, làm mượt, rồi so với ngưỡng 22°.',
          keyPoints: ['Trọng lực chia thành x và z', 'atan2 ra hướng, có dấu trái/phải', 'Trừ mốc trung tính', 'So với ngưỡng 22°'],
          explanation: 'Thêm điểm cộng: atan2 không bị chia cho 0 như phép arctan(x/z) thông thường.' },
        { type: 'flashcard', id: 'u03.l2.q9', topic: 'atan2 & góc nghiêng', prompt: 'Giám khảo hỏi: "Sao không chỉ nhìn trục x, x lớn là tay nghiêng, cho đơn giản?"',
          modelAnswer: 'Chỉ dùng x sẽ sai khi cẳng tay **chúc lên hay xuống**: trọng lực dồn bớt sang trục y, x nhỏ đi dù độ nghiêng trái/phải không đổi. atan2 dùng **tỉ lệ x : z**; khi chúc tay, x và z cùng nhỏ đi theo một tỉ lệ nên góc vẫn đúng. Thứ hai, x lớn nhất ở 90° rồi giảm lại, nên 60° và 120° cho cùng một x; atan2 phân biệt được nhờ **dấu của z**. Sau đó firmware còn **trừ mốc trung tính** rồi mới so với ngưỡng 22°.',
          keyPoints: ['Chúc tay làm x nhỏ đi', 'atan2 dùng tỉ lệ x : z nên không bị ảnh hưởng', '60° và 120° cùng x; atan2 nhờ dấu z', 'Trừ mốc rồi so 22°'],
          explanation: 'Kéo sim góc nghiêng để chỉ: x và z cùng đổi, nhưng góc chỉ phụ thuộc tỉ lệ giữa chúng.' },
      ],
    },
    // ─────────────── L6 (hiển thị là bài 3): hiệu chuẩn ───────────────
    {
      id: 'l6',
      title: 'Hiệu chuẩn: tìm "số 0" của từng người',
      minutes: 11,
      goal: 'Sau bài này, em sẽ giải thích được vòng tay hiệu chuẩn thế nào, khi nào, và vì sao người run tay vẫn dùng được.',
      steps: [
        { type: 'video', id: 'v-calibration', title: 'Hiệu chuẩn tư thế trung tính',
          caption: 'Xem vòng tay lấy 100 mẫu khi tay nghỉ, loại mẫu rung, rồi lấy trung bình làm mốc.',
          fallbackSim: { sim: 'calibration', props: { tremor: 0, showFormula: true } } },
        { type: 'sim', title: '100 mẫu trong 2 giây', sim: 'calibration', props: { tremor: 0, showFormula: true },
          caption: 'Bấm ▶: mỗi chấm là một mẫu đọc sau 20 ms. Vòng tròn đầy khi đủ 100 mẫu yên, rồi trung bình x, y, z trở thành mốc trung tính.' },
        { type: 'text', title: 'Mẫu nào được nhận?',
          body: '[[hiệu chuẩn]] (calibration) chỉ nhận mẫu khi tay **yên**: độ lớn gia tốc trong 0,85–1,15 g, con quay dưới 20 °/s ở mỗi trục, và lệch trung bình các mẫu trước dưới 0,08 g. Đủ **100 mẫu** thì lấy trung bình làm [[mốc trung tính]].' },
        { type: 'code', title: 'Mã thật: bộ hiệu chuẩn', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: `    static const int SAMPLES = 100, MAX_REJECTS = 10;
// …
        bool ok = m > 0.85f && m < 1.15f && sqrtf(x*x + z*z) > 0.6f
            && fabsf(gx) < 20 && fabsf(gy) < 20 && fabsf(gz) < 20
            && (!n || (fabsf(x - sx/n) < 0.08f && fabsf(y - sy/n) < 0.08f && fabsf(z - sz/n) < 0.08f));
        if (!ok) { if (++rejects > MAX_REJECTS) reset(); return false; }
        sx += x; sy += y; sz += z;
        if (++n < SAMPLES) return false;
        meanX = sx / n; meanY = sy / n; meanZ = sz / n;`,
          highlight: [6, 9],
          caption: 'Dòng 3–5: điều kiện một mẫu "yên". Dòng 6: mẫu rung bị loại; quá 10 mẫu rung thì reset() đếm lại. Dòng 9: đủ 100 mẫu thì lấy trung bình.',
          notes: [
            { lines: [3, 3], note: '√(x²+z²) > 0,6 g: cẳng tay không được dựng đứng lúc hiệu chuẩn, nếu không góc nghiêng sẽ không có nghĩa.' },
            { lines: [7, 8], note: 'Cộng dồn x, y, z của mẫu tốt; chưa đủ 100 thì trả về false (chưa xong).' },
          ] },
        { type: 'sim', title: 'Người run tay thì sao?', sim: 'calibration', props: { tremor: 0.8, showFormula: false },
          caption: 'Kéo thanh "Run tay": run nhẹ thì vài mẫu bị loại nhưng vẫn xong. Run mạnh liên tục thì quá 10 mẫu rung và phải đếm lại.' },
        { type: 'sim-predict', id: 'u03.l6.q1', prompt: 'Tay run mạnh, bộ đếm mẫu rung đang tăng. Khi vượt quá 10 mẫu rung thì chuyện gì xảy ra?',
          sim: 'calibration', props: { tremor: 0.8, showFormula: false }, pauseAt: 'rejected', revealTo: 'done',
          options: ['Xoá hết, đếm lại 100 mẫu từ 0', 'Bỏ qua mẫu rung, vẫn hiệu chuẩn xong ngay', 'Vòng tay tắt nguồn', 'Vòng tay gửi lệnh HELP'],
          answer: 0,
          hint: 'Xem dòng `if (++rejects > MAX_REJECTS) reset();`.',
          explanation: 'Quá `MAX_REJECTS = 10` mẫu rung thì `reset()` xoá tổng và số mẫu, đếm lại từ 0. Nhờ vậy mốc không bị lấy từ một tay đang cử động.' },
        { type: 'text', title: 'Khi nào vòng tay hiệu chuẩn?',
          body: 'Khi **bật nguồn**, khi app gửi lệnh **CALIBRATE**, khi app kết nối lần đầu mà lần hiệu chuẩn trước làm lúc chưa có app, và khi cảm biến lỗi liên tục **1 giây** (50 mẫu). Xong thì board gửi chữ **READY** cho app.' },
        { type: 'code', title: 'Mã thật: lúc nào hiệu chuẩn lại', language: 'cpp', source: 'firmware/BandW_Sense/BandW_Sense.ino',
          code: `        if (value == "CALIBRATE") resetCalibration();
// …
        // A calibration taken before any app connected (often on a table after power-on) is redone once worn.
        if (subscribed && calibrated && !calibratedWithApp) resetCalibration();
// …
        if (++badSamples == 50 && calibrated) resetCalibration();
// …
        if (calibrator.add(x, y, z, gx, gy, gz)) {
            detector.calibrate(calibrator.meanX, calibrator.meanY, calibrator.meanZ, now);
            calibrated = true; calibratedWithApp = subscribed;
            controlCharacteristic.writeValue("READY");`,
          highlight: [1, 11],
          caption: 'Dòng 1: app yêu cầu. Dòng 4: hiệu chuẩn lại khi vừa có app, vì lúc bật nguồn vòng tay thường còn nằm trên bàn. Dòng 6: lỗi 1 giây. Dòng 8–11: xong thì báo READY.',
          notes: [{ lines: [9, 9], note: 'detector.calibrate() lưu mốc góc nghiêng và mốc góc gập từ x, y, z trung bình.' }] },
        { type: 'hotspot', id: 'u03.l6.q2', prompt: 'Chạm vào phần cho biết vòng tay **đã loại bao nhiêu mẫu rung**.',
          target: { kind: 'sim', sim: 'calibration', props: { tremor: 0.8, showFormula: true } }, answer: 'reject-counter',
          explanation: 'Bộ đếm mẫu rung chính là biến `rejects`. Nó vượt 10 thì cả lượt bắt đầu lại.' },
        { type: 'number', id: 'u03.l6.q3', prompt: 'Vòng tay cần 100 mẫu yên, cứ 20 ms đọc một mẫu. Nếu không có mẫu rung nào, hiệu chuẩn mất bao nhiêu giây?',
          answer: 2, tolerance: 0, unit: 'giây',
          explanation: '100 × 20 ms = 2000 ms = **2 giây**.' },
        { type: 'mcq', id: 'u03.l6.q4', prompt: 'Bạn A để tay nghỉ đã nghiêng trái sẵn 15°. Nếu **không** hiệu chuẩn (coi 0° là thẳng), A chỉ cần nghiêng thêm bao nhiêu nữa là vượt ngưỡng 22°?',
          options: ['7°', '15°', '22°', '37°'], answer: 0,
          explanation: '22 − 15 = **7°**: một cử động rất nhỏ cũng thành WATER. Có hiệu chuẩn thì 15° trở thành "số 0" của A, A phải nghiêng thêm đủ 22°.' },
        { type: 'truefalse', id: 'u03.l6.q5', prompt: 'App tự đếm 2 giây là biết hiệu chuẩn xong, board không cần báo gì.',
          answer: false,
          explanation: 'Sai. Tay run có thể làm lượt hiệu chuẩn kéo dài. Chỉ khi board ghi chữ **READY** lên đặc tính điều khiển thì app mới biết chắc đã xong.' },
        { type: 'order', id: 'u03.l6.q6', prompt: 'Sắp xếp các bước hiệu chuẩn theo đúng thứ tự.',
          items: ['Người đeo giữ yên tay ở tư thế nghỉ', 'Nhận từng mẫu yên, loại mẫu rung', 'Đủ 100 mẫu thì lấy trung bình x, y, z', 'Tính mốc góc nghiêng và mốc góc gập', 'Gửi READY cho app'],
          explanation: 'Mốc được tính từ trung bình, rồi board mới báo READY. Từ đó mọi góc đều đo so với mốc riêng của người đeo.' },
        { type: 'flashcard', id: 'u03.l6.q7', topic: "Cảm biến IMU & góc", prompt: 'Giám khảo hỏi: "Vì sao phải hiệu chuẩn? Người bị run tay có dùng được không?"',
          modelAnswer: 'Mỗi người để tay nghỉ ở một góc khác nhau, nên vòng tay lấy **100 mẫu yên** (2 giây) và dùng trung bình làm **mốc trung tính**; mọi góc sau đó đo so với mốc này. Run **nhẹ**: firmware chịu được **10 mẫu rung** mỗi lượt nên vẫn xong. Run **mạnh, liên tục**: lượt hiệu chuẩn bị đếm lại nhiều lần; đây là hạn chế cần thử nghiệm với người dùng thật.',
          keyPoints: ['Mỗi người một tư thế nghỉ', '100 mẫu yên → trung bình = mốc', 'Chịu 10 mẫu rung mỗi lượt', 'Run mạnh: hạn chế, cần thử nghiệm'],
          explanation: 'Nói rõ phần nào đã kiểm thử (gesture_test.cpp có ca "jitter") và phần nào chưa đo trên người thật.' },
        { type: 'flashcard', id: 'u03.l6.q8', topic: 'Hiệu chuẩn', prompt: 'Giám khảo hỏi: "Lỡ vòng tay hiệu chuẩn lúc còn nằm trên bàn thì mốc trung tính có sai không?"',
          modelAnswer: 'Có thể sai, vì tư thế nằm trên bàn khác tư thế tay nghỉ của người dùng. Firmware đã tính đến chuyện này: nếu vòng tay hiệu chuẩn **trước khi app kết nối**, ví dụ nằm trên bàn sau khi bật, thì lúc app đăng ký nhận lệnh nó **tự hiệu chuẩn lại một lần** (biến `calibratedWithApp`). Khi đó người dùng đã đeo vòng, chỉ cần giữ tay yên 2 giây. App chỉ báo xong khi vòng tay gửi chữ **READY**. Ngoài ra, nút **Hiệu chuẩn** trong app cho phép làm lại bất cứ lúc nào.',
          keyPoints: ['Tư thế trên bàn ≠ tư thế nghỉ', 'App kết nối → tự hiệu chuẩn lại một lần', 'Giữ tay yên 2 giây, chờ READY', 'Nút Hiệu chuẩn trong app'],
          explanation: 'Chi tiết `calibratedWithApp` cho thấy em đọc code thật, không chỉ học thuộc.' },
        { type: 'flashcard', id: 'u03.l6.q9', topic: 'Đeo sai hướng', prompt: 'Giám khảo hỏi: "Dây đeo lỏng, vòng tay bị xoay quanh cổ tay thì sao?"',
          modelAnswer: 'Xoay quanh cổ tay là xoay quanh **trục dọc cẳng tay**, đúng trục của góc nghiêng trái/phải. Nên nếu xoay rồi **hiệu chuẩn lại**, mốc trung tính mới bù hết và các cử chỉ vẫn đúng. Nguy hiểm là vòng tay **trượt trong lúc dùng**: trượt quá 22° rồi nằm yên có thể bị hiểu là một lần nghiêng và phát nhầm WATER hoặc FOOD. Sau đó tay không về được mốc cũ nên vòng tay **không nhận lệnh nữa** cho đến khi hiệu chuẩn lại. Vì vậy board phải **gắn chắc**; ca này nhóm chưa thử thực tế.',
          keyPoints: ['Xoay quanh cổ tay = xoay đúng trục nghiêng', 'Hiệu chuẩn lại thì bù được', "Trượt khi đang dùng: có thể phát nhầm một lần", 'Rồi không nhận lệnh đến khi hiệu chuẩn lại', 'Phải gắn chắc; chưa thử thực tế'],
          explanation: 'Khác với đặt bo xoay 90° trên mặt cổ tay (trục x, y đổi chỗ, phải sửa code). Hãy phân biệt hai trường hợp.' },
      ],
    },
    // ───────────────────────────── L3 ─────────────────────────────
    {
      id: 'l3',
      title: 'Góc chúc cẳng tay (pitch) cho HELP',
      minutes: 12,
      goal: 'Sau bài này, em sẽ giải thích được HELP được nhận ra thế nào và vì sao tư thế hằng ngày không gọi giúp nhầm.',
      steps: [
        { type: 'sim', title: 'Chúc cẳng tay xuống', sim: 'imu-axes-3d', props: { mode: 'accel', preset: 'forward', showBars: true, interactive: true },
          caption: 'Ở tư thế này, trục Y (dọc cẳng tay, mũi tên chỉ về phía khuỷu) ngóc lên nên thanh **ay** dài ra phía dương, còn ax gần như không đổi. Vòng tay nằm trên cẳng tay, nên phải nghiêng **cả cẳng tay** (gập ở khuỷu), chỉ gập bàn tay thì góc gần như không đổi.' },
        { type: 'text', title: 'Trọng lực rơi sang trục Y',
          body: 'Khi cẳng tay chúc xuống hoặc ngóc lên, một phần trọng lực rơi sang trục Y. [[góc chúc]] (pitch) = `asin(y/|a|)`: phần trọng lực nằm trên trục Y, đổi ra độ, rồi trừ mốc trung tính.' },
        { type: 'code', title: 'Mã thật: tính góc chúc', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: `static inline float pitchAngle(float x, float y, float z) {
    float m = sqrtf(x*x + y*y + z*z), s = m > 0 ? y / m : 0;
    return asinf(s > 1 ? 1 : s < -1 ? -1 : s) * 57.2957795f;
}
// …
        // Shocks (|a| far from 1 g) say nothing about the forearm angle and must not fake a HELP dip.
        if (magnitude > 0.5f && magnitude < 1.5f) filteredPitch += 0.22f * ((pitchAngle(x, y, z) - pitchBaseline) - filteredPitch);`,
          highlight: [2, 3],
          caption: 'Dòng 2: chia y cho độ lớn |a|. Dòng 3: asin đổi tỉ lệ đó thành góc. Dòng 7: trừ mốc trung tính và làm mượt giống góc nghiêng.',
          notes: [
            { lines: [3, 3], note: 'Kẹp tỉ lệ trong khoảng −1..1 để asin không bị lỗi khi số đo hơi vượt.' },
            { lines: [6, 7], note: 'Chú thích gốc: cú va đập (|a| xa 1 g) không nói gì về góc cẳng tay, nên không được dùng để giả một lần nhấp HELP.' },
          ] },
        { type: 'diagram', title: 'Một lệnh HELP trên đồ thị', svg: SVG_HELP_DIPS,
          caption: 'HELP là **2 lần nhấp** cùng chiều: góc chúc vượt 25° rồi về dưới 12°, mỗi lần tối đa 0,7 giây, cả hai trong 2 giây.',
          alt: 'Đồ thị góc chúc theo thời gian: hai xung ngắn vượt vạch 25° rồi về dưới vạch 12°, mỗi xung dưới 0,7 giây, cả hai nằm trong khung 2 giây, sau xung thứ hai có nhãn HELP.' },
        { type: 'text', title: 'Nhấp, không phải giữ',
          body: 'Đặt tay lên đùi hay đưa cốc lên miệng là **giữ yên** một góc, không phải "nhấp", nên tư thế hằng ngày không gọi giúp nhầm. Hai lần nhấp có thể chúc xuống hoặc ngóc lên, miễn là **cùng chiều**. Góc chúc còn phải hơn góc nghiêng ít nhất **8°** (`AXIS_MARGIN_DEG`), nên tư thế chéo không tính.' },
        { type: 'code', title: 'Mã thật: đếm 2 lần nhấp', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: `        float roll = fabsf(filtered), pitch = fabsf(filteredPitch);
        if (dips && uint32_t(now - firstDipAt) > HELP_WINDOW_MS) dips = 0;
        if (!dipDir) {
            if (pitch > PITCH_ENTER_DEG && pitch >= roll + AXIS_MARGIN_DEG) {
                dipDir = filteredPitch < 0 ? -1 : 1; dipStart = now;
                if (dips && dipDir != pairDir) dips = 0;
            }
        } else if (pitch < PITCH_EXIT_DEG) {
            if (uint32_t(now - dipStart) > DIP_MAX_MS) dips = 0;
            else {
                if (!dips) { firstDipAt = dipStart; pairDir = dipDir; }
                if (++dips >= 2) return emit(Gesture::Help, now);
            }
            dipDir = 0;
        } else if (uint32_t(now - dipStart) > DIP_MAX_MS) dips = 0;`,
          highlight: [4, 12],
          caption: 'Dòng 4: bắt đầu một lần nhấp khi góc chúc vượt 25° và hơn góc nghiêng 8°. Dòng 8: lần nhấp kết thúc khi về dưới 12°. Dòng 12: đủ 2 lần thì phát HELP.',
          notes: [
            { lines: [2, 2], note: 'Quá 2000 ms (HELP_WINDOW_MS) kể từ lần nhấp đầu thì đếm lại từ 0.' },
            { lines: [6, 6], note: 'Lần nhấp thứ hai khác chiều lần đầu (một xuống, một lên) thì đếm lại: không phải HELP.' },
            { lines: [9, 9], note: 'Ở ngoài lâu hơn 700 ms (DIP_MAX_MS) thì đó là giữ tư thế, không phải nhấp: đếm lại.' },
          ] },
        { type: 'mcq', id: 'u03.l3.q1', prompt: 'Chúc cẳng tay xuống chủ yếu làm thay đổi số đo trên trục nào?',
          visual: { kind: 'diagram', name: 'imu-axes', alt: 'Bo mạch trên cẳng tay với ba trục X, Y, Z.' },
          options: ['Y (dọc cẳng tay)', 'X (ngang)', 'Không trục nào', 'Chỉ con quay, không phải gia tốc kế'], answer: 0,
          explanation: 'Cẳng tay chúc xuống làm trục **Y** nghiêng theo, trọng lực rơi một phần sang Y, nên ay thay đổi.' },
        { type: 'number', id: 'u03.l3.q2', prompt: 'Nếu y / |a| = 0,5 thì góc chúc `asin(0,5)` bằng bao nhiêu độ?',
          answer: 30, tolerance: 1, unit: '°',
          hint: 'sin của góc nào bằng 0,5?',
          explanation: 'sin 30° = 0,5 nên pitch = **30°**, đã vượt ngưỡng 25° (`PITCH_ENTER_DEG`) để bắt đầu một lần nhấp.' },
        { type: 'hotspot', id: 'u03.l3.q3', prompt: 'Ba đồ thị góc chúc trong khoảng 3 giây. Chạm vào đồ thị sẽ phát **HELP**.',
          target: { kind: 'diagram', svg: SVG_HELP_CHOICES }, answer: 'two-dips',
          hint: 'Đếm số lần nhấp và để ý mỗi lần ở ngoài bao lâu.',
          explanation: 'Chỉ **B** có 2 lần nhấp nhanh cùng chiều. A chỉ có 1 lần (bài kiểm thử `oneDip`: không có lệnh). C là giữ yên ở 40° (như đặt tay lên đùi): không bao giờ là HELP.' },
        { type: 'truefalse', id: 'u03.l3.q4', prompt: 'Đưa cốc nước lên miệng hai lần, mỗi lần giữ khoảng 1 giây, sẽ làm vòng tay phát HELP.',
          answer: false,
          explanation: 'Sai. Mỗi lần cẳng tay ở ngoài lâu hơn 700 ms (`DIP_MAX_MS`) nên bị coi là giữ tư thế, không phải nhấp. Bài kiểm thử `sip` mô phỏng đúng tình huống này và không có lệnh nào.' },
        { type: 'mcq', id: 'u03.l3.q5', prompt: 'Tay ở tư thế **chéo**: chúc khoảng 30° và nghiêng khoảng 30° cùng lúc. Vòng tay sẽ làm gì?',
          options: ['Không phát lệnh nào, vì không góc nào hơn góc kia 8°', 'Phát HELP', 'Phát WATER hoặc FOOD', 'Phát cả HELP lẫn FOOD'], answer: 0,
          explanation: '30 không lớn hơn 30 + 8, nên cả luật nghiêng lẫn luật nhấp đều không bắt đầu. Bài kiểm thử `diagonal` (30°, 30°) cho đúng kết quả này.' },
        { type: 'mcq', id: 'u03.l3.q6', prompt: 'Theo `DIP_MAX_MS` và `HELP_WINDOW_MS`, một lệnh HELP cần gì về thời gian?',
          options: ['Mỗi lần nhấp tối đa 700 ms, cả hai lần trong 2000 ms', 'Giữ cẳng tay chúc xuống ít nhất 400 ms', 'Mỗi lần nhấp ít nhất 2 giây', 'Không có giới hạn thời gian'], answer: 0,
          explanation: '`DIP_MAX_MS = 700`: mỗi lần nhấp phải ra quá 25° rồi về dưới 12° trong 0,7 giây. `HELP_WINDOW_MS = 2000`: cả hai lần phải nằm trong 2 giây.' },
        { type: 'truefalse', id: 'u03.l3.q7', prompt: 'HELP nhận cả hai kiểu: chúc xuống rồi về (2 lần), **hoặc** ngóc lên rồi về (2 lần).',
          answer: true,
          explanation: 'Đúng, nên không phụ thuộc trục Y của bo hướng về ngón tay hay khuỷu tay. Nhưng hai lần phải **cùng chiều**: một xuống, một lên thì không tính (bài kiểm thử `swing`).' },
        { type: 'flashcard', id: 'u03.l3.q8', topic: "Firmware, code & phần cứng", prompt: 'Giám khảo hỏi: "Làm sao vòng tay biết người dùng cần giúp, mà không báo nhầm khi họ chỉ đặt tay xuống?"',
          modelAnswer: 'HELP dùng **góc chúc** của cẳng tay, tính bằng asin(y/|a|), khác với góc nghiêng trái/phải. Người dùng phải **nhấp cẳng tay 2 lần** cùng chiều: mỗi lần vượt 25° rồi về dưới 12° trong tối đa 0,7 giây, cả hai trong 2 giây. Giữ yên một góc (đặt tay lên đùi, đưa cốc lên miệng) không phải nhấp nên không gọi giúp nhầm. Các ca này đã được kiểm thử bằng dữ liệu tổng hợp.',
          keyPoints: ['Góc chúc asin(y/|a|)', '2 lần nhấp cùng chiều', '25° / 12°, ≤ 0,7 s mỗi lần, ≤ 2 s', 'Giữ tư thế không bao giờ ra HELP', 'Kiểm thử tổng hợp, chưa đo người thật'],
          explanation: 'Nhớ nói rõ: đây là kiểm thử bằng dữ liệu tổng hợp; với người dùng thật vẫn cần thí nghiệm.' },
        { type: 'flashcard', id: 'u03.l3.q9', topic: 'Gia tốc kế & trọng lực', prompt: 'Giám khảo hỏi: "Chỉ gập cổ tay, tức là gập bàn tay xuống, có tạo ra HELP không?"',
          modelAnswer: '**Gần như không.** Bo mạch nằm trên **cẳng tay** chứ không nằm trên bàn tay, nên gập riêng bàn tay thì cảm biến hầu như không đổi góc. HELP cần **hạ cả cẳng tay** (gập ở khuỷu) vượt 25° so với mốc rồi về dưới 12°, mỗi lần trong tối đa 0,7 giây, hai lần trong 2 giây. Đây vừa là ưu điểm, vì cử động bàn tay vặt vãnh không gọi giúp nhầm, vừa là hạn chế: người chỉ cử động được bàn tay mà không nhấc được cẳng tay thì chưa dùng được HELP.',
          keyPoints: ['Board nằm trên cẳng tay', 'Gập bàn tay: góc gần như không đổi', 'HELP cần hạ cả cẳng tay: 25° / 12°', 'Ưu: ít nhầm; hạn chế: cần cử động khuỷu'],
          explanation: 'Hiểu cảm biến gắn ở đâu thì trả lời được ngay nó đo được cử động nào.' },
        { type: "flashcard", id: "u03.l3.q10", topic: "Góc chúc (pitch)", prompt: "Giám khảo hỏi: \"Sao góc chúc tính bằng asin, còn góc nghiêng trái phải lại dùng atan2?\"",
          modelAnswer: "Hai góc đo hai kiểu xoay khác nhau. Góc **nghiêng** là xoay quanh cẳng tay, nên chỉ cần tỉ lệ hai trục x và z: `atan2(x, z)` cho góc đủ một vòng và không cần biết độ lớn. Góc **chúc** là cẳng tay chúc lên xuống, nên em hỏi trục y dọc cẳng tay nhận bao nhiêu phần trọng lực: `asin(y / |a|)`. Chia cho |a| để không phụ thuộc độ lớn, và code kẹp tỉ số trong khoảng từ âm một đến một để asin không lỗi. Cả hai góc đều so với **mốc lúc hiệu chuẩn**, nên đeo hơi lệch vẫn dùng được.",
          keyPoints: ["Nghiêng: xoay quanh cẳng tay, atan2(x, z)", "Chúc: phần trọng lực trên trục y, asin(y/|a|)", "Chia cho |a| và kẹp tỉ số để asin không lỗi", "Cả hai so với mốc hiệu chuẩn"],
          explanation: "Hàm `pitchAngle()` nằm ở đầu `GestureDetector.h`." },
      ],
    },
    // ───────────────────────────── L4 ─────────────────────────────
    {
      id: 'l4',
      title: 'Con quay hồi chuyển: đo tốc độ xoay',
      minutes: 10,
      goal: 'Sau bài này, em sẽ phân biệt được "đang nghiêng bao nhiêu" với "đang xoay nhanh cỡ nào".',
      steps: [
        { type: 'sim', title: 'Đồng hồ tốc độ xoay', sim: 'gyro-speed', props: { thresholdDps: 100, stillDps: 40, initialDps: 30, compareAccel: true },
          caption: 'Kéo thanh tốc độ: kim vọt lên khi cổ tay xoay nhanh, nhưng góc từ gia tốc kế gần như đứng yên. Vạch 100 °/s là "ngưỡng lắc", vạch 40 °/s là "đứng yên".' },
        { type: 'text', title: 'Đo nhanh, không đo nghiêng',
          body: '[[con quay hồi chuyển]] (gyroscope) không đo tay nghiêng bao nhiêu, mà đo tay **đang xoay nhanh cỡ nào**, đơn vị °/s (độ mỗi giây). Giữ tay nghiêng yên 40° thì con quay báo ≈ 0 °/s, giống đồng hồ tốc độ của xe đang đỗ trên dốc.' },
        { type: 'sim', title: 'Nghiêng so với lắc trên đồ thị', sim: 'imu-chart', props: { signals: ['roll', 'gy'], preset: 'no', thresholds: true, readout: true },
          caption: 'Khi lắc, đường gy vọt qua +100 rồi −100 °/s liên tục, còn roll chỉ dao động nhỏ. Chạm vào đồ thị để đọc giá trị tại từng thời điểm.' },
        { type: 'code', title: 'Mã thật: dùng tốc độ xoay', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: `        float speed = sqrtf(gx*gx + gy*gy + gz*gz);
// …
        if (speed > 70 || magnitude < 0.8f || magnitude > 1.2f) lastMotion = now;
// …
        fastRun = speed > SHAKE_DPS ? fastRun + 1 : 0;
// …
        int sign = gy > SHAKE_DPS ? 1 : gy < -SHAKE_DPS ? -1 : 0;`,
          highlight: [1, 7],
          caption: 'Dòng 1: tốc độ xoay tổng của cả 3 trục. Dòng 3: xoay nhanh hơn 70 °/s thì ghi nhận "đang cử động". Dòng 7: gy vượt +100 thì dấu +1, dưới −100 thì −1, còn lại 0.',
          notes: [
            { lines: [5, 5], note: 'Đếm số mẫu liên tiếp xoay nhanh hơn 100 °/s; từ 2 mẫu trở lên thì huỷ cú gõ đang chờ, để lắc tay không bị hiểu thành "Có".' },
            { lines: [7, 7], note: 'Lắc tay tạo chuỗi dấu +1, −1, +1… Chương sau sẽ học cách đếm 3 pha này thành lệnh NO.' },
          ] },
        { type: 'text', title: 'Cần cả hai cảm biến',
          body: 'Gia tốc kế cho biết **tư thế** (nghiêng, chúc), con quay cho biết **chuyển động** (lắc, xoay nhanh). Lắc tay là xoay nhanh qua lại, nên gy đổi dấu liên tục: +, −, +.' },
        { type: 'truefalse', id: 'u03.l4.q1', prompt: 'Giữ tay nghiêng yên ở 40°, con quay báo khoảng 40 °/s.',
          answer: false,
          explanation: 'Sai. Con quay đo **tốc độ xoay**. Tay đứng yên (dù đang nghiêng) thì tốc độ ≈ **0 °/s**. Góc 40° là việc của gia tốc kế.' },
        { type: 'sim-predict', id: 'u03.l4.q2', prompt: 'Cổ tay sắp chuyển từ xoay chậm sang **xoay rất nhanh**. Kim đồng hồ sẽ thế nào?',
          sim: 'gyro-speed', props: { tour: true, thresholdDps: 100, stillDps: 40, compareAccel: true }, pauseAt: 'slow', revealTo: 'fast',
          options: ['Vượt qua vạch "ngưỡng lắc" 100 °/s', 'Về 0 vì tay vẫn nghiêng như cũ', 'Dừng ở vạch 40 °/s', 'Không đổi vì con quay chỉ đo góc'], answer: 0,
          explanation: 'Xoay càng nhanh, kim càng vọt cao. Vượt 100 °/s (`SHAKE_DPS`) là đủ nhanh để có thể tính là một pha lắc.' },
        { type: 'number', id: 'u03.l4.q3', prompt: 'Tốc độ xoay quanh trục Y phải vượt bao nhiêu °/s thì mới có thể tính là một pha lắc?',
          answer: 100, tolerance: 0, unit: '°/s',
          explanation: '`SHAKE_DPS = 100`. Trong bài kiểm thử, mỗi pha lắc giả lập dùng ±220 °/s, vượt ngưỡng rõ ràng.' },
        { type: 'match', id: 'u03.l4.q4', prompt: 'Ghép mỗi thứ với câu hỏi nó trả lời.',
          pairs: [['Gia tốc kế', 'Tay đang ở tư thế nào, nghiêng bao nhiêu độ?'], ['Con quay hồi chuyển', 'Tay đang xoay nhanh cỡ nào?'], ['|a| ≈ 1 g', 'Tay có đang đứng yên, không va chạm không?']],
          explanation: 'Gia tốc kế → tư thế; con quay → tốc độ xoay; độ lớn |a| gần 1 g → tay đủ yên để tin góc.' },
        { type: 'mcq', id: 'u03.l4.q5', prompt: 'Cử chỉ nào dựa **chủ yếu** vào con quay hồi chuyển?',
          options: ['Lắc cổ tay → NO', 'Nghiêng trái → WATER', 'Nghiêng phải → FOOD', 'Nhấp cẳng tay 2 lần → HELP'], answer: 0,
          explanation: 'Lắc là xoay nhanh đổi chiều, nhận ra bằng gy vượt ±100 °/s. Nghiêng trái/phải là **tư thế giữ yên**, còn HELP là **hai lần nhấp cẳng tay**; cả ba đều đo bằng góc từ gia tốc kế, không dựa vào con quay.' },
        { type: 'mcq', id: 'u03.l4.q6', prompt: 'Đơn vị °/s nghĩa là gì?',
          options: ['Số độ xoay được trong 1 giây', 'Số độ nghiêng tối đa', 'Số lần đo mỗi giây', 'Số g mỗi giây'], answer: 0,
          explanation: 'Ví dụ 100 °/s: nếu cứ xoay đều như vậy thì 1 giây quay được 100°. IMU của BandW đo được tới ±500 °/s.' },
        { type: 'predict', id: 'u03.l4.q7', language: 'cpp', prompt: 'Với `gy = -150`, biến `sign` bằng bao nhiêu?',
          code: `const float SHAKE_DPS = 100;
float gy = -150;
int sign = gy > SHAKE_DPS ? 1 : gy < -SHAKE_DPS ? -1 : 0;`,
          highlight: [3],
          options: ['-1', '0', '1', '-150'], answer: 0,
          hint: 'Đọc từ trái sang: −150 có lớn hơn 100 không? Có nhỏ hơn −100 không?',
          explanation: '−150 không lớn hơn 100, nhưng **nhỏ hơn −100**, nên `sign = -1`: đây là một nhịp xoay nhanh theo chiều âm.' },
        { type: 'flashcard', id: 'u03.l4.q9', topic: 'Con quay hồi chuyển', prompt: 'Giám khảo hỏi: "Con quay hồi chuyển hay bị trôi số. Sao em không cộng dồn tốc độ xoay để ra góc?"',
          modelAnswer: 'Cộng dồn tốc độ xoay theo thời gian thì ra góc, nhưng mỗi mẫu có một **sai số nhỏ**, cộng mãi thành **trôi**: vài phút sau góc lệch xa dù tay không đổi. BandW **không làm vậy**. Góc nghiêng và góc chúc lấy từ **trọng lực** qua gia tốc kế nên không trôi. Con quay chỉ dùng để so **ngưỡng tốc độ** ngay tại mẫu đó: trên 100 °/s là một pha lắc, trên 70 °/s là tay đang chuyển động, trên 50 °/s ngay trước cú gõ thì bỏ YES. Sai lệch nhỏ vài °/s còn rất xa các ngưỡng này.',
          keyPoints: ['Cộng dồn → sai số tích luỹ → trôi', 'Góc lấy từ trọng lực, không trôi', 'Con quay chỉ so ngưỡng tức thời', 'Ngưỡng 100 / 70 / 50 °/s'],
          explanation: 'Câu hỏi bẫy: nhiều người nghĩ con quay đo góc. BandW dùng nó đúng chỗ: đo độ nhanh.' },
        { type: "flashcard", id: "u03.l4.q10", topic: "Con quay hồi chuyển", prompt: "Giám khảo hỏi: \"Con quay đo theo đơn vị gì? Ngưỡng 100 °/s là nhanh cỡ nào?\"",
          modelAnswer: "Con quay đo **tốc độ xoay**, đơn vị **độ trên giây (°/s)**. 100 °/s nghĩa là giữ tốc độ đó thì 1 giây cổ tay quay được 100°, gần một phần ba vòng. Mỗi mẫu cách nhau 20 ms, nên ở 100 °/s tay quay khoảng 2° giữa hai mẫu. Nghiêng tay chậm để ra lệnh thường dưới mức đó, còn lắc cổ tay nhanh thì vượt qua; run tay mạnh tới đâu thì phải đo trên người thật. Firmware cài dải đo **±500 °/s** (`gyroRange = 500`), đủ rộng để cú lắc mạnh không bị cắt ngọn.",
          keyPoints: ["Đơn vị: độ trên giây", "100 °/s: 1 giây quay được 100°", "Mỗi mẫu 20 ms, khoảng 2° giữa hai mẫu", "Dải đo ±500 °/s"],
          explanation: "Có thể làm mẫu: xoay cổ tay một phần ba vòng trong 1 giây." },
      ],
    },
    // ───────────────────────────── L5 ─────────────────────────────
    {
      id: 'l5',
      title: 'Ôn tập: đọc đồ thị cảm biến',
      minutes: 10,
      goal: 'Sau bài này, em sẽ nhìn đồ thị roll, pitch, gy, |a| và đoán đúng cử chỉ.',
      steps: [
        { type: 'sim', title: 'Năm cử chỉ trên một đồ thị', sim: 'imu-chart', props: { signals: ['roll', 'pitch', 'gy', 'mag'], preset: 'all', thresholds: true, readout: true },
          caption: 'Bấm ▶ và quan sát từng dấu lệnh. Mỗi cử chỉ để lại một "chữ ký" riêng trên một đường cụ thể.' },
        { type: 'text', title: 'Chữ ký của từng cử chỉ',
          body: '**roll** rời xa 0 và nằm yên phía âm là nghiêng trái, phía dương là nghiêng phải; **pitch** nhấp ra rồi về 2 lần nhanh là HELP. **gy** dao động +/− mạnh là lắc, còn hai cú gõ hiện thành hai gai nhọn trên đường |a| (minh hoạ; thực tế chip IMU tự nhận gõ ở 416 Hz và bật cờ, firmware không đếm đỉnh |a|).' },
        { type: 'code', title: 'Khi nào firmware chưa tin góc?', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: `        if (tapPending || !level || uint32_t(now - lastMotion) < 150 || magnitude < 0.85f || magnitude > 1.15f) {
            candidate = 0; return Gesture::None;
        }`,
          highlight: [1],
          caption: 'Không xét nghiêng trái/phải nếu: đang chờ xác nhận cú gõ, cẳng tay dựng đứng, chưa lắng đủ 150 ms sau cử động, hoặc |a| ngoài 0,85–1,15 g.',
          notes: [{ lines: [1, 1], note: 'Dấu || nghĩa là "hoặc": chỉ cần một điều kiện đúng là bỏ qua mẫu này.' }] },
        { type: 'mcq', id: 'u03.l5.q1', prompt: 'Đồ thị A: roll đi xuống khoảng **−40°** rồi giữ yên. Vòng tay sẽ phát lệnh nào?',
          visual: { kind: 'diagram', svg: SVG_CHART_ROLL, alt: 'Đồ thị roll: nằm ở 0, đi xuống khoảng −40° vượt vạch −22°, giữ yên một lúc rồi trở về 0.' },
          options: ['WATER (nghiêng trái)', 'FOOD (nghiêng phải)', 'NO (lắc)', 'HELP (nhấp cẳng tay)'], answer: 0,
          explanation: 'roll âm, vượt −22° và giữ yên lâu hơn 250 ms → **WATER**.' },
        { type: 'mcq', id: 'u03.l5.q2', prompt: 'Đồ thị B: gy vọt **+220, −220, +220 °/s** liên tiếp. Đây là cử chỉ nào?',
          visual: { kind: 'diagram', svg: SVG_CHART_GY, alt: 'Đồ thị gy: ba xung lớn lần lượt +220, −220, +220 độ mỗi giây, vượt cả hai vạch ±100.' },
          options: ['NO (lắc cổ tay)', 'YES (gõ 2 lần)', 'WATER (nghiêng trái)', 'Không phải cử chỉ'], answer: 0,
          hint: 'Đường này đo tốc độ xoay. Ba lần đổi chiều nhanh nghĩa là gì?',
          explanation: 'Ba pha xoay nhanh **đổi chiều**, mỗi pha vượt ±100 °/s → lắc → **NO**. Đây cũng là dạng dữ liệu dùng trong `gesture_test.cpp`.' },
        { type: 'mcq', id: 'u03.l5.q3', prompt: 'Đồ thị C: pitch **2 lần** vọt lên khoảng +35° rồi về 0, mỗi lần ngắn hơn 0,7 giây. Vòng tay sẽ phát lệnh nào?',
          visual: { kind: 'diagram', svg: SVG_CHART_PITCH, alt: 'Đồ thị pitch: hai xung ngắn lên khoảng +35°, vượt vạch +25° rồi về dưới vạch +12°.' },
          options: ['HELP (nhấp cẳng tay 2 lần)', 'FOOD (nghiêng phải)', 'YES (gõ 2 lần)', 'NO (lắc)'], answer: 0,
          explanation: 'Hai lần nhấp cùng chiều, mỗi lần vượt 25° rồi về dưới 12° trong ≤ 0,7 s, cả hai trong 2 s (roll gần 0 nên pitch hơn roll ≥ 8°) → **HELP**.' },
        { type: 'multi', id: 'u03.l5.q4', prompt: 'Chọn **tất cả** điều kiện để firmware chịu xét góc nghiêng trái/phải (WATER/FOOD) ở một mẫu.',
          options: ['|a| nằm trong 0,85–1,15 g', 'Đã lắng ít nhất 150 ms sau lần cử động gần nhất', 'Hình chiếu trên mặt X–Z ≥ 0,4 g (cẳng tay không dựng đứng)', 'Điện thoại đang có Wi-Fi', 'Không có cú gõ nào đang chờ xác nhận'], answers: [0, 1, 2, 4],
          explanation: 'Đúng theo dòng `if (tapPending || !level || … < 150 || magnitude < 0.85f || magnitude > 1.15f)`. Wi-Fi không liên quan.' },
        { type: 'hotspot', id: 'u03.l5.q5', prompt: 'Chạm vào đường đồ thị mà vòng tay dùng để nhận ra **lắc tay**.',
          target: { kind: 'sim', sim: 'imu-chart', props: { signals: ['roll', 'pitch', 'gy', 'mag'], preset: 'no', thresholds: true, readout: false } }, answer: 'trace-gy',
          explanation: '**gy** là tốc độ xoay quanh trục Y. Lắc tạo ra các pha vượt ±100 °/s, đổi dấu liên tục.' },
        { type: 'truefalse', id: 'u03.l5.q6', prompt: 'Nếu |a| = 1,7 g kéo dài (va đập mạnh) trong lúc tay nghiêng 45°, vòng tay vẫn phát WATER/FOOD bình thường.',
          answer: false,
          explanation: 'Sai. |a| = 1,7 g nằm ngoài 0,85–1,15 g nên firmware không tin góc. Bài kiểm thử `unstable` (100 mẫu 1,7 g ở 45°) xác nhận không có lệnh nào.' },
        { type: 'flashcard', id: 'u03.l5.q7', topic: "Cảm biến IMU & góc", prompt: 'Giám khảo hỏi: "Vòng tay đọc cảm biến nhanh cỡ nào và đọc những gì?"',
          modelAnswer: "Mỗi **20 ms** (50 lần/giây), firmware đọc một lần **6 trục**: gia tốc x, y, z (g) và tốc độ xoay gx, gy, gz (°/s). Bên trong IMU, gia tốc kế chạy **416 Hz** để tự nhận cú gõ, con quay chạy **104 Hz**. Từ 6 số đó, firmware tính góc nghiêng, góc gập, tốc độ xoay và |a|. Mỗi lần đọc lấy cả 6 trục cùng lúc nên các số khớp nhau.",
          keyPoints: ['50 lần/giây (20 ms)', "Sáu trục: gia tốc và con quay, mỗi loại ba trục", 'Gia tốc kế 416 Hz cho cú gõ', 'Tính roll, pitch, speed, |a|'],
          explanation: 'Phân biệt tốc độ đọc của firmware (50 Hz) với tốc độ đo bên trong cảm biến (416/104 Hz).' },
        { type: 'flashcard', id: 'u03.l5.q8', topic: 'Con quay hồi chuyển', prompt: 'Giám khảo hỏi: "Sao chỉ đọc 50 lần mỗi giây? Đọc nhanh hơn có chính xác hơn không?"',
          modelAnswer: 'Cử chỉ của người kéo dài **hàng trăm mili giây**: giữ nghiêng 250 ms, một lần nhấp HELP tối đa 700 ms, ba pha lắc trong 900 ms. Đọc mỗi **20 ms** là đủ thấy rõ từng cử chỉ; một pha lắc cần 2 mẫu liên tiếp, khoảng 40 ms. Đọc nhanh hơn không giúp nhận cử chỉ tốt hơn bao nhiêu, mà chip phải làm nhiều hơn, tốn pin hơn. Riêng cú **gõ** rất ngắn nên giao cho chính IMU tự nhận, gia tốc kế bên trong chạy **416 Hz**. 50 Hz là lựa chọn hợp lý, chưa được tối ưu bằng thí nghiệm.',
          keyPoints: ['Cử chỉ kéo dài hàng trăm ms', '20 ms là đủ; pha lắc = 2 mẫu', 'Nhanh hơn: tốn chip, tốn pin', 'Cú gõ: IMU tự nhận ở 416 Hz', 'Chưa tối ưu bằng thí nghiệm'],
          explanation: 'Trả lời theo kiểu kỹ sư: tốc độ đọc chọn theo độ dài của tín hiệu cần bắt.' },
        { type: "flashcard", id: "u03.l5.q9", topic: "Đọc dữ liệu cảm biến", prompt: "Giám khảo hỏi: \"Muốn xem cảm biến đọc ra số gì khi đeo thật thì em làm thế nào?\"",
          modelAnswer: "Em cắm vòng tay vào máy tính, mở Serial Monitor ở **115200 baud** rồi gửi chữ **`d`**. Firmware bật **log IMU 10 lần mỗi giây**: ax, ay, az tính bằng g và gx, gy, gz tính bằng °/s, kèm chữ TAP khi chip nhận gõ đôi. Nhìn số khi làm từng cử chỉ, em biết người đeo nghiêng được bao nhiêu độ, lắc nhanh cỡ nào, rồi mới quyết định có chỉnh ngưỡng không. Gửi `c` để hiệu chuẩn lại. Log này **không chặn** chương trình: máy tính bận thì dòng log bị bỏ chứ vòng tay không treo.",
          keyPoints: ["Serial Monitor 115200 baud, gửi d", "Log 10 lần mỗi giây: ax ay az (g), gx gy gz (°/s)", "Dùng số thật để quyết định chỉnh ngưỡng", "Log không chặn vòng lặp"],
          explanation: "Đây là cách lấy số liệu thật cho thí nghiệm; ghi lại tệp log kèm ngày giờ." },
      ],
    },
  ],
  defense: [
    { type: 'flashcard', id: 'u03.d.q1', prompt: 'Giám khảo hỏi: "atan2 khác arctan thông thường thế nào?"',
      modelAnswer: 'arctan(x/z) chỉ nhận **một tỉ số**, nên không phân biệt được một số hướng ngược nhau và lỗi khi z = 0. **atan2(x, z)** nhận riêng hai cạnh, nên biết đúng hướng trong **cả 4 góc phần tư** (−180° đến 180°) và không phải chia cho 0.',
      keyPoints: ['arctan: một tỉ số, mất thông tin dấu', 'atan2: hai cạnh, đủ 4 góc phần tư', 'Không chia cho 0'],
      explanation: 'Chỉ cần ý chính, không phải chứng minh toán học.' },
    { type: 'flashcard', id: 'u03.d.q2', prompt: 'Giám khảo hỏi: "Người dùng giơ tay lên (cẳng tay dựng đứng) thì sao?"',
      modelAnswer: 'Khi đó trọng lực dồn vào trục Y, x và z gần 0, góc nghiêng chỉ toàn nhiễu. Nếu √(x²+z²) < **0,4 g** (`MIN_PLANE_G`), firmware **khoá** góc nghiêng và không phát WATER/FOOD. Có ca kiểm thử cho tư thế dựng đứng.',
      keyPoints: ['Trọng lực dồn vào Y', '√(x²+z²) < 0,4 g → khoá nghiêng', 'Không phát WATER/FOOD', 'Có kiểm thử'],
      explanation: 'Thể hiện em hiểu cả "giới hạn" của công thức.' },
    { type: 'flashcard', id: 'u03.d.q3', prompt: 'Giám khảo hỏi: "Đang đi bộ hay ngồi xe rung thì vòng tay có báo nhầm không?"',
      modelAnswer: 'Firmware coi là "đang chuyển động" khi tốc độ xoay > 70 °/s hoặc |a| ngoài 0,8–1,2 g, và chỉ xét **nghiêng trái/phải (WATER/FOOD)** sau khi đã **lắng 150 ms** với |a| trong 0,85–1,15 g. Riêng HELP, góc gập bỏ qua các mẫu có |a| ngoài 0,5–1,5 g, và mỗi lần nhấp phải quay về trong 700 ms. Lệnh còn cần giữ 250 ms và phải về trung tính trước. Nhưng rung khi đi xe **chưa được thử nghiệm thật**, nên em sẽ nói đây là điều cần đo thêm.',
      keyPoints: ['> 70 °/s hoặc |a| lệch → đang chuyển động', 'Lắng 150 ms mới xét nghiêng', 'Giữ 250 ms + về trung tính', 'Chưa thử thực tế: cần đo'],
      explanation: 'Kết hợp cơ chế trong code với sự trung thực về những gì chưa đo.' },
  ],
};
