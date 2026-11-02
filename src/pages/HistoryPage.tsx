import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { formatDate, modeName, setLabel } from '../app/format';
import { useClockReady, useStoreVersion } from '../app/use-store';
import { isCompatible } from '../engine/attempt';
import { summarize } from '../engine/stats';
import { finalizeExpiredRealAttempts, viewFinalized } from '../storage/finalize';

type Book = 'main' | 'sub';

const TABS: { value: Book; label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'sub', label: 'Sub' },
];

/** Đề main có id 101…112, đề sub có id 1…7 (xem setLabel). */
function bookOf(setId: number): Book {
  return setId > 100 ? 'main' : 'sub';
}

export function HistoryPage() {
  const { bank, store, now } = useApp();
  const [params, setParams] = useSearchParams();
  const book: Book = params.get('bo') === 'sub' ? 'sub' : 'main';

  const version = useStoreVersion();
  const clockReady = useClockReady();
  useEffect(() => {
    if (clockReady) finalizeExpiredRealAttempts(store, now());
  }, [store, now, version, clockReady]);

  const usable = viewFinalized(store.list(), now()).filter((a) => isCompatible(a, bank.questions) && bookOf(a.setId) === book);
  const inProgress = usable.filter((a) => a.status === 'in-progress').sort((a, b) => b.startedAt - a.startedAt);
  const submitted = usable
    .filter((a) => a.status === 'submitted')
    .map((a) => summarize(a, bank.questions))
    .sort((a, b) => b.submittedAt - a.submittedAt);

  return (
    <main className="page">
      <h1>Lịch sử thi</h1>
      <div className="filters" role="group" aria-label="Bộ đề">
        {TABS.map((t) => (
          <button key={t.value} type="button" aria-pressed={book === t.value} onClick={() => setParams({ bo: t.value }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      {inProgress.length > 0 && (
        <section>
          <h2>Đang làm dở</h2>
          <ul className="plain-list">
            {inProgress.map((a) => (
              <li key={a.id}>
                <Link to={`/exam/${a.id}`}>
                  {setLabel(a.setId)} · {modeName(a.mode)} · bắt đầu {formatDate(a.startedAt)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Đã nộp ({submitted.length})</h2>
        {submitted.length === 0 ? (
          <p>Chưa có lượt thi {book === 'main' ? 'Main' : 'Sub'} nào.</p>
        ) : (
          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr>
                  <th>Đề</th>
                  <th>Hình thức</th>
                  <th>Điểm</th>
                  <th>Đúng</th>
                  <th>Kết quả</th>
                  <th>Nộp lúc</th>
                </tr>
              </thead>
              <tbody>
                {submitted.map((s) => (
                  <tr key={s.attemptId}>
                    <td>
                      <Link to={`/set/${s.setId}`}>{setLabel(s.setId)}</Link>
                    </td>
                    <td>{modeName(s.mode)}</td>
                    <td>
                      <Link to={`/result/${s.attemptId}`}>{s.score}</Link>
                    </td>
                    <td>
                      {s.correct}/{s.total}
                    </td>
                    <td className={s.passed ? 'is-pass' : 'is-fail'}>{s.passed ? 'Đậu' : 'Trượt'}</td>
                    <td>{formatDate(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
