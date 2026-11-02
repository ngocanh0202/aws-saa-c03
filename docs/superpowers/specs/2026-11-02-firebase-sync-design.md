# Đồng bộ lượt thi bằng Firebase (đăng nhập Google) — Thiết kế

Ngày: 2026-11-02 · Bổ sung cho [spec gốc](2026-09-24-saa-c03-exam-site-design.md).

## Mục đích

Người dùng đang làm đề trên máy tính muốn mở điện thoại và **làm tiếp đúng lượt thi đó**, kể cả lượt Thi thật đang tính giờ. Hiện mọi dữ liệu chỉ nằm trong `localStorage` của từng trình duyệt nên không chuyển máy được.

Giải pháp: đăng nhập bằng tài khoản Google (Firebase Authentication), lưu lượt thi lên **Firebase Realtime Database** và đồng bộ trực tiếp giữa các thiết bị. Web vẫn là site tĩnh trên GitHub Pages, không có server riêng.

## Mục tiêu

1. **Chưa đăng nhập (chế độ khách):** chạy như hiện nay, chỉ dùng `localStorage`.
2. **Đã đăng nhập:** lượt thi được lưu trên Realtime Database và đồng bộ realtime. Một thay đổi ở máy này (chọn đáp án, gắn cờ, mở hướng dẫn, nộp bài, tạo lượt mới) hiện ngay trên máy khác đang mở, kể cả khi **cùng một lượt thi** đang mở trên cả hai máy.
3. `localStorage` vẫn giữ một bản sao của dữ liệu cloud. **Cloud luôn thắng:** khi đã đăng nhập, dữ liệu từ cloud ghi đè lên `localStorage`.
4. **Đăng nhập lần đầu trên máy có dữ liệu khách khác với cloud:** hỏi người dùng trước khi ghi đè (xem "Xung đột khi đăng nhập").
5. **Đăng xuất:** giữ nguyên dữ liệu trong `localStorage`, máy đó tiếp tục dùng ở chế độ khách.
6. **Đồng hồ Thi thật chạy theo giờ thực:** `endsAt` là mốc tuyệt đối. Thời gian chuyển máy hay tắt máy vẫn bị trừ. Hết giờ trên máy nào thì lượt đó bị nộp ở mọi máy.
7. Hướng dẫn từng bước để cài đặt project Firebase (người dùng đã có project nhưng chưa cài gì).

## Không làm

- Không đồng bộ giao diện sáng/tối (`theme`). Mỗi máy giữ lựa chọn riêng.
- Không đưa nội dung đề, hướng dẫn hay ngân hàng câu hỏi lên Firebase. Mỗi lượt thi đã lưu sẵn danh sách câu được bốc (`questions[]`: `qid`, `domain`, `optionOrder`), `seed` và `endsAt`. Nội dung câu hỏi được build sẵn trong web, nên chỉ cần bản ghi `Attempt` là dựng lại được đúng đề random trên máy khác.
- Không có trang External, thống kê hay chia sẻ giữa nhiều người dùng. Không có phương thức đăng nhập nào ngoài Google.
- Không gộp từng trường khi hai máy cùng sửa một lượt thi tại cùng một thời điểm (xem "Hạn chế đã chấp nhận").

## Những điều tuyệt đối không được xảy ra

- Mất lượt thi của người dùng mà họ không đồng ý. Ví dụ: tự động xóa dữ liệu khách khi đăng nhập, hay xóa `localStorage` khi đăng xuất.
- Một người đọc hoặc ghi được dữ liệu của người khác.
- Thiếu cấu hình Firebase (chạy `npm run dev` không có biến môi trường, hay chạy test) làm web hỏng. Khi thiếu cấu hình, web chạy như hiện nay và ẩn nút đăng nhập.
- Câu hỏi bị bốc lại hoặc thứ tự lựa chọn bị đổi khi mở lượt thi trên máy khác.

## Hiện trạng (để người làm định hướng)

