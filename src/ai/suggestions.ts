import type { ServiceRef } from '../data/types';

/** Số service tối đa có câu gợi ý "… là gì?" (hàng gợi ý không quá dài). */
export const MAX_SERVICE_SUGGESTIONS = 4;

/**
 * Câu hỏi gợi ý trong khung chat: dịch đề, đề hỏi gì, "<service> là gì?" cho các service của câu
 * (meta soạn sẵn), và gợi ý loại trừ (không nói thẳng đáp án).
 */
export const HIGHLIGHT_SUGGESTION = 'Tô từ khóa quan trọng trong đề';

/** opts.highlight: AI có tool tô (Thi thử đang làm) thì thêm câu nhờ tô từ khóa. */
export function chatSuggestions(serviceIds: string[], services: Map<string, ServiceRef>, opts: { highlight?: boolean } = {}): string[] {
  return [
    'Dịch đề và các lựa chọn sang tiếng Việt',
    'Đề này đang hỏi gì?',
    ...(opts.highlight ? [HIGHLIGHT_SUGGESTION] : []),
    ...serviceIds.slice(0, MAX_SERVICE_SUGGESTIONS).map((id) => `${services.get(id)?.name ?? id} là gì?`),
    'Gợi ý cách loại trừ lựa chọn sai',
  ];
}
