# Hướng dẫn soạn nội dung tiếng Việt (`data/vi`)

Người học đọc phần này **sau khi** làm câu hỏi bằng tiếng Anh. Mục tiêu: hiểu đề nói gì, vì sao đáp án đúng, và vì sao từng lựa chọn còn lại sai, để lần sau tự nhận ra.

## Quy tắc bắt buộc

1. **Không sửa đáp án, không thêm câu.** Nhãn `Đúng`/`Sai` trên web lấy từ đáp án gốc. Vẫn viết `reason` theo đáp án gốc, nhưng thêm `"review": { "reason": "..." }` (từ 2026-10-30) khi:
   - đáp án gốc sai hoặc đã lỗi thời theo tài liệu AWS hiện hành: `reason` bắt đầu bằng `Đáp án có thể sai: `, nêu lựa chọn (theo nội dung) có vẻ đúng hơn và vì sao;
   - đáp án gây tranh cãi, đề mơ hồ, dựa trên giả định cũ, hoặc có hai lựa chọn cùng bảo vệ được: `reason` bắt đầu bằng `Chưa chắc chắn: `, nêu điểm còn tranh cãi.
   Nêu căn cứ cụ thể (tính năng, giới hạn, ngày ngừng hỗ trợ…); không gắn cờ chỉ vì đề khó.
2. **Không dùng chữ cái để chỉ lựa chọn** trong `reason`, `explanationVi`, `keyHint`, `review.reason`: thứ tự lựa chọn bị xáo mỗi lượt thi. Không viết "đáp án A", "phương án B", "chọn C", "câu D", "A và B", "(E)". Nói theo nội dung: "cách dùng Athena", "phương án tự viết Lambda", "lựa chọn dùng S3 Glacier Deep Archive". `npm run validate` sẽ báo lỗi nếu lọt.
3. **Mỗi lựa chọn đều có `reason`** (1–3 câu):
   - Lựa chọn đúng: nói nó thỏa **từng** yêu cầu trong đề ra sao.
   - Lựa chọn sai: nêu lý do cụ thể — vi phạm yêu cầu nào, tốn công vận hành/chi phí hơn ở chỗ nào, hay không làm được về kỹ thuật. Không viết chung chung kiểu "không phù hợp".
4. **Thuật ngữ:** tên service và thuật ngữ AWS giữ nguyên tiếng Anh (S3 bucket, VPC endpoint, IAM role, security group, Multi-AZ, read replica, Auto Scaling group…). Cụm từ khóa của đề dịch kèm bản gốc trong ngoặc:

   | Tiếng Anh | Dịch |
   |---|---|
   | LEAST operational overhead | ít công vận hành nhất (LEAST operational overhead) |
   | MOST cost-effective / MOST cost-efficient | tiết kiệm chi phí nhất (MOST cost-effective) |
   | MOST operationally efficient | hiệu quả vận hành nhất (MOST operationally efficient) |
   | highly available | có tính sẵn sàng cao (highly available) |
   | fault tolerant | chịu lỗi (fault tolerant) |
   | durable / durability | độ bền dữ liệu (durability) |
   | scalable | có khả năng mở rộng (scalable) |
   | decouple | tách rời (decouple) |
   | with the LEAST amount of changes / minimal changes | ít thay đổi nhất |
   | (Choose two.) / (Choose three.) | (Chọn hai.) / (Chọn ba.) |

   "solutions architect", "company", tên riêng, số liệu và đơn vị giữ nguyên nghĩa và giá trị.

## Từng trường

- `id`: số câu.
- `stemVi`: dịch đầy đủ đoạn đề, giữ ngắt đoạn bằng `\n\n` như bản gốc. Đề gốc trống (chỉ có câu hỏi) thì để `""`.
- `promptVi`: dịch câu hỏi in đậm, kể cả phần "(Chọn hai.)".
- `options`: đủ mọi lựa chọn, `key` là **nhãn gốc** (A, B, C… đúng như bản gốc), sắp theo `key`. `textVi` dịch sát nghĩa lựa chọn. Tên cũ của service (ví dụ Amazon Elasticsearch Service) giữ như bản gốc; có thể nhắc tên mới trong `reason`.
- `explanationVi`: 2–5 câu: yêu cầu then chốt của đề → vì sao (các) lựa chọn đúng thắng → bẫy thường gặp. `GIẢI THÍCH GỐC` chỉ là ghi chú ngắn, thường dùng chữ cái: dùng làm gợi ý, viết lại, sửa và bổ sung khi cần.
- `keyHint`: 1 câu: trích (các) từ khóa tiếng Anh trong đề trong ngoặc kép → service/mẫu kiến trúc cần nghĩ tới.
- `review`: chỉ khi cần (xem quy tắc 1).

