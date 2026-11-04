import { describe, expect, it } from 'vitest';
import { MAX_TOOL_ROUNDS, toolLoop, type FunctionCallLike, type ToolTurn, type TurnResult } from './tool-loop';
import { AiBusyError } from './retry';
import type { AiTool } from './types';

async function* chunks(list: string[]) {
  yield* list;
}

/** send giả: mỗi lượt lấy một kịch bản (chữ + function call) theo thứ tự. */
function script(turns: { text?: string[]; calls?: FunctionCallLike[] }[]) {
  const sent: ToolTurn[] = [];
  const send = async (turn: ToolTurn): Promise<TurnResult> => {
    const t = turns[Math.min(sent.length, turns.length - 1)];
    sent.push(turn);
    return { chunks: chunks(t.text ?? []), calls: async () => t.calls ?? [] };
  };
  return { sent, send };
}

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const c of it) out.push(c);
  return out;
}

const find: AiTool = {
  name: 'find',
  description: 'tìm',
  params: { query: 'từ khóa' },
  run: (args) => ({ results: [String(args.query)] }),
};

describe('toolLoop', () => {
  it('không có function call: stream chữ rồi dừng', async () => {
    const s = script([{ text: ['Xin ', 'chào'] }]);
    expect(await collect(toolLoop(s.send, 'hi'))).toEqual(['Xin ', 'chào']);
    expect(s.sent).toEqual(['hi']);
  });

  it('có function call: chạy tool, gửi functionResponse, stream câu trả lời cuối', async () => {
    const s = script([{ calls: [{ name: 'find', args: { query: 'multipart' } }] }, { text: ['Tìm ', 'thấy'] }]);
    const called: string[] = [];
    const out = await collect(toolLoop(s.send, 'tìm câu', { tools: [find], onToolCall: (n) => called.push(n) }));
    expect(out).toEqual(['Tìm ', 'thấy']);
    expect(called).toEqual(['find']);
    expect(s.sent[1]).toEqual([{ name: 'find', response: { results: ['multipart'] } }]);
  });

  it('tool không tồn tại trả { error: "unknown tool" }', async () => {
    const s = script([{ calls: [{ name: 'nope', args: {} }] }, { text: ['ok'] }]);
    await collect(toolLoop(s.send, 'x', { tools: [find] }));
    expect(s.sent[1]).toEqual([{ name: 'nope', response: { error: 'unknown tool' } }]);
  });

  it('lỗi bận lúc gửi thì chờ rồi gửi lại cùng lượt', async () => {
    const s = script([{ text: ['Được'] }]);
    let failed = false;
    const send = async (turn: ToolTurn) => {
      if (!failed) {
        failed = true;
        throw new AiBusyError(429, 10);
      }
      return s.send(turn);
    };
    const waits: number[] = [];
    const out = await collect(toolLoop(send, 'hi', { retry: { sleep: async (ms) => void waits.push(ms), onWait: () => undefined } }));
    expect(out).toEqual(['Được']);
    expect(waits).toEqual([10]);
    expect(s.sent).toEqual(['hi']);
  });

  it('vượt 3 vòng thì ném lỗi', async () => {
    const s = script([{ calls: [{ name: 'find', args: { query: 'a' } }] }]);
    await expect(collect(toolLoop(s.send, 'x', { tools: [find] }))).rejects.toThrow('too many tool calls');
    expect(s.sent).toHaveLength(MAX_TOOL_ROUNDS + 1);
  });
});
