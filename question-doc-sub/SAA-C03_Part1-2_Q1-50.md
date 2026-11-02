# AWS SAA-C03 Practice Questions

## Question 1

A bicycle sharing company is developing a multi-tier architecture to track the location of its bicycles during peak operating hours. The company wants to use these data points in its existing analytics platform. A solutions architect must determine the most viable multi-tier option to support this architecture. The data points must be accessible from the REST API.

**Which action meets these requirements for storing and retrieving location data?**

A. Use Amazon Athena with Amazon S3.
B. Use Amazon API Gateway with AWS Lambda.
C. Use Amazon QuickSight with Amazon Redshift.
D. Use Amazon API Gateway with Amazon Kinesis Data Analytics.

**Answer: D**

**Explanation:** Peak hours + continuous location tracking = realtime streaming data. Kinesis Data Analytics xử lý streaming data realtime, API Gateway nhận data từ xe đạp liên tục và đưa vào analytics platform.

---

## Question 2

A solutions architect needs to implement a solution to reduce a company's storage costs. All the company's data is in the Amazon S3 Standard storage class. The company must keep all data for at least 25 years. Data from the most recent 2 years must be highly available and immediately retrievable.

**Which solution will meet these requirements?**

A. Set up an S3 Lifecycle policy to transition objects to S3 Glacier Deep Archive immediately.
B. Set up an S3 Lifecycle policy to transition objects to S3 Glacier Deep Archive after 2 years.
C. Use S3 Intelligent-Tiering. Activate the archiving option to ensure that data is archived in S3 Glacier Deep Archive.
D. Set up an S3 Lifecycle policy to transition objects to S3 One Zone-Infrequent Access (S3 One Zone-IA) immediately and to S3 Glacier Deep Archive after 2 years.

**Answer: B**

**Explanation:** 2 năm đầu cần highly available + immediately retrievable → giữ S3 Standard. Sau 2 năm → chuyển Glacier Deep Archive để tiết kiệm chi phí lưu trữ 25 năm. One Zone-IA loại vì không highly available (chỉ 1 AZ).

---

## Question 3

A company operates a food delivery service. Because of recent growth, the company's order processing system is experiencing scaling problems during peak traffic hours. The current architecture includes Amazon EC2 instances in an Auto Scaling group that collect orders from an application. A second group of EC2 instances in an Auto Scaling group fulfills the orders.

The order collection process occurs quickly, but the order fulfillment process can take longer. Data must not be lost because of a scaling event.

A solutions architect must ensure that the order collection process and the order fulfillment process can both scale adequately during peak traffic hours.

**Which solution will meet these requirements?**

A. Use Amazon CloudWatch to monitor the CPUUtilization metric for each instance in both Auto Scaling groups. Configure each Auto Scaling group's minimum capacity to meet its peak workload value.
B. Use Amazon CloudWatch to monitor the CPUUtilization metric for each instance in both Auto Scaling groups. Configure a CloudWatch alarm to invoke an Amazon Simple Notification Service (Amazon SNS) topic to create additional Auto Scaling groups on demand.
C. Provision two Amazon Simple Queue Service (Amazon SQS) queues. Use one SQS queue for order collection. Use the second SQS queue for order fulfillment. Configure the EC2 instances to poll their respective queues. Scale the Auto Scaling groups based on notifications that the queues send.
D. Provision two Amazon Simple Queue Service (Amazon SQS) queues. Use one SQS queue for order collection. Use the second SQS queue for order fulfillment. Configure the EC2 instances to poll their respective queues. Scale the Auto Scaling groups based on the number of messages in each queue.

**Answer: D**

**Explanation:** SQS làm buffer giữa 2 tầng xử lý → data không bị mất khi scaling. Scale dựa trên số message trong queue (ApproximateNumberOfMessages metric) mới đúng — SQS không tự gửi notification để scale (loại C). 2 queue riêng biệt vì order collection nhanh, order fulfillment chậm hơn → cần scale độc lập.

---

## Question 4

A company produces batch data that comes from different databases. The company also produces live stream data from network sensors and application APIs. The company needs to consolidate all the data into one place for business analytics. The company needs to process the incoming data and then stage the data in different Amazon S3 buckets. Teams will later run one-time queries and import the data into a business intelligence tool to show key performance indicators (KPIs).

**Which combination of steps will meet these requirements with the LEAST operational overhead? (Choose two.)**

A. Use Amazon Athena for one-time queries. Use Amazon QuickSight to create dashboards for KPIs.
B. Use Amazon Kinesis Data Analytics for one-time queries. Use Amazon QuickSight to create dashboards for KPIs.
C. Create custom AWS Lambda functions to move the individual records from the databases to an Amazon Redshift cluster.
D. Use an AWS Glue extract, transform, and load (ETL) job to convert the data into JSON format. Load the data into multiple Amazon OpenSearch Service (Amazon Elasticsearch Service) clusters.
E. Use blueprints in AWS Lake Formation to identify the data that can be ingested into a data lake. Use AWS Glue to crawl the source, extract the data, and load the data into Amazon S3 in Apache Parquet format.

**Answer: A, E**

**Explanation:** E: Lake Formation + Glue ETL → data lake trên S3 dạng Parquet (format tối ưu cho analytics, least overhead vì serverless managed). A: Athena query trực tiếp S3 cho one-time queries (serverless, không cần setup), QuickSight visualize KPIs. Kinesis Analytics (B) dùng cho realtime streaming, không phải one-time queries.

---

## Question 5

A company performs monthly maintenance on its AWS infrastructure. During these maintenance windows, the company needs to rotate the credentials for its Amazon RDS for MySQL databases across multiple AWS Regions.

**Which solution will meet these requirements with the LEAST operational overhead?**

A. Store the credentials as secrets in AWS Secrets Manager. Use multi-Region secret replication for the required Regions. Configure Secrets Manager to rotate the secrets on a schedule.
B. Store the credentials as secrets in AWS Systems Manager Parameter Store. Use the Parameter Store to rotate credentials on a schedule.
C. Encrypt the credentials as secrets by using AWS Key Management Service (AWS KMS) multi-Region customer managed keys. Store the secrets in an Amazon S3 bucket. Configure the bucket to replicate credentials to the required Regions.
D. Encrypt the credentials by using AWS CloudHSM. Store the credentials in Amazon S3. Use S3 Cross-Region Replication to replicate the credentials to the required Regions.

**Answer: A**

**Explanation:** Secrets Manager được thiết kế đúng cho việc này: tự động rotate credentials (schedule), native integration với RDS, hỗ trợ multi-Region replication. Parameter Store (B) không có auto-rotation built-in cho RDS. KMS + S3 (C) và CloudHSM + S3 (D) là giải pháp manual, overhead cao hơn nhiều.

---

## Question 6

A company hosts an application in a private subnet. The company has already integrated the application with Amazon Cognito. The company uses an Amazon Cognito user pool to authenticate users.

The company needs to modify the application so the application can securely store user documents in an Amazon S3 bucket.

**Which combination of steps will securely integrate Amazon S3 with the application? (Choose two.)**

A. Create an Amazon Cognito identity pool to generate secure Amazon S3 access tokens for users when they successfully log in.
B. Use the existing Amazon Cognito user pool to generate Amazon S3 access tokens for users when they successfully log in.
C. Create an Amazon S3 VPC endpoint in the same VPC where the company hosts the application.
D. Create a NAT gateway in the VPC where the company hosts the application. Assign a policy to the S3 bucket to deny any request that is not initiated from Amazon Cognito.
E. Attach a policy to the S3 bucket that allows access only from the users' IP addresses.

**Answer: A, C**

**Explanation:** A: Cognito Identity Pool (≠ User Pool) tạo temporary AWS credentials cho authenticated users → truy cập S3 an toàn. User Pool (B) chỉ authenticate, không generate AWS credentials cho S3. C: App trong private subnet cần S3 VPC endpoint để kết nối S3 mà không qua internet. D sai vì NAT Gateway để ra internet, không phải để secure S3. E sai vì IP address của user thay đổi liên tục, không thể dùng để control access.

---

## Question 7

A company has an automobile sales website that stores its listings in a database on Amazon RDS. When an automobile is sold, the listing needs to be removed from the website and the data must be sent to multiple target systems.

**Which design should a solutions architect recommend?**

A. Create an AWS Lambda function triggered when the database on Amazon RDS is updated to send the information to an Amazon Simple Queue Service (Amazon SQS) queue for the targets to consume.
B. Create an AWS Lambda function triggered when the database on Amazon RDS is updated to send the information to an Amazon Simple Queue Service (Amazon SQS) FIFO queue for the targets to consume.
C. Subscribe to an RDS event notification and send an Amazon Simple Queue Service (Amazon SQS) queue fanned out to multiple Amazon Simple Notification Service (Amazon SNS) topics. Use AWS Lambda functions to update the targets.
D. Subscribe to an RDS event notification and send an Amazon Simple Notification Service (Amazon SNS) topic fanned out to multiple Amazon Simple Queue Service (Amazon SQS) queues. Use AWS Lambda functions to update the targets.

**Answer: D**

**Explanation:** Đây là bài toán "gửi 1 sự kiện đến nhiều target" → dùng fan-out pattern chuẩn của AWS: SNS topic fan-out ra nhiều SQS queue (mỗi target có 1 queue riêng), sau đó Lambda đọc từng queue để update từng target. SNS là pub/sub nên 1 message có thể broadcast đến nhiều subscriber (SQS queues) cùng lúc — đúng nhu cầu "multiple target systems". C sai vì ngược hướng: SQS là point-to-point (1 message chỉ được 1 consumer nhận), không thể "fan out" từ 1 SQS ra nhiều SNS topic một cách hợp lý — đây không phải kiến trúc chuẩn. A và B sai vì chỉ dùng 1 SQS queue duy nhất, không "multiple target systems" được (SQS message chỉ bị 1 consumer lấy, không broadcast).

---

## Question 8

A company has a small Python application that processes JSON documents and outputs the results to an on-premises SQL database. The application runs thousands of times each day. The company wants to move the application to the AWS Cloud. The company needs a highly available solution that maximizes scalability and minimizes operational overhead.

**Which solution will meet these requirements?**

A. Place the JSON documents in an Amazon S3 bucket. Run the Python code on multiple Amazon EC2 instances to process the documents. Store the results in an Amazon Aurora DB cluster.
B. Place the JSON documents in an Amazon S3 bucket. Create an AWS Lambda function that runs the Python code to process the documents as they arrive in the S3 bucket. Store the results in an Amazon Aurora DB cluster.
C. Place the JSON documents in an Amazon Elastic Block Store (Amazon EBS) volume. Use the EBS Multi-Attach feature to attach the volume to multiple Amazon EC2 instances. Run the Python code on the EC2 instances to process the documents. Store the results on an Amazon RDS DB instance.
D. Place the JSON documents in an Amazon Simple Queue Service (Amazon SQS) queue as messages. Deploy the Python code as a container on an Amazon Elastic Container Service (Amazon ECS) cluster that is configured with the Amazon EC2 launch type. Use the container to process the SQS messages. Store the results on an Amazon RDS DB instance.

**Answer: B**

**Explanation:** Yêu cầu "maximize scalability + minimize operational overhead" → ưu tiên serverless. B: S3 event notification trigger Lambda mỗi khi có document mới → Lambda tự động scale theo số lượng document đến (chạy song song hàng nghìn lần/ngày mà không cần quản lý server), Aurora cluster cho high availability (multi-AZ). Đây là kiến trúc serverless hoàn toàn, không phải quản lý capacity. A sai vì "multiple EC2 instances" phải tự quản lý (provision, patch, scale thủ công hoặc tự setup Auto Scaling) → operational overhead cao hơn Lambda. C sai vì EBS Multi-Attach chỉ hoạt động trong cùng 1 AZ, yêu cầu cluster-aware filesystem phức tạp, không highly available thực sự và overhead quản lý rất lớn. D sai vì ECS với EC2 launch type vẫn phải tự quản lý fleet EC2 làm container host (khác với Fargate) → operational overhead cao hơn hẳn so với Lambda serverless.

---

## Question 9

A company has an AWS Glue extract, transform, and load (ETL) job that runs every day at the same time. The job processes XML data that is in an Amazon S3 bucket. New data is added to the S3 bucket every day. A solutions architect notices that AWS Glue is processing all the data during each run.

**What should the solutions architect do to prevent AWS Glue from reprocessing old data?**

A. Edit the job to use job bookmarks.
B. Edit the job to delete data after the data is processed.
C. Edit the job by setting the NumberOfWorkers field to 1.
D. Use a FindMatches machine learning (ML) transform.

**Answer: A**

**Explanation:** AWS Glue **job bookmarks** được thiết kế chính xác cho tình huống này: Glue lưu trạng thái (state) của dữ liệu đã xử lý ở các lần chạy trước (timestamp, file path, v.v.), nên lần chạy kế tiếp chỉ xử lý dữ liệu mới thêm vào S3, bỏ qua dữ liệu cũ. B sai vì xóa dữ liệu gốc sau khi xử lý là cách thủ công, rủi ro mất dữ liệu, không phải cơ chế Glue khuyến nghị. C sai vì `NumberOfWorkers` chỉ điều chỉnh capacity/parallelism của job, không liên quan đến việc theo dõi dữ liệu nào đã xử lý — job vẫn xử lý lại toàn bộ data dù chạy chậm hơn. D sai vì `FindMatches` ML transform dùng để tìm/khử bản ghi trùng lặp (deduplication), không phải để track dữ liệu đã xử lý qua các lần chạy.

