# Gemini: tìm lại câu đã làm và mở lại cuộc trò chuyện cũ

Bổ sung cho [2026-11-02-gemini-chat-design.md](2026-11-02-gemini-chat-design.md). Mọi quy tắc ở spec đó vẫn giữ nguyên (chỉ có ở Thi thử, phải đăng nhập Google, Gemini biết đáp án đúng, câu hỏi Gemini tính như đã mở hướng dẫn, lưu lịch sử chat lên Firebase), trừ chỗ spec này nói khác.

## Mục đích

Khi làm một câu, người học hay nhớ ra "mình từng làm một câu na ná thế này rồi", ví dụ đang làm câu S3 Transfer Acceleration thì nhớ tới một câu multipart upload trước đó, nhưng không nhớ nó ở đâu. Họ muốn hỏi Gemini để tìm lại câu đó, xem lúc ấy mình chọn gì, đúng hay sai, và được phân tích tình huống, nhất là chỗ khác nhau giữa hai câu. Họ cũng muốn đọc lại hoặc hỏi tiếp những cuộc trò chuyện cũ với Gemini, kể cả khi đang ở đề khác.

Tiêu chí thành công: hỏi "tìm lại câu multipart upload tôi đã làm" thì Gemini tìm đúng câu, nói đúng người học đã chọn gì và đúng/sai ra sao, rồi phân tích. Không có thì nói thẳng là chưa làm.

## Mục tiêu / không làm / không được phép

- Mục tiêu:
  1. **Tool tìm câu đã làm** cho Gemini (function calling), dùng được trong mọi phiên chat ở Thi thử.
  2. **Mở lại cuộc trò chuyện cũ** ngay trong khung chat của mỗi câu (bố cục "A" người dùng đã chọn, xem bên dưới).
- Không làm:
  - Không có AI ở trang Lịch sử/Thống kê (người dùng đã bỏ ý "hỏi AI nên ôn gì").
  - Tool không tìm ngoài đề đang làm: không tìm sang đề khác, không tìm trong toàn bộ ngân hàng câu hỏi, không tìm câu chưa trả lời.
  - Không có backend riêng; tool chạy hoàn toàn ở trình duyệt trên dữ liệu đã có.
- Không được phép:
  - Gemini bịa ra một câu "đã làm" khi tool không trả về gì. Không tìm thấy thì trả lời đúng ý: "Bạn chưa làm câu nào như vậy trong đề này."
  - Làm lộ đáp án của một lượt **Thi thật đang làm dở** (xem phạm vi bên dưới).
  - Dùng chữ cái A/B/C để chỉ lựa chọn của câu tìm được (thứ tự lựa chọn mỗi lượt mỗi khác; quy tắc chung của dự án).

## Quyết định của người dùng

- Mỗi câu ở mỗi lượt thi vẫn là **một phiên chat riêng** như hiện nay (`users/{uid}/aiChats/{attemptId}/{qid}`).
- Phạm vi tool: **cùng đề** (`setId`) với lượt đang làm, gồm **lượt đang làm và mọi lượt cũ của đề đó**, chỉ những câu đã trả lời.
- Không tìm thấy thì chỉ trả lời "Bạn chưa làm câu nào như vậy trong đề này", không tìm rộng hơn.
- Kết quả gồm: đề bài, các lựa chọn, người học đã chọn gì, đúng hay sai, đáp án đúng; sau đó Gemini phân tích tình huống.
- Câu tool tìm thấy thuộc lượt Thi thử chưa nộp thì **gắn nhãn "đã xem hướng dẫn"**; cách chấm Thi thử giữ bình thường.
- Cuộc trò chuyện cũ mở lại được **từ trong khung chat của mỗi câu**, theo bố cục A: nút 🕘 trên thanh tiêu đề → danh sách thay chỗ nội dung khung chat → chọn một mục thì mở cuộc trò chuyện đó trong cùng khung, có dải "← Quay lại <đề> · Câu <n>".

## Phần 1: tool tìm câu đã làm

### Phạm vi dữ liệu

- Lấy mọi lượt trong `AttemptStore` (`store.list()`) có `setId` bằng lượt đang làm, `status !== 'incompatible'`.
- Loại các lượt **Thi thật còn `in-progress`** *(quyết định của tôi: chat chỉ có ở Thi thử, nhưng người học có thể đang dở một lượt Thi thật của cùng đề; trả về đáp án đúng của lượt đó là làm lộ đề thi thật)*. Lượt Thi thật đã nộp thì được tính.
- Trong mỗi lượt chỉ lấy câu có trong `answers` với ít nhất một lựa chọn.
- Đề sub thay 10 câu mỗi lượt, nên các lượt cùng đề có thể khác câu; vẫn tìm bình thường trên câu của từng lượt.
- Đề main 101…112: `ptX_1` và `ptX_2` là hai đề khác `setId` dù trùng nội dung; theo quyết định "cùng đề", chỉ tìm trong đúng `setId` đang làm.

