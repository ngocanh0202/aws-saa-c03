import type { Question } from '../../src/data/types';

interface RawItem {
  question: string;
  explanation: string;
}

const LABELS = 'ABCDEFGH';

/** Lấy mảng `rawData` trong file HTML quiz ngoài (dạng literal JSON). */
export function extractRawData(html: string): RawItem[] {
  const m = html.match(/const rawData\s*=\s*(\[[\s\S]*?\n\s*\]);/);
  if (!m) throw new Error('không tìm thấy biến rawData');
  return JSON.parse(m[1]) as RawItem[];
}

export function htmlToText(html: string): string {
  return html
    .replace(/<span class="ud-component[\s\S]*?<\/span>/g, '')
    .replace(/<img[^>]*>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|li|pre|h\d)>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphs(html: string): string[] {
  return (html.match(/<p>[\s\S]*?<\/p>|<pre>[\s\S]*?<\/pre>/g) ?? [])
    .map((p) => (p.startsWith('<pre>') ? codeText(p.replace(/<\/?(pre|code)>/g, '')) : htmlToText(p)))
    .filter(Boolean);
}

function splitStem(html: string): { stem: string; prompt: string } {
  const ps = paragraphs(html);
  if (ps.length > 1) return { stem: ps.slice(0, -1).join('\n\n'), prompt: ps[ps.length - 1] };
  // Chỉ một đoạn: câu hỏi là câu cuối cùng kết thúc bằng dấu "?".
  const text = ps[0] ?? htmlToText(html);
  const m = text.match(/^([\s\S]*[.!])\s+([^.!]*\?.*)$/);
  return m ? { stem: m[1].trim(), prompt: m[2].trim() } : { stem: '', prompt: text };
}

// Lựa chọn trong phần giải thích là đoạn bắt đầu bằng <strong>…</strong>,
// hoặc một khối code kẹp giữa hai đoạn "**" (lựa chọn là đoạn policy JSON).
function strongLeads(sectionHtml: string): string[] {
  const out: string[] = [];
  const re = /<p>\s*<strong>([\s\S]*?)<\/strong>|<p>\*\*<\/p>\s*<pre><code>([\s\S]*?)<\/code><\/pre>/g;
  for (const m of sectionHtml.matchAll(re)) {
    const text = m[1] !== undefined ? htmlToText(m[1]) : codeText(m[2]);
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function codeText(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+$/, '');
}

function section(html: string, start: RegExp, end: RegExp): string | null {
  const s = html.search(start);
  if (s < 0) return null;
  const rest = html.slice(s).replace(start, '');
  const e = rest.search(end);
  return e < 0 ? rest : rest.slice(0, e);
}

const CORRECT = /<p>\s*Correct options?\s*:\s*<\/p>/i;
const INCORRECT = /<p>\s*Incorrect options?\s*:\s*<\/p>/i;
const REFERENCE = /<p>\s*References?\s*:\s*<\/p>/i;
const ANY_HEAD = /<p>\s*(?:Incorrect options?|References?|Exam Alert)\s*:\s*<\/p>/i;

/** Dựng lại câu hỏi trắc nghiệm từ một mục rawData. Lựa chọn đúng luôn đứng trước, nên UI phải xáo khi hiển thị. */
export function parseExternalItem(item: RawItem, id: number): Question {
  const correctHtml = section(item.explanation, CORRECT, ANY_HEAD);
  const incorrectHtml = section(item.explanation, INCORRECT, REFERENCE);
  if (correctHtml === null) throw new Error(`câu ${id}: không có mục "Correct option"`);
  if (incorrectHtml === null) throw new Error(`câu ${id}: không có mục "Incorrect options"`);
  const correct = strongLeads(correctHtml);
  const incorrect = strongLeads(incorrectHtml).filter((t) => !correct.includes(t));
  const texts = [...correct, ...incorrect];
  if (correct.length === 0 || incorrect.length === 0) throw new Error(`câu ${id}: thiếu lựa chọn đúng hoặc sai`);
  if (texts.length > LABELS.length) throw new Error(`câu ${id}: quá nhiều lựa chọn (${texts.length})`);
  const { stem, prompt } = splitStem(item.question);
  return {
    id,
    stem,
    prompt,
    options: texts.map((text, i) => ({ key: LABELS[i], text })),
    answer: correct.map((_, i) => LABELS[i]),
    choose: correct.length,
    explanationOrig: htmlToText(item.explanation),
  };
}

export function parseExternalHtml(html: string): Question[] {
  return extractRawData(html).map((item, i) => parseExternalItem(item, i + 1));
}
