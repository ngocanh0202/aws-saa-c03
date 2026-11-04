import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { formatDate, modeName, setLabel } from '../app/format';
import { DomainTable } from '../components/DomainTable';
import { GeminiButton } from '../components/GeminiChat';
import { GuidePanel } from '../components/GuidePanel';
import { QuestionCard } from '../components/QuestionCard';
import { DOMAIN_SHORT } from '../data/constants';
import type { Domain } from '../data/types';
import { EXAM_MINUTES, ESL_EXTRA_MINUTES, isCompatible } from '../engine/attempt';
import { filterReview, type ReviewFilter } from '../engine/review';
import { PASS_SCORE, isCorrect, scoreAttempt } from '../engine/scoring';

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'wrong', label: 'Câu sai' },
  { value: 'flagged', label: 'Đánh dấu' },
  { value: 'guide', label: 'Đã xem hướng dẫn' },
];

export function ResultPage() {
  const { id = '' } = useParams();
  const { bank, store } = useApp();
  useStoreVersion();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const attempt = store.get(id);

  if (!attempt || !isCompatible(attempt, bank.questions)) {
    return (
      <main className="page" data-testid="result-page">
        <p>Không tìm thấy kết quả này.</p>
        <Link to="/">Về trang chủ</Link>
      </main>
    );
  }
  if (attempt.status !== 'submitted') return <Navigate to={`/exam/${attempt.id}`} replace />;

  const result = scoreAttempt(attempt, bank.questions);
  const usedMinutes = Math.round(((attempt.submittedAt ?? attempt.startedAt) - attempt.startedAt) / 60_000);
  const limit = EXAM_MINUTES + (attempt.esl ? ESL_EXTRA_MINUTES : 0);
  const items = filterReview(attempt, bank.questions, filter);
  const domainFilter = filter.startsWith('domain-') ? (Number(filter.slice(7)) as Domain) : null;

  return (
    <main className="page result" data-testid="result-page">
      <p>
        <Link to="/">← Danh sách đề</Link> · <Link to={`/set/${attempt.setId}`}>Thống kê {setLabel(attempt.setId)}</Link>
      </p>
      <h1>
        Kết quả {setLabel(attempt.setId)} ({modeName(attempt.mode)})
      </h1>
      <p className={`score ${result.passed ? 'score--pass' : 'score--fail'}`}>
        <strong>{result.score}</strong>/1000 · {result.passed ? 'ĐẬU' : 'TRƯỢT'} (cần ≥ {PASS_SCORE})
      </p>
      <p>
        Đúng {result.correct}/{result.total} câu · Thời gian làm bài: {usedMinutes} phút
        {attempt.mode === 'real' && ` / ${limit} phút${attempt.esl ? ' (ESL +30)' : ''}`} · Nộp lúc {formatDate(attempt.submittedAt!)}
      </p>
      {attempt.mode === 'practice' && (
        <p>
          Đúng khi chưa xem hướng dẫn: {result.correctWithoutGuide}/{result.total}
        </p>
      )}

      <h2>Theo domain</h2>
      <DomainTable byDomain={result.byDomain} correct={result.correct} total={result.total} onSelect={(d) => setFilter(`domain-${d}` as ReviewFilter)} />

      <h2>Xem lại bài làm</h2>
      <div className="filters" role="group" aria-label="Lọc câu hỏi">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
        {domainFilter && (
          <button type="button" aria-pressed="true" onClick={() => setFilter('all')}>
            Domain: {DOMAIN_SHORT[domainFilter]} ✕
          </button>
        )}
      </div>
      {items.length === 0 && <p>Không có câu nào trong bộ lọc này.</p>}
      {items.map(({ aq, index }) => {
        const question = bank.questions.get(aq.qid)!;
        const selected = attempt.answers[aq.qid] ?? [];
        const correct = isCorrect(selected, question.answer);
        return (
          <article key={aq.qid} className="review-item">
            <div className="review-item__tags">
              <span className={`tag ${correct ? 'tag--ok' : 'tag--bad'}`}>{correct ? 'Đúng' : 'Sai'}</span>
              {selected.length === 0 && <span className="tag">Chưa trả lời</span>}
              {attempt.flagged.includes(aq.qid) && <span className="tag">Đánh dấu</span>}
              {attempt.guideOpened.includes(aq.qid) && <span className="tag">Đã xem hướng dẫn</span>}
              <span className="tag">{DOMAIN_SHORT[aq.domain]}</span>
            </div>
            <QuestionCard heading={`Câu ${index + 1}`} question={question} order={aq.optionOrder} selected={selected} reveal showOrigLabels={!bank.vi.has(aq.qid) && !question.html} />
            {/* Nút hỏi AI nằm giữa câu hỏi và hướng dẫn. Bài đã nộp: hỏi được cả Thi thật, không mở/gắn nhãn hướng dẫn (đã hiện sẵn). */}
            <GeminiButton inline attemptId={attempt.id} number={index + 1} question={question} order={aq.optionOrder} />
            <GuidePanel question={question} order={aq.optionOrder} vi={bank.vi.get(aq.qid)} meta={bank.meta.get(aq.qid)} services={bank.services} />
          </article>
        );
      })}
    </main>
  );
}
