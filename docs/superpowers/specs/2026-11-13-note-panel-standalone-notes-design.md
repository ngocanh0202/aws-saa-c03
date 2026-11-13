# Khung ghi chú theo câu, ghi chú tự do và nút đổi chế độ AI trong chat

Ngày: 2026-11-13. Tiếp nối spec `2026-11-12-notes-title-content-design.md` (ghi chú tiêu đề + nội dung).

## Vì sao

- Nút "Ghi chú" hiện nằm ở thanh trên cạnh "Nộp bài", xa chỗ người học đang đọc và lẫn với nút nộp bài. Người học muốn nó ở cạnh nút Hỏi AI, nơi họ đang làm việc với câu.
- Bấm "Ghi chú" hiện chỉ mở form thêm mới; muốn xem, sửa, xóa ghi chú cũ của câu phải sang trang Ghi chú.
- Viết ghi chú tay không có AI hỗ trợ như popup tô đề.
- Trang Ghi chú không tạo được ghi chú nào không gắn với câu hỏi (ghi chú ôn tập chung).
- Đổi Gemini ↔ AI local phải vào menu tài khoản, trong khi việc đổi thường xảy ra ngay lúc đang chat.

## Mục tiêu

1. **Nút Ghi chú nổi (Thi thử đang làm).**
   - Bỏ `NoteButton` khỏi `exam__bar-actions` cạnh "Nộp bài".
   - Thêm nút Ghi chú nổi cố định (`position: fixed`), cùng kiểu với nút Hỏi Gemini/AI (`.btn-gemini`), đặt sát bên trái nút đó ở góc dưới bên phải.
   - Khi không có nút AI (chưa đăng nhập, không có AI), nút Ghi chú đứng vào chỗ góc phải.
   - Màn hình hẹp (cùng điểm ngắt mà `.btn-gemini` đang dùng để ngang hàng với `.exam-fab`): nút Ghi chú là nút tròn chỉ có icon, nằm giữa nút danh sách câu (trái) và nút AI (phải), không chồng lên nhau ở chiều rộng 320px. Có `aria-label="Ghi chú"`.
   - Thi thật đang làm: không có nút (như hiện nay).
   - Trang xem lại (`ResultPage`): giữ vị trí hiện tại (nút nằm cạnh nút Gemini inline ở mỗi câu), nhưng mở khung mới ở mục 2.

2. **Khung Ghi chú của một câu** (thay `NoteFormDialog` khi mở từ nút Ghi chú).
   - Phần trên: danh sách mọi ghi chú hiện có của câu (theo canonical id). Gồm đoạn tô có note, item `ai` và item `manual`; đoạn tô không có note thì không liệt kê, giống trang Ghi chú. Mới nhất trước.
   - Mỗi mục hiện tiêu đề + nội dung (item `ai` render Markdown như trang Ghi chú), nhãn nguồn (`SOURCE_LABEL`), nút Sửa và nút Xóa.
     - Sửa tại chỗ. Đoạn tô chỉ sửa nội dung (tiêu đề là chữ trong đề).
     - Xóa có bước xác nhận. Xóa đoạn tô = xóa cả đoạn tô (như trang Ghi chú).
   - Phần dưới: form thêm ghi chú mới (Tiêu đề + Nội dung, Lưu/Hủy). Tiêu đề bắt buộc như hiện nay.
   - Danh sách trống thì hiện một dòng "Chưa có ghi chú nào cho câu này."
   - Giới hạn dung lượng (`fitsLimit`, `TOO_LONG_MESSAGE`) áp dụng như hiện nay cho cả thêm và sửa.
   - Tái dùng logic hiển thị/sửa/xóa mục của `NotesPage` (`Entry`, `EntryEditor`), không viết lại lần hai.

