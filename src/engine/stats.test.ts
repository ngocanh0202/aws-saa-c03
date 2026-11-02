import { setStats, type AttemptSummary } from './stats';

function s(id: string, setId: number, mode: 'real' | 'practice', at: number, score: number, d1: number): AttemptSummary {
  return { attemptId: id, setId, mode, submittedAt: at, score, passed: score >= 720, correct: 0, total: 65, byDomain: { 1: d1, 2: 50, 3: 60, 4: 70 } };
}

describe('setStats', () => {
  const all = [s('a', 1, 'real', 1, 700, 60), s('b', 1, 'real', 3, 800, 80), s('c', 1, 'practice', 2, 900, 90), s('d', 2, 'real', 4, 500, 40)];

  it('lọc theo đề và chế độ, sắp mới nhất trước', () => {
    const r = setStats(all, 1, 'real');
    expect(r.attempts.map((x) => x.attemptId)).toEqual(['b', 'a']);
    expect(r.latest?.attemptId).toBe('b');
    expect(r.best).toBe(800);
    expect(r.average).toEqual({ score: 750, byDomain: { 1: 70, 2: 50, 3: 60, 4: 70 } });
  });

  it('không lọc chế độ thì gộp cả hai', () => {
    expect(setStats(all, 1).attempts).toHaveLength(3);
  });

  it('đề chưa có lượt nào', () => {
    expect(setStats(all, 5, 'real')).toEqual({ attempts: [], latest: null, best: null, average: null });
  });
});
