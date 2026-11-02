# Thiết kế: Website luyện thi AWS SAA-C03

Ngày: 2026-09-24 · Trạng thái: chờ duyệt

## 1. Mục tiêu

Web tĩnh để luyện thi **AWS Certified Solutions Architect – Associate (SAA-C03)** từ 500 câu có sẵn trong `Question-Doc/`. Người học làm các đề hoàn chỉnh đúng cấu trúc đề thật, được chấm điểm, và học qua hướng dẫn tiếng Việt cho từng câu cùng trang ghi chú về các AWS service.

**Tiêu chí thành công**
- 7 đề × 65 câu, mỗi đề đúng tỷ lệ domain; mỗi lần làm, thứ tự câu hỏi và đáp án đều khác nhau.
- Hai chế độ Thi thật / Thi thử hoạt động đúng như mục 5.
- Mỗi câu có bản dịch tiếng Việt, lý do đúng/sai cho từng lựa chọn, giải thích và danh sách service.
- Có trang ghi chú service kèm hướng dẫn thực hành.
- Chạy hoàn toàn trên trình duyệt, host được trên GitHub Pages.

**Ngoài phạm vi**: tài khoản người dùng, backend, đồng bộ giữa nhiều thiết bị, gọi AI lúc chạy, thêm câu hỏi mới.

## 2. Cam kết về dữ liệu

- **Nguồn câu hỏi duy nhất là 500 câu trong `Question-Doc/`.** Đề bài, các lựa chọn và đáp án được chép nguyên văn khi parse. Không tạo thêm câu hỏi hay lựa chọn. Không sửa file gốc.
- **Đáp án giữ nguyên như tài liệu.** Nội dung tiếng Việt không được ghi đè đáp án. Nếu nghi đáp án gốc sai, chỉ gắn cờ `review` kèm lý do để người dùng quyết định.
- Nội dung soạn thêm chỉ gồm: bản dịch, giải thích, phân loại domain và độ khó, danh sách service, ghi chú service.

## 3. Quy tắc đề thi (theo Exam Guide)

- 65 câu/đề. Có hai loại câu: multiple choice (1 đáp án đúng) và multiple response (chọn 2 hoặc 3 theo ghi chú "Choose two/three").
- Phân bổ domain cho mỗi đề: **Secure 20 · Resilient 17 · High-Performing 15 · Cost-Optimized 13** (tương ứng 30/26/24/20%).
- Chấm điểm: một câu chỉ được tính đúng khi chọn đủ và đúng tất cả đáp án. Câu bỏ trống tính là sai. **Điểm = round(100 + 900 × số câu đúng / 65)**, đậu khi **≥ 720**. Tính cả 65 câu, không mô phỏng 15 câu không tính điểm.
- Thời gian Thi thật: 130 phút, hoặc 160 phút nếu bật **ESL +30** (bật sẵn). Kèm lời nhắc: phải đăng ký ESL +30 với AWS trước khi đặt lịch thi thật.

## 4. Dữ liệu và luồng xử lý

```
Question-Doc/  --scripts/parse.ts-->  data/questions.json
data/meta/*.json      (soạn tay theo lô)  domain, difficulty, services
data/vi/*.json        (soạn tay theo lô)  bản dịch + giải thích
data/services/*.json  (soạn tay)          ghi chú service
data/questions.json + data/meta  --scripts/build-sets.ts-->  data/sets.json
tất cả  --scripts/validate.ts-->  báo lỗi / cảnh báo
```

### 4.1 Parse (`scripts/parse.ts`)
- `.md` (Q1–50): tách theo `## Question N`; câu hỏi là dòng in đậm `**...?**`; các lựa chọn là dòng `A.`–`E.`; đáp án ở `**Answer: X[, Y]**`; giải thích ở `**Explanation:**`.
- `.docx` (Q51–500): giải nén, đọc `word/document.xml`, nhận Heading2 `Question N`. Bỏ qua bảng "Bảng đáp án nhanh". Đáp án ở `Đáp án đúng: X[, Y]`, giải thích ở `Giải thích: ...`.
- Kết quả có dạng `Question { id: number, stem: string, prompt: string, options: {key: "A"…"E", text}[], answer: string[], choose: number, explanationOrig: string }`. `choose` = số đáp án đúng.

### 4.2 Meta (`data/meta/qNNN-NNN.json`)
`{ id, domain: 1|2|3|4, difficulty: 1|2|3, services: string[] }`
- Domain: 1 Secure, 2 Resilient, 3 High-Performing, 4 Cost-Optimized. Mỗi câu thuộc đúng một domain, chọn theo mục tiêu chính của câu hỏi (ví dụ "MOST cost-effective" → 4).
- Độ khó: 1 = nhận diện một service/khái niệm; 2 = so sánh vài phương án hợp lý hoặc có 2 ràng buộc; 3 = nhiều ràng buộc, multiple response, hoặc các lựa chọn gây nhiễu rất sát nhau.
- `services`: id dạng kebab-case (`s3`, `sqs`, `kinesis-data-analytics`…), phải khớp với `data/services`.

