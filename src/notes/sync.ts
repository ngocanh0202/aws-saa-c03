import type { AuthClient, RemoteNotes } from '../sync/types';
import { mergeNotes, type QuestionNotes } from './model';
import type { NotesStore } from './store';

/**
 * Đồng bộ ghi chú theo từng câu, tách khỏi controller lượt thi. Lỗi ghi bị bỏ qua:
 * lần save sau hoặc lần nghe kế tiếp sẽ đẩy lại bản mới hơn.
 */
export function startNotesSync(deps: { notes: NotesStore; auth: AuthClient; remote: RemoteNotes }): () => void {
  const { notes, auth, remote } = deps;
  let uid: string | null = null;
  let unlisten: (() => void) | null = null;

  const push = (u: string, n: QuestionNotes) => {
    remote.write(u, n).catch(() => {});
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
    const adopted = notes.adoptGuest(u);
    notes.setOwner(u);
    for (const n of adopted) push(u, n);
    unlisten = remote.listen(
      u,
      (all) => {
        if (uid !== u) return;
        const local = new Map(notes.all(u).map((x) => [x.qid, x]));
        for (const qid of new Set([...all.keys(), ...local.keys()])) {
          const l = local.get(qid);
          const r = all.get(qid);
          const verdict = mergeNotes(l, r);
          if (verdict === 'remote' && r) notes.applyRemote(u, r);
          else if (verdict === 'local' && l) push(u, l);
        }
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
