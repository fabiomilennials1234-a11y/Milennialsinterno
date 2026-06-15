import { describe, it, expect } from 'vitest';
import { resolveDefaultAccountId, type MetaAdAccount } from '../useMetaAdsAccounts';

function acc(over: Partial<MetaAdAccount>): MetaAdAccount {
  return {
    id: crypto.randomUUID(),
    account_id: 'act_x',
    account_name: 'X',
    client_id: null,
    is_active: true,
    sync_policy: 'on_demand',
    is_principal: false,
    ...over,
  };
}

describe('resolveDefaultAccountId — principal is the UI default', () => {
  it('returns the principal account_id when one exists', () => {
    const accounts = [
      acc({ account_id: 'act_client_1' }),
      acc({ account_id: 'act_milennials', is_principal: true, sync_policy: 'cron' }),
      acc({ account_id: 'act_client_2' }),
    ];
    expect(resolveDefaultAccountId(accounts)).toBe('act_milennials');
  });

  it("falls back to 'all' when no principal exists", () => {
    const accounts = [acc({ account_id: 'act_a' }), acc({ account_id: 'act_b' })];
    expect(resolveDefaultAccountId(accounts)).toBe('all');
  });

  it("returns 'all' for an empty account list", () => {
    expect(resolveDefaultAccountId([])).toBe('all');
  });

  it('returns the first principal if (impossibly) two are flagged — deterministic, never 0', () => {
    // The DB unique partial index forbids two principals; this guards the client
    // against a transient/duplicated cache state by staying deterministic.
    const accounts = [
      acc({ account_id: 'act_first', is_principal: true }),
      acc({ account_id: 'act_second', is_principal: true }),
    ];
    expect(resolveDefaultAccountId(accounts)).toBe('act_first');
  });
});
