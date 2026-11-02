# Hỏi Gemini trong Thi thử (Firebase AI Logic)

## Mục đích

Khi làm Thi thử, người dùng hay bí ở một câu và muốn hỏi ngay điều mình chưa hiểu, ví dụ vì sao lựa chọn này sai hay hai dịch vụ khác nhau thế nào. Phần hướng dẫn soạn sẵn không trả lời được những câu hỏi tùy ý như vậy. Tính năng này thêm một nút Gemini ở mỗi câu để chat với Gemini về đúng câu đó. Tiêu chí thành công: Gemini **giải thích đúng cái người dùng hỏi**.

## Mục tiêu / không làm / không được phép

- Mục tiêu:
  - Mỗi câu trong lượt **Thi thử** có nút icon Gemini, chỉ hiện khi **đã đăng nhập Google**.
  - Bấm nút thì mở chat nhiều lượt với Gemini về câu đó.
  - Prompt gồm nội dung câu hỏi, các lựa chọn, đáp án đúng và câu hỏi của người dùng.
- Không làm:
  - Không có nút ở Thi thật, ở trang xem lại sau khi nộp (`ResultPage`), ở External, ở trang xem câu lẻ hay ở trang thống kê.
  - Không có backend riêng.
- Không được phép:
  - Hiện nút cho khách chưa đăng nhập.
  - Để Thi thật dùng được Gemini, kể cả gián tiếp.
  - Cho câu đã hỏi Gemini thoát khỏi nhãn "đã xem hướng dẫn" khi chấm.

## Quyết định của người dùng

- Nút chỉ có ở chế độ Thi thử và chỉ khi đã đăng nhập.
- Gemini **được biết đáp án đúng**.
- Hỏi Gemini **tính như mở hướng dẫn**. Gọi `markGuideOpened(attempt, qid)` (`src/engine/actions.ts`) khi Gemini **trả về đoạn chữ đầu tiên** cho tin nhắn đầu tiên ở câu đó, và câu đó được gắn nhãn khi chấm như hiện nay. Chỉ mở popup, hoặc gửi mà bị lỗi ngay, thì không tính *(quyết định của tôi: lỗi mạng hay hết quota không nên làm người dùng mất điểm)*. Hỏi Gemini chỉ gắn nhãn, không tự mở khung hướng dẫn soạn sẵn *(quyết định của tôi)*.
- Chat **nhiều lượt**: Gemini nhớ các tin nhắn trước trong cuộc trò chuyện của câu đó.
- **Lưu lịch sử trò chuyện với AI** lên tài khoản (Firebase), chỉ lưu lịch sử chat, không thêm gì khác.

## Kỹ thuật

- **SDK:** Firebase AI Logic qua `firebase/ai` (có sẵn trong `firebase@^13`, không cài thêm gói). Dùng backend Gemini Developer API (`GoogleAIBackend`), `getGenerativeModel`, `startChat`, và gửi theo luồng (`sendMessageStream`) để chữ hiện dần.
- **Cấu hình:** dùng chung Firebase app với đăng nhập/đồng bộ.
  - Biến mới `VITE_GEMINI_MODEL` là tùy chọn. Mặc định là model Gemini Flash ổn định mới nhất mà Firebase AI Logic hỗ trợ lúc làm; người làm kiểm tra tài liệu Firebase để chọn tên đúng.
  - Cập nhật `.env.example` và `docs/firebase-setup.md`: bật Firebase AI Logic trong console, chọn Gemini Developer API, và khuyến nghị bật App Check để chặn lạm dụng.
  - App Check là tùy chọn. Nếu có biến `VITE_RECAPTCHA_SITE_KEY` thì adapter bật App Check với reCAPTCHA Enterprise; không có thì chạy không App Check *(quyết định của tôi)*.
  - Đề và lựa chọn của cả hai bộ không có hình (đã kiểm tra 0/780 câu main), nên prompt chỉ cần chữ.
- **Ranh giới module** (giữ quy tắc "chỉ `src/sync/firebase.ts` import Firebase SDK" theo tinh thần hiện có):
  - Thêm adapter `src/ai/gemini.ts`, là file duy nhất import `firebase/ai`, chỉ `main.tsx` import nó.
  - Bên ngoài adapter là một interface thuần trong `src/ai/types.ts`, ví dụ `AiClient.startChat(systemPrompt): AiChat` với `AiChat.send(text): AsyncIterable<string>`.
  - `AppDeps` có thêm trường tùy chọn `ai?: AiClient`, chỉ có khi Firebase được cấu hình.
  - Test dùng bản giả `src/test/fake-ai.ts`, không gọi mạng.
