import { type FirebaseApp, initializeApp } from 'firebase/app';
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { child, get, getDatabase, onValue, ref, set, update } from 'firebase/database';
import { summarize, type ChatHistoryStore, type ChatMessage, type ChatSummary } from '../ai/types';
import type { Attempt } from '../engine/attempt';
import { looksLikeAttempt } from '../storage/storage';
import type { FirebaseConfig } from './config';
import type { RemoteSnapshot } from './merge';
import type { AuthClient, RemoteAttempts, SyncUser } from './types';

/** Duy nhất file này import Firebase SDK. */
export function createFirebaseClients(config: FirebaseConfig): {
  auth: AuthClient;
  remote: RemoteAttempts;
  chats: ChatHistoryStore;
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
          name: u.displayName ?? u.email ?? 'Google',
          photoURL: u.photoURL ?? undefined,
        };
        cb(user);
      });
    },
    async signIn() {
      try {
        await signInWithPopup(fbAuth, new GoogleAuthProvider());
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

  const chatRef = (uid: string, attemptId: string, qid: number) => ref(db, `users/${uid}/aiChats/${attemptId}/${qid}`);
  const parseChat = (val: { json?: unknown } | null): ChatMessage[] => {
    if (!val || typeof val.json !== 'string') return [];
    try {
      const parsed: unknown = JSON.parse(val.json);
      if (!Array.isArray(parsed)) return [];
      const ok = parsed.every(
        (m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string',
      );
      return ok ? (parsed as ChatMessage[]) : [];
    } catch {
      return [];
    }
  };
  const chats: ChatHistoryStore = {
    async load(uid, attemptId, qid) {
      return parseChat((await get(chatRef(uid, attemptId, qid))).val());
    },
    // Đọc thẳng cả nhánh aiChats (ít dữ liệu); bản hỏng hoặc rỗng thì bỏ.
    async list(uid) {
      const all = ((await get(ref(db, `users/${uid}/aiChats`))).val() ?? {}) as Record<string, Record<string, { json?: unknown; updatedAt?: unknown; title?: unknown }>>;
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

  return { auth, remote, chats, app };
}
