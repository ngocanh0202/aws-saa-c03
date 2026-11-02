import type { Option, Question } from '../../src/data/types';
import { OPTION_RE, buildQuestion } from './build-question';

const ANSWER_RE = /\*\*Answer:\s*([A-F](?:\s*,\s*[A-F])*)\s*\*\*/;
const EXPLANATION_RE = /\*\*Explanation:\*\*\s*([\s\S]*)$/;

export function parseMarkdown(src: string): Question[] {
  const text = src.replace(/\r\n/g, '\n');
  const parts = text.split(/^## Question (\d+)\s*$/m);
  const out: Question[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    out.push(parseBlock(Number(parts[i]), parts[i + 1]));
  }
  return out;
}

function parseBlock(id: number, rawBody: string): Question {
  const body = rawBody.split(/^---\s*$/m)[0];
  const answerMatch = body.match(ANSWER_RE);
  if (!answerMatch || answerMatch.index === undefined) throw new Error(`Câu ${id}: không tìm thấy **Answer:**`);
  const explanation = body.slice(answerMatch.index).match(EXPLANATION_RE)?.[1] ?? '';
  const head = body.slice(0, answerMatch.index);

  const paragraphs: string[] = [];
  const options: Option[] = [];
  let buffer: string[] = [];
  const flushParagraph = () => {
    if (buffer.length) paragraphs.push(buffer.join(' ').trim());
    buffer = [];
  };

  for (const rawLine of head.split('\n')) {
    const line = rawLine.trim();
    const opt = line.match(OPTION_RE);
    if (opt) {
      flushParagraph();
      options.push({ key: opt[1], text: opt[2].trim() });
    } else if (line === '') {
      flushParagraph();
    } else if (options.length > 0) {
      const last = options[options.length - 1];
      last.text = `${last.text} ${line}`;
    } else {
      buffer.push(line);
    }
  }
  flushParagraph();

  return buildQuestion(id, paragraphs, options, answerMatch[1], explanation);
}
