import type { Attempt } from '../engine/attempt';

export const STORAGE_KEY = 'saa-c03:attempts:v1';
export const OWNERS_KEY = 'saa-c03:owners:v1';

export interface RecordMeta {
  owner?: string;
  updatedAt: number;
}
export interface StoreEntry {
  attempt: Attempt;
  meta: RecordMeta;
}

export interface AttemptStore {
  readonly available: boolean;
  /** Đã lọc theo viewer. */
  list(): Attempt[];
  /** Đã lọc theo viewer. */
  get(id: string): Attempt | undefined;
  /** Lưu cục bộ: meta = { owner: viewer ?? owner sẵn có, updatedAt: now() }; gọi onSave và subscribe. */
  save(attempt: Attempt): boolean;
  /** Tăng mỗi khi dữ liệu thấy được có thể đã đổi (dùng cho useSyncExternalStore). */
  version(): number;
  subscribe(listener: () => void): () => void;
  /** Chỉ chạy khi gọi save(), không chạy khi put(). */
  onSave(listener: (entry: StoreEntry) => void): () => void;
  setViewer(uid: string | null): void;
  /** Tất cả bản ghi, KHÔNG lọc theo viewer. */
  entries(): StoreEntry[];
  /** Ghi từ đồng bộ: không gọi onSave, có gọi subscribe. */
  put(entry: StoreEntry): void;
  remove(ids: string[]): void;
}

const VALID_STATUSES = new Set(['in-progress', 'submitted', 'incompatible']);
const VALID_MODES = new Set(['real', 'practice']);

export function looksLikeAttempt(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.setId === 'number' &&
    Array.isArray(v.questions) &&
    typeof v.answers === 'object' &&
    typeof v.status === 'string' &&
    VALID_STATUSES.has(v.status) &&
    typeof v.mode === 'string' &&
    VALID_MODES.has(v.mode) &&
    Array.isArray(v.flagged) &&
    Array.isArray(v.guideOpened)
  );
}

function readJson(storage: Storage | null, key: string): Record<string, unknown> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readAll(storage: Storage | null): Record<string, Attempt> {
  const out: Record<string, Attempt> = {};
  for (const [key, value] of Object.entries(readJson(storage, STORAGE_KEY))) if (looksLikeAttempt(value)) out[key] = value;
  return out;
}

function readMetas(storage: Storage | null): Record<string, RecordMeta> {
  const out: Record<string, RecordMeta> = {};
  for (const [key, value] of Object.entries(readJson(storage, OWNERS_KEY))) {
    if (typeof value !== 'object' || value === null) continue;
    const v = value as Record<string, unknown>;
    if (typeof v.updatedAt !== 'number') continue;
    out[key] = typeof v.owner === 'string' ? { owner: v.owner, updatedAt: v.updatedAt } : { updatedAt: v.updatedAt };
  }
  return out;
}

function without<T>(rec: Record<string, T>, drop: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !drop.has(k)));
}

export function createStore(storage: Storage | null, opts: { now?: () => number; watch?: boolean } = {}): AttemptStore {
  const now = opts.now ?? Date.now;
  // Chỉ chứa bản ghi ghi vào storage THẤT BẠI (hoặc không có storage). Khi ghi được thì đọc
  // storage tươi mỗi lần: tab này không giữ bản sao cũ che mất bản mới tab khác vừa lưu.
  let memory: Record<string, Attempt> = {};
  let memoryMeta: Record<string, RecordMeta> = {};
  let available = storage !== null;
  let viewer: string | null = null;
  let version = 0;
  const listeners = new Set<() => void>();
  const saveListeners = new Set<(entry: StoreEntry) => void>();

  // Đọc storage tươi mỗi lần, phủ `memory` (bản ghi ghi thất bại) lên trên — để thấy được
  // lượt thi mà một store khác (tab khác) vừa lưu vào cùng Storage.
  const current = (): Record<string, Attempt> => (storage ? { ...readAll(storage), ...memory } : memory);
  const currentMeta = (): Record<string, RecordMeta> => (storage ? { ...readMetas(storage), ...memoryMeta } : memoryMeta);
  const metaOf = (a: Attempt, metas: Record<string, RecordMeta>): RecordMeta =>
    metas[a.id] ?? { updatedAt: a.submittedAt ?? a.startedAt };
  const visible = (meta: RecordMeta): boolean => viewer === null || meta.owner === undefined || meta.owner === viewer;

  const notify = () => {
    version += 1;
    for (const l of [...listeners]) l();
  };

  // Ghi cả lượt thi lẫn metadata. Chỉ đổi id đang ghi (cùng các bản ghi thất bại trước đó của
  // chính tab này), không ghi lại bản sao cũ của id khác. Lỗi thì available = false và bản ghi
  // nằm lại trong `memory`.
  const store = (entry: StoreEntry): boolean => {
    memory = { ...memory, [entry.attempt.id]: entry.attempt };
    memoryMeta = { ...memoryMeta, [entry.attempt.id]: entry.meta };
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(storage), ...memory }));
      storage.setItem(OWNERS_KEY, JSON.stringify({ ...readMetas(storage), ...memoryMeta }));
      memory = {};
      memoryMeta = {};
      return true;
    } catch {
      available = false;
      return false;
    }
  };

  // Đồng bộ giữa các tab: tab khác ghi vào cùng localStorage thì báo cho người nghe.
  if (opts.watch && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY || e.key === OWNERS_KEY) notify();
    });
  }

  return {
    get available() {
      return available;
    },
    list: () => {
      const metas = currentMeta();
      return Object.values(current()).filter((a) => visible(metaOf(a, metas)));
    },
    get: (id) => {
      const a = current()[id];
      return a && visible(metaOf(a, currentMeta())) ? a : undefined;
    },
    save(attempt) {
      // Chưa có phiên đồng bộ (viewer = null: đang tải trang, loading, conflict…) thì giữ owner
      // sẵn có: sửa một lượt đã thuộc tài khoản không biến nó thành lượt khách.
      const owner = viewer ?? currentMeta()[attempt.id]?.owner;
      const meta: RecordMeta = owner === undefined ? { updatedAt: now() } : { owner, updatedAt: now() };
      const ok = store({ attempt, meta });
      for (const l of [...saveListeners]) l({ attempt, meta });
      notify();
      return ok;
    },
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onSave(listener) {
      saveListeners.add(listener);
      return () => void saveListeners.delete(listener);
    },
    setViewer(uid) {
      viewer = uid;
      notify();
    },
    entries() {
      const metas = currentMeta();
      return Object.values(current()).map((attempt) => ({ attempt, meta: metaOf(attempt, metas) }));
    },
    put(entry) {
      store(entry);
      notify();
    },
    remove(ids) {
      const drop = new Set(ids);
      memory = without(memory, drop);
      memoryMeta = without(memoryMeta, drop);
      if (storage) {
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(without(readAll(storage), drop)));
          storage.setItem(OWNERS_KEY, JSON.stringify(without(readMetas(storage), drop)));
        } catch {
          available = false;
        }
      }
      notify();
    },
  };
}

export function getBrowserStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__saa_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
