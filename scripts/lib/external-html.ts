// Script chèn vào bản sao file HTML External lúc build: xáo thứ tự lựa chọn của mỗi câu
// (file gốc luôn đặt đáp án đúng lên đầu), giữ nguyên thứ tự câu hỏi.
// Dựa vào biến toàn cục `questionsData` và hàm `loadQuestion()` của file gốc; thiếu thì không làm gì.
export const SHUFFLE_CHOICES_SCRIPT = `<script>
/* Xáo thứ tự lựa chọn, giữ thứ tự câu hỏi (scripts/lib/external-html.ts). */
(function () {
  if (typeof questionsData === 'undefined' || typeof loadQuestion !== 'function') return;
  questionsData.forEach(function (q) {
    var idx = q.options.map(function (_, i) { return i; });
    for (var i = idx.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    q.options = idx.map(function (i) { return q.options[i]; });
    q.correctAnswerIndices = q.correctAnswerIndices.map(function (c) { return idx.indexOf(c); });
  });
  if (questionsData.length > 0 && currentQuestionIndex === 0) loadQuestion();
})();
</script>
`;

const MARKER = 'Xáo thứ tự lựa chọn, giữ thứ tự câu hỏi';

/** Chèn script xáo lựa chọn trước </body>; file đã có sẵn script này thì giữ nguyên. */
export function injectChoiceShuffle(html: string): string {
  if (html.includes(MARKER)) return html;
  const at = html.lastIndexOf('</body>');
  return at < 0 ? html + SHUFFLE_CHOICES_SCRIPT : html.slice(0, at) + SHUFFLE_CHOICES_SCRIPT + html.slice(at);
}
