# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Web tĩnh luyện thi **AWS Certified Solutions Architect – Associate (SAA-C03)** từ hai ngân hàng câu hỏi: **sub** `question-doc-sub/` (500 câu → 7 đề, trước đây tên `Question-Doc/`) và **main** `question-doc-main/` (12 file JSON = 12 đề cố định 65 câu). Stack: **Vite + React + TypeScript + Vitest**, hash router, lưu trạng thái bằng `localStorage`. Giai đoạn 1 (dữ liệu + web lõi) và giai đoạn 2 (hướng dẫn tiếng Việt `data/vi` cho đủ 500 câu, quy tắc soạn ở `docs/vi-style-guide.md`) đã xong; giai đoạn 3 là ghi chú service `data/services`, giai đoạn 4 là deploy lên GitHub Pages.

**Thiết kế chi tiết (nguồn chuẩn):** [docs/superpowers/specs/2026-09-24-saa-c03-exam-site-design.md](docs/superpowers/specs/2026-09-24-saa-c03-exam-site-design.md). Khi có mâu thuẫn giữa file này và spec, spec được ưu tiên.

**Tuyệt đối không tạo thêm câu hỏi và không sửa đáp án gốc.** Nếu nghi đáp án sai, chỉ gắn cờ `review` kèm lý do.

## Lệnh

- `npm run dev` — chạy web ở máy · `npm run build` — build ra `dist/` · `npm run preview` — xem bản build
- `npm test` — chạy toàn bộ test · một file: `npx vitest run src/engine/attempt.test.ts` · một test: `npx vitest run -t "tên test"`
- `npm run typecheck`
- `npm run parse` — `question-doc-sub/` → `data/questions.json`
- `npm run main` — `question-doc-main/*.json` → `data/main.json` (sinh ra; `validate` báo lỗi nếu quên chạy lại)
- `npm run main:show -- pt1_1 [đầu] [cuối]` — in câu main dạng chữ (id, đáp án, giải thích) để soạn `data/main-meta/pt1_1.json`
- `npm run sets` — `data/meta` → `data/sets.json` (tất định, seed 20260924; cần đủ meta cho 500 câu)
- `npm run validate` — kiểm tra toàn bộ dữ liệu (lỗi thì exit 1)
- `npm run vi:show -- 26` — in lô 25 câu bắt đầu từ câu 26 (đề, lựa chọn, đáp án, meta, giải thích gốc) để soạn `data/vi/q026-050.json`; quy tắc soạn ở `docs/vi-style-guide.md`
- `npm run external` — `external/*.html` → `data/external/<slug>.json` (chạy lại mỗi khi thêm/sửa file HTML; `validate` báo lỗi nếu quên)
- `npm run external:show -- <slug> [đầu] [cuối]` — in câu hỏi External kèm giải thích gốc tiếng Anh để soạn `data/external-vi/<slug>/*.json`
- `npm run check` — validate + test + typecheck; chạy trước khi commit
- Đăng nhập Google và đồng bộ (tùy chọn): sao chép `.env.example` thành `.env.local` rồi điền cấu hình Firebase, xem `docs/firebase-setup.md`. Không có `.env.local` thì web chạy ở chế độ khách.

## Kiến trúc

