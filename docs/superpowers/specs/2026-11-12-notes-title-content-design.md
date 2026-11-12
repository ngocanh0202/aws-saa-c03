# Ghi chú dạng tiêu đề + nội dung (tô đề, đánh dấu câu trả lời AI, tự ghi chú)

Ngày: 2026-11-12 · Mở rộng: [2026-11-11-practice-highlight-notes-design.md](2026-11-11-practice-highlight-notes-design.md)

## Mục đích

Hiện ghi chú chỉ có một cách: tô chữ trong đề rồi ghi chú cho đoạn tô. Người học muốn giữ lại cả những
câu trả lời hay của AI và những ý tự nghĩ ra trong lúc làm, rồi xem lại tất cả ở một chỗ. Mọi ghi chú quy về
một dạng chung: **tiêu đề + nội dung**, gắn với một câu hỏi.

## Ba nguồn ghi chú (người học quyết định)

| Nguồn | Tiêu đề | Nội dung | Cách tạo |
|---|---|---|---|
| Tô đề (đã có) | đoạn đã tô | ghi chú của đoạn tô | như hiện tại |
| Câu trả lời AI | câu người học hỏi | câu AI trả lời | nút đánh dấu (bookmark) ở mỗi câu trả lời trong khung chat |
| Tự ghi chú | người học nhập | người học nhập | nút "Ghi chú" **bên trái nút "Nộp bài"** → form gồm tiêu đề + nội dung |

## Ở đâu được ghi chú (người học quyết định)

- Đang làm **Thi thử**: cả ba nguồn (như phần tô hiện tại).
- **Sau khi nộp bài, ở cả Thi thật và Thi thử** (trang xem lại `ResultPage`): cả ba nguồn — tô đề trên từng câu,
  đánh dấu câu trả lời AI trong khung Gemini inline, tự ghi chú.
- Đang làm **Thi thật**: không có (không đổi).
- Trang xem lại không có nút "Nộp bài": nút "Ghi chú" đặt ở mỗi câu, cạnh nút Gemini inline. *(quyết định của người viết, người học đã nghe và không phản đối)*

## Trang Ghi chú (`#/notes`, người học quyết định)

- Mỗi ghi chú chỉ hiện **tiêu đề + nội dung**, kèm link "Mở câu hỏi". Không còn hiện đề bài và lựa chọn ngay trên trang.
- "Mở câu hỏi" mở **một khung xem riêng câu hỏi ngay trên trang Ghi chú** (không rời trang).
- Mặc định **mới nhất trước**.
- **Tìm kiếm** (không dấu, như hiện tại) trên tiêu đề, nội dung và nhãn câu.
- **Sắp xếp**: mới nhất, cũ nhất, theo đề & số câu.
- **Gộp**: không gộp, theo câu hỏi, theo nguồn, theo đề, theo đề → câu hỏi (gộp hai tầng).

## Không làm

- Không ghi chú trong lúc đang làm Thi thật.
- Không sửa nội dung ghi chú ngay trên trang Ghi chú (trang chỉ để xem; người học nói "chỉ cần hiển thị title với content").
  Có nút xóa. Ghi chú tô đề vẫn sửa được trong popup tô (cả trong khung xem câu hỏi).
- Không đổi luật AI soạn ghi chú cho đoạn tô, không đổi tool `highlight_keywords`.

## Điều không được xảy ra

- Mất ghi chú cũ (đoạn tô đã lưu ở localStorage/Firebase phải hiện đủ trên trang mới).
- Lộ đáp án trong khung xem câu hỏi ở trang Ghi chú (giữ như hiện tại: lựa chọn bị khóa, không tô đúng/sai).
- Ghi chú hiện ra ở Thi thật đang làm.

## Thiết kế

### Dữ liệu

- Giữ `QuestionNotes` (một bản ghi mỗi câu, theo `bank.canonical(qid)`, đồng bộ `users/{uid}/notes/{qid}` dạng JSON),
  thêm trường tùy chọn `items?: NoteItem[]` — bản cũ không có trường này vẫn đọc được.
- `NoteItem = { id, kind: 'ai' | 'manual', title, content, createdAt, updatedAt }`.
  Giới hạn: tiêu đề ≤ 200 ký tự, nội dung ≤ 10 000 ký tự (câu trả lời AI có thể dài; quá thì cắt). Tiêu đề rỗng khi tự
  ghi chú thì không cho lưu; nội dung rỗng được.
- Đoạn tô vẫn là `Highlight` như cũ; trên trang Ghi chú nó hiện như ghi chú nguồn "Tô đề" (tiêu đề = `text`, nội dung = `note`,
  thời gian = `updatedAt`). **Chỉ đoạn tô đã có ghi chú** (`note` không rỗng) mới hiện trong danh sách (người học quyết định);
  đoạn tô chưa ghi chú vẫn thấy trong khung xem câu hỏi. Trang "chưa có ghi chú" khi không có item nào và không có đoạn tô nào có ghi chú.
