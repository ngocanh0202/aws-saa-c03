import { fireEvent, screen, within } from '@testing-library/react';
import { MAIN_IDS, makeBank, makeDeps, renderApp } from '../test/fixtures';

function setup() {
  const deps = makeDeps({ bank: makeBank({ main: true }) });
  renderApp('/', deps);
  return deps;
}

const mainSection = () => screen.getByRole('region', { name: 'Main' });
const subSection = () => screen.getByRole('region', { name: 'Sub' });

describe('Trang chủ — đề Main và Sub', () => {
  beforeEach(() => localStorage.clear());

  it('chia hai phần: Main có công tắc xáo câu hỏi, Sub giữ các đề cũ', () => {
    setup();
    expect(within(mainSection()).getByRole('heading', { name: /^Main 1/ })).toBeInTheDocument();
    expect(within(mainSection()).getByRole('checkbox', { name: 'Xáo thứ tự câu hỏi' })).not.toBeChecked();
    expect(within(subSection()).getByRole('heading', { name: 'Đề 1' })).toBeInTheDocument();
    expect(within(subSection()).queryByRole('checkbox', { name: 'Xáo thứ tự câu hỏi' })).not.toBeInTheDocument();
  });

  it('không bật xáo: lượt thi main giữ đúng thứ tự câu trong file', () => {
    const deps = setup();
    fireEvent.click(within(mainSection()).getByRole('button', { name: 'Thi thử' }));
    const [attempt] = deps.store.list();
    expect(attempt.setId).toBe(101);
    expect(attempt.questions.map((q) => q.qid)).toEqual(MAIN_IDS);
  });

  it('bật xáo được nhớ lại sau khi tải lại trang', () => {
    setup();
    fireEvent.click(within(mainSection()).getByRole('checkbox', { name: 'Xáo thứ tự câu hỏi' }));
    expect(localStorage.getItem('saa-c03:main-shuffle')).toBe('1');
  });

  it('câu main hiển thị HTML; sau khi mở hướng dẫn thấy giải thích gốc và ghi chú review', () => {
    setup();
    fireEvent.click(within(mainSection()).getByRole('button', { name: 'Thi thử' }));
    expect(screen.getByText('10101', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Main opt B of 10101')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }));
    const guide = screen.getByLabelText('Hướng dẫn');
    expect(within(guide).getByText(/Ghi chú review: Đáp án đáng ngờ/)).toBeInTheDocument();
    expect(within(guide).getByText('10101', { selector: 'em' })).toBeInTheDocument();
    expect(within(guide).queryByText(/gốc:/)).not.toBeInTheDocument();
  });

  it('đề main trùng (ptX_2) bị ẩn khỏi trang chủ nhưng trang thống kê vẫn mở được', () => {
    const bank = makeBank({ main: true });
    const twin = { id: 102, file: 'pt1_2.json', title: 'Main 2', questionIds: MAIN_IDS };
    const deps = makeDeps({ bank: { ...bank, mainSets: [...bank.mainSets, twin], hiddenMainSets: new Set([102]) } });
    const { unmount } = renderApp('/', deps);
    expect(within(mainSection()).getByRole('heading', { name: /^Main 1/ })).toBeInTheDocument();
    expect(within(mainSection()).queryByRole('heading', { name: /^Main 2/ })).not.toBeInTheDocument();
    expect(within(mainSection()).getByText(/^1 đề cố định/)).toBeInTheDocument();
    unmount();
    renderApp('/set/102', deps);
    expect(screen.getByRole('heading', { name: 'Thống kê Main 2' })).toBeInTheDocument();
  });

  it('trang thống kê và kết quả gọi tên đề là "Main 1"', () => {
    const deps = makeDeps({ bank: makeBank({ main: true }) });
    renderApp('/set/101', deps);
    expect(screen.getByRole('heading', { name: 'Thống kê Main 1' })).toBeInTheDocument();
  });
});
