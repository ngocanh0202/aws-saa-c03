import { Link } from 'react-router-dom';
import type { ServiceRef } from '../data/types';

export function ServiceChip({ id, service }: { id: string; service?: ServiceRef }) {
  return (
    <Link className="chip" to={`/services/${id}`}>
      {service?.name ?? id}
    </Link>
  );
}
