import { act, fireEvent, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { submitAttempt } from '../engine/actions';
import type { Attempt } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';
import { REVIEW_VIEW_KEY } from './ResultPage';

// Trang xem lại dựng 65 câu, mỗi câu một bộ tô đề: khi cả bộ test chạy song song có thể quá 5 giây mặc định.
vi.setConfig({ testTimeout: 20_000 });

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

// Kiểu xem chọn trong test được nhớ ở localStorage: xóa để test sau về mặc định (Phân trang).
afterEach(() => localStorage.removeItem(REVIEW_VIEW_KEY));

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
    fireEvent.click(screen.getByRole('button', { name: 'Cả danh sách' }));
    expect(screen.getByText('Option B of 1').closest('button')).toHaveClass('opt--wrong-chosen');
    expect(screen.getByText('Option A of 1').closest('button')).toHaveClass('opt--missed');
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(65);
    expect(screen.getByText('Giải thích tiếng Việt câu 1')).toBeInTheDocument();
  });

  it('lọc câu sai, câu đánh dấu, và theo domain khi bấm dòng trong bảng', () => {
    const deps = makeDeps();
    submitted(deps, 'real', { 1: ['A'] });
    renderApp('/result/r1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'Cả danh sách' }));
    fireEvent.click(screen.getByRole('button', { name: 'Câu sai' }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(64);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu' }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Cost-Optimized/ }));
    expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(13);
  });

  describe('kiểu xem Phân trang', () => {
    it('mỗi trang một câu; lưới số câu tô đúng/sai để nhảy; Câu trước/Câu sau; nhớ lựa chọn', () => {
      const deps = makeDeps();
      submitted(deps, 'real', { 1: ['A'], 2: ['B'] });
      const view = renderApp('/result/r1', deps);
      // Mặc định: Phân trang, nút này đứng trước (bên trái) nút Cả danh sách.
      const views = within(screen.getByRole('group', { name: 'Kiểu xem' })).getAllByRole('button');
      expect(views.map((b) => b.textContent)).toEqual(['Phân trang', 'Cả danh sách']);
      expect(views[0]).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(1);
      expect(screen.getByRole('heading', { name: 'Câu 1' })).toBeInTheDocument();
      const grid = screen.getByRole('navigation', { name: 'Chọn câu' });
      const cells = within(grid).getAllByRole('button');
      expect(cells).toHaveLength(65);
      expect(cells[0]).toHaveClass('is-right');
      expect(cells[0]).toHaveAttribute('aria-current', 'step');
      expect(cells[1]).toHaveClass('is-wrong');
      expect(screen.getByText('Câu 1/65')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '← Câu trước' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Câu sau →' }));
      expect(screen.getByRole('heading', { name: 'Câu 2' })).toBeInTheDocument();
      fireEvent.click(cells[64]);
      expect(screen.getByRole('heading', { name: 'Câu 65' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Câu sau →' })).toBeDisabled();

      // Chọn Cả danh sách thì mở lại trang vẫn nhớ.
      fireEvent.click(screen.getByRole('button', { name: 'Cả danh sách' }));
      expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(65);
      expect(screen.queryByRole('navigation', { name: 'Chọn câu' })).toBeNull();
      view.unmount();
      renderApp('/result/r1', deps);
      expect(screen.getByRole('button', { name: 'Cả danh sách' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByLabelText('Hướng dẫn')).toHaveLength(65);
    });

    it('đổi bộ lọc thì về câu đầu của bộ lọc; lưới chỉ có các câu trong bộ lọc', () => {
      const deps = makeDeps();
      submitted(deps, 'real', { 1: ['A'] });
      renderApp('/result/r1', deps);
      fireEvent.click(screen.getByRole('button', { name: 'Phân trang' }));
      fireEvent.click(screen.getByRole('button', { name: 'Câu sau →' }));
      fireEvent.click(screen.getByRole('button', { name: 'Câu sai' }));
      expect(within(screen.getByRole('navigation', { name: 'Chọn câu' })).getAllByRole('button')).toHaveLength(64);
      expect(screen.getByRole('heading', { name: 'Câu 2' })).toBeInTheDocument();
      expect(screen.getByText('Câu 1/64')).toBeInTheDocument();
    });

    it('"Đến câu …" từ thông báo AI: bỏ lọc và mở đúng trang của câu đó', () => {
      const deps = makeDeps();
      const done = submitted(deps, 'real', { 1: ['A'] });
      renderApp('/result/r1', deps);
      fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu' }));
      act(() => deps.aiGate.requestOpen({ page: 'attempt', attemptId: 'r1', qid: done.questions[9].qid }));
      expect(screen.getByRole('heading', { name: 'Câu 10' })).toBeInTheDocument();
      expect(screen.getByText('Câu 10/65')).toBeInTheDocument();
    });
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
