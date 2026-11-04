# Chế độ AI thử nghiệm: Local AI (LM Studio) song song với Gemini

Bổ sung cho các spec Gemini ([2026-11-02-gemini-chat-design.md](2026-11-02-gemini-chat-design.md), [2026-11-03-gemini-tools-design.md](2026-11-03-gemini-tools-design.md), [2026-11-03-chat-list-design.md](2026-11-03-chat-list-design.md)). Mọi quy tắc ở đó áp dụng cho Local AI, trừ chỗ spec này nói khác.

## Mục đích

Người dùng muốn thử dùng một model chạy trên máy của mình (LM Studio) bên cạnh Gemini, chuyển qua lại được. Web vẫn deploy trên GitHub Pages; LM Studio trên máy người dùng được đưa ra Internet qua **Cloudflare Tunnel**.

## Mục tiêu / không làm / không được phép

- Mục tiêu:
  - Biến build mới **`VITE_LOCAL_AI`** = địa chỉ gốc API của LM Studio (OpenAI-compatible, ví dụ `https://<tên>.trycloudflare.com` hoặc tên miền tunnel riêng). Có giá trị thì bật được chế độ thử nghiệm.
  - Trong menu tài khoản (bấm vào tên tài khoản) có **nút bật/tắt "Chế độ AI thử nghiệm"**, hiện cho **mọi người đã đăng nhập** khi có `VITE_LOCAL_AI`.
  - Bật chế độ: nút "Hỏi Gemini" thành **"Hỏi AI"** với **icon robot**, mọi khung chat dùng Local AI. Tắt: quay về Gemini. **Mặc định là Gemini.**
  - Lịch sử Local AI **tách riêng** với Gemini.
- Không làm:
  - Không thay Gemini; không chạy cả hai cùng lúc trong một khung.
  - Không bảo vệ tunnel bằng khóa bí mật: web tĩnh không giữ được bí mật (mọi thứ trong bundle đều công khai).
  - Không đồng bộ lựa chọn chế độ giữa các máy.
- Không được phép:
  - Hiện nút chế độ thử nghiệm khi không có `VITE_LOCAL_AI` hoặc khi chưa đăng nhập.
  - Ghi lịch sử Local AI vào `aiChats` của Gemini (hay ngược lại).
  - Treo khung chat khi tunnel/LM Studio không chạy.

## Quyết định của người dùng

- Chuyển qua lại Local ↔ Gemini, mặc định Gemini.
- Nút bật chế độ ở menu tài khoản, hiện cho mọi người đã đăng nhập.
- Nút đổi chữ "Hỏi AI" và icon robot khi đang ở chế độ thử nghiệm.
- Lịch sử tách riêng giữa hai chế độ.
- Deploy dùng Cloudflare Tunnel để GitHub Pages gọi tới LM Studio.
- Dùng **tunnel nhanh** (`cloudflared tunnel --url http://localhost:1234`, địa chỉ `*.trycloudflare.com` đổi mỗi lần chạy lại). Đổi địa chỉ bằng cách **sửa GitHub Variable `VITE_LOCAL_AI` rồi chạy lại workflow deploy**; không có ô sửa địa chỉ trên web.

## Thiết kế

### Kết nối LM Studio

- Dùng API OpenAI-compatible của LM Studio: `POST {VITE_LOCAL_AI}/v1/chat/completions` với `stream: true` (SSE), `messages` gồm system prompt (cùng `buildSystemPrompt` như Gemini) + lịch sử + tin mới, và `tools` theo định dạng OpenAI (`type: 'function'`) cho `find_answered_questions` và `open_guide`.
- Function calling: đọc `tool_calls` trong stream (ghép các mảnh `arguments`), chạy tool, gửi lại tin `role: 'tool'` kèm `tool_call_id`, dùng chung vòng `toolLoop` (tối đa 3 vòng) qua một adapter mới `src/ai/local.ts` cài `AiClient`. Model không hỗ trợ tool thì chỉ trả lời chữ (tool không được gọi) — chấp nhận *(quyết định của tôi)*.
- Model: biến tùy chọn **`VITE_LOCAL_AI_MODEL`**; trống thì gửi `model` là chuỗi rỗng/bỏ trường để LM Studio dùng model đang nạp *(quyết định của tôi; người làm kiểm tra LM Studio chấp nhận cách nào)*.
- Adapter dùng `fetch` thuần, không thêm thư viện.
- **Không cần App Check/reCAPTCHA** cho Local AI: nút Hỏi AI hiện được kể cả khi build không có `VITE_RECAPTCHA_SITE_KEY` (miễn là có Firebase để đăng nhập và lưu lịch sử).

### Model có "suy nghĩ" (reasoning)

- Phần suy nghĩ (`<think>…</think>` trong `delta.content`, hoặc trường `delta.reasoning_content`) **không hiện trong khung, không lưu, không gửi lại** cho model; adapter lọc bỏ trước khi trả chữ *(quyết định của tôi)*.
- Trong lúc model đang suy nghĩ, dòng chờ ghi "AI đang suy nghĩ…" *(quyết định của tôi)*.
- Token suy nghĩ tính là "đã có phản hồi" cho giới hạn chờ phản hồi đầu tiên; model chỉ suy nghĩ mà không có chữ trả lời thì báo lỗi như hiện nay ("chưa trả lời được") *(quyết định của tôi)*.

