import { extractRawData, htmlToText, parseExternalHtml, parseExternalItem } from './parse-external';

const single = {
  question: '<p>A company stores files on premises.</p>\n\n<p>Which service should it use?</p>',
  explanation: [
    '<p>Correct option:</p>',
    '<p><strong>Amazon FSx for Windows File Server</strong></p>',
    '<p>Supports <strong>DFS</strong> namespaces.</p>',
    '<p>Incorrect Options:</p>',
    '<p><strong>Amazon FSx for Lustre</strong> - no DFS support.</p>',
    '<p><strong>Amazon EFS</strong></p>',
    '<p>References:</p>',
    '<p><a href="https://aws.amazon.com/fsx/">link</a></p>',
  ].join('\n\n'),
};

describe('parseExternalItem', () => {
  it('dựng lựa chọn từ phần giải thích, đáp án đúng đứng đầu', () => {
    const q = parseExternalItem(single, 7);
    expect(q.id).toBe(7);
    expect(q.stem).toBe('A company stores files on premises.');
    expect(q.prompt).toBe('Which service should it use?');
    expect(q.options).toEqual([
      { key: 'A', text: 'Amazon FSx for Windows File Server' },
      { key: 'B', text: 'Amazon FSx for Lustre' },
      { key: 'C', text: 'Amazon EFS' },
    ]);
    expect(q.answer).toEqual(['A']);
    expect(q.choose).toBe(1);
    expect(q.explanationOrig).toContain('Supports DFS namespaces.');
  });

  it('nhận nhiều đáp án đúng', () => {
    const q = parseExternalItem(
      {
        question: '<p>Ctx.</p><p>Pick two? (Select two)</p>',
        explanation:
          '<p>Correct options:</p><p><strong>One</strong></p><p><strong>Two</strong></p><p>Exam Alert:</p><p><strong>Note</strong></p><p>Incorrect options:</p><p><strong>Three</strong></p>',
      },
      1,
    );
    expect(q.options.map((o) => o.text)).toEqual(['One', 'Two', 'Three']);
    expect(q.answer).toEqual(['A', 'B']);
    expect(q.choose).toBe(2);
  });

  it('nhận lựa chọn là khối code kẹp giữa hai đoạn "**"', () => {
    const q = parseExternalItem(
      {
        question: '<p>Fix the policy.</p><pre><code>{ "a": 1 }\n</code></pre><p>Which statement?</p>',
        explanation:
          '<p>Correct option:</p><p>**</p><pre><code>{\n  "Effect": "Allow"\n}\n</code></pre><p>**</p><p>Incorrect options:</p><p>**</p><pre><code>{ "Effect": "Deny" }</code></pre><p>** - wrong</p>',
      },
      1,
    );
    expect(q.stem).toBe('Fix the policy.\n\n{ "a": 1 }');
    expect(q.options.map((o) => o.text)).toEqual(['{\n  "Effect": "Allow"\n}', '{ "Effect": "Deny" }']);
  });

  it('tách câu hỏi khỏi đề khi chỉ có một đoạn', () => {
    const q = parseExternalItem(
      { question: '<p>An owner sets up an account. What should he do?</p>', explanation: single.explanation },
      1,
    );
    expect(q.stem).toBe('An owner sets up an account.');
    expect(q.prompt).toBe('What should he do?');
  });

  it('báo lỗi khi thiếu mục đáp án sai', () => {
    expect(() =>
      parseExternalItem({ question: '<p>Q?</p>', explanation: '<p>Correct option:</p><p><strong>X</strong></p>' }, 3),
    ).toThrow('câu 3');
  });
});

describe('extractRawData / parseExternalHtml', () => {
  it('đọc mảng rawData trong file HTML', () => {
    const html = `<script>\n    const rawData = [\n  ${JSON.stringify(single)}\n];\nfunction x() {}\n</script>`;
    expect(extractRawData(html)).toHaveLength(1);
    expect(parseExternalHtml(html)[0].answer).toEqual(['A']);
  });
});

describe('htmlToText', () => {
  it('bỏ ảnh, thẻ và giải mã entity', () => {
    expect(htmlToText('<p>a &lt;b&gt; <img src="x"> <code>c</code></p>\n<p>d</p>')).toBe('a <b> c\n\nd');
  });
});
