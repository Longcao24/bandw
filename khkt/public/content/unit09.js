// public/content/unit09.js — Chương 9: Hạn chế, AI, hướng phát triển & đạo đức (Writer #4)
// Số liệu lấy từ firmware/BandW_Sense/GestureDetector.h, BandW_Sense.ino, firmware/README.md,
// app/src/main/AndroidManifest.xml, MainActivity.java. Không có số liệu pin hay độ chính xác thật trong repo.

const SVG_BOXES = `<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <g data-hotspot="glass" data-label="Hộp trong suốt: dựa trên luật">
    <text x="150" y="28" text-anchor="middle" font-size="18" font-weight="700" style="fill:var(--c-text)">Dựa trên luật</text>
    <rect x="20" y="42" width="260" height="200" rx="16" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:3"/>
    <text x="40" y="86" font-size="16" style="fill:var(--c-text)">nếu |góc| &gt; 22°</text>
    <text x="40" y="114" font-size="16" style="fill:var(--c-text)">và giữ ≥ 250 ms</text>
    <text x="40" y="142" font-size="16" style="fill:var(--c-text)">thì phát WATER/FOOD</text>
    <circle cx="232" cy="190" r="22" style="fill:none;stroke:var(--c-primary);stroke-width:4;stroke-dasharray:8 5"/>
    <circle cx="196" cy="208" r="14" style="fill:none;stroke:var(--c-primary);stroke-width:4;stroke-dasharray:6 4"/>
    <text x="40" y="222" font-size="15" style="fill:var(--c-muted)">Thấy rõ từng bước</text>
  </g>
  <g data-hotspot="black" data-label="Hộp đen: mô hình học máy">
    <text x="450" y="28" text-anchor="middle" font-size="18" font-weight="700" style="fill:var(--c-text)">Học máy</text>
    <rect x="320" y="42" width="260" height="200" rx="16" style="fill:var(--c-text);stroke:var(--c-text);stroke-width:3"/>
    <text x="450" y="160" text-anchor="middle" font-size="64" font-weight="700" style="fill:var(--c-surface)">?</text>
    <text x="450" y="222" text-anchor="middle" font-size="15" style="fill:var(--c-surface)">Cần nhiều dữ liệu có nhãn</text>
  </g>
  <text x="300" y="284" text-anchor="middle" font-size="15" style="fill:var(--c-muted)">Dữ liệu cảm biến vào → quyết định ra</text>
</svg>`;

const SVG_ROADMAP = `<svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <text x="300" y="30" text-anchor="middle" font-size="17" font-weight="700" style="fill:var(--c-text)">Lộ trình đề xuất (kế hoạch, chưa làm)</text>
  <path d="M20 170 C 120 120, 200 220, 300 170 S 480 120, 580 170" style="fill:none;stroke:var(--c-border);stroke-width:18;stroke-linecap:round"/>
  <path d="M20 170 C 120 120, 200 220, 300 170 S 480 120, 580 170" style="fill:none;stroke:var(--c-surface);stroke-width:3;stroke-dasharray:10 10"/>
  <g data-hotspot="m1" data-label="Mốc 1: Đo trên người thật">
    <circle cx="60" cy="158" r="20" style="fill:var(--c-primary);stroke:var(--c-surface);stroke-width:3"/>
    <text x="60" y="164" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-primary-ink)">1</text>
    <text x="60" y="94" text-anchor="middle" font-size="14" style="fill:var(--c-text)">Đo trên</text>
    <text x="60" y="112" text-anchor="middle" font-size="14" style="fill:var(--c-text)">người thật</text>
  </g>
  <g data-hotspot="m2" data-label="Mốc 2: Ngưỡng theo từng người">
    <circle cx="180" cy="178" r="20" style="fill:var(--c-primary);stroke:var(--c-surface);stroke-width:3"/>
    <text x="180" y="184" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-primary-ink)">2</text>
    <text x="180" y="232" text-anchor="middle" font-size="14" style="fill:var(--c-text)">Ngưỡng theo</text>
    <text x="180" y="250" text-anchor="middle" font-size="14" style="fill:var(--c-text)">từng người</text>
  </g>
  <g data-hotspot="m3" data-label="Mốc 3: Đo pin, chế độ ngủ">
    <circle cx="300" cy="170" r="20" style="fill:var(--c-primary);stroke:var(--c-surface);stroke-width:3"/>
    <text x="300" y="176" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-primary-ink)">3</text>
    <text x="300" y="106" text-anchor="middle" font-size="14" style="fill:var(--c-text)">Đo pin,</text>
    <text x="300" y="124" text-anchor="middle" font-size="14" style="fill:var(--c-text)">chế độ ngủ</text>
  </g>
  <g data-hotspot="m4" data-label="Mốc 4: Báo người chăm sóc khi có HELP">
    <circle cx="420" cy="158" r="20" style="fill:var(--c-primary);stroke:var(--c-surface);stroke-width:3"/>
    <text x="420" y="164" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-primary-ink)">4</text>
    <text x="420" y="214" text-anchor="middle" font-size="14" style="fill:var(--c-text)">Báo người</text>
    <text x="420" y="232" text-anchor="middle" font-size="14" style="fill:var(--c-text)">chăm sóc</text>
  </g>
  <g data-hotspot="m5" data-label="Mốc 5: Thêm câu, iOS, mã hoá">
    <circle cx="540" cy="162" r="20" style="fill:var(--c-primary);stroke:var(--c-surface);stroke-width:3"/>
    <text x="540" y="168" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-primary-ink)">5</text>
    <text x="540" y="98" text-anchor="middle" font-size="14" style="fill:var(--c-text)">Thêm câu,</text>
    <text x="540" y="116" text-anchor="middle" font-size="14" style="fill:var(--c-text)">iOS, mã hoá</text>
  </g>
  <text x="300" y="300" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">Mỗi mốc dùng số đo của mốc trước để quyết định</text>
</svg>`;

