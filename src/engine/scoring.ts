import { DOMAINS, byDomainRecord } from '../data/constants';
import type { Domain, Question } from '../data/types';
import type { Attempt } from './attempt';

export const PASS_SCORE = 720;

export function isCorrect(selected: readonly string[] | undefined, answer: readonly string[]): boolean {
  if (!selected || selected.length !== answer.length) return false;
  return answer.every((k) => selected.includes(k));
}

export function scaledScore(correct: number, total: number): number {
  if (total === 0) return 100;
  return Math.round(100 + (900 * correct) / total);
}

export interface DomainScore {
  total: number;
  correct: number;
  pct: number;
}

export interface ScoreResult {
  total: number;
  correct: number;
  score: number;
  passed: boolean;
  byDomain: Record<Domain, DomainScore>;
  correctWithoutGuide: number;
}

export function scoreAttempt(attempt: Attempt, questions: Map<number, Question>): ScoreResult {
  const byDomain = byDomainRecord<DomainScore>(() => ({ total: 0, correct: 0, pct: 0 }));
  let correct = 0;
  let correctWithoutGuide = 0;
  for (const aq of attempt.questions) {
    const q = questions.get(aq.qid);
    if (!q) throw new Error(`Không có câu ${aq.qid}`);
    const slot = byDomain[aq.domain];
    slot.total++;
    if (isCorrect(attempt.answers[aq.qid], q.answer)) {
      correct++;
      slot.correct++;
      if (!attempt.guideOpened.includes(aq.qid)) correctWithoutGuide++;
    }
  }
  for (const d of DOMAINS) {
    const slot = byDomain[d];
    slot.pct = slot.total ? Math.round((100 * slot.correct) / slot.total) : 0;
  }
  const total = attempt.questions.length;
  const score = scaledScore(correct, total);
  return { total, correct, score, passed: score >= PASS_SCORE, byDomain, correctWithoutGuide };
}
