import { prepareHistory } from '../ai/prompt';
import { toolLoop, type FunctionCallLike } from '../ai/tool-loop';
import { summarize, type AiClient, type ChatHistoryStore, type ChatMessage, type ChatOptions } from '../ai/types';

export interface FakeAi extends AiClient {
  calls: { systemPrompt: string; history: ChatMessage[]; sent: string[]; options?: ChatOptions; toolResults: object[] }[];
  /** Các đoạn trả lời; là Error thì ném trước đoạn đầu tiên. */
  reply: string[] | Error;
  /** Ném lỗi sau n đoạn. */
  failAfter?: number;
  /** true: send() chờ release() rồi mới trả đoạn đầu (để thử trạng thái đang trả lời). */
  hold: boolean;
  release(): void;
  /**
   * true: như adapter thật, history được qua prepareHistory rồi kiểm tra như Firebase SDK
   * (không xen kẽ user/model hoặc bắt đầu bằng model thì startChat ném lỗi).
   */
  strictHistory: boolean;
  /** Đặt thì startChat() ném lỗi này ngay (đồng bộ). */
  startError?: Error;
  /** Đặt thì tin nhắn đầu của mỗi chat gọi các tool này (qua toolLoop như adapter thật) rồi mới trả reply. */
  toolCalls?: FunctionCallLike[];
}

export function fakeAi(): FakeAi {
  let waiting: (() => void)[] = [];
  const ai: FakeAi = {
    calls: [],
    reply: ['ok'],
    hold: false,
    strictHistory: false,
    release() {
      const list = waiting;
      waiting = [];
      for (const r of list) r();
    },
    startChat(systemPrompt, history, options) {
      if (ai.startError) throw ai.startError;
      if (ai.strictHistory) {
        const sent = prepareHistory(history);
        if (sent[0]?.role === 'model') throw new Error("First Content should be with role 'user'");
        sent.forEach((msg, i) => {
          if (i > 0 && sent[i - 1].role === msg.role) throw new Error(`Content with role '${msg.role}' can't follow '${msg.role}'`);
        });
      }
      const call = { systemPrompt, history, sent: [] as string[], options, toolResults: [] as object[] };
      ai.calls.push(call);
      async function* answer() {
        if (ai.hold) await new Promise<void>((r) => waiting.push(r));
        if (ai.reply instanceof Error) throw ai.reply;
        let n = 0;
        for (const chunk of ai.reply) {
          if (ai.failAfter !== undefined && n >= ai.failAfter) throw new Error('stream failed');
          n++;
          yield chunk;
        }
        if (ai.failAfter !== undefined && n >= ai.failAfter) throw new Error('stream failed');
      }
      async function* none() {}
      return {
        send(text) {
          call.sent.push(text);
          const toolCalls = call.sent.length === 1 ? (ai.toolCalls ?? []) : [];
          return toolLoop(
            async (turn) => {
              if (typeof turn !== 'string') call.toolResults.push(...turn.map((r) => r.response));
              const calling = typeof turn === 'string' && toolCalls.length > 0;
              return { chunks: calling ? none() : answer(), calls: async () => (calling ? toolCalls : []) };
            },
            text,
            options,
          );
        },
      };
    },
  };
  return ai;
}

export interface FakeChats extends ChatHistoryStore {
  saved: { key: string; messages: ChatMessage[] }[];
  loadError?: Error;
  listError?: Error;
}

export function fakeChats(initial: Record<string, ChatMessage[]> = {}): FakeChats {
  const data = new Map(Object.entries(initial));
  // updatedAt tăng dần theo thứ tự ghi (initial trước).
  let clock = 0;
  const updated = new Map([...data.keys()].map((k) => [k, ++clock]));
  const chats: FakeChats = {
    saved: [],
    async load(uid, attemptId, qid) {
      if (chats.loadError) throw chats.loadError;
      return data.get(`${uid}/${attemptId}/${qid}`) ?? [];
    },
    async save(uid, attemptId, qid, messages) {
      const key = `${uid}/${attemptId}/${qid}`;
      data.set(key, messages);
      updated.set(key, ++clock);
      chats.saved.push({ key, messages });
    },
    async list(uid) {
      if (chats.listError) throw chats.listError;
      return [...data]
        .filter(([key]) => key.startsWith(`${uid}/`))
        .map(([key, messages]) => {
          const [, attemptId, qid] = key.split('/');
          return { attemptId, qid: Number(qid), updatedAt: updated.get(key) ?? 0, last: summarize(messages) };
        });
    },
  };
  return chats;
}
