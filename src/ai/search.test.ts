import { describe, expect, it } from 'vitest';
import type { Attempt, Mode } from '../engine/attempt';
import type { Question, QuestionMeta } from '../data/types';
import { createStore } from '../storage/storage';
import { makeMainQuestion, makeQuestion, memoryStorage } from '../test/fixtures';
import { createSearchTool, searchAnswered, SEARCH_TOOL } from './search';

const MULTIPART: Question = {
  ...makeQuestion(5, ['A', 'B', 'C', 'D'], ['B']),
  stem: 'A company uploads a 2 GB file to S3 every day.',
  prompt: 'Which is the fastest way to upload the file?',
  options: [
    { key: 'A', text: 'Upload in a single operation' },
    { key: 'B', text: 'Use multipart upload' },
    { key: 'C', text: 'FTP to an EC2 instance' },
    { key: 'D', text: 'Use AWS Snowball' },
  ],
};

function bank(extra: Question[] = [], twins: [number, number][] = []) {
  const questions = new Map<number, Question>([
    [1, makeQuestion(1)],
    [5, MULTIPART],
    [10101, makeMainQuestion(10101)],
    ...extra.map((q) => [q.id, q] as [number, Question]),
  ]);
  const meta = new Map<number, QuestionMeta>([[1, { id: 1, domain: 1, difficulty: 1, services: ['s3'] }]]);
  const services = new Map([['s3', { id: 's3', name: 'Amazon S3', category: 'Storage' }]]);
  const canon = new Map(twins.map(([a, b]) => [Math.max(a, b), Math.min(a, b)]));
  return { questions, meta, services, canonical: (qid: number) => canon.get(qid) ?? qid };
}

function attempt(id: string, opts: { setId?: number; mode?: Mode; status?: Attempt['status']; at?: number; guideOpened?: number[]; answers: Record<number, string[]> }): Attempt {
  const qids = Object.keys(opts.answers).map(Number);
  return {
    id,
    setId: opts.setId ?? 1,
    mode: opts.mode ?? 'practice',
    seed: 1,
    esl: false,
    startedAt: opts.at ?? Date.UTC(2026, 10, 1, 3),
    questions: [{ qid: 99, domain: 1, optionOrder: ['A', 'B', 'C', 'D'] }, ...qids.map((qid) => ({ qid, domain: 1 as const, optionOrder: ['D', 'C', 'B', 'A'] }))],
    answers: opts.answers,
    flagged: [],
    guideOpened: opts.guideOpened ?? [],
    status: opts.status ?? 'submitted',
    ...(opts.status === 'in-progress' ? {} : { submittedAt: (opts.at ?? Date.UTC(2026, 10, 1, 3)) + 1000 }),
  };
}

const CTX = { setId: 1, attemptId: 'now', qid: 42 };

