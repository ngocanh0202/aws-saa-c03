// @vitest-environment node
import { JSDOM } from 'jsdom';
import { injectChoiceShuffle } from './external-html';

// Khung tối giản giống file quiz gốc: questionsData + loadQuestion() vẽ lựa chọn của câu hiện tại.
const TEMPLATE = `<!DOCTYPE html><html><body><ul id="opts"></ul><script>
const questionsData = [1, 2, 3].map((n) => ({
  options: ['right ' + n, 'wrong1 ' + n, 'wrong2 ' + n, 'wrong3 ' + n],
  correctAnswerIndices: [0],
}));
let currentQuestionIndex = 0;
function loadQuestion() {
  document.getElementById('opts').innerHTML = questionsData[currentQuestionIndex].options.map((o) => '<li>' + o + '</li>').join('');
}
loadQuestion();
</script></body></html>`;

function run(html: string, randoms: number[]) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      let i = 0;
      window.Math.random = () => randoms[i++ % randoms.length];
    },
  });
  const w = dom.window as unknown as { eval: (s: string) => unknown };
  return {
    rendered: [...dom.window.document.querySelectorAll('#opts li')].map((li) => li.textContent),
    data: w.eval("typeof questionsData === 'undefined' ? [] : questionsData") as {
      options: string[];
      correctAnswerIndices: number[];
    }[],
  };
}

describe('injectChoiceShuffle', () => {
  it('chèn script ngay trước </body>', () => {
    const out = injectChoiceShuffle('<html><body><p>x</p></body></html>');
    expect(out).toMatch(/<p>x<\/p><script>[\s\S]*<\/script>\n<\/body><\/html>$/);
  });

  it('xáo lựa chọn, đáp án đúng vẫn trỏ đúng nội dung, câu hỏi giữ thứ tự, vẽ lại câu đầu', () => {
    const { rendered, data } = run(injectChoiceShuffle(TEMPLATE), [0.1, 0.5, 0.9]);
    expect(data.map((q) => q.options.find((o) => o.startsWith('right')))).toEqual(['right 1', 'right 2', 'right 3']);
    for (const q of data) expect(q.options[q.correctAnswerIndices[0]]).toMatch(/^right/);
    expect(data.some((q) => q.correctAnswerIndices[0] !== 0)).toBe(true);
    expect(rendered).toEqual(data[0].options);
  });

  it('không chèn lần hai nếu file đã có script', () => {
    const once = injectChoiceShuffle(TEMPLATE);
    expect(injectChoiceShuffle(once)).toBe(once);
  });

  it('không làm gì nếu file không có questionsData', () => {
    expect(() => run(injectChoiceShuffle('<html><body></body></html>'), [0.5])).not.toThrow();
  });
});
