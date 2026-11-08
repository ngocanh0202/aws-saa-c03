# Luyện thi AWS SAA-C03

Web tĩnh để luyện thi chứng chỉ **AWS Certified Solutions Architect – Associate (SAA-C03)**, dùng ngân hàng 500 câu hỏi. Đề bài và các lựa chọn giữ nguyên tiếng Anh như đề thật, còn phần hướng dẫn giải viết bằng tiếng Việt.

Web chạy thử tại: [exam-aws-ssa-03](https://ngocanh0202.github.io/aws-saa-c03/)

## Tính năng

- **Main: 12 đề cố định** lấy nguyên từ `question-doc-main`. Lựa chọn luôn xáo; thứ tự câu hỏi chỉ xáo khi bật công tắc trên trang chủ. Mỗi câu được gắn domain và có ghi chú review nếu phát hiện bất thường.
- **Sub: 7 đề, mỗi đề 65 câu.** Các domain chia theo tỉ lệ của đề thật (Secure 20 · Resilient 17 · High-Performing 15 · Cost 13), độ khó tăng dần từ Đề 1 đến Đề 7. Mỗi lượt thi đổi ngẫu nhiên 10 câu bằng câu dự phòng, rồi xáo thứ tự câu hỏi và lựa chọn.
- **Thi thật:** 130 phút (160 phút nếu bật ESL +30), giao diện tiếng Anh, chỉ xem được hướng dẫn sau khi nộp bài.
- **Thi thử:** không tính giờ, mở hướng dẫn được ngay tại từng câu.
- **Chấm điểm** theo thang 100–1000, đậu khi đạt từ 720 điểm. Có bảng phân tích theo domain cho từng lượt thi và từng đề.
- **Xem lại bài làm** kèm hướng dẫn tiếng Việt cho mọi câu, và ghi chú cho từng dịch vụ AWS.
- **Câu hỏi External:** các bộ câu hỏi luyện thêm lấy từ file HTML trong `external/`.
- **Đăng nhập Google, Email/Mật khẩu hoặc Facebook (tùy chọn):** đồng bộ lượt thi realtime giữa các thiết bị qua Firebase Realtime Database. Ví dụ đang làm trên máy tính thì mở điện thoại làm tiếp đúng lượt đó. Khi chưa đăng nhập, dữ liệu được lưu trong `localStorage`.

## Chạy ở máy

Cần Node.js 24 trở lên.

```bash
npm install
npm run dev
```

Mở địa chỉ mà terminal in ra (thường là `http://localhost:5173`).

### Bật đăng nhập Google và đồng bộ (tùy chọn)

Nếu không cấu hình bước này, web vẫn chạy đầy đủ, chỉ không có nút đăng nhập.

1. Cài đặt project Firebase theo [docs/firebase-setup.md](docs/firebase-setup.md): bật Google Sign-In, tạo Realtime Database, rồi dán [database.rules.json](database.rules.json) vào tab Rules.
2. Sao chép `.env.example` thành `.env.local` và điền 5 biến `VITE_FIREBASE_*`.
3. Chạy lại `npm run dev`.

## Lệnh

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Chạy web ở máy |
| `npm run build` / `npm run preview` | Build ra `dist/` / xem bản build |
| `npm test` | Chạy toàn bộ test (Vitest) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run check` | Chạy validate, test và typecheck (nên chạy trước khi commit) |
| `npm run parse` | Chuyển `question-doc-sub/` thành `data/questions.json` |
| `npm run main` | Chuyển `question-doc-main/` thành `data/main.json` |
| `npm run sets` | Sinh `data/sets.json` từ `data/meta` |
| `npm run validate` | Kiểm tra toàn bộ dữ liệu |
| `npm run external` | Chuyển `external/*.html` thành `data/external/*.json` |

## Cấu trúc thư mục

```
question-doc-main/  Bộ main: 12 đề cố định (JSON, HTML) — không sửa
question-doc-sub/   Bộ sub: ngân hàng 500 câu gốc (.md, .docx)
external/       Bộ câu hỏi External dạng HTML
data/           Dữ liệu cho web: questions.json, sets.json (sinh ra);
                meta/, vi/, services/ (soạn tay)
scripts/        Script sinh và kiểm tra dữ liệu (chạy bằng tsx)
src/engine/     Logic thi dạng hàm thuần: tạo lượt thi, chấm điểm, thống kê
src/storage/    Lưu lượt thi vào localStorage
src/sync/       Đồng bộ Firebase: controller, quy tắc gộp, adapter Firebase
src/pages/      Các trang (React, hash router)
docs/           Thiết kế, hướng dẫn soạn nội dung, hướng dẫn cài Firebase
```

## Deploy

Mỗi lần push lên `main`, GitHub Actions ([.github/workflows/pages.yml](.github/workflows/pages.yml)) chạy `npm run check`, build rồi deploy lên GitHub Pages. Muốn bản deploy có đăng nhập thì thêm 5 biến `VITE_FIREBASE_*` vào **Settings → Secrets and variables → Actions → Variables** của repo.

## Tài liệu

- [Thiết kế web](docs/superpowers/specs/2026-09-24-saa-c03-exam-site-design.md)
- [Thiết kế đồng bộ Firebase](docs/superpowers/specs/2026-11-02-firebase-sync-design.md)
- [Hướng dẫn cài Firebase](docs/firebase-setup.md)
- [Quy tắc soạn hướng dẫn tiếng Việt](docs/vi-style-guide.md)
- [Thang chấm độ khó](docs/difficulty-rubric.md)

## Setup Local AI trên kaggle (Thử nghiệm)
Sử dụng [Kaggle LM Studio](https://www.kaggle.com/code/buianh0202/kaggle-lmstudio) để deploy AI local trên session kaggle, thì sẽ lấy được API và model AI.
Chú ý:
- Session trên kaggle chỉ dùng được 12h
- Chỉ sử dụng được 30h/tuần, thứ 7 reset lại

## Lưu ý về nội dung

Ngân hàng câu hỏi được giữ nguyên, không thêm câu và không sửa đáp án gốc. Câu nào nghi ngờ đáp án thì được gắn cờ `review` kèm lý do. Đề thi chính thức có 15 câu không tính điểm, nhưng web chấm cả 65 câu.
