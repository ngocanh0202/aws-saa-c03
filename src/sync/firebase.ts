import { type FirebaseApp, initializeApp } from 'firebase/app';
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { child, get, getDatabase, onValue, orderByChild, push, query, ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { parseChatJson } from '../ai/chat-json';
import { parseLocalSettings, type LocalSettingsStore } from '../ai/local-settings';
import { summarize, type ChatHistoryStore, type ChatMessage, type ChatSummary } from '../ai/types';
import type { Attempt } from '../engine/attempt';
import { looksLikeAttempt } from '../storage/storage';
import { lastText, type ErrorReport, type SupportMessage, type SupportThread } from '../support/model';
import type { SupportStore } from '../support/types';
import type { FirebaseConfig } from './config';
import type { RemoteSnapshot } from './merge';
import type { QuestionNotes } from '../notes/model';
import type { AuthClient, RemoteAttempts, RemoteNotes, SyncUser } from './types';

/** Duy nhất file này import Firebase SDK. */
export function createFirebaseClients(config: FirebaseConfig): {
  auth: AuthClient;
  remote: RemoteAttempts;
  notes: RemoteNotes;
  chats: ChatHistoryStore;
  localChats: ChatHistoryStore;
  localSettings: LocalSettingsStore;
  support: SupportStore;
  app: FirebaseApp;
} {
  const { recaptchaSiteKey, geminiModel: _model, ...options } = config;
  const app = initializeApp(options);
  if (recaptchaSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  const fbAuth = getAuth(app);
  const db = getDatabase(app);

  let offset = 0;
  let offsetKnown = false;
  const offsetListeners = new Set<() => void>();
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    const v = snap.val();
    // Chỉ coi là "đã biết" khi server thật sự báo một số (null = chưa có handshake).
    if (typeof v !== 'number') return;
    offset = v;
    offsetKnown = true;
    for (const l of [...offsetListeners]) l();
  });

  const auth: AuthClient = {
    onUserChanged(cb) {
      return onAuthStateChanged(fbAuth, (u) => {
        if (!u) return cb(null);
        const user: SyncUser = {
          uid: u.uid,
          name: u.displayName ?? u.email ?? 'Tài khoản',
          photoURL: u.photoURL ?? undefined,
          email: u.email ?? undefined,
          emailVerified: u.emailVerified,
        };
        cb(user);
      });
    },
    async signIn(method) {
      if (method.kind === 'email') {
        // Không bắt xác nhận email: đăng ký xong là đăng nhập luôn.
        await (method.mode === 'sign-up' ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(fbAuth, method.email, method.password);
        return;
      }
      try {
        await signInWithPopup(fbAuth, method.kind === 'facebook' ? new FacebookAuthProvider() : new GoogleAuthProvider());
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        if (code === 'auth/popup-blocked') {
          const e = new Error('Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup cho trang này rồi thử lại.');
          (e as Error & { code?: string }).code = code;
          throw e;
        }
        throw err;
      }
    },
    async signOut() {
      await fbSignOut(fbAuth);
    },
  };

  const remote: RemoteAttempts = {
    listen(uid, cb, onError) {
      return onValue(
        ref(db, `users/${uid}/attempts`),
        (snap) => {
          const out: RemoteSnapshot = new Map();
          snap.forEach((child) => {
            const val = child.val() as { json?: unknown; updatedAt?: unknown } | null;
            if (!val || typeof val.json !== 'string' || typeof val.updatedAt !== 'number') return;
            try {
              const attempt: unknown = JSON.parse(val.json);
              if (looksLikeAttempt(attempt)) out.set((attempt as Attempt).id, { attempt, updatedAt: val.updatedAt });
            } catch {
              /* bản hỏng: bỏ qua */
            }
          });
          cb(out);
        },
        (err) => onError(err),
      );
    },
    write(uid, attempt, updatedAt) {
      return set(ref(db, `users/${uid}/attempts/${attempt.id}`), { json: JSON.stringify(attempt), updatedAt });
    },
    onConnected(cb) {
      return onValue(ref(db, '.info/connected'), (snap) => cb(snap.val() === true));
    },
    serverOffset: () => offset,
    serverOffsetKnown: () => offsetKnown,
    onServerOffset(cb) {
      offsetListeners.add(cb);
      return () => void offsetListeners.delete(cb);
    },
  };

  /** Ghi chú ở users/{uid}/notes/{canonicalQid} dạng { json, updatedAt }. */
  const notes: RemoteNotes = {
    listen(uid, cb, onError) {
      return onValue(
        ref(db, `users/${uid}/notes`),
        (snap) => {
          const out = new Map<number, QuestionNotes>();
          snap.forEach((c) => {
            const val = c.val() as { json?: unknown } | null;
            if (!val || typeof val.json !== 'string') return;
            try {
              const parsed = JSON.parse(val.json) as Partial<QuestionNotes> | null;
              if (parsed && typeof parsed.qid === 'number' && typeof parsed.updatedAt === 'number' && Array.isArray(parsed.highlights)) {
                out.set(parsed.qid, parsed as QuestionNotes);
              }
            } catch {
              /* bản hỏng: bỏ qua */
            }
          });
          cb(out);
        },
        (err) => onError(err),
      );
    },
    write(uid, n) {
      return set(ref(db, `users/${uid}/notes/${n.qid}`), { json: JSON.stringify(n), updatedAt: n.updatedAt });
    },
    remove(uid, qid) {
      return remove(ref(db, `users/${uid}/notes/${qid}`));
    },
  };

  /** Store lịch sử chat ở nhánh `users/{uid}/<branch>` (aiChats cho Gemini, localChats cho AI thử nghiệm). */
  const chatStore = (branch: 'aiChats' | 'localChats'): ChatHistoryStore => {
    const chatRef = (uid: string, attemptId: string, qid: number) => ref(db, `users/${uid}/${branch}/${attemptId}/${qid}`);
    const parseChat = (val: { json?: unknown } | null): ChatMessage[] => parseChatJson(val?.json);
    return {
      async load(uid, attemptId, qid) {
        return parseChat((await get(chatRef(uid, attemptId, qid))).val());
      },
      // Đọc thẳng cả nhánh aiChats (ít dữ liệu); bản hỏng hoặc rỗng thì bỏ.
      async list(uid) {
        const all = ((await get(ref(db, `users/${uid}/${branch}`))).val() ?? {}) as Record<string, Record<string, { json?: unknown; updatedAt?: unknown; title?: unknown }>>;
        const out: ChatSummary[] = [];
        for (const [attemptId, byQid] of Object.entries(all)) {
          for (const [qid, val] of Object.entries(byQid ?? {})) {
            const messages = parseChat(val);
            if (messages.length === 0 || !Number.isFinite(Number(qid))) continue;
            out.push({
              attemptId,
              qid: Number(qid),
              updatedAt: typeof val.updatedAt === 'number' ? val.updatedAt : 0,
              last: summarize(messages),
              ...(typeof val.title === 'string' && val.title ? { title: val.title } : {}),
            });
          }
        }
        return out;
      },
      save(uid, attemptId, qid, messages) {
        // update (không phải set) để giữ tên người học đã đặt.
        return update(chatRef(uid, attemptId, qid), { json: JSON.stringify(messages), updatedAt: Date.now() });
      },
      rename(uid, attemptId, qid, title) {
        return set(child(chatRef(uid, attemptId, qid), 'title'), title);
      },
    };
  };
  const chats = chatStore('aiChats');
  const localChats = chatStore('localChats');

  /** Cài đặt ⚙ của AI thử nghiệm, một bản cho mỗi tài khoản (max_tokens null thì không lưu trường đó). */
  const localSettings: LocalSettingsStore = {
    async load(uid) {
      return parseLocalSettings((await get(ref(db, `users/${uid}/aiSettings`))).val());
    },
    save(uid, settings) {
      return set(ref(db, `users/${uid}/aiSettings`), settings);
    },
  };

  /** Khung hỗ trợ: tin ở support/{uid}/messages, tóm tắt ở supportIndex/{uid}. */
  const support: SupportStore = {
    listenThread(uid, cb, onError) {
      return onValue(
        ref(db, `support/${uid}/messages`),
        (snap) => {
          const out: SupportMessage[] = [];
          snap.forEach((c) => {
            const m = parseMessage(c.key, c.val());
            if (m) out.push(m);
          });
          cb(out.sort((a, b) => a.at - b.at));
        },
        (err) => onError(err),
      );
    },
    listenOwnIndex(uid, cb) {
      return onValue(
        ref(db, `supportIndex/${uid}`),
        (snap) => cb(parseThread(uid, snap.val())),
        () => cb(null),
      );
    },
    listenInbox(cb, onError) {
      return onValue(
        query(ref(db, 'supportIndex'), orderByChild('updatedAt')),
        (snap) => {
          const out: SupportThread[] = [];
          snap.forEach((c) => {
            const t = c.key ? parseThread(c.key, c.val()) : null;
            if (t) out.push(t);
          });
          cb(out.sort((a, b) => b.updatedAt - a.updatedAt));
        },
        (err) => onError(err),
      );
    },
    send(uid, msg, who) {
      const id = push(ref(db, `support/${uid}/messages`)).key!;
      const idx = `supportIndex/${uid}`;
      const paths: Record<string, unknown> = {
        [`support/${uid}/messages/${id}`]: { from: msg.from, text: msg.text, at: serverTimestamp(), ...(msg.error ? { error: msg.error } : {}) },
        [`${idx}/updatedAt`]: serverTimestamp(),
        [`${idx}/last`]: lastText(msg.text, msg.error),
        [`${idx}/lastFrom`]: msg.from,
      };
      // Ghi từng đường dẫn con để không xóa cờ của phía bên kia.
      if (msg.from === 'user') {
        paths[`${idx}/name`] = who.name;
        if (who.email) paths[`${idx}/email`] = who.email;
        paths[`${idx}/unreadByAdmin`] = true;
      } else {
        paths[`${idx}/unreadByUser`] = true;
      }
      return update(ref(db), paths);
    },
    async markRead(uid, reader) {
      const idx = ref(db, `supportIndex/${uid}`);
      // Chưa có bản ghi thì bỏ qua, không tạo bản ghi rỗng.
      if (!(await get(idx)).exists()) return;
      await set(child(idx, reader === 'user' ? 'unreadByUser' : 'unreadByAdmin'), false);
    },
  };

  return { auth, remote, notes, chats, localChats, localSettings, support, app };
}

function parseError(v: unknown): ErrorReport | undefined {
  const e = v as Partial<ErrorReport> | null;
  if (!e || typeof e.message !== 'string' || typeof e.page !== 'string' || typeof e.at !== 'number') return undefined;
  return { message: e.message, page: e.page, at: e.at, ...(typeof e.code === 'string' ? { code: e.code } : {}) };
}

function parseMessage(id: string | null, v: unknown): SupportMessage | null {
  const m = v as { from?: unknown; text?: unknown; at?: unknown; error?: unknown } | null;
  if (!id || !m || (m.from !== 'user' && m.from !== 'admin') || typeof m.text !== 'string' || typeof m.at !== 'number') return null;
  const error = parseError(m.error);
  return { id, from: m.from, text: m.text, at: m.at, ...(error ? { error } : {}) };
}

function parseThread(uid: string, v: unknown): SupportThread | null {
  const t = v as Partial<SupportThread> | null;
  if (!t || typeof t.updatedAt !== 'number' || (t.lastFrom !== 'user' && t.lastFrom !== 'admin')) return null;
  return {
    uid,
    name: typeof t.name === 'string' ? t.name : '',
    ...(typeof t.email === 'string' ? { email: t.email } : {}),
    updatedAt: t.updatedAt,
    last: typeof t.last === 'string' ? t.last : '',
    lastFrom: t.lastFrom,
    unreadByAdmin: t.unreadByAdmin === true,
    unreadByUser: t.unreadByUser === true,
  };
}