- Gộp/đồng bộ giữ nguyên `mergeNotes` (bản có `updatedAt` mới hơn thắng, theo cả câu) và rules hiện có (JSON < 100 000 ký tự).
- "Đề" của một ghi chú suy ra từ canonical qid: câu main → `setLabel(floor(qid/100))`; câu sub → đề chứa câu đó trong
  `sets.json`, không có thì "Kho dự phòng". *(quyết định của người viết: ghi chú theo câu, không theo lượt)*

### Đánh dấu câu trả lời AI

- Nút bookmark (icon, có `aria-label`) ở mỗi tin trả lời của AI trong khung chat, chỉ khi lượt cho phép ghi chú (mục trên).
- Bấm: lưu `NoteItem` kind `ai`, tiêu đề = tin người học ngay trước, nội dung = tin AI (phần `text`, không có gợi ý tiếp theo).
  Đã đánh dấu (có item `ai` cùng tiêu đề và nội dung) thì icon ở trạng thái đã chọn; bấm lần nữa thì bỏ đánh dấu (xóa item).
- Câu trả lời đang chạy (chưa xong) chưa có nút.

### Tự ghi chú

- Nút "Ghi chú" (icon + chữ) bên trái nút "Nộp bài" ở Thi thử; ở trang xem lại là nút ở mỗi câu.
- Mở form dạng popup (điện thoại: bottom sheet như popup ghi chú hiện tại): ô tiêu đề, ô nội dung, Lưu, Hủy. Gắn với câu đang xem.
- Lưu xong đóng form; không mở lại để sửa (sửa không nằm trong phạm vi).

### Tô đề ở trang xem lại

- `ResultPage` bật `annotate` của `QuestionCard` cho mọi câu (cả Thi thật lẫn Thi thử đã nộp), giống `ExamPage` Thi thử.

### Trang Ghi chú

- Danh sách phẳng các ghi chú (đoạn tô + item) của mọi câu trong ngăn tài khoản hiện tại.
- Mỗi ghi chú: tiêu đề, nội dung (giữ xuống dòng; câu trả lời AI hiện bằng `Markdown` như trong chat), nhãn nguồn bằng icon,
  nhãn câu ("Main 3 · Câu 12" / "Câu 245"), thời gian, nút "Mở câu hỏi", nút xóa (xóa đoạn tô thì xóa luôn highlight).
- Khung xem câu hỏi: dialog trên trang, `QuestionCard` với lựa chọn bị khóa, không đáp án, `annotate` bật (vẫn tô/sửa ghi chú đoạn tô được).
- Thông báo AI xong (toast "Đến câu") với đích `page: 'notes'` mở khung xem câu hỏi đó và popup đoạn tô (thay cho việc cuộn tới mục cũ).
- Chọn sắp xếp/gộp nhớ ở localStorage (tiện, không đồng bộ). *(quyết định của người viết)*
- Giao diện tiếng Việt, icon, theme sáng/tối, điện thoại (một cột).

## Quyết định của người viết (sau vòng kiểm tra)

- Đồng bộ giữ cách gộp cả câu như hiện tại (bản mới hơn thắng); không gộp từng item. Rủi ro mất item khi hai máy cùng
  sửa một câu lúc offline vẫn như hiện nay với đoạn tô.
- Giới hạn dung lượng: trước khi lưu, nếu JSON của câu vượt 90 000 ký tự thì không lưu và báo "Ghi chú của câu này đã quá dài,
  hãy xóa bớt" (rules cho 100 000).
- Đánh dấu câu trả lời AI nhận diện bằng tiêu đề + nội dung (không lưu id tin nhắn); bấm lại thì bỏ đánh dấu nên không trùng.
- Tiêu đề của ghi chú AI = tin người học gần nhất phía trước câu trả lời đó (cắt 200 ký tự). Mọi câu trả lời đã xong đều đánh dấu được.
- Toast "Đến câu" đích `page: 'notes'` (chỉ AI soạn ghi chú đoạn tô dùng): mở khung xem câu `qid` rồi popup của đoạn tô
  `highlightId` tự mở như hiện tại (takeOpen).
- Trang xem lại: nút "Ghi chú" ở mọi câu, cả Thi thật lẫn Thi thử. Mọi ghi chú lưu theo canonical qid; nhãn câu lấy từ canonical qid.

## Ràng buộc

- Không sửa câu hỏi/đáp án. `npm run check` xanh. Cập nhật `CLAUDE.md` (mục `src/notes/`).
- Rules Firebase không đổi (nội dung nằm trong chuỗi JSON).

## Để lại cho người làm

- Tên file/component, chữ trên nút, bố cục chi tiết của bộ lọc.
- Thứ tự trong nhóm khi gộp (đi theo cách sắp xếp đang chọn).
