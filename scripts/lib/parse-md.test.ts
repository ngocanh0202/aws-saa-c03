import { parseMarkdown } from './parse-md';

const SAMPLE = `# AWS SAA-C03 Practice Questions

## Question 1

A company needs storage.

It has two paragraphs of context.

**Which solution meets these requirements?**

A. Use Amazon S3.
B. Use Amazon EBS.
C. Use Amazon EFS
with a continuation line.
D. Use Amazon FSx.

**Answer: A**

**Explanation:** S3 là object storage.
Dòng thứ hai của giải thích.

---

## Question 2

Pick two things. **Which combination of steps will meet these requirements? (Choose two.)**

A. One.
B. Two.
C. Three.
D. Four.
E. Five.

**Answer: A, E**

**Explanation:** Chọn A và E.

---
`;

describe('parseMarkdown', () => {
  const qs = parseMarkdown(SAMPLE);

  it('tách đúng số câu và id', () => {
    expect(qs.map((q) => q.id)).toEqual([1, 2]);
  });

  it('tách đề bài (stem) và câu hỏi (prompt), bỏ dấu **', () => {
    expect(qs[0].stem).toBe('A company needs storage.\n\nIt has two paragraphs of context.');
    expect(qs[0].prompt).toBe('Which solution meets these requirements?');
  });

  it('ghép dòng nối tiếp vào lựa chọn trước đó', () => {
    expect(qs[0].options).toEqual([
      { key: 'A', text: 'Use Amazon S3.' },
      { key: 'B', text: 'Use Amazon EBS.' },
      { key: 'C', text: 'Use Amazon EFS with a continuation line.' },
      { key: 'D', text: 'Use Amazon FSx.' },
    ]);
  });

  it('đọc đáp án một và nhiều lựa chọn', () => {
    expect(qs[0].answer).toEqual(['A']);
    expect(qs[0].choose).toBe(1);
    expect(qs[1].answer).toEqual(['A', 'E']);
    expect(qs[1].choose).toBe(2);
    expect(qs[1].options).toHaveLength(5);
  });

  it('giữ giải thích nhiều dòng, không lấy dấu ---', () => {
    expect(qs[0].explanationOrig).toBe('S3 là object storage.\nDòng thứ hai của giải thích.');
  });

  it('câu hỏi nằm chung đoạn với stem vẫn được giữ nguyên trong prompt', () => {
    expect(qs[1].stem).toBe('');
    expect(qs[1].prompt).toBe(
      'Pick two things. **Which combination of steps will meet these requirements? (Choose two.)**'.replace(/\*\*/g, ''),
    );
  });

  it('báo lỗi rõ ràng khi thiếu Answer', () => {
    expect(() => parseMarkdown('## Question 9\n\nText\n\nA. x\nB. y\n')).toThrow('Câu 9');
  });
});
