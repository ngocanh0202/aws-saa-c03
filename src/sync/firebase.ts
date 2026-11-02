import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { getDatabase, onValue, ref, set } from 'firebase/database';
import type { Attempt } from '../engine/attempt';
import { looksLikeAttempt } from '../storage/storage';
import type { FirebaseConfig } from './config';
import type { RemoteSnapshot } from './merge';
import type { AuthClient, RemoteAttempts, SyncUser } from './types';

/** Duy nhất file này import Firebase SDK. */
export function createFirebaseClients(config: FirebaseConfig): { auth: AuthClient; remote: RemoteAttempts } {
  const app = initializeApp(config);
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

  return { auth, remote };
}