*(Lưu ý: đáp án bạn gửi là C, nhưng đáp án đúng là A — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 10

A company has created an image analysis application in which users can upload photos and add photo frames to their images. The users upload images and metadata to indicate which photo frames they want to add to their images. The application uses a single Amazon EC2 instance and Amazon DynamoDB to store the metadata.

The application is becoming more popular, and the number of users is increasing. The company expects the number of concurrent users to vary significantly depending on the time of day and day of week. The company must ensure that the application can scale to meet the needs of the growing user base.

**Which solution meets these requirements?**

A. Use AWS Lambda to process the photos. Store the photos and metadata in DynamoDB.
B. Use Amazon Kinesis Data Firehose to process the photos and to store the photos and metadata.
C. Use AWS Lambda to process the photos. Store the photos in Amazon S3. Retain DynamoDB to store the metadata.
D. Increase the number of EC2 instances to three. Use Provisioned IOPS SSD (io2) Amazon Elastic Block Store (Amazon EBS) volumes to store the photos and metadata.

**Answer: C**

**Explanation:** Bài toán cần "scale theo số concurrent user biến động mạnh" → ưu tiên kiến trúc serverless, tách đúng loại storage cho đúng loại dữ liệu. C: Lambda xử lý ảnh (tự động scale theo số lượng request, không cần quản lý server), S3 lưu ảnh (object storage phù hợp cho file lớn, scale gần như vô hạn, rẻ), giữ nguyên DynamoDB cho metadata (vốn đã là NoSQL scale tốt, phù hợp lưu dữ liệu nhỏ dạng key-value). A sai vì DynamoDB không phù hợp lưu ảnh (item size giới hạn 400KB, không phải object storage). B sai vì Kinesis Data Firehose dùng để chuyển/stream dữ liệu (ETL streaming vào S3/Redshift...), không phải dịch vụ "xử lý ảnh" hay lưu trữ ảnh. D sai vì tăng cố định 3 EC2 instance không đáp ứng được nhu cầu scale linh hoạt theo thời gian (concurrent user thay đổi theo giờ/ngày), và EBS gắn với instance cụ thể không phải giải pháp lưu trữ ảnh có khả năng scale tốt.

---

## Question 11

A solutions architect must design a solution that uses Amazon CloudFront with an Amazon S3 origin to store a static website. The company's security policy requires that all website traffic be inspected by AWS WAF.

**How should the solutions architect comply with these requirements?**

A. Configure an S3 bucket policy to accept requests coming from the AWS WAF Amazon Resource Name (ARN) only.
B. Configure Amazon CloudFront to forward all incoming requests to AWS WAF before requesting content from the S3 origin.
C. Configure a security group that allows Amazon CloudFront IP addresses to access Amazon S3 only. Associate AWS WAF to CloudFront.
D. Configure Amazon CloudFront and Amazon S3 to use an origin access identity (OAI) to restrict access to the S3 bucket. Enable AWS WAF on the distribution.

**Answer: D**

**Explanation:** Dùng **Origin Access Identity (OAI)** giữa CloudFront và S3 để đảm bảo S3 bucket chỉ nhận request từ CloudFront (chặn truy cập trực tiếp vào S3 URL, bắt buộc mọi traffic phải đi qua CloudFront). Sau đó **enable AWS WAF trên CloudFront distribution** (gắn Web ACL vào distribution) để WAF kiểm tra toàn bộ traffic trước khi tới origin — đúng yêu cầu "all website traffic be inspected by AWS WAF". C sai vì **Amazon S3 không hỗ trợ Security Group** — Security Group là khái niệm network-level của EC2/VPC, không áp dụng cho S3 (S3 kiểm soát access bằng bucket policy/IAM, không phải security group) — đây là bẫy hay gặp. A sai vì WAF không phải là principal gửi request đến S3 bằng ARN riêng; bucket policy không thể "accept requests from WAF ARN" theo cách này. B sai vì không có cơ chế "CloudFront forward request đến WAF rồi mới đến S3 origin" — thực tế WAF Web ACL được gắn trực tiếp vào CloudFront distribution, kiểm tra ngay tại edge, không phải một bước forward riêng biệt.

*(Lưu ý: đáp án bạn gửi là C, nhưng đáp án đúng là D — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 12

A company's image-hosting website gives users around the world the ability to upload, view, and download images from their mobile devices. The company currently hosts the static website in an Amazon S3 bucket.

Because of the website's growing popularity, the website's performance has decreased. Users have reported latency issues when they upload and download images.

The company must improve the performance of the website.

**Which solution will meet these requirements with the LEAST implementation effort?**

A. Configure an Amazon CloudFront distribution for the S3 bucket to improve the download performance. Enable S3 Transfer Acceleration to improve the upload performance.
B. Configure Amazon EC2 instances of the right sizes in multiple AWS Regions. Migrate the application to the EC2 instances. Use an Application Load Balancer to distribute the website traffic equally among the EC2 instances. Configure AWS Global Accelerator to address global demand with low latency.
C. Configure an Amazon CloudFront distribution that uses the S3 bucket as an origin to improve the download performance. Configure the application to use CloudFront to upload images to improve the upload performance. Create S3 buckets in multiple AWS Regions. Configure replication rules for the buckets to replicate users' data based on the users' location. Redirect downloads to the S3 bucket that is closest to each user's location.
D. Configure AWS Global Accelerator for the S3 bucket to improve network performance. Create an endpoint for the application to use Global Accelerator instead of the S3 bucket.

**Answer: A**

**Explanation:** Yêu cầu "LEAST implementation effort" → chỉ cần **bật 2 tính năng có sẵn**, không đổi kiến trúc: **CloudFront** cho S3 bucket cải thiện tốc độ download (cache tại edge location gần user), **S3 Transfer Acceleration** cải thiện tốc độ upload (dùng CloudFront edge network đẩy dữ liệu upload nhanh hơn tới bucket gốc). C sai vì phức tạp hơn nhiều: phải tạo nhiều S3 bucket ở nhiều Region, cấu hình replication rules, tự viết logic redirect user theo location, và "dùng CloudFront để upload" không phải cơ chế chuẩn có sẵn — effort cao hơn hẳn A. B sai vì phải migrate toàn bộ website từ static S3 sang EC2, dựng ALB + Global Accelerator — thay đổi hoàn toàn kiến trúc, effort rất lớn. D sai vì **AWS Global Accelerator không hỗ trợ S3 bucket làm endpoint** — Global Accelerator chỉ làm việc với ALB, NLB, EC2 instance, Elastic IP — đây là cấu hình không khả thi về mặt kỹ thuật.

*(Lưu ý: đáp án bạn gửi là C, nhưng đáp án đúng là A — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 13

A global company is using Amazon API Gateway to design REST APIs for its loyalty club users in the us-east-1 Region and the ap-southeast-2 Region. A solutions architect must design a solution to protect these API Gateway managed REST APIs across multiple accounts from SQL injection and cross-site scripting attacks.

**Which solution will meet these requirements with the LEAST amount of administrative effort?**

A. Set up AWS WAF in both Regions. Associate Regional web ACLs with an API stage.
B. Set up AWS Firewall Manager in both Regions. Centrally configure AWS WAF rules.
C. Set up AWS Shield in both Regions. Associate Regional web ACLs with an API stage.
D. Set up AWS Shield in one of the Regions. Associate Regional web ACLs with an API stage.

**Answer: B**

**Explanation:** Yêu cầu bảo vệ SQL injection/XSS thì công cụ đúng là **AWS WAF** (có managed rule groups cho SQLi/XSS) — loại ngay C và D vì **AWS Shield chỉ bảo vệ DDoS**, không liên quan đến SQL injection/XSS. Giữa A và B: đề bài nhấn mạnh "**across multiple accounts**" + "LEAST administrative effort" → **AWS Firewall Manager** được thiết kế chính xác để **quản lý và triển khai tập trung (centrally)** các rule WAF trên nhiều account và nhiều Region cùng lúc (thông qua AWS Organizations), thay vì phải tự cấu hình WAF thủ công lặp lại ở từng account/Region riêng lẻ như phương án A. Vì vậy B tối ưu effort hơn A trong bối cảnh multi-account.

---

## Question 14

A solutions architect is optimizing a website for an upcoming musical event. Videos of the performances will be streamed in real time and then will be available on demand. The event is expected to attract a global online audience.

**Which service will improve the performance of both the real-time and on-demand streaming?**

A. Amazon CloudFront
B. AWS Global Accelerator
C. Amazon Route 53
D. Amazon S3 Transfer Acceleration

**Answer: A**

**Explanation:** **Amazon CloudFront** là CDN của AWS, được thiết kế để phân phối nội dung **cả live streaming (real-time) lẫn video-on-demand (VOD)** tới người xem toàn cầu qua mạng lưới edge location — cache nội dung gần người dùng, giảm latency, tăng tốc phát cho cả 2 loại streaming trong đề bài. D sai vì **S3 Transfer Acceleration chỉ tăng tốc upload dữ liệu LÊN S3** (chiều đi vào), không giúp gì cho việc phát/stream video xuống cho người xem (chiều đi ra) — dễ nhầm vì cả 2 đều dùng CloudFront edge network nhưng theo chiều ngược nhau. B sai vì Global Accelerator tối ưu cho traffic TCP/UDP nói chung (static IP, gaming, VoIP...), không chuyên biệt cho video streaming/caching như CloudFront. C sai vì Route 53 là dịch vụ DNS, không liên quan đến tốc độ truyền tải video.

*(Lưu ý: đáp án bạn gửi là D, nhưng đáp án đúng là A — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 15

A solutions architect needs to help a company optimize the cost of running an application on AWS. The application will use Amazon EC2 instances, AWS Fargate, and AWS Lambda for compute within the architecture.

The EC2 instances will run the data ingestion layer of the application. EC2 usage will be sporadic and unpredictable. Workloads that run on EC2 instances can be interrupted at any time. The application front end will run on Fargate, and Lambda will serve the API layer. The front-end utilization and API layer utilization will be predictable over the course of the next year.

**Which combination of purchasing options will provide the MOST cost-effective solution for hosting this application? (Choose two.)**

A. Use Spot Instances for the data ingestion layer.
B. Use On-Demand Instances for the data ingestion layer.
C. Purchase a 1-year Compute Savings Plan for the front end and API layer.
D. Purchase 1-year All Upfront Reserved Instances for the data ingestion layer.
E. Purchase a 1-year EC2 Instance Savings Plan for the front end and API layer.

**Answer: A, C**

**Explanation:** A: Data ingestion layer trên EC2 có đặc điểm sporadic, unpredictable, có thể bị interrupt bất cứ lúc nào → đúng use case của **Spot Instances** (rẻ hơn nhiều so với On-Demand, đổi lại chấp nhận bị thu hồi — workload này đã sẵn sàng chấp nhận điều đó). C: Front-end (Fargate) + API layer (Lambda) có utilization dự đoán được trong cả năm → phù hợp cam kết dài hạn. **Compute Savings Plan** là loại linh hoạt nhất, áp dụng được cho cả EC2, Fargate, VÀ Lambda — đúng khớp 2 loại compute (Fargate + Lambda) trong đề. B sai vì On-Demand không tối ưu chi phí cho workload unpredictable/interruptible — Spot rẻ hơn nhiều. D sai vì Reserved Instances (kể cả All Upfront) cần usage liên tục/ổn định (steady-state) để tối ưu giá trị, không phù hợp với data ingestion sporadic/interruptible — rủi ro trả tiền cho capacity không dùng hết. E sai vì **EC2 Instance Savings Plan chỉ áp dụng cho EC2**, không áp dụng cho Fargate hoặc Lambda — trong khi front-end chạy Fargate và API layer chạy Lambda, nên hoàn toàn không cover được 2 layer này (đây là bẫy dễ nhầm với Compute Savings Plan).

*(Lưu ý: đáp án bạn gửi là B, D, nhưng đáp án đúng là A, C — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 16

A company has a data ingestion workflow that includes the following components:

An Amazon Simple Notification Service (Amazon SNS) topic that receives notifications about new data deliveries

An AWS Lambda function that processes and stores the data

The ingestion workflow occasionally fails because of network connectivity issues. When failure occurs, the corresponding data is not ingested unless the company manually reruns the job.

**What should a solutions architect do to ensure that all notifications are eventually processed?**

A. Configure the Lambda function for deployment across multiple Availability Zones.
B. Modify the Lambda function's configuration to increase the CPU and memory allocations for the function.
C. Configure the SNS topic's retry strategy to increase both the number of retries and the wait time between retries.
D. Configure an Amazon Simple Queue Service (Amazon SQS) queue as the on-failure destination. Modify the Lambda function to process messages in the queue.

**Answer: D**

**Explanation:** Khi Lambda được invoke bất đồng bộ (async invocation, ví dụ từ SNS), AWS Lambda hỗ trợ tính năng **Destinations** — cho phép cấu hình 1 **on-failure destination** (SQS queue, SNS topic, EventBridge, hoặc Lambda khác) để **nhận lại các event bị lỗi sau khi hết số lần retry mặc định**. Cấu hình SQS làm on-failure destination đảm bảo dữ liệu lỗi **không bao giờ bị mất** — nó được lưu lại trong queue, Lambda (hoặc 1 Lambda khác) có thể xử lý lại sau, đúng yêu cầu "ensure all notifications are eventually processed". C sai vì tăng số lần retry/wait time chỉ **trì hoãn** vấn đề chứ không giải quyết triệt để — nếu network issue kéo dài hơn tổng thời gian retry, event vẫn bị mất vĩnh viễn sau khi hết retry, không đảm bảo "eventually processed". A và B sai vì đều không liên quan đến nguyên nhân gốc (network connectivity issues gây fail invocation) — multi-AZ deployment hay tăng CPU/memory không giúp giữ lại event bị lỗi để xử lý lại.

---

## Question 17

A company runs multiple workloads on virtual machines (VMs) in an on-premises data center. The company is expanding rapidly. The on-premises data center is not able to scale fast enough to meet business needs. The company wants to migrate the workloads to AWS.

The migration is time sensitive. The company wants to use a lift-and-shift strategy for non-critical workloads.

**Which combination of steps will meet these requirements? (Choose three.)**

A. Use the AWS Schema Conversion Tool (AWS SCT) to collect data about the VMs.
B. Use AWS Application Migration Service. Install the AWS Replication Agent on the VMs.
C. Complete the initial replication of the VMs. Launch test instances to perform acceptance tests on the VMs.
D. Stop all operations on the VMs. Launch a cutover instance.
E. Use AWS App2Container (A2C) to collect data about the VMs.
F. Use AWS Database Migration Service (AWS DMS) to migrate the VMs.

**Answer: B, C, D**

**Explanation:** Đây là quy trình chuẩn (migration lifecycle) của **AWS Application Migration Service (MGN)** — dịch vụ chính thức của AWS cho chiến lược **lift-and-shift**: B) Cài đặt **AWS Replication Agent** lên các VM nguồn để bắt đầu replicate dữ liệu sang AWS. C) Sau khi **replication hoàn tất**, launch **test instance** để chạy acceptance test, kiểm tra ứng dụng hoạt động đúng trên AWS trước khi chuyển hẳn. D) Khi đã sẵn sàng, **dừng hoạt động trên VM nguồn** và launch **cutover instance** — đây là bước chuyển đổi chính thức (production traffic chuyển hẳn sang AWS). A sai vì **AWS SCT (Schema Conversion Tool)** dùng để chuyển đổi **schema database** (ví dụ Oracle → PostgreSQL), không liên quan đến lift-and-shift VM. E sai vì **App2Container** dùng để **container hóa ứng dụng** (chuyển app thành container image), đây là chiến lược "re-platform", không phải lift-and-shift nguyên VM. F sai vì **AWS DMS** dùng để migrate **database**, không phải để migrate nguyên VM/workload.

---

## Question 18

A security team wants to limit access to specific services or actions in all of the team's AWS accounts. All accounts belong to a large organization in AWS Organizations. The solution must be scalable and there must be a single point where permissions can be maintained.

**What should a solutions architect do to accomplish this?**

A. Create an ACL to provide access to the services or actions.
B. Create a security group to allow accounts and attach it to user groups.
C. Create cross-account roles in each account to deny access to the services or actions.
D. Create a service control policy in the root organizational unit to deny access to the services or actions.

**Answer: D**

**Explanation:** **Service Control Policy (SCP)** là tính năng của **AWS Organizations**, cho phép định nghĩa policy giới hạn quyền (deny/allow) ở cấp **Organizational Unit (OU) hoặc root** — áp dụng cho tất cả account nằm trong OU/root đó cùng lúc. Đặt SCP ở **root OU** → áp dụng cho toàn bộ accounts trong tổ chức, đúng yêu cầu "single point where permissions can be maintained" (quản lý tập trung 1 chỗ) + "scalable" (account mới thêm vào tự động bị áp policy, không cần cấu hình lại). B sai vì **Security Group không dùng để giới hạn quyền truy cập service/action ở cấp account** — đây là network-level firewall (kiểm soát traffic cho EC2, ELB, RDS...), hoàn toàn không liên quan đến IAM permissions/service access. A sai vì **ACL** thường dùng ở cấp network (Network ACL trong VPC) hoặc S3, không phải cơ chế giới hạn service/action ở cấp account trong Organizations. C sai vì tạo cross-account roles **trong từng account riêng lẻ** phải cấu hình lặp lại thủ công ở mỗi account → không phải "single point of maintenance", không scalable khi số account tăng lên.

*(Lưu ý: đáp án bạn gửi là B, nhưng đáp án đúng là D — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 19

A company needs to retain application log files for a critical application for 10 years. The application team regularly accesses logs from the past month for troubleshooting, but logs older than 1 month are rarely accessed. The application generates more than 10 TB of logs per month.

**Which storage option meets these requirements MOST cost-effectively?**

A. Store the logs in Amazon S3. Use AWS Backup to move logs more than 1 month old to S3 Glacier Deep Archive.
B. Store the logs in Amazon S3. Use S3 Lifecycle policies to move logs more than 1 month old to S3 Glacier Deep Archive.
C. Store the logs in Amazon CloudWatch Logs. Use AWS Backup to move logs more than 1 month old to S3 Glacier Deep Archive.
D. Store the logs in Amazon CloudWatch Logs. Use Amazon S3 Lifecycle policies to move logs more than 1 month old to S3 Glacier Deep Archive.

**Answer: B**

**Explanation:** Lưu log trực tiếp trong **Amazon S3** (rẻ hơn nhiều so với CloudWatch Logs cho khối lượng lớn — 10TB/tháng), dùng **S3 Lifecycle policies** (tính năng có sẵn, miễn phí cấu hình) để tự động chuyển log cũ hơn 1 tháng sang **S3 Glacier Deep Archive** (storage class rẻ nhất, phù hợp lưu trữ dài hạn 10 năm, ít truy cập). Đây là kiến trúc đơn giản, native, chi phí thấp nhất. D sai vì lưu log trong **CloudWatch Logs** có chi phí ingest + storage đắt hơn đáng kể so với S3 khi khối lượng log lớn; ngoài ra **"S3 Lifecycle policies" không áp dụng trực tiếp lên CloudWatch Logs** — CloudWatch Logs không phải object lưu trong S3, nên không thể dùng S3 Lifecycle để tự động chuyển log sang Glacier theo cách mô tả. A sai vì kiến trúc S3 đúng, nhưng dùng **AWS Backup** để chuyển log sang Glacier Deep Archive không phải cách làm chuẩn/tối ưu — AWS Backup thiết kế cho việc backup tài nguyên (EBS, RDS, DynamoDB...), không phải công cụ chuyên dùng để quản lý storage class transition trong S3, tạo thêm chi phí/phức tạp không cần thiết so với S3 Lifecycle (native, miễn phí). C sai vì kết hợp cả 2 vấn đề của A và D.

*(Lưu ý: đáp án bạn gửi là D, nhưng đáp án đúng là B — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 20

A medical records company is hosting an application on Amazon EC2 instances. The application processes customer data files that are stored on Amazon S3. The EC2 instances are hosted in public subnets. The EC2 instances access Amazon S3 over the internet, but they do not require any other network access.

A new requirement mandates that the network traffic for file transfers take a private route and not be sent over the internet.

**Which change to the network architecture should a solutions architect recommend to meet this requirement?**

A. Create a NAT gateway. Configure the route table for the public subnets to send traffic to Amazon S3 through the NAT gateway.
B. Configure the security group for the EC2 instances to restrict outbound traffic so that only traffic to the S3 prefix list is permitted.
C. Move the EC2 instances to private subnets. Create a VPC endpoint for Amazon S3, and link the endpoint to the route table for the private subnets.
D. Remove the internet gateway from the VPC. Set up an AWS Direct Connect connection, and route traffic to Amazon S3 over the Direct Connect connection.

**Answer: C**

**Explanation:** Chuyển EC2 vào **private subnet** (loại bỏ hoàn toàn đường ra internet trực tiếp) và tạo **VPC Endpoint cho S3** (Gateway Endpoint) — endpoint này cho phép traffic đi từ VPC đến S3 **hoàn toàn trong mạng nội bộ AWS**, không đi qua internet, đúng yêu cầu "private route, not sent over the internet". A sai vì **NAT Gateway vẫn đi qua Internet Gateway ra internet** để đến S3 — chỉ là NAT giúp EC2 trong private subnet có thể ra internet, traffic vẫn "public route" về bản chất, không thỏa yêu cầu. B sai vì Security Group chỉ kiểm soát **traffic nào được phép** (allow/deny), không thay đổi **đường đi (route)** của traffic — traffic vẫn đi qua Internet Gateway ra ngoài như cũ. D sai vì **Direct Connect dùng để kết nối on-premises datacenter với AWS**, không cần thiết và không phù hợp khi EC2 đã nằm sẵn trong VPC — đây là kiến trúc sai mục đích, thừa thãi và tốn kém không cần thiết.

---

## Question 21

A company is concerned about the security of its public web application due to recent web attacks. The application uses an Application Load Balancer (ALB). A solutions architect must reduce the risk of DDoS attacks against the application.

**What should the solutions architect do to meet this requirement?**

A. Add an Amazon Inspector agent to the ALB.
B. Configure Amazon Macie to prevent attacks.
C. Enable AWS Shield Advanced to prevent attacks.
D. Configure Amazon GuardDuty to monitor the ALB.

**Answer: C**

**Explanation:** **AWS Shield Advanced** là dịch vụ chuyên biệt để **bảo vệ và giảm thiểu (mitigate) tấn công DDoS** cho các resource như ALB, CloudFront, Route 53... — đúng nghĩa "reduce the risk of DDoS attacks". A sai vì **Amazon Inspector** dùng để **quét lỗ hổng bảo mật (vulnerability assessment)** trên EC2/container image/Lambda, không liên quan đến DDoS. B sai vì **Amazon Macie** dùng để **phát hiện dữ liệu nhạy cảm (sensitive data discovery)** trong S3 (PII, thông tin thẻ tín dụng...), không phải công cụ chống DDoS. D sai vì **Amazon GuardDuty** là dịch vụ **phát hiện mối đe dọa (threat detection)** — chỉ giám sát và cảnh báo (monitor), không có khả năng **ngăn chặn/giảm thiểu (prevent/mitigate)** tấn công như Shield Advanced.

---

## Question 22

A company runs its ecommerce application on AWS. Every new order is published as a message in a RabbitMQ queue that runs on an Amazon EC2 instance in a single Availability Zone. These messages are processed by a different application that runs on a separate EC2 instance. This application stores the details in a PostgreSQL database on another EC2 instance. All the EC2 instances are in the same Availability Zone.

The company needs to redesign its architecture to provide the highest availability with the least operational overhead.

**What should a solutions architect do to meet these requirements?**

A. Migrate the queue to a redundant pair (active/standby) of RabbitMQ instances on Amazon MQ. Create a Multi-AZ Auto Scaling group for EC2 instances that host the application. Create another Multi-AZ Auto Scaling group for EC2 instances that host the PostgreSQL database.
B. Migrate the queue to a redundant pair (active/standby) of RabbitMQ instances on Amazon MQ. Create a Multi-AZ Auto Scaling group for EC2 instances that host the application. Migrate the database to run on a Multi-AZ deployment of Amazon RDS for PostgreSQL.
C. Create a Multi-AZ Auto Scaling group for EC2 instances that host the RabbitMQ queue. Create another Multi-AZ Auto Scaling group for EC2 instances that host the application. Migrate the database to run on a Multi-AZ deployment of Amazon RDS for PostgreSQL.
D. Create a Multi-AZ Auto Scaling group for EC2 instances that host the RabbitMQ queue. Create another Multi-AZ Auto Scaling group for EC2 instances that host the application. Create a third Multi-AZ Auto Scaling group for EC2 instances that host the PostgreSQL database.

**Answer: B**

**Explanation:** Yêu cầu "highest availability + LEAST operational overhead" → ưu tiên managed service thay vì tự vận hành. Migrate RabbitMQ queue sang **Amazon MQ** (dịch vụ managed, tương thích RabbitMQ, hỗ trợ sẵn active/standby Multi-AZ — AWS tự lo failover) → loại bỏ việc tự quản lý cluster message queue. Application chạy trên **Multi-AZ Auto Scaling group** (đảm bảo HA cho tầng xử lý). Database migrate sang **Amazon RDS for PostgreSQL Multi-AZ** (managed database, tự động failover, tự backup/patch) → loại bỏ việc tự quản lý PostgreSQL trên EC2. C sai vì vẫn giữ **RabbitMQ chạy trên EC2 tự quản lý** (chỉ thêm Multi-AZ Auto Scaling group) — công ty vẫn phải tự cài đặt, patch, cấu hình clustering cho RabbitMQ, không giảm được operational overhead như dùng Amazon MQ managed; việc "Auto Scaling" một message queue tự vận hành trên EC2 cũng khá rủi ro về kiến trúc (dễ gây vấn đề trùng lặp consumer, thứ tự message). A sai vì giống B ở phần queue + application, nhưng database vẫn chạy trên EC2 tự quản lý (chỉ thêm Multi-AZ ASG) thay vì dùng RDS managed → vẫn phải tự vận hành PostgreSQL, backup, failover thủ công. D sai vì cả 3 tầng (queue, application, database) đều tự vận hành trên EC2 (dù có Multi-AZ ASG) — không tận dụng bất kỳ managed service nào, operational overhead cao nhất trong 4 đáp án.

*(Lưu ý: đáp án bạn gửi là C, nhưng đáp án đúng là B — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 23

A company collects data for temperature, humidity, and atmospheric pressure in cities across multiple continents. The average volume of data that the company collects from each site daily is 500 GB. Each site has a high-speed Internet connection.

The company wants to aggregate the data from all these global sites as quickly as possible in a single Amazon S3 bucket. The solution must minimize operational complexity.

**Which solution meets these requirements?**

A. Turn on S3 Transfer Acceleration on the destination S3 bucket. Use multipart uploads to directly upload site data to the destination S3 bucket.
B. Upload the data from each site to an S3 bucket in the closest Region. Use S3 Cross-Region Replication to copy objects to the destination S3 bucket. Then remove the data from the origin S3 bucket.
C. Schedule AWS Snowball Edge Storage Optimized device jobs daily to transfer data from each site to the closest Region. Use S3 Cross-Region Replication to copy objects to the destination S3 bucket.
D. Upload the data from each site to an Amazon EC2 instance in the closest Region. Store the data in an Amazon Elastic Block Store (Amazon EBS) volume. At regular intervals, take an EBS snapshot and copy it to the Region that contains the destination S3 bucket. Restore the EBS volume in that Region.

**Answer: A**

**Explanation:** Mỗi site đã có **high-speed Internet connection**, khối lượng dữ liệu 500GB/ngày không quá lớn đến mức cần giải pháp offline. **S3 Transfer Acceleration** tận dụng mạng lưới CloudFront edge để tăng tốc upload từ xa tới bucket đích, kết hợp **multipart upload** (chia file lớn thành nhiều phần upload song song) → upload trực tiếp 1 bước vào đúng bucket đích. Đây là giải pháp đơn giản nhất (bật tính năng có sẵn, không cần hạ tầng trung gian) — đúng nghĩa "minimize operational complexity" + "as quickly as possible". B sai vì phức tạp hơn không cần thiết: phải tạo bucket trung gian ở từng Region, cấu hình Cross-Region Replication để copy sang bucket đích, rồi còn phải tự xóa dữ liệu ở bucket gốc sau khi replicate xong. C sai vì **AWS Snowball Edge** dùng cho trường hợp không có kết nối internet tốt hoặc cần chuyển khối lượng dữ liệu cực lớn theo cách offline — ở đây các site đã có high-speed internet sẵn, dùng Snowball vừa thừa thãi vừa chậm hơn, lại tốn nhiều công sức vận hành nhất. D sai vì phức tạp và chậm nhất: phải dựng EC2 + EBS ở từng site, định kỳ snapshot, copy snapshot sang Region đích, rồi restore lại thành EBS volume.

*(Lưu ý: đáp án bạn gửi là B, nhưng đáp án đúng là A — đã ghi chú lại theo kết quả kiểm chứng.)*

---

## Question 24

A company is running a multi-tier web application on premises. The web application is containerized and runs on a number of Linux hosts connected to a PostgreSQL database that contains user records. The operational overhead of maintaining the infrastructure and capacity planning is limiting the company's growth. A solutions architect must improve the application's infrastructure.

**Which combination of actions should the solutions architect take to accomplish this? (Choose two.)**

A. Migrate the PostgreSQL database to Amazon Aurora.
B. Migrate the web application to be hosted on Amazon EC2 instances.
C. Set up an Amazon CloudFront distribution for the web application content.
D. Set up Amazon ElastiCache between the web application and the PostgreSQL database.
E. Migrate the web application to be hosted on AWS Fargate with Amazon Elastic Container Service (Amazon ECS).

**Answer: A, E**

**Explanation:** Vấn đề cốt lõi là "**operational overhead của việc duy trì infrastructure và capacity planning**" — cần giải pháp **managed/serverless** để loại bỏ gánh nặng quản lý hạ tầng. A: Migrate database sang **Amazon Aurora** — managed database service, tự động backup/patch/scale storage, loại bỏ việc tự vận hành PostgreSQL trên host. E: Migrate web app sang **AWS Fargate + ECS** — serverless container hosting, AWS tự lo capacity/provisioning cho container, không cần tự quản lý fleet Linux host hay tự làm capacity planning nữa — giải quyết trực tiếp đúng vấn đề đề bài nêu. B sai vì "migrate sang EC2 instances" vẫn là tự quản lý server, vẫn phải tự làm capacity planning — không giải quyết được vấn đề gốc, thậm chí còn mất đi lợi ích của containerization hiện tại. C sai vì CloudFront chỉ cải thiện performance/caching cho content phân phối tới người dùng, không liên quan đến việc giảm operational overhead của hạ tầng compute/capacity planning. D sai vì ElastiCache chỉ thêm caching layer cải thiện performance truy vấn database, không giải quyết vấn đề vận hành hạ tầng/capacity planning được nêu trong đề.

---

## Question 25

A company is preparing to store confidential data in Amazon S3. For compliance reasons, the data must be encrypted at rest. Encryption key usage must be logged for auditing purposes. Keys must be rotated every year.

**Which solution meets these requirements and is the MOST operationally efficient?**

A. Server-side encryption with customer-provided keys (SSE-C)
B. Server-side encryption with Amazon S3 managed keys (SSE-S3)
C. Server-side encryption with AWS KMS keys (SSE-KMS) with manual rotation
D. Server-side encryption with AWS KMS keys (SSE-KMS) with automatic rotation

**Answer: D**

**Explanation:** Đề bài có 3 yêu cầu: (1) mã hóa at rest, (2) **log lại việc sử dụng key để audit**, (3) **rotate key mỗi năm** — và cần giải pháp **MOST operationally efficient** (ít công sức vận hành nhất). **SSE-KMS** tích hợp sẵn với **AWS CloudTrail** — mọi lần key được dùng để encrypt/decrypt đều tự động được ghi log, đáp ứng yêu cầu audit. Với **automatic rotation**, KMS tự động rotate key mỗi năm mà không cần ai can thiệp thủ công → đáp ứng cả yêu cầu rotation lẫn "most operationally efficient" cùng lúc. C sai vì tuy cũng dùng SSE-KMS (có audit log qua CloudTrail), nhưng **manual rotation** yêu cầu người vận hành phải tự thực hiện thao tác rotate hàng năm → tốn công sức hơn, không phải lựa chọn tối ưu khi đã có sẵn tùy chọn automatic. A sai vì **SSE-C** (customer-provided key) bắt khách hàng tự quản lý, tự lưu trữ, và tự rotate key hoàn toàn thủ công — không có cơ chế audit log tích hợp qua CloudTrail cho việc sử dụng key, operational overhead cao nhất. B sai vì **SSE-S3** dùng key do chính S3 quản lý hoàn toàn ẩn với người dùng — không thể log lại việc sử dụng key qua CloudTrail (không đáp ứng yêu cầu audit), và người dùng cũng không kiểm soát được việc rotation.

---

## Question 26

A company is migrating its on-premises PostgreSQL database to Amazon Aurora PostgreSQL. The on-premises database must remain online and accessible during the migration. The Aurora database must remain synchronized with the on-premises database.

**Which combination of actions must a solutions architect take to meet these requirements? (Choose two.)**

A. Create an ongoing replication task.
B. Create a database backup of the on-premises database.
C. Create an AWS Database Migration Service (AWS DMS) replication server.
D. Convert the database schema by using the AWS Schema Conversion Tool (AWS SCT).
E. Create an Amazon EventBridge (Amazon CloudWatch Events) rule to monitor the database synchronization.

**Answer: A, C**

**Explanation:** Yêu cầu "on-premises DB remain online" + "Aurora remain synchronized" (đồng bộ liên tục) là dấu hiệu kinh điển của **AWS DMS (Database Migration Service)** — dịch vụ chuyên cho migration mà nguồn vẫn hoạt động bình thường trong suốt quá trình. C: Cần tạo **DMS replication server** — đây là hạ tầng (compute) chạy replication instance để thực hiện việc di chuyển/đồng bộ dữ liệu. A: Cần tạo **ongoing replication task** — task này thực hiện full load ban đầu + **CDC (Change Data Capture)** để liên tục đồng bộ các thay đổi mới từ on-premises sang Aurora, đáp ứng đúng yêu cầu "remain synchronized". D sai vì **AWS SCT (Schema Conversion Tool)** chỉ cần thiết khi migration **khác engine database** (ví dụ Oracle → PostgreSQL) để chuyển đổi schema — ở đây nguồn và đích đều là **PostgreSQL** (homogeneous migration), schema tương thích sẵn, không cần SCT. B sai vì tạo backup chỉ phù hợp cho di chuyển one-time/cutover, không đáp ứng yêu cầu đồng bộ liên tục trong khi on-premises vẫn đang hoạt động. E sai vì EventBridge rule chỉ dùng để **giám sát/thông báo (monitor)**, không phải công cụ thực hiện việc đồng bộ dữ liệu — không đáp ứng trực tiếp yêu cầu "remain synchronized".

---

## Question 27

A company runs a stateless web application in production on a group of Amazon EC2 On-Demand Instances behind an Application Load Balancer. The application experiences heavy usage during an 8-hour period each business day. Application usage is moderate and steady overnight. Application usage is low during weekends.

The company wants to minimize its EC2 costs without affecting the availability of the application.

**Which solution will meet these requirements?**

A. Use Spot Instances for the entire workload.
B. Use Reserved Instances for the baseline level of usage. Use Spot instances for any additional capacity that the application needs.
C. Use On-Demand Instances for the baseline level of usage. Use Spot Instances for any additional capacity that the application needs.
D. Use Dedicated Instances for the baseline level of usage. Use On-Demand Instances for any additional capacity that the application needs.

**Answer: B**

**Explanation:** Ứng dụng có mức sử dụng **luôn có mặt/nền tảng (baseline)** — vì "moderate and steady overnight" nghĩa là ngay cả ban đêm vẫn có traffic ổn định, tức là có 1 mức sử dụng **liên tục, dự đoán được (steady-state)** xuyên suốt → phù hợp cam kết dài hạn với **Reserved Instances** để được giá rẻ hơn cho phần baseline này. Vì ứng dụng **stateless** (không lưu state trên instance, dễ dàng bị thay thế mà không mất dữ liệu), phần **capacity tăng thêm trong 8 giờ cao điểm** an toàn để dùng **Spot Instances** (rẻ hơn nhiều so với On-Demand, chấp nhận bị gián đoạn vì có ALB + nhiều instance phía sau, mất 1 instance không ảnh hưởng tổng thể). A sai vì dùng Spot cho **toàn bộ workload** kể cả phần baseline ổn định — rủi ro ảnh hưởng đến availability nếu Spot bị thu hồi hàng loạt đúng lúc cao điểm, không tối ưu vì phần baseline dự đoán được nên dùng RI sẽ rẻ và ổn định hơn. C sai vì dùng On-Demand cho baseline không tối ưu chi phí bằng Reserved Instances — phần baseline đã biết trước là sử dụng liên tục nên cam kết RI sẽ tiết kiệm hơn nhiều so với trả giá On-Demand đầy đủ. D sai vì Dedicated Instances (instance chạy trên phần cứng vật lý riêng biệt) đắt hơn nhiều so với Reserved Instances thông thường mà không mang lại lợi ích gì thêm cho bài toán này, và phần capacity tăng thêm dùng On-Demand thay vì Spot sẽ tốn kém hơn không cần thiết cho ứng dụng stateless.

---

## Question 28

A company is running an online transaction processing (OLTP) workload on AWS. This workload uses an unencrypted Amazon RDS DB instance in a Multi-AZ deployment. Daily database snapshots are taken from this instance.

**What should a solutions architect do to ensure the database and snapshots are always encrypted moving forward?**

A. Encrypt a copy of the latest DB snapshot. Replace existing DB instance by restoring the encrypted snapshot.
B. Create a new encrypted Amazon Elastic Block Store (Amazon EBS) volume and copy the snapshots to it. Enable encryption on the DB instance.
C. Copy the snapshots and enable encryption using AWS Key Management Service (AWS KMS). Restore encrypted snapshot to an existing DB instance.
D. Copy the snapshots to an Amazon S3 bucket that is encrypted using server-side encryption with AWS Key Management Service (AWS KMS) managed keys (SSE-KMS).

**Answer: A**

**Explanation:** Amazon RDS **không hỗ trợ "bật" encryption trực tiếp lên 1 DB instance đang unencrypted có sẵn** — đây là giới hạn kỹ thuật cố định của RDS. Quy trình chuẩn: **copy snapshot** hiện có (khi copy snapshot, RDS cho phép **bật encryption** cho bản copy đó bằng KMS key) → sau đó **restore snapshot đã mã hóa đó thành 1 DB instance MỚI** (restore luôn tạo ra instance mới, không thể áp lên instance cũ) → dùng instance mới này **thay thế** instance cũ. Từ thời điểm này, vì DB instance gốc đã encrypted, **mọi snapshot chụp sau đó từ instance này sẽ tự động được encrypted theo** — đáp ứng đúng yêu cầu "database and snapshots are always encrypted moving forward". C sai vì **restore snapshot luôn tạo ra 1 DB instance mới**, không thể "restore vào 1 existing DB instance" như mô tả — đây là điều không khả thi về mặt kỹ thuật trong RDS. B sai vì việc tạo EBS volume riêng và "enable encryption on the DB instance" không phải cách RDS hoạt động — RDS không cho phép bật encryption trực tiếp lên instance đang chạy, và thao tác với EBS volume thủ công không áp dụng được cho kiến trúc RDS managed. D sai vì copy snapshot RDS sang S3 bucket không tạo ra được 1 DB instance khả dụng — đây không phải cách để có một database instance đã mã hóa, chỉ đơn thuần lưu trữ dữ liệu snapshot dưới dạng file trong S3.

---

## Question 29

A company sells ringtones created from clips of popular songs. The files containing the ringtones are stored in Amazon S3 Standard and are at least 128 KB in size. The company has millions of files, but downloads are infrequent for ringtones older than 90 days. The company needs to save money on storage while keeping the most accessed files readily available for its users.

**Which action should the company take to meet these requirements MOST cost-effectively?**

A. Configure S3 Standard-Infrequent Access (S3 Standard-IA) storage for the initial storage tier of the objects.
B. Move the files to S3 Intelligent-Tiering and configure it to move objects to a less expensive storage tier after 90 days.
C. Configure S3 inventory to manage objects and move them to S3 Standard-Infrequent Access (S3 Standard-IA) after 90 days.
D. Implement an S3 Lifecycle policy that moves the objects from S3 Standard to S3 Standard-Infrequent Access (S3 Standard-1A) after 90 days.

**Answer: D**

**Explanation:** Vì access pattern đã **biết trước rõ ràng** (file mới thường xuyên được tải, sau 90 ngày thì ít được truy cập) → dùng **S3 Lifecycle policy** đơn giản, tự động, miễn phí cấu hình để chuyển object từ S3 Standard sang **S3 Standard-IA** đúng sau 90 ngày — đây là cách "MOST cost-effective" vì không tốn thêm phí giám sát nào. Chi tiết "**at least 128 KB**" trong đề là gợi ý quan trọng: S3 Standard-IA có **minimum billable object size là 128KB** — object nhỏ hơn mức này khi chuyển sang Standard-IA sẽ bị tính phí như thể đủ 128KB (phát sinh phí phụ trội không cần thiết), nên việc file trong đề đã ≥128KB nghĩa là chuyển sang Standard-IA **không bị phạt phí** này, khẳng định đây là lựa chọn hợp lý. B sai vì **S3 Intelligent-Tiering** phù hợp khi access pattern **không đoán trước được** — nó tính thêm **phí giám sát (monitoring fee)** hàng tháng cho mỗi object để tự động theo dõi và chuyển tier, nhưng ở đây pattern đã biết trước rõ ràng (90 ngày) nên dùng Lifecycle policy trực tiếp rẻ hơn, không cần trả thêm phí monitoring. A sai vì đặt file mới upload thẳng vào Standard-IA ngay từ đầu là sai — trong 90 ngày đầu file được truy cập thường xuyên, Standard-IA có phí retrieval cao hơn Standard nên sẽ tốn kém hơn cho giai đoạn truy cập nhiều này. C sai vì **S3 Inventory** chỉ là công cụ **báo cáo/liệt kê** danh sách object (xuất ra file CSV/ORC), không phải cơ chế để **tự động di chuyển** object giữa các storage class.

---

## Question 30

A company has a highly dynamic batch processing job that uses many Amazon EC2 instances to complete it. The job is stateless in nature, can be started and stopped at any given time with no negative impact, and typically takes upwards of 60 minutes total to complete. The company has asked a solutions architect to design a scalable and cost-effective solution that meets the requirements of the job.

**What should the solutions architect recommend?**

A. Implement EC2 Spot Instances.
B. Purchase EC2 Reserved Instances.
C. Implement EC2 On-Demand Instances.
D. Implement the processing on AWS Lambda.

**Answer: A**

**Explanation:** Job có đầy đủ đặc điểm kinh điển để dùng **Spot Instances**: **stateless** (không mất dữ liệu quan trọng khi instance bị dừng đột ngột), **"can be started and stopped at any given time with no negative impact"** (chấp nhận hoàn toàn việc bị gián đoạn), và **"highly dynamic"** (nhu cầu capacity thay đổi linh hoạt) → Spot Instances cho phép chạy với giá rẻ hơn nhiều so với On-Demand mà không lo về rủi ro gián đoạn vì job đã thiết kế để chịu được điều đó. D sai vì **AWS Lambda có giới hạn thời gian chạy tối đa 15 phút/lần invoke**, trong khi job này "**takes upwards of 60 minutes**" để hoàn thành — vượt quá giới hạn của Lambda, không thể chạy trực tiếp trên Lambda như mô tả trong đề (trừ khi tái thiết kế để chia nhỏ job — nhưng đề không yêu cầu việc đó). B sai vì Reserved Instances yêu cầu cam kết dài hạn cho usage ổn định, không phù hợp với batch job "**highly dynamic**" (nhu cầu thay đổi thất thường), dễ dẫn đến lãng phí capacity đã cam kết. C sai vì On-Demand không tối ưu chi phí bằng Spot cho loại workload chấp nhận gián đoạn này — "cost-effective" là yêu cầu rõ ràng trong đề, nên Spot luôn được ưu tiên hơn khi điều kiện phù hợp.

---

## Question 31

An application runs on Amazon EC2 instances across multiple Availability Zones. The instances run in an Amazon EC2 Auto Scaling group behind an Application Load Balancer. The application performs best when the CPU utilization of the EC2 instances is at or near 40%.

**What should a solutions architect do to maintain the desired performance across all instances in the group?**

A. Use a simple scaling policy to dynamically scale the Auto Scaling group.
B. Use a target tracking policy to dynamically scale the Auto Scaling group.
C. Use an AWS Lambda function to update the desired Auto Scaling group capacity.
D. Use scheduled scaling actions to scale up and scale down the Auto Scaling group.

**Answer: B**

**Explanation:** Yêu cầu duy trì một **giá trị mục tiêu cụ thể** của metric (CPU utilization ở mức ~40%) chính là định nghĩa của **Target Tracking Scaling Policy** — bạn chỉ cần khai báo target value (ví dụ: target CPU = 40%), Auto Scaling sẽ **tự động tính toán và điều chỉnh capacity liên tục** để đưa CPU trung bình về gần đúng mức mục tiêu đó, không cần tự định nghĩa ngưỡng/hành động scale thủ công. A sai vì **Simple Scaling Policy** chỉ phản ứng theo **1 CloudWatch alarm đơn lẻ**, thêm/bớt 1 lượng capacity cố định mỗi lần trigger, rồi phải chờ cooldown — không "theo dõi và giữ" một target value liên tục như target tracking, kém chính xác hơn cho yêu cầu này. C sai vì dùng Lambda để tự cập nhật desired capacity là giải pháp **tự xây dựng thủ công**, tốn công sức phát triển/vận hành không cần thiết khi AWS đã có sẵn tính năng target tracking đáp ứng đúng nhu cầu. D sai vì **Scheduled Scaling** dựa vào **lịch thời gian cố định** (dự đoán trước theo giờ/ngày), không phản ứng theo giá trị CPU thực tế — không đảm bảo CPU luôn ở gần 40% nếu traffic thực tế không khớp đúng với lịch đã đặt.

---

## Question 32

A global company hosts its web application on Amazon EC2 instances behind an Application Load Balancer (ALB). The web application has static data and dynamic data. The company stores its static data in an Amazon S3 bucket. The company wants to improve performance and reduce latency for the static data and dynamic data. The company is using its own domain name registered with Amazon Route 53.

**What should a solutions architect do to meet these requirements?**

A. Create an Amazon CloudFront distribution that has the S3 bucket and the ALB as origins. Configure Route 53 to route traffic to the CloudFront distribution.
B. Create an Amazon CloudFront distribution that has the ALB as an origin. Create an AWS Global Accelerator standard accelerator that has the S3 bucket as an endpoint. Configure Route 53 to route traffic to the CloudFront distribution.
C. Create an Amazon CloudFront distribution that has the S3 bucket as an origin. Create an AWS Global Accelerator standard accelerator that has the ALB and the CloudFront distribution as endpoints. Create a custom domain name that points to the accelerator DNS name. Use the custom domain name as an endpoint for the web application.
D. Create an Amazon CloudFront distribution that has the ALB as an origin. Create an AWS Global Accelerator standard accelerator that has the S3 bucket as an endpoint. Create two domain names. Point one domain name to the CloudFront DNS name for dynamic content. Point the other domain name to the accelerator DNS name for static content. Use the domain names as endpoints for the web application.

**Answer: A**

**Explanation:** **CloudFront hỗ trợ multi-origin distribution** — có thể gắn **nhiều origin** vào cùng 1 distribution (S3 bucket cho static data, ALB cho dynamic data), rồi dùng **cache behavior** (dựa trên path pattern, ví dụ `/static/*` → S3, mặc định → ALB) để định tuyến đúng loại request đến đúng origin. CloudFront không chỉ cache tốt static content mà còn tối ưu đường truyền (qua mạng lưới AWS backbone) cho cả dynamic content không cache được, giảm latency cho cả 2 loại dữ liệu chỉ với **1 distribution duy nhất**. Route 53 chỉ cần trỏ domain về CloudFront — đơn giản, đúng kiến trúc chuẩn. B, C, D đều sai vì cùng mắc lỗi kỹ thuật: **AWS Global Accelerator không hỗ trợ Amazon S3 bucket làm endpoint** — Global Accelerator chỉ hoạt động với ALB, NLB, EC2 instance, Elastic IP, không thể trỏ trực tiếp vào S3 (đây là bẫy lặp lại từ Question 12). Ngoài ra các đáp án này còn phức tạp hóa không cần thiết bằng cách tách static/dynamic thành 2 domain riêng hoặc kết hợp CloudFront + Global Accelerator không đúng mục đích, trong khi CloudFront multi-origin đã giải quyết được toàn bộ yêu cầu chỉ với 1 kiến trúc đơn giản.

---

## Question 33

A company's containerized application runs on an Amazon EC2 instance. The application needs to download security certificates before it can communicate with other business applications. The company wants a highly secure solution to encrypt and decrypt the certificates in near real time. The solution also needs to store data in highly available storage after the data is encrypted.

**Which solution will meet these requirements with the LEAST operational overhead?**

A. Create AWS Secrets Manager secrets for encrypted certificates. Manually update the certificates as needed. Control access to the data by using fine-grained IAM access.
B. Create an AWS Lambda function that uses the Python cryptography library to receive and perform encryption operations. Store the function in an Amazon S3 bucket.
C. Create an AWS Key Management Service (AWS KMS) customer managed key. Allow the EC2 role to use the KMS key for encryption operations. Store the encrypted data on Amazon S3.
D. Create an AWS Key Management Service (AWS KMS) customer managed key. Allow the EC2 role to use the KMS key for encryption operations. Store the encrypted data on Amazon Elastic Block Store (Amazon EBS) volumes.

**Answer: C**

**Explanation:** **AWS KMS customer managed key** cho phép mã hóa/giải mã **near real time** thông qua API call đơn giản, được quản lý hoàn toàn bởi AWS (không cần tự xây dựng logic crypto) — đúng nghĩa "LEAST operational overhead" cho yêu cầu mã hóa/giải mã. Gắn quyền dùng key này cho **EC2 role** để instance có thể gọi KMS thực hiện encrypt/decrypt certificate khi cần. Lưu dữ liệu đã mã hóa trên **Amazon S3** — S3 là "highly available storage" đúng nghĩa (tự động replicate dữ liệu qua nhiều Availability Zone, độ bền 11 số 9), đáp ứng đúng yêu cầu "highly available storage" trong đề. D sai vì **Amazon EBS volume chỉ tồn tại trong 1 Availability Zone duy nhất** — không được xem là "highly available storage" theo đúng nghĩa multi-AZ như S3, dù dữ liệu trong 1 AZ có được replicate nội bộ, EBS vẫn có rủi ro mất availability nếu cả AZ đó gặp sự cố. A sai vì **AWS Secrets Manager** phù hợp cho việc lưu trữ **secret dạng thông tin xác thực (credentials, API key)** với khả năng rotation tự động — nhưng đề bài yêu cầu "**manually update the certificates as needed**", nghĩa là mất đi lợi thế tự động của Secrets Manager, và Secrets Manager không phải là giải pháp tối ưu cho việc mã hóa/giải mã dữ liệu bất kỳ (certificate) theo yêu cầu near real time tổng quát như KMS. B sai vì tự viết Lambda function dùng thư viện crypto Python là giải pháp **tự xây dựng thủ công (custom-built)** — tốn công phát triển, kiểm thử, bảo trì logic mã hóa riêng, operational overhead cao hơn nhiều so với việc gọi trực tiếp API của KMS (dịch vụ managed có sẵn).

---

## Question 34

A company recently migrated a message processing system to AWS. The system receives messages into an ActiveMQ queue running on an Amazon EC2 instance. Messages are processed by a consumer application running on Amazon EC2. The consumer application processes the messages and writes results to a MySQL database running on Amazon EC2. The company wants this application to be highly available with low operational complexity.

**Which architecture offers the HIGHEST availability?**

A. Add a second ActiveMQ server to another Availability Zone. Add an additional consumer EC2 instance in another Availability Zone. Replicate the MySQL database to another Availability Zone.
B. Use Amazon MQ with active/standby brokers configured across two Availability Zones. Add an additional consumer EC2 instance in another Availability Zone. Replicate the MySQL database to another Availability Zone.
C. Use Amazon MQ with active/standby brokers configured across two Availability Zones. Add an additional consumer EC2 instance in another Availability Zone. Use Amazon RDS for MySQL with Multi-AZ enabled.
D. Use Amazon MQ with active/standby brokers configured across two Availability Zones. Add an Auto Scaling group for the consumer EC2 instances across two Availability Zones. Use Amazon RDS for MySQL with Multi-AZ enabled.

**Answer: D**

**Explanation:** D tối ưu HA ở **cả 3 tầng** của kiến trúc: (1) **Amazon MQ active/standby** across 2 AZ — managed message broker, tự động failover khi 1 broker gặp sự cố, không cần tự quản lý ActiveMQ trên EC2. (2) **Auto Scaling group cho consumer EC2 instances across 2 AZ** — không chỉ thêm 1 instance cố định như A/B/C, mà Auto Scaling group còn **tự phát hiện và thay thế instance bị lỗi (self-healing)**, đảm bảo availability cao hơn hẳn so với việc chỉ thêm thủ công 1 instance tĩnh. (3) **Amazon RDS for MySQL Multi-AZ** — managed database, tự động failover sang standby khi primary gặp sự cố, không cần tự cấu hình replication thủ công. A sai vì mọi tầng đều **tự vận hành trên EC2** (ActiveMQ tự cài, tự replicate MySQL thủ công) — không có cơ chế failover tự động ở tầng nào, độ sẵn sàng thấp nhất và operational complexity cao nhất. B sai vì tầng consumer chỉ thêm **1 instance cố định** (không tự phục hồi khi instance đó chết) và MySQL vẫn **tự replicate thủ công trên EC2** thay vì dùng RDS Multi-AZ managed (thiếu cơ chế failover tự động). C gần đúng nhưng vẫn thiếu Auto Scaling group cho consumer — chỉ thêm 1 instance cố định ở AZ khác, nếu instance đó gặp sự cố sẽ không có gì tự động thay thế, không đạt HIGHEST availability như D.

---

## Question 35

A company hosts a website analytics application on a single Amazon EC2 On-Demand Instance. The analytics software is written in PHP and uses a MySQL database. The analytics software, the web server that provides PHP, and the database server are all hosted on the EC2 instance. The application is showing signs of performance degradation during busy times and is presenting 5xx errors. The company needs to make the application scale seamlessly.

**Which solution will meet these requirements MOST cost-effectively?**

A. Migrate the database to an Amazon RDS for MySQL DB instance. Create an AMI of the web application. Use the AMI to launch a second EC2 On-Demand Instance. Use an Application Load Balancer to distribute the load to each EC2 instance.
B. Migrate the database to an Amazon RDS for MySQL DB instance. Create an AMI of the web application. Use the AMI to launch a second EC2 On-Demand Instance. Use Amazon Route 53 weighted routing to distribute the load across the two EC2 instances.
C. Migrate the database to an Amazon Aurora MySQL DB instance. Create an AWS Lambda function to stop the EC2 instance and change the instance type. Create an Amazon CloudWatch alarm to invoke the Lambda function when CPU utilization surpasses 75%.
D. Migrate the database to an Amazon Aurora MySQL DB instance. Create an AMI of the web application. Apply the AMI to a launch template. Create an Auto Scaling group with the launch template. Configure the launch template to use a Spot Fleet. Attach an Application Load Balancer to the Auto Scaling group.

**Answer: D**

**Explanation:** Yêu cầu "**scale seamlessly**" (tự động mở rộng liền mạch, không gián đoạn) → cần **Auto Scaling group** thực sự (tự thêm/bớt instance theo nhu cầu), không phải chỉ thêm 1 instance cố định thủ công. D dùng **launch template + Auto Scaling group** để tự động scale, kết hợp **Spot Fleet** (rẻ hơn On-Demand nhiều, tối ưu "MOST cost-effective"), tách database ra **Amazon Aurora MySQL** (managed, hiệu năng cao hơn RDS MySQL thường, giảm tải cho web server), và **ALB** phân phối traffic đều cho các instance trong Auto Scaling group. A và B sai vì chỉ launch **thêm 1 EC2 instance cố định** (fixed capacity) — không có Auto Scaling group nên **không tự scale** khi tải tăng cao hơn nữa, không đáp ứng đúng nghĩa "scale seamlessly"; B còn dùng Route 53 weighted routing (chia tải tĩnh theo tỷ lệ, không phải load balancing động như ALB). C sai vì dùng Lambda để **dừng instance và đổi instance type** (vertical scaling) mỗi khi CPU vượt 75% — cách này gây **downtime** (phải stop instance để resize) mỗi lần scale, hoàn toàn không "seamless", và cũng không thực sự "scale" theo đúng nghĩa horizontal scaling như Auto Scaling group.

---

## Question 36

A company wants to build a scalable key management infrastructure to support developers who need to encrypt data in their applications.

**What should a solutions architect do to reduce the operational burden?**

A. Use multi-factor authentication (MFA) to protect the encryption keys.
B. Use AWS Key Management Service (AWS KMS) to protect the encryption keys.
C. Use AWS Certificate Manager (ACM) to create, store, and assign the encryption keys.
D. Use an IAM policy to limit the scope of users who have access permissions to protect the encryption keys.

**Answer: B**

**Explanation:** **AWS KMS** chính là dịch vụ được thiết kế riêng cho bài toán "**scalable key management infrastructure**" — đây là **managed service**, AWS tự lo việc tạo, lưu trữ, bảo vệ, rotate key (nếu bật automatic rotation), và scale theo nhu cầu sử dụng của developer mà không cần công ty tự xây dựng/vận hành hạ tầng quản lý key riêng → giảm operational burden đúng nghĩa được hỏi. A sai vì **MFA chỉ là 1 lớp xác thực bổ sung** cho người dùng đăng nhập, không phải là giải pháp cho việc **xây dựng hạ tầng quản lý key** — không liên quan trực tiếp đến vấn đề chính của đề bài. C sai vì **AWS Certificate Manager (ACM)** dùng để quản lý **chứng chỉ SSL/TLS** (certificate cho HTTPS), không phải dịch vụ để tạo/lưu trữ **encryption key** dùng để mã hóa dữ liệu ứng dụng — sai loại dịch vụ hoàn toàn. D sai vì IAM policy chỉ giải quyết phần **kiểm soát quyền truy cập (access control)** — đây là một phần cấu hình bổ sung khi dùng KMS, chứ bản thân IAM policy không phải là "hạ tầng quản lý key" hay giải pháp giảm operational burden cho việc quản lý key ở quy mô lớn.

---

## Question 37

A company hosts a data lake on AWS. The data lake consists of data in Amazon S3 and Amazon RDS for PostgreSQL. The company needs a reporting solution that provides data visualization and includes all the data sources within the data lake. Only the company's management team should have full access to all the visualizations. The rest of the company should have only limited access.

**Which solution will meet these requirements?**

A. Create an analysis in Amazon QuickSight. Connect all the data sources and create new datasets. Publish dashboards to visualize the data. Share the dashboards with the appropriate IAM roles.
B. Create an analysis in Amazon QuickSight. Connect all the data sources and create new datasets. Publish dashboards to visualize the data. Share the dashboards with the appropriate users and groups.
C. Create an AWS Glue table and crawler for the data in Amazon S3. Create an AWS Glue extract, transform, and load (ETL) job to produce reports. Publish the reports to Amazon S3. Use S3 bucket policies to limit access to the reports.
D. Create an AWS Glue table and crawler for the data in Amazon RDS for PostgreSQL. Use Amazon Athena Federated Query to access data within Amazon RDS for PostgreSQL. Generate reports by using Amazon Athena. Publish the reports to Amazon S3. Use S3 bucket policies to limit access to the reports.

**Answer: B**

**Explanation:** **Amazon QuickSight** là dịch vụ trực quan hóa dữ liệu (BI) chuẩn của AWS, hỗ trợ kết nối trực tiếp cả **S3 và RDS PostgreSQL** làm data source, tạo dashboard trực quan. Cơ chế phân quyền dashboard trong QuickSight hoạt động dựa trên **users và groups được quản lý trong chính QuickSight** (không phải IAM role trực tiếp) — cho phép **share dashboard với từng user/group cụ thể ở mức độ chi tiết khác nhau** (ví dụ: nhóm "management" full access, nhóm còn lại chỉ xem giới hạn) — đúng khớp yêu cầu phân quyền linh hoạt trong đề. A sai vì QuickSight **share dashboard qua "users và groups" của chính QuickSight**, không phải chia sẻ trực tiếp qua "IAM roles" — đây không phải cơ chế chuẩn của tính năng share dashboard trong QuickSight console. C và D sai vì đều dùng **AWS Glue + xuất báo cáo tĩnh ra S3** — đây không phải giải pháp "data visualization" (trực quan hóa dữ liệu tương tác) mà chỉ là xuất file báo cáo tĩnh; ngoài ra kiểm soát access bằng S3 bucket policy chỉ phân quyền được ở mức file/thư mục, không linh hoạt bằng việc phân quyền xem dashboard theo từng user/group như QuickSight. D còn sai thêm vì mô tả crawl nhầm nguồn dữ liệu (Glue crawler cho RDS PostgreSQL không hợp lý bằng crawl trực tiếp dữ liệu trong S3 data lake).

---

## Question 38

A company runs its media rendering application on premises. The company wants to reduce storage costs and has moved all data to Amazon S3. The on-premises rendering application needs low-latency access to storage.

The company needs to design a storage solution for the application. The storage solution must maintain the desired application performance.

**Which storage solution will meet these requirements in the MOST cost-effective way?**

A. Use Mountpoint for Amazon S3 to access the data in Amazon S3 for the on-premises application.
B. Configure an Amazon S3 File Gateway to provide storage for the on-premises application.
C. Copy the data from Amazon S3 to Amazon FSx for Windows File Server. Configure an Amazon FSx File Gateway to provide storage for the on-premises application.
D. Configure an on-premises file server. Use the Amazon S3 API to connect to S3 storage. Configure the application to access the storage from the on-premises file server.

**Answer: B**

**Explanation:** **Amazon S3 File Gateway** (một chế độ của AWS Storage Gateway) được thiết kế đúng cho tình huống này: dữ liệu lưu bền vững trong **S3** (tiết kiệm chi phí như công ty mong muốn), nhưng file gateway **cache dữ liệu được truy cập thường xuyên ngay tại on-premises** — ứng dụng truy cập qua giao thức file chuẩn (NFS/SMB) với **độ trễ thấp (low-latency)** như đang truy cập ổ đĩa cục bộ, trong khi dữ liệu gốc vẫn nằm trong S3. Đây chính là use case kinh điển S3 File Gateway được xây dựng để giải quyết. A sai vì **Mountpoint for Amazon S3** là công cụ client mount S3 bucket như file system, tối ưu cho khối lượng đọc/ghi tuần tự lớn trên **Linux/EC2**, không có cơ chế caching tối ưu độ trễ cho on-premises application như File Gateway — không phải giải pháp chuẩn cho bài toán này. C sai vì phải **copy dữ liệu sang FSx for Windows File Server** — tạo ra bản sao dữ liệu trùng lặp, phát sinh thêm chi phí lưu trữ không cần thiết, không phải "MOST cost-effective" khi đã có S3 File Gateway đơn giản hơn nhiều. D sai vì kết nối trực tiếp qua **S3 API cho mỗi lần truy cập** — không có cơ chế cache cục bộ, mọi request đều phải đi qua mạng tới S3, không đáp ứng được yêu cầu "low-latency access".

---

## Question 39

A digital image processing company wants to migrate its on-premises monolithic application to the AWS Cloud. The company processes thousands of images and generates large files as part of the processing workflow.

The company needs a solution to manage the growing number of image processing jobs. The solution must also reduce the manual tasks in the image processing workflow. The company does not want to manage the underlying infrastructure of the solution.

**Which solution will meet these requirements with the LEAST operational overhead?**

A. Use Amazon Elastic Container Service (Amazon ECS) with Amazon EC2 Spot Instances to process the images. Configure Amazon Simple Queue Service (Amazon SQS) to orchestrate the workflow. Store the processed files in Amazon Elastic File System (Amazon EFS).
B. Use AWS Batch jobs to process the images. Use AWS Step Functions to orchestrate the workflow. Store the processed files in an Amazon S3 bucket.
C. Use AWS Lambda functions and Amazon EC2 Spot Instances to process the images. Store the processed files in Amazon FSx.
D. Deploy a group of Amazon EC2 instances to process the images. Use AWS Step Functions to orchestrate the workflow. Store the processed files in an Amazon Elastic Block Store (Amazon EBS) volume.

**Answer: B**

**Explanation:** **AWS Batch** là dịch vụ **managed** chuyên xử lý batch job, tự động lo việc provisioning/scheduling/scaling compute cho từng job — công ty không cần tự quản lý hạ tầng bên dưới, đúng yêu cầu "does not want to manage the underlying infrastructure". **AWS Step Functions** orchestrate toàn bộ workflow xử lý ảnh (serverless, tự động điều phối các bước) → giảm manual task đúng như đề yêu cầu. Lưu file đã xử lý vào **Amazon S3** — managed storage, không cần quản lý hạ tầng, phù hợp cho "large files" và khối lượng lớn. Kết hợp cả 3 thành phần đều là managed/serverless → "LEAST operational overhead". A sai vì dùng **ECS với EC2 Spot Instances** vẫn cần công ty quản lý fleet EC2 (dù dùng Spot) — chưa đạt mức "không quản lý infrastructure"; SQS chỉ là hàng đợi tin nhắn đơn giản, không có khả năng **orchestrate workflow phức tạp** như Step Functions (không tự điều phối các bước tuần tự/song song, retry, branching logic). C sai vì kết hợp **Lambda + EC2 Spot Instances** khá bất thường — Lambda có giới hạn thời gian chạy tối đa 15 phút, không phù hợp xử lý "large files"; FSx cũng đòi hỏi cấu hình/quản lý phức tạp hơn S3. D sai vì tự deploy **nhóm EC2 instances** để xử lý ảnh nghĩa là công ty vẫn phải tự quản lý fleet EC2 (ngược lại hoàn toàn yêu cầu "does not want to manage the underlying infrastructure"); EBS volume chỉ tồn tại trong 1 AZ, không phải lựa chọn lưu trữ phù hợp cho khối lượng file lớn cần chia sẻ giữa nhiều job.

---

## Question 40

A company recently migrated to AWS and wants to implement a solution to protect the traffic that flows in and out of the production VPC. The company had an inspection server in its on-premises data center. The inspection server performed specific operations such as traffic flow inspection and traffic filtering. The company wants to have the same functionalities in the AWS Cloud.

**Which solution will meet these requirements?**

A. Use Amazon GuardDuty for traffic inspection and traffic filtering in the production VPC.
B. Use Traffic Mirroring to mirror traffic from the production VPC for traffic inspection and filtering.
C. Use AWS Network Firewall to create the required rules for traffic inspection and traffic filtering for the production VPC.
D. Use AWS Firewall Manager to create the required rules for traffic inspection and traffic filtering for the production VPC.

**Answer: C**

**Explanation:** **AWS Network Firewall** là dịch vụ **managed stateful firewall** được thiết kế đúng để thay thế chức năng của 1 "inspection server" truyền thống — cho phép tạo rule để **kiểm tra (inspect) và lọc (filter) traffic** ra/vào VPC ở tầng network, hỗ trợ cả traffic flow inspection, intrusion detection/prevention (IDS/IPS), và filtering theo domain/IP/protocol. Đây chính xác là dịch vụ thay thế cho inspection server on-premises trong đề bài. A sai vì **GuardDuty** là dịch vụ **phát hiện mối đe dọa (threat detection)** — chỉ giám sát và cảnh báo, không có khả năng **inline filtering/blocking traffic** như 1 firewall thực thụ. B sai vì **Traffic Mirroring** chỉ **sao chép (copy) traffic** để gửi đến công cụ phân tích bên ngoài (ví dụ 1 IDS/IPS tool của bên thứ 3) — bản thân Traffic Mirroring **không tự thực hiện việc filtering/inspection**, chỉ là cơ chế nhân bản traffic, cần có công cụ khác xử lý. D sai vì **AWS Firewall Manager** chỉ là lớp **quản lý tập trung chính sách** (áp dụng rule WAF/Network Firewall/Shield trên nhiều account/VPC cùng lúc) — bản thân nó không phải là engine tạo rule kiểm tra/lọc traffic, mà cần dùng chung với Network Firewall (như trong Question 13, Firewall Manager là lớp điều phối, không phải engine thực thi).

---

## Question 41

A company is building a containerized application on premises and decides to move the application to AWS. The application will have thousands of users soon after it is deployed. The company is unsure how to manage the deployment of containers at scale. The company needs to deploy the containerized application in a highly available architecture that minimizes operational overhead.

**Which solution will meet these requirements?**

A. Store container images in an Amazon Elastic Container Registry (Amazon ECR) repository. Use an Amazon Elastic Container Service (Amazon ECS) cluster with the AWS Fargate launch type to run the containers. Use target tracking to scale automatically based on demand.
B. Store container images in an Amazon Elastic Container Registry (Amazon ECR) repository. Use an Amazon Elastic Container Service (Amazon ECS) cluster with the Amazon EC2 launch type to run the containers. Use target tracking to scale automatically based on demand.
C. Store container images in a repository that runs on an Amazon EC2 instance. Run the containers on EC2 instances that are spread across multiple Availability Zones. Monitor the average CPU utilization in Amazon CloudWatch. Launch new EC2 instances as needed.
D. Create an Amazon EC2 Amazon Machine Image (AMI) that contains the container image. Launch EC2 instances in an Auto Scaling group across multiple Availability Zones. Use an Amazon CloudWatch alarm to Amazon CloudWatch alarm to scale out EC2 instances when the average CPU utilization threshold is breached.

**Answer: A**

**Explanation:** **Amazon ECR** lưu trữ container image (managed registry, không cần tự vận hành). **ECS với AWS Fargate launch type** — serverless container hosting, AWS tự lo capacity/provisioning/high availability (tự phân bổ task across nhiều AZ), công ty **không cần tự quản lý EC2 fleet** làm container host → đúng nghĩa "minimizes operational overhead" + giải quyết đúng nỗi lo "unsure how to manage deployment of containers at scale". **Target tracking** tự động scale theo nhu cầu thực tế — phù hợp cho traffic tăng đột biến khi có "thousands of users soon". B sai vì dùng **Amazon EC2 launch type** cho ECS — vẫn phải tự quản lý fleet EC2 làm container host (patch, scale, capacity plan), operational overhead cao hơn Fargate đáng kể (đây là bẫy lặp lại từ Question 8: EC2 launch type vs Fargate launch type). C sai vì tự vận hành **container registry trên EC2 instance** thay vì dùng ECR managed — thêm gánh nặng vận hành không cần thiết, và tự launch EC2 instance thủ công dựa theo CloudWatch (không phải cơ chế tự động hoàn chỉnh như Auto Scaling group hay ECS) rất thủ công, dễ lỗi. D sai vì đóng gói container vào EC2 AMI rồi chạy trên Auto Scaling group là cách tiếp cận **lỗi thời/không đúng chuẩn container orchestration** — không tận dụng được ECS/EKS để quản lý container thực sự, gây khó khăn khi cần "manage deployment of containers at scale" đúng như công ty đang lo ngại.

---

## Question 42

A company has a three-tier web application that processes orders from customers. The web tier consists of Amazon EC2 instances behind an Application Load Balancer. The processing tier consists of EC2 instances. The company decoupled the web tier and processing tier by using Amazon Simple Queue Service (Amazon SQS). The storage layer uses Amazon DynamoDB.

At peak times, some users report order processing delays and stalls. The company has noticed that during these delays, the EC2 instances are running at 100% CPU usage, and the SQS queue fills up. The peak times are variable and unpredictable.

The company needs to improve the performance of the application.

**Which solution will meet these requirements?**

A. Use scheduled scaling for Amazon EC2 Auto Scaling to scale out the processing tier instances for the duration of peak usage times. Use the CPU Utilization metric to determine when to scale.
B. Use Amazon ElastiCache for Redis in front of the DynamoDB backend tier. Use target utilization as a metric to determine when to scale.
C. Add an Amazon CloudFront distribution to cache the responses for the web tier. Use HTTP latency as a metric to determine when to scale.
D. Use an Amazon EC2 Auto Scaling target tracking policy to scale out the processing tier instances. Use the ApproximateNumberOfMessages attribute to determine when to scale.

**Answer: D**

**Explanation:** Vấn đề gốc: **processing tier bị nghẽn CPU 100%**, khiến SQS queue tồn đọng message — đây là dấu hiệu processing tier **không đủ capacity xử lý kịp** lượng message đến. Vì "peak times are variable and unpredictable" → không thể dùng lịch cố định, cần **scale dựa trên tín hiệu thực tế phản ánh đúng mức độ tồn đọng công việc**. **ApproximateNumberOfMessages** (số message đang chờ trong SQS queue) là metric chuẩn, chính xác nhất để đo "khối lượng công việc tồn đọng" — dùng **target tracking policy** dựa trên metric này giúp Auto Scaling group tự động scale processing tier đúng theo tải thực tế, giải quyết trực tiếp nguyên nhân gốc. A sai vì **scheduled scaling** yêu cầu biết trước thời điểm peak — nhưng đề đã nói rõ "**variable and unpredictable**", nên lịch cố định sẽ không khớp với peak thực tế, không giải quyết được vấn đề. B sai vì thêm **ElastiCache trước DynamoDB** không liên quan đến nguyên nhân gốc — vấn đề nằm ở **processing tier bị nghẽn CPU** (compute-bound), không phải do truy vấn DynamoDB chậm; caching tầng storage không giúp gì cho việc scale processing tier. C sai vì **CloudFront cache cho web tier** không liên quan đến vấn đề đang xảy ra ở **processing tier** — cache response web tier không giúp giảm tải xử lý ở tầng sau, sai tầng cần tối ưu.

---

## Question 43

A company wants to migrate its on-premises data center to AWS. According to the company's compliance requirements, the company can use only the ap-northeast-3 Region. Company administrators are not permitted to connect VPCs to the internet.

**Which solutions will meet these requirements? (Choose two.)**

A. Use AWS Control Tower to implement data residency guardrails to deny internet access and deny access to all AWS Regions except ap-northeast-3.
B. Use rules in AWS WAF to prevent internet access. Deny access to all AWS Regions except ap-northeast-3 in the AWS account settings.
C. Use AWS Organizations to configure service control policies (SCPs) that prevent VPCs from gaining internet access. Deny access to all AWS Regions except ap-northeast-3.
D. Create an outbound rule for the network ACL in each VPC to deny all traffic from 0.0.0.0/0. Create an IAM policy for each user to prevent the use of any AWS Region other than ap-northeast-3.
E. Use AWS Config to activate managed rules to detect and alert for internet gateways and to detect and alert for new resources deployed outside of ap-northeast-3.

**Answer: A, C**

**Explanation:** Cả 2 yêu cầu (chỉ dùng 1 Region + không được connect internet) cần giải pháp **preventive (ngăn chặn từ đầu), quản lý tập trung, scalable** — không phải chỉ giám sát/cảnh báo. A: **AWS Control Tower** cung cấp sẵn **data residency guardrails** — cơ chế preventive control có sẵn (built trên nền SCP) để chặn internet access và giới hạn Region hoạt động, đây là cách chuẩn/được khuyến nghị để enforce compliance requirement dạng này. C: **AWS Organizations SCP** cũng là giải pháp trực tiếp và chuẩn để **deny action ở cấp Organization** — chặn VPC gain internet access (ví dụ deny tạo/attach Internet Gateway) và deny access ngoài Region cho phép, áp dụng tập trung cho toàn bộ account. B sai vì **AWS WAF** hoạt động ở tầng ứng dụng (Layer 7, lọc HTTP request), không có khả năng **ngăn VPC kết nối internet** ở tầng hạ tầng mạng — sai loại dịch vụ hoàn toàn cho mục đích này. D sai vì đây là cách làm **thủ công, phân tán, dễ sai sót** — phải tự cấu hình Network ACL cho **từng VPC riêng lẻ** và IAM policy cho **từng user riêng lẻ**, không tập trung/scalable, dễ bị bỏ sót khi có VPC/user mới, không đáp ứng chuẩn best practice như SCP/Control Tower. E sai vì **AWS Config chỉ detect và alert (reactive/giám sát)** — phát hiện SAU KHI vi phạm đã xảy ra, không phải cơ chế **ngăn chặn (preventive)** như yêu cầu "not permitted to connect" trong đề (nghĩa là phải chặn từ đầu, không chỉ cảnh báo).

---

## Question 44

A gaming company is designing a highly available architecture. The application runs on a modified Linux kernel and supports only UDP-based traffic. The company needs the front-end tier to provide the best possible user experience. That tier must have low latency, route traffic to the nearest edge location, and provide static IP addresses for entry into the application endpoints.

**What should a solutions architect do to meet these requirements?**

A. Configure Amazon Route 53 to forward requests to an Application Load Balancer. Use AWS Lambda for the application in AWS Application Auto Scaling.
B. Configure Amazon CloudFront to forward requests to a Network Load Balancer. Use AWS Lambda for the application in an AWS Application Auto Scaling group.
C. Configure AWS Global Accelerator to forward requests to a Network Load Balancer. Use Amazon EC2 instances for the application in an EC2 Auto Scaling group.
D. Configure Amazon API Gateway to forward requests to an Application Load Balancer. Use Amazon EC2 instances for the application in an EC2 Auto Scaling group.

**Answer: C**

**Explanation:** Yêu cầu cốt lõi: **hỗ trợ UDP** + **static IP addresses** + **route tới edge location gần nhất** + **low latency** → chỉ có **AWS Global Accelerator** đáp ứng đủ cả 4 yếu tố: hỗ trợ cả TCP **và UDP**, cung cấp **static Anycast IP** cố định làm entry point, tự động định tuyến traffic đến **edge location gần người dùng nhất** trên mạng lưới AWS global, rồi chuyển tiếp đến **Network Load Balancer** (NLB — loại load balancer duy nhất trong 4 lựa chọn hỗ trợ UDP), cuối cùng đến **EC2 instances** (bắt buộc vì ứng dụng chạy trên **"modified Linux kernel"** — cần full OS control, không thể chạy trên Lambda serverless). A sai vì **Application Load Balancer (ALB) không hỗ trợ UDP** — ALB chỉ xử lý HTTP/HTTPS (Layer 7); dùng Lambda cũng sai vì app cần "modified Linux kernel" — không thể chạy trên môi trường serverless của Lambda. B sai vì **CloudFront được thiết kế cho HTTP/HTTPS content delivery**, không hỗ trợ forward traffic UDP tùy ý; dù NLB có hỗ trợ UDP, kết hợp với CloudFront (không hỗ trợ UDP) không hợp lý; Lambda cũng sai vì lý do tương tự A. D sai vì **API Gateway chỉ hỗ trợ HTTP/HTTPS/WebSocket**, không hỗ trợ UDP; ALB phía sau cũng không hỗ trợ UDP — toàn bộ chuỗi kiến trúc D không tương thích với yêu cầu UDP-based traffic trong đề.

---

## Question 45

A company runs its two-tier ecommerce website on AWS. The web tier consists of a load balancer that sends traffic to Amazon EC2 instances. The database tier uses an Amazon RDS DB instance. The EC2 instances and the RDS DB instance should not be exposed to the public internet. The EC2 instances require internet access to complete payment processing of orders through a third-party web service. The application must be highly available.

**Which combination of configuration options will meet these requirements? (Choose two.)**

A. Use an Auto Scaling group to launch the EC2 instances in private subnets. Deploy an RDS Multi-AZ DB instance in private subnets.
B. Configure a VPC with two private subnets and two NAT gateways across two Availability Zones. Deploy an Application Load Balancer in the private subnets.
C. Use an Auto Scaling group to launch the EC2 instances in public subnets across two Availability Zones. Deploy an RDS Multi-AZ DB instance in private subnets.
D. Configure a VPC with one public subnet, one private subnet, and two NAT gateways across two Availability Zones. Deploy an Application Load Balancer in the public subnet.
E. Configure a VPC with two public subnets, two private subnets, and two NAT gateways across two Availability Zones. Deploy an Application Load Balancer in the public subnets.

**Answer: A, E**

**Explanation:** Kết hợp A + E tạo thành kiến trúc hoàn chỉnh: E) VPC có **2 public subnet + 2 private subnet + 2 NAT Gateway trải trên 2 AZ** — ALB đặt ở **public subnet** (đúng vai trò, nhận traffic từ internet), NAT Gateway ở mỗi AZ cho phép EC2 trong private subnet **ra internet để gọi third-party payment service** mà vẫn không bị lộ IP public trực tiếp; 2 AZ đảm bảo NAT Gateway/ALB không phải điểm lỗi đơn (SPOF). A) **EC2 chạy trong Auto Scaling group đặt ở private subnet** (không lộ ra internet, đúng yêu cầu) + **RDS Multi-AZ cũng đặt ở private subnet** (không lộ internet, tự động failover đảm bảo HA). Kết hợp lại: ALB (public) → EC2 Auto Scaling (private, ra internet qua NAT) → RDS Multi-AZ (private) — đáp ứng đủ mọi yêu cầu: không lộ EC2/RDS ra internet, EC2 vẫn có internet access qua NAT, và highly available nhờ Multi-AZ + Auto Scaling. B sai vì **đặt ALB trong private subnet** — ALB cần nằm ở **public subnet** để nhận traffic trực tiếp từ internet (người dùng website); ALB trong private subnet sẽ không thể phục vụ traffic công khai đúng cách cho ecommerce website. C sai vì đặt **EC2 instances trong public subnet** — vi phạm trực tiếp yêu cầu "EC2 instances... should not be exposed to the public internet". D sai vì chỉ có **1 public subnet + 1 private subnet** (không trải qua nhiều AZ đúng nghĩa) — không đạt yêu cầu "highly available" vì thiếu redundancy qua nhiều Availability Zone.

---

## Question 46

A company hosts its enterprise resource planning (ERP) system in the us-east-1 Region. The system runs on Amazon EC2 instances. Customers use a public API that is hosted on the EC2 instances to exchange information with the ERP system. International customers report slow API response times from their data centers.

**Which solution will improve response times for the international customers MOST cost-effectively?**

A. Create an AWS Direct Connect connection that has a public virtual interface (VIF) to provide connectivity from each customer's data center to us-east-1. Route customer API requests by using a Direct Connect gateway to the ERP system API.
B. Set up an Amazon CloudFront distribution in front of the API. Configure the CachingOptimized managed cache policy to provide improved cache efficiency.
C. Set up AWS Global Accelerator. Configure listeners for the necessary ports. Configure endpoint groups for the appropriate Regions to distribute traffic. Create an endpoint in the group for the API.
D. Use AWS Site-to-Site VPN to establish dedicated VPN tunnels between Regions and customer networks. Route traffic to the API over the VPN connections.

**Answer: C**

**Explanation:** **AWS Global Accelerator** dùng mạng lưới AWS global backbone để đưa traffic vào gần nhất với người dùng qua edge location, sau đó định tuyến hiệu quả đến endpoint (EC2/ALB/NLB) ở us-east-1 — giảm latency đáng kể cho traffic quốc tế mà **không cần xây dựng hạ tầng riêng cho từng khách hàng**, chỉ cần cấu hình listener + endpoint group — đơn giản, nhanh, "MOST cost-effective". Global Accelerator đặc biệt phù hợp cho **API traffic dạng dynamic** (không cacheable), khác với CloudFront thiên về cache static/semi-static content. B sai vì API traffic trong ERP system (trao đổi dữ liệu nghiệp vụ) thường là **dynamic, không cacheable** — dùng CloudFront với cache policy sẽ không cải thiện được nhiều vì response luôn thay đổi theo request, cache hit rate thấp, không giải quyết đúng vấn đề gốc là latency mạng. A sai vì **Direct Connect yêu cầu kết nối vật lý/dedicated riêng cho từng data center khách hàng** — cực kỳ tốn kém, phức tạp khi có nhiều khách hàng quốc tế khác nhau, hoàn toàn không phải giải pháp "cost-effective" cho bài toán nhiều customer phân tán toàn cầu. D sai vì thiết lập **VPN tunnel riêng cho từng customer network** cũng tốn kém và phức tạp tương tự Direct Connect — không scalable, không phải cách tối ưu chi phí khi số lượng khách hàng quốc tế lớn và phân tán.

---

## Question 47

A company runs workloads on AWS. The company needs to connect to a service from an external provider. The service is hosted in the provider's VPC. According to the company's security team, the connectivity must be private and must be restricted to the target service. The connection must be initiated only from the company's VPC.

**Which solution will meet these requirements?**

A. Create a VPC peering connection between the company's VPC and the provider's VPC. Update the route table to connect to the target service.
B. Ask the provider to create a virtual private gateway in its VPC. Use AWS PrivateLink to connect to the target service.
C. Create a NAT gateway in a public subnet of the company's VPC. Update the route table to connect to the target service.
D. Ask the provider to create a VPC endpoint for the target service. Use AWS PrivateLink to connect to the target service.

**Answer: D**

**Explanation:** **AWS PrivateLink** là giải pháp chuẩn cho đúng yêu cầu: kết nối **private** (không qua internet), **restricted chỉ tới đúng 1 service cụ thể** (không mở toàn bộ network như peering), và kết nối **chỉ khởi tạo một chiều từ phía consumer** (công ty) — đúng nghĩa "initiated only from the company's VPC". Nhà cung cấp (provider) cần tạo **VPC Endpoint Service** (backed bởi NLB) cho service của họ, phía công ty tạo **Interface VPC Endpoint** kết nối qua PrivateLink tới đúng service đó — không có quyền truy cập gì khác ngoài service được expose. A sai vì **VPC Peering** kết nối ở mức **network (route table)** giữa 2 VPC — cho phép truy cập **rộng hơn** nhiều so với "chỉ 1 service cụ thể" (routing 2 chiều, có thể truy cập nhiều resource khác trong VPC đối tác nếu security group cho phép) — không đáp ứng yêu cầu "restricted to the target service". B sai vì **virtual private gateway** là thành phần dùng cho kết nối **VPN/Direct Connect với on-premises**, không phải bước đúng để thiết lập PrivateLink — PrivateLink yêu cầu provider tạo **VPC Endpoint Service**, không phải virtual private gateway; đây là mô tả kỹ thuật sai. C sai vì **NAT Gateway** dùng để cho resource trong private subnet **ra internet**, hoàn toàn không phải cơ chế kết nối private tới 1 service cụ thể trong VPC khác — sai mục đích sử dụng hoàn toàn.

---

## Question 48

A company wants to use high performance computing (HPC) infrastructure on AWS for financial risk modeling. The company's HPC workloads run on Linux. Each HPC workflow runs on hundreds of Amazon EC2 Spot Instances, is short-lived, and generates thousands of output files that are ultimately stored in persistent storage for analytics and long-term future use.

The company seeks a cloud storage solution that permits the copying of on-premises data to long-term persistent storage to make data available for processing by all EC2 instances. The solution should also be a high performance file system that is integrated with persistent storage to read and write datasets and output files.

**Which combination of AWS services meets these requirements?**

A. Amazon FSx for Lustre integrated with Amazon S3
B. Amazon FSx for Windows File Server integrated with Amazon S3
C. Amazon S3 Glacier integrated with Amazon Elastic Block Store (Amazon EBS)
D. Amazon S3 bucket with a VPC endpoint integrated with an Amazon Elastic Block Store (Amazon EBS) General Purpose SSD (gp2) volume

**Answer: A**

**Explanation:** **Amazon FSx for Lustre** là hệ thống file **hiệu năng cao (high performance)**, thiết kế chuyên cho khối lượng công việc **HPC** (compute-intensive, xử lý song song hàng trăm/nghìn instance đồng thời) trên **Linux** — khớp chính xác với yêu cầu "high performance file system" + "Linux" trong đề. FSx for Lustre có khả năng **tích hợp trực tiếp với Amazon S3** — tự động link dữ liệu giữa Lustre file system và S3 bucket (import/export dữ liệu qua lại), cho phép copy dữ liệu on-premises lên **S3 làm persistent storage lâu dài**, đồng thời expose dữ liệu đó qua Lustre file system tốc độ cao để hàng trăm EC2 instance cùng đọc/ghi dataset và output file trong lúc chạy HPC workflow. B sai vì **FSx for Windows File Server** dùng cho khối lượng công việc trên **Windows**, không phù hợp với "HPC workloads run on Linux" — sai hệ điều hành, và FSx for Windows cũng không tối ưu hiệu năng cho HPC compute-intensive như Lustre. C sai vì **S3 Glacier** là storage class cho **lưu trữ lạnh, ít truy cập** (retrieval chậm, tính bằng phút-giờ) — hoàn toàn không phù hợp cho workload cần đọc/ghi liên tục tốc độ cao trong lúc xử lý HPC; EBS cũng không phải "high performance file system" chia sẻ được cho hàng trăm instance cùng lúc (EBS volume thường chỉ gắn được với 1 instance, trừ Multi-Attach có giới hạn). D sai vì **S3 + EBS gp2** không tạo thành 1 "high performance file system" dùng chung cho nhiều EC2 instance — S3 không phải file system (chỉ là object storage qua API), EBS gp2 là block storage gắn với từng instance riêng lẻ, không đáp ứng được nhu cầu chia sẻ dữ liệu tốc độ cao cho hàng trăm instance cùng lúc như FSx for Lustre.

---

## Question 49

A company recently started using Amazon Aurora as the data store for its global ecommerce application. When large reports are run, developers report that the ecommerce application is performing poorly. After reviewing metrics in Amazon CloudWatch, a solutions architect finds that the ReadIOPS and CPUUtilization metrics are spiking when monthly reports run.

**What is the MOST cost-effective solution?**

A. Migrate the monthly reporting to Amazon Redshift.
B. Migrate the monthly reporting to an Aurora Replica.
C. Migrate the Aurora database to a larger instance class.
D. Increase the Provisioned IOPS on the Aurora instance.

**Answer: B**

**Explanation:** Vấn đề gốc: chạy **báo cáo lớn (read-heavy)** trên cùng instance chính đang phục vụ traffic ecommerce, gây tranh chấp tài nguyên (ReadIOPS + CPU spike) làm chậm ứng dụng chính. **Aurora Replica** (read replica có sẵn của Aurora, chia sẻ chung storage với primary instance, không tốn thêm chi phí lưu trữ trùng lặp) cho phép **tách traffic đọc báo cáo sang instance riêng** — không ảnh hưởng đến instance chính, chi phí chỉ thêm 1 replica instance nhỏ, "MOST cost-effective" so với các phương án khác. A sai vì **migrate sang Amazon Redshift** là giải pháp quá lớn — đòi hỏi re-architect, ETL dữ liệu sang data warehouse riêng, tốn kém và phức tạp hơn nhiều so với việc chỉ cần thêm 1 Aurora Replica đơn giản. C sai vì **nâng cấp lên instance class lớn hơn** làm tăng chi phí cho **toàn bộ thời gian hoạt động** của instance chính, dù chỉ cần thêm capacity trong lúc chạy báo cáo (monthly, không liên tục) — lãng phí chi phí so với việc tách riêng 1 replica chỉ dùng khi cần. D sai vì **tăng Provisioned IOPS** cũng tăng chi phí cho instance chính liên tục, chỉ giải quyết một phần vấn đề IOPS mà không tách được tải báo cáo ra khỏi traffic chính — không tối ưu bằng việc dùng Aurora Replica chuyên biệt cho reporting.

---

## Question 50

A large media company hosts a web application on AWS. The company wants to start caching confidential media files so that users around the world will have reliable access to the files. The content is stored in Amazon S3 buckets. The company must deliver the content quickly, regardless of where the requests originate geographically.

**Which solution will meet these requirements?**

A. Use AWS DataSync to connect the S3 buckets to the web application.
B. Deploy AWS Global Accelerator to connect the S3 buckets to the web application.
C. Deploy Amazon CloudFront to connect the S3 buckets to CloudFront edge servers.
D. Use Amazon Simple Queue Service (Amazon SQS) to connect the S3 buckets to the web application.

**Answer: C**

**Explanation:** **Amazon CloudFront** là CDN chuẩn của AWS, được thiết kế chính xác cho yêu cầu "**caching**" + "**deliver content quickly regardless of geographic location**" — CloudFront cache nội dung từ S3 origin ra hàng trăm **edge location** trên toàn cầu, người dùng ở bất kỳ đâu đều được phục vụ từ edge gần nhất, giảm latency đáng kể. CloudFront cũng hỗ trợ bảo mật nội dung "confidential" qua signed URL/signed cookie, OAI/OAC — phù hợp với yêu cầu media files nhạy cảm. A sai vì **AWS DataSync** là dịch vụ **di chuyển/đồng bộ dữ liệu** (giữa on-premises và AWS, hoặc giữa các storage service với nhau), không phải dịch vụ caching/content delivery cho người dùng cuối. B sai vì **AWS Global Accelerator không hỗ trợ S3 bucket làm endpoint** (bẫy lặp lại nhiều lần trong bộ đề này — xem Question 12, 32) — không thể dùng trực tiếp cho kiến trúc này; ngoài ra Global Accelerator tối ưu network routing chứ không phải caching content. D sai vì **Amazon SQS** là dịch vụ hàng đợi tin nhắn (message queue), hoàn toàn không liên quan đến việc cache hay phân phối nội dung tới người dùng.
