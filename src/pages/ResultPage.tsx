import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AiJobTarget } from '../ai/gate';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { useStoreVersion } from '../app/use-store';
import { formatDate, modeName, setLabel } from '../app/format';
import { DomainTable } from '../components/DomainTable';
import { GeminiButton } from '../components/GeminiChat';
import { NoteButton } from '../notes/NotePanel';
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

/** "Cả danh sách": mọi câu nối nhau; "Phân trang": mỗi trang một câu, có lưới số câu để nhảy. */
type ReviewView = 'list' | 'paged';
export const REVIEW_VIEW_KEY = 'saa-c03:review-view:v1';
const VIEW_KEY = REVIEW_VIEW_KEY;
const VIEWS: { value: ReviewView; label: string }[] = [
  { value: 'paged', label: 'Phân trang' },
  { value: 'list', label: 'Cả danh sách' },
];

/** Kiểu xem nhớ theo máy; mặc định (và khi không đọc được storage) là "Phân trang". */
function loadView(): ReviewView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'paged';
  } catch {
    return 'paged';
  }
}

function saveView(v: ReviewView): void {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // không lưu được: chỉ nhớ trong phiên
  }
}

export function ResultPage() {
  const { id = '' } = useParams();
  const { bank, store, aiGate } = useApp();
  useStoreVersion();
  const [filter, setFilterState] = useState<ReviewFilter>('all');
  const [view, setView] = useState<ReviewView>(loadView);
  /** Vị trí câu đang xem trong danh sách đã lọc (kiểu Phân trang). */
  const [page, setPage] = useState(0);
  const reviewTop = useRef<HTMLHeadingElement>(null);
  const setFilter = (f: ReviewFilter) => {
    setFilterState(f);
    setPage(0);
  };
  const attempt = store.get(id);
  // Bấm "Đến câu …" trên thông báo AI: bỏ lọc và cuộn tới câu đó (khung chat của câu tự nhận yêu cầu mở).
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const jumped = useRef<AiJobTarget | null>(null);
  // Layout effect: đăng ký trước khung chat của câu (effect thường) để đọc yêu cầu trước khi khung nhận và xóa nó.
  useLayoutEffect(() => {
    const jump = () => {
      const t = aiGate.peekOpen();
      // Mỗi yêu cầu chỉ nhảy một lần (yêu cầu chưa ai nhận thì không kéo người học về mãi).
      if (t === jumped.current || t?.page !== 'attempt' || t.attemptId !== id) return;
      jumped.current = t;
      setFilterState('all');
      setJumpTo(t.qid);
    };
    jump();
    return aiGate.subscribe(jump);
  }, [aiGate, id]);
  useEffect(() => {
    if (jumpTo === null) return;
    // Kiểu Phân trang: mở trang của câu đó trước (bộ lọc đã về "Tất cả" nên vị trí = thứ tự trong lượt), rồi mới cuộn.
    if (view === 'paged') {
      const i = attempt?.questions.findIndex((q) => q.qid === jumpTo) ?? -1;
      if (i >= 0 && i !== page) {
        setPage(i);
        return;
      }
    }
    document.getElementById(`review-q-${jumpTo}`)?.scrollIntoView?.({ block: 'start' });
    setJumpTo(null);
  }, [jumpTo, view, page, attempt]);

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
  const paged = view === 'paged';
  // Danh sách ngắn lại thì không để vị trí vượt quá câu cuối.
  const current = Math.min(page, Math.max(0, items.length - 1));
  const visible = paged ? items.slice(current, current + 1) : items;
  const changeView = (v: ReviewView) => {
    setView(v);
    setPage(0);
    saveView(v);
  };
  /** Sang câu khác ở kiểu Phân trang: đưa đầu phần xem lại vào màn hình (câu dài thì người học đang ở cuối trang). */
  const goTo = (i: number) => {
    setPage(i);
    reviewTop.current?.scrollIntoView?.({ block: 'start' });
  };
  const isRight = (qid: number) => isCorrect(attempt.answers[qid] ?? [], bank.questions.get(qid)!.answer);

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

      <h2 ref={reviewTop} className="review-title">
        Xem lại bài làm
      </h2>
      <div className="filters" role="group" aria-label="Kiểu xem">
        {VIEWS.map((v) => (
          <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => changeView(v.value)}>
            {v.label}
          </button>
        ))}
      </div>
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
      {paged && items.length > 0 && (
        <nav className="navgrid review-grid" aria-label="Chọn câu">
          {items.map(({ aq, index }, i) => (
            <button
              key={aq.qid}
              type="button"
              className={['navgrid__cell', isRight(aq.qid) ? 'is-right' : 'is-wrong', attempt.flagged.includes(aq.qid) && 'is-flagged', i === current && 'is-current']
                .filter(Boolean)
                .join(' ')}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => setPage(i)}
            >
              {index + 1}
            </button>
          ))}
        </nav>
      )}
      {visible.map(({ aq, index }) => {
        const question = bank.questions.get(aq.qid)!;
        const selected = attempt.answers[aq.qid] ?? [];
        const correct = isCorrect(selected, question.answer);
        return (
          <article key={aq.qid} id={`review-q-${aq.qid}`} className="review-item">
            <div className="review-item__tags">
              <span className={`tag ${correct ? 'tag--ok' : 'tag--bad'}`}>{correct ? 'Đúng' : 'Sai'}</span>
              {selected.length === 0 && <span className="tag">Chưa trả lời</span>}
              {attempt.flagged.includes(aq.qid) && <span className="tag">Đánh dấu</span>}
              {attempt.guideOpened.includes(aq.qid) && <span className="tag">Đã xem hướng dẫn</span>}
              <span className="tag">{DOMAIN_SHORT[aq.domain]}</span>
            </div>
            {/* Bài đã nộp (cả Thi thật): tô đề và ghi chú được, lưu theo câu gốc. */}
            <QuestionCard
              heading={`Câu ${index + 1}`}
              question={question}
              order={aq.optionOrder}
              selected={selected}
              reveal
              showOrigLabels={!bank.vi.has(aq.qid) && !question.html}
              annotate={{
                qid: bank.canonical(aq.qid),
                label: `Câu ${index + 1}`,
                target: (hl) => ({ page: 'attempt', attemptId: attempt.id, qid: aq.qid, highlightId: hl }),
              }}
            />
            {/* Nút hỏi AI nằm giữa câu hỏi và hướng dẫn. Bài đã nộp: hỏi được cả Thi thật, không mở/gắn nhãn hướng dẫn (đã hiện sẵn). */}
            <div className="review-item__actions">
              <GeminiButton inline attemptId={attempt.id} number={index + 1} question={question} order={aq.optionOrder} />
              <NoteButton qid={bank.canonical(aq.qid)} label={`Câu ${index + 1}`} question={question} />
            </div>
            <GuidePanel question={question} order={aq.optionOrder} vi={bank.vi.get(aq.qid)} meta={bank.meta.get(aq.qid)} services={bank.services} />
          </article>
        );
      })}
      {paged && items.length > 0 && (
        <nav className="pager" aria-label="Chuyển câu">
          <button type="button" disabled={current === 0} onClick={() => goTo(current - 1)}>
            ← Câu trước
          </button>
          <span>
            Câu {current + 1}/{items.length}
          </span>
          <button type="button" disabled={current >= items.length - 1} onClick={() => goTo(current + 1)}>
            Câu sau →
          </button>
        </nav>
      )}
    </main>
  );
}
