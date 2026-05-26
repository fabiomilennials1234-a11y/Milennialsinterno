import { describe, it, expect } from 'vitest';

/**
 * Tests for the useClientInfoBankFiles module's public interface.
 * Verifies module exports, constants, and query key structure.
 * Hooks themselves wrap supabase calls — integration-tested via pgTAP.
 */

describe('useClientInfoBankFiles module exports', () => {
  it('exports useClientInfoBankFiles function', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(typeof mod.useClientInfoBankFiles).toBe('function');
  });

  it('exports useUploadInfoBankFile function', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(typeof mod.useUploadInfoBankFile).toBe('function');
  });

  it('exports useInfoBankFileSignedUrl function', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(typeof mod.useInfoBankFileSignedUrl).toBe('function');
  });

  it('BUCKET constant is client-info-bank-files', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(mod.INFO_BANK_FILES_BUCKET).toBe('client-info-bank-files');
  });

  it('MAX_FILE_SIZE constant is 500MB', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(mod.MAX_FILE_SIZE).toBe(524288000);
  });

  it('FILE_SECTIONS covers all 4 sections with labels', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(mod.FILE_SECTIONS).toBeDefined();
    expect(Array.isArray(mod.FILE_SECTIONS)).toBe(true);
    expect(mod.FILE_SECTIONS.length).toBe(4);

    const keys = mod.FILE_SECTIONS.map((s: { key: string }) => s.key);
    expect(keys).toContain('anuncios');
    expect(keys).toContain('criativos');
    expect(keys).toContain('marca');
    expect(keys).toContain('videos');
  });

  it('infoBankFileKeys.all returns correct key shape', async () => {
    const mod = await import('./useClientInfoBankFiles');
    const key = mod.infoBankFileKeys.all('client-123');
    expect(key).toEqual(['client-info-bank-files', 'client-123']);
  });

  it('infoBankFileKeys.section returns correct key shape with section', async () => {
    const mod = await import('./useClientInfoBankFiles');
    const key = mod.infoBankFileKeys.section('client-123', 'anuncios');
    expect(key).toEqual(['client-info-bank-files', 'client-123', 'anuncios']);
  });

  it('infoBankFileKeys.counts returns correct key shape', async () => {
    const mod = await import('./useClientInfoBankFiles');
    const key = mod.infoBankFileKeys.counts();
    expect(key).toEqual(['client-info-bank-files', 'counts']);
  });

  it('exports useClientInfoBankFileCounts function', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(typeof mod.useClientInfoBankFileCounts).toBe('function');
  });

  it('exports useDeleteInfoBankFile mutation hook', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(typeof mod.useDeleteInfoBankFile).toBe('function');
  });
});

describe('buildFileCountsMap', () => {
  it('returns empty object for empty input', async () => {
    const { buildFileCountsMap } = await import('./useClientInfoBankFiles');
    const result = buildFileCountsMap([]);
    expect(result).toEqual({});
  });

  it('counts files for single client and section', async () => {
    const { buildFileCountsMap } = await import('./useClientInfoBankFiles');
    const rows = [
      { client_id: 'c1', section: 'marca' },
      { client_id: 'c1', section: 'marca' },
      { client_id: 'c1', section: 'marca' },
    ];
    const result = buildFileCountsMap(rows);
    expect(result).toEqual({ c1: { marca: 3 } });
  });

  it('aggregates across multiple clients and sections', async () => {
    const { buildFileCountsMap } = await import('./useClientInfoBankFiles');
    const rows = [
      { client_id: 'c1', section: 'marca' },
      { client_id: 'c1', section: 'marca' },
      { client_id: 'c1', section: 'videos' },
      { client_id: 'c2', section: 'anuncios' },
      { client_id: 'c2', section: 'anuncios' },
      { client_id: 'c2', section: 'criativos' },
      { client_id: 'c3', section: 'marca' },
    ];
    const result = buildFileCountsMap(rows);
    expect(result).toEqual({
      c1: { marca: 2, videos: 1 },
      c2: { anuncios: 2, criativos: 1 },
      c3: { marca: 1 },
    });
  });
});

describe('version history (Issue #46)', () => {
  it('exports useFileVersionHistory function', async () => {
    const mod = await import('./useClientInfoBankFiles');
    expect(typeof mod.useFileVersionHistory).toBe('function');
  });

  it('infoBankFileKeys.history returns correct key shape', async () => {
    const mod = await import('./useClientInfoBankFiles');
    const key = mod.infoBankFileKeys.history('client-123', 'anuncios', 'file.png');
    expect(key).toEqual([
      'client-info-bank-files-history',
      'client-123',
      'anuncios',
      'file.png',
    ]);
  });
});