### Ngữ cảnh ngắn của model cục bộ

- Local AI gửi tối đa **12 tin gần nhất** (Gemini vẫn 40) vì model nạp trong LM Studio thường có ngữ cảnh 4k–8k token *(quyết định của tôi)*.
- Lỗi 4xx có nhắc độ dài ngữ cảnh (`context`/`n_ctx`/`tokens`) thì báo riêng: **"Cuộc trò chuyện dài quá ngữ cảnh của model đang nạp. Tăng Context Length trong LM Studio hoặc hỏi ngắn hơn."** *(quyết định của tôi)*.

### Lỗi và thử lại

- Không kết nối được (tunnel tắt, LM Studio tắt, CORS chặn → `fetch` ném `TypeError`), hoặc HTTP 5xx/4xx: báo **"Không kết nối được AI thử nghiệm. Kiểm tra LM Studio và Cloudflare Tunnel."** *(quyết định của tôi)*.
- Có giới hạn thời gian chờ phản hồi đầu tiên (ví dụ 60 giây, model cục bộ có thể nạp chậm) rồi báo lỗi như trên *(quyết định của tôi)*.
- Cơ chế thử lại 429/503 và khóa dùng chung (cooldown) **chỉ áp dụng cho Gemini**; Local AI không dùng chung khóa đó *(quyết định của tôi: hai nguồn độc lập)*.

### Chế độ và giao diện

- Lựa chọn chế độ lưu ở `localStorage` (theo máy), mặc định Gemini. Không có `VITE_LOCAL_AI` thì luôn là Gemini dù localStorage ghi gì.
- Menu tài khoản: một dòng có công tắc/nút "Chế độ AI thử nghiệm (Local AI)" với trạng thái bật/tắt rõ ràng.
- Đổi chế độ khi đang mở khung chat: khung đóng lại; mở lại thì là khung của chế độ mới *(quyết định của tôi: tránh một khung lẫn hai nguồn)*. Câu trả lời đang chạy nền vẫn chạy xong và lưu vào đúng nhánh của chế độ cũ.
- Mọi chữ "Gemini" trong khung (tiêu đề "Hỏi Gemini · Câu n", dòng chờ "Gemini đang trả lời…", thông báo lỗi, bản gọn mobile "Gemini Đ3 · Câu 12") đổi thành "AI" ở chế độ thử nghiệm *(quyết định của tôi)*.
- Icon robot: SVG nội tuyến, cùng kích thước icon Gemini.
- Áp dụng ở cả trang thi (Thi thử) và trang xem lại bài.

### Lịch sử

- Nhánh mới `users/{uid}/localChats/{attemptId}/{qid}` cùng định dạng `aiChats` (`json`, `updatedAt`, `title`). `ChatHistoryStore` thứ hai trỏ vào nhánh này; danh sách "Trò chuyện cũ", đổi tên, chạy nền… dùng store của chế độ đang bật.
- Sửa `database.rules.json` thêm `localChats` với cùng luật `.validate` như `aiChats`; cập nhật `docs/firebase-setup.md` (deploy lại rules).

### Cấu hình và tài liệu

- `.env.example`, workflow deploy (`vars.VITE_LOCAL_AI`, `vars.VITE_LOCAL_AI_MODEL`), `docs/firebase-setup.md` hoặc tài liệu mới: cách chạy LM Studio server, **bật CORS** trong LM Studio, chạy `cloudflared tunnel` trỏ vào cổng LM Studio (mặc định `1234`), đặt URL vào Variables trên GitHub.
- Tài liệu có các bước cho tunnel nhanh: chạy `cloudflared tunnel --url http://localhost:1234`, chép địa chỉ `https://….trycloudflare.com` vào Variable `VITE_LOCAL_AI`, chạy lại workflow (Actions → Run workflow); địa chỉ đổi thì làm lại.
- Cảnh báo trong tài liệu: URL tunnel nằm trong bundle công khai, ai cũng gọi được LM Studio khi tunnel đang chạy; tắt tunnel khi không dùng.

## Kiểm thử

- Adapter `local.ts` với `fetch` giả: stream SSE ghép chữ; `tool_calls` nhiều mảnh → chạy tool → gửi `role: 'tool'`; lỗi mạng/HTTP → lỗi có thông điệp kết nối; hết thời gian chờ.
- Cấu hình: không có `VITE_LOCAL_AI` thì không có nút chế độ; có thì menu tài khoản có nút (chỉ khi đã đăng nhập).
- UI: bật chế độ → nút "Hỏi AI" + icon robot; gửi tin dùng client local và lưu `localChats`; tắt → "Hỏi Gemini", lịch sử Gemini không lẫn; đổi chế độ khi đang mở khung → khung đóng; build không có reCAPTCHA vẫn có nút Hỏi AI ở chế độ thử nghiệm.
- `npm run check` pass.

## Để người làm quyết định

- Chi tiết parse SSE, cách nhận diện lỗi CORS/mạng.
- Hình icon robot và kiểu công tắc trong menu.
- Nhánh `localChats` được truyền vào `createFirebaseClients` thế nào (tham số đường dẫn hay hai store).