const SVG_PRIVACY = `<svg viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg" role="img" font-family="inherit">
  <g data-hotspot="cloud" data-label="Máy chủ, Internet">
    <ellipse cx="300" cy="62" rx="130" ry="40" style="fill:var(--c-surface-2);stroke:var(--c-muted);stroke-width:2;stroke-dasharray:8 6"/>
    <text x="300" y="58" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-muted)">Máy chủ / Internet</text>
    <text x="300" y="82" text-anchor="middle" font-size="15" style="fill:var(--c-danger)">✕ không có dữ liệu BandW</text>
  </g>
  <line x1="30" y1="136" x2="570" y2="136" style="stroke:var(--c-danger);stroke-width:4;stroke-dasharray:14 8"/>
  <text x="300" y="128" text-anchor="middle" font-size="14" style="fill:var(--c-danger)">bức tường: không gửi lên mạng</text>
  <g data-hotspot="band" data-label="Vòng tay">
    <rect x="20" y="170" width="150" height="80" rx="12" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:2"/>
    <text x="95" y="203" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Vòng tay</text>
    <text x="95" y="228" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">gửi 1 từ “WATER”</text>
  </g>
  <path d="M174 210 L 220 210" style="stroke:var(--c-primary);stroke-width:4"/>
  <path d="M214 200 L 226 210 L 214 220 Z" style="fill:var(--c-primary)"/>
  <g data-hotspot="phone" data-label="Điện thoại">
    <rect x="228" y="170" width="150" height="80" rx="12" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:2"/>
    <text x="303" y="203" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Điện thoại</text>
    <text x="303" y="228" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">lịch sử 5 lệnh</text>
  </g>
  <path d="M382 210 L 428 210" style="stroke:var(--c-primary);stroke-width:4"/>
  <path d="M422 200 L 434 210 L 422 220 Z" style="fill:var(--c-primary)"/>
  <g data-hotspot="speaker" data-label="Loa">
    <rect x="436" y="170" width="144" height="80" rx="12" style="fill:var(--c-primary-soft);stroke:var(--c-primary);stroke-width:2"/>
    <text x="508" y="203" text-anchor="middle" font-size="16" font-weight="700" style="fill:var(--c-text)">Loa</text>
    <text x="508" y="228" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">đọc thành tiếng</text>
  </g>
  <text x="300" y="285" text-anchor="middle" font-size="14" style="fill:var(--c-muted)">Không camera · không micro · không máy chủ</text>
</svg>`;

