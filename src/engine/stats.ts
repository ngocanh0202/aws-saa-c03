import { byDomainRecord } from '../data/constants';
import type { Domain, Question } from '../data/types';
import type { Attempt, Mode } from './attempt';
import { scoreAttempt } from './scoring';

export const WEAK_THRESHOLD = 72;

export interface AttemptSummary {
  attemptId: string;
  setId: number;
  mode: Mode;
  submittedAt: number;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  byDomain: Record<Domain, number>;
}

export function summarize(attempt: Attempt, questions: Map<number, Question>): AttemptSummary {
  const r = scoreAttempt(attempt, questions);
  return {
    attemptId: attempt.id,
    setId: attempt.setId,
    mode: attempt.mode,
    submittedAt: attempt.submittedAt ?? attempt.startedAt,
    score: r.score,
    passed: r.passed,
    correct: r.correct,
    total: r.total,
    byDomain: byDomainRecord((d) => r.byDomain[d].pct),
  };
}

export interface SetStats {
  attempts: AttemptSummary[];
  latest: AttemptSummary | null;
  best: number | null;
  average: { score: number; byDomain: Record<Domain, number> } | null;
}

export function setStats(summaries: AttemptSummary[], setId: number, mode?: Mode): SetStats {
  const attempts = summaries
    .filter((s) => s.setId === setId && (!mode || s.mode === mode))
    .sort((a, b) => b.submittedAt - a.submittedAt);
  if (attempts.length === 0) return { attempts, latest: null, best: null, average: null };
  const avg = (pick: (s: AttemptSummary) => number) =>
    Math.round(attempts.reduce((sum, s) => sum + pick(s), 0) / attempts.length);
  return {
    attempts,
    latest: attempts[0],
    best: Math.max(...attempts.map((s) => s.score)),
    average: { score: avg((s) => s.score), byDomain: byDomainRecord((d) => avg((s) => s.byDomain[d])) },
  };
}
