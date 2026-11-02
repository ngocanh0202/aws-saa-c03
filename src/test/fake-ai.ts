import type { AiClient, ChatHistoryStore, ChatMessage } from '../ai/types';

export interface FakeAi extends AiClient {
  calls: { systemPrompt: string; history: ChatMessage[]; sent: string[] }[];
  /** Các đoạn trả lời; là Error thì ném trước đoạn đầu tiên. */
  reply: string[] | Error;
  /** Ném lỗi sau n đoạn. */
  failAfter?: number;
  /** true: send() chờ release() rồi mới trả đoạn đầu (để thử trạng thái đang trả lời). */
  hold: boolean;
  release(): void;
}

export function fakeAi(): FakeAi {
  let waiting: (() => void)[] = [];
  const ai: FakeAi = {
    calls: [],
    reply: ['ok'],
    hold: false,
    release() {
      const list = waiting;
      waiting = [];
      for (const r of list) r();
    },
    startChat(systemPrompt, history) {
      const call = { systemPrompt, history, sent: [] as string[] };
      ai.calls.push(call);
      return {
        async *send(text) {
          call.sent.push(text);
          if (ai.hold) await new Promise<void>((r) => waiting.push(r));
          if (ai.reply instanceof Error) throw ai.reply;
          let n = 0;
          for (const chunk of ai.reply) {
            if (ai.failAfter !== undefined && n >= ai.failAfter) throw new Error('stream failed');
            n++;
            yield chunk;
          }
          if (ai.failAfter !== undefined && n >= ai.failAfter) throw new Error('stream failed');
        },
      };
    },
  };
  return ai;
}

export interface FakeChats extends ChatHistoryStore {
  saved: { key: string; messages: ChatMessage[] }[];
  loadError?: Error;
}

export function fakeChats(initial: Record<string, ChatMessage[]> = {}): FakeChats {
  const data = new Map(Object.entries(initial));
  const chats: FakeChats = {
    saved: [],
    async load(uid, attemptId, qid) {
      if (chats.loadError) throw chats.loadError;
      return data.get(`${uid}/${attemptId}/${qid}`) ?? [];
    },
    async save(uid, attemptId, qid, messages) {
      const key = `${uid}/${attemptId}/${qid}`;
      data.set(key, messages);
      chats.saved.push({ key, messages });
    },
  };
  return chats;
}
