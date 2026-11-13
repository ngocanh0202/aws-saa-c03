import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { createStore } from '../storage/storage';
import { createSyncController } from '../sync/controller';
import { fakeAuth, fakeRemote } from '../test/fake-sync';
import { memoryStorage } from '../test/fixtures';
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

describe('Layout — cỡ chữ trên điện thoại', () => {
  const phone = () => vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(max-width: 639px)', addEventListener() {}, removeEventListener() {} }));
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty('--font-scale');
    localStorage.clear();
  });

  it('máy tính: không có mục Cỡ chữ', () => {
    renderApp('/', makeDeps());
    expect(screen.queryByRole('group', { name: 'Cỡ chữ' })).toBeNull();
  });

  it('điện thoại, chưa đăng nhập: mục Cỡ chữ nằm trong menu ☰; A+ tăng, lưu và áp dụng', () => {
    phone();
    renderApp('/', makeDeps());
    const panel = document.getElementById('topbar-panel')!;
    const group = within(panel).getByRole('group', { name: 'Cỡ chữ' });
    expect(group).toHaveTextContent('100%');
    fireEvent.click(within(group).getByRole('button', { name: 'Tăng cỡ chữ' }));
    expect(group).toHaveTextContent('110%');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.1');
    expect(localStorage.getItem('saa-c03:font-scale:v1')).toBe('1.1');
    fireEvent.click(within(group).getByRole('button', { name: 'Giảm cỡ chữ' }));
    fireEvent.click(within(group).getByRole('button', { name: 'Giảm cỡ chữ' }));
    expect(group).toHaveTextContent('90%');
  });

  it('điện thoại, đã đăng nhập: mục Cỡ chữ nằm trong menu profile, không ở menu ☰', () => {
    phone();
    const store = createStore(memoryStorage(), { now: () => 500 });
    const auth = fakeAuth();
    const remote = fakeRemote();
    const sync = createSyncController({ store, auth, remote });
    renderApp('/', makeDeps({ store, sync }));
    act(() => auth.emit({ uid: 'u1', name: 'An' }));
    act(() => remote.emit('u1', new Map()));
    const account = document.querySelector('.account__panel') as HTMLElement;
    expect(within(account).getByRole('group', { name: 'Cỡ chữ' })).toBeInTheDocument();
    expect(within(document.getElementById('topbar-panel')!).queryByRole('group', { name: 'Cỡ chữ' })).toBeNull();
  });

  it('mở trang thì áp dụng cỡ chữ đã lưu', () => {
    localStorage.setItem('saa-c03:font-scale:v1', '1.2');
    renderApp('/', makeDeps());
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.2');
  });
});
