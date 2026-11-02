import type { Question, QuestionMeta, QuestionVi, ServiceRef } from '../data/types';
import { serviceStatusFor } from '../data/service-status';
import { displayLabel } from '../engine/attempt';
import { ServiceChip } from './ServiceChip';

interface GuidePanelProps {
  question: Question;
  order: string[];
  vi?: QuestionVi;
  meta?: QuestionMeta;
  services: Map<string, ServiceRef>;
}

export function GuidePanel({ question, order, vi, meta, services }: GuidePanelProps) {
  const viByKey = new Map(vi?.options.map((o) => [o.key, o]) ?? []);
  const correctLabels = order.flatMap((key, i) => (question.answer.includes(key) ? [displayLabel(i)] : []));
  const statuses = serviceStatusFor(question);
  return (
    <aside className="guide" lang="vi" aria-label="Hướng dẫn">
      <h4>Hướng dẫn</h4>
      <p className="guide__answer">Đáp án đúng: {correctLabels.join(', ')}</p>
      {statuses.length > 0 && (
        <div className="guide__status">
          <strong>ℹ Cập nhật dịch vụ (kiểm tra 10/2026)</strong>
          <ul>
            {statuses.map((s) => (
              <li key={s.id}>
                {s.kind === 'renamed' ? 'Đổi tên' : 'Đã ngừng'}: {s.note}
              </li>
            ))}
          </ul>
        </div>
      )}
      {vi ? (
        <>
          {vi.review && <p className="guide__review">⚠ Cần xem lại đáp án gốc: {vi.review.reason}</p>}
          <h5>Bản dịch</h5>
          {vi.stemVi
            .split('\n\n')
            .filter(Boolean)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          <p>
            <strong>{vi.promptVi}</strong>
          </p>
          <ul className="guide__options">
            {order.map((key, i) => {
              const right = question.answer.includes(key);
              const option = viByKey.get(key);
              return (
                <li key={key} className={right ? 'is-right' : 'is-wrong'}>
                  <strong>
                    {displayLabel(i)}. {option?.textVi} — {right ? 'Đúng' : 'Sai'}
                  </strong>
                  <p>{option?.reason}</p>
                </li>
              );
            })}
          </ul>
          <h5>Giải thích</h5>
          <p>{vi.explanationVi}</p>
          <h5>Dấu hiệu nhận biết</h5>
          <p>{vi.keyHint}</p>
        </>
      ) : (
        <>
          <p className="guide__pending">Câu này chưa có bản dịch. Giải thích gốc (chữ cái theo nhãn gốc):</p>
          <p>{question.explanationOrig}</p>
        </>
      )}
      {meta && meta.services.length > 0 && (
        <>
          <h5>Service liên quan</h5>
          <div className="chips">
            {meta.services.map((id) => (
              <ServiceChip key={id} id={id} service={services.get(id)} />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
