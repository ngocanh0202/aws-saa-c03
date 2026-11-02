import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { useClockReady, useStoreVersion } from '../app/use-store';
import { formatDate, modeName } from '../app/format';
import { DOMAINS, DOMAIN_SHORT } from '../data/constants';
import { isCompatible, type Mode } from '../engine/attempt';
import { WEAK_THRESHOLD, setStats, summarize } from '../engine/stats';
import { finalizeExpiredRealAttempts, viewFinalized } from '../storage/finalize';

export function SetStatsPage() {
  const { id } = useParams();
  const setId = Number(id);
  const { bank, store, now } = useApp();
  const [mode, setMode] = useState<Mode>('real');
  const version = useStoreVersion();
  const clockReady = useClockReady();
  useEffect(() => {
    if (clockReady) finalizeExpiredRealAttempts(store, now());
  }, [store, now, version, clockReady]);

  if (!bank.sets.sets.some((s) => s.id === setId)) {
    return (
      <main className="page">
        <p>Không có đề này.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }

  const summaries = viewFinalized(store.list(), now())
    .filter((a) => a.status === 'submitted' && isCompatible(a, bank.questions))
    .map((a) => summarize(a, bank.questions));
  const stats = setStats(summaries, setId, mode);
  const pctCell = (value: number, key: number) => (
    <td key={key} className={value < WEAK_THRESHOLD ? 'is-weak' : undefined}>
      {value}%
    </td>
  );

  return (
    <main className="page">
      <p>
        <Link to="/">← Danh sách đề</Link>
      </p>
      <h1>Thống kê Đề {setId}</h1>
      <div className="filters" role="group" aria-label="Chế độ">
        {(['real', 'practice'] as Mode[]).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {modeName(m)}
          </button>
        ))}
      </div>
      {stats.attempts.length === 0 || !stats.average || !stats.latest ? (
        <p>Chưa có lượt {modeName(mode)} nào cho đề này.</p>
      ) : (
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Điểm</th>
                <th>Kết quả</th>
                {DOMAINS.map((d) => (
                  <th key={d}>{DOMAIN_SHORT[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.attempts.map((s) => (
                <tr key={s.attemptId}>
                  <td>
                    <Link to={`/result/${s.attemptId}`}>{formatDate(s.submittedAt)}</Link>
                  </td>
                  <td>{s.score}</td>
                  <td>{s.passed ? 'Đậu' : 'Trượt'}</td>
                  {DOMAINS.map((d) => pctCell(s.byDomain[d], d))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Trung bình</th>
                <td>{stats.average.score}</td>
                <td>—</td>
                {DOMAINS.map((d) => pctCell(stats.average!.byDomain[d], d))}
              </tr>
              <tr>
                <th>Gần nhất</th>
                <td>{stats.latest.score}</td>
                <td>{stats.latest.passed ? 'Đậu' : 'Trượt'}</td>
                {DOMAINS.map((d) => pctCell(stats.latest!.byDomain[d], d))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </main>
  );
}
