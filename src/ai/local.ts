import { prepareHistory } from './prompt';
import { toolLoop, type FunctionCallLike } from './tool-loop';
import { AiUserError, type AiClient, type AiTool } from './types';

/** Model nạp trong LM Studio thường có ngữ cảnh ngắn (4k–8k token): gửi ít lịch sử hơn Gemini. */
export const LOCAL_HISTORY_LIMIT = 12;
/** Chờ phản hồi đầu tiên (model cục bộ có thể nạp chậm); quá thì coi như không kết nối được. */
export const LOCAL_TIMEOUT_MS = 60_000;

export const LOCAL_CONNECT_ERROR = 'Không kết nối được AI thử nghiệm. Kiểm tra LM Studio và Cloudflare Tunnel.';
export const LOCAL_CONTEXT_ERROR = 'Cuộc trò chuyện dài quá ngữ cảnh của model đang nạp. Tăng Context Length trong LM Studio hoặc hỏi ngắn hơn.';

type OpenAiMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** Độ dài phần đầu của tag nằm ở cuối s (thẻ có thể bị cắt giữa hai mảnh stream). */
function partialSuffix(s: string, tag: string): number {
  for (let k = Math.min(tag.length - 1, s.length); k > 0; k--) if (s.endsWith(tag.slice(0, k))) return k;
  return 0;
}

/**
 * Lọc phần suy nghĩ `<think>…</think>` khỏi chữ stream về (thẻ có thể bị cắt giữa các mảnh).
 * Trả về phần chữ hiện được của mảnh này; `flush()` lấy nốt phần còn giữ lại khi hết stream.
 */
export function createThinkFilter(): ((chunk: string) => string) & { flush(): string } {
  let buf = '';
  let inThink = false;
  const filter = (chunk: string) => {
    buf += chunk;
    let out = '';
    for (;;) {
      if (inThink) {
        const end = buf.indexOf('</think>');
        if (end < 0) {
          buf = buf.slice(buf.length - partialSuffix(buf, '</think>'));
          return out;
        }
        buf = buf.slice(end + '</think>'.length);
        inThink = false;
      } else {
        const start = buf.indexOf('<think>');
        if (start < 0) {
          const keep = partialSuffix(buf, '<think>');
          out += buf.slice(0, buf.length - keep);
          buf = buf.slice(buf.length - keep);
          return out;
        }
        out += buf.slice(0, start);
        buf = buf.slice(start + '<think>'.length);
        inThink = true;
      }
    }
  };
  return Object.assign(filter, {
    flush() {
      const rest = inThink ? '' : buf;
      buf = '';
      return rest;
    },
  });
}

function toolSpec(tool: AiTool) {
  const keys = Object.keys(tool.params);
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(keys.map((k) => [k, { type: 'string', description: tool.params[k] }])),
        ...(keys.length ? { required: keys } : {}),
      },
    },
  };
}

/** Đọc từng sự kiện `data: {...}` của SSE; `[DONE]` thì dừng. */
async function* readSse(body: ReadableStream<Uint8Array>, read: <T>(p: Promise<T>) => Promise<T>): AsyncIterable<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await read(reader.read());
    if (done) return;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!data) continue;
      if (data === '[DONE]') return;
      try {
        yield JSON.parse(data);
      } catch {
        // dòng hỏng: bỏ qua
      }
    }
  }
}

