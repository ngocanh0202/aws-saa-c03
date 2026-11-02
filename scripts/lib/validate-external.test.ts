import type { QuestionVi } from '../../src/data/types';
import { parseExternalHtml } from './parse-external';
import { validateExternal } from './validate-external';

const item = {
  question: '<p>Ctx.</p><p>Which?</p>',
  explanation: '<p>Correct option:</p><p><strong>Yes</strong></p><p>Incorrect options:</p><p><strong>No</strong></p>',
};
const html = `const rawData = [\n${JSON.stringify(item)}\n];`;
const set = { slug: 'quiz', file: 'quiz.html', title: 'Quiz', questions: parseExternalHtml(html) };
const vi: QuestionVi = {
  id: 1,
  stemVi: 'Bối cảnh.',
  promptVi: 'Cái nào?',
  options: [
    { key: 'A', textVi: 'Có', reason: 'Đúng vì có.' },
    { key: 'B', textVi: 'Không', reason: 'Sai vì không.' },
  ],
  explanationVi: 'Giải thích.',
  keyHint: '"Which" → có.',
};

describe('validateExternal', () => {
  it('không lỗi khi dữ liệu khớp file HTML và có bản dịch', () => {
    expect(validateExternal({ html: { 'quiz.html': html }, sets: [set], vis: { quiz: [vi] } })).toEqual({ errors: [], warnings: [] });
  });

  it('báo lỗi khi chưa chạy npm run external', () => {
    const r = validateExternal({ html: { 'quiz.html': html, 'new.html': html }, sets: [set], vis: {} });
    expect(r.errors).toEqual(['external/new.html: data/external chưa khớp file HTML, chạy "npm run external"']);
    expect(r.warnings).toEqual(['quiz: 1 câu chưa có bản dịch tiếng Việt']);
  });

  it('kiểm tra bản dịch như data/vi, kèm tên bộ', () => {
    const bad = { ...vi, explanationVi: 'Chọn đáp án A.' };
    const r = validateExternal({ html: { 'quiz.html': html }, sets: [set], vis: { quiz: [bad] } });
    expect(r.errors).toEqual(['quiz: vi: câu 1 nhắc lựa chọn bằng chữ cái (không được vì đáp án bị xáo)']);
  });
});
