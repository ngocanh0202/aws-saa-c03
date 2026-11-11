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

describe('Danh sách câu — câu đã xem hướng dẫn mà bỏ trống', () => {
  function seed(mode: 'practice' | 'real', patch: { answers?: Record<number, string[]>; guideOpened?: number[] }) {
    localStorage.clear();
    const deps = makeDeps();
    const a = createAttempt({ id: 'e1', setId: 1, mode, esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta });
    const q1 = a.questions[0].qid;
    const q2 = a.questions[1].qid;
    const answers = patch.answers ? { [q2]: patch.answers[2] } : {};
    const guideOpened = (patch.guideOpened ?? []).map((n) => (n === 1 ? q1 : q2));
    deps.store.save({ ...a, answers, guideOpened });
    renderApp('/exam/e1', deps);
    // Thi thật dùng nhãn tiếng Anh, nên lấy theo class thay vì theo tên.
    return document.querySelector<HTMLElement>('nav.navgrid')!;
  }

  it('Thi thử: câu đã xem hướng dẫn mà chưa trả lời có màu riêng và tooltip', () => {
    const nav = seed('practice', { guideOpened: [1] });
    const cell = within(nav).getByRole('button', { name: '1' });
    expect(cell).toHaveClass('is-skipped');
    expect(cell).toHaveAttribute('title', 'Đã xem hướng dẫn, bỏ trống');
    expect(within(nav).getByRole('button', { name: '2' })).not.toHaveClass('is-skipped');
  });

  it('Thi thử: câu đã trả lời rồi mới xem hướng dẫn giữ màu "đã trả lời"', () => {
    const nav = seed('practice', { answers: { 2: ['A'] }, guideOpened: [2] });
    const cell = within(nav).getByRole('button', { name: '2' });
    expect(cell).toHaveClass('is-answered');
    expect(cell).not.toHaveClass('is-skipped');
    expect(cell).not.toHaveAttribute('title');
  });

  it('Thi thật: không có trạng thái này', () => {
    const nav = seed('real', { guideOpened: [1] });
    expect(within(nav).getByRole('button', { name: '1' })).not.toHaveClass('is-skipped');
  });
});

describe('Trang thi — khung bên trái và nút nổi', () => {
  it('khung bên trái chứa nút đánh dấu, tiến độ và danh sách câu; Câu trước/Câu sau nằm dưới câu hỏi', () => {
    setup();
    expect(within(panel()).queryByRole('button', { name: 'Câu sau' })).toBeNull();
    expect(within(panel()).queryByRole('button', { name: 'Câu trước' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Câu sau' })).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Đánh dấu xem lại' })).toBeInTheDocument();
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
  it('chưa kéo thì nút nằm ở góc dưới bên trái', () => {
    localStorage.removeItem('saa-c03:exam-fab');
    const deps = makeDeps();
    deps.store.save(createAttempt({ id: 'e3', setId: 1, mode: 'practice', esl: false, seed: 7, now: deps.now(), sets: deps.bank.sets, questions: deps.bank.questions, metas: deps.bank.meta }));
    Object.assign(window, { innerWidth: 390, innerHeight: 800 });
    renderApp('/exam/e3', deps);
    const button = screen.getByRole('button', { name: 'Hiện danh sách câu' });
    expect(parseFloat(button.style.left)).toBe(16);
    expect(parseFloat(button.style.top)).toBe(800 - 56 - 24);
  });

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
