import { fireEvent, screen } from '@testing-library/react';
import { makeDeps, renderApp } from '../test/fixtures';

describe('Layout — header', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('nút ☰ mở/đóng panel chứa các link; chuyển trang thì tự đóng', () => {
    renderApp('/', makeDeps());
    const toggle = screen.getByRole('button', { name: 'Mở menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Đóng menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.topbar')).toHaveClass('is-open');
    fireEvent.click(screen.getByRole('link', { name: 'Service' }));
    expect(document.querySelector('.topbar')).not.toHaveClass('is-open');
  });

  it('nút đổi giao diện gắn data-theme và lưu lựa chọn', () => {
    renderApp('/', makeDeps());
    const button = screen.getByRole('button', { name: 'Đổi giao diện sáng/tối' });
    const before = document.documentElement.dataset.theme;
    fireEvent.click(button);
    const after = document.documentElement.dataset.theme;
    expect(after).not.toBe(before);
    expect(localStorage.getItem('saa-c03:theme')).toBe(after);
  });
});
