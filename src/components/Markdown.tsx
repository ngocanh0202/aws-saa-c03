import type { ReactNode } from 'react';

// Markdown tối giản và an toàn cho câu trả lời của Gemini: chỉ dựng React element,
// không bao giờ chèn HTML thô. Chữ đang stream dở (``` hay ** chưa đóng) vẫn hiển thị được.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      m[1] !== undefined ? <strong key={out.length}>{m[1]}</strong> : <code key={out.length}>{m[2]}</code>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+\.\s+(.*)$/;
const HEADING = /^#{1,3}\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  const key = () => blocks.length;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) code.push(lines[i++]);
      i++; // bỏ dòng đóng (nếu chưa có thì phần còn lại coi là code)
      blocks.push(
        <pre key={key()}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
    } else if (BULLET.test(line) || NUMBER.test(line)) {
      const ordered = NUMBER.test(line);
      const re = ordered ? NUMBER : BULLET;
      const items: ReactNode[] = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(<li key={items.length}>{inline(re.exec(lines[i])![1])}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>);
    } else if (HEADING.test(line)) {
      blocks.push(
        <p key={key()}>
          <strong>{inline(HEADING.exec(line)![1])}</strong>
        </p>,
      );
      i++;
    } else if (line.trim() === '') {
      i++;
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trimStart().startsWith('```') &&
        !BULLET.test(lines[i]) &&
        !NUMBER.test(lines[i]) &&
        !HEADING.test(lines[i])
      ) {
        para.push(lines[i++]);
      }
      blocks.push(<p key={key()}>{inline(para.join('\n'))}</p>);
    }
  }
  return <div className="markdown">{blocks}</div>;
}
