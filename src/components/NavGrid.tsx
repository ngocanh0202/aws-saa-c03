import type { Attempt } from '../engine/attempt';

export function NavGrid({ attempt, current, onJump, label }: { attempt: Attempt; current: number; onJump: (index: number) => void; label: string }) {
  return (
    <nav className="navgrid" aria-label={label}>
      {attempt.questions.map((q, i) => {
        const classes = ['navgrid__cell'];
        if ((attempt.answers[q.qid]?.length ?? 0) > 0) classes.push('is-answered');
        if (attempt.flagged.includes(q.qid)) classes.push('is-flagged');
        if (i === current) classes.push('is-current');
        return (
          <button key={q.qid} type="button" className={classes.join(' ')} aria-current={i === current ? 'step' : undefined} onClick={() => onJump(i)}>
            {i + 1}
          </button>
        );
      })}
    </nav>
  );
}