### Gộp kết quả

- Gộp theo `qid`: một câu làm ở nhiều lượt chỉ hiện một lần, kèm danh sách các lần làm (ngày, Thi thật/Thi thử, lựa chọn đã chọn, đúng/sai), mới nhất trước.
- Câu đang hỏi trong phiên chat hiện tại vẫn có thể xuất hiện trong kết quả nếu khớp và đã trả lời; đánh dấu là "câu đang làm" để Gemini không nhầm *(quyết định của tôi)*.

### Câu thuộc lượt Thi thử chưa nộp

Tool trả về đáp án đúng và đúng/sai cho cả câu thuộc lượt Thi thử **chưa nộp** (kể cả lượt đang làm), dù câu đó vẫn sửa được. Người dùng chốt: Thi thử cứ chấm bình thường, nhưng **câu nào tool trả về mà thuộc lượt chưa nộp thì gắn nhãn "đã xem hướng dẫn"** cho câu đó ở đúng lượt đó (`markGuideOpened(attempt, qid)`, lấy bản mới nhất trong store rồi lưu). Vì vậy hàm tìm phải trả về được cặp (attemptId, qid) của từng lần làm. Lượt đã nộp thì không sửa.

### Định dạng trả về cho Gemini

- Lựa chọn trả về **bằng nội dung chữ** kèm cờ `chosen` / `correct`, theo thứ tự gốc của câu, không kèm nhãn A/B/C.
- Mỗi câu có nhãn vị trí dễ đọc để Gemini nhắc tới, ví dụ "Đề 3 · Câu 12 (lượt 02/11)", dựng từ `setLabel()` và vị trí câu trong lượt đó.
- Câu main có HTML thì chuyển sang chữ bằng `htmlToText`, giống `buildSystemPrompt`.
- Không tìm thấy thì trả về danh sách rỗng; system prompt dặn Gemini khi đó chỉ trả lời "Bạn chưa làm câu nào như vậy trong đề này."

### Cách tìm

Để cho người làm quyết định cách so khớp, với các ràng buộc:
- Gemini gửi một chuỗi tìm kiếm (từ khóa/tên dịch vụ, tiếng Anh hoặc tiếng Việt). Đề và lựa chọn đều bằng tiếng Anh, nên mô tả tool cần dặn Gemini gửi từ khóa tiếng Anh/tên dịch vụ AWS.
- Tìm trên đề bài, câu hỏi và các lựa chọn; nên tìm thêm tên service trong meta (`data/meta`, `data/main-meta`) vì đó là cách người học hay nhớ ("câu về Glacier").
- Không phân biệt hoa thường; xếp theo độ khớp; giới hạn số câu trả về (khoảng 5) để prompt không phình.
- Logic tìm là **hàm thuần có test** (đặt cạnh `src/ai/prompt.ts`), không phụ thuộc Firebase.

### Function calling

- Firebase AI Logic (`firebase/ai`, có sẵn trong `firebase@13.1.0`) hỗ trợ `tools: [{ functionDeclarations }]` trong `startChat`. Response có `functionCalls()`; trả kết quả bằng phần `functionResponse` ở lượt gửi kế tiếp. SDK không tự chạy hàm, nên adapter phải tự vòng: gửi → có function call → chạy hàm → gửi `functionResponse` → stream câu trả lời cuối.
- Giữ ranh giới hiện có: chỉ `src/ai/gemini.ts` import `firebase/ai`. Interface thuần trong `src/ai/types.ts` mở rộng để `startChat` nhận thêm danh sách tool (khai báo + hàm xử lý); `fake-ai.ts` giả lập được một lượt có function call để test UI.
- Giới hạn số vòng gọi tool trong một tin nhắn (ví dụ tối đa 3) để không lặp vô hạn *(quyết định của tôi)*.
- Lúc Gemini đang gọi tool, khung chat hiện dòng chờ như "Gemini đang tìm trong các câu bạn đã làm…" *(quyết định của tôi)*.
- Lịch sử lưu lên Firebase vẫn chỉ gồm tin chữ của người dùng và Gemini (như `ChatMessage` hiện nay), không lưu các lượt function call/response. Mở lại cuộc trò chuyện thì Gemini thấy câu trả lời chữ đã có phân tích, đủ để hỏi tiếp.
- `markGuideOpened` vẫn chỉ gọi khi có chữ đầu tiên của câu trả lời (không tính lượt function call).

## Phần 2: mở lại cuộc trò chuyện cũ

