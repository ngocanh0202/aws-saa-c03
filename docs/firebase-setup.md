# Cài đặt Firebase cho đăng nhập Google và đồng bộ lượt thi

Web chạy bình thường mà không cần Firebase (chế độ khách, lưu bằng `localStorage`). Làm theo 6 bước dưới đây nếu muốn đăng nhập Google và đồng bộ lượt thi giữa các máy. Thiết kế chi tiết: [superpowers/specs/2026-11-02-firebase-sync-design.md](superpowers/specs/2026-11-02-firebase-sync-design.md).

Repo này là `anhbhn-kstns/exam-aws-ssa-03`, nên tên miền GitHub Pages cần khai báo là `anhbhn-kstns.github.io`.

## Bước 1. Tạo app Web và lấy cấu hình

1. Vào [Firebase console](https://console.firebase.google.com/), chọn project của bạn (hoặc bấm **Add project** để tạo mới).
2. Ở màn hình **Project Overview**, bấm biểu tượng **Web** (`</>`) dưới dòng "Get started by adding Firebase to your app".
3. Nhập **App nickname** (ví dụ `saa-c03`). Không cần bật Firebase Hosting. Bấm **Register app**.
4. Màn hình tiếp theo hiện đoạn `const firebaseConfig = { ... }`. Giữ trang này (hoặc sao chép lại), vì bước 4 và 5 cần các giá trị `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`.
   - Nếu chưa thấy `databaseURL`, đừng lo: nó xuất hiện sau khi làm bước 3. Có thể mở lại cấu hình qua **Project settings (biểu tượng bánh răng) → General → Your apps → SDK setup and configuration**.

## Bước 2. Bật đăng nhập Google và khai báo tên miền

1. Menu trái: **Build → Authentication**, bấm **Get started** nếu là lần đầu.
2. Tab **Sign-in method**, chọn **Google** trong danh sách nhà cung cấp.
3. Bật công tắc **Enable**, chọn **Public-facing name** và **Support email**, rồi bấm **Save**.
   - Tùy chọn: bật thêm **Email/Password** (người dùng tự đăng ký trên web, không bắt xác nhận email; muốn mật khẩu khó hơn thì đặt ở **Settings → Password policy**) và **Facebook** (cần App ID/App secret của app Facebook, và dán **OAuth redirect URI** Firebase đưa vào **Facebook Login → Settings → Valid OAuth Redirect URIs**). Nút "Đăng nhập" trên web mở popup chọn Google, Email/Mật khẩu hoặc Facebook; cách nào chưa bật thì báo "Cách đăng nhập này chưa được bật".
   - Mặc định Firebase để **một tài khoản cho mỗi email**: người đã đăng ký bằng Google mà đăng nhập Facebook cùng email sẽ được báo dùng lại cách cũ. Mỗi tài khoản có `uid` riêng, rules chỉ cho đọc/ghi `users/{uid}` của chính mình.
4. Vẫn trong **Authentication**, mở tab **Settings → Authorized domains**.
5. Bấm **Add domain**, nhập `anhbhn-kstns.github.io` rồi bấm **Add**. (`localhost` đã có sẵn nên chạy `npm run dev` không cần thêm.)

## Bước 3. Tạo Realtime Database và dán rules

1. Menu trái: **Build → Realtime Database**, bấm **Create Database**.
2. Chọn vị trí (ví dụ `asia-southeast1 (Singapore)`), bấm **Next**.
3. Chọn **Start in locked mode**, bấm **Enable**.
4. Mở tab **Rules**, xóa nội dung hiện có, dán toàn bộ nội dung file [`database.rules.json`](../database.rules.json) ở gốc repo, rồi bấm **Publish**.
5. Mở tab **Data**: URL ở đầu trang (dạng `https://<project>-default-rtdb.<region>.firebasedatabase.app`) chính là giá trị `databaseURL`.

## Bước 4. Chạy ở máy

1. Sao chép `.env.example` thành `.env.local` ở gốc repo.
2. Điền 5 biến `VITE_FIREBASE_*` bằng giá trị lấy ở bước 1 và 3:

   | Biến | Lấy từ |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

3. Chạy `npm run dev`. Thiếu hoặc rỗng bất kỳ biến nào thì web chạy ở chế độ khách (không có nút đăng nhập). `.env.local` đã nằm trong `.gitignore`.

## Bước 5. Cấu hình khi deploy lên GitHub Pages

1. Vào repo trên GitHub: **Settings → Secrets and variables → Actions**.
2. Chọn tab **Variables** (không phải Secrets), bấm **New repository variable**.
3. Thêm lần lượt đủ 5 biến `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` với cùng giá trị như `.env.local`.
4. Workflow `.github/workflows/pages.yml` truyền các biến này vào bước "Build site". Chạy lại workflow (hoặc push lên `main`) để áp dụng.

Lưu ý: cấu hình web của Firebase (kể cả `apiKey`) không phải bí mật, vì dữ liệu được bảo vệ bằng Security Rules ở bước 3 và danh sách Authorized domains ở bước 2.

## Bước 6. Kiểm tra

1. Mở web ở hai trình duyệt khác nhau và đăng nhập cùng một tài khoản Google.
2. Ở trình duyệt 1, bắt đầu một lượt **Thi thật**.
3. Ở trình duyệt 2, mở lượt đó từ mục "Đang làm dở" trên trang chủ.
4. Chọn đáp án ở trình duyệt 1: trình duyệt 2 phải đổi ngay, và đồng hồ đếm ngược hai bên phải khớp nhau.
5. Kiểm tra tải lại khi mất mạng: ở trình duyệt 1, đang làm dở lượt Thi thật thì ngắt mạng (DevTools → Network → **Offline**), tải lại trang, chọn thêm vài đáp án, rồi bật mạng lại. Không được hiện hộp thoại "Máy này có dữ liệu chưa đăng nhập", và các đáp án vừa chọn phải hiện ở trình duyệt 2.

Nếu header báo "Không đọc được dữ liệu trên cloud…" thì rules ở bước 3 chưa được publish (Realtime Database đang ở locked mode). Publish rules rồi bấm lại nút đăng nhập.

## Bước 7. Hỏi Gemini trong Thi thử (tùy chọn)

Nút "Hỏi Gemini" chỉ hiện ở chế độ Thi thử khi đã cấu hình Firebase và đã đăng nhập.

1. Firebase console → **Build → AI Logic** (Firebase AI Logic) → **Get started**, chọn **Gemini Developer API** và bật. Model mặc định là `gemini-3.5-flash`; muốn đổi thì đặt `VITE_GEMINI_MODEL`.
2. Deploy lại `database.rules.json` (đã có nhánh `users/$uid/aiChats` lưu lịch sử chat theo từng câu, và `users/$uid/localChats` cho chế độ AI thử nghiệm, xem [local-ai.md](local-ai.md)) ở **Realtime Database → Rules**.
3. App Check (**bắt buộc** cho Gemini: Firebase yêu cầu App Check cho AI Logic từ 02/11/2026; thiếu khóa thì web ẩn nút "Hỏi Gemini"): tạo khóa **reCAPTCHA Enterprise** cho domain web, đăng ký trong **App Check → Apps → Web** rồi đặt khóa vào `VITE_RECAPTCHA_SITE_KEY` (cả `.env.local` và Variables trên GitHub, cùng `VITE_GEMINI_MODEL` nếu muốn đổi model). Nên theo dõi quota và đặt ngân sách trong Google Cloud/Firebase console.
4. Chạy ở localhost: thêm `localhost` vào domain của khóa reCAPTCHA, hoặc dùng debug token: mở web ở localhost, lấy token in ra console trình duyệt (`App Check debug token: ...`; cần đặt `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` trước khi app khởi tạo, ví dụ trong DevTools rồi tải lại), rồi đăng ký trong **App Check → Apps → Web → Manage debug tokens**.

## Hỗ trợ (Liên hệ admin)

Khung chat "Liên hệ admin" cho người học đã đăng nhập nhắn thẳng tới admin; admin xem và trả lời ở "Hộp thư hỗ trợ" trong menu tài khoản.

1. Publish lại `database.rules.json` ở **Realtime Database → Rules** (đã có hai nhánh mới `support/{uid}` lưu tin nhắn và `supportIndex/{uid}` lưu chỉ mục cho hộp thư admin). Nhánh `users/` giữ nguyên: admin không đọc được dữ liệu học của người khác.
2. Admin phải đăng nhập bằng **Google** với email đã xác nhận `buihngocanh2@gmail.com` (rules kiểm tra `email_verified === true`; đăng nhập email/mật khẩu chưa xác nhận sẽ không có quyền admin).
3. Kiểm tra rules tự động: `npm run test:rules` (chạy Firebase emulator, cần cài Java; test ở `rules-tests/support.rules.test.ts`).
4. Nếu không chạy được emulator, kiểm tra tay ở **Rules Playground** (6 ca bắt buộc):
   - Đăng nhập là A: đọc rồi ghi `support/B` → **từ chối**.
   - Người thường (không phải admin): đọc `supportIndex` → **từ chối**.
   - Tài khoản email admin nhưng `email_verified: false`: đọc `supportIndex` → **từ chối**.
   - Người học ghi tin `from: 'admin'` vào `support/<uid của mình>/<id>` → **từ chối**.
   - Ghi đè một tin đã có → **từ chối** (tin đã gửi không sửa/xóa được).
   - Admin (email đã xác nhận) đọc `users/B/attempts` → **từ chối**.
