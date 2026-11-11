# Thi thử: khóa đáp án sau khi xem hướng dẫn, highlight và ghi chú

Ngày: 2026-11-11 · Trạng thái: chờ duyệt

## Vì sao làm

Thi thử là chế độ tự luyện, có thể mở hướng dẫn ngay tại câu. Có hai vấn đề:

1. Mở hướng dẫn xong vẫn đổi được đáp án, nên điểm Thi thử không phản ánh phần người học tự làm.
2. Lúc luyện, người học muốn đánh dấu từ khóa trong đề (ví dụ "LEAST operational overhead", "cost-effective") để đọc lại cho nhanh, ghi chú cho từng từ khóa, và nhờ AI soạn sẵn ghi chú rồi sửa lại. Sau đó họ muốn ôn lại mọi chỗ đã tô trên một trang riêng.

## Mục tiêu

- Ở Thi thử, khi một câu đã mở hướng dẫn thì đáp án của câu đó bị khóa.
- Ở Thi thử, người học bôi đen một đoạn trong đề để tô màu, mỗi đoạn tô có một ghi chú riêng (không bắt buộc).
- AI soạn ghi chú cho một đoạn tô, người học sửa lại rồi lưu.
- Highlight và ghi chú đi theo **câu hỏi**: gặp lại câu đó ở lượt khác hoặc ở đề khác (câu trùng) vẫn thấy.
- Có trang "Ghi chú của tôi" gom mọi câu có highlight, mỗi mục hiện cả câu hỏi.
- Đồng bộ highlight và ghi chú lên Firebase khi đã đăng nhập Google.
- Dùng tốt trên cả máy tính lẫn điện thoại, theme sáng lẫn tối.

## Không làm

- Không hiện highlight hay ghi chú ở **Thi thật** (kể cả trang kết quả Thi thật). Thi thật giữ sạch như phòng thi.
- Chỉ **một màu** tô, không có bảng màu.
- Không tô trong các lựa chọn, chỉ tô trong đề bài (`stem`) và dòng câu hỏi in đậm (`prompt`). Lý do: mỗi lựa chọn là một nút bấm, bôi đen trong đó rất dễ chọn nhầm đáp án.
- Không xuất ghi chú ra file.
- Không làm cho trang External (`#/external`) và trang xem một câu (`#/q/:id`).

## Điều cấm (làm vậy là hỏng, dù chạy được)

- AI soạn ghi chú **không bao giờ được nhắc tới đáp án đúng**, cũng không được nói lựa chọn nào đúng hay sai.
- Không làm lộ highlight hay ghi chú trong Thi thật.
- Không sửa đáp án gốc hay dữ liệu câu hỏi.

## Phần 1: khóa đáp án sau khi xem hướng dẫn

- Áp dụng cho lượt `mode === 'practice'` đang làm. Khi `attempt.guideOpened` có `qid` thì câu đó bị khóa: không chọn thêm, không bỏ chọn, không đổi đáp án.
- Khóa ở **cả hai lớp**:
  - Engine: `selectOption` (`src/engine/actions.ts`) trả về nguyên `attempt` nếu là Thi thử và `guideOpened.includes(qid)`. Hàm thuần, có test.
  - UI: `ExamPage` không truyền `onSelect` cho `QuestionCard` khi câu đã khóa (nút lựa chọn bị `disabled`).
- Chỉ còn **một** cách mở hướng dẫn ở Thi thử: người học tự bấm nút "Xem hướng dẫn". AI không còn tự mở được (xem Phần 1b).
- Đáp án đã chọn trước khi mở vẫn giữ nguyên và được chấm như thường. Chưa chọn gì mà mở hướng dẫn thì câu đó bỏ trống, tức là sai (luật chấm hiện có, không đổi).
- Câu bị khóa hiện icon 🔒 (SVG) ngay trên danh sách lựa chọn. Có `title` và `aria-label` "Đã xem hướng dẫn, không đổi được đáp án câu này nữa".
- Lượt Thi thử cũ đã có `guideOpened` thì cũng tự khóa theo luật mới. Không cần chuyển đổi dữ liệu.
- Thi thật không đổi gì.

