import type { AiTool } from './types';

export const OPEN_GUIDE_TOOL = 'open_guide';

/** Tool để Gemini mở hướng dẫn (đáp án + giải thích) khi người học xin đáp án; như bấm nút hướng dẫn. */
export function createGuideTool(open: () => void): AiTool {
  return {
    name: OPEN_GUIDE_TOOL,
    description: 'Mở phần hướng dẫn (đáp án đúng và giải thích) cho người học. Chỉ gọi khi người học xin đáp án.',
    params: {},
    run() {
      open();
      return { opened: true };
    },
  };
}
