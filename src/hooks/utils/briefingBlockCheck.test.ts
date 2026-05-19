import { describe, it, expect, vi } from 'vitest';
import { isClientBlockedByBriefing } from './briefingBlockCheck';

function mockSupabase(tagRows: { id: string }[]) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: tagRows, error: null }),
            }),
          }),
        }),
      }),
    }),
  } as any;
}

describe('isClientBlockedByBriefing', () => {
  it('returns true when active Esperar Briefing tag exists', async () => {
    const sb = mockSupabase([{ id: 'tag-1' }]);
    expect(await isClientBlockedByBriefing(sb, 'client-1')).toBe(true);
  });

  it('returns false when no tag exists', async () => {
    const sb = mockSupabase([]);
    expect(await isClientBlockedByBriefing(sb, 'client-1')).toBe(false);
  });

  it('returns false when data is null', async () => {
    const sb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any;
    expect(await isClientBlockedByBriefing(sb, 'client-1')).toBe(false);
  });
});
