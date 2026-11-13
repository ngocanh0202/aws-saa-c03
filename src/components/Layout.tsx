import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { useFontScale } from '../app/font-scale';
import { useTheme } from '../app/theme';
import { externalHref } from '../pages/ExternalListPage';
import { AccountMenu } from './AccountMenu';
import { AiDoneToast } from './AiDoneToast';
import { ConflictDialog } from './ConflictDialog';
import { FontSizeControl } from './FontSizeControl';
import { signedInUser } from './GeminiChat';
import { SupportDock } from './SupportDock';
import { SyncLoading } from './SyncLoading';

const noSubscribe = () => () => {};
const noState = () => null;

export function Layout() {
  const { store, bank, sync } = useApp();
  const [theme, toggleTheme] = useTheme();
  // Áp dụng cỡ chữ đã lưu ngay khi mở trang (CSS chỉ dùng nó trên điện thoại).
  useFontScale();
  const syncState = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getState ?? noState);
  const signedIn = syncState !== null && signedInUser(syncState) !== null;
  const { pathname } = useLocation();
  useStoreVersion();
  const examId = /^\/exam\/([^/]+)$/.exec(pathname)?.[1];
  const english = examId !== undefined && store.get(examId)?.mode === 'real';
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menu.current?.removeAttribute('open');
  // Điện thoại: link và nút sáng/tối gom vào panel, mở bằng nút ☰; đổi trang thì tự đóng.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);
  return (
    <>
      <header className={`topbar${navOpen ? ' is-open' : ''}`}>
        <Link to="/" className="brand">
          SAA-C03
        </Link>
        <button
          type="button"
          className="icon-btn topbar__toggle"
          aria-expanded={navOpen}
          aria-controls="topbar-panel"
          aria-label={navOpen ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? '✕' : '☰'}
        </button>
        <div id="topbar-panel" className="topbar__panel">
          <nav className="topbar__nav">
            <NavLink to="/" end>
              Đề thi
            </NavLink>
            <NavLink to="/history">Lịch sử</NavLink>
            <NavLink to="/notes">Ghi chú</NavLink>
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
          {/* Đã đăng nhập thì mục Cỡ chữ nằm trong menu profile. */}
          {!signedIn && <FontSizeControl english={english} />}
        </div>
        <AccountMenu english={english} />
      </header>
      {!store.available && (
        <p className="banner" role="status">
          Trình duyệt không cho lưu dữ liệu. Lịch sử thi sẽ mất khi đóng trang.
        </p>
      )}
      <Outlet />
      <ConflictDialog />
      <SyncLoading />
      <SupportDock english={english} />
      <AiDoneToast />
    </>
  );
}
