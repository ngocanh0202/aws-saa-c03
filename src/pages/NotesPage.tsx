import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApp } from '../app/context';
import { setLabel } from '../app/format';
import { normalizeSearch } from '../components/GeminiChat';
import { QuestionCard } from '../components/QuestionCard';
import type { Question } from '../data/types';
import { locate, type HighlightPart, type QuestionNotes } from '../notes/model';

/** Văn bản thuần của từng vùng, giống textContent mà QuestionCard dựng ra (Highlighter đo offset trên đó). */
function partText(q: Question, part: HighlightPart): string {
  if (part === 'prompt') return q.prompt;
  if (q.html) {
    const d = document.createElement('div');
    d.innerHTML = q.stem;
    return d.textContent ?? '';
  }
  return q.stem
    .split('\n\n')
    .filter(Boolean)
    .join('');
}

function itemLabel(qid: number): string {
  return qid >= 10000 ? `${setLabel(Math.floor(qid / 100))} · Câu ${qid % 100}` : `Câu ${qid}`;
}

function matches(n: QuestionNotes, needle: string): boolean {
  if (needle === '') return true;
  const hay = [itemLabel(n.qid), ...n.highlights.flatMap((h) => [h.text, h.note])].join('\n');
  return normalizeSearch(hay).includes(needle);
}

export function NotesPage() {
  const { notes: store, bank, aiGate } = useApp();
  // list() trả mảng mới mỗi lần: lấy theo phiên bản (chuỗi JSON) để useSyncExternalStore không lặp vô hạn.
  const json = useSyncExternalStore(store.subscribe, () => JSON.stringify(store.list()));
  const list = JSON.parse(json) as QuestionNotes[];
  const [query, setQuery] = useState('');

  // Mở từ thông báo AI: cuộn tới mục; popup do Highlighter của mục đó tự mở (takeOpen).
  useEffect(() => {
    const t = aiGate.peekOpen();
    if (t?.page === 'notes') document.getElementById(`note-${t.qid}`)?.scrollIntoView?.({ block: 'start' });
  }, [aiGate]);

  const needle = normalizeSearch(query.trim());
  const items = list
    .map((n) => ({ n, q: bank.questions.get(n.qid) }))
    .filter((x): x is { n: QuestionNotes; q: Question } => x.q !== undefined)
    .filter(({ n }) => matches(n, needle));

  return (
    <main className="page notes-page">
      <h1>Ghi chú của tôi</h1>
      {list.length === 0 ? (
        <p>Chưa có ghi chú. Vào Thi thử, bôi đen chữ trong đề để tô.</p>
      ) : (
        <>
          <input
            type="search"
            className="notes-page__search"
            aria-label="Tìm ghi chú"
            placeholder="Tìm trong ghi chú và đoạn đã tô…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {items.length === 0 && <p>Không có ghi chú nào khớp.</p>}
          {items.map(({ n, q }) => {
            const label = itemLabel(n.qid);
            return (
              <article key={n.qid} id={`note-${n.qid}`} className="notes-item">
                <h2 className="notes-item__title">{label}</h2>
                <QuestionCard
                  question={q}
                  order={q.options.map((o) => o.key)}
                  selected={[]}
                  reveal={false}
                  annotate={{ qid: n.qid, label, target: (hl) => ({ page: 'notes', qid: n.qid, highlightId: hl }) }}
                />
                <ul className="notes-item__list">
                  {n.highlights.map((h) => (
                    <li key={h.id}>
                      <blockquote>{h.text}</blockquote>
                      {h.note !== '' && <p className="notes-item__note">{h.note}</p>}
                      {!locate(h, partText(q, h.part)) && <p className="notes-item__missing">Không còn tìm thấy đoạn này trong đề</p>}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </>
      )}
    </main>
  );
}
