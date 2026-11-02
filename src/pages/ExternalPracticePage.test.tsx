import { fireEvent, screen, within } from '@testing-library/react';
import { makeDeps, renderApp } from '../test/fixtures';

function stems(): string[] {
  return within(screen.getByRole('navigation', { name: 'Danh sách câu' }))
    .getAllByRole('button')
    .map((b) => {
      fireEvent.click(b);
      return screen.getByText(/^Ext stem \d$/).textContent ?? '';
    });
}

describe('External', () => {
  it('menu trên header có link tới trang External và tới file HTML gốc', () => {
    renderApp('/', makeDeps());
    expect(screen.getByRole('link', { name: 'quiz.html ↗' })).toHaveAttribute('href', 'external/quiz.html');
    fireEvent.click(screen.getByRole('link', { name: 'Câu hỏi External (trong web)' }));
    expect(screen.getByRole('heading', { name: 'Quiz ngoài' })).toBeInTheDocument();
    expect(screen.getByText(/3 câu · 1\/3 câu có hướng dẫn tiếng Việt/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở file HTML gốc ↗' })).toHaveAttribute('href', 'external/quiz.html');
  });

  it('chọn đáp án, kiểm tra rồi hiện hướng dẫn tiếng Việt', () => {
    renderApp('/external/quiz', makeDeps());
    expect(screen.getByText('Ext stem 1')).toBeInTheDocument();
    const check = screen.getByRole('button', { name: 'Kiểm tra' });
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByText('Option B of 1'));
    fireEvent.click(check);
    expect(screen.getByText('Chưa đúng.')).toBeInTheDocument();
    expect(screen.getByText('Option A of 1').closest('button')).toHaveClass('opt--missed');
    expect(screen.getByText('Giải thích ngoài câu 1')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đúng 0/1 câu đã kiểm tra');
  });

  it('câu chưa có bản dịch hiện giải thích gốc', () => {
    renderApp('/external/quiz', makeDeps());
    fireEvent.click(screen.getByRole('button', { name: 'Câu sau →' }));
    fireEvent.click(screen.getByText('Option A of 2'));
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(screen.getByText('Chính xác!')).toBeInTheDocument();
    expect(screen.getByText('Giải thích gốc 2')).toBeInTheDocument();
  });

  it('giữ thứ tự câu của file gốc, chỉ xáo lựa chọn; Làm lại xáo lựa chọn lần nữa', () => {
    let n = 0;
    renderApp('/external/quiz', makeDeps({ newSeed: () => [7, 1][n++ % 2] }));
    expect(stems()).toEqual(['Ext stem 1', 'Ext stem 2', 'Ext stem 3']);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const optionTexts = () => screen.getAllByText(/^Option [A-D] of 1$/).map((el) => el.textContent);
    const before = optionTexts();
    expect([...before].sort()).toEqual(['Option A of 1', 'Option B of 1', 'Option C of 1', 'Option D of 1']);
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }));
    expect(stems()).toEqual(['Ext stem 1', 'Ext stem 2', 'Ext stem 3']);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(optionTexts()).not.toEqual(before);
  });

  it('bộ không tồn tại', () => {
    renderApp('/external/khong-co', makeDeps());
    expect(screen.getByText('Không có bộ câu hỏi khong-co.')).toBeInTheDocument();
  });
});