## Phần 1b: AI không bao giờ nói đáp án khi người học chưa bấm "Xem hướng dẫn"

Yêu cầu của người dùng: AI (Gemini và AI thử nghiệm, ở khung chat lẫn AI soạn ghi chú) **không bao giờ** nói đáp án đúng của một câu, trừ khi người học đã thấy đáp án câu đó. "Đã thấy" nghĩa là: câu đó nằm trong `guideOpened` của lượt Thi thử, **hoặc** thuộc một lượt đã nộp (trang kết quả vốn hiện đáp án). Đổi so với hiện tại:

- **Không dựa vào lời dặn trong prompt.** Khi câu chưa được thấy (`revealed === false`), `buildSystemPrompt` (`src/ai/prompt.ts`) **không đưa** dòng "Đáp án đúng", giải thích `data/vi`, lý do từng lựa chọn, `keyHint` và `note` vào prompt. Mô hình không có đáp án trong ngữ cảnh. Câu dặn đổi thành: không khẳng định lựa chọn nào đúng/sai; người học xin đáp án thì bảo họ bấm nút "Xem hướng dẫn".
- **Bỏ tool `open_guide`** ở khung chat (`src/ai/guide-tool.ts`, chỗ dùng trong `GeminiChat.tsx`, prop `onOpenGuide` ở `ExamPage`). AI không còn tự mở hướng dẫn.
- Khi người học bấm "Xem hướng dẫn" trong lúc khung chat đang mở, `revealed` đổi thành `true` và mở phiên chat mới có đáp án (cơ chế "`revealed` đổi thì mở phiên mới" đã có sẵn).
- **Tool `find_answered_questions`** (`src/ai/search.ts`):
  - Phạm vi tìm giữ như cũ: mọi lượt **cùng đề** (`setId`), gồm lượt đang làm và các lượt khác; bỏ lượt Thi thật đang làm; chỉ lấy câu đã chọn đáp án.
  - Quyết định có trả đáp án hay không (đáp án đúng, cờ `correct` của từng lựa chọn, kết quả đúng/sai từng lần làm):
    - **Câu nằm trong lượt đang làm:** chỉ xét lượt này. Đã bấm "Xem hướng dẫn" ở lượt này thì trả, chưa bấm thì ẩn, **kể cả khi** câu đó từng xuất hiện ở lượt khác đã nộp. Lý do: nếu không, người học hỏi về chính câu đang làm, AI tìm thấy nó ở lượt cũ và nói ra đáp án.
    - **Câu chỉ nằm ở lượt khác:** trả nếu người học đã thấy đáp án ở bất kỳ lượt nào (lượt đã nộp có câu đó, hoặc lượt Thi thử có câu đó trong `guideOpened`); không thì ẩn.
    - Ẩn thì vẫn trả đề, các lựa chọn, người học đã chọn gì, kèm cờ `answerHidden: true`.
  - **Bỏ việc gắn `markGuideOpened`** cho lượt Thi thử khác. Như vậy hỏi Gemini ở lượt này không còn làm khóa câu ở lượt khác.
  - Prompt dặn: câu có `answerHidden` thì không đoán và không nói đáp án.
- Câu đã thấy (hướng dẫn đã mở, trang kết quả) giữ nguyên hành vi hiện tại: AI trả lời thẳng, đối chiếu với giải thích.
- Cập nhật `CLAUDE.md` (mục `src/ai/`) và spec cũ liên quan: `open_guide` đã bỏ, prompt không chứa đáp án khi chưa xem.
- Test: prompt khi `revealed=false` không chứa đáp án/giải thích; tool search ẩn đáp án câu chưa thấy và không sửa lượt thi nào.

## Phần 2: highlight và ghi chú

### Thao tác

**Máy tính (màn hình ≥ 640px)**
1. Bôi đen một đoạn trong đề bài hoặc dòng câu hỏi thì hiện một thanh nổi nhỏ ngay dưới đoạn chọn, gồm 2 nút icon: **Tô** và **Tô + ghi chú**.
2. Bấm vào đoạn đã tô thì mở **popup ghi chú** nổi ngay dưới dòng có đoạn đó, có mũi tên chỉ lên. Popup đè lên nội dung, không đẩy đề bài xuống. Trong popup có ô nhập và các nút icon: **AI soạn**, **Xóa đoạn tô** (xóa luôn ghi chú), **Lưu**.
3. Bấm ra ngoài hoặc nhấn Esc thì đóng popup. Nếu đang gõ dở thì tự lưu.

