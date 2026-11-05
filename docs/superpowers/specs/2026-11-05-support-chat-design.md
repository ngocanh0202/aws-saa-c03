# Khung chat hỗ trợ "Liên hệ admin"

Ngày: 2026-11-05 · Trạng thái: chờ duyệt

## Mục đích

Người học gặp lỗi (không kết nối được AI, không lưu được, không đăng nhập được…) hiện chỉ thấy câu báo, nhiều câu ghi "liên hệ buihngocanh2@gmail.com" nhưng không có cách liên hệ ngay trên web. Cần một khung chat để người học nhắn trực tiếp cho admin (tài khoản `buihngocanh2@gmail.com`), có thể đính kèm lỗi vừa gặp; admin đọc và trả lời ngay trên web.

## Mục tiêu

1. Người đã đăng nhập mở khung chat hỗ trợ từ **menu tài khoản** (mục "Liên hệ admin"), nhắn cho admin, xem câu trả lời.
2. Ở các chỗ hiện câu báo lỗi có nút **"Liên hệ admin"**: bấm thì mở khung chat với **lỗi đính kèm sẵn**; người học viết thêm rồi tự bấm Gửi.
3. Admin (đăng nhập bằng `buihngocanh2@gmail.com`) có mục **"Hộp thư hỗ trợ"** trong menu tài khoản: danh sách cuộc trò chuyện (mới nhất trên đầu, có số chưa đọc), bấm vào để đọc và trả lời.
4. Giao diện khung chat giống khung Hỏi Gemini/Hỏi AI (khung nhỏ góc phải, mở rộng toàn màn hình được, tin người học bên phải, tin bên kia bên trái).

## Không làm

- **Không tự động gửi lỗi.** Lỗi chỉ được gửi khi người học bấm "Liên hệ admin" và bấm Gửi (người dùng đã chốt).
- Admin **không đọc được dữ liệu nào khác** của người học: lượt thi (`users/{uid}/attempts`), lịch sử Hỏi AI (`aiChats`, `localChats`), cài đặt (`aiSettings`) vẫn chỉ chủ tài khoản đọc được (người dùng đã chốt). Admin chỉ đọc nhánh hỗ trợ.
- Không gửi email, không thông báo đẩy (push notification), không gửi file/ảnh.
- Không có nhiều admin, không phân quyền admin trên giao diện.
- Không sửa hay xóa tin nhắn đã gửi.

## Không được xảy ra (anti-goals)

- Người A đọc hoặc ghi được cuộc trò chuyện của người B.
- Ai đó tự đăng ký Email/Mật khẩu bằng địa chỉ `buihngocanh2@gmail.com` (Firebase không bắt xác nhận email) mà thành admin.
- Lỗi bị gửi đi khi người học chưa bấm Gửi.
- Khung chat hỗ trợ đè lên khung Hỏi AI khiến cả hai không dùng được.

## Ràng buộc

- Web tĩnh trên GitHub Pages, Firebase Realtime Database + Auth, không có server/Cloud Function.
- Chỉ `src/sync/firebase.ts` import Firebase SDK (quy ước hiện tại); UI nhận store qua `useApp()` (`AppDeps`), test dùng bản giả không gọi mạng.
- Màn hình Thi thật dùng chữ tiếng Anh, các trang khác tiếng Việt (theo `english` như `AccountMenu`).
- Sau khi đổi `database.rules.json`, người dùng phải tự Publish rules trong Firebase Console (ghi vào `docs/firebase-setup.md`).

## Quyết định

### Nhận diện admin *(quyết định của Claude)*

Admin là người có `auth.token.email == 'buihngocanh2@gmail.com'` **và** `auth.token.email_verified == true`. Đăng nhập bằng Google thì email đã xác nhận; tài khoản Email/Mật khẩu tự đăng ký bằng địa chỉ đó thì `email_verified` là false nên không thành admin. Phía web dùng cùng điều kiện (từ `User.email` và `User.emailVerified` của Firebase Auth) để hiện "Hộp thư hỗ trợ" thay cho "Liên hệ admin"; rules là nơi kiểm tra thật. Địa chỉ admin để một hằng số trong code (vd `src/support/admin.ts`) và chép nguyên vào rules.

`SyncUser` cần thêm `email?: string` và `emailVerified?: boolean` (adapter Firebase điền từ `User.email`, `User.emailVerified`).

