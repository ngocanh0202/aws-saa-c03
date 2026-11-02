import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuidePanel } from '../components/GuidePanel';
import { QuestionCard } from '../components/QuestionCard';
import { DOMAIN_NAMES } from '../data/constants';

export function QuestionViewPage() {
  const { id } = useParams();
  const qid = Number(id);
  const { bank } = useApp();
  const question = bank.questions.get(qid);
  if (!question) {
    return (
      <main className="page">
        <p>Không có câu {id}.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }
  const order = question.options.map((o) => o.key);
  const meta = bank.meta.get(qid);
  return (
    <main className="page">
      <h1>Câu {qid}</h1>
      {meta && (
        <p className="hint">
          Domain: {DOMAIN_NAMES[meta.domain]} · Độ khó: {meta.difficulty}/3
        </p>
      )}
      <QuestionCard question={question} order={order} selected={[]} reveal />
      <GuidePanel question={question} order={order} vi={bank.vi.get(qid)} meta={meta} services={bank.services} />
    </main>
  );
}