**Điện thoại (< 640px)**
1. Menu Copy của hệ điều hành hiện đè lên đoạn chọn, nên 2 nút **Tô** / **Tô + ghi chú** nằm ở **thanh cố định dưới đáy màn hình** khi đang có đoạn chọn hợp lệ.
2. Chạm vào đoạn đã tô thì popup **trượt lên từ đáy** (bottom sheet), phía sau có lớp nền mờ. Đầu popup trích lại đoạn đã tô, dưới đó là ô nhập và các nút AI soạn, Xóa, Đóng (✕), Lưu. Chạm nền mờ hoặc ✕ thì đóng (cũng tự lưu).
3. Nút cao tối thiểu 44px. Chữ trong ô nhập 16px để iPhone không tự phóng to trang.

**Chung**
- **Chỉ dùng icon** (SVG nội tuyến, `stroke="currentColor"`), không có chữ trên nút. Mỗi nút có `aria-label` và tooltip (`title`) tiếng Việt.
- Đoạn đã có ghi chú thì có thêm gạch chân đậm để phân biệt với đoạn chỉ tô.
- Câu đã khóa (Phần 1) vẫn tô và ghi chú được bình thường.
- Đoạn chọn hợp lệ là đoạn nằm trọn trong **một** vùng (đề bài hoặc dòng câu hỏi), không rỗng sau khi bỏ khoảng trắng. Chọn chồng lên một đoạn đã tô thì gộp thành một đoạn, ghi chú nối lại (cách nhau một dòng trống).
- Ghi chú tối đa 2000 ký tự.
- Giao diện tham khảo: bản phác ở `.superpowers/brainstorm/211-1794363912/content/highlight-flow-v2.html` và `highlight-mobile-v3.html` (không commit, `.superpowers/` đã nằm trong `.gitignore`).

### Màu (theme sáng/tối)

Thêm biến vào `src/styles.css`, theo đúng cách các biến hiện có được định nghĩa cho 3 nhánh (`:root`, `prefers-color-scheme: dark` có guard `:root:not([data-theme='light'])`, và `:root[data-theme='dark']`):

| Biến | Sáng | Tối |
|---|---|---|
| `--hl-bg` | `#ffe58a` | `#5a4612` |
| `--hl-text` | `#1f2328` | `#fff3cf` |
| `--hl-line` (gạch chân khi có ghi chú) | `#d97706` | `#ffcf66` |

Popup, thanh nút, ô nhập dùng các biến sẵn có (`--surface`, `--border`, `--text`, `--bg`, `--primary`, `--primary-text`).

### Phạm vi hiện

- **Có:** `ExamPage` khi `attempt.mode === 'practice'` (cả lúc đang làm), và trang "Ghi chú của tôi".
- **Không:** Thi thật (đang làm hay kết quả), trang kết quả Thi thử (`ResultPage`), `#/q/:id`, External.

### Câu trùng

Highlight lưu theo **id gốc** của câu (canonical id):
- Đề main: cặp `twins` trong `data/main.json` (`[orig, twin]`), câu twin dùng id `orig`.
- Ngân hàng sub: cặp `duplicates` trong `data/sets.json`, dùng id nhỏ hơn của cặp.

Viết một hàm thuần `canonicalQid(qid)`, dựng từ bank lúc nạp. Như vậy gặp câu trùng ở đề khác vẫn thấy cùng một bộ highlight.

### Neo đoạn tô vào văn bản

Câu main có `html: true` (đề có thẻ HTML, có thể có ảnh), câu sub là văn bản thuần, nên vị trí đoạn tô được tính trên **văn bản đã render** của từng vùng, không phải trên chuỗi gốc:

