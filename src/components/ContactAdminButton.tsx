import { useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { mailtoHref } from '../support/model';
import { errorReportHere, openSupport } from '../support/open';
import { signedInUser } from './GeminiChat';

const noSubscribe = () => () => undefined;
const noState = () => null;

/**
 * Nút "Liên hệ admin" cạnh câu báo lỗi: đã đăng nhập thì mở khung hỗ trợ kèm lỗi,
 * chưa đăng nhập (hoặc không có Firebase) thì là link mailto.
 */
export function ContactAdminButton({ message, code, english }: { message: string; code?: string; english?: boolean }) {
  const { sync, support } = useApp();
  const state = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getState ?? noState);
  const signedIn = state !== null && signedInUser(state) !== null;
  const label = english ? 'Contact admin' : 'Liên hệ admin';
  if (signedIn && support) {
    return (
      <button type="button" className="btn-link" onClick={() => openSupport({ error: errorReportHere({ message, code }) })}>
        {label}
      </button>
    );
  }
  return (
    <a className="btn-link" href={mailtoHref(errorReportHere({ message, code }))}>
      {label}
    </a>
  );
}
