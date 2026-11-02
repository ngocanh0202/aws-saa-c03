import type { Question } from '../data/types';
import type { Attempt } from './attempt';
import { filterReview, optionState } from './review';

describe('optionState', () => {
  it('chưa mở đáp án: chỉ phân biệt đã chọn hay chưa', () => {
    expect(optionState('A', ['A'], ['B'], false)).toBe('selected');
    expect(optionState('B', ['A'], ['B'], false)).toBe('neutral');
  });

  it('đã mở đáp án: xanh, đỏ, viền xanh', () => {
    expect(optionState('A', ['A', 'B'], ['A', 'C'], true)).toBe('correct-chosen');
    expect(optionState('B', ['A', 'B'], ['A', 'C'], true)).toBe('wrong-chosen');
    expect(optionState('C', ['A', 'B'], ['A', 'C'], true)).toBe('missed');
    expect(optionState('D', ['A', 'B'], ['A', 'C'], true)).toBe('neutral');
  });
});

describe('filterReview', () => {
  const questions = new Map<number, Question>(
    [1, 2, 3].map((id) => [id, { id, stem: '', prompt: '', options: [], answer: ['A'], choose: 1, explanationOrig: '' }]),
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
      { qid: 2, domain: 2, optionOrder: [] },
      { qid: 3, domain: 2, optionOrder: [] },
    ],
    answers: { 1: ['A'], 2: ['B'] },
    flagged: [3],
    guideOpened: [1],
    status: 'submitted',
  };
  const ids = (f: Parameters<typeof filterReview>[2]) => filterReview(attempt, questions, f).map((x) => x.aq.qid);

  it('lọc theo từng loại, giữ vị trí trong bài', () => {
    expect(ids('all')).toEqual([1, 2, 3]);
    expect(ids('wrong')).toEqual([2, 3]);
    expect(ids('flagged')).toEqual([3]);
    expect(ids('guide')).toEqual([1]);
    expect(ids('domain-2')).toEqual([2, 3]);
    expect(filterReview(attempt, questions, 'wrong')[0].index).toBe(1);
  });
});
