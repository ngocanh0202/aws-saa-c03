import { DOMAINS, DOMAIN_SHORT } from '../data/constants';
import type { Domain } from '../data/types';
import type { DomainScore } from '../engine/scoring';
import { WEAK_THRESHOLD } from '../engine/stats';

interface DomainTableProps {
  byDomain: Record<Domain, DomainScore>;
  correct: number;
  total: number;
  onSelect: (d: Domain) => void;
}

export function DomainTable({ byDomain, correct, total, onSelect }: DomainTableProps) {
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Đúng / Số câu</th>
            <th>% đúng</th>
          </tr>
        </thead>
        <tbody>
          {DOMAINS.map((d) => {
            const s = byDomain[d];
            const weak = s.total > 0 && s.pct < WEAK_THRESHOLD;
            return (
              <tr key={d} className="is-clickable">
                <th scope="row">
                  <button type="button" className="domain-btn" onClick={() => onSelect(d)} aria-label={`${DOMAIN_SHORT[d]}: lọc câu hỏi theo domain này`}>
                    {DOMAIN_SHORT[d]}
                  </button>
                </th>
                <td>
                  {s.correct}/{s.total}
                </td>
                <td className={weak ? 'is-weak' : undefined}>
                  {s.pct}%{weak ? ' · cần ôn' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Tổng</th>
            <td>
              {correct}/{total}
            </td>
            <td>{total ? Math.round((100 * correct) / total) : 0}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