Lưu ý: khi `SyncState` là `'error'` hoặc đang ở form đăng nhập thì chưa có user, nên nút "Liên hệ admin" ở `AccountMenu` (lỗi) và `SignInDialog` luôn là link `mailto` (xem dưới).

### Dữ liệu *(quyết định của Claude)*

Hai nhánh mới ở gốc database, tách khỏi `users/` để rules của `users/` giữ nguyên:

- `support/{uid}/messages/{pushId}`: `{ from: 'user' | 'admin', text: string, at: number, error?: ErrorReport }`
  - `text` tối đa 4000 ký tự; có thể rỗng khi có `error`.
  - `at`: thời gian server (`serverTimestamp`).
  - `ErrorReport = { message: string (≤1000), code?: string (≤100), page: string (≤500, vd `#/exam/abc`), at: number }`.
- `supportIndex/{uid}`: `{ name: string (≤100), email?: string (≤200), updatedAt: number, last: string (≤80, tin cuối đã cắt), lastFrom: 'user' | 'admin', unreadByAdmin: boolean, unreadByUser: boolean }`
  - Admin đọc cả nhánh `supportIndex` để dựng danh sách mà không phải tải mọi tin nhắn.
  - Gửi tin = một lần `update` nhiều đường dẫn (tin mới + `supportIndex/{uid}`) để hai chỗ luôn khớp.

### Rules *(quyết định của Claude)*

Gọi `ADMIN` là `auth.token.email === 'buihngocanh2@gmail.com' && auth.token.email_verified === true`.

- `support/$uid`: đọc khi `auth.uid === $uid || ADMIN`.
- `support/$uid/messages/$id`: chỉ ghi khi chưa tồn tại (`!data.exists()`, không sửa/xóa); `from === 'user'` thì phải `auth.uid === $uid`; `from === 'admin'` thì phải `ADMIN`; kiểm tra kiểu và độ dài từng trường như trên; trường lạ bị từ chối.
- `supportIndex`: `.read` khi `ADMIN` (cả nhánh, để liệt kê).
- `supportIndex/$uid`: đọc khi `auth.uid === $uid || ADMIN`; ghi khi `auth.uid === $uid || ADMIN`; kiểm tra kiểu và độ dài.
- Không đổi gì trong `users/`.
- `supportIndex/$uid/email`: người học ghi thì phải bằng `auth.token.email` (không giả email trong hộp thư của admin).
- `supportIndex` có `.indexOn: ["updatedAt"]`.
- Cờ chưa đọc ghi vào đường dẫn con (`supportIndex/{uid}/unreadByAdmin`, `.../unreadByUser`) chứ không ghi đè cả bản ghi, để lần ghi của người học và của admin không xóa của nhau. Đánh dấu đã đọc khi chưa có bản ghi `supportIndex/{uid}` thì bỏ qua (không tạo bản ghi rỗng).
- Chống spam *(quyết định của Claude, nới lỏng, siết lại sau được)*: người học chỉ được ghi `supportIndex/$uid/updatedAt` mới khi nó lớn hơn giá trị cũ ít nhất 3 giây (khoảng 1 tin / 3 giây); `updatedAt` phải ≤ `now` + 60 giây. Admin không bị giới hạn.

### Giao diện phía người học

- **Menu tài khoản** (đã đăng nhập, không phải admin): thêm mục "💬 Liên hệ admin" / "💬 Contact admin". Có chấm báo khi `unreadByUser` là true *(quyết định của Claude)*.
- **Khung chat hỗ trợ**: cùng kiểu khung với Hỏi AI (dùng lại class CSS `gemini-dock`, `gemini__msg`… hoặc tách class chung). Tiêu đề "Liên hệ admin". Tin của admin bên trái, của mình bên phải. Mở khung thì đánh dấu `unreadByUser = false`. Realtime (nghe `onValue`).
- **Đính kèm lỗi**: khi mở từ nút "Liên hệ admin" ở chỗ báo lỗi, phía trên ô nhập hiện một thẻ "⚠ Lỗi đính kèm: <câu báo>" có nút ✕ để gỡ. Bấm Gửi thì tin đi kèm `error`; cho phép gửi khi chỉ có lỗi mà không có chữ. Tin có lỗi hiện phần lỗi (câu báo, mã, trang, giờ) trong bong bóng.
- **Một khung chat mỗi lúc** *(quyết định của Claude)*: mở khung hỗ trợ thì đóng khung Hỏi Gemini/Hỏi AI (dùng cơ chế `openListeners` sẵn có hoặc tương đương), và ngược lại. Câu trả lời AI đang chạy nền vẫn chạy tiếp như hiện nay.

