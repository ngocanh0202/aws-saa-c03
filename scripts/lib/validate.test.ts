import type { Question, QuestionMeta, QuestionVi, SetsFile } from '../../src/data/types';
import { expectedChoose, validate, type ValidationInput, type ValidationRules } from './validate';

const RULES: ValidationRules = { total: 3, setCount: 1, setSize: 2, quota: { 1: 1, 2: 1, 3: 0, 4: 0 } };

function q(id: number, answer = ['A'], prompt = 'Which?'): Question {
  return {
    id,
    stem: 'Stem',
    prompt,
    options: ['A', 'B', 'C', 'D', 'E'].map((key) => ({ key, text: `Opt ${key}` })),
    answer,
    choose: answer.length,
    explanationOrig: 'x',
  };
}

function meta(id: number, domain: 1 | 2 | 3 | 4 = 1): QuestionMeta {
  return { id, domain, difficulty: 2, services: ['s3'] };
}

function base(): ValidationInput {
  return {
    questions: [q(1), q(2), q(3)],
    metas: [meta(1), meta(2, 2), meta(3)],
    vis: [],
    registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
    noteIds: [],
    serviceNotes: [],
    sets: null,
  };
}

describe('expectedChoose', () => {
  it('đọc Choose two/three không phân biệt hoa thường', () => {
    expect(expectedChoose(q(1, ['A'], 'Which? (Choose two.)'))).toBe(2);
    expect(expectedChoose(q(1, ['A'], 'Which? (CHOOSE THREE.)'))).toBe(3);
    expect(expectedChoose(q(1))).toBe(1);
  });
});

describe('validate', () => {
  it('dữ liệu hợp lệ không có lỗi', () => {
    expect(validate(base(), RULES).errors).toEqual([]);
  });

  it('báo thiếu câu và sai tổng số', () => {
    const input = { ...base(), questions: [q(1), q(3)] };
    const { errors } = validate(input, RULES);
    expect(errors).toContain('Có 2 câu, cần 3');
    expect(errors).toContain('Thiếu câu 2');
  });

  it('báo đáp án không nằm trong các lựa chọn', () => {
    const input = { ...base(), questions: [q(1, ['Z']), q(2), q(3)] };
    expect(validate(input, RULES).errors).toContain('Câu 1: đáp án Z không có trong lựa chọn');
  });

  it('báo số đáp án không khớp Choose two', () => {
    const input = { ...base(), questions: [q(1, ['A'], 'Which? (Choose two.)'), q(2), q(3)] };
    expect(validate(input, RULES).errors).toContain('Câu 1: đề yêu cầu chọn 2 nhưng đáp án có 1');
  });

  it('báo meta trỏ tới câu không tồn tại, trùng id, sai domain, service ngoài registry', () => {
    const bad = { id: 9, domain: 5, difficulty: 2, services: [] } as unknown as QuestionMeta;
    const input = { ...base(), metas: [meta(1), meta(1), { ...meta(2), services: ['nope'] }, bad] };
    const { errors } = validate(input, RULES);
    expect(errors).toContain('meta: câu 9 không tồn tại');
    expect(errors).toContain('meta: câu 1 bị trùng');
    expect(errors).toContain('meta: câu 9 có domain không hợp lệ (5)');
    expect(errors).toContain('meta: câu 2 dùng service "nope" không có trong service-registry.json');
  });

  it('cảnh báo câu chưa có meta và service chưa có ghi chú', () => {
    const input = { ...base(), metas: [meta(1), meta(2, 2)] };
    const { warnings } = validate(input, RULES);
    expect(warnings).toContain('1 câu chưa có meta');
    expect(warnings).toContain('1 service chưa có ghi chú trong data/services/');
  });

  it('báo bản dịch lệch key và bản dịch dùng chữ cái chỉ lựa chọn', () => {
    const vi: QuestionVi = {
      id: 1,
      stemVi: 'Đề',
      promptVi: 'Hỏi',
      options: ['A', 'B', 'C', 'D'].map((key) => ({ key, textVi: key, reason: 'ok' })),
      explanationVi: 'Vì vậy đáp án B là đúng.',
      keyHint: 'x',
    };
    const { errors } = validate({ ...base(), vis: [vi] }, RULES);
    expect(errors).toContain('vi: câu 1 có key lựa chọn không khớp bản gốc');
    expect(errors).toContain('vi: câu 1 nhắc lựa chọn bằng chữ cái (không được vì đáp án bị xáo)');
  });

  it('kiểm tra sets: trùng câu, sai kích thước, không phủ hết ngân hàng', () => {
    const sets: SetsFile = { version: 1, sets: [{ id: 1, questionIds: [1, 1] }], reserve: [] };
    const { errors } = validate({ ...base(), sets }, RULES);
    expect(errors).toContain('sets: câu 1 xuất hiện nhiều lần');
    expect(errors).toContain('sets: tổng số câu trong đề và kho dự phòng là 2, cần 3');
  });

  it('cảnh báo đề lệch quota domain', () => {
    const sets: SetsFile = { version: 1, sets: [{ id: 1, questionIds: [1, 3] }], reserve: [2] };
    const { errors, warnings } = validate({ ...base(), sets }, RULES);
    expect(errors).toEqual([]);
    expect(warnings).toContain('sets: Đề 1 có domain 1 = 2 câu (quota 1)');
  });

  it('báo lỗi khi câu trùng nằm cùng đề', () => {
    const sets: SetsFile = {
      version: 1,
      sets: [{ id: 1, questionIds: [1, 2] }],
      reserve: [3],
      duplicates: [[1, 2]],
    };
    const { errors } = validate({ ...base(), sets }, RULES);
    expect(errors).toContain('sets: câu 1 và 2 trùng nhau nhưng cùng nằm trong Đề 1');
  });

  it('không báo lỗi khi câu trùng ở đề khác nhau hoặc trong dự phòng', () => {
    const sets: SetsFile = {
      version: 1,
      sets: [
        { id: 1, questionIds: [1] },
        { id: 2, questionIds: [2, 3] },
      ],
      reserve: [],
      duplicates: [[1, 2]],
    };
    const { errors } = validate({ ...base(), sets }, RULES);
    expect(errors.filter((e) => e.includes('trùng nhau'))).toEqual([]);
  });
});
