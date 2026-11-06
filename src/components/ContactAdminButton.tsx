import { useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { isAdmin } from '../support/admin';
import { mailtoHref } from '../support/model';
import { errorReportHere, openSupport } from '../support/open';
import { signedInUser } from './GeminiChat';

const noSubscribe = () => () => undefined;
const noState = () => null;

/**
 * Nút "Liên hệ admin" cạnh câu báo lỗi: người học đã đăng nhập thì mở khung hỗ trợ kèm lỗi;
 * chưa đăng nhập, không có Firebase, hoặc chính là admin (khung của admin là hộp thư, không đính kèm lỗi) thì là link mailto.
 */
export function ContactAdminButton({ message, code, english }: { message: string; code?: string; english?: boolean }) {
  const { sync, support } = useApp();
  const state = useSyncExternalStore(sync?.subscribe ?? noSubscribe, sync?.getState ?? noState);
  const user = state === null ? null : signedInUser(state);
  const label = english ? 'Contact admin' : 'Liên hệ admin';
  if (user && !isAdmin(user) && support) {
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
