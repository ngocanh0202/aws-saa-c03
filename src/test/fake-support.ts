import { lastText, type ErrorReport, type SupportMessage, type SupportThread } from '../support/model';
import type { SupportStore } from '../support/types';

type Msg = { from: 'user' | 'admin'; text: string; error?: ErrorReport };

export interface FakeSupport extends SupportStore {
  /** Tin theo uid (thay support/{uid}/messages). */
  threads: Map<string, SupportMessage[]>;
  /** Bản ghi theo uid (thay supportIndex/{uid}). */
  index: Map<string, SupportThread>;
  /** Đặt thì lần send kế tiếp ném lỗi này và không ghi gì. */
  sendError?: Error;
  sent: { uid: string; msg: Msg }[];
}

/** Store hỗ trợ trong bộ nhớ; listener được gọi đồng bộ. */
export function fakeSupport(): FakeSupport {
  let clock = 0;
  let nextId = 0;
  const threadLs = new Map<string, Set<(m: SupportMessage[]) => void>>();
  const ownLs = new Map<string, Set<(t: SupportThread | null) => void>>();
  const inboxLs = new Set<(t: SupportThread[]) => void>();

  const inbox = () => [...s.index.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const own = (uid: string) => {
    const t = s.index.get(uid);
    return t ? { ...t } : null;
  };
  const notify = (uid: string) => {
    for (const l of threadLs.get(uid) ?? []) l([...(s.threads.get(uid) ?? [])]);
    for (const l of ownLs.get(uid) ?? []) l(own(uid));
    for (const l of inboxLs) l(inbox());
  };
  const add = <T>(map: Map<string, Set<T>>, uid: string, l: T) => {
    const set = map.get(uid) ?? new Set<T>();
    map.set(uid, set);
    set.add(l);
    return () => void set.delete(l);
  };

  const s: FakeSupport = {
    threads: new Map(),
    index: new Map(),
    sent: [],
    listenThread(uid, cb) {
      cb([...(s.threads.get(uid) ?? [])]);
      return add(threadLs, uid, cb);
    },
    listenOwnIndex(uid, cb) {
      cb(own(uid));
      return add(ownLs, uid, cb);
    },
    listenInbox(cb) {
      cb(inbox());
      inboxLs.add(cb);
      return () => void inboxLs.delete(cb);
    },
    async send(uid, msg, who) {
      if (s.sendError) {
        const e = s.sendError;
        s.sendError = undefined;
        throw e;
      }
      const at = ++clock;
      const message: SupportMessage = { id: `m${++nextId}`, at, from: msg.from, text: msg.text, ...(msg.error ? { error: msg.error } : {}) };
      s.threads.set(uid, [...(s.threads.get(uid) ?? []), message]);
      const old = s.index.get(uid);
      const base = { updatedAt: at, last: lastText(msg.text, msg.error), lastFrom: msg.from };
      const thread: SupportThread =
        msg.from === 'user'
          ? { uid, unreadByUser: old?.unreadByUser ?? false, ...base, name: who.name, ...(who.email ? { email: who.email } : {}), unreadByAdmin: true }
          : { uid, name: old?.name ?? '', ...(old?.email ? { email: old.email } : {}), unreadByAdmin: old?.unreadByAdmin ?? false, ...base, unreadByUser: true };
      s.index.set(uid, thread);
      s.sent.push({ uid, msg });
      notify(uid);
    },
    async markRead(uid, reader) {
      const t = s.index.get(uid);
      if (!t) return;
      s.index.set(uid, { ...t, [reader === 'user' ? 'unreadByUser' : 'unreadByAdmin']: false });
      notify(uid);
    },
  };
  return s;
}
