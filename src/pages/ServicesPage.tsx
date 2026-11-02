import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { SERVICE_CATEGORIES } from '../data/constants';

export function ServicesPage() {
  const { bank } = useApp();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = [...bank.services.values()].filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.includes(q));
  return (
    <main className="page">
      <h1>Ghi chú AWS service</h1>
      <input type="search" placeholder="Tìm service…" aria-label="Tìm service" value={query} onChange={(e) => setQuery(e.target.value)} />
      {SERVICE_CATEGORIES.map((category) => {
        const items = list.filter((s) => s.category === category).sort((a, b) => a.name.localeCompare(b.name));
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <h2>{category}</h2>
            <ul className="service-list">
              {items.map((s) => (
                <li key={s.id}>
                  <Link to={`/services/${s.id}`}>{s.name}</Link>{' '}
                  <span className="hint">({bank.questionsByService.get(s.id)?.length ?? 0} câu · {bank.serviceNotes.has(s.id) ? 'có ghi chú' : 'đang cập nhật'})</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {list.length === 0 && <p>Không tìm thấy service nào.</p>}
    </main>
  );
}
