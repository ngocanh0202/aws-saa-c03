import type { Attempt } from './attempt';
import { markGuideOpened, selectOption, submitAttempt, toggleFlag } from './actions';

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a',
    setId: 1,
    mode: 'real',
    seed: 1,
    esl: false,
    startedAt: 0,
    endsAt: 100,
    questions: [{ qid: 7, domain: 1, optionOrder: ['A', 'B', 'C', 'D', 'E'] }],
    answers: {},
    flagged: [],
    guideOpened: [],
    status: 'in-progress',
    ...overrides,
  };
}

describe('selectOption', () => {
  it('câu một đáp án: chọn mới thay cho đáp án cũ', () => {
    const a1 = selectOption(attempt(), 7, 'B', 1);
    expect(a1.answers[7]).toEqual(['B']);
    expect(selectOption(a1, 7, 'C', 1).answers[7]).toEqual(['C']);
  });

  it('câu nhiều đáp án: bật/tắt, không cho chọn quá số lượng', () => {
    let a = selectOption(attempt(), 7, 'A', 2);
    a = selectOption(a, 7, 'C', 2);
    expect(a.answers[7]).toEqual(['A', 'C']);
    expect(selectOption(a, 7, 'E', 2).answers[7]).toEqual(['A', 'C']);
    expect(selectOption(a, 7, 'A', 2).answers[7]).toEqual(['C']);
  });

  it('không đổi được đáp án sau khi đã nộp', () => {
    const done = attempt({ status: 'submitted' });
    expect(selectOption(done, 7, 'A', 1)).toBe(done);
  });
});

describe('toggleFlag / markGuideOpened / submitAttempt', () => {
  it('bật rồi tắt cờ xem lại', () => {
    const a = toggleFlag(attempt(), 7);
    expect(a.flagged).toEqual([7]);
    expect(toggleFlag(a, 7).flagged).toEqual([]);
  });

  it('ghi nhận đã mở hướng dẫn một lần', () => {
    const a = markGuideOpened(markGuideOpened(attempt({ mode: 'practice' }), 7), 7);
    expect(a.guideOpened).toEqual([7]);
  });

  it('nộp bài ghi thời điểm; nộp lần nữa không đổi', () => {
    const a = submitAttempt(attempt(), 50);
    expect(a.status).toBe('submitted');
    expect(a.submittedAt).toBe(50);
    expect(submitAttempt(a, 99)).toBe(a);
  });

  it('Thi thật hết giờ mà nộp muộn: submittedAt chốt ở endsAt, không phải giờ nộp thật', () => {
    const a = submitAttempt(attempt({ endsAt: 100 }), 5000);
    expect(a.submittedAt).toBe(100);
  });

  it('Thi thử không có endsAt: submittedAt = giờ nộp', () => {
    const a = submitAttempt(attempt({ endsAt: undefined, mode: 'practice' }), 5000);
    expect(a.submittedAt).toBe(5000);
  });
});