### Nút "Liên hệ admin" ở các chỗ báo lỗi

Các chỗ hiện có (cần thêm nút, đính kèm đúng câu báo đang hiện):

| Chỗ | File | Lỗi |
|---|---|---|
| Lỗi đăng nhập / đọc cloud ở thanh trên | `AccountMenu.tsx` (`state.kind === 'error'`) | `state.message` |
| Form đăng nhập email | `SignInDialog.tsx` | câu báo trong form |
| Khung Hỏi AI/Gemini: gửi lỗi, tải/lưu lịch sử lỗi | `GeminiChat.tsx` (`failMessage`/`sendFailed`, `loadFailed`, `saveFailed`) | câu báo đang hiện |
| Popup ⚙ lưu lỗi | `LocalSettingsDialog.tsx` | "Không lưu được cài đặt…" |

Nên làm một component dùng chung (vd `<ContactAdminButton error={{ message, code? }} />`) và một chỗ điều phối mở khung hỗ trợ từ bất kỳ đâu (vd store nhỏ `openSupport(attachment?)` trong `AppDeps` hoặc module-level như `openListeners`).

- **Đã đăng nhập**: mở khung hỗ trợ với lỗi đính kèm.
- **Chưa đăng nhập hoặc không có Firebase** *(quyết định của Claude)*: nút là link `mailto:buihngocanh2@gmail.com` với tiêu đề "Lỗi trên web luyện thi SAA-C03" và nội dung gồm câu báo, mã lỗi, trang, thời gian (đã `encodeURIComponent`).
- Không gửi gì cho tới khi người học bấm Gửi (hoặc tự gửi email).

### Giao diện phía admin

- **Menu tài khoản** của admin: mục "📥 Hộp thư hỗ trợ" kèm số cuộc trò chuyện có `unreadByAdmin`. Admin không có mục "Liên hệ admin".
- Bấm vào: khung (cùng kiểu khung chat) hiện danh sách từ `supportIndex`, mới nhất trên đầu, mỗi dòng: tên, email, tin cuối, giờ, chấm chưa đọc. Bấm một dòng mở cuộc trò chuyện đó; có nút quay lại danh sách. Mở cuộc trò chuyện thì `unreadByAdmin = false`. Trả lời ghi `from: 'admin'`, đặt `unreadByUser = true`.
- Realtime cho danh sách và cuộc trò chuyện đang mở.

### Lỗi của chính khung hỗ trợ

Không gửi được tin (mất mạng, rules từ chối): giữ chữ trong ô nhập, báo "Không gửi được. Kiểm tra mạng rồi thử lại, hoặc gửi email tới buihngocanh2@gmail.com." kèm link `mailto` như trên.

## Kiểm thử

- Hàm thuần (dựng tin, cắt `last`, dựng nội dung `mailto`, kiểm tra admin) có test Vitest.
- UI test bằng store giả (như `fake-ai.ts`/`fake-sync.ts`): người học gửi tin có/không có lỗi; gỡ lỗi đính kèm; admin thấy danh sách, số chưa đọc, trả lời; nút "Liên hệ admin" ở từng chỗ báo lỗi mở khung với đúng lỗi; chưa đăng nhập thì ra `mailto`.
- **Rules**: muốn kiểm tra tự động cần Firebase Emulator (`firebase-tools` + Java) và `@firebase/rules-unit-testing`; repo hiện chưa có. Builder chọn: thêm emulator test (nếu máy có Java) hoặc ghi danh sách ca cần thử bằng **Rules Playground** trong Firebase Console vào `docs/firebase-setup.md`. Các ca bắt buộc: người A đọc/ghi `support/B` bị từ chối; người thường đọc `supportIndex` bị từ chối; tài khoản email chưa xác nhận trùng địa chỉ admin không đọc được `supportIndex`; người học ghi tin `from: 'admin'` bị từ chối; sửa tin đã có bị từ chối; admin đọc `users/B/attempts` bị từ chối.

## Để builder quyết định

- Tách component, tên file, cách dùng lại CSS của khung Hỏi AI.
- Cơ chế điều phối mở khung hỗ trợ từ nhiều chỗ.
- Giới hạn tải tin (vd chỉ 100 tin gần nhất) nếu thấy cần.
