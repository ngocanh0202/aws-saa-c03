import { fireEvent, screen, within } from '@testing-library/react';
import { createAttempt } from '../engine/attempt';
import { makeDeps, renderApp } from '../test/fixtures';

function setup() {
  localStorage.clear();
  const deps = makeDeps();
  deps.store.save(createAttempt({ id: 'e1', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }));
  renderApp('/exam/e1', deps);
  return deps;
}

const panel = () => screen.getByRole('complementary', { name: 'Bảng điều khiển bài thi' });

describe('Trang thi — khung bên trái và nút nổi', () => {
  it('khung bên trái chứa nút điều hướng, tiến độ và danh sách câu', () => {
    setup();
    expect(within(panel()).getByRole('button', { name: 'Câu sau' })).toBeInTheDocument();
    expect(within(panel()).getByRole('navigation', { name: 'Danh sách câu' })).toBeInTheDocument();
    expect(within(panel()).getByText('Đã làm 0/65 · đánh dấu 0')).toBeInTheDocument();
  });

  it('bấm nút nổi mở/đóng ngăn kéo; chọn một câu thì tự đóng và nhảy tới câu đó', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Hiện danh sách câu' });
    expect(button).toHaveTextContent('1/65');
    fireEvent.click(button);
    expect(panel()).toHaveClass('is-open');
    fireEvent.click(within(panel()).getByRole('button', { name: '5' }));
    expect(panel()).not.toHaveClass('is-open');
    expect(screen.getByText('Câu 5/65')).toBeInTheDocument();
  });

  it('Esc và bấm ra ngoài đều đóng ngăn kéo', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện danh sách câu' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel()).not.toHaveClass('is-open');
    fireEvent.click(screen.getByRole('button', { name: 'Hiện danh sách câu' }));
    fireEvent.click(document.querySelector('.exam__backdrop')!);
    expect(panel()).not.toHaveClass('is-open');
  });

  it('kéo nút nổi thì di chuyển nút, không mở ngăn kéo', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Hiện danh sách câu' });
    const before = button.style.top;
    fireEvent.pointerDown(button, { clientX: 300, clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(button, { clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.click(button);
    expect(panel()).not.toHaveClass('is-open');
    expect(button.style.top).not.toBe(before);
    expect(localStorage.getItem('saa-c03:exam-fab')).not.toBeNull();
  });
});

describe('Nút nổi luôn nằm trong màn hình', () => {
  it('vị trí lưu từ màn hình lớn được kéo về trong màn hình nhỏ; đổi kích thước thì tính lại', () => {
    localStorage.setItem('saa-c03:exam-fab', JSON.stringify({ x: 1800, y: 1000 }));
    const deps = makeDeps();
    deps.store.save(createAttempt({ id: 'e2', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }));
    Object.assign(window, { innerWidth: 390, innerHeight: 800 });
    renderApp('/exam/e2', deps);
    const button = screen.getByRole('button', { name: 'Hiện danh sách câu' });
    expect(parseFloat(button.style.left)).toBeLessThanOrEqual(390 - 56);
    expect(parseFloat(button.style.top)).toBeLessThanOrEqual(800 - 56);
    Object.assign(window, { innerWidth: 320, innerHeight: 500 });
    fireEvent(window, new Event('resize'));
    expect(parseFloat(button.style.left)).toBeLessThanOrEqual(320 - 56);
    expect(parseFloat(button.style.top)).toBeLessThanOrEqual(500 - 56);
  });
});