3. **Nút AI trong form ghi chú.**
   - Form thêm mới và form sửa (của item `manual`/`ai`, và nội dung đoạn tô) có nút AI giống `NoteAiButton` của popup tô đề: icon, trạng thái đang soạn, dòng lỗi + thử lại.
   - Chỉ hiện khi có AI đang dùng (`useActiveAi()` khác null).
   - Khóa khi cả Tiêu đề và Nội dung đều trống sau khi `trim` (không gửi gì cho AI). Đoạn tô: tiêu đề là chữ tô nên luôn có dữ liệu.
   - AI nhận:
     - Ghi chú gắn câu: đề bài, dòng câu hỏi, các lựa chọn không nhãn (như `buildNotePrompt`), cùng tiêu đề + nội dung đang gõ. **Không bao giờ** gửi đáp án, giải thích, `data/vi`, `meta.note`.
     - Ghi chú tự do (mục 4): chỉ tiêu đề + nội dung đang gõ.
   - Hành vi:
     - Nội dung trống: AI viết nội dung cho tiêu đề.
     - Nội dung có câu hỏi: AI trả lời.
     - Nội dung đã có: AI bổ sung.
   - Kết quả được **nối vào ô Nội dung** của form (cách một dòng trống), không tự lưu. Người học vẫn bấm Lưu.
   - Đi qua `aiGate` (mỗi tab một yêu cầu AI) và `cooldown`/`retry` như `draftNote`.
   - Form đóng khi AI đang chạy thì bỏ kết quả. Vì form đang mở là chỗ người học đang nhìn nên không cần `AiDoneToast` cho loại việc này.
   - Quy tắc nội dung AI giữ như `buildNotePrompt`:
     - Tiếng Việt, giữ thuật ngữ AWS tiếng Anh.
     - Không nói lựa chọn nào đúng/sai; hỏi đáp án thì nhắc bấm "Xem hướng dẫn".
     - Không chào hỏi, không LaTeX.

4. **Ghi chú tự do trên trang Ghi chú.**
   - Thanh công cụ trang Ghi chú có nút "Ghi chú mới", mở form Tiêu đề + Nội dung (có nút AI chỉ dựa trên chữ đã gõ).
   - Ghi chú tự do không gắn câu hỏi:
     - Không có link "Mở câu hỏi".
     - Nhãn câu/đề hiển thị là "Ghi chú chung".
     - Nguồn là "Tự ghi chú".
   - Sửa, xóa, tìm kiếm, sắp xếp như mọi ghi chú khác.
     - Gộp theo Đề hoặc Câu hỏi: tất cả ghi chú tự do vào một nhóm "Ghi chú chung".
     - Sắp xếp "theo đề": nhóm này đứng cuối.
   - Lưu trữ: mỗi ghi chú tự do là **một bản ghi `QuestionNotes` riêng**.
     - Khóa là một số nguyên âm duy nhất (`qid < 0`), `highlights: []`, `items` đúng một item `kind: 'manual'`.
     - Như vậy store, sync (`users/{uid}/notes/{qid}`) và rules hiện có dùng lại nguyên vẹn: rules nhận khóa tùy ý.
     - Hai máy sửa hai ghi chú tự do khác nhau không đè nhau.
     - Xóa item cuối của bản ghi tự do thì bản ghi coi như rỗng, theo cùng cơ chế với câu hỏi hết ghi chú.
   - Mọi chỗ đang giả định `qid` là câu thật (`noteLabel`, `noteSetId`, mở câu hỏi, `bank.canonical`…) phải xử lý `qid < 0` mà không lỗi.

5. **Nút đổi chế độ AI trong khung chat.**
   - Đầu khung chat (`gemini__tools`) có nút icon (robot khi đang Gemini → chuyển sang AI local; icon Gemini khi đang local → chuyển về Gemini).
     - `aria-label`/`title` nói rõ sẽ chuyển sang chế độ nào.
     - Chỉ hiện khi `aiMode` có (build có `VITE_LOCAL_AI`), giống `AiModeToggle` trong menu tài khoản.
   - Khóa khi khung đang có câu trả lời chạy (`busy`).
   - Bấm thì đổi `aiMode` (cùng store với menu tài khoản, hai nơi luôn khớp).
     - Khung chat **mở lại ngay** ở chế độ mới cho đúng câu đó, với lịch sử riêng của chế độ ấy (`chats` vs `localChats`).
     - Hiện nay `GeminiButton` đặt `key` theo uid + brand nên khung đóng hẳn khi đổi chế độ. Giữ việc đóng khi đổi tài khoản/đăng xuất, chỉ thêm việc tự mở lại khi đổi chế độ từ chính nút này.
   - Áp dụng ở cả khung chat Thi thử và khung inline ở trang xem lại.

## Không làm

- Không đổi cách popup tô đề và `draftNote` hiện có hoạt động.
- Không đổi định dạng `QuestionNotes`/`NoteItem` và không đổi `database.rules.json`.
- Không đổi cơ chế đồng bộ ghi đè cả bản ghi (vấn đề đã biết, việc riêng).
- Không thêm ghi chú tự do vào màn hình làm bài; ghi chú tự do chỉ tạo ở trang Ghi chú.
- Không đổi menu tài khoản; công tắc AI thử nghiệm ở đó vẫn giữ.

## Ràng buộc

- Giao diện tiếng Việt (Thi thử, trang xem lại, trang Ghi chú). Thi thật đang làm không có ghi chú.
- Điện thoại (`MOBILE_QUERY` trong `Highlighter.tsx`, dưới 640px):
  - Khung Ghi chú (mục 2) và form ghi chú tự do (mục 4) là bottom sheet có thanh ngang kéo đổi chiều cao, dùng lại `usePopupResize` như popup tô đề.
  - Máy tính: popup giữa màn hình như `NoteFormDialog` hiện nay.
