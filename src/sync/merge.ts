import type { Attempt } from '../engine/attempt';
import type { StoreEntry } from '../storage/storage';

export interface RemoteRecord {
  attempt: Attempt;
  updatedAt: number;
}
export type RemoteSnapshot = Map<string, RemoteRecord>;

export interface SyncPlan {
  /** Ghi vào máy (store.put). */
  apply: StoreEntry[];
  /** Ghi lên cloud. */
  push: StoreEntry[];
}

export function sameAttempt(a: Attempt, b: Attempt): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Bản đã nộp là cuối cùng; nếu không thì bản mới hơn thắng; bằng nhau thì remote thắng. */
export function pickWinner(local: { attempt: Attempt; updatedAt: number }, remote: RemoteRecord): 'local' | 'remote' {
  const localDone = local.attempt.status === 'submitted';
  const remoteDone = remote.attempt.status === 'submitted';
  if (localDone !== remoteDone) return localDone ? 'local' : 'remote';
  return local.updatedAt > remote.updatedAt ? 'local' : 'remote';
}

/** Id các lượt của khách (không owner) mà cloud không có hoặc có bản khác. */
export function findGuestConflicts(local: StoreEntry[], remote: RemoteSnapshot): string[] {
  const out: string[] = [];
  for (const { attempt, meta } of local) {
    if (meta.owner !== undefined) continue;
    const r = remote.get(attempt.id);
    if (!r || !sameAttempt(attempt, r.attempt)) out.push(attempt.id);
  }
  return out;
}

export function planSync(local: StoreEntry[], remote: RemoteSnapshot, uid: string): SyncPlan {
  const apply: StoreEntry[] = [];
  const push: StoreEntry[] = [];
  const seen = new Set<string>();

  for (const entry of local) {
    const { attempt, meta } = entry;
    const r = remote.get(attempt.id);
    if (meta.owner === uid) {
      seen.add(attempt.id);
      if (!r) push.push(entry);
      else if (sameAttempt(attempt, r.attempt)) continue;
      else if (pickWinner({ attempt, updatedAt: meta.updatedAt }, r) === 'remote') {
        apply.push({ attempt: r.attempt, meta: { owner: uid, updatedAt: r.updatedAt } });
      } else push.push(entry);
    } else if (meta.owner === undefined && r && sameAttempt(attempt, r.attempt)) {
      // Khách giống hệt bản cloud: nhận lại cho uid.
      seen.add(attempt.id);
      apply.push({ attempt: r.attempt, meta: { owner: uid, updatedAt: r.updatedAt } });
    }
  }

  for (const [id, r] of remote) {
    if (seen.has(id)) continue;
    // Chỉ khi máy không có bản nào của id này (khách khác bản cloud hoặc tài khoản khác thì giữ nguyên).
    if (local.some((e) => e.attempt.id === id)) continue;
    apply.push({ attempt: r.attempt, meta: { owner: uid, updatedAt: r.updatedAt } });
  }
  return { apply, push };
}
