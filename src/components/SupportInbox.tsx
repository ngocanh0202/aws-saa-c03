import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate } from '../app/format';
import type { SupportThread } from '../support/model';
import type { SupportStore } from '../support/types';
import type { SyncController, SyncUser } from '../sync/types';
import { SupportThreadView, useSupportOpen } from './SupportDock';

/** Chữ giao diện; màn hình Thi thật dùng tiếng Anh. */
const TEXT = {
  vi: {
    title: 'Hộp thư hỗ trợ',
    close: 'Đóng',
    empty: 'Chưa có cuộc trò chuyện nào.',
    loadFailed: 'Không tải được danh sách.',
    unread: 'Chưa đọc',
  },
  en: {
    title: 'Support inbox',
    close: 'Close',
    empty: 'No conversations yet.',
    loadFailed: 'Could not load conversations.',
    unread: 'Unread',
  },
};

/** Tên hiển thị; bản ghi có thể thiếu tên (ghi dở) thì dùng email, cuối cùng là uid. */
function displayName(t: SupportThread): string {
  return t.name || t.email || t.uid;
}

interface Props {
  user: SyncUser;
  sync: SyncController;
  support: SupportStore;
  english: boolean;
}

/** Hộp thư của admin: danh sách cuộc trò chuyện (mới nhất trước), bấm một dòng để đọc và trả lời. */
export function SupportInbox({ user, sync, support, english }: Props) {
  const t = english ? TEXT.en : TEXT.vi;
  const [open, close] = useSupportOpen();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Chỉ nghe supportIndex khi khung đang mở.
  useEffect(() => {
    if (!open) return;
    return support.listenInbox(
      (list) => {
        setLoadFailed(false);
        setThreads(list);
      },
      () => setLoadFailed(true),
    );
  }, [open, support]);

  if (!open) return null;
  const current = selected === null ? undefined : threads.find((x) => x.uid === selected);
  return createPortal(
    <div className="gemini-dock gemini" role="dialog" aria-label={t.title} lang={english ? 'en' : 'vi'}>
      {selected !== null ? (
        <SupportThreadView
          key={selected}
          uid={selected}
          reader="admin"
          title={current ? displayName(current) : selected}
          english={english}
          sender={user}
          sync={sync}
          support={support}
          onBack={() => setSelected(null)}
          onClose={close}
        />
      ) : (
        <>
          <header className="service-modal__bar">
            <div className="service-modal__title">
              <h1>{t.title}</h1>
            </div>
            <div className="gemini__tools">
              <button type="button" className="icon-btn" aria-label={t.close} title={t.close} onClick={close}>
                ✕
              </button>
            </div>
          </header>
          <div className="service-modal__body">
            {loadFailed && <p className="gemini__notice">{t.loadFailed}</p>}
            {!loadFailed && threads.length === 0 && <p className="hint support__empty">{t.empty}</p>}
            <ul className="gemini__list">
              {threads.map((x) => (
                <li key={x.uid}>
                  <button type="button" className="gemini__item" onClick={() => setSelected(x.uid)}>
                    <span className="support__who">
                      {x.unreadByAdmin && <span className="support__dot" role="img" aria-label={t.unread} title={t.unread} />}
                      <strong>{displayName(x)}</strong>
                      {x.email && x.email !== displayName(x) && <span className="support__email">{x.email}</span>}
                    </span>
                    {/* Chữ thường (không Markdown) vì do người dùng gõ. */}
                    <small>
                      {x.last} · {formatDate(x.updatedAt)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
