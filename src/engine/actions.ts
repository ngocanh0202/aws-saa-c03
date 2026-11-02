import type { Attempt } from './attempt';

export function selectOption(attempt: Attempt, qid: number, key: string, choose: number): Attempt {
  if (attempt.status !== 'in-progress') return attempt;
  const current = attempt.answers[qid] ?? [];
  let next: string[];
  if (choose <= 1) next = [key];
  else if (current.includes(key)) next = current.filter((k) => k !== key);
  else if (current.length >= choose) return attempt;
  else next = [...current, key];
  return { ...attempt, answers: { ...attempt.answers, [qid]: next } };
}

export function toggleFlag(attempt: Attempt, qid: number): Attempt {
  const flagged = attempt.flagged.includes(qid)
    ? attempt.flagged.filter((id) => id !== qid)
    : [...attempt.flagged, qid];
  return { ...attempt, flagged };
}

export function markGuideOpened(attempt: Attempt, qid: number): Attempt {
  if (attempt.guideOpened.includes(qid)) return attempt;
  return { ...attempt, guideOpened: [...attempt.guideOpened, qid] };
}

export function submitAttempt(attempt: Attempt, now: number): Attempt {
  if (attempt.status !== 'in-progress') return attempt;
  const submittedAt = attempt.endsAt !== undefined ? Math.min(now, attempt.endsAt) : now;
  return { ...attempt, status: 'submitted', submittedAt };
}