- `scripts/` (chạy bằng tsx) sinh và kiểm tra dữ liệu; logic nằm trong `scripts/lib/*` dạng hàm thuần, có test.
- `data/`: `questions.json` và `sets.json` là file **sinh ra** (không sửa tay); `meta/`, `vi/`, `services/`, `service-registry.json` là nội dung **soạn tay**. Id service trong meta phải có trong `service-registry.json`.
- `src/engine/`: toàn bộ logic thi là hàm thuần, ngẫu nhiên luôn nhận seed: `attempt` (hoán đổi 10 câu với kho dự phòng + xáo trộn), `actions`, `scoring`, `review` (trạng thái màu của lựa chọn), `stats`, `timer`.
- Ngân hàng có vài cặp câu trùng nguyên văn: `build-sets` tự phát hiện, ghi vào `sets.json` (`duplicates`) và không để hai câu trùng cùng một đề; `pickQuestionIds` bỏ qua câu dự phòng có "câu sinh đôi" đã nằm trong lượt thi.
- Mỗi lượt thi (`Attempt`) lưu `optionOrder` theo **nhãn gốc**, và đáp án cũng lưu theo nhãn gốc. Nhãn hiển thị A/B/C chỉ tính lúc render (`displayLabel`). Đừng lưu nhãn hiển thị.
- UI lấy dữ liệu qua `useApp()` (`src/app/context.tsx`). Test UI dùng `makeDeps()`/`renderApp()` trong `src/test/fixtures.tsx`, với bank giả gồm 75 câu.
- `src/sync/`: đồng bộ lượt thi lên Firebase khi đăng nhập Google. `controller.ts` (máy trạng thái đăng nhập/xung đột), `merge.ts` (quy tắc gộp, hàm thuần), `firebase.ts` (adapter duy nhất import Firebase SDK, chỉ `main.tsx` import nó). Store lưu thêm owner và `updatedAt` của từng lượt ở key phụ `saa-c03:owners:v1`. Test dùng bản giả `src/test/fake-sync.ts`, không gọi mạng. Thiết kế: `docs/superpowers/specs/2026-11-02-firebase-sync-design.md`.
- `src/ai/`: chat Gemini (Firebase AI Logic) ở chế độ Thi thử. `types.ts` (giao diện `AiClient`/`ChatHistoryStore`), `prompt.ts` (dựng prompt, cắt lịch sử còn 40 tin), `gemini.ts` (adapter duy nhất import `firebase/ai`, chỉ `main.tsx` import). Lịch sử lưu ở `users/{uid}/aiChats/{attemptId}/{qid}` qua `chats` trong `src/sync/firebase.ts`; `deps.ts` (`buildAiDeps`, model mặc định `gemini-3.5-flash`) chỉ tạo `ai` khi có `VITE_RECAPTCHA_SITE_KEY` vì Firebase bắt buộc App Check cho AI Logic. Gemini có tool `find_answered_questions` (`search.ts`: tìm câu đã trả lời trong mọi lượt cùng đề, bỏ lượt Thi thật đang làm; câu tìm được thuộc lượt Thi thử chưa nộp bị gắn nhãn đã xem hướng dẫn), chạy qua vòng function calling thuần `tool-loop.ts` (tối đa 3 vòng). Nút 🕘 trong khung chat liệt kê mọi cuộc trò chuyện (`ChatHistoryStore.list`, đọc thẳng `aiChats`) để mở lại và hỏi tiếp. Test dùng `src/test/fake-ai.ts`.
- `src/data/service-status.ts`: bảng dịch vụ đã đổi tên/đã ngừng (kiểm tra 10/2026). Hướng dẫn tự hiện mục "Cập nhật dịch vụ" cho câu nào nhắc tới chúng (cả External); khi AWS đổi tên hay ngừng dịch vụ thì cập nhật bảng này. Câu có đáp án đúng phụ thuộc dịch vụ đã ngừng vẫn gắn `review`.\n- **Main** (`question-doc-main/`): `npm run main` dựng `data/main.json` (`sets` id 101…112 = "Main 1…12", câu id `setId*100 + vị trí`, đáp án theo chữ cái gốc A/B/C…, `html: true`, và `twins` = cặp câu trùng nguyên văn giữa các file). Meta soạn tay ở `data/main-meta/<file>.json` chỉ cho câu gốc (`ptX_1`), câu trùng dùng lại meta qua `expandMainMetas` (`src/data/main-meta.ts`). Trường `note` trong meta là ghi chú review (đáp án đáng ngờ, thông tin lỗi thời…), hiện trong hướng dẫn. Đề main không thay câu dự phòng; lựa chọn luôn xáo, thứ tự câu chỉ xáo khi bật công tắc "Xáo thứ tự câu hỏi" trên trang chủ (`createAttempt` với `mainSets` + `shuffleQuestions`). Nhãn đề dùng `setLabel()` (`src/app/format.ts`).
- `src/data/load.ts` nạp JSON bằng `import.meta.glob`, nên thêm file vào `data/meta` hay `data/vi` không cần sửa code.
- **External** (`#/external`): mỗi file HTML trong `external/` là một bộ câu hỏi luyện tập riêng, không vào 7 đề và không tính thống kê. File gốc chỉ có `rawData` gồm đề + giải thích; `scripts/lib/parse-external.ts` dựng lại lựa chọn từ phần "Correct/Incorrect options" (đáp án đúng luôn đứng đầu, nên trang luyện tập luôn xáo lựa chọn; thứ tự câu hỏi giữ như file gốc, không xáo). `data/external/` là file **sinh ra**; `data/external-vi/<slug>/*.json` là hướng dẫn tiếng Việt **soạn tay** (cùng định dạng và quy tắc với `data/vi`, dịch từ giải thích trong file HTML). Lúc build, `vite.config.ts` chép `external/*.html` vào `dist/external/` để link "file HTML gốc" trên header chạy được, và chèn script xáo lựa chọn (`scripts/lib/external-html.ts`) nếu file chưa có. `external/aws_quiz_final.html` đã được chèn sẵn script này để mở trực tiếp cũng xáo; file HTML mới thả vào chỉ được chèn ở bản build.

## Tài liệu nguồn