## Câu trùng

Các cặp câu trùng nguyên văn: 159/218, 246/253, 278/336, 393/476. Câu số lớn hơn chép **nguyên** bản dịch của câu số nhỏ hơn, chỉ đổi `id` (`npm run vi:show` in nhắc "TRÙNG với câu …"). `npm run validate` báo lỗi nếu hai bản khác nhau.

## Định dạng file và quy trình mỗi lô

1. `npm run vi:show -- <câu đầu lô>` (1, 26, 51, …, 476) để xem 25 câu của lô.
2. Soạn `data/vi/qSSS-EEE.json` (tên file in ở dòng đầu kết quả `vi:show`): một mảng JSON đúng 25 phần tử, sắp theo `id`, thụt lề 2 dấu cách, UTF-8, xuống dòng ở cuối file.
3. `npm run validate` phải `0 lỗi`. Cảnh báo `N câu chưa có bản dịch tiếng Việt` giảm đi 25; cảnh báo `được gắn cờ review` liệt kê các câu đã gắn cờ.
4. Commit riêng từng lô: `content(vi): questions SSS-EEE`.

## Ví dụ mẫu

Câu 1 (một đáp án):

```json
{
  "id": 1,
  "stemVi": "Một công ty cho thuê xe đạp đang xây dựng kiến trúc nhiều tầng (multi-tier) để theo dõi vị trí xe đạp trong giờ cao điểm. Công ty muốn dùng các điểm dữ liệu này trong nền tảng phân tích (analytics platform) hiện có. Solutions architect phải chọn phương án multi-tier khả thi nhất cho kiến trúc này. Các điểm dữ liệu phải truy cập được qua REST API.",
  "promptVi": "Hành động nào đáp ứng các yêu cầu này cho việc lưu trữ và truy xuất dữ liệu vị trí?",
  "options": [
    { "key": "A", "textVi": "Dùng Amazon Athena với Amazon S3.", "reason": "Athena chạy truy vấn SQL trên dữ liệu đã nằm sẵn trong S3; nó không nhận dữ liệu vị trí gửi liên tục và không cung cấp REST API để thu thập dữ liệu." },
    { "key": "B", "textVi": "Dùng Amazon API Gateway với AWS Lambda.", "reason": "API Gateway đáp ứng yêu cầu REST API, nhưng Lambda chỉ xử lý từng request riêng lẻ, không phải lớp phân tích luồng dữ liệu liên tục để đưa vào nền tảng phân tích." },
    { "key": "C", "textVi": "Dùng Amazon QuickSight với Amazon Redshift.", "reason": "QuickSight là công cụ trực quan hóa và Redshift là kho dữ liệu; cặp này phục vụ báo cáo, không có REST API để nhận dữ liệu vị trí theo thời gian thực." },
    { "key": "D", "textVi": "Dùng Amazon API Gateway với Amazon Kinesis Data Analytics.", "reason": "API Gateway cung cấp REST API để nhận dữ liệu vị trí, còn Kinesis Data Analytics xử lý luồng dữ liệu theo thời gian thực và đưa kết quả vào nền tảng phân tích — khớp cả hai yêu cầu." }
  ],
  "explanationVi": "Theo dõi vị trí liên tục trong giờ cao điểm tạo ra dữ liệu streaming. Cần một lớp nhận dữ liệu qua REST API (API Gateway) và một lớp phân tích luồng theo thời gian thực (Kinesis Data Analytics). Các cách chỉ có truy vấn trên dữ liệu đã lưu hoặc chỉ có công cụ báo cáo đều thiếu phần thu thập qua REST API.",
  "keyHint": "\"track the location ... during peak operating hours\" + \"accessible from the REST API\" → dữ liệu streaming đi qua API Gateway vào Kinesis."
}
```