- **Điều kiện hiện nút:** `attempt.mode === 'practice'`, có `ai`, và trạng thái sync có `user` (`loading`, `conflict` hoặc `synced`). Đọc trạng thái từ `sync` trong `AppDeps` bằng `useSyncExternalStore`, giống `AccountMenu`. Đăng xuất giữa chừng thì nút biến mất và popup đang mở đóng lại.
- **Prompt:**
  - Phần hệ thống/ngữ cảnh gồm:
    - vai trò: trợ giảng luyện thi AWS SAA-C03;
    - nội dung câu hỏi: đề và câu hỏi, chuyển HTML của câu main sang chữ bằng `htmlToText` hoặc tương đương phía client;
    - các lựa chọn theo **thứ tự và nhãn A/B/C đang hiển thị** (tính từ `optionOrder` bằng `displayLabel` lúc dựng prompt, không lưu);
    - đáp án đúng theo nhãn hiển thị.
  - Chỉ dẫn cho Gemini:
    - trả lời bằng tiếng Việt, giữ thuật ngữ AWS bằng tiếng Anh;
    - trả lời đúng trọng tâm câu người dùng hỏi, ngắn gọn;
    - nói rõ khi thông tin có thể đã cũ;
    - không bịa dịch vụ hay con số.
  - Mỗi lượt chat sau đó chỉ gửi tin nhắn của người dùng; lịch sử do `startChat` giữ.
- **Giao diện:**
  - Nút icon Gemini nằm cạnh nút mở hướng dẫn của câu, có `aria-label="Hỏi Gemini"`.
  - Bấm nút mở popup chat toàn màn hình, theo mẫu `ServiceModal`: đóng bằng Esc/nút đóng, khóa cuộn nền. Popup gồm:
    - dòng tóm tắt câu đang hỏi (số câu và vài chữ đầu của đề);
    - danh sách tin nhắn;
    - ô nhập và nút gửi.
  - Câu trả lời hiện dạng Markdown an toàn. Tối thiểu hỗ trợ in đậm, danh sách và code; **không** render HTML thô từ model. Có thể dùng một thư viện Markdown nhỏ đã kiểm chứng, hoặc tự xử lý tối thiểu; người làm quyết định.
  - Trong lúc chờ: chỉ báo đang trả lời và khóa nút gửi. Khi lỗi (mạng, hết quota, App Check từ chối): hiện thông báo tiếng Việt ngắn trong popup và cho gửi lại.
- **Lịch sử chat:** lưu trong Firebase Realtime Database của người dùng tại `users/{uid}/aiChats/{attemptId}/{qid}`, dạng `{ json: string, updatedAt: number }`. `json` là mảng tin nhắn `{ role: 'user' | 'model', text }`.
  - Ghi lại sau mỗi lượt hỏi đáp hoàn chỉnh, tức khi Gemini trả lời xong.
  - Mở popup thì nạp lịch sử của câu đó và tiếp tục chat. Lịch sử được đưa vào `startChat({ history })`, nên Gemini nhớ cả các lượt cũ, kể cả sau khi tải lại trang hay mở trên máy khác. Ngữ cảnh câu hỏi (system instruction) luôn được dựng mới, không lấy từ lịch sử. Nhãn A/B/C trong lịch sử luôn khớp với màn hình vì `optionOrder` cố định trong một lượt thi.
  - Chỉ gửi cho model tối đa 40 tin nhắn gần nhất của lịch sử; giao diện vẫn hiện đủ *(quyết định của tôi)*.
  - Cập nhật `database.rules.json`: thêm nhánh `aiChats/$attemptId/$qid` có `.validate` tương tự `attempts`, với giới hạn độ dài `json`, ví dụ dưới 200000 ký tự.
  - Đăng xuất thì popup đóng và không còn đọc được lịch sử, vì lịch sử nằm theo `uid`.
  - Phần đọc/ghi lịch sử nằm trong adapter Firebase (giữ quy tắc chỉ adapter import SDK). Interface thuần, ví dụ `ChatHistoryStore.load(uid, attemptId, qid)` và `save(...)`, có bản giả để test.
  - Xóa lượt thi thì không cần xóa lịch sử chat tương ứng *(quyết định của tôi, giữ đơn giản)*.
  - Lịch sử chỉ lưu trên Firebase, không lưu thêm vào localStorage *(cách tôi hiểu lời bạn: "chỉ lưu lịch sử trò chuyện với AI")*.

## Kiểm thử

- Dựng prompt (hàm thuần): nhãn theo thứ tự hiển thị, đáp án đúng đúng nhãn, HTML của câu main được chuyển sang chữ.
- Nút hiện hay ẩn:
  - Thi thử + đăng nhập + có `ai` thì hiện.
  - Thi thật, khách chưa đăng nhập, hoặc không có `ai` thì ẩn.
- Gửi tin đầu tiên thì câu được thêm vào `guideOpened`; chỉ mở popup thì không.
- Chat nhiều lượt với `fake-ai`: tin nhắn hiện theo thứ tự, câu trả lời theo luồng nối dần, lỗi hiện thông báo.
- Lịch sử: mở lại popup thì thấy tin nhắn cũ (từ bản giả `ChatHistoryStore`), gửi tiếp thì lịch sử được đưa vào `startChat`, và sau mỗi lượt thì `save` được gọi.
- `npm run check` qua.

## Để người làm tự quyết

Tên model mặc định cụ thể (kiểm tra tài liệu Firebase), cách render Markdown, kiểu dáng popup, icon Gemini (SVG nội tuyến), độ dài giới hạn của tin nhắn.
