import { withRetry } from './retry';
import type { ChatOptions } from './types';

/** Số lượt mô hình được gọi tool trong một tin nhắn, quá thì dừng để không lặp vô hạn. */
export const MAX_TOOL_ROUNDS = 3;

export interface FunctionCallLike {
  name: string;
  args: Record<string, unknown>;
}

/** Lượt gửi cho mô hình: tin nhắn chữ, hoặc kết quả các function call của lượt trước. */
export type ToolTurn = string | { name: string; response: object }[];

export interface TurnResult {
  chunks: AsyncIterable<string>;
  /** Gọi sau khi đã đọc hết chunks. */
  calls(): Promise<FunctionCallLike[]>;
}

/**
 * Vòng function calling (SDK không tự chạy hàm): gửi → stream chữ → có function call thì chạy tool
 * rồi gửi kết quả → … cho tới khi mô hình trả lời không kèm function call.
 */
export async function* toolLoop(send: (turn: ToolTurn) => Promise<TurnResult>, text: string, options: ChatOptions = {}): AsyncIterable<string> {
  let turn: ToolTurn = text;
  for (let round = 0; ; round++) {
    // Lỗi hết lượt/quá tải xảy ra lúc gửi (chưa có chữ nào): chờ rồi gửi lại đúng lượt này.
    const current = turn;
    const result = await withRetry(() => send(current), options.retry);
    for await (const chunk of result.chunks) if (chunk) yield chunk;
    const calls = await result.calls();
    if (calls.length === 0) return;
    if (round >= MAX_TOOL_ROUNDS) throw new Error('too many tool calls');
    const responses: { name: string; response: object }[] = [];
    for (const call of calls) {
      options.onToolCall?.(call.name);
      const tool = options.tools?.find((t) => t.name === call.name);
      responses.push({ name: call.name, response: tool ? await tool.run(call.args) : { error: 'unknown tool' } });
    }
    turn = responses;
  }
}
