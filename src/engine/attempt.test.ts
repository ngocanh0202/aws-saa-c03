import type { Question, QuestionMeta, SetsFile } from '../data/types';
import { DOMAIN_QUOTA } from '../data/constants';
import { mulberry32 } from './rng';
import { createAttempt, displayLabel, examDurationMs, isCompatible, pickQuestionIds, type CreateAttemptInput } from './attempt';

function q(id: number): Question {
  return {
    id,
    stem: '',
    prompt: `Q${id}?`,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key })),
    answer: ['A'],
    choose: 1,
    explanationOrig: '',
  };
}

// 65 câu trong đề (20/17/15/13) + 10 câu dự phòng (3/3/2/2)
function domainOf(id: number): 1 | 2 | 3 | 4 {
  if (id <= 65) return id <= 20 ? 1 : id <= 37 ? 2 : id <= 52 ? 3 : 4;
  return ([1, 1, 1, 2, 2, 2, 3, 3, 4, 4] as const)[id - 66];
}

function input(overrides: Partial<CreateAttemptInput> = {}): CreateAttemptInput {
  const ids = Array.from({ length: 75 }, (_, i) => i + 1);
  const sets: SetsFile = { version: 1, sets: [{ id: 1, questionIds: ids.slice(0, 65) }], reserve: ids.slice(65) };
  return {
    id: 'a1',
    setId: 1,
    mode: 'real',
    esl: true,
    seed: 42,
    now: 1000,
    sets,
    questions: new Map(ids.map((id) => [id, q(id)])),
    metas: new Map(ids.map((id) => [id, { id, domain: domainOf(id), difficulty: 2, services: [] } as QuestionMeta])),
    ...overrides,
  };
}

describe('examDurationMs', () => {
  it('130 phút, 160 phút khi bật ESL', () => {
    expect(examDurationMs(false)).toBe(130 * 60_000);
    expect(examDurationMs(true)).toBe(160 * 60_000);
  });
});

describe('pickQuestionIds', () => {
  const metas = new Map<number, QuestionMeta>([
    [1, { id: 1, domain: 1, difficulty: 1, services: [] }],
    [2, { id: 2, domain: 2, difficulty: 1, services: [] }],
    [3, { id: 3, domain: 1, difficulty: 3, services: [] }],
    [4, { id: 4, domain: 1, difficulty: 1, services: [] }],
  ]);

  it('ưu tiên câu cùng domain và cùng độ khó', () => {
    const out = pickQuestionIds([1, 2], [3, 4], metas, mulberry32(1));
    expect(out).toContain(4);
    expect(out).not.toContain(1);
  });

  it('không có câu cùng domain và cùng độ khó thì giữ nguyên, để đề giữ đúng mức khó', () => {
    const out = pickQuestionIds([1, 2], [3], metas, mulberry32(1));
    expect(out).toEqual([1, 2]);
  });

  it('báo lỗi khi thiếu meta', () => {
    expect(() => pickQuestionIds([99], [], metas, mulberry32(1))).toThrow('Thiếu meta cho câu 99');
  });

  it('R11: bỏ qua ứng viên dự phòng nếu twin của nó đã có trong kết quả ở vị trí khác', () => {
    // set = [1, 2]; reserve = [3, 4]; duplicates: [2, 3] là cặp trùng.
    // Câu 3 cùng domain/difficulty với câu 1 (ứng viên tốt nhất cho vị trí của 1),
    // nhưng 2 đã có mặt trong result ở vị trí khác => phải bỏ qua 3, dùng 4 thay thế.
    const metasR11 = new Map<number, QuestionMeta>([
      [1, { id: 1, domain: 1, difficulty: 1, services: [] }],
      [2, { id: 2, domain: 2, difficulty: 1, services: [] }], // domain khác hẳn để nó không tự bị swap bởi 3/4
      [3, { id: 3, domain: 1, difficulty: 1, services: [] }],
      [4, { id: 4, domain: 1, difficulty: 1, services: [] }],
    ]);
    const duplicates: [number, number][] = [[2, 3]];
    // Chạy nhiều seed để tránh phụ thuộc vào việc vị trí nào được rng chọn hoán đổi trước.
    for (let seed = 1; seed <= 20; seed++) {
      const out = pickQuestionIds([1, 2], [3, 4], metasR11, mulberry32(seed), duplicates);
      const has2 = out.includes(2);
      const has3 = out.includes(3);
      expect(has2 && has3).toBe(false);
    }
  });
});

