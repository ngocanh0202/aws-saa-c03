export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AiChat {
  /** Gửi một tin nhắn, nhận câu trả lời theo từng đoạn. */
  send(text: string): AsyncIterable<string>;
}

/** Hàm mô hình được gọi (function calling); chạy ở trình duyệt. */
export interface AiTool {
  name: string;
  description: string;
  /** Tham số chuỗi: tên → mô tả. Tất cả bắt buộc. */
  params: Record<string, string>;
  run(args: Record<string, unknown>): Promise<object> | object;
}

export interface ChatOptions {
  tools?: AiTool[];
  /** Gọi mỗi lần mô hình yêu cầu chạy tool (để hiện dòng chờ). */
  onToolCall?: (name: string) => void;
}

export interface AiClient {
  startChat(systemPrompt: string, history: ChatMessage[], options?: ChatOptions): AiChat;
}

/** Một cuộc trò chuyện đã lưu (để liệt kê, không kèm toàn bộ tin nhắn). */
export interface ChatSummary {
  attemptId: string;
  qid: number;
  updatedAt: number;
  /** Tin cuối, đã cắt ~80 ký tự. */
  last: string;
}

export interface ChatHistoryStore {
  load(uid: string, attemptId: string, qid: number): Promise<ChatMessage[]>;
  save(uid: string, attemptId: string, qid: number, messages: ChatMessage[]): Promise<void>;
  /** Mọi cuộc trò chuyện của user, ở mọi lượt. */
  list(uid: string): Promise<ChatSummary[]>;
}

export const SUMMARY_LENGTH = 80;

export function summarize(messages: ChatMessage[]): string {
  const text = (messages[messages.length - 1]?.text ?? '').replace(/\s+/g, ' ').trim();
  return text.length > SUMMARY_LENGTH ? `${text.slice(0, SUMMARY_LENGTH).trimEnd()}…` : text;
}