describe('searchAnswered', () => {
  it('tìm theo chữ trong đề, trả đề, lựa chọn và lần làm', () => {
    const hits = searchAnswered('multipart upload', CTX, [attempt('a1', { answers: { 5: ['A'] } })], bank());
    expect(hits).toHaveLength(1);
    const [hit] = hits;
    expect(hit.qid).toBe(5);
    expect(hit.label).toBe('Đề 1 · Câu 2');
    expect(hit.question).toContain('2 GB file');
    expect(hit.question).toContain('fastest way');
    expect(hit.options).toContainEqual({ text: 'Use multipart upload', correct: true });
    expect(hit.options).toContainEqual({ text: 'Upload in a single operation', correct: false });
    expect(hit.tries[0]).toMatchObject({ attemptId: 'a1', position: 2, chosen: ['Upload in a single operation'], correct: false, submitted: true, mode: 'practice' });
    expect(hit.tries[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hit.current).toBe(false);
  });

  it('chỉ tìm trong cùng setId', () => {
    expect(searchAnswered('multipart', CTX, [attempt('a1', { setId: 2, answers: { 5: ['B'] } })], bank())).toEqual([]);
  });

  it('bỏ lượt Thi thật đang làm, giữ Thi thật đã nộp', () => {
    const real = (id: string, status: Attempt['status']) => attempt(id, { mode: 'real', status, answers: { 5: ['B'] } });
    expect(searchAnswered('multipart', CTX, [real('r1', 'in-progress')], bank())).toEqual([]);
    expect(searchAnswered('multipart', CTX, [real('r2', 'submitted')], bank())[0].tries[0]).toMatchObject({ attemptId: 'r2', correct: true, mode: 'real' });
  });

  it('bỏ lượt incompatible và câu chưa trả lời', () => {
    expect(searchAnswered('multipart', CTX, [attempt('x', { status: 'incompatible', answers: { 5: ['B'] } })], bank())).toEqual([]);
    expect(searchAnswered('multipart', CTX, [attempt('y', { answers: { 5: [] } })], bank())).toEqual([]);
  });

  it('gộp một câu làm ở nhiều lượt, mới nhất trước', () => {
    const old = attempt('old', { at: Date.UTC(2026, 9, 1), answers: { 5: ['A'] } });
    const recent = attempt('new', { at: Date.UTC(2026, 10, 2), status: 'in-progress', answers: { 1: ['A'], 5: ['B'] } });
    const hits = searchAnswered('multipart', CTX, [old, recent], bank());
    expect(hits).toHaveLength(1);
    expect(hits[0].tries.map((t) => t.attemptId)).toEqual(['new', 'old']);
    expect(hits[0].tries[0]).toMatchObject({ correct: true, submitted: false, position: 3 });
    expect(hits[0].label).toBe('Đề 1 · Câu 3');
  });

  it('đánh dấu câu đang làm', () => {
    const hits = searchAnswered('multipart', { setId: 1, attemptId: 'a1', qid: 5 }, [attempt('a1', { answers: { 5: ['B'] } })], bank());
    expect(hits[0].current).toBe(true);
  });

  it('khớp theo tên service trong meta', () => {
    const hits = searchAnswered('amazon s3', CTX, [attempt('a1', { answers: { 1: ['A'] } })], bank());
    expect(hits.map((h) => h.qid)).toEqual([1]);
    expect(hits[0].services).toEqual(['Amazon S3']);
  });

  it('không phân biệt hoa thường; giới hạn 5', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...MULTIPART, id: 200 + i }));
    const answers = Object.fromEntries(many.map((q) => [q.id, ['B']]));
    const hits = searchAnswered('MULTIPART Upload', CTX, [attempt('a1', { answers })], bank(many));
    expect(hits).toHaveLength(5);
  });

  it('truy vấn rỗng hoặc chỉ khoảng trắng trả []', () => {
    const list = [attempt('a1', { answers: { 5: ['B'] } })];
    expect(searchAnswered('', CTX, list, bank())).toEqual([]);
    expect(searchAnswered('   ', CTX, list, bank())).toEqual([]);
  });

  it('câu main HTML không còn thẻ', () => {
    const hits = searchAnswered('main stem', { ...CTX, setId: 101 }, [attempt('m1', { setId: 101, answers: { 10101: ['A'] } })], bank());
    expect(hits).toHaveLength(1);
    expect(hits[0].question).toContain('Main stem 10101');
    expect(JSON.stringify(hits[0])).not.toMatch(/<\/?p>/);
  });

  it('từ ngắn/từ nối không làm khớp câu không liên quan', () => {
    const unrelated: Question = { ...makeQuestion(6), stem: 'Upload application logs to S3 within a day.', prompt: 'Which is the cheapest storage class?' };
    const list = [attempt('a1', { answers: { 5: ['B'], 6: ['A'] } })];
    expect(searchAnswered('multipart upload in s3', CTX, list, bank([unrelated])).map((h) => h.qid)).toEqual([5]);
  });

  it('khớp theo nguyên từ, không theo một phần của từ', () => {
    const list = [attempt('a1', { answers: { 5: ['B'] } })];
    expect(searchAnswered('part', CTX, list, bank())).toEqual([]);
  });

  it('không có nhãn A/B/C', () => {
    const hits = searchAnswered('multipart', CTX, [attempt('a1', { answers: { 5: ['B'] } })], bank());
    expect(JSON.stringify(hits)).not.toContain('"key"');
  });
});

