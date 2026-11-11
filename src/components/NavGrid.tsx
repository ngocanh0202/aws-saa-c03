import type { Attempt } from '../engine/attempt';

export function NavGrid({ attempt, current, onJump, label }: { attempt: Attempt; current: number; onJump: (index: number) => void; label: string }) {
  return (
    <nav className="navgrid" aria-label={label}>
      {attempt.questions.map((q, i) => {
        const classes = ['navgrid__cell'];
        const answered = (attempt.answers[q.qid]?.length ?? 0) > 0;
        // Thi thử: đã mở hướng dẫn mà bỏ trống thì câu đã khóa và chắc chắn tính sai.
        const skipped = attempt.mode === 'practice' && !answered && attempt.guideOpened.includes(q.qid);
        if (answered) classes.push('is-answered');
        if (skipped) classes.push('is-skipped');
        if (attempt.flagged.includes(q.qid)) classes.push('is-flagged');
        if (i === current) classes.push('is-current');
        return (
          <button
            key={q.qid}
            type="button"
            className={classes.join(' ')}
            title={skipped ? 'Đã xem hướng dẫn, bỏ trống' : undefined}
            aria-current={i === current ? 'step' : undefined}
            onClick={() => onJump(i)}
          >
            {i + 1}
          </button>
        );
      })}
    </nav>
  );
}
