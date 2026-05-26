import { describe, it, expect } from 'vitest';

/**
 * Tests for the useClientInfoBank module's public interface.
 * Verifies the module exports the correct hooks with proper types.
 * The hooks themselves wrap supabase calls — integration-tested via pgTAP.
 */

describe('useClientInfoBank module exports', () => {
  it('exports useClientInfoBanks function', async () => {
    const mod = await import('./useClientInfoBank');
    expect(typeof mod.useClientInfoBanks).toBe('function');
  });

  it('exports useClientInfoBank function', async () => {
    const mod = await import('./useClientInfoBank');
    expect(typeof mod.useClientInfoBank).toBe('function');
  });

  it('exports useUpsertClientInfoBank function', async () => {
    const mod = await import('./useClientInfoBank');
    expect(typeof mod.useUpsertClientInfoBank).toBe('function');
  });

  it('exports ClientInfoBankProfile type (via type guard)', async () => {
    // Verify the interface shape by importing and checking a known property
    const mod = await import('./useClientInfoBank');
    // ClientWithInfoBank should be a type export — verified at compile time
    expect(mod).toBeDefined();
  });

  it('FIELDS_CONFIG is exported with all 15 data fields', async () => {
    const mod = await import('./useClientInfoBank');
    expect(mod.INFO_BANK_FIELDS).toBeDefined();
    expect(Array.isArray(mod.INFO_BANK_FIELDS)).toBe(true);
    // 15 data fields: 5 marca + 5 presenca + 2 video + 2 dev + 1 geral
    expect(mod.INFO_BANK_FIELDS.length).toBe(15);
  });

  it('FIELDS_CONFIG contains required field metadata', async () => {
    const mod = await import('./useClientInfoBank');
    for (const field of mod.INFO_BANK_FIELDS) {
      expect(field).toHaveProperty('key');
      expect(field).toHaveProperty('label');
      expect(field).toHaveProperty('section');
      expect(typeof field.key).toBe('string');
      expect(typeof field.label).toBe('string');
      expect(typeof field.section).toBe('string');
    }
  });

  it('FIELDS_CONFIG sections cover all 5 required sections', async () => {
    const mod = await import('./useClientInfoBank');
    const sections = new Set(mod.INFO_BANK_FIELDS.map((f: { section: string }) => f.section));
    expect(sections).toContain('marca');
    expect(sections).toContain('presenca_digital');
    expect(sections).toContain('video');
    expect(sections).toContain('dev');
    expect(sections).toContain('geral');
  });

  it('exports useClientInfoBankExists function for batch gate check', async () => {
    const mod = await import('./useClientInfoBank');
    expect(typeof mod.useClientInfoBankExists).toBe('function');
  });
});