```ts
interface Highlight {
  id: string;            // ngẫu nhiên, duy nhất trong câu
  part: 'stem' | 'prompt';
  start: number;         // vị trí ký tự trong textContent của vùng đó
  end: number;
  text: string;          // đoạn chữ lúc tô, để kiểm tra và để hiện ở trang ghi chú
  note: string;          // '' nếu chưa ghi chú
  updatedAt: number;
}
interface QuestionNotes {
  qid: number;           // canonical id
  highlights: Highlight[];
  updatedAt: number;
}
```

- Khi render: nếu `textContent.slice(start, end) !== text` (dữ liệu câu đã thay đổi) thì tìm lại `text` trong vùng đó và dùng vị trí xuất hiện gần `start` nhất. Không tìm thấy thì không tô trong đề, nhưng đoạn đó và ghi chú vẫn hiện ở trang "Ghi chú của tôi" kèm dòng "Không còn tìm thấy đoạn này trong đề".
- Tô bằng cách bọc các đoạn chữ trong `<mark>` sau khi render (đi theo các text node trong vùng). Không được làm hỏng HTML của đề main hay ảnh trong đó.
- Logic tính vị trí, gộp đoạn chồng nhau, tìm lại đoạn lệch là hàm thuần có test. Phần thao tác DOM tách riêng.

### Lưu trữ và đồng bộ

- Store mới `NotesStore` (giống cách `store` của lượt thi được đưa vào `AppDeps`/`useApp()`): lưu `localStorage` key `saa-c03:notes:v1`, có `subscribe` để UI cập nhật.
- Đã đăng nhập Google thì đồng bộ lên Realtime Database ở `users/{uid}/notes/{canonicalQid}` dạng `{ json, updatedAt }`, giống `attempts`.
- Gộp theo **từng câu**: bản có `updatedAt` mới hơn thắng, bằng nhau thì bản cloud thắng (giống `pickWinner`). Viết thành hàm thuần trong `src/sync/` có test.
- Xóa hết đoạn tô của một câu thì vẫn ghi bản ghi rỗng (`highlights: []`) để lệnh xóa đồng bộ được sang máy khác.
- **Tách theo người dùng trên cùng máy:** ghi chú lưu theo "ngăn", mỗi tài khoản một ngăn (`saa-c03:notes:v1:<uid>`) và một ngăn khách (`saa-c03:notes:v1:guest`). UI chỉ đọc ngăn của người đang dùng: đăng nhập thì ngăn `uid`, chưa đăng nhập thì ngăn khách. Hai tài khoản dùng chung máy không thấy ghi chú của nhau.
- Chế độ khách: chỉ lưu ngăn khách. Khi đăng nhập, ngăn khách được gộp vào ngăn tài khoản theo đúng quy tắc trên (không hỏi lại), đẩy lên cloud, rồi xóa ngăn khách. Đăng xuất thì về ngăn khách (rỗng nếu đã gộp), ngăn tài khoản vẫn nằm trên máy cho lần đăng nhập sau.
- **Controller đồng bộ riêng** cho ghi chú (`src/sync/notes-sync.ts` hoặc tương tự), nghe cùng trạng thái đăng nhập với `controller.ts` nhưng không đi qua máy trạng thái xung đột của lượt thi. Hộp hỏi xung đột lượt thi không chặn đồng bộ ghi chú. Không sửa logic đồng bộ lượt thi.
- `database.rules.json`: thêm nhánh `notes/$qid` dưới `users/$uid`, kiểm tra `json` là chuỗi dài < 100000 và `updatedAt` là số (giống `attempts`). Cập nhật test rules trong `rules-tests/`.
- Tài liệu: cập nhật `CLAUDE.md` (mục Kiến trúc) và `docs/firebase-setup.md` nếu cần deploy lại rules.

### AI soạn ghi chú

