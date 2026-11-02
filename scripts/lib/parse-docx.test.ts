import { strToU8, zipSync } from 'fflate';
import { parseDocx, readDocxParagraphs } from './parse-docx';

function para(text: string, style?: string, bold = false): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p w:rsidR="1">${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function makeDocx(paragraphs: string[]): Uint8Array {
  const xml = `<?xml version="1.0"?><w:document><w:body>${paragraphs.join('')}</w:body></w:document>`;
  return zipSync({ 'word/document.xml': strToU8(xml) });
}

const DOC = makeDocx([
  para('AWS Certified Solutions Architect', 'Title'),
  para('Bảng đáp án nhanh', 'Heading1'),
  `<w:tbl><w:tr><w:tc>${para('51')}</w:tc><w:tc>${para('D')}</w:tc></w:tr></w:tbl>`,
  para('Chi tiết câu hỏi, đáp án và giải thích', 'Heading1'),
  para('Question 51', 'Heading2'),
  para('A company &amp; its &quot;team&quot; want to migrate.'),
  para('Which solution will meet these requirements?', undefined, true),
  para('A. Use Lambda.', undefined, true),
  para('B. Use Amplify.', undefined, true),
  para('C. Use EC2.', undefined, true),
  para('D. Use ECS.', undefined, true),
  para('Đáp án đúng: D', undefined, true),
  para('Giải thích: Container hóa giữ nguyên code.', undefined, true),
  para('Đoạn giải thích thứ hai.'),
  para('Question 52', 'Heading2'),
  para('Pick two. Which combination? (Choose two.)', undefined, true),
  para('A. One.'),
  para('B. Two.'),
  para('C. Three.'),
  para('D. Four.'),
  para('E. Five.'),
  para('Đáp án đúng: A, C'),
  para('Giải thích: Vì vậy.'),
]);

describe('readDocxParagraphs', () => {
  it('đọc style, ghép text và giải mã entity XML', () => {
    const paras = readDocxParagraphs(DOC);
    expect(paras[0]).toEqual({ style: 'Title', text: 'AWS Certified Solutions Architect' });
    expect(paras.some((p) => p.text === 'A company & its "team" want to migrate.')).toBe(true);
  });
});

describe('parseDocx', () => {
  const qs = parseDocx(DOC);

  it('bỏ qua bảng đáp án nhanh, chỉ lấy câu dưới Heading2', () => {
    expect(qs.map((q) => q.id)).toEqual([51, 52]);
  });

  it('tách stem, prompt, lựa chọn và đáp án', () => {
    expect(qs[0].stem).toBe('A company & its "team" want to migrate.');
    expect(qs[0].prompt).toBe('Which solution will meet these requirements?');
    expect(qs[0].options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(qs[0].answer).toEqual(['D']);
  });

  it('gộp giải thích nhiều đoạn', () => {
    expect(qs[0].explanationOrig).toBe('Container hóa giữ nguyên code.\nĐoạn giải thích thứ hai.');
  });

  it('đọc câu nhiều đáp án', () => {
    expect(qs[1].answer).toEqual(['A', 'C']);
    expect(qs[1].choose).toBe(2);
    expect(qs[1].stem).toBe('');
  });

  it('báo lỗi khi câu thiếu "Đáp án đúng"', () => {
    const bad = makeDocx([para('Question 60', 'Heading2'), para('Text?'), para('A. x'), para('B. y')]);
    expect(() => parseDocx(bad)).toThrow('Câu 60');
  });
});
