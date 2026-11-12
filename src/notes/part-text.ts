import type { Question } from '../data/types';
import type { HighlightPart } from './model';

/** Văn bản thuần của từng vùng, giống textContent mà QuestionCard dựng ra (Highlighter đo offset trên đó). */
export function partText(q: Question, part: HighlightPart): string {
  if (part === 'prompt') return q.prompt;
  if (q.html) {
    const d = document.createElement('div');
    d.innerHTML = q.stem;
    return d.textContent ?? '';
  }
  return q.stem
    .split('\n\n')
    .filter(Boolean)
    .join('');
}