- Dùng đúng nguồn AI đang bật trong menu tài khoản (`ai-mode.ts`: Gemini hoặc AI thử nghiệm) qua `AiClient.startChat`, gửi một tin, không lưu lịch sử chat, không dùng tool. Nút AI soạn hiện theo **đúng điều kiện của nút chat AI hiện có** (`GeminiButton` chỉ hiện khi đã đăng nhập và có `ai`); AI thử nghiệm dùng tham số trong `users/{uid}/aiSettings` như khung chat. Không đủ điều kiện thì **ẩn** nút; người học vẫn tự ghi được.
- Gửi cho AI: đề bài, dòng câu hỏi, các lựa chọn, và đoạn đã tô. **Không gửi** đáp án, giải thích gốc, `data/vi`, hay `meta.note`.
- Prompt (tiếng Việt) yêu cầu: viết 1–3 câu tiếng Việt giải thích đoạn tô nghĩa là gì và nó gợi ý yêu cầu gì của đề (ví dụ "least operational overhead" thì ưu tiên dịch vụ managed). Cấm nói lựa chọn nào đúng/sai, cấm gọi tên dịch vụ trong các lựa chọn như là đáp án. Nếu đoạn tô không có nghĩa (ví dụ "the a", nửa chữ) thì chỉ trả lời đúng câu: "Không rõ bạn muốn ghi chú gì ở đoạn này."
- **Chạy nền, tự lưu.** Đóng popup, chuyển câu hay sang trang khác thì AI vẫn chạy tiếp. Xong thì kết quả được **lưu thẳng** vào ghi chú của đoạn đó (`setNote` qua `NotesStore`, nên cũng tự đồng bộ), nối thêm xuống dưới phần đã có (cách một dòng trống), không ghi đè. Người học mở lại để sửa.
- Trong lúc chạy, đoạn tô đang được soạn nhấp nháy nhẹ (tắt khi `prefers-reduced-motion`).
- Bỏ kết quả nếu: đoạn tô đã bị xóa, hoặc người dùng đã đăng xuất/đổi tài khoản (ngăn hiện tại khác ngăn lúc bấm). Đóng tab thì mất (chấp nhận).
- Lỗi: đoạn tô thôi nhấp nháy; mở popup đoạn đó thấy một dòng báo lỗi kèm nút thử lại (icon). Lỗi chỉ nhớ trong bộ nhớ, không lưu.
- Áp dụng luật "mỗi lúc một yêu cầu AI" và thông báo khi xong ở mục dưới.

### Mỗi lúc chỉ một yêu cầu AI, và thông báo khi xong

Yêu cầu của người dùng, áp dụng cho **cả khung chat AI lẫn AI soạn ghi chú** (Gemini và AI thử nghiệm):

- Trong một tab trình duyệt, tại một thời điểm chỉ có **một** yêu cầu AI đang chạy (giữ trong bộ nhớ, không đồng bộ giữa tab/máy).
- Trong lúc có yêu cầu đang chạy, ở mọi nơi:
  - Ô nhập và nút Gửi của **mọi khung chat AI** bị khóa (khung đang chạy thì vốn đã chờ).
  - **Mọi ô gõ ghi chú** và nút AI soạn bị khóa, kể cả đoạn đang được soạn (để chữ người học gõ không đè lên chữ AI). Tô màu đoạn mới và xóa đoạn tô vẫn làm được.
  - Chỗ bị khóa hiện một dòng nhỏ: "AI đang trả lời ở Câu 12" (chat) hoặc "AI đang soạn ghi chú ở Câu 12" (ghi chú). "Câu 12" là số thứ tự câu trong lượt thi; yêu cầu bắt đầu từ trang "Ghi chú của tôi" thì dùng nhãn mục ở trang đó (ví dụ "Main 1 · Câu 5").
- Khi yêu cầu xong (thành công hay lỗi), hiện **thông báo ở góc trên bên phải**: "AI đã trả lời ở Câu 12" / "AI đã soạn ghi chú ở Câu 12" (lỗi thì "AI gặp lỗi ở Câu 12"), kèm nút **Đến câu 12** và nút ✕.
  - Bấm "Đến câu 12": chuyển tới đúng lượt thi và đúng câu (`/exam/:id` rồi nhảy tới vị trí câu), tự mở **khung chat AI** của câu đó nếu là chat, hoặc **popup ghi chú** của đúng đoạn tô nếu là ghi chú. Bắt đầu từ trang ghi chú thì về `#/notes`, cuộn tới mục đó và mở popup.
  - Không hiện thông báo nếu người học đang mở đúng chỗ đó (khung chat của câu đó đang mở, hoặc popup của đúng đoạn tô đang mở) lúc xong.
  - Tự ẩn sau 10 giây; chỉ giữ một thông báo (thông báo mới thay thông báo cũ). Điện thoại: nằm ở đầu màn hình, rộng hết chiều ngang trừ lề 16px. Có `role="status"`.
  - Lượt thi đã nộp trong lúc chờ: "Đến câu" mở trang kết quả của lượt đó (`/result/:id`) thay vì `/exam/:id`.