- `exam_guide/ssa-03-aws.pdf` — Exam Guide chính thức (30 trang, **bản scan, không có text layer**: `pdftotext`/`pypdf` trả về rỗng. Muốn đọc thì render trang ra ảnh, ví dụ `pypdfium2` cài vào scratchpad, rồi đọc ảnh).
- `question-doc-main/` — 12 file `pt1_1.json` … `pt6_2.json`, mỗi file 65 câu `{ question, options, correctAnswerIndices, explanation }` dạng HTML (giải thích tiếng Anh, có ảnh). **Không sửa các file này.** Mỗi file `ptX_2` trùng nội dung `ptX_1` (cùng 65 câu, khác thứ tự), nên chỉ có 390 câu khác nhau.
- `question-doc-sub/` — 500 câu, không có hình ảnh:
  - `SAA-C03_Part1-2_Q1-50.md`: Markdown. Mỗi câu: `## Question N`, đoạn đề bài, dòng in đậm `**Which ...?**`, các lựa chọn `A.`…`E.`, `**Answer: D**` hoặc `**Answer: A, E**`, `**Explanation:** ...` (tiếng Việt), ngăn cách bằng `---`.
  - `SAA-C03_PartX_Qa-b.docx` (Part 3–21, Q51–500, 20–25 câu/file): đầu file có bảng "Bảng đáp án nhanh" (bỏ qua khi parse), sau đó Heading1 "Chi tiết câu hỏi, đáp án và giải thích"; mỗi câu là Heading2 `Question N`, đoạn đề bài, câu hỏi in đậm, các lựa chọn `A.`…, `Đáp án đúng: D` (hoặc `A, C`), `Giải thích: ...`.
  - Câu nhiều đáp án có ghi `(Choose two.)` / `(Choose three.)` trong câu hỏi; đáp án cách nhau bằng dấu phẩy.
  - Giải thích có sẵn chỉ là ghi chú ngắn bằng tiếng Việt trộn thuật ngữ tiếng Anh — **chưa có bản dịch đề/đáp án**.
- Có thể đọc `.docx` bằng Python chuẩn (`zipfile` + regex trên `word/document.xml`, lấy `w:pStyle` để nhận Heading). Trên Windows cần `PYTHONIOENCODING=utf-8` khi in ra console (mặc định cp932 sẽ lỗi với tiếng Việt).

## Quy tắc đề thi (từ Exam Guide)

- 65 câu/đề: 50 câu tính điểm + 15 câu không tính điểm (không được đánh dấu). Không trừ điểm khi đoán; câu bỏ trống tính là sai.
- Hai loại câu: multiple choice (1 đúng / 4 lựa chọn) và multiple response (≥2 đúng / ≥5 lựa chọn) — chỉ được điểm khi chọn đúng đủ.
- Điểm quy đổi thang 100–1000, **đậu ≥ 720**; chấm bù trừ (không cần đậu từng domain).
- 4 domain và trọng số: Secure 30%, Resilient 26%, High-Performing 24%, Cost-Optimized 20%. Kết quả nên có bảng phân tích theo domain.
- Exam Guide không ghi thời lượng; thời gian thi chính thức của SAA-C03 là 130 phút.

## Các quyết định chính (chi tiết xem spec)

- 7 đề cố định × 65 câu, mỗi đề **20 Secure / 17 Resilient / 15 High-Performing / 13 Cost**, **độ khó tăng dần từ Đề 1 đến Đề 7** (thang chấm ở `docs/difficulty-rubric.md`); 45 câu còn lại làm kho dự phòng. Mỗi lượt thi thay ngẫu nhiên 10 câu bằng câu trong kho dự phòng cùng domain và độ khó, sau đó xáo thứ tự câu hỏi và lựa chọn.
- Điểm = 100 + 900 × số câu đúng / 65, đậu khi ≥ 720; câu nhiều đáp án phải chọn đúng đủ mới được điểm.
- Thi thật: 130 phút (160 phút nếu bật ESL +30, bật sẵn), chỉ mở hướng dẫn sau khi nộp. Thi thử: không tính giờ, mở hướng dẫn được ngay tại câu, và câu đã mở hướng dẫn được gắn nhãn khi chấm.
- Ngôn ngữ: đề bài và các lựa chọn luôn bằng tiếng Anh; tiếng Việt chỉ nằm trong hướng dẫn. Màn hình Thi thật dùng giao diện tiếng Anh, các trang khác dùng tiếng Việt.
- Thống kê % đúng theo domain cho từng lượt thi và theo từng đề (trang `/set/:id`), tách riêng Thi thật và Thi thử.
- Xem lại sau khi nộp: chọn đúng tô xanh, chọn sai tô đỏ, đáp án đúng bị bỏ sót có viền xanh; mọi câu đều có hướng dẫn.
- Nội dung tiếng Việt (`data/vi`), meta (`data/meta`) và ghi chú service (`data/services`) được soạn theo lô rồi lưu vào repo, không sinh lại mỗi lần chạy. Giải thích **không được dùng chữ cái A/B/C** để chỉ lựa chọn, vì thứ tự lựa chọn bị xáo.