- Esc đóng khung (trừ khi đang ở bước xác nhận xóa hay đang sửa: Esc hủy bước đó trước).
- Dữ liệu gửi AI không chứa đáp án hay giải thích, kể cả khi người học đã mở hướng dẫn hay bài đã nộp.
- Test theo cách của repo: Vitest + Testing Library, `renderApp`/`makeDeps`, `fake-ai`. `npm run check` phải qua.
- Cập nhật mục `src/notes/` trong `CLAUDE.md`.

## Quyết định của tôi (người dùng chưa chọn, có thể đổi)

- Trên điện thoại, nút Ghi chú nổi chỉ có icon, nằm giữa hai nút nổi kia.
- Trong khung Ghi chú, danh sách ghi chú cũ ở trên, form thêm mới ở dưới.
- Kết quả AI nối vào ô Nội dung chứ không tự lưu; đóng form thì bỏ kết quả và không có toast.
- AI của ghi chú gắn câu nhận đề bài (không đáp án); AI của ghi chú tự do chỉ nhận chữ đã gõ.
- Ghi chú tự do: mỗi ghi chú một bản ghi với khóa âm. Nhóm "Ghi chú chung" đứng cuối khi sắp theo đề.
- Đổi chế độ từ khung chat thì khung tự mở lại ở chế độ mới.

## Đã kiểm tra / đã quyết sau khi người làm đọc thử

- **Khóa âm an toàn.** `RemoteNotes.listen` (`src/sync/firebase.ts`) lấy `qid` từ JSON bên trong, không từ tên nhánh; `store.ts` cũng lấy `v.qid` từ JSON. `-123` là khóa RTDB hợp lệ; rules `notes/$qid` chỉ kiểm tra `json`/`updatedAt`, không kiểm tra tên khóa. Plan thêm một test sync/store cho bản ghi `qid` âm (round-trip).
- **Nhận diện ghi chú tự do:** một hàm dùng chung (vd `isFreeNote(qid)` = `qid < 0`) trong `src/notes/`. `noteLabel`, `noteSetId`, `groupEntries`, `sortEntries`, `matchesEntry` và nút "Mở câu hỏi" đều dùng hàm này. Gộp theo Đề/Câu hỏi có một nhóm "Ghi chú chung"; sắp theo đề thì nhóm này đứng cuối.
- **Bố cục nút nổi ở Thi thử:**
  - Một khối cố định ở góc dưới bên phải (component riêng trong `ExamPage`, không nhét vào `GeminiButton`) chứa nút Ghi chú rồi tới `GeminiButton`, xếp hàng ngang.
  - Trong khối này `.btn-gemini` không tự `position: fixed` nữa, khối mới là phần cố định. Nhờ vậy khi `GeminiButton` không hiện, nút Ghi chú tự đứng góc phải.
  - Trang xem lại (inline) không đổi.
- **Nút danh sách câu kéo được (`DraggableFab`):** người học kéo nó đè lên nút khác là chấp nhận được; chỉ cần vị trí mặc định không chồng nhau ở 320px.
- **Mở lại chat khi đổi chế độ:** tổng quát hóa cơ chế `openAfterSwitch` đang có trong `GeminiChat.tsx` (hiện dùng khi Gemini hết lượt rồi chuyển sang AI local) cho cả hai chiều. Khóa theo `attemptId` + id câu nên ở trang xem lại chỉ khung của câu vừa bấm mở lại.
- **Chế độ AI của nút AI trong form:** theo `useActiveAi()` như `NoteAiButton`: Gemini hoặc AI local, kèm `localSettings` khi ở chế độ local.
- **Đóng form khi AI đang chạy:** để yêu cầu chạy hết (gate vẫn giữ tới khi xong, như `draftNote`), chỉ bỏ kết quả. Không bắt buộc hủy giữa chừng.
- **Số khung mở cùng lúc:** khung Ghi chú là popup modal nên mỗi lúc chỉ một khung (cả trang xem lại).

## Để người làm tự quyết

- Tên component/file, cách tách `Entry`/`EntryEditor` ra dùng chung.
- Cách sinh khóa âm duy nhất (ví dụ dựa trên thời gian + số ngẫu nhiên, trong giới hạn số nguyên an toàn).
- Icon cụ thể cho nút đổi chế độ và nút Ghi chú tròn.
- Cách giữ trạng thái "đang mở" qua lần đổi `key` khi đổi chế độ.
