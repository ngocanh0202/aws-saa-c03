# AI tô từ khóa + tin nhắn gợi ý tiếp theo trong chat AI

Ngày: 2026-11-11 · Liên quan: [2026-11-11-practice-highlight-notes-design.md](2026-11-11-practice-highlight-notes-design.md)

## Mục đích

Người học đang làm một câu ở Thi thử và mở khung chat AI (Gemini hoặc AI thử nghiệm). Họ muốn được AI
**gợi ý để tự chọn đúng đáp án**, không phải được đọc đáp án:

1. AI **tự tô các từ khóa then chốt** trong đề (vd "least operational overhead", "without code changes",
   "within 1 hour") để người học nhìn ra đề đang đòi gì.
2. Sau mỗi câu trả lời, AI **gợi ý 2–3 câu hỏi tiếp theo** (tin nhắn gợi ý, bấm là gửi), giúp người học
   đi tiếp từng bước tới đáp án.

## Mục tiêu

- Tool mới cho AI: tô cụm chữ trong đề bài/dòng câu hỏi của câu đang chat.
- Thêm gợi ý cố định "Tô từ khóa quan trọng trong đề" vào danh sách gợi ý có sẵn (`src/ai/suggestions.ts`).
- AI tự sinh 2–3 câu hỏi tiếp theo sau mỗi câu trả lời, **không trùng** các gợi ý cố định
  (vd "Dịch đề và các lựa chọn sang tiếng Việt", "Đề này đang hỏi gì?", "Gợi ý cách loại trừ lựa chọn sai").

## Không làm

- AI **không tạo ghi chú** khi tô: đoạn tô có `note` rỗng. (Người học quyết định rõ: "không cần ghi chú, chỉ tô thôi".)
- Không có nút "Gợi ý" riêng; "gợi ý" ở đây là tin nhắn gợi ý trong vùng "Gợi ý" có sẵn của khung chat.
- Không gọi thêm lượt AI nào chỉ để sinh gợi ý.

## Điều không được xảy ra (anti-goals)

- Lộ đáp án trước khi bấm "Xem hướng dẫn": cả đoạn tô lẫn câu gợi ý không được ngầm chỉ lựa chọn đúng
  (không có gợi ý kiểu "Có phải đáp án là S3 không?"). Giữ nguyên luật hiện có của `buildSystemPrompt`.
  Gợi ý cách loại trừ lựa chọn sai vẫn được (đã có sẵn trong gợi ý cố định).
- AI xóa hay làm hỏng đoạn tô / ghi chú người học đã có.
- AI tô ở Thi thật, hay tô ở nơi không hiện highlight.

## Thiết kế

### 1. Tool `highlight_keywords`

- Khai báo qua `AiTool` (`src/ai/types.ts`), chạy được cả Gemini (`tool-loop.ts`) lẫn AI thử nghiệm (`local.ts`).
  Tham số là chuỗi (giới hạn của `AiTool.params`): `phrases` — các cụm cần tô, **mỗi cụm một dòng**, chép
  nguyên văn từ đề bài hoặc dòng câu hỏi.
- **Chỉ có tool này** khi câu đang chat thuộc lượt **Thi thử đang làm** (`mode === 'practice' && status === 'in-progress'`),
  vì highlight chỉ hiện ở đó. Trang xem lại (`ResultPage`), Thi thật, câu từ lượt đã nộp: không có tool.
  Khi chạy, tool kiểm tra lại điều kiện; không còn đúng thì trả lỗi cho mô hình, không ghi gì.
- Cách tô mỗi cụm:
  - Tìm trong văn bản thuần của `stem` rồi `prompt` (cùng cách tính với `partText` ở `NotesPage.tsx`, tức
    textContent mà Highlighter đo offset; tách hàm này ra dùng chung). So khớp không phân biệt hoa/thường và
    coi mọi khoảng trắng liên tiếp là một; lấy lần xuất hiện đầu tiên.
  - Cụm chồng lên đoạn đã tô (của người học hay AI) thì **bỏ qua**, không gộp — để không làm đổi đoạn người học đã tô.
  - Thêm bằng `addHighlight` với `note` rỗng, lưu vào `NotesStore` theo `bank.canonical(qid)` (như Highlighter),
    nên tự đồng bộ Firebase, hiện ngay trong đề (Highlighter đã subscribe store) và ở trang Ghi chú.
  - Tối đa 8 cụm mỗi lần gọi; cụm rỗng hoặc dài quá 120 ký tự bỏ qua.
  - Kết quả trả về mô hình: `{ highlighted: string[], skipped: string[], notFound: string[] }` để AI nói lại cho người học
    (vd "đã tô 4 cụm").
