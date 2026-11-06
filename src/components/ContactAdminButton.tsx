import { useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { errorReportHere, openSupport, openSupportAfterSignIn, requestSignIn } from '../support/open';
import { signedInUser } from './GeminiChat';

const noSubscribe = () => () => undefined;
const noState = () => null;

/**
 * Nút "Liên hệ admin" cạnh câu báo lỗi, luôn mở cửa sổ chat (không gửi email): đã đăng nhập thì mở
 * khung hỗ trợ kèm lỗi (admin thì mở hộp thư); chưa đăng nhập thì mở popup đăng nhập, đăng nhập xong
 * khung hỗ trợ tự mở kèm lỗi. Không có Firebase (không đăng nhập được) thì không hiện nút.
 */
export function ContactAdminButton({ message, code, english }: { message: string; code?: string; english?: boolean }) {
  const { sync, support } = useApp();
  const state = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getState ?? noState);
  if (!sync || !support || state === null) return null;
  const user = signedInUser(state);
  const onClick = () => {
    const req = { error: errorReportHere({ message, code }) };
    if (user) return openSupport(req);
    openSupportAfterSignIn(req);
    requestSignIn();
  };
  return (
    <button type="button" className="btn-link" onClick={onClick}>
      {english ? 'Contact admin' : 'Liên hệ admin'}
    </button>
  );
}