describe('createAttempt', () => {
  const attempt = createAttempt(input());

  it('giữ đúng quota domain sau khi hoán đổi, không trùng câu', () => {
    const qids = attempt.questions.map((x) => x.qid);
    expect(new Set(qids).size).toBe(65);
    for (const d of [1, 2, 3, 4] as const) {
      expect(attempt.questions.filter((x) => x.domain === d)).toHaveLength(DOMAIN_QUOTA[d]);
    }
  });

  it('có hoán đổi từ 1 đến 10 câu với kho dự phòng', () => {
    const swapped = attempt.questions.filter((x) => x.qid > 65).length;
    expect(swapped).toBeGreaterThanOrEqual(1);
    expect(swapped).toBeLessThanOrEqual(10);
  });

  it('optionOrder là hoán vị các key của câu', () => {
    for (const aq of attempt.questions) expect([...aq.optionOrder].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('tất định theo seed, seed khác cho thứ tự khác', () => {
    expect(createAttempt(input())).toEqual(attempt);
    expect(createAttempt(input({ seed: 43 })).questions.map((x) => x.qid)).not.toEqual(attempt.questions.map((x) => x.qid));
  });

  it('Thi thật có endsAt; Thi thử không có endsAt và esl = false', () => {
    expect(attempt.endsAt).toBe(1000 + 160 * 60_000);
    const practice = createAttempt(input({ mode: 'practice' }));
    expect(practice.endsAt).toBeUndefined();
    expect(practice.esl).toBe(false);
    expect(practice.status).toBe('in-progress');
  });

  it('báo lỗi khi đề không tồn tại', () => {
    expect(() => createAttempt(input({ setId: 9 }))).toThrow('Không có đề 9');
  });
});

describe('displayLabel', () => {
  it('đánh nhãn theo vị trí', () => {
    expect([0, 1, 4].map(displayLabel)).toEqual(['A', 'B', 'E']);
  });
});

describe('isCompatible', () => {
  const attempt = createAttempt(input());
  const questions = input().questions;

  it('đúng khi mọi câu và key còn khớp', () => {
    expect(isCompatible(attempt, questions)).toBe(true);
  });

  it('sai khi câu không còn tồn tại hoặc key lựa chọn đã đổi', () => {
    const missing = new Map(questions);
    missing.delete(attempt.questions[0].qid);
    expect(isCompatible(attempt, missing)).toBe(false);
    const changed = new Map(questions);
    changed.set(attempt.questions[0].qid, { ...q(attempt.questions[0].qid), options: [{ key: 'A', text: 'x' }] });
    expect(isCompatible(attempt, changed)).toBe(false);
  });
});

describe('createAttempt — đề main (cố định)', () => {
  const mainIds = [10101, 10102, 10103, 10104, 10105];
  const mainInput = (overrides: Partial<CreateAttemptInput> = {}) => {
    const base = input();
    const questions = new Map(base.questions);
    const metas = new Map(base.metas);
    for (const id of mainIds) {
      questions.set(id, q(id));
      metas.set(id, { id, domain: 1, difficulty: 2, services: [] });
    }
    return input({
      setId: 101,
      questions,
      metas,
      mainSets: [{ id: 101, file: 'pt1_1.json', title: 'Main 1', questionIds: mainIds }],
      ...overrides,
    });
  };

  it('không xáo câu hỏi: giữ đúng thứ tự file gốc, không thay câu dự phòng', () => {
    const a = createAttempt(mainInput());
    expect(a.questions.map((x) => x.qid)).toEqual(mainIds);
    expect(a.setId).toBe(101);
  });

  it('bật xáo câu hỏi: vẫn đủ đúng các câu đó nhưng đổi thứ tự', () => {
    const orders = [1, 2, 3, 4, 5].map((seed) => createAttempt(mainInput({ seed, shuffleQuestions: true })).questions.map((x) => x.qid));
    for (const o of orders) expect([...o].sort()).toEqual(mainIds);
    expect(orders.some((o) => o.join() !== mainIds.join())).toBe(true);
  });

  it('lựa chọn luôn được xáo, kể cả khi không xáo câu hỏi', () => {
    const orders = [1, 2, 3, 4, 5].map((seed) => createAttempt(mainInput({ seed })).questions.map((x) => x.optionOrder.join('')));
    expect(orders.flat().some((o) => o !== 'ABCD')).toBe(true);
  });
});
