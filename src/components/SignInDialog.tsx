import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SignInMethod, SyncController } from '../sync/types';

const MIN_PASSWORD = 6;

const TEXT = {
  vi: {
    title: 'Đăng nhập',
    email: 'Email/Mật khẩu',
    emailTitle: { 'sign-in': 'Đăng nhập bằng email', 'sign-up': 'Đăng ký bằng email' },
    emailLabel: 'Email',
    password: 'Mật khẩu',
    confirm: 'Nhập lại mật khẩu',
    submit: { 'sign-in': 'Đăng nhập', 'sign-up': 'Tạo tài khoản' },
    switchTo: { 'sign-in': 'Chưa có tài khoản? Đăng ký', 'sign-up': 'Đã có tài khoản? Đăng nhập' },
    back: '← Cách đăng nhập khác',
    close: 'Đóng',
    badEmail: 'Email không hợp lệ.',
    shortPassword: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`,
    mismatch: 'Mật khẩu nhập lại không khớp.',
    working: 'Đang xử lý…',
    soon: 'sắp có',
  },
  en: {
    title: 'Sign in',
    email: 'Email/Password',
    emailTitle: { 'sign-in': 'Sign in with email', 'sign-up': 'Sign up with email' },
    emailLabel: 'Email',
    password: 'Password',
    confirm: 'Confirm password',
    submit: { 'sign-in': 'Sign in', 'sign-up': 'Create account' },
    switchTo: { 'sign-in': 'No account yet? Sign up', 'sign-up': 'Already have an account? Sign in' },
    back: '← Other sign-in options',
    close: 'Close',
    badEmail: 'Invalid email address.',
    shortPassword: `Password must be at least ${MIN_PASSWORD} characters.`,
    mismatch: 'Passwords do not match.',
    working: 'Working…',
    soon: 'coming soon',
  },
};

/** Icon nút "Đăng nhập" ở thanh trên. */
export function SignInIcon() {
  return (
    <svg className="signin__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg className="signin__icon" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="signin__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg className="signin__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path fill="#fff" d="M13.4 20v-6.2h2.1l.3-2.4h-2.4V9.9c0-.7.2-1.2 1.2-1.2h1.3V6.5c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.8H8.7v2.4h2.1V20h2.6z" />
    </svg>
  );
}

/** Khung popup chung: Esc, ✕ hay bấm ra ngoài thì đóng. */
function Popup({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  // Gắn vào body: nút đăng nhập nằm trong thanh trên (menu thu gọn trên mobile) không được cắt mất popup.
  return createPortal(
    <div
      className="settings-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="settings signin" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="settings__bar">
          <h2 id={`${id}-title`}>{title}</h2>
          <button type="button" className="icon-btn" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Popup chọn cách đăng nhập (Google, Email/Mật khẩu, Facebook). Google/Facebook mở cửa sổ của nhà
 * cung cấp như cũ; Email đóng popup này và mở form riêng. Không bắt xác nhận email.
 */
export function SignInDialog({ sync, english, onClose }: { sync: SyncController; english: boolean; onClose: () => void }) {
  const t = english ? TEXT.en : TEXT.vi;
  const [step, setStep] = useState<'choose' | 'email'>('choose');
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (step === 'choose') firstRef.current?.focus();
  }, [step]);

  const provider = (kind: 'google') => {
    onClose();
    // Gọi ngay trong lúc bấm để trình duyệt không chặn cửa sổ đăng nhập.
    void sync.signIn({ kind });
  };

  if (step === 'email') return <EmailForm sync={sync} english={english} onBack={() => setStep('choose')} onClose={onClose} />;
  return (
    <Popup title={t.title} closeLabel={t.close} onClose={onClose}>
      <div className="signin__choices">
        <button ref={firstRef} type="button" className="signin__choice" onClick={() => provider('google')}>
          <GoogleLogo />
          Google
        </button>
        <button type="button" className="signin__choice" onClick={() => setStep('email')}>
          <MailIcon />
          {t.email}
        </button>
        {/* Facebook tạm tắt (chưa cấu hình xong app Facebook); bật lại: bỏ disabled, gọi provider('facebook'). */}
        <button type="button" className="signin__choice" disabled title={t.soon}>
          <FacebookLogo />
          Facebook <span className="signin__soon">({t.soon})</span>
        </button>
      </div>
    </Popup>
  );
}

function EmailForm({ sync, english, onBack, onClose }: { sync: SyncController; english: boolean; onBack: () => void; onClose: () => void }) {
  const t = english ? TEXT.en : TEXT.vi;
  const id = useId();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => emailRef.current?.focus(), []);

  const check = (): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t.badEmail;
    if (password.length < MIN_PASSWORD) return t.shortPassword;
    if (mode === 'sign-up' && confirm !== password) return t.mismatch;
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = check();
    setError(problem);
    if (problem) return;
    const method: SignInMethod = { kind: 'email', mode, email: email.trim(), password };
    setBusy(true);
    try {
      await sync.signIn(method);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Popup title={t.emailTitle[mode]} closeLabel={t.close} onClose={onClose}>
      <form className="signin__form" onSubmit={submit} noValidate>
        <label htmlFor={`${id}-email`}>{t.emailLabel}</label>
        <input ref={emailRef} id={`${id}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor={`${id}-password`}>{t.password}</label>
        <input
          id={`${id}-password`}
          type="password"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === 'sign-up' && (
          <>
            <label htmlFor={`${id}-confirm`}>{t.confirm}</label>
            <input id={`${id}-confirm`} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </>
        )}
        {error && (
          <p className="settings__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.working : t.submit[mode]}
        </button>
        <div className="signin__links">
          <button
            type="button"
            className="btn-link"
            disabled={busy}
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError(null);
            }}
          >
            {t.switchTo[mode]}
          </button>
          <button type="button" className="btn-link" disabled={busy} onClick={onBack}>
            {t.back}
          </button>
        </div>
      </form>
    </Popup>
  );
}
