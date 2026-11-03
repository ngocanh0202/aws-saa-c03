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

function bank(extra: Question[] = []) {
  const questions = new Map<number, Question>([
    [1, makeQuestion(1)],
    [5, MULTIPART],
    [10101, makeMainQuestion(10101)],
    ...extra.map((q) => [q.id, q] as [number, Question]),
  ]);
  const meta = new Map<number, QuestionMeta>([[1, { id: 1, domain: 1, difficulty: 1, services: ['s3'] }]]);
  const services = new Map([['s3', { id: 's3', name: 'Amazon S3', category: 'Storage' }]]);
  return { questions, meta, services };
}

function attempt(id: string, opts: { setId?: number; mode?: Mode; status?: Attempt['status']; at?: number; answers: Record<number, string[]> }): Attempt {
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
    guideOpened: [],
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

describe('createSearchTool', () => {
  it('tool đánh dấu đã xem hướng dẫn ở lượt Thi thử chưa nộp, không sửa lượt đã nộp', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    store.save(attempt('open', { status: 'in-progress', answers: { 5: ['A'] } }));
    store.save(attempt('done', { answers: { 5: ['B'] } }));
    const tool = createSearchTool(store, bank(), CTX);
    expect(tool.name).toBe(SEARCH_TOOL);
    const out = (await tool.run({ query: 'multipart' })) as { results: unknown[] };
    expect(out.results).toHaveLength(1);
    expect(store.get('open')!.guideOpened).toEqual([5]);
    expect(store.get('done')!.guideOpened).toEqual([]);
  });

  it('args không phải chuỗi thì coi như rỗng', async () => {
    const store = createStore(memoryStorage(), { now: () => 500 });
    store.save(attempt('a1', { answers: { 5: ['B'] } }));
    expect(await createSearchTool(store, bank(), CTX).run({ query: 5 })).toEqual({ results: [] });
  });
});
