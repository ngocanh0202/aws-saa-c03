import { buildBank } from './bank';

describe('buildBank', () => {
  it('lập chỉ mục câu hỏi, meta, bản dịch, service và câu hỏi liên quan', () => {
    const bank = buildBank({
      questions: [1, 2].map((id) => ({ id, stem: '', prompt: '', options: [], answer: ['A'], choose: 1, explanationOrig: '' })),
      metas: [
        { id: 1, domain: 1, difficulty: 1, services: ['s3', 'iam'] },
        { id: 2, domain: 2, difficulty: 2, services: ['s3'] },
      ],
      vis: [{ id: 2, stemVi: '', promptVi: '', options: [], explanationVi: '', keyHint: '' }],
      registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
      sets: { version: 1, sets: [], reserve: [] },
    });
    expect(bank.questions.get(2)?.id).toBe(2);
    expect(bank.meta.get(1)?.domain).toBe(1);
    expect(bank.vi.has(2)).toBe(true);
    expect(bank.services.get('s3')?.name).toBe('Amazon S3');
    expect(bank.questionsByService.get('s3')).toEqual([1, 2]);
    expect(bank.questionsByService.get('iam')).toEqual([1]);
  });
});
