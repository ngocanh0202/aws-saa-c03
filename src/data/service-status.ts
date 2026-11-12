import type { Question } from './types';

/**
 * Dịch vụ trong ngân hàng câu hỏi đã đổi tên hoặc đã ngừng/đóng với khách hàng mới (kiểm tra 10/2026).
 * Hướng dẫn tự hiện các mục khớp với đề và lựa chọn, nên câu hỏi gốc không cần sửa.
 * Câu nào có đáp án đúng phụ thuộc vào dịch vụ đã ngừng thì vẫn gắn `review` trong data/vi.
 */
export interface ServiceStatus {
  id: string;
  kind: 'renamed' | 'retired';
  match: RegExp;
  note: string;
}

export const SERVICE_STATUS: ServiceStatus[] = [
  // Đổi tên: đáp án không sai, chỉ cần biết tên hiện tại.
  { id: 'opensearch', kind: 'renamed', match: /Elasticsearch Service/i, note: 'Amazon Elasticsearch Service đã đổi tên thành Amazon OpenSearch Service (09/2021).' },
  { id: 'identity-center', kind: 'renamed', match: /Single Sign-On|AWS SSO\b/i, note: 'AWS Single Sign-On (AWS SSO) đã đổi tên thành AWS IAM Identity Center (07/2022).' },
  { id: 'eventbridge', kind: 'renamed', match: /CloudWatch Events/i, note: 'Amazon CloudWatch Events nay là Amazon EventBridge (EventBridge xây trên CloudWatch Events và thay thế tên này).' },
  { id: 'data-firehose', kind: 'renamed', match: /Kinesis Data Firehose|Kinesis Firehose/i, note: 'Amazon Kinesis Data Firehose đã đổi tên thành Amazon Data Firehose (02/2024); API, CLI và endpoint giữ nguyên.' },
  { id: 'kda', kind: 'renamed', match: /Kinesis Data Analytics/i, note: 'Kinesis Data Analytics for Apache Flink đã đổi tên thành Amazon Managed Service for Apache Flink (30/08/2023). Kinesis Data Analytics for SQL không đổi tên mà đã ngừng hẳn từ 27/01/2026.' },
  { id: 'sagemaker-ai', kind: 'renamed', match: /SageMaker/i, note: 'Amazon SageMaker (dịch vụ ML) đã đổi tên thành Amazon SageMaker AI (03/12/2024); tên "Amazon SageMaker" nay dùng cho nền tảng dữ liệu, phân tích và AI thế hệ mới.' },
  { id: 'quick-sight', kind: 'renamed', match: /QuickSight/i, note: 'Amazon QuickSight nay là Amazon Quick Sight, một phần của Amazon Quick Suite (10/2025); dashboard, dataset và API (vẫn tên QuickSight) giữ nguyên.' },
  { id: 'oai', kind: 'renamed', match: /origin access identity|\bOAI\b/i, note: 'Origin access identity (OAI) là cách cũ; từ 08/2022 AWS khuyên dùng origin access control (OAC). OAI vẫn hoạt động.' },
  // Đã ngừng hoặc đóng với khách hàng mới.
  { id: 'snowball', kind: 'retired', match: /Snowball/i, note: 'AWS Snowball Edge chỉ còn cho khách hàng hiện hữu từ 07/11/2025 và hết hỗ trợ ở các Region thương mại ngày 31/12/2026; khách hàng mới dùng AWS DataSync, AWS Data Transfer Terminal hoặc giải pháp của Partner.' },
  { id: 'snowcone', kind: 'retired', match: /Snowcone/i, note: 'AWS Snowcone đã ngừng bán từ 12/11/2024 và hết hỗ trợ ngày 12/11/2025.' },
  { id: 'snowmobile', kind: 'retired', match: /Snowmobile/i, note: 'AWS Snowmobile đã ngừng cung cấp.' },
  { id: 'elastic-transcoder', kind: 'retired', match: /Elastic Transcoder/i, note: 'Amazon Elastic Transcoder đã ngừng từ 13/11/2025; AWS khuyên dùng AWS Elemental MediaConvert.' },
  { id: 'pinpoint', kind: 'retired', match: /Pinpoint/i, note: 'Amazon Pinpoint ngừng nhận khách hàng mới từ 20/05/2025 và hết hỗ trợ ngày 30/10/2026; API SMS chuyển sang AWS End User Messaging.' },
  { id: 'scheduled-ri', kind: 'retired', match: /Scheduled Reserved/i, note: 'Scheduled Reserved Instances không còn mua được.' },
  { id: 'glacier-vault', kind: 'retired', match: /Glacier vault/i, note: 'Dịch vụ Amazon Glacier dạng vault (độc lập với S3) không nhận khách hàng mới từ 15/12/2025; các storage class S3 Glacier không bị ảnh hưởng.' },
  { id: 'glacier-select', kind: 'retired', match: /Glacier Select/i, note: 'S3 Glacier Select không còn cho khách hàng mới từ 25/07/2024.' },
  { id: 's3-select', kind: 'retired', match: /S3 Select\b/i, note: 'Amazon S3 Select không còn cho khách hàng mới (từ 07/2024); dùng Amazon Athena để truy vấn dữ liệu S3 bằng SQL.' },
  { id: 's3-object-lambda', kind: 'retired', match: /Object Lambda/i, note: 'Amazon S3 Object Lambda chỉ còn cho khách hàng hiện hữu từ 07/11/2025.' },
  { id: 'fsx-file-gateway', kind: 'retired', match: /FSx File Gateway/i, note: 'Amazon FSx File Gateway không nhận khách hàng mới từ 28/10/2024; AWS khuyên kết nối thẳng tới FSx for Windows File Server.' },
  { id: 'aurora-serverless-v1', kind: 'retired', match: /Aurora Serverless/i, note: 'Aurora Serverless v1 hết vòng đời ngày 31/03/2025; "Aurora Serverless" hiện nay là v2.' },
  { id: 'rds-custom-oracle', kind: 'retired', match: /RDS Custom for Oracle/i, note: 'Amazon RDS Custom for Oracle hết hỗ trợ ngày 31/03/2027; AWS khuyên chuyển sang Oracle tự quản lý trên EC2 (RDS for Oracle và RDS Custom for SQL Server không bị ảnh hưởng).' },
  { id: 'inspector-classic', kind: 'retired', match: /Inspector agent/i, note: 'Amazon Inspector Classic (cần cài Inspector agent) hết hỗ trợ ngày 20/05/2026; Amazon Inspector hiện nay quét EC2 qua SSM Agent, không cần agent riêng.' },
  { id: 'app-runner', kind: 'retired', match: /App Runner/i, note: 'AWS App Runner không nhận khách hàng mới từ 30/04/2026; khách hàng hiện hữu vẫn dùng bình thường nhưng sẽ không có tính năng mới. AWS khuyên chuyển sang Amazon ECS Express Mode.' },
  { id: 'app-mesh', kind: 'retired', match: /App Mesh/i, note: 'AWS App Mesh hết hỗ trợ ngày 30/09/2026; AWS khuyên dùng Amazon ECS Service Connect hoặc Amazon VPC Lattice.' },
  { id: 'lookout-vision', kind: 'retired', match: /Lookout for Vision/i, note: 'Amazon Lookout for Vision đã ngừng hẳn từ 31/10/2025.' },
  { id: 'workload-discovery', kind: 'retired', match: /Workload Discovery/i, note: 'Workload Discovery on AWS đã ngừng phát triển (kho mã nguồn được lưu trữ từ 14/08/2026).' },
  { id: 'glue-elastic-views', kind: 'retired', match: /Elastic Views/i, note: 'AWS Glue Elastic Views chỉ có bản preview và đã bị dừng, chưa từng phát hành chính thức.' },
  { id: 'go1x', kind: 'retired', match: /go1\.x|Go 1\.x/i, note: 'Lambda runtime go1.x đã ngừng hỗ trợ; Go hiện chạy trên runtime provided.al2023.' },
];

export function serviceStatusFor(question: Question): ServiceStatus[] {
  const text = [question.stem, question.prompt, ...question.options.map((o) => o.text)].join('\n');
  return SERVICE_STATUS.filter((s) => s.match.test(text));
}
