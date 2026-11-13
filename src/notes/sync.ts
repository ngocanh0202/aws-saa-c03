import type { AuthClient, RemoteNotes } from '../sync/types';
import { isEmptyNotes, mergeNotes, type QuestionNotes } from './model';
import type { NotesStore } from './store';

/**
 * Đồng bộ ghi chú theo từng câu, tách khỏi controller lượt thi. Lỗi ghi bị bỏ qua:
 * lần save sau hoặc lần nghe kế tiếp sẽ đẩy lại bản mới hơn.
 *
 * Bản ghi rỗng (đã xóa hết đoạn tô và mục) bị xóa hẳn: ở máy (store.save) và node trên cloud. Để máy khác không
 * đẩy bản cũ lên lại, store nhớ các câu đã thấy trên cloud lần trước (cloudKeys): câu từng thấy mà nay không còn
 * trên cloud là đã bị xóa ở nơi khác thì xóa ở máy; câu chưa từng thấy là bản mới thì đẩy lên.
 */
export function startNotesSync(deps: { notes: NotesStore; auth: AuthClient; remote: RemoteNotes }): () => void {
  const { notes, auth, remote } = deps;
  let uid: string | null = null;
  let unlisten: (() => void) | null = null;

  const push = (u: string, n: QuestionNotes) => {
    const seen = notes.cloudKeys(u);
    if (isEmptyNotes(n)) {
      seen.delete(n.qid);
      remote.remove(u, n.qid).catch(() => {});
    } else {
      seen.add(n.qid);
      remote.write(u, n).catch(() => {});
    }
    notes.setCloudKeys(u, seen);
  };

  const endSession = () => {
    unlisten?.();
    unlisten = null;
    uid = null;
  };

  const offAuth = auth.onUserChanged((user) => {
    endSession();
    if (!user) {
      notes.setOwner(null);
      return;
    }
    const u = user.uid;
    uid = u;
    // Bản khách đã nằm trong ngăn uid; không đẩy ngay vì cloud có thể mới hơn.
    // Snapshot đầu tiên của listen sẽ gộp và chỉ đẩy bản thật sự mới hơn.
    notes.adoptGuest(u);
    notes.setOwner(u);
    unlisten = remote.listen(
      u,
      (all) => {
        if (uid !== u) return;
        const local = new Map(notes.all(u).map((x) => [x.qid, x]));
        const seenBefore = notes.cloudKeys(u);
        const seen = new Set<number>();
        const toPush: QuestionNotes[] = [];
        for (const qid of new Set([...all.keys(), ...local.keys()])) {
          const l = local.get(qid);
          const r = all.get(qid);
          if (!r) {
            // Có ở máy, không có trên cloud: từng thấy trên cloud thì nơi khác đã xóa; chưa từng thấy là bản mới.
            if (l && (seenBefore.has(qid) || isEmptyNotes(l))) notes.forget(u, qid);
            else if (l) toPush.push(l);
            continue;
          }
          const verdict = mergeNotes(l, r);
          const winner = verdict === 'local' && l ? l : r;
          if (isEmptyNotes(winner)) {
            // Bản rỗng (cũ, hoặc vừa xóa ở máy): dọn cả cloud lẫn máy.
            remote.remove(u, qid).catch(() => {});
            notes.forget(u, qid);
            continue;
          }
          seen.add(qid);
          if (verdict === 'remote') notes.applyRemote(u, r);
          else if (verdict === 'local' && l) toPush.push(l);
        }
        notes.setCloudKeys(u, seen);
        for (const l of toPush) push(u, l);
      },
      () => {
        // không đọc được cloud: giữ bản trên máy, ghi chú vẫn dùng được
      },
    );
  });

  const offLocal = notes.onLocalChange((u, n) => {
    if (uid === u) push(u, n);
  });

  return () => {
    offAuth();
    offLocal();
    endSession();
  };
}
