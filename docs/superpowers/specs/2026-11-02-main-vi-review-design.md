# Main: review đáp án + hướng dẫn tiếng Việt (tab VI/EN)

## Mục đích

Bộ **main** (`question-doc-main/`, 12 đề, 390 câu khác nhau) hiện chỉ có giải thích gốc tiếng Anh dạng HTML, cùng meta và 16 ghi chú `note` từ lần gắn domain. Người dùng chưa làm hết các đề main nên chưa tự phát hiện được câu lỗi. Mục tiêu là trước khi họ làm tiếp:

1. **Review đáp án** của toàn bộ 390 câu: câu nào có đáp án gốc sai hoặc đáng ngờ thì gắn cờ kèm lý do.
2. **Hướng dẫn tiếng Việt** cho từng câu main, giống bộ sub: dịch đề, dịch từng lựa chọn kèm lý do đúng/sai, phần giải thích và dấu hiệu nhận biết.
3. **Giữ giải thích tiếng Anh gốc**: khung hướng dẫn của câu main có hai tab **VI** và **EN**.

## Mục tiêu / không làm / không được phép

- Mục tiêu: 390 câu gốc (`ptX_1`) có bản dịch và được review. Câu trùng ở `ptX_2` tự dùng lại bản dịch đó.
- Không làm: tab VI/EN cho External hoặc sub (chỉ làm cho main). Màn hình làm bài không dịch: đề và lựa chọn vẫn bằng tiếng Anh như quy tắc của dự án.
- Không được phép: **sửa đáp án gốc**, sửa file trong `question-doc-main/`, hoặc thêm câu hỏi. Câu nghi sai chỉ gắn cờ `review`.

## Dữ liệu

- Thư mục mới `data/main-vi/<file>.json` (ví dụ `pt1_1.json`). Mỗi file là mảng `QuestionVi`, **cùng định dạng** với `data/vi` (`id`, `stemVi`, `promptVi`, `options[{key, textVi, reason}]`, `explanationVi`, `keyHint`, `review?`). `id` là id main (`10101`…), `key` là chữ cái gốc A/B/C… như trong `data/main.json`.
- Chỉ soạn cho câu gốc. Câu trùng (`twins` trong `data/main.json`) được nhân bản lúc nạp, giống `expandMainMetas` (viết thêm hàm `expandMainVis` hoặc tổng quát hóa hàm cũ).
- Quy tắc soạn theo `docs/vi-style-guide.md`. Nội dung dịch dựa trên đề tiếng Anh, các lựa chọn và giải thích gốc tiếng Anh (bỏ HTML và hình). Trong `explanationVi` và `reason` không dùng chữ cái để chỉ lựa chọn, vì lựa chọn bị xáo.
- Khoảng 22 đề bài và 20 lựa chọn có code, bảng hoặc IAM policy JSON (`<pre>`, `<code>`, `<table>`). Trong `stemVi`/`textVi`, phần code/JSON giữ nguyên văn dạng chữ thường và chỉ dịch lời văn; bảng thì chuyển thành dòng chữ. Không đổi định dạng `QuestionVi`. Khung hướng dẫn hiển thị đoạn trông giống code (bắt đầu bằng `{` hoặc `[`) bằng `<pre>` *(quyết định của tôi)*.
- `src/data/load.ts` nạp `data/main-vi/*.json` bằng `import.meta.glob` rồi gộp vào `vis` của `buildBank`.
- `npm run validate` kiểm tra `data/main-vi` theo cùng luật với `data/vi` (dùng lại `validate-vi`): id phải tồn tại trong main, key lựa chọn phải khớp và đủ, không có id trùng, không đặt bản dịch cho câu trùng (chỉ câu gốc). Có thể chỉ báo thiếu bản dịch dưới dạng cảnh báo để làm dần theo lô.
- Công cụ soạn: dùng `npm run main:show -- pt1_1 [đầu] [cuối]` như hiện nay. Nếu nó chưa in đủ thông tin để dịch (đề, lựa chọn, đáp án, meta, giải thích) thì bổ sung.

## Review đáp án

