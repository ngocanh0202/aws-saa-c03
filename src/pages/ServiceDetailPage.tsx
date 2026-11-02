import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { ServiceNoteView } from '../components/ServiceNoteView';

export function ServiceDetailPage() {
  const { id = '' } = useParams();
  const { bank } = useApp();
  const service = bank.services.get(id);
  if (!service) {
    return (
      <main className="page">
        <p>Không có service "{id}".</p>
        <Link to="/services">Danh sách service</Link>
      </main>
    );
  }
  const related = bank.questionsByService.get(id) ?? [];
  const note = bank.serviceNotes.get(id);
  return (
    <main className="page">
      <p>
        <Link to="/services">← Danh sách service</Link>
      </p>
      <h1>{service.name}</h1>
      <p className="hint">{service.category}</p>
      <ServiceNoteView note={note} />
      <h2>Câu hỏi liên quan ({related.length})</h2>
      <ul className="related">
        {related.map((qid) => (
          <li key={qid}>
            <Link to={`/q/${qid}`}>Câu {qid}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
