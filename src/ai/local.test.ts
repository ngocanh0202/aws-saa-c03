import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_HISTORY_LIMIT, LOCAL_TIMEOUT_MS, createLocalAiClient, createThinkFilter } from './local';
import { AiUserError, type AiTool, type ChatMessage } from './types';

const enc = new TextEncoder();

function stream(pieces: string[], { hang = false } = {}): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const p of pieces) c.enqueue(enc.encode(p));
      if (!hang) c.close();
    },
  });
}

const event = (delta: object) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
const DONE = 'data: [DONE]\n\n';

type Reply = { status?: number; text?: string; pieces?: string[]; hang?: boolean } | Error;

/** fetch giả: mỗi lần gọi lấy một phản hồi theo thứ tự, ghi lại body đã gửi. */
function fakeFetch(replies: Reply[]) {
  const bodies: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    bodies.push({ url, body: JSON.parse(String(init?.body)) });
    const r = replies[Math.min(bodies.length - 1, replies.length - 1)];
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      text: async () => r.text ?? '',
      body: stream(r.pieces ?? [], { hang: r.hang }),
    } as unknown as Response;
  }) as typeof fetch;
  return { impl, bodies };
}

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const c of it) out.push(c);
  return out;
}

const find: AiTool = { name: 'find', description: 'tìm', params: { query: 'từ khóa' }, run: (a) => ({ got: a.query }) };

describe('createThinkFilter', () => {
  it('lọc <think>…</think> kể cả khi thẻ bị cắt giữa các mảnh', () => {
    const f = createThinkFilter();
    const out = ['Xin <th', 'ink>bí mật', ' nữa</thi', 'nk>chào', ' bạn'].map(f).join('');
    expect(out).toBe('Xin chào bạn');
  });
});

describe('createThinkFilter: chỉ có thẻ đóng', () => {
  it('model bắt đầu thẳng bằng phần suy nghĩ, chỉ có </think> (bị cắt giữa mảnh): không lộ suy nghĩ', () => {
    const f = createThinkFilter();
    const out = ['suy nghĩ…', ' tiếp </th', 'ink>Đáp', ' án'].map(f).join('') + f.flush();
    expect(out).toBe('Đáp án');
  });

  it('không có thẻ nào: hết stream thì trả đủ chữ', () => {
    const f = createThinkFilter();
    const out = ['Xin ', 'chào'].map(f).join('') + f.flush();
    expect(out).toBe('Xin chào');
  });
});

