import type { Question } from '../data/types';
import type { Attempt, AttemptQuestion } from './attempt';
import { isCorrect } from './scoring';

export type OptionState = 'neutral' | 'selected' | 'correct-chosen' | 'wrong-chosen' | 'missed';

export function optionState(
  key: string,
  selected: readonly string[],
  answer: readonly string[],
  reveal: boolean,
): OptionState {
  const chosen = selected.includes(key);
  if (!reveal) return chosen ? 'selected' : 'neutral';
  const right = answer.includes(key);
  if (chosen && right) return 'correct-chosen';
  if (chosen) return 'wrong-chosen';
  if (right) return 'missed';
  return 'neutral';
}

export type ReviewFilter = 'all' | 'wrong' | 'flagged' | 'guide' | 'domain-1' | 'domain-2' | 'domain-3' | 'domain-4';

export function filterReview(
  attempt: Attempt,
  questions: Map<number, Question>,
  filter: ReviewFilter,
): { aq: AttemptQuestion; index: number }[] {
  return attempt.questions
    .map((aq, index) => ({ aq, index }))
    .filter(({ aq }) => {
      switch (filter) {
        case 'all':
          return true;
        case 'wrong':
          return !isCorrect(attempt.answers[aq.qid], questions.get(aq.qid)?.answer ?? []);
        case 'flagged':
          return attempt.flagged.includes(aq.qid);
        case 'guide':
          return attempt.guideOpened.includes(aq.qid);
        default:
          return `domain-${aq.domain}` === filter;
      }
    });
}
