import { fireEvent, screen, within } from '@testing-library/react';
import { submitAttempt } from '../engine/actions';
import type { Attempt } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

function submitted(deps: ReturnType<typeof makeDeps>, mode: Attempt['mode'], answers: Record<number, string[]>, guideOpened: number[] = []): Attempt {
  const ids = deps.bank.sets.sets[0].questionIds;
  const attempt: Attempt = {
    id: 'r1',
    setId: 1,
    mode,
    seed: 1,
    esl: mode === 'real',
    startedAt: 0,
    endsAt: mode === 'real' ? 160 * 60_000 : undefined,
    questions: ids.map((qid) => ({ qid, domain: deps.bank.meta.get(qid)!.domain, optionOrder: deps.bank.questions.get(qid)!.options.map((o) => o.key) })),
    answers,
    flagged: [3],
    guideOpened,
    status: 'in-progress',
  };
  const done = submitAttempt(attempt, 42 * 60_000);
  deps.store.save(done);
  return done;
}

describe('ResultPage', () => {
  it('hiện điểm, Đậu/Trượt, thời gian và bảng % theo domain', () => {
    const deps = makeDeps();
    const answers = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, i + 1 === 2 ? ['A', 'C'] : ['A']]));
    submitted(deps, 'real', answers);
    renderApp('/result/r1', deps);
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
    expect(screen.getByText(/377/)).toBeInTheDocument(); // round(100 + 900*20/65)
    expect(screen.getByText(/TRƯỢT/)).toBeInTheDocument();
    expect(screen.getByText(/42 phút \/ 160 phút \(ESL \+30\)/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /Secure/ })).toHaveTextContent('20/20');
    expect(within(table).getByRole('row', { name: /Secure/ })).toHaveTextContent('100%');
    expect(within(table).getByRole('row', { name: /Resilient/ })).toHaveTextContent('cần ôn');
  });

  it('xem lại: tô màu xanh/đỏ/viền xanh và mở hướng dẫn cho mọi câu', () => {
    const deps = makeDeps();
    submitted(deps, 'real', { 1: ['B'] });
    renderApp('/result/r1', deps);
    expect(screen.getByText('Option B of 1').closest('button')).toHaveClass('opt--wrong-chosen');
    expect(screen.getByText('Option A of 1').closest('button')).toHaveClass('opt--missed');
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(65);
    expect(screen.getByText('Giải thích tiếng Việt câu 1')).toBeInTheDocument();
  });

  it('lọc câu sai, câu đánh dấu, và theo domain khi bấm dòng trong bảng', () => {
    const deps = makeDeps();
    submitted(deps, 'real', { 1: ['A'] });
    renderApp('/result/r1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Câu sai' }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(64);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu' }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Cost-Optimized/ }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(13);
  });

  it('Thi thử: hiện số câu đúng khi chưa xem hướng dẫn', () => {
    const deps = makeDeps();
    submitted(deps, 'practice', { 1: ['A'], 4: ['A'] }, [4]);
    renderApp('/result/r1', deps);
    expect(screen.getByText('Đúng khi chưa xem hướng dẫn: 1/65')).toBeInTheDocument();
  });

  it('lượt chưa nộp thì chuyển về màn hình làm bài', () => {
    const deps = makeDeps();
    const a = submitted(deps, 'real', {});
    deps.store.save({ ...a, status: 'in-progress', submittedAt: undefined });
    renderApp('/result/r1', deps);
    expect(screen.getByText('Question 1 of 65')).toBeInTheDocument();
  });
});
