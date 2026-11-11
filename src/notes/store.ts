import { mergeNotes, type QuestionNotes } from './model';

export const NOTES_KEY_PREFIX = 'saa-c03:notes:v1:';

export interface NotesStore {
  /** null = khách. */
  setOwner(uid: string | null): void;
  owner(): string | null;
  get(qid: number): QuestionNotes | undefined;
  /** Ngăn hiện tại, updatedAt giảm dần, bỏ bản ghi rỗng. */
  list(): QuestionNotes[];
  /** Ghi ngăn hiện tại, báo người nghe. */
  save(notes: QuestionNotes): void;
  /** Ghi bản từ cloud vào ngăn uid (không báo "cần đẩy"). */
  applyRemote(uid: string, notes: QuestionNotes): void;
  /** Gộp ngăn khách vào ngăn uid theo mergeNotes, xóa ngăn khách; trả về các bản cần đẩy lên. */
  adoptGuest(uid: string): QuestionNotes[];
  /** Kể cả bản rỗng, cho đồng bộ. */
  all(uid: string): QuestionNotes[];
  subscribe(listener: () => void): () => void;
  /** Báo mỗi lần save() ở ngăn có owner (để đồng bộ đẩy lên). */
  onLocalChange(cb: (uid: string, notes: QuestionNotes) => void): () => void;
}

type Bucket = Map<number, QuestionNotes>;

function isNotes(v: unknown): v is QuestionNotes {
  if (typeof v !== 'object' || v === null) return false;
  const n = v as Partial<QuestionNotes>;
  return typeof n.qid === 'number' && typeof n.updatedAt === 'number' && Array.isArray(n.highlights);
}

export function createNotesStore(storage: Storage | null): NotesStore {
  const buckets = new Map<string, Bucket>();
  const listeners = new Set<() => void>();
  const changeListeners = new Set<(uid: string, notes: QuestionNotes) => void>();
  let owner: string | null = null;

  const keyOf = (uid: string | null) => NOTES_KEY_PREFIX + (uid ?? 'guest');

  function bucket(uid: string | null): Bucket {
    const key = keyOf(uid);
    let b = buckets.get(key);
    if (b) return b;
    b = new Map();
    try {
      const raw = storage?.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const v of Object.values(parsed)) if (isNotes(v)) b.set(v.qid, v);
        }
      }
    } catch {
      // storage bị chặn hoặc dữ liệu hỏng: bắt đầu từ ngăn rỗng
    }
    buckets.set(key, b);
    return b;
  }

  function persist(uid: string | null): void {
    const obj: Record<number, QuestionNotes> = {};
    for (const [qid, n] of bucket(uid)) obj[qid] = n;
    try {
      storage?.setItem(keyOf(uid), JSON.stringify(obj));
    } catch {
      // không lưu được: vẫn giữ trong phiên này
    }
  }

  const emit = () => {
    for (const l of [...listeners]) l();
  };

  return {
    setOwner(uid) {
      owner = uid;
      emit();
    },
    owner: () => owner,
    get: (qid) => bucket(owner).get(qid),
    list: () =>
      [...bucket(owner).values()].filter((n) => n.highlights.length > 0).sort((a, b) => b.updatedAt - a.updatedAt),
    save(notes) {
      bucket(owner).set(notes.qid, notes);
      persist(owner);
      emit();
      if (owner !== null) for (const cb of [...changeListeners]) cb(owner, notes);
    },
    applyRemote(uid, notes) {
      bucket(uid).set(notes.qid, notes);
      persist(uid);
      if (uid === owner) emit();
    },
    adoptGuest(uid) {
      const guest = bucket(null);
      const target = bucket(uid);
      const push: QuestionNotes[] = [];
      for (const g of guest.values()) {
        if (mergeNotes(g, target.get(g.qid)) === 'local') {
          target.set(g.qid, g);
          push.push(g);
        }
      }
      guest.clear();
      persist(uid);
      persist(null);
      emit();
      return push;
    },
    all: (uid) => [...bucket(uid).values()],
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onLocalChange(cb) {
      changeListeners.add(cb);
      return () => void changeListeners.delete(cb);
    },
  };
}
