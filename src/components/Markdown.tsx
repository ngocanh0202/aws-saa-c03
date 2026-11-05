import type { ReactNode } from 'react';

// Markdown tối giản và an toàn cho câu trả lời của Gemini: chỉ dựng React element,
// không bao giờ chèn HTML thô. Chữ đang stream dở (``` hay ** chưa đóng) vẫn hiển thị được.

const LATEX: Record<string, string> = {
  rightarrow: '→', to: '→', leftarrow: '←', leftrightarrow: '↔', uparrow: '↑', downarrow: '↓',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⇒',
  times: '×', cdot: '·', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
  approx: '≈', infty: '∞', checkmark: '✓', ldots: '…', dots: '…',
};

/**
 * Gemini hay viết ký hiệu kiểu LaTeX ($\rightarrow$). Đoạn $…$ chỉ gồm lệnh quen thuộc thì đổi
 * sang ký tự; có lệnh lạ hay cấu trúc ({ } ^ _) thì giữ nguyên. Số tiền ($5) không có "\" nên không bị đụng.
 */
function latex(text: string): string {
  return text.replace(/\$([^$\n]*\\[a-zA-Z]+[^$\n]*)\$/g, (whole, body: string) => {
    if (/[{}^_]/.test(body)) return whole;
    let known = true;
    const out = body.replace(/\\([a-zA-Z]+)/g, (_, name: string) => {
      if (!(name in LATEX)) known = false;
      return LATEX[name] ?? '';
    });
    return known ? out : whole;
  });
}

/** Link chỉ nhận http/https (không có javascript: …), luôn mở tab mới. */
function link(href: string, children: ReactNode, key: number): ReactNode {
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** links = false: đang ở trong chữ của một link, không dựng link lồng nhau. */
function inline(text: string, links = true): ReactNode[] {
  const out: ReactNode[] = [];
  // [chữ](url) · **đậm** · `code` · URL trần
  const re = links
    ? /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`|(https?:\/\/[^\s<>()]+)/g
    : // Hai nhóm rỗng giữ đúng số thứ tự nhóm của **đậm** và `code`.
      /()()\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let end = m.index + m[0].length;
    if (m[5] !== undefined) {
      // Dấu câu ngay sau URL trần ("…/pricing/.") không thuộc URL.
      const url = m[5].replace(/[.,;:!?'"]+$/, '');
      if (/^https?:\/\/$/.test(url)) continue;
      end = m.index + url.length;
      if (m.index > last) out.push(latex(text.slice(last, m.index)));
      out.push(link(url, url, out.length));
      last = end;
      re.lastIndex = end;
      continue;
    }
    if (m.index > last) out.push(latex(text.slice(last, m.index)));
    if (m[1] !== undefined && m[2]) out.push(link(m[2], inline(m[1], false), out.length));
    else if (m[3] !== undefined) out.push(<strong key={out.length}>{latex(m[3])}</strong>);
    else out.push(<code key={out.length}>{m[4]}</code>);
    last = end;
  }
  if (last < text.length) out.push(latex(text.slice(last)));
  return out;
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+\.\s+(.*)$/;
const HEADING = /^#{1,3}\s+(.*)$/;
/** Dòng phân cách của bảng: |---|:---:|---| (có thể thiếu | hai đầu). */
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
/** Dòng phân cách nằm giữa một dòng (bảng bị dồn hết lên một dòng). */
const INLINE_SEP = /\|(\s*:?-{3,}:?\s*\|)+/;

type Align = 'left' | 'center' | 'right' | undefined;

/** Tách ô theo | (bỏ | hai đầu; \| là ký tự | trong ô). */
function cells(row: string): string[] {
  const t = row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

function aligns(sep: string): Align[] {
  return cells(sep).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : undefined));
}

/** Dòng i là đầu bảng: có | và dòng sau là dòng phân cách. */
function tableAt(lines: string[], i: number): boolean {
  return lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_SEP.test(lines[i + 1]);
}

/**
 * Bảng bị dồn trên một dòng ("| a | b | |---|---| | 1 | 2 |"): số cột lấy theo dòng phân cách,
 * các hàng sau tách thành từng nhóm đủ số cột (giữa hai hàng là "| |"). Không khớp thì null.
 */
function collapsedTable(line: string): { header: string[]; align: Align[]; rows: string[][] } | null {
  if (!line.trimStart().startsWith('|')) return null;
  const m = INLINE_SEP.exec(line);
  if (!m || m.index === 0) return null;
  const header = cells(line.slice(0, m.index));
  const align = aligns(m[0]);
  const tokens = line.slice(m.index + m[0].length).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  const rows: string[][] = [];
  // tokens[0] là phần trước | đầu tiên; mỗi hàng là n ô, sau đó là khoảng trống giữa hai hàng.
  for (let k = 1; k + align.length <= tokens.length; k += align.length + 1) rows.push(tokens.slice(k, k + align.length));
  return { header, align, rows };
}

function Table({ header, align, rows }: { header: string[]; align: Align[]; rows: string[][] }) {
  // Số cột theo dòng phân cách: hàng thiếu ô thì thêm ô trống, thừa thì bỏ.
  const fit = (r: string[]) => align.map((_, k) => r[k] ?? '');
  return (
    <div className="markdown__table">
      <table>
        <thead>
          <tr>
            {fit(header).map((c, k) => (
              <th key={k} style={align[k] ? { textAlign: align[k] } : undefined}>
                {inline(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, n) => (
            <tr key={n}>
              {fit(r).map((c, k) => (
                <td key={k} style={align[k] ? { textAlign: align[k] } : undefined}>
                  {inline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  const key = () => blocks.length;

  while (i < lines.length) {
    const line = lines[i];
    const collapsed = collapsedTable(line);
    if (tableAt(lines, i)) {
      const header = cells(line);
      const align = aligns(lines[i + 1]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) rows.push(cells(lines[i++]));
      blocks.push(<Table key={key()} header={header} align={align} rows={rows} />);
    } else if (collapsed) {
      blocks.push(<Table key={key()} {...collapsed} />);
      i++;
    } else if (line.trimStart().startsWith('```')) {
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
        !HEADING.test(lines[i]) &&
        !(para.length > 0 && (tableAt(lines, i) || collapsedTable(lines[i])))
      ) {
        para.push(lines[i++]);
      }
      blocks.push(<p key={key()}>{inline(para.join('\n'))}</p>);
    }
  }
  return <div className="markdown">{blocks}</div>;
}
