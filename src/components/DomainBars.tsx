import { DOMAINS, DOMAIN_SHORT } from '../data/constants';
import type { Domain } from '../data/types';
import { WEAK_THRESHOLD } from '../engine/stats';

export function DomainBars({ byDomain, caption }: { byDomain: Record<Domain, number>; caption: string }) {
  return (
    <figure className="bars">
      <figcaption>{caption}</figcaption>
      {DOMAINS.map((d) => (
        <div key={d} className="bars__row">
          <span className="bars__label">{DOMAIN_SHORT[d]}</span>
          <span className="bars__track">
            <span className={`bars__fill${byDomain[d] < WEAK_THRESHOLD ? ' is-weak' : ''}`} style={{ width: `${byDomain[d]}%` }} />
          </span>
          <span className="bars__value">{byDomain[d]}%</span>
        </div>
      ))}
    </figure>
  );
}
