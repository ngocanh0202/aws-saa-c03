# Danh sách "Trò chuyện cũ": lọc theo câu, tìm kiếm, đổi tên

Bổ sung cho [2026-11-03-gemini-tools-design.md](2026-11-03-gemini-tools-design.md) (phần 2, bố cục A: nút 🕘 trong khung chat). Mọi quy tắc ở đó vẫn giữ, trừ chỗ spec này nói khác.

## Mục đích

Hiện nút 🕘 liệt kê **mọi** cuộc trò chuyện của người học, mới nhất ở trên. Khi đã hỏi Gemini nhiều, danh sách dài và khó tìm. Người học thường muốn xem lại đúng những lần đã hỏi về **câu đang làm** (ở các lượt trước của cùng đề), thỉnh thoảng mới cần xem hết; và muốn đặt tên cho những cuộc trò chuyện đáng nhớ để sau tìm lại.

## Mục tiêu / không làm / không được phép

- Mục tiêu:
  1. **Lọc mặc định**: chỉ hiện các cuộc trò chuyện về đúng câu đang làm (cùng `qid`) ở mọi lượt của **cùng bộ đề** (`setId`), dù vị trí câu khác nhau giữa các lượt.
  2. **Bỏ lọc**: hiện tất cả, **nhóm theo bộ đề**.
  3. **Tìm kiếm** theo tên (tên mặc định kiểu "Main 1 · Câu 1" hoặc tên đã đặt) và theo thời gian.
  4. **Đổi tên** cuộc trò chuyện.
- Không làm:
  - Không tìm theo nội dung tin nhắn hay nội dung đề bài.
  - Không cho Gemini tự tìm trên web (Grounding with Google Search) — người dùng đã quyết định để sau.
  - Không xóa cuộc trò chuyện.
- Không được phép:
  - Đổi tên cuộc trò chuyện **chưa lưu thành công lên Firebase** (chưa có câu trả lời nào của Gemini). Mục "câu đang làm" khi chưa có lịch sử thì không có nút đổi tên.
  - Lưu lại lịch sử chat mà làm mất tên đã đặt.

## Quyết định của người dùng

- Lọc mặc định = cùng câu (`qid`), cùng bộ đề (`setId`), mọi lượt.
- Bỏ lọc thì liệt kê theo từng bộ đề.
- Tìm theo tên (mặc định hoặc đã đặt) hoặc thời gian.
- Chỉ đổi tên được cuộc trò chuyện đã có trên Firebase.
- Không làm phần tự tìm trên web lúc này.

## Thiết kế

### Giao diện danh sách (thay màn danh sách hiện có)

- Đầu danh sách: **ô tìm kiếm** và **công tắc "Chỉ câu này"** (bật sẵn) *(quyết định của tôi: dạng checkbox/toggle có nhãn)*.
- Mục "câu đang làm" chỉ **ghim ở đầu khi đang lọc** (và ô tìm trống), như hiện nay. Khi bỏ lọc hoặc đang tìm thì không ghim: nếu câu đang làm đã có cuộc trò chuyện được lưu, nó nằm trong nhóm bộ đề của mình như mọi mục khác, kèm nhãn "(câu đang làm)", và cũng bị lọc theo chuỗi tìm; chưa có lịch sử thì không hiện *(quyết định của tôi)*.
- **Đang lọc:** danh sách phẳng, mới nhất ở trên, gồm các cuộc trò chuyện có `qid` bằng câu đang làm và lượt có `setId` bằng đề đang làm. Không có cuộc nào khác thì hiện "Chưa có cuộc trò chuyện nào về câu này."
- **Bỏ lọc:** nhóm theo bộ đề, mỗi nhóm có tiêu đề (`setLabel`: "Đề 3", "Main 1"…). Thứ tự nhóm theo hoạt động gần nhất, trong nhóm mới nhất ở trên *(quyết định của tôi)*.
- Mỗi mục hiện: **tên** (tên đã đặt, không có thì tên mặc định `"<setLabel> · Câu <n>"`), ngày giờ (`formatDate(updatedAt)`), đoạn trích tin cuối như hiện nay. Có tên đã đặt thì hiện thêm tên mặc định nhỏ bên dưới để vẫn biết là câu nào *(quyết định của tôi)*.
- Vẫn ẩn cuộc trò chuyện của lượt không còn trong máy (như spec trước).

