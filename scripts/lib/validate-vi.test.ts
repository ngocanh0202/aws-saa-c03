import type { Question, QuestionVi } from '../../src/data/types';
import { hasLetterRef, validateVi } from './validate-vi';

function q(id: number, stem = 'Stem'): Question {
  return {
    id,
    stem,
    prompt: 'Which?',
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Opt ${key}` })),
    answer: ['A'],
    choose: 1,
    explanationOrig: 'x',
  };
}

function vi(id: number, over: Partial<QuestionVi> = {}): QuestionVi {
  return {
    id,
    stemVi: 'Đề bài.',
    promptVi: 'Câu hỏi?',
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, textVi: 'Nội dung lựa chọn.', reason: 'Lý do theo nội dung.' })),
    explanationVi: 'Giải thích.',
    keyHint: 'Dấu hiệu.',
    ...over,
  };
}

describe('hasLetterRef', () => {
  it.each([
    'Chọn B vì rẻ hơn.',
    'Đáp án A đúng.',
    'Phương án C sai.',
    'Lựa chọn D/E đều tốn kém.',
    'Option E không đáp ứng.',
    'A và C đều sai.',
    'A, B sai vì tốn chi phí.',
    '(D) là cách đúng.',
    'Answer B is right.',
    'Câu A sai.',
    'A. dùng S3',
    'Ý đầu tiên.\nB) sai',
    'Đáp án F đúng.',
    '(F) là đúng.',
    'Chọn F vì rẻ.',
    'E và F đều sai.',
  ])('bắt: %s', (text) => {
    expect(hasLetterRef(text)).toBe(true);
  });

  it.each([
    'Amazon S3 Standard-IA rẻ hơn.',
    'Dùng EC2 C5 instance.',
    'Tạo bản ghi A trong Route 53 và bản ghi CNAME.',
    'Phương án dùng Athena là đúng.',
    'Đáp án đúng dùng CloudFront.',
    'RAID 0 không bền.',
    'AWS và Azure.',
    'Câu hỏi này (Chọn hai.)',
    'Amazon EFS và FSx.',
  ])('bỏ qua: %s', (text) => {
    expect(hasLetterRef(text)).toBe(false);
  });
});

describe('validateVi', () => {
  it('bản dịch hợp lệ không có lỗi và không cảnh báo', () => {
    expect(validateVi([q(1)], [vi(1)])).toEqual({ errors: [], warnings: [] });
  });

  it('câu có đề trống cho phép stemVi rỗng', () => {
    expect(validateVi([q(1, '')], [vi(1, { stemVi: '' })]).errors).toEqual([]);
  });

  it('báo thiếu stemVi khi đề không trống', () => {
    expect(validateVi([q(1)], [vi(1, { stemVi: ' ' })]).errors).toContain('vi: câu 1 thiếu nội dung: stemVi');
  });

  it('báo từng trường rỗng, kể cả reason của từng lựa chọn', () => {
    const options = vi(1).options.map((o) => (o.key === 'B' ? { ...o, reason: '' } : o));
    const { errors } = validateVi([q(1)], [vi(1, { keyHint: '', options })]);
    expect(errors).toContain('vi: câu 1 thiếu nội dung: keyHint, reason của B');
  });

  it('báo id trùng, id không tồn tại và key lệch bản gốc', () => {
    const shortOptions = vi(1).options.slice(0, 3);
    const { errors } = validateVi([q(1)], [vi(1), vi(1, { options: shortOptions }), vi(9)]);
    expect(errors).toContain('vi: câu 1 bị trùng');
    expect(errors).toContain('vi: câu 1 có key lựa chọn không khớp bản gốc');
    expect(errors).toContain('vi: câu 9 không tồn tại');
  });

  it('báo chữ cái chỉ lựa chọn trong reason, explanationVi, keyHint và review', () => {
    const msg = 'vi: câu 1 nhắc lựa chọn bằng chữ cái (không được vì đáp án bị xáo)';
    const options = vi(1).options.map((o) => (o.key === 'C' ? { ...o, reason: 'Sai, chọn B mới đúng.' } : o));
    expect(validateVi([q(1)], [vi(1, { options })]).errors).toContain(msg);
    expect(validateVi([q(1)], [vi(1, { explanationVi: 'A và D đều đúng.' })]).errors).toContain(msg);
    expect(validateVi([q(1)], [vi(1, { keyHint: 'Nhìn (A).' })]).errors).toContain(msg);
    expect(validateVi([q(1)], [vi(1, { review: { reason: 'Có lẽ đáp án C mới đúng.' } })]).errors).toContain(msg);
  });

  it('cờ review: cảnh báo kèm lý do, báo lỗi khi lý do rỗng', () => {
    const flagged = validateVi([q(1)], [vi(1, { review: { reason: 'Nghi đáp án gốc sai.' } })]);
    expect(flagged.errors).toEqual([]);
    expect(flagged.warnings).toContain('vi: câu 1 được gắn cờ review: Nghi đáp án gốc sai.');
    expect(validateVi([q(1)], [vi(1, { review: { reason: '' } })]).errors).toContain(
      'vi: câu 1 có review nhưng thiếu lý do',
    );
  });

  it('câu trùng phải có bản dịch giống hệt nhau (chỉ khác id)', () => {
    const pair: [number, number][] = [[1, 2]];
    expect(validateVi([q(1), q(2)], [vi(1), vi(2)], pair).errors).toEqual([]);
    expect(validateVi([q(1), q(2)], [vi(1), vi(2, { keyHint: 'Khác.' })], pair).errors).toContain(
      'vi: câu 1 và 2 trùng nhau nhưng bản dịch khác nhau',
    );
    expect(validateVi([q(1), q(2)], [vi(1)], pair).errors).toEqual([]);
  });

  it('cảnh báo số câu chưa có bản dịch', () => {
    expect(validateVi([q(1), q(2)], [vi(1)]).warnings).toContain('1 câu chưa có bản dịch tiếng Việt');
  });
});
