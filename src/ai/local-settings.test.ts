import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCAL_SETTINGS, LOCAL_NUMBER_PARAMS, parseLocalSettings, parseNumberField, samplingBody } from './local-settings';

const param = (key: string) => LOCAL_NUMBER_PARAMS.find((p) => p.key === key)!;

describe('parseNumberField', () => {
  it('nhận số trong khoảng, cả dấu phẩy thập phân', () => {
    expect(parseNumberField(param('temperature'), '0.7')).toEqual({ value: 0.7 });
    expect(parseNumberField(param('temperature'), ' 1,5 ')).toEqual({ value: 1.5 });
    expect(parseNumberField(param('presence_penalty'), '-2')).toEqual({ value: -2 });
  });

  it('báo lỗi khi ngoài khoảng, không phải số hoặc bỏ trống ô bắt buộc', () => {
    expect(parseNumberField(param('temperature'), '2.1')).toEqual({ error: 'Phải là số từ 0 đến 2.' });
    expect(parseNumberField(param('temperature'), 'abc')).toEqual({ error: 'Phải là số từ 0 đến 2.' });
    expect(parseNumberField(param('temperature'), '')).toEqual({ error: 'Không được để trống.' });
    expect(parseNumberField(param('min_p'), '-0.1')).toEqual({ error: 'Phải là số từ 0 đến 1.' });
  });

  it('top_p phải lớn hơn 0', () => {
    expect(parseNumberField(param('top_p'), '0')).toEqual({ error: 'Phải là số lớn hơn 0, tối đa 1.' });
    expect(parseNumberField(param('top_p'), '1')).toEqual({ value: 1 });
  });

  it('top_k và max_tokens phải là số nguyên', () => {
    expect(parseNumberField(param('top_k'), '20.5')).toEqual({ error: 'Phải là số nguyên từ 0 đến 1000.' });
    expect(parseNumberField(param('top_k'), '0')).toEqual({ value: 0 });
    expect(parseNumberField(param('max_tokens'), '0')).toEqual({ error: 'Phải là số nguyên từ 1 đến 32768.' });
  });

  it('max_tokens để trống là không giới hạn', () => {
    expect(parseNumberField(param('max_tokens'), '  ')).toEqual({ value: null });
  });
});

describe('parseLocalSettings', () => {
  it('chưa có dữ liệu thì dùng mặc định', () => {
    expect(parseLocalSettings(null)).toEqual(DEFAULT_LOCAL_SETTINGS);
  });

  it('giữ giá trị hợp lệ, trường hỏng hoặc thiếu thì về mặc định', () => {
    expect(parseLocalSettings({ temperature: 1.2, top_k: 'x', top_p: 5, max_tokens: 512, stream: false, webSearch: 'yes' })).toEqual({
      ...DEFAULT_LOCAL_SETTINGS,
      temperature: 1.2,
      max_tokens: 512,
      stream: false,
    });
  });
});

describe('samplingBody', () => {
  it('gửi đủ tham số; max_tokens trống thì không gửi', () => {
    expect(samplingBody(DEFAULT_LOCAL_SETTINGS)).toEqual({ temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0, presence_penalty: 0 });
    expect(samplingBody({ ...DEFAULT_LOCAL_SETTINGS, max_tokens: 256 })).toMatchObject({ max_tokens: 256 });
  });
});