### 4.3 Nội dung tiếng Việt (`data/vi/qNNN-NNN.json`)
```
{ id, stemVi, promptVi,
  options: [{ key /* nhãn gốc */, textVi, reason }],
  explanationVi, keyHint /* dấu hiệu nhận biết */,
  review?: { reason } }
```
- Tên service và thuật ngữ AWS giữ nguyên tiếng Anh; các cụm từ khóa (LEAST operational overhead, MOST cost-effective…) được dịch kèm bản gốc.
- `reason` và `explanationVi` **không được dùng chữ cái A/B/C** để chỉ lựa chọn (vì thứ tự lựa chọn bị xáo). Phải nói theo nội dung.
- Soạn theo lô 25 câu, lần lượt từ Q1 đến Q500.

### 4.4 Ghi chú service (`data/services/<id>.json`)
```
{ id, name, category /* theo danh mục In-Scope của Exam Guide */, tier: "core"|"minor",
  overview, concepts: {term, desc}[], howItWorks, useCases: string[], pricing,
  examSignals: string[], compareWith: {service, diff}[], facts: string[],
  practice?: { steps: string[], freeTier: string, cleanup: string[] } }
```
- `core` (khoảng 30–40 service xuất hiện nhiều, như S3, EC2, VPC, IAM, RDS, Aurora, DynamoDB, SQS, SNS, Lambda, CloudFront, Route 53, KMS…): điền đủ các trường, bắt buộc có `practice` và phải có bước dọn dẹp tài nguyên.
- `minor`: bắt buộc có `overview`, `examSignals`, `compareWith`; các trường khác không bắt buộc.
- "Câu hỏi liên quan" không lưu trong file mà được tính từ `meta.services`.

### 4.5 Xếp đề (`scripts/build-sets.ts`)
- Chạy tất định với seed cố định: cùng dữ liệu đầu vào luôn cho ra cùng `sets.json`.
- Mỗi domain có đủ quota cho 7 đề (bank_d ≥ 7 × quota_d); không câu nào nằm ở hai đề.
- **Độ khó tăng dần: Đề 1 dễ nhất, Đề 7 khó nhất** (cập nhật 2026-10-30). Trong mỗi domain, số câu lấy cho 7 đề chia theo tỷ lệ từng mức độ khó, xếp từ dễ đến khó (cùng mức thì xáo theo seed), rồi chia thành 7 khúc liên tiếp theo quota domain. Thang chấm độ khó ở `docs/difficulty-rubric.md`.
- Câu còn lại (45 câu) vào `reserve`, giữ nguyên nhãn domain và độ khó; kho dự phòng có đủ các mức độ khó của mỗi domain, nên việc thay 10 câu cùng domain và độ khó mỗi lượt thi giữ được mức khó của đề.
- Nếu một domain không đủ câu cho 7 đề: script vẫn chạy, bù chỗ thiếu bằng câu của domain đang dư và in cảnh báo nêu rõ đề nào lệch bao nhiêu câu. Không âm thầm bỏ qua.
- Kết quả: `{ version, sets: [{ id: 1..7, questionIds: number[65] }], reserve: number[] }`.

### 4.6 Kiểm tra (`scripts/validate.ts`)
**Lỗi** (exit ≠ 0):
- Không đủ 500 câu, hoặc số hiệu không liên tục 1..500.
- Đáp án không nằm trong các lựa chọn.
- `choose` không khớp với "Choose two/three".
- Có `id` trong meta/vi/sets không tồn tại trong questions.
- Số lựa chọn hoặc các `key` trong vi không khớp với bản gốc.
- Một câu nằm ở hai đề; tổng số câu trong các đề và reserve ≠ 500.
- Có service được tham chiếu nhưng thiếu file ghi chú (lỗi khi đã có meta).
- Trong `reason`/`explanationVi` có chữ cái chỉ lựa chọn (regex kiểu `\b(đáp án|phương án|lựa chọn|option)\s+[A-E]\b`).

**Cảnh báo**: câu chưa có meta hoặc vi; đề lệch quota; service `core` thiếu `practice`.

## 5. Luồng thi

