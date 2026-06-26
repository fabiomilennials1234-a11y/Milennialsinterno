import { describe, it, expect } from 'vitest';
import { validateKeyPrefix, KEY_PREFIX_PATTERN } from './projectKeyPrefix';

describe('validateKeyPrefix', () => {
  it('accepts a valid 3-letter prefix', () => {
    expect(validateKeyPrefix('AGS', [])).toBeNull();
  });

  it('accepts the 2-char lower bound', () => {
    expect(validateKeyPrefix('AB', [])).toBeNull();
  });

  it('accepts the 6-char upper bound', () => {
    expect(validateKeyPrefix('ABCDEF', [])).toBeNull();
  });

  it('accepts digits after the leading letter', () => {
    expect(validateKeyPrefix('A1', [])).toBeNull();
    expect(validateKeyPrefix('WEB2', [])).toBeNull();
  });

  it('rejects empty / whitespace as "empty"', () => {
    expect(validateKeyPrefix('', [])).toBe('empty');
    expect(validateKeyPrefix('   ', [])).toBe('empty');
  });

  it('rejects a single char as "format" (below 2-char floor)', () => {
    expect(validateKeyPrefix('A', [])).toBe('format');
  });

  it('rejects 7 chars as "format" (above 6-char ceiling)', () => {
    expect(validateKeyPrefix('ABCDEFG', [])).toBe('format');
  });

  it('rejects lowercase as "format" (validator does not uppercase)', () => {
    expect(validateKeyPrefix('ags', [])).toBe('format');
  });

  it('rejects a leading digit as "format"', () => {
    expect(validateKeyPrefix('1AB', [])).toBe('format');
  });

  it('rejects invalid characters as "format"', () => {
    expect(validateKeyPrefix('A-B', [])).toBe('format');
    expect(validateKeyPrefix('A B', [])).toBe('format');
    expect(validateKeyPrefix('A_B', [])).toBe('format');
  });

  it('rejects a duplicate against existing prefixes', () => {
    expect(validateKeyPrefix('AGS', ['AGS', 'WEB'])).toBe('duplicate');
  });

  it('duplicate check is case-insensitive on stored prefixes', () => {
    expect(validateKeyPrefix('AGS', ['ags'])).toBe('duplicate');
  });

  it('format failure wins over duplicate (bad input is never a dup)', () => {
    expect(validateKeyPrefix('ags', ['ags'])).toBe('format');
  });

  it('exposes the canonical pattern', () => {
    expect(KEY_PREFIX_PATTERN.test('AGS')).toBe(true);
    expect(KEY_PREFIX_PATTERN.test('ags')).toBe(false);
  });
});
