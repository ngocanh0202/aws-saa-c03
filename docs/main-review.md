# Rà soát câu hỏi main

Tổng hợp từ `data/main-vi/*.json` (trường `review`) và `data/main-meta/*.json` (trường `note`). Số liệu tính đến 13/11/2026; khi sửa dữ liệu thì cập nhật lại bảng. Vị trí = `id % 100` (dùng với `npm run main:show -- <file> <vị trí>`). Lý do được rút gọn; bản đầy đủ nằm trong file dữ liệu và hiện trong hướng dẫn trên web.

- **review**: đáp án gốc sai, đáng ngờ, hoặc phụ thuộc dịch vụ đã ngừng/sắp ngừng. Đáp án gốc giữ nguyên, không sửa.
- **note**: đáp án vẫn đúng nhưng có thông tin lỗi thời hoặc cần làm rõ.

## Câu gắn cờ review (16)

| Id | File | Vị trí | Lý do |
|---|---|---|---|
| 10109 | pt1_1 | 9 | đề yêu cầu "store and retrieve" dữ liệu vị trí, nhưng Kinesis Data Analytics chỉ xử lý luồng chứ không lưu trữ hay phục vụ truy xuất, và API Gateway không tích hợp trực tiếp với nó (thường phải qua Kinesis Data Streams).… |
| 10116 | pt1_1 | 16 | đề muốn chọn S3 Standard-IA, nhưng với hàng trăm TB chỉ truy cập hai lần/năm thì S3 Intelligent-Tiering thường rẻ hơn. |
| 10131 | pt1_1 | 31 | đáp án đúng phụ thuộc Amazon RDS Custom for Oracle, dịch vụ hết hỗ trợ ngày 31/03/2027. |
| 10141 | pt1_1 | 41 | phương án Direct Connect kết hợp VPN vẫn là đáp án kinh điển, nhưng lý do loại phương án chỉ dùng Direct Connect (không tự mã hóa được) đã lỗi thời: Direct Connect dedicated connection 10/100/400 Gbps tại một số location… |
| 10148 | pt1_1 | 48 | hướng chọn AWS Outposts là đúng, nhưng lựa chọn ghi "Amazon EKS Anywhere on Outposts" là ghép sai tên sản phẩm. Trên Outposts, AWS chạy Amazon EKS (local cluster hoặc extended cluster). |
| 10315 | pt2_1 | 15 | tài liệu Amazon EFS hiện hành xếp Max I/O vào loại thế hệ trước và khuyên dùng General Purpose cho mọi file system, vì General Purpose nay đã đạt mức IOPS rất cao (và kết hợp được với Elastic throughput) trong khi Max I/… |
| 10364 | pt2_1 | 64 | đáp án dựa trên AWS Snowball, dịch vụ chỉ còn cho khách hàng hiện hữu từ 07/11/2025 và hết hỗ trợ ở các Region thương mại ngày 31/12/2026. |
| 10728 | pt4_1 | 28 | đáp án dựa vào S3 Glacier Vault Lock, tính năng của dịch vụ Amazon Glacier dạng vault (độc lập với S3), vốn không nhận khách hàng mới từ 15/12/2025. |
| 10730 | pt4_1 | 30 | đây là phương án tốt nhất trong các lựa chọn, nhưng câu "cho phép định tuyến bắc cầu giữa các VPC" là sai. Theo tài liệu Direct Connect, Direct Connect gateway với VGW chỉ cho data center tới VPC. |
| 10919 | pt5_1 | 19 | phương án NLB dùng target group kiểu IP trỏ về máy chủ on-premises cho phần UDP không chạy trực tiếp được — tài liệu Network Load Balancer ghi rõ target group UDP/TCP_UDP không nên đăng ký IP nằm ngoài VPC của load balan… |
| 10924 | pt5_1 | 24 | đáp án dựa vào Glacier vault và Vault Lock của dịch vụ Amazon Glacier dạng vault (độc lập với S3), vốn không nhận khách hàng mới từ 15/12/2025 theo trang giá và tài liệu Amazon Glacier. |
| 10925 | pt5_1 | 25 | đề đòi "global consistency", nhưng global table mặc định dùng chế độ multi-Region eventual consistency (sao chép bất đồng bộ, ghi đồng thời thì bản ghi sau cùng thắng). |
| 10930 | pt5_1 | 30 | đáp án dựa trên AWS Snowball Edge, dịch vụ chỉ còn cho khách hàng hiện hữu từ 07/11/2025 theo AWS Snowball Edge Developer Guide ("Snowball Edge availability change"). |
| 11157 | pt6_1 | 57 | từ 02/02/2021 Amazon S3 hỗ trợ AWS PrivateLink (thông báo "Amazon S3 now supports AWS PrivateLink"): tạo S3 interface endpoint trong VPC thì hệ thống on-premises truy cập S3 bằng IP private qua Direct Connect private VIF… |
| 11160 | pt6_1 | 60 | theo bảng giá S3 (us-east-1), Glacier Instant Retrieval lưu khoảng 0,004 USD/GB-tháng so với 0,0125 của Standard-IA, chỉ phí truy xuất cao hơn (0,03 so với 0,01 USD/GB) và lưu tối thiểu 90 ngày. |
| 11163 | pt6_1 | 63 | theo phần Data Transfer của trang giá EC2 On-Demand, traffic giữa các AZ trong cùng Region tính 0,01 USD/GB mỗi chiều kể cả khi dùng IP private, và traffic qua địa chỉ IPv4 public hay Elastic IP trong cùng Region cũng tí… |

