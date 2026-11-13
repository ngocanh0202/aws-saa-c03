import { describe, expect, it } from 'vitest';
import { createCooldown } from '../ai/cooldown';
import { AiGateBusyError, createAiGate } from '../ai/gate';
import { AiBusyError } from '../ai/retry';
import { AiUserError } from '../ai/types';
import { fakeAi } from '../test/fake-ai';
import { makeQuestion } from '../test/fixtures';
import { buildFormNotePrompt, canDraftForm, draftFormNote, FORM_AI_REQUEST } from './form-ai';

const question = { ...makeQuestion(5, ['A', 'B', 'C', 'D'], ['C']), explanationOrig: 'GIAI_THICH_BI_MAT' };

function setup() {
  const gate = createAiGate();
  const client = fakeAi();
  const deps = { gate, client, cooldown: createCooldown(null), now: () => 1000 };
  const job = { question, qid: 5, label: 'Câu 1', title: 'Tiêu đề X', content: '' };
  return { gate, client, deps, job };
}

describe('canDraftForm', () => {
  it('cần ít nhất một ô có chữ', () => {
    expect(canDraftForm('', '  ')).toBe(false);
    expect(canDraftForm('a', '')).toBe(true);
    expect(canDraftForm('', 'b')).toBe(true);
  });
});

describe('buildFormNotePrompt', () => {
  it('có câu hỏi: kèm đề, dòng hỏi, lựa chọn, tiêu đề và nội dung; không có đáp án hay giải thích', () => {
    const p = buildFormNotePrompt({ question, title: 'Tiêu đề X', content: 'Nội dung Y' });
    expect(p).toContain('Stem 5');
    expect(p).toContain('Prompt 5?');
    for (const k of ['A', 'B', 'C', 'D']) expect(p).toContain(`Option ${k} of 5`);
    expect(p).toContain('Tiêu đề X');
    expect(p).toContain('Nội dung Y');
    expect(p).not.toContain('GIAI_THICH_BI_MAT');
    expect(p).not.toMatch(/Option C of 5.*(đúng|correct)/i);
    expect(p).not.toMatch(/đáp án( đúng)?:/i);
  });
  it('không có câu hỏi: không có mục Đề bài', () => {
    const p = buildFormNotePrompt({ title: 'Ôn VPC', content: '' });
    expect(p).not.toContain('Đề bài');
    expect(p).toContain('Ôn VPC');
  });
  it('nội dung rỗng: dặn viết nội dung cho tiêu đề; có nội dung: trả lời hoặc bổ sung, không lặp', () => {
    expect(buildFormNotePrompt({ title: 'T', content: '' })).toContain('viết nội dung cho tiêu đề');
    const p = buildFormNotePrompt({ title: 'T', content: 'C' });
    expect(p).toContain('trả lời');
    expect(p).toContain('bổ sung');
    expect(p).toContain('không lặp lại');
  });
});

describe('draftFormNote', () => {
  it('trả chữ AI đã trim; trong lúc chạy gate giữ việc kind form', async () => {
    const s = setup();
    s.client.reply = ['Kết ', 'quả  '];
    s.client.hold = true;
    const p = draftFormNote(s.deps, s.job);
    expect(s.gate.current()?.kind).toBe('form');
    expect(s.gate.current()?.target).toEqual({ page: 'notes', qid: 5, highlightId: 'form' });
    await new Promise((r) => setTimeout(r, 0));
    s.client.release();
    await expect(p).resolves.toBe('Kết quả');
    expect(s.client.calls[0].sent).toEqual([FORM_AI_REQUEST]);
  });
  it('AI quá tải: ném AiUserError có câu quá tải', async () => {
    const s = setup();
    s.client.reply = new AiBusyError(429);
    const err = await draftFormNote(s.deps, s.job).catch((e) => e);
    expect(err).toBeInstanceOf(AiUserError);
    expect((err as AiUserError).userMessage).toBe('AI đang quá tải hoặc hết lượt, thử lại sau ít phút.');
  });
  it('lỗi khác hoặc trả lời rỗng: câu lỗi chung', async () => {
    const s = setup();
    s.client.reply = ['   '];
    const err = await draftFormNote(s.deps, s.job).catch((e) => e);
    expect((err as AiUserError).userMessage).toBe('AI không soạn được ghi chú. Thử lại sau.');
  });
  it('gate đang bận: ném AiGateBusyError', async () => {
    const s = setup();
    let done!: () => void;
    void s.gate.run({ kind: 'chat', label: 'x', target: { page: 'attempt', attemptId: 'e', qid: 1 } }, () => new Promise<void>((r) => (done = r)));
    await expect(draftFormNote(s.deps, s.job)).rejects.toBeInstanceOf(AiGateBusyError);
    done();
  });
});
