import { act, fireEvent, screen } from '@testing-library/react';
import { submitAttempt } from '../engine/actions';
import { createAttempt, type Mode } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

function setup(mode: Mode, patch: Record<string, unknown> = {}) {
  const deps = makeDeps();
  const attempt = {
    ...createAttempt({ id: 'e1', setId: 1, mode, esl: true, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }),
    ...patch,
  };
  deps.store.save(attempt);
  return { deps, attempt };
}

describe('ExamPage — Thi thật', () => {
  it('giao diện tiếng Anh, có đồng hồ, không có hướng dẫn', () => {
    const { deps } = setup('real');
    renderApp('/exam/e1', deps);
    expect(screen.getByText('Question 1 of 65')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('Time remaining: 2:40:00');
    expect(screen.queryByRole('button', { name: 'Xem hướng dẫn' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hướng dẫn')).not.toBeInTheDocument();
  });

  it('chọn đáp án được lưu; render lại (tải lại trang) vẫn còn', () => {
    const { deps, attempt } = setup('real');
    const first = renderApp('/exam/e1', deps);
    fireEvent.click(first.container.querySelectorAll('.opt')[0]);
    const qid = attempt.questions[0].qid;
    expect(deps.store.get('e1')!.answers[qid]).toHaveLength(1);
    first.unmount();
    const second = renderApp('/exam/e1', deps);
    expect(second.container.querySelectorAll('.opt')[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('End exam → xác nhận → chuyển sang trang kết quả', () => {
    const { deps } = setup('real');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: 'End exam' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('65 unanswered, 0 flagged.');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, end exam' }));
    expect(deps.store.get('e1')!.status).toBe('submitted');
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
  });

  it('hết giờ thì tự nộp', () => {
    const { deps } = setup('real', { endsAt: 1_000_000 - 1 });
    renderApp('/exam/e1', deps);
    expect(deps.store.get('e1')!.status).toBe('submitted');
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
  });

  it('chuyển câu bằng lưới và đánh dấu xem lại', () => {
    const { deps, attempt } = setup('real');
    renderApp('/exam/e1', deps);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByText('Question 5 of 65')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Flag for review' }));
    expect(deps.store.get('e1')!.flagged).toEqual([attempt.questions[4].qid]);
  });
});

describe('ExamPage — đồng bộ từ máy khác', () => {
  it('đáp án đổi từ máy khác hiện ngay', () => {
    const { deps, attempt } = setup('real');
    const { container } = renderApp('/exam/e1', deps);
    const qid = attempt.questions[0].qid;
    const key = attempt.questions[0].optionOrder[0];
    expect(container.querySelectorAll('.opt')[0]).toHaveAttribute('aria-checked', 'false');
    act(() => deps.store.put({ attempt: { ...attempt, answers: { [qid]: [key] } }, meta: { updatedAt: 2 } }));
    expect(container.querySelectorAll('.opt')[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('lượt thi bị nộp ở máy khác thì chuyển sang kết quả', () => {
    const { deps, attempt } = setup('real');
    renderApp('/exam/e1', deps);
    act(() => deps.store.put({ attempt: submitAttempt(attempt, deps.now()), meta: { updatedAt: 2 } }));
    expect(screen.getByTestId('result-page')).toBeInTheDocument();
  });
});

describe('ExamPage — Thi thử', () => {
  it('không có đồng hồ; mở hướng dẫn ngay tại câu và ghi nhận', () => {
    const { deps, attempt } = setup('practice');
    renderApp('/exam/e1', deps);
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByText('Câu 1/65')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }));
    expect(screen.getByLabelText('Hướng dẫn')).toBeInTheDocument();
    expect(deps.store.get('e1')!.guideOpened).toEqual([attempt.questions[0].qid]);
  });

  it('đề bài và lựa chọn vẫn bằng tiếng Anh', () => {
    const { deps, attempt } = setup('practice');
    renderApp('/exam/e1', deps);
    expect(screen.getByText(`Prompt ${attempt.questions[0].qid}?`)).toBeInTheDocument();
  });
});

describe('ExamPage — lỗi', () => {
  it('không tìm thấy lượt thi', () => {
    renderApp('/exam/khong-co', makeDeps());
    expect(screen.getByText(/Không tìm thấy lượt thi/)).toBeInTheDocument();
  });
});