### 5.1 Tạo lượt thi (`src/engine/`)
1. Lấy 65 câu của đề. Chọn ngẫu nhiên **10 câu** để thay bằng câu trong `reserve` cùng domain và cùng độ khó; nếu không có thì giữ nguyên câu cũ (từ 2026-10-30 không còn lấy câu cùng domain khác độ khó, để đề giữ đúng mức khó). Tỷ lệ domain luôn được giữ.
2. Xáo thứ tự câu hỏi (Fisher–Yates), rồi xáo thứ tự lựa chọn trong từng câu. Nhãn hiển thị A/B/C… được gán lại theo vị trí mới, còn nhãn gốc được lưu để ánh xạ ngược.
3. Mọi hàm ngẫu nhiên đều nhận `rng` (có seed) truyền vào. Seed được lưu cùng lượt thi.

`Attempt { id, setId, mode: "real"|"practice", seed, esl: boolean, startedAt, endsAt?, questions: [{ qid, domain /* lưu lại lúc tạo lượt thi */, optionOrder: string[] }], answers: Record<qid, string[] /* nhãn gốc */>, flagged: qid[], guideOpened: qid[], submittedAt?, status: "in-progress"|"submitted"|"incompatible" }`

Domain được lưu cùng lượt thi, để thống kê cũ không đổi nếu sau này meta được phân loại lại.

### 5.1a Quy tắc ngôn ngữ
- **Đề bài và các lựa chọn luôn hiển thị bằng tiếng Anh** (nguyên văn) ở cả hai chế độ, giống đề thật.
- **Tiếng Việt chỉ nằm trong hướng dẫn**: bản dịch đề và lựa chọn, lý do, giải thích, dấu hiệu nhận biết. Không có nút dịch riêng bên ngoài hướng dẫn.
- Màn hình **Thi thật** dùng giao diện tiếng Anh để mô phỏng phòng thi: Question 12 of 65, Flag for review, Previous/Next, Review all, End exam, Time remaining. Các trang còn lại (trang chủ, kết quả, hướng dẫn, ghi chú service) dùng tiếng Việt.

### 5.2 Thi thật
- Đồng hồ đếm ngược tính theo `endsAt` (không đếm lùi từng giây), nên tải lại trang hay để máy ngủ vẫn tính đúng. Hết giờ thì tự nộp.
- Có lưới 65 ô để chuyển câu, cờ "xem lại", được đổi đáp án trước khi nộp. Câu nhiều đáp án dùng checkbox, ghi rõ số đáp án cần chọn ("Choose N") và không cho chọn quá N.
- Trong lúc thi **không hiện** bản dịch, đáp án, tô màu hay hướng dẫn. Có hộp xác nhận trước khi nộp, cho biết số câu chưa làm và số câu đang đánh dấu.

### 5.3 Thi thử
- Không tính giờ. Nút **"Xem hướng dẫn"** dùng được ngay tại câu, bất cứ lúc nào. Khi mở: tô màu xanh/đỏ cho câu đó (nếu đã chọn), hiện đầy đủ hướng dẫn, và thêm `qid` vào `guideOpened`.
- Câu đã mở hướng dẫn vẫn được chấm bình thường, nhưng trang kết quả gắn nhãn "đã xem hướng dẫn" và hiện thêm "Đúng khi chưa xem hướng dẫn: X/65".

### 5.4 Kết quả và xem lại (cả hai chế độ, sau khi nộp)
- Hiện điểm, Đậu/Trượt, thời gian làm bài (và ghi rõ 130 hay 160 phút với Thi thật).
- **Bảng thống kê theo domain** của lượt thi: Domain | Số câu | Đúng | % đúng, gồm 4 dòng và một dòng tổng. Domain có tỷ lệ dưới 72% được đánh dấu "cần ôn". Mỗi dòng bấm được để lọc phần xem lại theo domain đó.
- Xem lại toàn bộ 65 câu, **mở hướng dẫn cho mọi câu** (cả câu đúng, câu sai và câu bỏ trống):
  - chọn và đúng → **xanh**; chọn nhưng sai → **đỏ**; đúng nhưng không chọn → **viền xanh** kèm nhãn "Đáp án đúng".
  - hướng dẫn gồm: bản dịch đề và từng lựa chọn, lý do của từng lựa chọn, giải thích, dấu hiệu nhận biết, các service (dạng chip, bấm vào mở trang ghi chú).
- Bộ lọc: Tất cả / Câu sai / Câu đánh dấu xem lại / Câu đã xem hướng dẫn / theo domain.
- Lượt thi đã nộp được lưu lại, mở xem lại được từ lịch sử.

