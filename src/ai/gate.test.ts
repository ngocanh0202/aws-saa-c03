import { describe, expect, it, vi } from 'vitest';
import { AiGateBusyError, busyMessage, createAiGate, targetKey, type AiJob } from './gate';

const chat: AiJob = { kind: 'chat', label: 'Câu 1', target: { page: 'attempt', attemptId: 'e1', qid: 5 } };
const note: AiJob = { kind: 'note', label: 'Câu 2', target: { page: 'attempt', attemptId: 'e1', qid: 6, highlightId: 'h1' } };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createAiGate', () => {
  it('rảnh thì chạy fn; current() là job trong lúc chạy, null sau đó', async () => {
    const gate = createAiGate();
    const d = deferred<string>();
    const listener = vi.fn();
    gate.subscribe(listener);
    const p = gate.run(chat, () => d.promise);
    expect(gate.current()).toBe(chat);
    expect(listener).toHaveBeenCalled();
    d.resolve('xong');
    await expect(p).resolves.toBe('xong');
    expect(gate.current()).toBeNull();
  });

  it('bận thì ném AiGateBusyError, không gọi fn', async () => {
    const gate = createAiGate();
    const d = deferred<void>();
    void gate.run(chat, () => d.promise);
    const fn = vi.fn(async () => undefined);
    await expect(gate.run(note, fn)).rejects.toBeInstanceOf(AiGateBusyError);
    expect(fn).not.toHaveBeenCalled();
    expect(gate.current()).toBe(chat);
    d.resolve();
  });

  it('fn reject vẫn nhả gate và báo onFinished(job, false); xong thì báo true', async () => {
    const gate = createAiGate();
    const finished = vi.fn();
    gate.onFinished(finished);
    await expect(gate.run(chat, async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(gate.current()).toBeNull();
    expect(finished).toHaveBeenLastCalledWith(chat, false);
    await gate.run(note, async () => 1);
    expect(finished).toHaveBeenLastCalledWith(note, true);
  });

  it('fn ném lỗi đồng bộ cũng nhả gate', async () => {
    const gate = createAiGate();
    await expect(
      gate.run(chat, () => {
        throw new Error('sync');
      }),
    ).rejects.toThrow('sync');
    expect(gate.current()).toBeNull();
  });

  it('setViewing/viewing', () => {
    const gate = createAiGate();
    expect(gate.viewing()).toBeNull();
    gate.setViewing('attempt:e1:5');
    expect(gate.viewing()).toBe('attempt:e1:5');
    gate.setViewing(null);
    expect(gate.viewing()).toBeNull();
  });

  it('takeOpen trả target khớp đúng một lần rồi null; peekOpen không xóa', () => {
    const gate = createAiGate();
    const listener = vi.fn();
    gate.subscribe(listener);
    gate.requestOpen(chat.target);
    expect(listener).toHaveBeenCalled();
    expect(gate.peekOpen()).toEqual(chat.target);
    expect(gate.takeOpen((t) => t.page === 'notes')).toBeNull();
    expect(gate.peekOpen()).toEqual(chat.target);
    expect(gate.takeOpen((t) => t.page === 'attempt' && t.qid === 5)).toEqual(chat.target);
    expect(gate.takeOpen(() => true)).toBeNull();
    expect(gate.peekOpen()).toBeNull();
  });

  it('targetKey 3 dạng', () => {
    expect(targetKey({ page: 'attempt', attemptId: 'e1', qid: 5 })).toBe('attempt:e1:5');
    expect(targetKey({ page: 'attempt', attemptId: 'e1', qid: 5, highlightId: 'h1' })).toBe('attempt:e1:5:h1');
    expect(targetKey({ page: 'notes', qid: 5, highlightId: 'h1' })).toBe('notes:5:h1');
  });
});

describe('busyMessage', () => {
  const t = { page: 'notes' as const, qid: 5, highlightId: 'h' };
  it('theo loại việc', () => {
    expect(busyMessage({ kind: 'chat', label: 'Câu 1', target: { page: 'attempt', attemptId: 'e', qid: 5 } })).toBe('AI đang trả lời ở Câu 1');
    expect(busyMessage({ kind: 'note', label: 'Câu 1', target: t })).toBe('AI đang soạn ghi chú ở Câu 1');
    expect(busyMessage({ kind: 'form', label: 'Câu 1', target: t })).toBe('AI đang soạn ghi chú ở Câu 1');
  });
});
