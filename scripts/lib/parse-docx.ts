import { strFromU8, unzipSync } from 'fflate';
import type { Option, Question } from '../../src/data/types';
import { OPTION_RE, buildQuestion } from './build-question';

export interface DocxParagraph {
  style: string;
  text: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function readDocxParagraphs(buf: Uint8Array): DocxParagraph[] {
  const files = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' });
  const entry = files['word/document.xml'];
  if (!entry) throw new Error('Không tìm thấy word/document.xml');
  const xml = strFromU8(entry);
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragraphs.map((p) => ({
    style: p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '',
    text: decodeXml([...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')),
  }));
}

interface Draft {
  id: number;
  paragraphs: string[];
  options: Option[];
  answer: string | null;
  explanation: string[];
}

export function parseDocx(buf: Uint8Array): Question[] {
  const out: Question[] = [];
  let cur: Draft | null = null;

  const flush = () => {
    if (!cur) return;
    if (cur.answer === null) throw new Error(`Câu ${cur.id}: không tìm thấy "Đáp án đúng"`);
    out.push(buildQuestion(cur.id, cur.paragraphs, cur.options, cur.answer, cur.explanation.join('\n')));
    cur = null;
  };

  for (const p of readDocxParagraphs(buf)) {
    const isHeading = p.style.startsWith('Heading');
    const heading = isHeading ? p.text.trim().match(/^Question (\d+)$/) : null;
    if (heading) {
      flush();
      cur = { id: Number(heading[1]), paragraphs: [], options: [], answer: null, explanation: [] };
      continue;
    }
    if (isHeading) {
      flush();
      continue;
    }
    if (!cur) continue;
    const text = p.text.trim();
    if (!text) continue;

    const answer = text.match(/^Đáp án đúng:\s*(.+)$/);
    if (answer) {
      cur.answer = answer[1];
      continue;
    }
    const explanation = text.match(/^Giải thích:\s*(.*)$/);
    if (explanation) {
      cur.explanation.push(explanation[1]);
      continue;
    }
    if (cur.answer !== null) {
      cur.explanation.push(text);
      continue;
    }
    const opt = text.match(OPTION_RE);
    if (opt) {
      cur.options.push({ key: opt[1], text: opt[2].trim() });
      continue;
    }
    if (cur.options.length > 0) {
      const last = cur.options[cur.options.length - 1];
      last.text = `${last.text} ${text}`;
      continue;
    }
    cur.paragraphs.push(text);
  }
  flush();
  return out;
}
