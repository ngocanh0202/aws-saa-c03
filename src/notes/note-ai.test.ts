import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiGateBusyError, createAiGate, type AiJob } from '../ai/gate';
import { createCooldown } from '../ai/cooldown';
import { DEFAULT_LOCAL_SETTINGS } from '../ai/local-settings';
import { fakeAi } from '../test/fake-ai';
import { makeQuestion, memoryStorage } from '../test/fixtures';
import { NOTE_MAX, type QuestionNotes } from './model';
import { createNotesStore } from './store';
import { draftNote, lastNoteError, resetNoteErrors } from './note-ai';

const QID = 5;
const question = { ...makeQuestion(QID), explanationOrig: 'Giải thích bí mật' };

function setup(note = '') {
  const gate = createAiGate();
  const notes = createNotesStore(memoryStorage());
  notes.setOwner('A');
  const seed: QuestionNotes = { qid: QID, updatedAt: 1, highlights: [{ id: 'h1', part: 'stem', start: 0, end: 4, text: 'Stem', note, updatedAt: 1 }] };
  notes.save(seed);
  const client = fakeAi();
  const cooldown = createCooldown(null);
  const deps = { gate, notes, client, cooldown, now: () => 2000 };
  const job = { question, qid: QID, highlightId: 'h1', text: 'Stem', label: 'Câu 1', target: { page: 'attempt' as const, attemptId: 'e1', qid: QID, highlightId: 'h1' } };
  const finished: [AiJob, boolean][] = [];
  gate.onFinished((j, ok) => finished.push([j, ok]));
  return { gate, notes, client, deps, job, finished };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const noteOf = (s: ReturnType<typeof setup>) => s.notes.get(QID)?.highlights.find((h) => h.id === 'h1')?.note;

afterEach(() => resetNoteErrors());

describe('draftNote', () => {
  it('ghi chú trống: lưu đúng chữ AI (đã trim)', async () => {
    const s = setup();
    s.client.reply = ['  AB', 'C\n'];
    await draftNote(s.deps, s.job);
    expect(noteOf(s)).toBe('ABC');
    expect(s.notes.get(QID)!.updatedAt).toBe(2000);
  });

  it('ghi chú đã có: nối xuống dưới, cách một dòng trống', async () => {
    const s = setup('x');
    s.client.reply = ['ABC'];
    await draftNote(s.deps, s.job);
    expect(noteOf(s)).toBe('x\n\nABC');
  });

  it('cắt ở NOTE_MAX', async () => {
    const s = setup('y'.repeat(NOTE_MAX - 3));
    s.client.reply = ['ABCDEFG'];
    await draftNote(s.deps, s.job);
    expect(noteOf(s)).toHaveLength(NOTE_MAX);
  });

  it('prompt không có đáp án/giải thích; gửi một tin, không history, không tools', async () => {
    const s = setup();
    await draftNote(s.deps, s.job);
    expect(s.client.calls).toHaveLength(1);
    const call = s.client.calls[0];
    expect(call.systemPrompt).toContain('Stem');
    expect(call.systemPrompt).not.toMatch(/Đáp án đúng/i);
    expect(call.systemPrompt).not.toContain('Giải thích bí mật');
    expect(call.history).toEqual([]);
    expect(call.options?.tools).toBeUndefined();
    expect(call.sent).toHaveLength(1);
  });

  it('chuyển settings cho client', async () => {
    const s = setup();
    const settings = { ...DEFAULT_LOCAL_SETTINGS, temperature: 0.1 };
    await draftNote({ ...s.deps, settings }, s.job);
    expect(s.client.calls[0].options?.settings).toBe(settings);
  });

  it('chạy qua gate: trong lúc chạy là việc "note", xong thì rảnh và báo onFinished(ok)', async () => {
    const s = setup();
    s.client.hold = true;
    const p = draftNote(s.deps, s.job);
    expect(s.gate.current()).toEqual({ kind: 'note', label: 'Câu 1', target: s.job.target });
    await tick();
    s.client.release();
    await p;
    expect(s.gate.current()).toBeNull();
    expect(s.finished).toEqual([[{ kind: 'note', label: 'Câu 1', target: s.job.target }, true]]);
  });

  it('đoạn tô bị xóa trước khi xong → không ghi gì', async () => {
    const s = setup();
    s.client.hold = true;
    const p = draftNote(s.deps, s.job);
    s.notes.save({ qid: QID, updatedAt: 3, highlights: [] });
    await tick();
    s.client.release();
    await p;
    expect(s.notes.get(QID)!.highlights).toEqual([]);
  });

  it('đổi tài khoản trước khi xong → ngăn A và B đều không bị ghi', async () => {
    const s = setup();
    s.client.hold = true;
    const p = draftNote(s.deps, s.job);
    s.notes.setOwner('B');
    await tick();
    s.client.release();
    await p;
    expect(s.notes.get(QID)).toBeUndefined();
    s.notes.setOwner('A');
    expect(noteOf(s)).toBe('');
  });

  it('AI lỗi → lastNoteError có câu báo, onFinished(false); lần sau thành công thì xóa lỗi', async () => {
    const s = setup();
    s.client.reply = new Error('boom');
    await draftNote(s.deps, s.job);
    expect(lastNoteError('h1')).toBeTruthy();
    expect(s.finished[0][1]).toBe(false);
    expect(noteOf(s)).toBe('');
    s.client.reply = ['OK'];
    await draftNote(s.deps, s.job);
    expect(lastNoteError('h1')).toBeUndefined();
    expect(noteOf(s)).toBe('OK');
  });

  it('AI trả rỗng → coi là lỗi', async () => {
    const s = setup();
    s.client.reply = ['  '];
    await draftNote(s.deps, s.job);
    expect(lastNoteError('h1')).toBeTruthy();
    expect(s.finished[0][1]).toBe(false);
  });

  it('gate đang bận → ném AiGateBusyError, không gọi AI', async () => {
    const s = setup();
    let release!: () => void;
    void s.gate.run({ kind: 'chat', label: 'Câu 2', target: { page: 'attempt', attemptId: 'e1', qid: 9 } }, () => new Promise<void>((r) => (release = r)));
    await expect(draftNote(s.deps, s.job)).rejects.toBeInstanceOf(AiGateBusyError);
    expect(s.client.calls).toHaveLength(0);
    expect(lastNoteError('h1')).toBeUndefined();
    release();
  });
});

describe('draftNote: AI im lặng', () => {
  afterEach(() => vi.useRealTimers());

  it('90 giây không có chữ: nhả gate, ghi lỗi; chữ đến sau không được lưu', async () => {
    vi.useFakeTimers();
    const s = setup();
    s.client.reply = ['Chữ đến muộn'];
    s.client.hold = true;
    const done = draftNote(s.deps, s.job);
    await vi.advanceTimersByTimeAsync(89_000);
    expect(s.gate.current()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;
    expect(s.gate.current()).toBeNull();
    expect(s.finished.map(([, ok]) => ok)).toEqual([false]);
    expect(lastNoteError('h1')).toBe('AI không phản hồi, vui lòng thử lại.');
    s.client.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(noteOf(s)).toBe('');
  });
});
