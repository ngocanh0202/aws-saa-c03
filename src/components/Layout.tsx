import { useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { useTheme } from '../app/theme';
import { externalHref } from '../pages/ExternalListPage';
import { AccountMenu } from './AccountMenu';
import { ConflictDialog } from './ConflictDialog';

export function Layout() {
  const { store, bank } = useApp();
  const [theme, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  useStoreVersion();
  const examId = /^\/exam\/([^/]+)$/.exec(pathname)?.[1];
  const english = examId !== undefined && store.get(examId)?.mode === 'real';
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menu.current?.removeAttribute('open');
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          SAA-C03
        </Link>
        <nav className="topbar__nav">
          <NavLink to="/" end>
            Đề thi
          </NavLink>
          <NavLink to="/services">Service</NavLink>
          <details ref={menu} className={`topbar__menu${pathname.startsWith('/external') ? ' is-active' : ''}`}>
            <summary>External ▾</summary>
            <ul className="topbar__menu-list">
              <li>
                <Link to="/external" onClick={closeMenu}>
                  Câu hỏi External (trong web)
                </Link>
              </li>
              {bank.externals.map((book) => (
                <li key={book.slug}>
                  <a href={externalHref(book.file)} target="_blank" rel="noreferrer" onClick={closeMenu}>
                    {book.file} ↗
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </nav>
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label="Đổi giao diện sáng/tối"
          title={theme === 'dark' ? 'Chuyển sang giao diện sáng (giống trang External)' : 'Chuyển sang giao diện tối'}
        >
          {theme === 'dark' ? '☀ Sáng' : '☾ Tối'}
        </button>
        <AccountMenu english={english} />
      </header>
      {!store.available && (
        <p className="banner" role="status">
          Trình duyệt không cho lưu dữ liệu. Lịch sử thi sẽ mất khi đóng trang.
        </p>
      )}
      <Outlet />
      <ConflictDialog />
    </>
  );
}
