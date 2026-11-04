import { describe, expect, it, vi } from 'vitest';
import { OPEN_GUIDE_TOOL, createGuideTool } from './guide-tool';

describe('createGuideTool', () => {
  it('chạy thì mở hướng dẫn và báo đã mở', async () => {
    const open = vi.fn();
    const tool = createGuideTool(open);
    expect(tool.name).toBe(OPEN_GUIDE_TOOL);
    expect(tool.params).toEqual({});
    expect(await tool.run({})).toEqual({ opened: true });
    expect(open).toHaveBeenCalledTimes(1);
  });
});