### Tìm kiếm

- Khớp khi chuỗi tìm (bỏ khoảng trắng thừa, không phân biệt hoa thường, **không phân biệt dấu** — gõ "cau 5" vẫn khớp "Câu 5") nằm trong **tên hiển thị**, **tên mặc định** hoặc **chuỗi ngày giờ** `formatDate(updatedAt)` (ví dụ gõ "02/11") *(quyết định của tôi về bỏ dấu và cách khớp chuỗi con)*.
- Khi ô tìm có chữ thì **tìm trên toàn bộ** cuộc trò chuyện, bỏ qua công tắc lọc, và hiện dạng nhóm theo bộ đề *(quyết định của tôi: mục đích là "tìm lại session khác")*. Xóa chữ thì về lại trạng thái lọc trước đó.
- Không có kết quả: "Không tìm thấy cuộc trò chuyện nào."

### Đổi tên

- Mục đã lưu (có trong `chats.list`) có nút ✎ "Đổi tên". Bấm thì tên thành ô nhập ngay tại chỗ; Enter hoặc nút lưu để lưu, Esc để hủy. Để trống rồi lưu = bỏ tên, quay về tên mặc định *(quyết định của tôi)*.
- Giới hạn 100 ký tự, chỉ kiểm ở trình duyệt (rules không kiểm `title`) *(quyết định của tôi)*.
- Tên đã đặt **chỉ hiện trong danh sách**; tiêu đề khung chat giữ như hiện nay *(quyết định của tôi: hiện tên ở tiêu đề phải đổi `load` để trả kèm tên, không đáng so với lợi ích)*.
- Lỗi khi lưu tên (mất mạng…) thì báo ngắn trong danh sách và giữ tên cũ.

### Dữ liệu

- Tên lưu ở `users/{uid}/aiChats/{attemptId}/{qid}/title` (chuỗi). Rules hiện tại cho phép thêm nhánh con này (luật `.validate` của `$qid` chỉ đòi có `json` và `updatedAt`), nên **không cần sửa `database.rules.json`**.
- `ChatHistoryStore` thêm `rename(uid, attemptId, qid, title: string | null): Promise<void>` và `ChatSummary` thêm `title?: string`.
- **`save` phải đổi từ `set` sang `update`** (chỉ ghi `json` và `updatedAt`), nếu không mỗi lần lưu lịch sử sẽ xóa mất `title`. `rename` ghi riêng `title` (null = xóa).
- Đổi tên không đổi `updatedAt` *(quyết định của tôi: thứ tự "mới nhất" theo lần hỏi đáp, không theo lần đổi tên)*.
- `fakeChats` hỗ trợ `rename` và `title` trong `list`, cộng một lỗi giả để thử nhánh báo lỗi.

## Kiểm thử

- Lọc mặc định chỉ hiện đúng câu, cùng bộ đề (lượt khác đề có cùng `qid` không hiện; câu khác cùng đề không hiện).
- Tắt lọc: có tiêu đề nhóm theo bộ đề, đủ các cuộc trò chuyện.
- Tìm theo tên mặc định, tên đã đặt, ngày; không dấu; tìm bỏ qua lọc; không có kết quả.
- Đổi tên: lưu, hiện tên mới và tên mặc định phụ; để trống thì về mặc định; Esc hủy; lỗi thì báo và giữ tên cũ; mục câu đang làm chưa có lịch sử không có nút ✎.
- Lưu lịch sử sau khi đã đặt tên không làm mất tên (kiểm tra ở `fakeChats` giống `update`, và ghi chú trong `firebase.ts`).
- `npm run check` pass.

## Để người làm quyết định

- Bố cục và CSS cụ thể của ô tìm, công tắc, tiêu đề nhóm, ô đổi tên.
- Cách bỏ dấu tiếng Việt (ví dụ `normalize('NFD')` rồi bỏ dấu kết hợp, đổi `đ` → `d`).
