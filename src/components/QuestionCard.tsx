import { useState } from 'react';
import type { AiJobTarget } from '../ai/gate';
import type { Question } from '../data/types';
import { displayLabel } from '../engine/attempt';
import { optionState } from '../engine/review';
import { Highlighter } from '../notes/Highlighter';

interface QuestionCardProps {
  question: Question;
  order: string[];
  selected: string[];
  reveal: boolean;
  showOrigLabels?: boolean;
  chooseLabel?: string;
  heading?: string;
  onSelect?: (key: string) => void;
  /** Bật tô + ghi chú (Thi thử). qid là id gốc (canonical). */
  annotate?: { qid: number; label: string; target: (highlightId: string) => AiJobTarget };
}

export function QuestionCard({ question, order, selected, reveal, showOrigLabels, chooseLabel, heading, onSelect, annotate }: QuestionCardProps) {
  const [stemEl, setStemEl] = useState<HTMLElement | null>(null);
  const [promptEl, setPromptEl] = useState<HTMLElement | null>(null);
  const byKey = new Map(question.options.map((o) => [o.key, o]));
  const multi = question.choose > 1;
  return (
    <section className="qcard" lang="en">
      {heading && <h3 className="qcard__heading">{heading}</h3>}
      {/* Vùng đề và dòng câu hỏi được Highlighter chèn <mark>: key theo câu để đổi câu thì dựng lại,
          và mỗi <p>/<strong> văn bản thuần chỉ có một con chữ (React ghi bằng textContent). */}
      {question.html ? (
        // HTML lấy từ question-doc-main trong repo (nguồn tin cậy), không phải dữ liệu người dùng nhập.
        <div key={`stem-${question.id}`} ref={setStemEl} data-part="stem" className="qcard__stem" dangerouslySetInnerHTML={{ __html: question.stem }} />
      ) : (
        <div key={`stem-${question.id}`} ref={setStemEl} data-part="stem" className="qcard__stemtext">
          {question.stem
            .split('\n\n')
            .filter(Boolean)
            .map((para, i) => (
              <p key={i}>{para}</p>
            ))}
        </div>
      )}
      {question.prompt && (
        <p key={`prompt-${question.id}`} ref={setPromptEl} data-part="prompt" className="qcard__prompt">
          <strong>{question.prompt}</strong>
        </p>
      )}
      {annotate && (
        <Highlighter
          key={`hl-${question.id}`}
          qid={annotate.qid}
          question={question}
          stemEl={stemEl}
          promptEl={question.prompt ? promptEl : null}
          label={annotate.label}
          target={annotate.target}
        />
      )}
      {chooseLabel && <p className="qcard__choose">{chooseLabel}</p>}
      <ul className="qcard__options" role={multi ? 'group' : 'radiogroup'}>
        {order.map((key, i) => {
          const state = optionState(key, selected, question.answer, reveal);
          return (
            <li key={key}>
              <button
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={selected.includes(key)}
                className={`opt opt--${state}`}
                disabled={!onSelect}
                onClick={() => onSelect?.(key)}
              >
                <span className="opt__label">{displayLabel(i)}.</span> {question.html ? (
                  <span className="opt__text opt__text--html" dangerouslySetInnerHTML={{ __html: byKey.get(key)?.text ?? '' }} />
                ) : (
                  <span className="opt__text">{byKey.get(key)?.text}</span>
                )}
                {showOrigLabels && <span className="opt__orig"> (gốc: {key})</span>}
                {state === 'missed' && <span className="opt__badge">Đáp án đúng</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