interface Delta {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

/**
 * AI thử nghiệm qua LM Studio (API kiểu OpenAI: POST /v1/chat/completions, stream SSE, tool calling).
 * Chỉ dùng fetch. Lỗi kết nối/HTTP thành AiUserError có câu báo cho người học.
 */
export function createLocalAiClient(baseUrl: string, model?: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): AiClient {
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  return {
    startChat(systemPrompt, history, options = {}) {
      const convo: OpenAiMessage[] = [
        { role: 'system', content: systemPrompt },
        ...prepareHistory(history, LOCAL_HISTORY_LIMIT).map(
          (m): OpenAiMessage => (m.role === 'user' ? { role: 'user', content: m.text } : { role: 'assistant', content: m.text }),
        ),
      ];
      const tools = options.tools?.length ? options.tools.map(toolSpec) : undefined;
      let lastCallIds: string[] = [];

      const request = async () => {
        let seen = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new AiUserError(LOCAL_CONNECT_ERROR));
          }, LOCAL_TIMEOUT_MS);
        });
        timeout.catch(() => undefined);
        const read = <T,>(p: Promise<T>) => (seen ? p : Promise.race([p, timeout]));
        const markSeen = () => {
          seen = true;
          clearTimeout(timer);
        };

        let res: Response;
        try {
          res = await read(
            fetchImpl(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...(model ? { model } : {}), messages: convo, stream: true, ...(tools ? { tools } : {}) }),
              signal: controller.signal,
            }),
          );
        } catch (e) {
          clearTimeout(timer);
          throw e instanceof AiUserError ? e : new AiUserError(LOCAL_CONNECT_ERROR);
        }
        if (!res.ok || !res.body) {
          clearTimeout(timer);
          const text = await res.text().catch(() => '');
          throw new AiUserError(res.status < 500 && /context|n_ctx|token/i.test(text) ? LOCAL_CONTEXT_ERROR : LOCAL_CONNECT_ERROR);
        }

        const filter = createThinkFilter();
        let answer = '';
        const calls: { id: string; name: string; args: string }[] = [];
        const body = res.body;
        async function* chunks(): AsyncIterable<string> {
          try {
            for await (const event of readSse(body, read)) {
              const delta = (event as { choices?: { delta?: Delta }[] }).choices?.[0]?.delta;
              if (!delta) continue;
              markSeen();
              if (delta.reasoning_content || delta.reasoning) options.onThinking?.();
              for (const tc of delta.tool_calls ?? []) {
                const i = tc.index ?? 0;
                calls[i] ??= { id: '', name: '', args: '' };
                if (tc.id) calls[i].id = tc.id;
                if (tc.function?.name) calls[i].name = tc.function.name;
                calls[i].args += tc.function?.arguments ?? '';
              }
              if (delta.content) {
                const visible = filter(delta.content);
                if (visible) {
                  answer += visible;
                  yield visible;
                } else options.onThinking?.();
              }
            }
            const rest = filter.flush();
            if (rest) {
              answer += rest;
              yield rest;
            }
          } catch (e) {
            throw e instanceof AiUserError ? e : new AiUserError(LOCAL_CONNECT_ERROR);
          } finally {
            clearTimeout(timer);
          }
        }

        return {
          chunks: chunks(),
          async calls(): Promise<FunctionCallLike[]> {
            const list = calls.filter((c) => c?.name);
            if (list.length === 0) {
              convo.push({ role: 'assistant', content: answer });
              return [];
            }
            const withIds = list.map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
            lastCallIds = withIds.map((c) => c.id);
            convo.push({
              role: 'assistant',
              content: answer || null,
              tool_calls: withIds.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })),
            });
            return withIds.map((c) => {
              let args: Record<string, unknown> = {};
              try {
                const parsed: unknown = JSON.parse(c.args || '{}');
                if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>;
              } catch {
                // arguments hỏng: chạy tool với tham số rỗng
              }
              return { name: c.name, args };
            });
          },
        };
      };

      return {
        send(text) {
          convo.push({ role: 'user', content: text });
          return toolLoop(
            async (turn) => {
              if (typeof turn !== 'string') {
                turn.forEach((r, i) => convo.push({ role: 'tool', tool_call_id: lastCallIds[i] ?? `call_${i}`, content: JSON.stringify(r.response) }));
              }
              return request();
            },
            text,
            options,
          );
        },
      };
    },
  };
}