- Lỗi 429/503 dùng lại `retry.ts` và `cooldown.ts` như khung chat. Lỗi khác thì hiện một dòng báo lỗi nhỏ trong popup.
- Dựng prompt là hàm thuần có test (kiểm tra prompt không chứa đáp án/giải thích).

## Phần 3: trang "Ghi chú của tôi"

- Route `#/notes`, tiêu đề "Ghi chú của tôi". Có link trong menu điều hướng chính, cạnh "Lịch sử".
- Mỗi mục là một câu có ít nhất một đoạn tô, sắp theo `updatedAt` mới nhất trước. Mỗi mục hiện:
  - Nhãn đề và số câu gốc (dùng `setLabel()` cho đề main; câu sub thì "Câu {id}").
  - **Đề bài và dòng câu hỏi** có tô sẵn, **các lựa chọn** (không tô màu đúng/sai, không lộ đáp án), không xáo.
  - Danh sách đoạn tô kèm ghi chú bên dưới.
- Trên trang này vẫn tô thêm, sửa ghi chú, xóa đoạn tô, AI soạn được, với cùng cách thao tác như lúc thi.
- Ô tìm kiếm lọc theo chữ trong đoạn tô hoặc ghi chú (không phân biệt dấu, giống ô tìm trong danh sách chat).
- Chưa có gì thì hiện một dòng hướng dẫn: vào Thi thử, bôi đen chữ trong đề để tô.

## Kiểm thử

- Engine: `selectOption` bị khóa ở Thi thử khi đã mở hướng dẫn, không bị khóa ở Thi thật hay câu chưa mở.
- AI: xem cuối Phần 1b.
- Hàm thuần: tính vị trí, gộp đoạn chồng, tìm lại đoạn lệch, `canonicalQid`, gộp đồng bộ, dựng prompt AI.
- UI (`renderApp()`): khóa đáp án sau khi bấm hướng dẫn; tô và ghi chú ở Thi thử; không thấy gì ở Thi thật; trang `#/notes` liệt kê, tìm kiếm, sửa; nút AI soạn bị ẩn khi không có AI.
- Rules: `npm run test:rules` cho nhánh `notes`.
- Chạy `npm run check` trước khi commit.

## Các quyết định Claude tự đưa ra (người dùng chưa xác nhận)

- "Đã thấy đáp án" gồm cả câu thuộc lượt đã nộp (vì trang kết quả hiện đáp án).
- Bỏ hẳn tool `open_guide`; bỏ việc tool tìm câu tự gắn "đã xem hướng dẫn" sang lượt khác.
- Chỉ tô trong đề bài và dòng câu hỏi, không tô trong lựa chọn.
- Không hiện highlight ở trang kết quả Thi thử.
- Đóng popup thì tự lưu.
- Lưu localStorage theo ngăn từng tài khoản + ngăn khách; gộp ngăn khách vào tài khoản khi đăng nhập không hỏi lại.
- Đồng bộ ghi chú có controller riêng, không phụ thuộc hộp hỏi xung đột lượt thi.
- AI soạn cần đăng nhập, giống nút chat AI hiện có.
- Câu trùng dùng chung highlight qua canonical id.
- Giới hạn ghi chú 2000 ký tự; AI nối thêm chứ không ghi đè.
- Giới hạn "một yêu cầu AI" tính theo tab, không đồng bộ giữa tab/máy; không hiện thông báo khi người học đang nhìn đúng chỗ; thông báo tự ẩn sau 10 giây; tô màu và xóa đoạn tô vẫn làm được khi AI đang chạy.
- Trang ghi chú không lộ đáp án, có ô tìm kiếm.
