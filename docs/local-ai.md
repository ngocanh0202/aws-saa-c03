# Chế độ AI thử nghiệm (LM Studio + Cloudflare Tunnel)

Bên cạnh Gemini, web có thể hỏi một model chạy trên máy của bạn bằng [LM Studio](https://lmstudio.ai). Mặc định vẫn là Gemini. Khi build có `VITE_LOCAL_AI`, người đã đăng nhập Google sẽ thấy nút **"🤖 Chế độ AI thử nghiệm"** trong menu tài khoản. Bật lên thì nút "Hỏi Gemini" thành **"Hỏi AI"**, câu hỏi gửi tới LM Studio, và lịch sử lưu riêng ở `users/{uid}/localChats` (không lẫn với Gemini). Lựa chọn bật/tắt được lưu theo từng máy.

Chế độ này **không cần** reCAPTCHA/App Check, nhưng vẫn cần cấu hình Firebase (để đăng nhập và lưu lịch sử).

## 1. Chạy LM Studio server

1. Mở LM Studio, nạp một model (nên chọn model hỗ trợ tool calling, ví dụ dòng Qwen hoặc Llama 3.1+, để AI tìm được câu đã làm và mở hướng dẫn).
2. Vào tab **Developer** → bật **Start server** (cổng mặc định `1234`).
3. Trong **Server Settings**, bật **Enable CORS**. Không bật thì trình duyệt chặn web trên GitHub Pages gọi tới.
4. Nên tăng **Context Length** của model (ví dụ 8192 trở lên). Web gửi tối đa 12 tin gần nhất; nếu vẫn quá ngữ cảnh, web báo "Cuộc trò chuyện dài quá ngữ cảnh của model đang nạp…".

## 2. Mở Cloudflare Tunnel (tunnel nhanh)

Cài [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) rồi chạy:

```bash
cloudflared tunnel --url http://localhost:1234
```

Lệnh in ra một địa chỉ dạng `https://xxxx.trycloudflare.com`. **Địa chỉ này đổi mỗi lần chạy lại `cloudflared`.**

## 3. Đặt địa chỉ cho web

- **Chạy ở máy:** thêm vào `.env.local`:

  ```
  VITE_LOCAL_AI=https://xxxx.trycloudflare.com
  # Tùy chọn: tên model trong LM Studio; bỏ trống thì dùng model đang nạp.
  VITE_LOCAL_AI_MODEL=
  ```

  (Chạy ở máy có thể dùng thẳng `http://localhost:1234`.)
- **GitHub Pages:** vào **Settings → Secrets and variables → Actions → Variables**, đặt `VITE_LOCAL_AI` (và `VITE_LOCAL_AI_MODEL` nếu muốn), rồi vào **Actions → Deploy → Run workflow** để build lại.

Mỗi khi địa chỉ tunnel đổi: sửa Variable `VITE_LOCAL_AI` rồi **Run workflow** lại. Trước khi deploy xong, web vẫn trỏ tới địa chỉ cũ và báo "Không kết nối được AI thử nghiệm. Vui lòng liên hệ buihngocanh2@gmail.com."

## 4. Deploy lại rules Firebase

Rules đã thêm nhánh `users/$uid/localChats` và `users/$uid/aiSettings` (cài đặt ⚙, kiểm tra từng số đúng khoảng). Dán lại [`database.rules.json`](../database.rules.json) ở **Realtime Database → Rules** rồi **Publish** (xem [firebase-setup.md](firebase-setup.md), bước 3). Chưa publish thì lưu lịch sử và cài đặt AI thử nghiệm sẽ bị từ chối.

## Cài đặt ⚙ (tham số model)

Trong khung "Hỏi AI" có nút **⚙** (Gemini không có). Bấm vào hiện popup chỉnh `temperature`, `top_p`, `top_k`, `min_p`, `presence_penalty`, `max_tokens`, `stream` và **Tìm trên web**; di chuột (hoặc chạm) vào tên tham số để xem hướng dẫn. Ô sai thì báo lỗi và khóa nút Lưu; **Mặc định** đưa về giá trị ban đầu (xem `DEFAULT_LOCAL_SETTINGS` trong `src/ai/local-settings.ts`).

- Lưu theo tài khoản ở `users/{uid}/aiSettings`, dùng chung mọi máy; áp dụng từ câu hỏi tiếp theo. Tải lỗi thì hỏi bằng mặc định và khóa ⚙ (không ghi đè bản trên Firebase).
- Các số được gửi thật trong body `/v1/chat/completions`. `top_k` và `min_p` không thuộc chuẩn OpenAI: LM Studio/Unsloth (nền llama.cpp) thường nhận, server nào không hỗ trợ thì bỏ qua mà không báo lỗi. Xem request thật ở **Developer → Server Logs** của LM Studio.
- `max_tokens` trống = không giới hạn (không gửi). Tắt `stream` thì nhận cả câu trả lời một lần, tool calling vẫn chạy.
- "Tìm trên web" chỉ đổi câu dặn trong prompt; LM Studio/Unsloth không tự tra cứu web.

## Lưu ý bảo mật

- Địa chỉ tunnel nằm trong file JavaScript công khai của web: **ai cũng xem được và gọi thẳng tới LM Studio của bạn** khi tunnel đang chạy (kể cả người không đăng nhập). Chỉ bật tunnel khi cần và tắt khi không dùng.
- Không đặt dữ liệu nhạy cảm trong LM Studio server đó.

## Hành vi

- Lỗi kết nối (LM Studio/tunnel tắt, chưa bật CORS) hoặc chờ quá 60 giây chưa có phản hồi: báo "Không kết nối được AI thử nghiệm…".
- Model có phần "suy nghĩ" (`<think>…</think>` hoặc `reasoning_content`): phần này bị lọc, không hiện, không lưu; trong lúc đó khung hiện "AI đang suy nghĩ…".
- Có model chỉ in thẻ đóng `</think>` (thẻ mở nằm trong template), nên khi server không tách `reasoning_content` và chữ chưa có thẻ nào, web **giữ câu trả lời lại tới khi xong mới hiện** (không chữ chạy dần) để không lộ phần suy nghĩ. Muốn chữ chạy dần: trong LM Studio bật tùy chọn tách phần suy nghĩ ra `reasoning_content` (Developer → Server Settings, mục reasoning) nếu model hỗ trợ.
- Cơ chế tự thử lại 429/503 và khóa nút Gửi chỉ áp dụng cho Gemini.
- Đổi chế độ khi đang mở khung chat thì khung đóng lại; câu trả lời đang chạy vẫn chạy xong và lưu vào đúng chế độ cũ.

## Để sau

Sửa địa chỉ tunnel ngay trên web (không cần deploy lại) đã được thiết kế nhưng chưa làm, xem [spec Local AI](superpowers/specs/2026-11-04-local-ai-design.md), mục "Để sau".
