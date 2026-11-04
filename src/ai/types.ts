import type { RetryOptions } from './retry';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  /** Câu trả lời dùng lại từ lần hỏi trước (câu hỏi giống ≥ 85%), không gửi cho AI. */
  cached?: boolean;
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
  /** Tự thử lại khi Gemini báo hết lượt/quá tải (onWait để hiện đếm ngược). */
  retry?: RetryOptions;
  /** Model đang "suy nghĩ" (reasoning) chưa ra chữ trả lời; Local AI dùng để hiện dòng chờ. */
  onThinking?: () => void;
}

/** Lỗi có sẵn câu báo cho người học (vd không kết nối được AI thử nghiệm). */
export class AiUserError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
    this.name = 'AiUserError';
  }
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
  /** Tên người học đặt; không có thì dùng tên mặc định "<đề> · Câu <n>". */
  title?: string;
}

export const TITLE_MAX = 100;

export interface ChatHistoryStore {
  load(uid: string, attemptId: string, qid: number): Promise<ChatMessage[]>;
  save(uid: string, attemptId: string, qid: number, messages: ChatMessage[]): Promise<void>;
  /** Mọi cuộc trò chuyện của user, ở mọi lượt. */
  list(uid: string): Promise<ChatSummary[]>;
  /** Đặt tên (null = bỏ tên). Không đổi updatedAt; save sau đó không làm mất tên. */
  rename(uid: string, attemptId: string, qid: number, title: string | null): Promise<void>;
}

export const SUMMARY_LENGTH = 80;

export function summarize(messages: ChatMessage[]): string {
  const text = (messages[messages.length - 1]?.text ?? '').replace(/\s+/g, ' ').trim();
  return text.length > SUMMARY_LENGTH ? `${text.slice(0, SUMMARY_LENGTH).trimEnd()}…` : text;
}