### Giao diện (bố cục A)

- Thanh tiêu đề khung chat có thêm nút 🕘 "Trò chuyện cũ", có ở cả khung nhỏ lẫn khi mở rộng toàn màn hình.
- Bấm thì phần thân khung chat đổi thành **danh sách mọi cuộc trò chuyện** của người dùng ở mọi lượt, mọi đề, mới nhất ở trên. Mỗi mục: nhãn đề (`setLabel`), số câu trong lượt, ngày cập nhật, một đoạn trích ngắn (đầu đề bài hoặc tin cuối). Câu đang làm đứng đầu và được đánh dấu "(câu đang làm)".
- Chọn một mục thì mở cuộc trò chuyện đó trong cùng khung; dưới thanh tiêu đề có dải "← Quay lại <đề> · Câu <n>" để về câu đang làm. Tiêu đề đổi theo cuộc trò chuyện đang mở.
- Trong cuộc trò chuyện cũ vẫn **hỏi tiếp được** *(người dùng đã xem mockup có ô "Hỏi tiếp…"; tôi hiểu là đồng ý)*. Ngữ cảnh gửi cho Gemini là câu hỏi của cuộc trò chuyện cũ (đề, lựa chọn theo `optionOrder` của lượt cũ, đáp án đúng). Tool tìm câu trong phiên đó dùng phạm vi đề của **lượt cũ**.
- Hỏi tiếp ở cuộc trò chuyện cũ **không** gọi `markGuideOpened` cho câu đang làm, và không sửa lượt cũ nếu lượt đó đã nộp *(quyết định của tôi: lượt đã nộp không đổi kết quả; lượt cũ còn đang làm dở thì đánh dấu như bình thường)*.
- Danh sách trống thì hiện "Chưa có cuộc trò chuyện nào."

### Dữ liệu

- Hiện chỉ có `ChatHistoryStore.load/save` theo từng (attempt, qid). Cần thêm cách **liệt kê** cuộc trò chuyện của một user (attemptId, qid, updatedAt, đoạn trích).
- Đọc toàn bộ `users/{uid}/aiChats` thì tải hết nội dung mọi cuộc trò chuyện (mỗi cái tới 200 KB). Người làm chọn giữa: đọc thẳng (đơn giản, chấp nhận được khi ít chat) hoặc thêm một chỉ mục nhẹ (ví dụ `users/{uid}/aiChatIndex/{attemptId}/{qid}` gồm `updatedAt` và đoạn trích, ghi cùng lúc với `save`). Thêm nhánh mới thì phải sửa `database.rules.json` và `docs/firebase-setup.md` (deploy lại rules).
- Danh sách **đọc thẳng** `users/{uid}/aiChats` *(quyết định của tôi)*: không thêm nhánh chỉ mục, không sửa `database.rules.json`, và các cuộc trò chuyện đã lưu trước thay đổi này vẫn hiện đủ. Tính năng mới có từ 02/11/2026 nên lượng chat còn ít; nếu sau này chậm thì mới thêm chỉ mục kèm bước bổ sung cho dữ liệu cũ.
- Cuộc trò chuyện của lượt **không còn trong store** (đã xóa, hoặc `incompatible`) thì **ẩn** khỏi danh sách *(quyết định của tôi)*: đường dẫn chat không lưu đề hay vị trí câu, và câu sub dự phòng không suy ra được đề từ `qid`, nên không dựng được nhãn "<đề> · Câu <n>" và phạm vi tool.

## Kiểm thử

- Hàm tìm câu (thuần): phạm vi cùng `setId`, bỏ lượt Thi thật dở, bỏ câu chưa trả lời, gộp theo `qid`, đúng/sai, không có nhãn A/B/C, giới hạn số kết quả, khớp theo tên service trong meta, trả về (attemptId, qid) của từng lần làm.
- Câu tìm được thuộc lượt Thi thử chưa nộp thì được gắn nhãn đã xem hướng dẫn; lượt đã nộp thì không đổi.
- Adapter/fake: một lượt có function call → hàm chạy → câu trả lời cuối stream ra; vượt giới hạn vòng thì dừng có thông báo lỗi.
- UI (`GeminiChat.test.tsx`): nút 🕘 hiện danh sách, mở cuộc trò chuyện cũ, quay lại, hỏi tiếp ở cuộc cũ không đánh dấu câu đang làm; dòng chờ lúc gọi tool.
- `npm run check` pass.

## Để người làm quyết định

- Thuật toán so khớp và xếp hạng cụ thể.
- Tên tool, schema tham số, lời mô tả tool cho Gemini.
- Chi tiết hiển thị của danh sách (độ dài đoạn trích, định dạng ngày).
