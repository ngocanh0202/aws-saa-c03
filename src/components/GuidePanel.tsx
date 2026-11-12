import { useState } from 'react';
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

type GuideLang = 'vi' | 'en';
const GUIDE_LANG_KEY = 'saa-c03:guide-lang';

function useGuideLang(): [GuideLang, (lang: GuideLang) => void] {
  const [lang, setLang] = useState<GuideLang>(() => {
    try {
      if (localStorage.getItem(GUIDE_LANG_KEY) === 'en') return 'en';
    } catch {
      // localStorage bị chặn: mặc định tab VI
    }
    return 'vi';
  });
  const choose = (next: GuideLang) => {
    setLang(next);
    try {
      localStorage.setItem(GUIDE_LANG_KEY, next);
    } catch {
      // bỏ qua
    }
  };
  return [lang, choose];
}

/** Đoạn bắt đầu bằng { hoặc [ là JSON/IAM policy: giữ nguyên xuống dòng. */
function isCodeParagraph(para: string): boolean {
  const t = para.trim();
  // Có đề chỉ chép phần thân policy, bắt đầu bằng "Version": ... mà không có dấu { mở đầu.
  return t.startsWith('{') || t.startsWith('[') || t.startsWith('"Version"');
}

export function GuidePanel({ question, order, vi, meta, services }: GuidePanelProps) {
  const viByKey = new Map(vi?.options.map((o) => [o.key, o]) ?? []);
  const correctLabels = order.flatMap((key, i) => (question.answer.includes(key) ? [displayLabel(i)] : []));
  const statuses = serviceStatusFor(question);
  const [lang, setLang] = useGuideLang();
  const tabbed = Boolean(question.html && vi);
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
      {meta?.note && <p className="guide__review">⚠ Ghi chú review: {meta.note}</p>}
      {vi?.review && <p className="guide__review">⚠ Cần xem lại đáp án gốc: {vi.review.reason}</p>}
      {tabbed && (
        <div className="guide__tabs" role="tablist" aria-label="Ngôn ngữ hướng dẫn">
          {(['vi', 'en'] as const).map((l) => (
            <button key={l} type="button" role="tab" className="guide__tab" aria-selected={lang === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {vi && !(tabbed && lang === 'en') ? (
        <>
          <h5>Bản dịch</h5>
          {vi.stemVi
            .split('\n\n')
            .filter(Boolean)
            .map((para, i) => (isCodeParagraph(para) ? <pre key={i}>{para}</pre> : <p key={i}>{para}</p>))}
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
                    {displayLabel(i)}.{' '}
                    {option && isCodeParagraph(option.textVi) ? <pre>{option.textVi}</pre> : option?.textVi} — {right ? 'Đúng' : 'Sai'}
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
      ) : question.html ? (
        <>
          {!tabbed && <p className="guide__pending">Giải thích gốc (tiếng Anh):</p>}
          <div className="guide__orig" lang="en" dangerouslySetInnerHTML={{ __html: question.explanationOrig }} />
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