## Ghi chú (note) còn lại (32)

| Id | File | Vị trí | Ghi chú |
|---|---|---|---|
| 10105 | pt1_1 | 5 | Con số lỗi thời: FIFO queue nay có chế độ high throughput (hàng chục nghìn msg/giây mỗi API) nên phép tính 300 msg/s x batch 10 không còn là giới hạn duy nhất; đáp án vẫn đúng theo kiến thức thời điểm ra đề. |
| 10142 | pt1_1 | 42 | Lựa chọn "s3:*Object" thực tế là wildcard IAM hợp lệ (khớp DeleteObject, GetObject, PutObject...) nên cũng khắc phục được lỗi, trái với giải thích gốc nói action không hợp lệ. |
| 10320 | pt2_1 | 20 | Giải thích gốc tiếng Anh ghi AWS WAF tích hợp được với Global Accelerator — không đúng: WAF gắn với các tài nguyên như CloudFront, ALB, API Gateway, AppSync, không gắn với Global Accelerator. Đáp án không đổi. |
| 10335 | pt2_1 | 35 | Từ 04/2026 Amazon S3 mặc định chặn SSE-C trên bucket mới (request dùng SSE-C bị từ chối 403); muốn dùng SSE-C phải bật lại trong cấu hình mã hóa mặc định của bucket. Đáp án vẫn đúng. |
| 10340 | pt2_1 | 40 | Tên storage class hiện nay của EFS là EFS Standard, EFS Infrequent Access (IA) và EFS Archive; "Standard-IA" trong đề là tên cũ của lớp IA. |
| 10354 | pt2_1 | 54 | Đề/giải thích dùng thuật ngữ AWS WAF Classic ("IP match condition"); hiện WAF dùng rule IP set trong web ACL. Đáp án (chặn IP bằng AWS WAF) vẫn đúng. |
| 10355 | pt2_1 | 55 | Launch configuration đã lỗi thời: AWS khuyên dùng launch template, và tài khoản tạo từ 01/10/2024 không tạo được launch configuration mới. Thứ tự của default termination policy trong giải thích vẫn đúng. |
| 10511 | pt3_1 | 11 | Từ 11/2022 Amazon EFS có thêm chế độ Elastic Throughput, tự co giãn thông lượng theo tải và chỉ tính tiền theo lượng dữ liệu đọc ghi; AWS khuyên dùng chế độ này cho tải khó đoán. |
| 10520 | pt3_1 | 20 | Nhiều loại EC2 instance hiện có sẵn simplified automatic recovery (bật mặc định), tự khôi phục instance khi lỗi phần cứng mà không cần tạo CloudWatch alarm; alarm với hành động recover vẫn dùng được. |
| 10524 | pt3_1 | 24 | Giới hạn 300 tin nhắn/giây (3.000 khi dùng batching) là của FIFO queue thường; từ 2021 SQS có chế độ high throughput cho FIFO queue với hạn mức cao hơn nhiều, tùy Region. |
| 10530 | pt3_1 | 30 | Đáp án dùng origin access identity (OAI), nay là cách cũ; AWS khuyên dùng origin access control (OAC). Nguyên lý của đáp án vẫn đúng. |
| 10536 | pt3_1 | 36 | AWS DDoS Response Team (DRT) nay được gọi là Shield Response Team (SRT). |
| 10551 | pt3_1 | 51 | AWS nay khuyên dùng io2 Block Express thay cho io1: cùng mức giá nhưng độ bền dữ liệu cao hơn (99,999%) và hiệu năng tối đa cao hơn (tới 256.000 IOPS mỗi volume). |
| 10559 | pt3_1 | 59 | AWS DMS nay có thêm DMS Schema Conversion chạy ngay trong console, làm phần việc chuyển đổi schema của AWS SCT mà không cần cài công cụ trên máy; AWS SCT vẫn dùng được. |
| 10709 | pt4_1 | 9 | Launch configuration đã lỗi thời: AWS khuyên dùng launch template, và tài khoản tạo từ 01/10/2024 không tạo được launch configuration mới. Thứ tự của default termination policy trong đáp án vẫn đúng. |
| 10710 | pt4_1 | 10 | Storage class "Amazon S3 Glacier" trong đề nay có tên S3 Glacier Flexible Retrieval (đổi tên 11/2021); đáp án không đổi. |
| 10716 | pt4_1 | 16 | Giải thích gốc tiếng Anh ghi Aurora Serverless v2 không hỗ trợ read replica — không đúng: cluster Serverless v2 có thể có nhiều reader (Aurora Replica) và dùng reader endpoint. Đáp án (cache bằng ElastiCache) không đổi. |
| 10720 | pt4_1 | 20 | Lựa chọn "example.com" và "EXAMPLE.COM" thực chất trùng nhau (tên host không phân biệt hoa thường); cả hai đều không khớp quy tắc *.example.com vì thiếu subdomain, nên chỉ còn "test.example.com" đúng. |
| 10748 | pt4_1 | 48 | Giải thích gốc tiếng Anh ghi phải bật CloudTrail trail mới dùng được sự kiện object-level của S3 trong EventBridge — đã lỗi thời: từ 11/2021 Amazon S3 gửi sự kiện thẳng tới EventBridge khi bật tùy chọn này trên bucket. |
| 10753 | pt4_1 | 53 | Từ 11/2022 Amazon EFS có chế độ Elastic Throughput, tự co giãn thông lượng theo tải và chỉ tính tiền theo lượng dữ liệu đọc ghi. |
| 10754 | pt4_1 | 54 | Hiện nay AWS khuyên dùng gp3 thay cho gp2: gp3 rẻ hơn khoảng 20% mỗi GB, có sẵn 3.000 IOPS và 125 MiB/s không phụ thuộc dung lượng, và chỉnh IOPS độc lập. Hướng chuyển từ io1 sang General Purpose SSD của đáp án vẫn đúng. |
| 10902 | pt5_1 | 2 | Giải thích gốc tiếng Anh nói minimum phải là 4 vì Auto Scaling group chia đều instance giữa các AZ — lý do chính xác hơn là: tải cần 2 instance, nên mỗi AZ phải tự gánh đủ 2 instance để khi mất một AZ ứng dụng vẫn đủ năn… |
| 10914 | pt5_1 | 14 | Từ 11/2021 có thêm storage class S3 Glacier Instant Retrieval (truy xuất trong mili giây, lưu tối thiểu 90 ngày), thường rẻ hơn Standard-IA cho dữ liệu hiếm khi truy cập. |
| 10919 | pt5_1 | 19 | Giải thích gốc tiếng Anh nói AWS PrivateLink chỉ hỗ trợ TCP — đã lỗi thời: từ 31/10/2024 PrivateLink hỗ trợ cả UDP. PrivateLink vẫn không phải cách đưa ứng dụng tới khách hàng toàn cầu nên đáp án không đổi. |
| 10944 | pt5_1 | 44 | CloudWatch Logs agent cũ trong đề đã bị AWS đánh dấu deprecated; hiện nay dùng CloudWatch agent hợp nhất (unified CloudWatch agent) để gửi log và metric (bắt buộc nếu instance dùng IMDSv2). |
| 10953 | pt5_1 | 53 | Tag policy kiểm tra giá trị tag (khi bật enforcement thì chặn gắn giá trị sai); từ 11/2025 tag policy khai báo được khóa bắt buộc (report_required_tag_for) nhưng chỉ báo cáo và chặn trong triển khai IaC (CloudFormation h… |
| 10960 | pt5_1 | 60 | Giải thích gốc tiếng Anh loại hai phương án bật CRR trên bucket hiện có vì "bỏ qua bước tạo bucket đích", lý do này không thuyết phục. |
| 10962 | pt5_1 | 62 | Storage class "Amazon S3 Glacier" trong đề nay có tên S3 Glacier Flexible Retrieval (đổi tên 11/2021); với archive ít khi truy xuất, S3 Glacier Deep Archive còn rẻ hơn. Đáp án không đổi. |
| 11109 | pt6_1 | 9 | Từ 26/11/2023 Amazon EFS có thêm lớp EFS Archive, giá lưu trữ thấp hơn khoảng 50% so với Infrequent Access, dành cho dữ liệu chỉ truy cập vài lần mỗi năm hoặc ít hơn (cần Elastic Throughput) — hợp hơn với dữ liệu dùng kh… |
| 11126 | pt6_1 | 26 | Giải thích gốc tiếng Anh nói không thể nhập dữ liệu từ Amazon S3 vào Amazon RDS — đã lỗi thời: từ 04/2019 RDS for PostgreSQL nhập được file từ S3 bằng extension aws_s3 (hàm aws_s3.table_import_from_s3). |
| 11133 | pt6_1 | 33 | Đáp án dùng origin access identity (OAI). AWS hiện khuyến nghị origin access control (OAC) thay cho OAI (OAI là cơ chế cũ); đáp án vẫn đúng về ý nhưng thông tin hơi lỗi thời. |
| 11137 | pt6_1 | 37 | Giải thích gốc tiếng Anh nói Firewall Manager không hỗ trợ network ACL — đã lỗi thời: từ 04/2024 Firewall Manager có policy network ACL để tạo và quản lý rule NACL tập trung cho subnet trên các tài khoản. |
