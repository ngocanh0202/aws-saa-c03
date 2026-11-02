import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuidePanel } from '../components/GuidePanel';
import { QuestionCard } from '../components/QuestionCard';
import { mulberry32, shuffle } from '../engine/rng';
import { isCorrect } from '../engine/scoring';
import { externalHref } from './ExternalListPage';

export function ExternalPracticePage() {
  const { slug } = useParams();
  const { bank, newSeed } = useApp();
  const book = bank.externals.find((b) => b.slug === slug);
  const [seed, setSeed] = useState(() => newSeed());
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  if (!book) {
    return (
      <main className="page">
        <p>Không có bộ câu hỏi {slug}.</p>
        <Link to="/external">Về External</Link>
      </main>
    );
  }

  // Câu hỏi giữ đúng thứ tự file gốc, chỉ xáo lựa chọn.
  const ids = book.questions.map((q) => q.id);
  const byId = new Map(book.questions.map((q) => [q.id, q]));
  const question = byId.get(ids[pos])!;
  // File gốc luôn đặt đáp án đúng lên đầu, nên lựa chọn luôn được xáo.
  const order = shuffle(
    question.options.map((o) => o.key),
    mulberry32(seed + question.id),
  );
  const mine = selected[question.id] ?? [];
  const done = checked[question.id] ?? false;
  const checkedIds = ids.filter((id) => checked[id]);
  const correctCount = checkedIds.filter((id) => isCorrect(selected[id], byId.get(id)!.answer)).length;

  function select(key: string) {
    if (done) return;
    const next =
      question.choose === 1
        ? [key]
        : mine.includes(key)
          ? mine.filter((k) => k !== key)
          : mine.length < question.choose
            ? [...mine, key]
            : mine;
    setSelected({ ...selected, [question.id]: next });
  }

  function restart() {
    setSelected({});
    setChecked({});
    setPos(0);
    setSeed(newSeed());
  }

  return (
    <main className="page">
      <p>
        <Link to="/external">← External</Link>
      </p>
      <h1>{book.title}</h1>
      <p className="hint">
        {book.file} ·{' '}
        <a href={externalHref(book.file)} target="_blank" rel="noreferrer">
          Mở file HTML gốc ↗
        </a>
      </p>
      <div className="ext-toolbar">
        <span className="hint">Thứ tự lựa chọn được xáo ngẫu nhiên; bấm "Làm lại" để xáo lại.</span>
        <span className="ext-toolbar__score" role="status">
          Đúng {correctCount}/{checkedIds.length} câu đã kiểm tra
        </span>
        <button type="button" onClick={restart}>
          Làm lại
        </button>
      </div>
      <QuestionCard
        question={question}
        order={order}
        selected={mine}
        reveal={done}
        heading={`Câu ${pos + 1}/${ids.length}`}
        chooseLabel={question.choose > 1 ? `Chọn ${question.choose} đáp án` : undefined}
        onSelect={done ? undefined : select}
      />
      <div className="ext-nav">
        <button type="button" disabled={pos === 0} onClick={() => setPos(pos - 1)}>
          ← Câu trước
        </button>
        {!done && (
          <button
            type="button"
            className="btn-primary"
            disabled={mine.length !== question.choose}
            onClick={() => setChecked({ ...checked, [question.id]: true })}
          >
            Kiểm tra
          </button>
        )}
        <button type="button" disabled={pos === ids.length - 1} onClick={() => setPos(pos + 1)}>
          Câu sau →
        </button>
      </div>
      {done && (
        <>
          <p className={isCorrect(mine, question.answer) ? 'ext-verdict is-right' : 'ext-verdict is-wrong'}>
            {isCorrect(mine, question.answer) ? 'Chính xác!' : 'Chưa đúng.'}
          </p>
          <GuidePanel question={question} order={order} vi={book.vi.get(question.id)} services={bank.services} />
        </>
      )}
      <nav className="navgrid" aria-label="Danh sách câu">
        {ids.map((id, i) => (
          <button
            key={id}
            type="button"
            className={`navgrid__cell${checked[id] ? (isCorrect(selected[id], byId.get(id)!.answer) ? ' is-right' : ' is-wrong') : ''}${i === pos ? ' is-current' : ''}`}
            onClick={() => setPos(i)}
          >
            {i + 1}
          </button>
        ))}
      </nav>
    </main>
  );
}