- Prompt: thêm dòng hướng dẫn khi có tool — khi người học nhờ tô từ khóa/gợi ý thì gọi `highlight_keywords` với các cụm
  quyết định yêu cầu của đề (ràng buộc chi phí, vận hành, thời gian, quy mô, bảo mật…), sau đó giải thích ngắn vì sao các
  cụm đó quan trọng; không tô các lựa chọn; chưa xem hướng dẫn thì không suy ra đáp án.
- Dòng chờ khi đang chạy tool: dùng chung cơ chế `onToolCall`, chữ "Đang tô từ khóa…".

### 2. Gợi ý cố định mới

- `chatSuggestions` thêm "Tô từ khóa quan trọng trong đề" — **chỉ khi tool có mặt** (thêm tham số cho biết).
  Vị trí: sau "Đề này đang hỏi gì?".

### 3. Câu hỏi tiếp theo do AI sinh

- Prompt dặn: cuối mỗi câu trả lời, viết một dòng đánh dấu riêng rồi 2–3 câu hỏi tiếp theo ngắn (≤ 100 ký tự),
  mỗi câu một dòng bắt đầu bằng "- ", viết như lời người học hỏi, giúp đi tiếp tới đáp án mà không nói đáp án
  (khi chưa xem hướng dẫn), và **không lặp lại** các gợi ý cố định — prompt liệt kê các gợi ý cố định của câu này.
  Dấu tách là `<<GOI_Y>>` (mã cố định, dễ tách, khó trùng nội dung thật).
- Tách ở client (hàm thuần, có test): phần trước dấu là nội dung trả lời; phần sau là danh sách gợi ý (lấy tối đa 3,
  bỏ dòng rỗng, cắt 100 ký tự). Khi đang stream, chữ từ dấu tách trở đi (kể cả phần đầu dở dang của dấu, vd `<<GO`)
  **không hiện** ra khung chat.
- Lưu: `ChatMessage` thêm `suggestions?: string[]` trên tin của AI. `text` chỉ chứa phần trả lời (không có dấu tách),
  nên lịch sử gửi lại cho AI và bản tóm tắt danh sách chat không dính gợi ý. JSON lưu trong `aiChats`/`localChats`
  là chuỗi nên rules không đổi; `parseChat` cần bỏ qua `suggestions` sai kiểu thay vì loại cả cuộc chat.
- Hiển thị: trong vùng "Gợi ý" hiện có, **gợi ý của AI từ tin trả lời mới nhất** đứng trước, sau đó các gợi ý cố định.
  Lọc gợi ý AI: bỏ câu giống ≥ 85% (`similarity`, `SIMILAR_THRESHOLD`) một gợi ý cố định của câu này hoặc một câu
  người học đã hỏi; bỏ trùng nhau. Bấm thì gửi như gợi ý cố định. Khóa khi AI đang chạy/cooldown như hiện tại.
- Câu trả lời dùng lại từ cache (`findCachedReply`) mang theo `suggestions` của tin gốc.
- Không có dấu tách (AI quên) → không có gợi ý AI, mọi thứ khác bình thường.
- Đổi trạng thái `revealed` thì phiên chat mới (như hiện tại); gợi ý tạo khi chưa xem hướng dẫn vẫn được hiện sau khi
  xem (không lộ gì thêm).

## Ràng buộc

- Không sửa đáp án/câu hỏi; không đưa đáp án vào prompt khi chưa xem hướng dẫn (giữ nguyên).
- Cả hai AI (Gemini, AI thử nghiệm) phải chạy được tool và định dạng gợi ý.
- `npm run check` xanh; test UI dùng `src/test/fake-ai.ts`.
- Cập nhật `CLAUDE.md` (mục `src/ai/`).

## Quyết định của người viết (sau vòng kiểm tra)

- Tool có cả khi **chưa** xem hướng dẫn — đó chính là lúc cần gợi ý; nó chỉ tô chữ người học đã thấy.
- Văn bản để đo offset: tách `partText` của `NotesPage.tsx` thành hàm dùng chung (ví dụ trong `src/notes/`), dùng
  cho cả trang Ghi chú và tool. Câu main (`html: true`) lấy textContent qua phần tử DOM tạm như hiện tại (tool chạy
  ở trình duyệt nên có `document`).
- Tool được dựng trong `GeminiChat` (giống `createSearchTool`), đóng gói `notes` store, `bank.canonical`, lượt thi và qid;
  không thêm dependency mới vào `AppDeps`.
- "Câu người học đã hỏi" khi lọc gợi ý AI = các tin người học trong cuộc chat đang mở (mảng `messages` hiện tại).
- Highlight có `note` rỗng đã là trạng thái bình thường (người học tô mà chưa ghi chú); không cần xử lý riêng.

## Để lại cho người làm

- Tên file/hàm cụ thể (vd `src/ai/highlight-tool.ts`, `src/ai/followups.ts`).
- Chữ chính xác của dòng prompt và kiểu chữ CSS của gợi ý AI (có thể giống hệt gợi ý cố định).