- `src/storage/storage.ts`: `AttemptStore` là API **đồng bộ** (`list`, `get`, `save`, `available`), lưu toàn bộ lượt thi vào một key `saa-c03:attempts:v1` dưới dạng `{ [id]: Attempt }`.
- `src/main.tsx` tạo store một lần và đưa vào `AppDeps` (`src/app/context.tsx`). Các trang gọi trực tiếp `store.get/list/save`. Ví dụ, `ExamPage` đọc lượt thi một lần vào `useState`, và **không trang nào lắng nghe thay đổi**.
- `finalizeExpiredRealAttempts` (`src/storage/finalize.ts`) nộp các lượt Thi thật đã hết giờ khi trang được mở.
- Thống kê được tính lại từ các lượt thi, nên đồng bộ lượt thi là đủ.
- Deploy: `.github/workflows/pages.yml` build bằng Vite rồi đẩy lên GitHub Pages.

## Thiết kế

### Mô hình dữ liệu trên Realtime Database

```
/users/{uid}/attempts/{attemptId} = {
  json: string,        // JSON.stringify(Attempt)
  updatedAt: number    // ms, đồng hồ đã hiệu chỉnh theo server (xem "Thời gian")
}
```

Lưu `Attempt` dưới dạng **chuỗi JSON** là quyết định của tôi. Lý do: Realtime Database tự đổi object có key là số (`answers: Record<number, string[]>`) thành mảng và bỏ mảng rỗng, nên bản ghi nhận về sẽ không còn giống bản đã gửi. Lượt thi luôn được ghi và đọc nguyên khối, nên không mất gì khi lưu dạng chuỗi. Khi đọc vẫn kiểm tra bằng `looksLikeAttempt`.