### 5.4a Thống kê theo đề
- Trang `/set/:id` cho mỗi đề: bảng các lượt đã làm (ngày, chế độ, điểm, Đậu/Trượt, **% đúng của từng domain**), cùng dòng **trung bình** và dòng **lượt gần nhất**.
- Trên trang chủ, thẻ của mỗi đề hiện điểm cao nhất, số lần làm, và 4 thanh % đúng theo domain của lượt gần nhất.
- Thống kê tách riêng Thi thật và Thi thử (có bộ lọc), vì lượt Thi thử có mở hướng dẫn nên không phản ánh đúng thực lực.
- Hàm tính thống kê là hàm thuần trong `src/engine/stats.ts`, nhận danh sách Attempt và trả về số liệu theo đề/domain.

### 5.5 Khi nội dung chưa đủ
- Câu chưa có `vi`: hiện `explanationOrig`, kèm nhãn "(gốc: X)" bên cạnh mỗi lựa chọn để đối chiếu các chữ cái nhắc trong giải thích gốc.
- Service chưa có ghi chú: chip hiện trạng thái "đang cập nhật".

## 6. Giao diện

Dùng hash router: `/` (danh sách 7 đề, điểm cao nhất và số lần làm, lịch sử, nút làm tiếp) · `/set/:id` (thống kê theo đề) · `/exam/:id` · `/result/:id` · `/services` (nhóm theo danh mục, có tìm kiếm) · `/services/:id` · `/q/:id` (xem riêng một câu kèm hướng dẫn, mở từ "Câu hỏi liên quan"). Giao diện responsive cho điện thoại và máy tính, có chế độ sáng/tối.

## 7. Kiến trúc code

Vite + React + TypeScript, test bằng Vitest.
```
scripts/          parse.ts, build-sets.ts, validate.ts
data/             questions.json, meta/, vi/, services/, sets.json
src/engine/       hàm thuần: tạo lượt thi, hoán đổi, xáo trộn, chấm điểm, tính giờ
src/data/         kiểu dữ liệu + nạp JSON (gộp questions + meta + vi)
src/storage/      đọc/ghi localStorage (bọc try/catch, có version schema)
src/pages/        Home, Exam, Result, Services, ServiceDetail, QuestionView
src/components/   QuestionCard, OptionItem, GuidePanel, Timer, NavGrid, ServiceChip…
```
Khi người dùng đăng nhập Google, lượt thi còn được đồng bộ lên Firebase Realtime Database qua `src/sync/`; xem [spec đồng bộ](2026-11-02-firebase-sync-design.md).

## 8. Xử lý lỗi

- `localStorage` bị chặn hoặc dữ liệu hỏng: web vẫn chạy, không lưu lịch sử, hiện thông báo nhỏ. Bản ghi hỏng thì bỏ qua, không làm sập trang.
- Lượt thi tham chiếu tới `qid` hoặc nhãn lựa chọn không còn tồn tại: đặt `status = "incompatible"`, hiện trong lịch sử nhưng không mở được.
- JSON dữ liệu sai: validate chặn từ lúc build (`npm run check`).

## 9. Kiểm thử

- Vitest cho `src/engine`:
  - hoán đổi giữ đúng tỷ lệ domain, không tạo câu trùng, dùng fallback đúng thứ tự;
  - xáo trộn tất định theo seed; ánh xạ nhãn hiển thị ↔ nhãn gốc chính xác;
  - chấm câu nhiều đáp án (thiếu, thừa, đúng đủ), câu bỏ trống, ngưỡng 720;
  - tính giờ theo `endsAt`, tự nộp khi hết giờ;
  - `stats.ts`: tính % đúng theo domain cho từng lượt, trung bình theo đề, lọc theo chế độ, không lỗi khi đề chưa có lượt nào.
- Test cho parser với trích đoạn mẫu của cả `.md` và `.docx`.
- `validate.ts` chạy trên dữ liệu thật như một bước kiểm tra.

## 10. Lệnh

- `npm run dev`: chạy web ở máy · `npm run build`: build ra `dist/` · `npm test`: chạy test (một test: `npx vitest run -t "<tên>"`)
- `npm run data`: parse → build-sets → validate
- `npm run check`: validate + test + typecheck

## 11. Thứ tự thực hiện

1. **Dữ liệu và web lõi**: khởi tạo project, parser, meta cho 500 câu, build-sets, validate, engine, các trang Home/Exam/Result/QuestionView. Giai đoạn này dùng giải thích gốc.
2. **Nội dung tiếng Việt**: `data/vi` theo lô 25 câu.
3. **Ghi chú service**: làm `core` trước, `minor` sau; trang `/services`.
4. **Triển khai** lên GitHub Pages.

Lưu ý: meta (domain/độ khó) phải có cho đủ 500 câu trước khi chạy build-sets. Nếu xếp đề khi chưa đủ meta, danh sách đề sẽ bị lệch.