- Làm cùng lúc với việc dịch: soạn câu nào thì kiểm tra đáp án câu đó dựa trên kiến thức AWS hiện tại và tài liệu chính thức.
- Câu sai hoặc đáng ngờ: ghi `review: { reason }` trong bản dịch tiếng Việt. Lý do viết bằng tiếng Việt, nêu rõ lựa chọn nào có vẻ đúng hơn (gọi bằng nội dung, không gọi bằng chữ cái) và vì sao. Riêng `explanationVi` vẫn giải thích theo đáp án gốc.
- Câu có **đáp án đúng phụ thuộc vào dịch vụ đã ngừng hoặc sắp ngừng** (ví dụ RDS Custom for Oracle): gắn `review`, theo quy tắc trong CLAUDE.md và `src/data/service-status.ts`.
- Câu chỉ lỗi thời (dịch vụ đổi tên, con số đã cũ) nhưng đáp án vẫn đúng: ghi `note` trong meta như hiện nay, không gắn `review`.
- Ghi chú `note` hiện có: phần nghi ngờ đáp án (hoặc đáp án phụ thuộc dịch vụ đã ngừng) chuyển sang `review`. Phần chỉ nói về thông tin lỗi thời, hoặc nghi ngờ giải thích nhưng không nghi ngờ đáp án, thì giữ ở `note`. Ghi chú nào có cả hai loại thì tách ra hai nơi *(quyết định của tôi)*.
- Có hai câu gốc trùng nhau nhưng thứ tự lựa chọn khác nhau, nằm ở hai file `_1` khác nhau (10528 ở pt3_1, 11164 ở pt6_1). Chúng không có trong `twins`, nên vẫn dịch riêng cả hai, nội dung dịch giống nhau, và không truyền vào kiểm tra `duplicates` của `validate-vi` *(quyết định của tôi)*.
- Kết thúc: một bảng tổng hợp các câu đã gắn `review` (id, tóm tắt lý do) đặt ở cuối kế hoạch hoặc trong commit, để người dùng xem lại.

## Giao diện: tab VI / EN

Áp dụng trong `GuidePanel` khi `question.html` là true (câu main) **và** câu đó có bản dịch:

- Các phần chung nằm ngoài tab: đáp án đúng, mục "Cập nhật dịch vụ", ghi chú review (`meta.note`), **cảnh báo `vi.review`** (để ở tab EN vẫn thấy) và chip service *(quyết định của tôi về `vi.review`)*.
- Hai tab **VI** và **EN** (nút tab có `role="tab"`, `aria-selected`):
  - **VI**: giống sub. Gồm bản dịch đề, các lựa chọn theo thứ tự đang hiển thị kèm Đúng/Sai và lý do, Giải thích, Dấu hiệu nhận biết.
  - **EN**: giải thích gốc HTML (`explanationOrig`, có hình) như hiện nay.
- Mặc định mở tab VI. Tab được chọn lưu vào `localStorage` (bọc try/catch) và áp dụng cho các câu sau *(quyết định của tôi)*.
- Câu main chưa có bản dịch: không hiện tab, chỉ hiện giải thích tiếng Anh như hiện nay.
- Sub và External không thay đổi.

## Kiểm thử

- Hàm nhân bản bản dịch cho câu trùng: test đơn vị (giống test của `expandMainMetas`).
- Validate `data/main-vi`: test trong `scripts/lib/validate-*.test.ts`.
- `GuidePanel`: test hai tab. Câu main có bản dịch thì mặc định thấy nội dung VI, bấm EN thì thấy HTML gốc. Câu main chưa có bản dịch thì không có tab. Câu sub không có tab.
- `npm run check` phải qua sau mỗi lô.

## Cách làm theo lô

Soạn theo từng file (`pt1_1` … `pt6_1`), mỗi lô khoảng 20–25 câu. Mỗi lô: dịch, review, chạy `npm run check`, commit. Phần code (nạp dữ liệu, validate, tab) làm trước để mỗi lô dịch xong có thể xem ngay trên web.

## Để người làm tự quyết

Tên hàm và tên file cụ thể, style CSS của tab, cách hiển thị cảnh báo thiếu bản dịch trong validate.