**Security rules** (đưa vào repo dưới tên `database.rules.json` và dán vào console theo hướng dẫn):

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "attempts": {
          "$attemptId": {
            ".validate": "newData.hasChildren(['json', 'updatedAt']) && newData.child('json').isString() && newData.child('json').val().length < 200000 && newData.child('updatedAt').isNumber()"
          }
        },
        "$other": { ".validate": false }
      }
    }
  }
}
```

### Store có thể lắng nghe thay đổi

Mở rộng `AttemptStore`, giữ API đồng bộ hiện có để không phải viết lại các trang:

- `list()`, `get(id)`, `save(attempt)`, `available`: giữ nguyên. Hàm đọc lấy dữ liệu từ bộ nhớ, và bộ nhớ luôn phản chiếu `localStorage`, cùng với cloud khi đã đăng nhập.
- Thêm `subscribe(listener): () => void`. Listener được gọi mỗi khi tập lượt thi thay đổi: dữ liệu từ cloud đổ về, một tab khác ghi vào `localStorage` (sự kiện `storage`), hoặc chính tab này gọi `save`.
- Thêm hook `useAttempts()` / `useAttempt(id)` (dùng `useSyncExternalStore`) để `HomePage`, `ExamPage`, `ResultPage`, `SetStats`… tự vẽ lại khi có thay đổi. `ExamPage` phải hiện ngay đáp án chọn từ máy khác và chuyển sang trang kết quả nếu lượt thi bị nộp ở máy khác.

Lớp đồng bộ tách khỏi Firebase SDK qua một interface nhỏ, chẳng hạn `RemoteAttempts { subscribe(uid, onChange), write(uid, attempt, updatedAt) }`. Nhờ vậy test dùng bản giả trong bộ nhớ, không gọi mạng. Logic quyết định (gộp, cloud thắng, phát hiện xung đột) viết thành hàm thuần có test, giống phong cách của `src/engine/`.

### Luồng khi đã đăng nhập

1. `onAuthStateChanged` báo có `uid`, store chuyển sang chế độ đồng bộ và mở listener trên `/users/{uid}/attempts` (dùng `onChildAdded/Changed/Removed` hoặc `onValue`, tùy người làm chọn).
2. **Cloud → máy:** mỗi bản ghi nhận về được ghi đè vào bộ nhớ và `localStorage` (cloud thắng), rồi phát `subscribe`.
3. **Máy → cloud:** `save(attempt)` ghi ngay vào bộ nhớ và `localStorage` để giao diện phản hồi tức thì, rồi gửi `write` lên cloud. Firebase SDK tự xếp hàng các lần ghi khi mất mạng và gửi lại khi có mạng (trong cùng một phiên trang).
4. Tránh vòng lặp: bản ghi nhận về giống hệt bản đang có (so `json`) thì bỏ qua.
5. `finalizeExpiredRealAttempts` vẫn chạy như cũ. Nó gọi `save`, nên bản đã nộp cũng được đẩy lên cloud.

### Xung đột khi đăng nhập

Mỗi lượt thi trong `localStorage` được gắn thêm `owner`: `uid` nếu bản ghi đến từ (hoặc đã được đẩy lên) tài khoản đó, bỏ trống nếu được tạo ở chế độ khách. `owner` lưu cạnh bản ghi, ví dụ trong một key phụ `saa-c03:owners:v1`, không thêm vào kiểu `Attempt`.

Khi đăng nhập với `uid`, ngay sau lần đọc cloud đầu tiên:

- **Không có xung đột:** mọi lượt thi trong `localStorage` đều có `owner === uid` hoặc đã tồn tại trên cloud với nội dung giống hệt. Lúc này chỉ áp dụng "cloud thắng" và không hỏi gì.
- **Lượt thi của tài khoản khác** (`owner` là một uid khác): không phải xung đột và không bao giờ bị xóa, đẩy lên hay hỏi. Khi đang đăng nhập bằng tài khoản khác, chúng bị **ẩn** khỏi `list()`/`get()` (Home, thống kê, trang kết quả), và hiện lại khi chủ của chúng đăng nhập (bạn quyết định). Ở chế độ khách, lượt thi khách và lượt thi của mọi tài khoản đã từng đăng nhập trên máy đều hiện như hiện nay.
- **Có xung đột:** có lượt thi khách (không có owner) mà cloud không có, hoặc cloud có nhưng nội dung khác. Hiện hộp thoại tiếng Việt cho biết số lượt thi bị ảnh hưởng, với hai lựa chọn:
  - **"Dùng dữ liệu trên cloud"**: xóa các lượt thi khách đó khỏi `localStorage`, rồi lấy dữ liệu cloud.
  - **"Đưa dữ liệu trên máy này lên tài khoản"**: đẩy các lượt thi khách lên cloud. Lượt nào trùng id với cloud thì vẫn giữ bản cloud. Xong thì gắn `owner = uid`.
  - Hộp thoại **bắt buộc chọn** (không có nút đóng, không đóng được bằng Esc hay bấm ra ngoài). Đồng bộ chỉ bắt đầu sau khi người dùng chọn, nên không có trạng thái "chưa quyết định". Nếu người dùng tải lại trang trước khi chọn thì chưa có gì thay đổi, và hộp thoại hiện lại.

Tên hai nút, việc có nút thứ hai và việc hộp thoại bắt buộc chọn là quyết định của tôi. Bạn nói "hỏi người dùng có muốn ghi đè không", nên nút thứ hai là phương án "không ghi đè" để không bao giờ mất dữ liệu.

Lượt thi khách có id ngẫu nhiên (UUID), nên thực tế gần như không bao giờ trùng id với cloud. Trường hợp "cùng id, khác nội dung" xử lý theo quy tắc gộp bên dưới, không ghi đè trước khi người dùng chọn.

### Quy tắc gộp một lượt thi (hàm thuần, có test)

Khi cùng một id có cả bản trên máy lẫn bản trên cloud:

1. **Đã nộp là trạng thái cuối:** bản `submitted` luôn thắng bản `in-progress`, bất kể `updatedAt`. Nhờ vậy, máy offline có bản cũ đang làm dở không thể "hồi sinh" một lượt đã nộp hay đã hết giờ ở máy khác (mục tiêu 6). Đây là quyết định của tôi.
2. Ngoài trường hợp đó, bản có `updatedAt` mới hơn sẽ thắng. Nếu bằng nhau thì cloud thắng.
3. Lượt thi có `owner = uid` trên máy mà cloud không có (do ghi offline rồi đóng tab) thì **đẩy lên cloud**, không xóa. Web không có chức năng xóa lượt thi, nên cũng không áp dụng việc xóa từ cloud xuống máy. Đây là quyết định của tôi.

### Đăng xuất

Gọi `signOut`, đóng listener và giữ nguyên `localStorage`. Các bản ghi vẫn mang `owner = uid`, nên khi đăng nhập lại đúng tài khoản đó thì không bị coi là xung đột. Các lượt thi tạo sau khi đăng xuất là lượt thi khách (không có owner).

### Thời gian

Đồng hồ máy tính và điện thoại có thể lệch nhau. Khi đã đăng nhập, `now()` trong `AppDeps` dùng `Date.now() + serverTimeOffset` (đọc từ `.info/serverTimeOffset`), để mọi máy thấy cùng một thời điểm hết giờ của `endsAt`. Khi chưa đăng nhập thì giữ `Date.now()`. Đây là quyết định của tôi.

### Giao diện

- Header (`Layout.tsx`), cạnh nút đổi giao diện: chưa đăng nhập thì có nút **"Đăng nhập Google"**. Đã đăng nhập thì hiện ảnh đại diện hoặc tên, kèm menu có mục **"Đăng xuất"**. Màn hình Thi thật dùng tiếng Anh ("Sign in with Google" / "Sign out"), giống quy ước hiện có.
- Một dấu trạng thái nhỏ: "Đã đồng bộ" / "Đang đồng bộ…" / "Mất kết nối, sẽ đồng bộ khi có mạng" (đọc từ `.info/connected`).
- Hộp thoại xung đột khi đăng nhập như mô tả ở trên.
- Đăng nhập bằng `signInWithPopup`. Đây là quyết định của tôi: `signInWithRedirect` không ổn định trên domain không phải Firebase Hosting như `github.io`. Nếu popup bị chặn thì báo lỗi rõ ràng.

### Cấu hình và deploy

- Thêm dependency `firebase` (modular SDK v10+, chỉ import `app`, `auth`, `database`).
- Đọc cấu hình từ biến môi trường Vite: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. Thêm `.env.example`, và `.env.local` nằm trong `.gitignore`. Thiếu biến nào thì tắt đồng bộ, ẩn nút đăng nhập, web vẫn chạy.
- Các giá trị này là cấu hình web công khai, không phải bí mật. Bảo mật nằm ở security rules. Trong `pages.yml`, đưa chúng vào bước build từ **GitHub repository variables** (`vars.*`).
- Test (Vitest) không bao giờ khởi tạo Firebase thật.

### Hướng dẫn cài đặt Firebase (viết vào `docs/firebase-setup.md`)

1. Console → Project → **Add app → Web**, rồi lấy object cấu hình.
2. **Authentication → Sign-in method → Google → Enable.** Ở mục **Authorized domains**, thêm `<user>.github.io` (`localhost` có sẵn).
3. **Realtime Database → Create database**, chọn region (ví dụ `asia-southeast1`), bắt đầu ở *locked mode*, rồi dán `database.rules.json` vào tab Rules và bấm Publish.
4. Tạo `.env.local` theo `.env.example` để chạy ở máy.
5. GitHub repo → Settings → Secrets and variables → Actions → **Variables**: thêm các biến `VITE_FIREBASE_*`.
6. Kiểm tra: đăng nhập trên hai trình duyệt, làm bài ở một bên và thấy bên kia cập nhật.

## Hạn chế đã chấp nhận

- **Ghi đè theo cả lượt thi, bản ghi sau thắng.** Hai máy cùng sửa *cùng một lượt thi* trong vòng vài trăm mili giây thì có thể một thay đổi bị mất. Người dùng chỉ làm bài trên một máy tại một thời điểm, nên tình huống này hiếm.
- Mất mạng rồi đóng tab trước khi có mạng lại: thay đổi vẫn còn trong `localStorage` máy đó và được đẩy lên ở lần mở sau, theo "Quy tắc gộp". Vì vậy key phụ trong `localStorage` lưu cả `owner` lẫn `updatedAt` của từng lượt thi. Đây là quyết định của tôi.

## Để người làm quyết định

- Dùng `onValue` hay `onChild*`, và cách tổ chức file trong `src/storage/` / `src/sync/`.
- Giao diện cụ thể của nút đăng nhập, menu tài khoản và hộp thoại, miễn là theo phong cách CSS hiện có.
- Có tải Firebase SDK theo kiểu lazy (`import()`) hay không.
- Cập nhật `CLAUDE.md` (mục Kiến trúc) và spec gốc (mục lưu trữ) để phản ánh thay đổi.
