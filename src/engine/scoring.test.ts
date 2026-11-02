import type { Question } from '../data/types';
import type { Attempt } from './attempt';
import { PASS_SCORE, isCorrect, scaledScore, scoreAttempt } from './scoring';

describe('isCorrect', () => {
  it('phải chọn đúng và đủ, không phụ thuộc thứ tự', () => {
    expect(isCorrect(['A'], ['A'])).toBe(true);
    expect(isCorrect(['C', 'A'], ['A', 'C'])).toBe(true);
    expect(isCorrect(['A'], ['A', 'C'])).toBe(false);
    expect(isCorrect(['A', 'B'], ['A', 'C'])).toBe(false);
    expect(isCorrect([], ['A'])).toBe(false);
    expect(isCorrect(undefined, ['A'])).toBe(false);
  });
});

describe('scaledScore', () => {
  it('quy đổi tuyến tính 100–1000 và ngưỡng 720', () => {
    expect(scaledScore(65, 65)).toBe(1000);
    expect(scaledScore(0, 65)).toBe(100);
    expect(scaledScore(45, 65)).toBe(723);
    expect(scaledScore(44, 65)).toBe(709);
    expect(scaledScore(45, 65) >= PASS_SCORE).toBe(true);
    expect(scaledScore(44, 65) >= PASS_SCORE).toBe(false);
  });
});

describe('scoreAttempt', () => {
  const questions = new Map<number, Question>(
    [1, 2, 3, 4].map((id) => [
      id,
      { id, stem: '', prompt: '', options: [], answer: id === 4 ? ['A', 'B'] : ['A'], choose: id === 4 ? 2 : 1, explanationOrig: '' },
    ]),
  );
  const attempt: Attempt = {
    id: 'x',
    setId: 1,
    mode: 'practice',
    seed: 1,
    esl: false,
    startedAt: 0,
    questions: [
      { qid: 1, domain: 1, optionOrder: [] },
      { qid: 2, domain: 1, optionOrder: [] },
      { qid: 3, domain: 2, optionOrder: [] },
      { qid: 4, domain: 4, optionOrder: [] },
    ],
    answers: { 1: ['A'], 2: ['B'], 4: ['B', 'A'] },
    flagged: [],
    guideOpened: [4],
    status: 'submitted',
  };

  it('đếm đúng, tính % theo domain, câu bỏ trống là sai', () => {
    const r = scoreAttempt(attempt, questions);
    expect(r.correct).toBe(2);
    expect(r.total).toBe(4);
    expect(r.byDomain[1]).toEqual({ total: 2, correct: 1, pct: 50 });
    expect(r.byDomain[2]).toEqual({ total: 1, correct: 0, pct: 0 });
    expect(r.byDomain[3]).toEqual({ total: 0, correct: 0, pct: 0 });
    expect(r.byDomain[4]).toEqual({ total: 1, correct: 1, pct: 100 });
    expect(r.score).toBe(550);
    expect(r.passed).toBe(false);
  });

  it('đếm riêng số câu đúng khi chưa xem hướng dẫn', () => {
    expect(scoreAttempt(attempt, questions).correctWithoutGuide).toBe(1);
  });
});
