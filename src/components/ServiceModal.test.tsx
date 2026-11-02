import { fireEvent, screen, within } from '@testing-library/react';
import { createAttempt } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

// Câu 1 trong bank giả gắn service s3; mở hướng dẫn ở Thi thử để thấy chip service.
function openGuideWithChip() {
  const deps = makeDeps();
  const attempt = createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
  const pos = attempt.questions.findIndex((q) => q.qid === 1);
  deps.store.save({ ...attempt, guideOpened: [1] });
  renderApp('/exam/e1', deps);
  fireEvent.click(screen.getByRole('button', { name: String(pos + 1) }));
  return deps;
}

describe('Chip service mở popup toàn màn hình', () => {
  it('bấm chip mở popup ghi chú service, không rời trang thi; nút Đóng được focus', () => {
    openGuideWithChip();
    fireEvent.click(screen.getByRole('button', { name: 'Amazon S3' }));
    const dialog = screen.getByRole('dialog', { name: 'Amazon S3' });
    expect(within(dialog).getByText('Storage')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Đóng' })).toHaveFocus();
    expect(screen.getByRole('complementary', { name: 'Bảng điều khiển bài thi' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('bấm Đóng hoặc Esc thì đóng popup và trả lại cuộn trang', () => {
    openGuideWithChip();
    fireEvent.click(screen.getByRole('button', { name: 'Amazon S3' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Amazon S3' })).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog', { name: 'Amazon S3' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Amazon S3' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Amazon S3' })).not.toBeInTheDocument();
  });
});