export default {
  id: 'u09',
  title: 'Hạn chế, AI, hướng phát triển & đạo đức',
  description: 'Nói thật điều BandW chưa làm được, so sánh luật với học máy, vạch lộ trình cải tiến và giữ an toàn, riêng tư cho người dùng.',
  color: 'orange',
  icon: '🧭',
  glossary: [
    { term: 'hạn chế', en: 'limitation', def: 'Điều sản phẩm chưa làm được hoặc làm chưa tốt. Nêu hạn chế kèm lý do và hướng khắc phục là dấu hiệu của một đội nghiên cứu trung thực.' },
    { term: 'dựa trên luật', en: 'rule-based', def: 'Cách làm trong đó con người viết sẵn các điều kiện (ngưỡng, thời gian, trạng thái). Máy chỉ làm theo, không tự học.' },
    { term: 'học máy', en: 'machine learning', def: 'Cách làm trong đó máy tính tự rút ra quy luật từ rất nhiều ví dụ có sẵn đáp án. BandW không dùng học máy.' },
    { term: 'dữ liệu có nhãn', en: 'labeled data', def: 'Dữ liệu mà mỗi mẫu đã được ghi sẵn đáp án đúng, ví dụ đoạn tín hiệu này là “nghiêng trái”. Học máy cần rất nhiều loại dữ liệu này.' },
    { term: 'TinyML', en: 'Tiny Machine Learning', def: 'Mô hình học máy rất nhỏ, đủ nhẹ để chạy trên vi điều khiển. Đây là một hướng phát triển có thể thử khi đã có dữ liệu thật.' },
    { term: 'cá nhân hoá', en: 'personalization', def: 'Điều chỉnh sản phẩm theo từng người, ví dụ chọn ngưỡng góc nghiêng nhỏ hơn cho người cử động yếu.' },
    { term: 'mã hoá', en: 'encryption', def: 'Biến dữ liệu thành dạng người ngoài đọc không hiểu. Kết nối BLE của BandW hiện chưa mã hoá.' },
    { term: 'ghép đôi', en: 'pairing / bonding', def: 'Bước hai thiết bị Bluetooth xác nhận và lưu khoá bí mật của nhau. BandW bản MVP chưa có bước này.' },
    { term: 'thiết bị y tế', en: 'medical device', def: 'Thiết bị dùng cho chẩn đoán hoặc điều trị, phải được thử nghiệm và cấp phép theo quy định. BandW chưa phải thiết bị y tế.' },
    { term: 'đồng thuận có hiểu biết', en: 'informed consent', def: 'Người tham gia thử nghiệm được giải thích rõ mục đích, rủi ro, rồi tự nguyện đồng ý và có quyền dừng bất cứ lúc nào.' },
    { term: 'quyền riêng tư', en: 'privacy', def: 'Quyền của mỗi người được giữ thông tin cá nhân cho riêng mình, không bị thu thập hay chia sẻ khi chưa cho phép.' },
  ],
  lessons: [
    // ───────────────────────── L1 ─────────────────────────
    {
      id: 'l1',
      title: 'Hạn chế hiện tại: nói thật để được tin',
      minutes: 10,
      goal: 'Sau bài này, em kể được các hạn chế thật của BandW, kèm lý do và hướng khắc phục.',
      steps: [
        { type: 'sim', title: 'Toàn bộ “vốn từ” của BandW', sim: 'gesture-gallery', props: { showCommands: true, showPhrases: true },
          caption: 'Đây là tất cả những gì BandW nói được: 5 cử chỉ, 5 câu cố định. Muốn nói câu thứ sáu thì hiện tại chưa có cách.' },
        { type: 'text', title: 'Hạn chế không phải là thất bại',
          body: 'Giám khảo đánh giá cao đội **biết rõ giới hạn** của sản phẩm. Mỗi [[hạn chế]] (limitation) nên đi kèm lý do và hướng khắc phục.\n\n> Công thức trả lời: *hạn chế → vì sao → hướng sửa*.' },
        { type: 'sim', title: 'Giơ tay lên cao thì sao?', sim: 'imu-axes-3d', props: { mode: 'accel', preset: 'vertical', interactive: true, showBars: true },
          caption: 'Khi cẳng tay dựng đứng, trọng lực dồn vào trục Y nên √(x²+z²) < 0,4 g. Firmware khoá nghiêng trái/phải, nên lúc đó WATER/FOOD không dùng được.' },
        { type: 'sim', title: 'Run tay mạnh khi hiệu chuẩn', sim: 'calibration', props: { tremor: 0.8, showFormula: true },
          caption: 'Kéo thanh “Run tay” lên cao: quá 10 mẫu rung thì vòng 100 mẫu bắt đầu lại. Người run tay mạnh có thể rất khó hiệu chuẩn xong.' },
        { type: 'code', title: 'Hướng đeo được “viết cứng” trong code', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: '// Change TILT_SIGN if left/right is reversed (debug mode prints ax..gz). HELP accepts either pitch\n// direction, so it does not depend on which way +Y points on the board.\nstatic const float TILT_SIGN = 1.0f;\n// …\nstatic const float MIN_PLANE_G = 0.4f;      // below this, X/Z cannot define roll (forearm near vertical)',
          highlight: [3],
          caption: 'Đổi dấu chỉ đảo trái ↔ phải. HELP nhận cả nhấp xuống lẫn nhấp lên nên không cần đổi dấu. Nếu đeo xoay 90°, phải đổi trục đọc trong code rồi nạp lại firmware.',
          notes: [
            { lines: [3, 3], note: 'Đổi thành -1.0f nếu nghiêng trái lại ra FOOD.' },
            { lines: [5, 5], note: 'Dưới 0,4 g thì góc trái/phải chỉ là nhiễu, nên bị khoá.' },
          ] },
        { type: 'sim-predict', id: 'u09.l1.q1', prompt: 'Bo mạch sắp chuyển sang tư thế **cẳng tay dựng đứng**. Lúc đó nghiêng trái có ra WATER không?',
          sim: 'imu-axes-3d', props: { tour: true, mode: 'accel' }, pauseAt: 'forward', revealTo: 'vertical',
          options: ['Có, vẫn ra WATER như bình thường', 'Không, góc trái/phải bị khoá vì √(x²+z²) < 0,4 g', 'Ra HELP thay cho WATER'],
          answer: 1,
          explanation: 'Đúng là không: khi trọng lực dồn vào trục Y, x và z quá nhỏ nên `atan2(x, z)` chỉ còn nhiễu. Firmware khoá nghiêng để không phát lệnh bừa. Nó cũng không tự đổi sang HELP, vì HELP cần hai lần nhấp cẳng tay nhanh (mỗi lần ra rồi về trong 700 ms); giữ yên một tư thế không bao giờ là một lần nhấp.' },
        { type: 'multi', id: 'u09.l1.q2', prompt: 'Chọn **tất cả** hạn chế **thật** của BandW hiện nay.',
          options: ['Chỉ có 5 câu cố định', 'Người dùng phải cử động được cổ tay', 'Bắt buộc có Internet mới chạy', 'Bluetooth chưa ghép đôi, chưa mã hoá', 'Chưa có số đo thời lượng pin', 'Cần điện thoại Android có giọng đọc tiếng Việt'],
          answers: [0, 1, 3, 4, 5],
          hint: 'Vòng tay và điện thoại nói chuyện trực tiếp với nhau qua sóng nào?',
          explanation: 'Năm hạn chế kia đều đúng. “Bắt buộc Internet” là sai: vòng tay nối thẳng với điện thoại qua BLE, app không xin quyền Internet. Chỉ một số giọng đọc cần mạng, nên README khuyên tải giọng offline.' },
        { type: 'mcq', id: 'u09.l1.q3', prompt: 'Nếu gắn bo mạch **xoay 90°** so với hướng chuẩn thì điều gì xảy ra?',
          options: ['Hiệu chuẩn tự nhận ra hướng mới và sửa', 'Trục nghiêng bị lệch, phải đổi trục đọc trong code rồi nạp lại', 'Chỉ cần đổi TILT_SIGN là xong', 'Không ảnh hưởng gì'],
          answer: 1,
          explanation: 'README ghi: hiệu chuẩn chỉ đặt góc trung tính, **không tự suy ra hướng đeo**. TILT_SIGN chỉ đảo trái ↔ phải, không đổi được trục. Xoay 90° thì trục X và Y đổi vai trò, nên phải sửa code.' },
        { type: 'truefalse', id: 'u09.l1.q4', prompt: 'Bước hiệu chuẩn giúp vòng tay tự suy ra hướng đeo của người dùng.',
          answer: false,
          explanation: 'Sai. Hiệu chuẩn lấy 100 mẫu đứng yên để ghi **mốc góc trung tính**, không đoán hướng gắn bo mạch. Đeo lệch nhẹ thì được bù, đeo xoay hẳn 90° thì không.' },
        { type: 'mcq', id: 'u09.l1.q5', prompt: 'Người dùng đang ngồi trên xe máy rung. Câu nào mô tả **trung thực** nhất?',
          options: ['Chắc chắn phát lệnh nhầm liên tục', 'Firmware coi rung mạnh là “chuyển động” và chờ lắng 150 ms, nhưng chưa có thí nghiệm nên chưa biết chắc', 'Rung xe giúp nhận dạng tốt hơn', 'Vòng tay tự tắt khi đi xe'],
          answer: 1,
          hint: 'Code có cơ chế phòng nhiễu, nhưng nhóm đã đo trên xe thật chưa?',
          explanation: 'Code đánh dấu chuyển động khi tốc độ xoay > 70 °/s hoặc |a| ra ngoài 0,8–1,2 g, rồi chờ lắng 150 ms mới xét nghiêng trái/phải (WATER/FOOD); lắc, gõ và nhấp cẳng tay có kiểm tra riêng. Nhưng chưa có số đo trên xe thật, nên không được khẳng định “chắc chắn nhầm” hay “không bao giờ nhầm”.' },
        { type: 'flashcard', id: 'u09.l1.q6', prompt: 'Giám khảo hỏi: “Nếu người dùng run tay thì sao?”',
          modelAnswer: 'BandW có bốn lớp chống run nhẹ. **Hiệu chuẩn** bỏ qua tối đa 10 mẫu rung. Góc được **lọc làm mượt** (α = 0,22). Phải vượt **22°** và chỉ coi là về trung tính dưới **12°**. Phải **giữ 250 ms** mới phát lệnh. Còn run tay **mạnh** thì có thể khó hiệu chuẩn hoặc gây lệnh nhầm. Đây là hạn chế, nhóm cần đo với người run tay thật rồi chỉnh ngưỡng riêng.',
          keyPoints: ['Hiệu chuẩn chịu 10 mẫu rung', 'Bộ lọc α = 0,22', 'Ngưỡng 22° / 12° và giữ 250 ms', 'Thừa nhận: run mạnh là hạn chế, cần đo'],
          explanation: 'Bẫy cần tránh: nói “run tay không ảnh hưởng gì”. Hãy nêu cơ chế, rồi tự nhận phần chưa đo.' },
      ],
    },
    // ───────────────────────── L2 ─────────────────────────
    {
      id: 'l2',
      title: 'Dựa trên luật hay học máy?',
      minutes: 10,
      goal: 'Sau bài này, em so sánh công bằng cách làm dựa trên luật với học máy và giải thích vì sao BandW chọn luật.',
      steps: [
        { type: 'sim', title: 'Luật: nhìn thấy từng bước', sim: 'gesture-state-machine', props: { scenario: 'water', showCode: true, showTimers: true },
          caption: 'Bấm ▶ và theo dõi: em thấy rõ vì sao vòng tay sẵn sàng, vì sao phát WATER, dòng code nào đang chạy. Giải thích được từng quyết định là điểm mạnh lớn nhất của cách làm dựa trên luật.' },
        { type: 'text', title: 'Hai cách dạy máy ra quyết định',
          body: '[[dựa trên luật]] (rule-based): con người viết sẵn ngưỡng và điều kiện. [[học máy]] (machine learning): máy tự rút ra quy luật từ rất nhiều [[dữ liệu có nhãn]] (labeled data).\n\n> BandW dùng luật, **không có AI hay học máy** trong firmware.' },
        { type: 'diagram', title: 'Hộp trong suốt và hộp đen', svg: SVG_BOXES,
          caption: 'Với luật, mở hộp ra là thấy điều kiện. Với học máy, quyết định nằm trong hàng nghìn con số của mô hình, khó giải thích hơn.',
          alt: 'Hai hộp. Bên trái là hộp trong suốt “Dựa trên luật” ghi: nếu góc lớn hơn 22 độ và giữ ít nhất 250 ms thì phát WATER hoặc FOOD. Bên phải là hộp đen “Học máy” có dấu hỏi, ghi cần nhiều dữ liệu có nhãn.' },
        { type: 'code', title: 'Cả quyết định nằm trong vài dòng', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: 'float roll = fabsf(filtered), pitch = fabsf(filteredPitch);\n// …\nint direction = roll > TILT_ENTER_DEG && roll >= pitch + AXIS_MARGIN_DEG ? (filtered < 0 ? -1 : 1) : 0;',
          highlight: [3],
          caption: 'Giám khảo hỏi “vì sao ra WATER?” thì em chỉ vào dòng 3: góc lớn hơn 22° và hơn góc gập ít nhất 8°, góc âm nên là trái.',
          notes: [
            { lines: [1, 1], note: 'roll, pitch: độ lớn góc nghiêng và góc gập đã lọc (bỏ dấu âm).' },
            { lines: [3, 3], note: '-1 = trái (WATER), 1 = phải (FOOD), 0 = không nghiêng rõ. HELP được xét riêng ở đoạn trên, bằng cách đếm 2 lần nhấp.' },
          ] },
        { type: 'hotspot', id: 'u09.l2.q1', prompt: 'Chạm vào hộp mô tả **đúng** cách BandW ra quyết định.',
          target: { kind: 'diagram', svg: SVG_BOXES }, answer: 'glass',
          explanation: 'BandW là “hộp trong suốt”: mọi điều kiện (22°, 250 ms, 8°) đều viết rõ trong GestureDetector.h. Hộp đen là mô hình học máy, BandW không dùng.' },
        { type: 'match', id: 'u09.l2.q2', prompt: 'Ghép mỗi tình huống với cách làm phù hợp hơn.',
          pairs: [
            ['Phải giải thích được từng quyết định', 'Luật: chỉ ra điều kiện nào đúng'],
            ['Chưa có dữ liệu huấn luyện', 'Luật: chỉ cần hiểu rõ bài toán'],
            ['Muốn thêm hàng chục cử chỉ phức tạp', 'Học máy: linh hoạt hơn khi đủ dữ liệu'],
            ['Khó biết vì sao máy đoán sai', 'Học máy: mô hình giống hộp đen'],
          ],
          explanation: 'Mỗi cách có ưu điểm riêng. Luật mạnh khi ít dữ liệu và cần giải thích. Học máy mạnh khi có nhiều dữ liệu và nhiều cử chỉ, đổi lại khó giải thích.' },
        { type: 'sim-predict', id: 'u09.l2.q3', prompt: 'Tay vừa **nghiêng 30°** vừa **gập 26°** (nghiêng chéo). Luật sẽ cho ra gì?',
          sim: 'code-stepper',
          props: {
            title: 'Mã rút gọn từ GestureDetector.h',
            language: 'cpp',
            visual: 'branch',
            code: 'float roll = 30, pitch = 26;\nbool tilt = roll > 22 && roll >= pitch + 8;\nbool dip = pitch > 25 && pitch >= roll + 8;\n// tilt → FOOD/WATER, dip → 1 lần nhấp HELP',
            steps: [
              { line: 1, vars: { roll: 30, pitch: 26 }, note: 'Góc nghiêng 30°, góc gập 26°.' },
              { line: 2, vars: { tilt: false }, cond: { expr: '30 >= 26 + 8', value: false }, note: '30 lớn hơn 22, nhưng không hơn góc gập đủ 8°.' },
              { line: 3, vars: { dip: false }, cond: { expr: '26 >= 30 + 8', value: false }, note: '26 lớn hơn 25, nhưng không hơn góc nghiêng đủ 8°.' },
              { line: 4, note: 'Không trục nào thắng rõ: không phát FOOD, cũng không tính là một lần nhấp HELP.' },
            ],
          },
          pauseAt: 's1', revealTo: 'end',
          options: ['FOOD (nghiêng phải)', 'Tính là một lần nhấp HELP', 'Không gì cả: không trục nào thắng'],
          answer: 2,
          hint: 'Trục thắng phải hơn trục kia ít nhất `AXIS_MARGIN_DEG = 8`.',
          explanation: '30 < 26 + 8 và 26 < 30 + 8, nên không trục nào thắng: không ra FOOD, cũng không đếm lần nhấp HELP. Đây chính là ca “diagonal” trong gesture_test.cpp. Luật cố tình bỏ qua tư thế mơ hồ thay vì đoán bừa.' },
        { type: 'mcq', id: 'u09.l2.q4', prompt: 'Lý do **chính** BandW chọn cách làm dựa trên luật là gì?',
          options: ['Vì học máy bị cấm trong cuộc thi', 'Ít dữ liệu, cần giải thích được, chạy nhẹ trên vi điều khiển, và 5 cử chỉ khác nhau rõ', 'Vì luật luôn chính xác 100%', 'Vì không ai biết dùng học máy'],
          answer: 1,
          explanation: 'Cả bốn lý do ở đáp án đúng đều có thật. Luật không “chính xác 100%”: nó vẫn có thể nhầm và cần được đo. Học máy cũng không bị cấm, chỉ là chưa phù hợp ở giai đoạn này.' },
        { type: 'truefalse', id: 'u09.l2.q5', prompt: 'Cách làm dựa trên luật **luôn** kém hơn AI.',
          answer: false,
          explanation: 'Sai. Với ít cử chỉ, khác nhau rõ, và khi cần giải thích, luật thường là lựa chọn hợp lý hơn. Học máy chỉ vượt trội khi có nhiều dữ liệu có nhãn và bài toán phức tạp.' },
        { type: 'mcq', id: 'u09.l2.q6', prompt: 'Khi nào thì việc thử học máy (ví dụ [[TinyML]]) trở nên hợp lý cho BandW?',
          options: ['Ngay bây giờ, để nghe hiện đại hơn', 'Khi đã thu được nhiều dữ liệu cử chỉ thật, có nhãn, từ người dùng mục tiêu', 'Không bao giờ', 'Khi điện thoại có Internet'],
          answer: 1,
          explanation: 'Học máy cần dữ liệu thật. Khi nhóm đã có bảng ghi chép thí nghiệm đủ lớn, có thể dùng nó để chỉnh ngưỡng theo từng người hoặc thử mô hình nhỏ. Chọn AI “cho hiện đại” là lý do yếu trước giám khảo.' },
        { type: 'flashcard', id: 'u09.l2.q7', prompt: 'Giám khảo hỏi: “Sao em không dùng AI?”',
          modelAnswer: 'Vì giai đoạn này **luật phù hợp hơn**. Năm cử chỉ khác nhau rõ, nên ngưỡng, thời gian giữ và máy trạng thái là đủ. Luật **giải thích được** từng quyết định, chạy nhẹ trên chip nRF52840, và **không cần tập dữ liệu huấn luyện** mà nhóm chưa có. Khi đã thu được dữ liệu thật từ người dùng, nhóm có thể dùng nó để chỉnh ngưỡng riêng hoặc thử mô hình nhỏ như TinyML.',
          keyPoints: ['5 cử chỉ khác biệt rõ', 'Giải thích được, dễ kiểm thử', 'Chạy nhẹ trên vi điều khiển', 'Chưa có dữ liệu có nhãn', 'AI là hướng phát triển khi có dữ liệu'],
          explanation: 'Bẫy cần tránh: chê AI hay nói BandW “có AI”. Hãy so sánh công bằng.' },
      ],
    },
    // ───────────────────────── L3 ─────────────────────────
    {
      id: 'l3',
      title: 'Hướng phát triển: đi từng bước có số liệu',
      minutes: 9,
      goal: 'Sau bài này, em đề xuất được hướng phát triển theo thứ tự hợp lý, gắn với từng hạn chế.',
      steps: [
        { type: 'sim', title: 'Đo trước, cải tiến sau', sim: 'confusion-matrix', props: { data: 'demo', trialsPerGesture: 20, includeNone: true },
          caption: 'Muốn cải tiến đúng chỗ thì trước hết phải đo. Bảng này chỉ là số liệu minh hoạ: ô ngoài đường chéo cho biết cặp cử chỉ nào cần chỉnh.' },
        { type: 'diagram', title: 'Lộ trình đề xuất', svg: SVG_ROADMAP,
          caption: 'Năm mốc theo thứ tự: đo trên người thật trước, rồi mới cá nhân hoá và thêm tính năng. Đây là kế hoạch, chưa phải tính năng đã có.',
          alt: 'Con đường uốn lượn với 5 cột mốc: 1 Đo trên người thật, 2 Ngưỡng theo từng người, 3 Đo pin và chế độ ngủ, 4 Báo người chăm sóc, 5 Thêm câu, iOS, mã hoá.' },
        { type: 'text', title: 'Mỗi hướng phải trả lời được hai câu',
          body: 'Mỗi hướng phát triển nên trả lời: *giải quyết hạn chế nào, đo bằng cách nào*. Ví dụ: [[cá nhân hoá]] (personalization) ngưỡng giúp người cử động yếu dùng góc nhỏ hơn 22°.\n\n>! Đừng nói về tính năng tương lai như thể đã có; hãy nói rõ đó là *kế hoạch*.' },
        { type: 'sim', title: 'Người cử động yếu', sim: 'tilt-angle', props: { enterDeg: 22, exitDeg: 12, initialDeg: 15, showFormula: false, showComponents: false },
          caption: 'Kéo cổ tay tới khoảng 15°: chưa vào vùng 22° nên không có lệnh. Với người chỉ nghiêng được chừng đó, cần ngưỡng riêng cho họ.' },
        { type: 'code', title: 'Các “núm vặn” hiện đang cố định', language: 'cpp', source: 'firmware/BandW_Sense/GestureDetector.h',
          code: 'static const float TILT_ENTER_DEG = 22.0f;\nstatic const float TILT_EXIT_DEG = 12.0f;\nstatic const float PITCH_ENTER_DEG = 25.0f;\n// …\nstatic const uint32_t HOLD_MS = 250;\nstatic const uint32_t DIP_MAX_MS = 700;      // one HELP dip: out past PITCH_ENTER_DEG and back, at most this long',
          highlight: [1, 5],
          caption: 'Hiện ngưỡng là hằng số: muốn đổi phải sửa code và nạp lại. Hướng phát triển là cho chỉnh ngay trong app, theo từng người.',
          notes: [{ lines: [1, 3], note: 'README: đây là giá trị khởi đầu, chưa đo với cử chỉ thật của người dùng.' }] },
        { type: 'order', id: 'u09.l3.q1', prompt: 'Sắp xếp các việc theo **thứ tự ưu tiên hợp lý**.',
          items: ['Đo độ chính xác trên người đeo thật', 'Chỉnh ngưỡng theo từng người', 'Đo thời lượng pin, thêm chế độ tiết kiệm', 'Thêm tính năng mới (câu mới, iOS)'],
          hint: 'Chưa đo thì chưa biết phải chỉnh ngưỡng bao nhiêu.',
          explanation: 'Phải có số đo thật trước thì mới biết chỉnh ngưỡng thế nào. Pin quyết định sản phẩm có dùng được cả ngày không. Tính năng mới đến sau, khi phần lõi đã chắc.' },
        { type: 'hotspot', id: 'u09.l3.q2', prompt: 'Chạm vào cột mốc nên làm **đầu tiên**.',
          target: { kind: 'diagram', svg: SVG_ROADMAP }, answer: 'm1',
          explanation: 'Mốc 1 là đo trên người thật. README ghi rõ tỉ lệ nhận đúng trên người đeo **chưa được đo**, nên mọi cải tiến khác đều cần con số này làm điểm xuất phát.' },
        { type: 'mcq', id: 'u09.l3.q3', prompt: 'Cải tiến nào **trực tiếp** làm lệnh HELP an toàn hơn?',
          options: ['Đổi màu thẻ HELP trong app', 'Gửi thông báo tới điện thoại người chăm sóc khi có HELP', 'Tăng số câu lên 20', 'Làm vỏ vòng tay đẹp hơn'],
          answer: 1,
          explanation: 'Hiện HELP chỉ được đọc lên loa điện thoại bên cạnh người dùng. Nếu người chăm sóc ở phòng khác thì có thể không nghe thấy. Báo thẳng tới người chăm sóc giải quyết đúng rủi ro đó.' },
        { type: 'match', id: 'u09.l3.q4', prompt: 'Ghép mỗi hạn chế với hướng khắc phục.',
          pairs: [
            ['Chỉ 5 câu cố định', 'Menu chọn câu, tùy biến trong app'],
            ['Bluetooth chưa mã hoá', 'Thêm ghép đôi (bonding) và mã hoá'],
            ['Chưa có số đo pin', 'Đo thời lượng pin, thêm chế độ ngủ'],
            ['Chỉ chạy trên Android', 'Làm thêm app iOS'],
            ['Ngưỡng giống nhau cho mọi người', 'Chỉnh ngưỡng theo từng người'],
          ],
          explanation: 'Mỗi hướng phát triển đều nhắm vào một hạn chế cụ thể. Khi trình bày, hãy nói theo cặp “hạn chế → hướng sửa” như thế này.' },
        { type: 'truefalse', id: 'u09.l3.q5', prompt: 'Khi thuyết trình, em có thể nói BandW **đã có** tính năng báo cho người chăm sóc.',
          answer: false,
          explanation: 'Sai. Code hiện tại chỉ hiện câu và đọc trên điện thoại của người dùng. Báo cho người chăm sóc là **kế hoạch**. Nói quá sẽ mất điểm khi giám khảo hỏi xem demo.' },
        { type: 'flashcard', id: 'u09.l3.q6', prompt: 'Giám khảo hỏi: “Nếu tiếp tục phát triển, em sẽ làm gì trước?”',
          modelAnswer: 'Việc đầu tiên là **đo trên người đeo thật**: mỗi cử chỉ nhiều lần, có phiên “không làm gì” để đếm lệnh nhầm. Từ số liệu đó, nhóm sẽ **chỉnh ngưỡng theo từng người** ngay trong app. Sau đó là **đo pin** và thêm chế độ tiết kiệm, rồi **báo cho người chăm sóc** khi có HELP. Thêm câu, iOS và mã hoá Bluetooth là các bước tiếp theo.',
          keyPoints: ['Đo trên người thật trước', 'Cá nhân hoá ngưỡng', 'Đo pin, tiết kiệm năng lượng', 'Báo người chăm sóc khi HELP'],
          explanation: 'Bẫy cần tránh: kể một danh sách dài không thứ tự. Hãy nói vì sao việc này phải làm trước việc kia.' },
      ],
    },
    // ───────────────────────── L4 ─────────────────────────
    {
      id: 'l4',
      title: 'Đạo đức, riêng tư và an toàn',
      minutes: 9,
      goal: 'Sau bài này, em chỉ ra được dữ liệu BandW đi đâu, vì sao nó không phải thiết bị y tế, và cách thử nghiệm có đạo đức.',
      steps: [
        { type: 'sim', title: 'Dữ liệu đi đâu?', sim: 'system-flow', props: { gesture: 'cycle' },
          caption: 'Theo dõi gói dữ liệu: nó chỉ đi từ cổ tay tới điện thoại rồi ra loa. Không có chặng nào lên Internet hay máy chủ.' },
        { type: 'diagram', title: 'Bức tường không cho dữ liệu lên mạng', svg: SVG_PRIVACY,
          caption: 'Dữ liệu chỉ nằm giữa vòng tay, điện thoại và loa. Vòng tay chỉ gửi một từ như “WATER”, không gửi số liệu cảm biến thô.',
          alt: 'Ba khối Vòng tay, Điện thoại, Loa nối bằng mũi tên. Phía trên có đường gạch đỏ “không gửi lên mạng”, và một đám mây Máy chủ / Internet có dấu ✕ không có dữ liệu BandW.' },
        { type: 'text', title: 'Riêng tư và an toàn',
          body: 'BandW không có camera, không ghi âm, không gửi dữ liệu lên máy chủ, và lịch sử 5 lệnh chỉ nằm trong phiên của app. Đó là cách BandW giữ [[quyền riêng tư]] (privacy) của người dùng.\n\n>! BandW **không phải [[thiết bị y tế]]** (medical device) và không thay thế chuông gọi y tá.' },
        { type: 'code', title: 'Bằng chứng: các quyền app xin', language: 'text', source: 'app/src/main/AndroidManifest.xml',
          code: '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />\n<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />\n<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />\n<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />\n<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />\n<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />\n<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
          highlight: [3, 4],
          caption: 'Toàn bộ quyền là Bluetooth, vị trí (chỉ Android 11 trở xuống, để quét BLE) và thông báo nền. Không có quyền Internet, micro hay camera.',
          notes: [
            { lines: [3, 3], note: 'Android 8–11 bắt buộc quyền vị trí để quét BLE; app không dùng vị trí.' },
            { lines: [4, 4], note: 'neverForLocation: hứa với Android là không dùng kết quả quét để định vị.' },
            { lines: [6, 8], note: 'Dịch vụ nền “BandW đang lắng nghe vòng tay” (phiên bản mới) giữ kết nối khi tắt màn hình.' },
          ] },
        { type: 'hotspot', id: 'u09.l4.q1', prompt: 'Chạm vào nơi mà dữ liệu cử chỉ của BandW **không bao giờ** đi tới.',
          target: { kind: 'diagram', svg: SVG_PRIVACY }, answer: 'cloud',
          explanation: 'Dữ liệu chỉ đi vòng tay → điện thoại → loa. App không có quyền Internet, nên không có máy chủ nào nhận được lệnh của người dùng.' },
        { type: 'truefalse', id: 'u09.l4.q2', prompt: 'BandW là thiết bị y tế đã được chứng nhận.',
          answer: false,
          explanation: 'Sai. BandW là sản phẩm nghiên cứu của học sinh, chỉ hỗ trợ giao tiếp. Muốn dùng trong bệnh viện cần thử nghiệm có giám sát và được cấp phép theo quy định.' },
        { type: 'multi', id: 'u09.l4.q3', prompt: 'Chọn **tất cả** biện pháp riêng tư mà BandW **hiện đang có**.',
          options: ['Không dùng camera', 'Không dùng micro', 'Không gửi dữ liệu lên máy chủ', 'Lịch sử chỉ giữ 5 lệnh trong phiên app', 'Mã hoá Bluetooth đầu-cuối', 'Đăng nhập bằng vân tay'],
          answers: [0, 1, 2, 3],
          explanation: 'Bốn biện pháp đầu có thật trong code và README. Mã hoá Bluetooth **chưa có** (MVP không ghép đôi), còn đăng nhập vân tay không tồn tại. Nói nhầm hai mục này là phóng đại.' },
        { type: 'mcq', id: 'u09.l4.q4', prompt: 'Thử với người bệnh cần [[đồng thuận có hiểu biết]] (informed consent). Nhóm phải làm gì **trước tiên**?',
          options: ['Thử ngay cho nhanh', 'Giải thích rõ và xin đồng thuận có hiểu biết, có người chăm sóc hoặc thầy cô giám sát', 'Chỉ cần hỏi bạn cùng lớp', 'Đăng ảnh người bệnh lên mạng để quảng bá'],
          answer: 1,
          explanation: 'Người tham gia (hoặc người giám hộ) phải hiểu mục đích, rủi ro và tự nguyện đồng ý, có người lớn giám sát. Đăng ảnh khi chưa được phép vi phạm quyền riêng tư.' },
        { type: 'order', id: 'u09.l4.q5', prompt: 'Sắp xếp quy trình thử nghiệm **có đạo đức** với người tham gia.',
          items: ['Giải thích mục đích và rủi ro', 'Xin đồng ý tự nguyện (người giám hộ nếu cần)', 'Thử có người giám sát, dừng được bất cứ lúc nào', 'Ghi kết quả ẩn danh, không ghi tên'],
          explanation: 'Hiểu rõ trước, đồng ý sau, rồi mới thử dưới sự giám sát. Khi ghi kết quả thì dùng mã thay cho tên, để bảo vệ người tham gia.' },
        { type: 'mcq', id: 'u09.l4.q6', prompt: 'Một người dùng không muốn câu nói tự phát ra loa ở nơi đông người. App hiện có cách nào?',
          options: ['Tắt công tắc “Tự động đọc khi nhận lệnh”: câu vẫn hiện, khi muốn thì bấm Đọc lại', 'Không có cách nào', 'Phải tháo pin vòng tay', 'Gửi câu lên máy chủ để duyệt'],
          answer: 0,
          explanation: 'MainActivity có công tắc tự động đọc và nút “Đọc lại”, “Dừng đọc”. Người dùng tự quyết khi nào câu được nói ra: đó là tôn trọng quyền tự quyết.' },
        { type: 'flashcard', id: 'u09.l4.q7', prompt: 'Giám khảo hỏi: “Dữ liệu người dùng có bị lộ không?”',
          modelAnswer: 'BandW **không thu hình, không ghi âm, không gửi lên máy chủ**: app không xin quyền Internet. Vòng tay chỉ gửi một từ như “WATER” tới điện thoại, và lịch sử 5 lệnh chỉ nằm trong phiên app. Tuy vậy, bản MVP **chưa ghép đôi và chưa mã hoá** Bluetooth, nên người ở gần có thể bắt được từ đó. Đây là hạn chế đã biết, hướng sửa là thêm ghép đôi và mã hoá.',
          keyPoints: ['Không camera, micro, máy chủ', 'Chỉ gửi 1 từ ASCII', 'Lịch sử chỉ trong phiên', 'Thừa nhận: BLE chưa mã hoá'],
          explanation: 'Bẫy cần tránh: nói “tuyệt đối an toàn”. Nêu cái đã có, rồi nêu cái chưa có.' },
      ],
    },
  ],
};