Câu 4 (chọn hai):

```json
{
  "id": 4,
  "stemVi": "Một công ty tạo ra dữ liệu batch từ nhiều cơ sở dữ liệu khác nhau. Công ty cũng tạo ra dữ liệu stream trực tiếp từ các cảm biến mạng và API của ứng dụng. Công ty cần gom toàn bộ dữ liệu về một nơi để phân tích kinh doanh. Công ty cần xử lý dữ liệu đầu vào rồi stage dữ liệu vào các Amazon S3 bucket khác nhau. Sau đó các nhóm sẽ chạy truy vấn một lần (one-time queries) và nhập dữ liệu vào công cụ business intelligence để hiển thị các chỉ số KPI.",
  "promptVi": "Tổ hợp bước nào đáp ứng các yêu cầu này với ít công vận hành nhất (LEAST operational overhead)? (Chọn hai.)",
  "options": [
    { "key": "A", "textVi": "Dùng Amazon Athena cho các truy vấn một lần. Dùng Amazon QuickSight để tạo dashboard KPI.", "reason": "Athena truy vấn trực tiếp dữ liệu trong S3 mà không cần dựng máy chủ, rất hợp với truy vấn một lần; QuickSight tạo dashboard KPI và được quản lý hoàn toàn — ít công vận hành." },
    { "key": "B", "textVi": "Dùng Amazon Kinesis Data Analytics cho các truy vấn một lần. Dùng Amazon QuickSight để tạo dashboard KPI.", "reason": "Kinesis Data Analytics dành cho xử lý luồng theo thời gian thực, không phải công cụ chạy truy vấn một lần trên dữ liệu đã lưu trong S3." },
    { "key": "C", "textVi": "Tạo các hàm AWS Lambda tự viết để chuyển từng bản ghi từ các cơ sở dữ liệu sang một Amazon Redshift cluster.", "reason": "Tự viết Lambda chuyển từng bản ghi tốn công phát triển và vận hành, lại đưa dữ liệu vào Redshift thay vì stage trong các S3 bucket như đề yêu cầu." },
    { "key": "D", "textVi": "Dùng một AWS Glue ETL job (extract, transform, load) để chuyển dữ liệu sang định dạng JSON. Nạp dữ liệu vào nhiều Amazon OpenSearch Service (Amazon Elasticsearch Service) cluster.", "reason": "Nạp vào nhiều cluster OpenSearch buộc phải vận hành thêm cluster và không stage dữ liệu trong S3 như yêu cầu, nên tốn công hơn." },
    { "key": "E", "textVi": "Dùng blueprint trong AWS Lake Formation để xác định dữ liệu có thể nạp vào data lake. Dùng AWS Glue để crawl nguồn, trích xuất dữ liệu và nạp vào Amazon S3 ở định dạng Apache Parquet.", "reason": "Blueprint của Lake Formation cùng Glue gom dữ liệu từ nhiều nguồn vào data lake trên S3 ở dạng Parquet, đều là dịch vụ serverless — đúng nhu cầu gom, xử lý và stage dữ liệu trong S3 với ít công vận hành nhất." }
  ],
  "explanationVi": "Đề cần hai bước: gom và xử lý dữ liệu từ nhiều nguồn vào S3, rồi chạy truy vấn một lần và dựng dashboard KPI. Lake Formation + Glue lo phần gom dữ liệu vào data lake S3 dạng Parquet; Athena + QuickSight lo phần truy vấn và dashboard. Cả bốn đều là dịch vụ được quản lý nên có ít công vận hành nhất (LEAST operational overhead). Bẫy: Kinesis Data Analytics dành cho dữ liệu streaming, còn tự viết Lambda hay vận hành cluster OpenSearch đều tốn công hơn.",
  "keyHint": "\"LEAST operational overhead\" + \"one-time queries\" trên dữ liệu S3 → Athena; gom nhiều nguồn vào data lake → Lake Formation + Glue."
}
```
