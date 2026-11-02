export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AiChat {
  /** Gửi một tin nhắn, nhận câu trả lời theo từng đoạn. */
  send(text: string): AsyncIterable<string>;
}

export interface AiClient {
  startChat(systemPrompt: string, history: ChatMessage[]): AiChat;
}

export interface ChatHistoryStore {
  load(uid: string, attemptId: string, qid: number): Promise<ChatMessage[]>;
  save(uid: string, attemptId: string, qid: number, messages: ChatMessage[]): Promise<void>;
}
