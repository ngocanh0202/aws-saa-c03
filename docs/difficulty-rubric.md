# Thang độ khó (`difficulty` trong `data/meta`)

Độ khó quyết định câu nằm ở đề nào: `npm run sets` xếp mỗi domain từ dễ đến khó, nên **Đề 1 dễ nhất, Đề 7 khó nhất**. Câu trong kho dự phòng chỉ thay cho câu cùng domain và cùng độ khó, nên mỗi đề giữ được mức khó của nó qua các lượt thi.

Chấm theo **độ khó với người đang ôn SAA-C03**, không theo độ dài đề. Xét bốn yếu tố, rồi chọn mức khớp nhiều nhất.

| Yếu tố | 1 — Dễ | 2 — Trung bình | 3 — Khó |
|---|---|---|---|
| Yêu cầu trong đề | Một yêu cầu chính, nói thẳng | 2–3 yêu cầu phải cân nhắc cùng lúc (ví dụ HA + chi phí) | Nhiều ràng buộc chồng nhau, có từ khóa như LEAST operational overhead **và** MOST cost-effective, hoặc ràng buộc ẩn phải tự suy ra |
| Lựa chọn sai | Sai rõ: khác loại service hoặc không làm được việc đề yêu cầu | Hợp lý nhưng mỗi cái vi phạm một yêu cầu cụ thể trong đề | Đều làm được về kỹ thuật; khác nhau ở chi tiết nhỏ (cấu hình, giới hạn, chi phí vận hành) |
| Kiến thức cần | Service cốt lõi, ánh xạ thẳng use case → service (S3 cho object, SQS để tách rời…) | Mẫu kiến trúc chuẩn, kết hợp 2–3 service, tính năng phổ biến | Service/tính năng ít gặp, con số giới hạn cụ thể, khác biệt tinh tế giữa các tùy chọn gần giống nhau |
| Dạng câu | Chọn một, đề ngắn | Chọn một hoặc chọn hai dễ tách | Chọn hai/chọn ba mà các đáp án phụ thuộc nhau, đề dài nhiều chi tiết gây nhiễu |

Quy ước thêm:

- Câu có cờ `review` (đáp án gốc đáng ngờ) chấm theo độ khó của **đề bài**, không cộng thêm vì đáp án gây tranh cãi.
- Hai câu trùng nguyên văn (xem `data/sets.json` → `duplicates`) phải cùng độ khó.
- Tỷ lệ tham khảo cho cả ngân hàng: khoảng 25–35% mức 1, 40–50% mức 2, 20–30% mức 3. Đây là để hiệu chỉnh, không phải hạn ngạch: nếu lệch nhiều, xem lại cách chấm.
