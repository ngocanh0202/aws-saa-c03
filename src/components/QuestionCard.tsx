import type { Question } from '../data/types';
import { displayLabel } from '../engine/attempt';
import { optionState } from '../engine/review';

interface QuestionCardProps {
  question: Question;
  order: string[];
  selected: string[];
  reveal: boolean;
  showOrigLabels?: boolean;
  chooseLabel?: string;
  heading?: string;
  onSelect?: (key: string) => void;
}

export function QuestionCard({ question, order, selected, reveal, showOrigLabels, chooseLabel, heading, onSelect }: QuestionCardProps) {
  const byKey = new Map(question.options.map((o) => [o.key, o]));
  const multi = question.choose > 1;
  return (
    <section className="qcard" lang="en">
      {heading && <h3 className="qcard__heading">{heading}</h3>}
      {question.stem
        .split('\n\n')
        .filter(Boolean)
        .map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      <p className="qcard__prompt">
        <strong>{question.prompt}</strong>
      </p>
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
                <span className="opt__label">{displayLabel(i)}.</span> <span className="opt__text">{byKey.get(key)?.text}</span>
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