describe('createLocalAiClient', () => {
  afterEach(() => vi.useRealTimers());

  it('gửi system + lịch sử + tin mới, stream chữ; có model thì gửi model', async () => {
    const f = fakeFetch([{ pieces: [event({ content: 'Vì ' }), event({ content: 'S3' }), DONE] }]);
    const chat = createLocalAiClient('http://x/', 'qwen', f.impl).startChat('SYS', [
      { role: 'user', text: 'a' },
      { role: 'model', text: 'b' },
    ]);
    // Chưa biết model có phần suy nghĩ không (không thẻ, không reasoning_content): giữ tới khi hết stream.
    expect((await collect(chat.send('hỏi'))).join('')).toBe('Vì S3');
    const body = f.bodies[0];
    expect(f.bodies[0].url).toBe('http://x/v1/chat/completions');
    expect(body.body.model).toBe('qwen');
    expect(body.body.stream).toBe(true);
    expect(body.body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'hỏi' },
    ]);
  });

  it('không có model thì bỏ trường model; lịch sử tối đa 12 tin', async () => {
    const f = fakeFetch([{ pieces: [event({ content: 'ok' }), DONE] }]);
    const history: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: String(i) }));
    await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', history).send('q'));
    expect('model' in f.bodies[0].body).toBe(false);
    const messages = f.bodies[0].body.messages as unknown[];
    expect(messages.length).toBeLessThanOrEqual(1 + LOCAL_HISTORY_LIMIT + 1);
  });

  it('server tách reasoning_content thì câu trả lời stream ngay từng mảnh', async () => {
    const f = fakeFetch([{ pieces: [event({ reasoning_content: 'nghĩ' }), event({ content: 'Một ' }), event({ content: 'hai' }), DONE] }]);
    expect(await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', []).send('q'))).toEqual(['Một ', 'hai']);
  });

  it('phần suy nghĩ không ra chữ: <think> bị lọc, reasoning_content gọi onThinking', async () => {
    const f = fakeFetch([{ pieces: [event({ reasoning_content: 'nghĩ…' }), event({ content: '<think>x</think>Đáp' }), event({ content: ' án' }), DONE] }]);
    const thinking = vi.fn();
    const out = await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', [], { onThinking: thinking }).send('q'));
    expect(out.join('')).toBe('Đáp án');
    expect(thinking).toHaveBeenCalled();
  });

  it('tool_calls nhiều mảnh: chạy tool với args đầy đủ, gửi lại assistant tool_calls + tin tool', async () => {
    const call = (args: string, extra: object = {}) => event({ tool_calls: [{ index: 0, ...extra, function: { ...('name' in extra ? {} : {}), arguments: args } }] });
    const f = fakeFetch([
      {
        pieces: [
          event({ tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'find', arguments: '{"que' } }] }),
          call('ry":"multi'),
          call('part"}'),
          DONE,
        ],
      },
      { pieces: [event({ content: 'Tìm thấy' }), DONE] },
    ]);
    const run = vi.fn(find.run);
    const out = await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', [], { tools: [{ ...find, run }] }).send('tìm'));
    expect(out).toEqual(['Tìm thấy']);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ query: 'multipart' });
    expect(f.bodies[0].body.tools).toEqual([
      { type: 'function', function: { name: 'find', description: 'tìm', parameters: { type: 'object', properties: { query: { type: 'string', description: 'từ khóa' } }, required: ['query'] } } },
    ]);
    const second = f.bodies[1].body.messages as Record<string, unknown>[];
    expect(second.at(-2)).toEqual({ role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'find', arguments: '{"query":"multipart"}' } }] });
    expect(second.at(-1)).toEqual({ role: 'tool', tool_call_id: 'c1', content: JSON.stringify({ got: 'multipart' }) });
  });

  it('lượt sau nhớ câu trả lời lượt trước', async () => {
    const f = fakeFetch([{ pieces: [event({ content: 'Một' }), DONE] }, { pieces: [event({ content: 'Hai' }), DONE] }]);
    const chat = createLocalAiClient('http://x', undefined, f.impl).startChat('S', []);
    await collect(chat.send('q1'));
    await collect(chat.send('q2'));
    expect((f.bodies[1].body.messages as unknown[]).slice(1)).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'Một' },
      { role: 'user', content: 'q2' },
    ]);
  });

  it('không kết nối được (fetch ném, HTTP 500) → AiUserError kết nối', async () => {
    for (const reply of [new TypeError('Failed to fetch'), { status: 500, text: 'boom' }] as Reply[]) {
      const f = fakeFetch([reply]);
      const err = await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', []).send('q')).catch((e) => e);
      expect(err).toBeInstanceOf(AiUserError);
      expect((err as AiUserError).userMessage).toContain('Không kết nối được AI thử nghiệm');
    }
  });

  it('HTTP 400 vì quá ngữ cảnh → AiUserError ngữ cảnh', async () => {
    const f = fakeFetch([{ status: 400, text: '{"error":"Trying to keep the first 9000 tokens when context the overflows. n_ctx: 4096"}' }]);
    const err = await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', []).send('q')).catch((e) => e);
    expect((err as AiUserError).userMessage).toContain('dài quá ngữ cảnh');
  });

  it('lỗi gửi trong stream (data: {"error":…}) → AiUserError theo nội dung lỗi', async () => {
    const f = fakeFetch([{ pieces: [`data: ${JSON.stringify({ error: { message: 'Context length exceeded (n_ctx 4096)' } })}

`] }]);
    const err = await collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', []).send('q')).catch((e) => e);
    expect((err as AiUserError).userMessage).toContain('dài quá ngữ cảnh');
    const g = fakeFetch([{ pieces: [`event: error
data: ${JSON.stringify({ error: 'model crashed' })}

`] }]);
    const err2 = await collect(createLocalAiClient('http://x', undefined, g.impl).startChat('S', []).send('q')).catch((e) => e);
    expect((err2 as AiUserError).userMessage).toContain('Không kết nối được AI thử nghiệm');
  });

  it('cùng một phiên hỏi nhiều lần: mỗi lần gửi vẫn chỉ tối đa 12 tin gần nhất, bắt đầu bằng tin người hỏi', async () => {
    const f = fakeFetch([{ pieces: [event({ content: 'ok' }), DONE] }]);
    const chat = createLocalAiClient('http://x', undefined, f.impl).startChat('S', []);
    for (let i = 0; i < 10; i++) await collect(chat.send(`q${i}`));
    const last = f.bodies.at(-1)!.body.messages as { role: string; content: string }[];
    expect(last[0]).toEqual({ role: 'system', content: 'S' });
    expect(last.length - 1).toBeLessThanOrEqual(LOCAL_HISTORY_LIMIT);
    expect(last[1].role).toBe('user');
    expect(last.at(-1)).toEqual({ role: 'user', content: 'q9' });
  });

  it(`quá ${LOCAL_TIMEOUT_MS / 1000} giây không có phản hồi → lỗi kết nối`, async () => {
    vi.useFakeTimers();
    const f = fakeFetch([{ hang: true }]);
    const p = collect(createLocalAiClient('http://x', undefined, f.impl).startChat('S', []).send('q')).catch((e) => e);
    await vi.advanceTimersByTimeAsync(LOCAL_TIMEOUT_MS + 10);
    const err = await p;
    expect((err as AiUserError).userMessage).toContain('Không kết nối được AI thử nghiệm');
  });
});
