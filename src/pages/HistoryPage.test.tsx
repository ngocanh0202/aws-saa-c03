import { fireEvent, screen } from '@testing-library/react';
import { submitAttempt } from '../engine/actions';
import { createAttempt } from '../engine/attempt';
import { makeBank, makeDeps, renderApp } from '../test/fixtures';

function setup() {
  const deps = makeDeps({ bank: makeBank({ main: true }) });
  const make = (id: string, setId: number, submit: boolean) => {
    const a = createAttempt({ id, setId, mode: 'practice', esl: false, seed: 1, now: 1000, sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta, mainSets: deps.bank.mainSets });
    deps.store.save(submit ? submitAttempt(a, 2000) : a);
  };
  make('m1', 101, true);
  make('m2', 101, false);
  make('s1', 1, true);
  return deps;
}

describe('HistoryPage', () => {
  it('header có link Lịch sử dẫn tới trang lịch sử', () => {
    renderApp('/', makeDeps());
    fireEvent.click(screen.getByRole('link', { name: 'Lịch sử' }));
    expect(screen.getByRole('heading', { name: 'Lịch sử thi' })).toBeInTheDocument();
  });

  it('mặc định tab Main: chỉ thấy lượt main (đã nộp và đang làm dở)', () => {
    renderApp('/history', setup());
    expect(screen.getByRole('button', { name: 'Main' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Đã nộp (1)' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Main 1' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Đang làm dở' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đề 1' })).not.toBeInTheDocument();
  });

  it('chuyển sang tab Sub thì chỉ thấy lượt của đề sub', () => {
    renderApp('/history', setup());
    fireEvent.click(screen.getByRole('button', { name: 'Sub' }));
    expect(screen.getByRole('link', { name: 'Đề 1' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Main 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Đang làm dở' })).not.toBeInTheDocument();
  });
});