describe('searchAnswered: ẩn đáp án câu chưa thấy', () => {
  const CUR = { ...CTX, attemptId: 'a1' };
  const run = (list: Attempt[], ctx = CUR) => searchAnswered('multipart', ctx, list, bank());

  it('câu trong lượt đang làm, chưa mở hướng dẫn: ẩn đáp án dù lượt cũ đã nộp có câu đó', () => {
    const cur = attempt('a1', { mode: 'practice', status: 'in-progress', answers: { 5: ['A'] }, guideOpened: [] });
    const old = attempt('a0', { status: 'submitted', answers: { 5: ['B'] } });
    const [hit] = run([cur, old]);
    expect(hit.answerHidden).toBe(true);
    expect(hit.options.every((o) => o.correct === undefined)).toBe(true);
    expect(hit.tries.every((t) => t.correct === undefined)).toBe(true);
    expect(JSON.stringify(hit)).not.toContain('"correct"');
  });

  it('câu trong lượt đang làm đã mở hướng dẫn: có đáp án', () => {
    const cur = attempt('a1', { mode: 'practice', status: 'in-progress', answers: { 5: ['A'] }, guideOpened: [5] });
    const [hit] = run([cur]);
    expect(hit.answerHidden).toBe(false);
    expect(hit.options.some((o) => o.correct === true)).toBe(true);
    expect(hit.tries[0].correct).toBe(false);
  });

  it('câu chỉ ở lượt khác đã nộp: có đáp án', () => {
    const [hit] = run([attempt('a9', { answers: { 5: ['B'] } })]);
    expect(hit.answerHidden).toBe(false);
    expect(hit.tries[0].correct).toBe(true);
  });

  it('câu chỉ ở lượt Thi thử khác chưa nộp, chưa mở hướng dẫn: ẩn', () => {
    const [hit] = run([attempt('a2', { status: 'in-progress', answers: { 5: ['B'] } })], { ...CTX, attemptId: 'a1' });
    expect(hit.answerHidden).toBe(true);
    expect(hit.options.every((o) => o.correct === undefined)).toBe(true);
  });

  it('câu chỉ ở lượt Thi thử khác chưa nộp, đã mở hướng dẫn: có đáp án', () => {
    const [hit] = run([attempt('a2', { status: 'in-progress', answers: { 5: ['B'] }, guideOpened: [5] })]);
    expect(hit.answerHidden).toBe(false);
    expect(hit.options.some((o) => o.correct === true)).toBe(true);
  });
});

describe('searchAnswered: câu trùng (twin)', () => {
  // 246/253 trùng nguyên văn: canonical(253) = 246.
  const twinBank = () => bank([{ ...MULTIPART, id: 246 }, { ...MULTIPART, id: 253 }], [[246, 253]]);
  const CUR = { setId: 1, attemptId: 'b', qid: 246 };

  it('câu trùng của câu đang làm (chưa mở hướng dẫn) nằm ở lượt khác đã nộp: ẩn đáp án', () => {
    const a = attempt('a', { status: 'submitted', answers: { 253: ['B'] } });
    const b = attempt('b', { status: 'in-progress', answers: { 246: ['A'] } });
    const hits = searchAnswered('multipart', CUR, [a, b], twinBank());
    expect(hits.map((h) => h.qid).sort()).toEqual([246, 253]);
    for (const h of hits) {
      expect(h.answerHidden).toBe(true);
      expect(JSON.stringify(h)).not.toContain('"correct"');
    }
  });

  it('câu trùng của câu đang làm đã mở hướng dẫn: có đáp án', () => {
    const a = attempt('a', { status: 'submitted', answers: { 253: ['B'] } });
    const b = attempt('b', { status: 'in-progress', answers: { 246: ['A'] }, guideOpened: [246] });
    const hit = searchAnswered('multipart', CUR, [a, b], twinBank()).find((h) => h.qid === 253)!;
    expect(hit.answerHidden).toBe(false);
  });

  it('lượt đang hỏi có mặt nhưng không chứa câu (cũng không chứa câu trùng): theo lượt khác đã nộp', () => {
    const a = attempt('a', { status: 'submitted', answers: { 5: ['B'] } });
    const b = attempt('b', { status: 'in-progress', answers: { 1: ['A'] } });
    const [hit] = searchAnswered('multipart', CUR, [a, b], twinBank()).filter((h) => h.qid === 5);
    expect(hit.answerHidden).toBe(false);
    expect(hit.tries[0].correct).toBe(true);
  });
});

describe('createSearchTool', () => {
  it('tool không sửa lượt thi nào', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    store.save(attempt('open', { status: 'in-progress', answers: { 5: ['A'] } }));
    store.save(attempt('open2', { status: 'in-progress', answers: { 5: ['B'] } }));
    const before = JSON.stringify(store.list());
    const tool = createSearchTool(store, bank(), CTX);
    expect(tool.name).toBe(SEARCH_TOOL);
    const out = (await tool.run({ query: 'multipart' })) as { results: { answerHidden: boolean }[] };
    expect(out.results).toHaveLength(1);
    expect(out.results[0].answerHidden).toBe(true);
    expect(JSON.stringify(store.list())).toBe(before);
  });

  it('args không phải chuỗi thì coi như rỗng', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    store.save(attempt('a1', { answers: { 5: ['B'] } }));
    expect(await createSearchTool(store, bank(), CTX).run({ query: 5 })).toEqual({ results: [] });
  });
});
