import { makeQuestion } from '../test/fixtures';
import { SERVICE_STATUS, serviceStatusFor } from './service-status';

describe('serviceStatusFor', () => {
  it('nhận dịch vụ đổi tên hoặc đã ngừng trong đề và lựa chọn', () => {
    const q = {
      ...makeQuestion(1),
      stem: 'Logs go to Amazon Elasticsearch Service.',
      options: [
        { key: 'A', text: 'Use AWS Snowball Edge.' },
        { key: 'B', text: 'Use Amazon Kinesis Data Firehose.' },
      ],
    };
    expect(serviceStatusFor(q).map((s) => s.id)).toEqual(['opensearch', 'data-firehose', 'snowball']);
  });

  it('không nhận nhầm Backup vault lock là Glacier vault', () => {
    const q = { ...makeQuestion(1), stem: 'Use AWS Backup to create a backup vault that has a vault lock.' };
    expect(serviceStatusFor(q)).toEqual([]);
  });

  it('id không trùng và ghi chú không nhắc lựa chọn bằng chữ cái', () => {
    expect(new Set(SERVICE_STATUS.map((s) => s.id)).size).toBe(SERVICE_STATUS.length);
    for (const s of SERVICE_STATUS) expect(s.note).not.toMatch(/\b(đáp án|phương án|lựa chọn) [A-F]\b/);
  });
});
