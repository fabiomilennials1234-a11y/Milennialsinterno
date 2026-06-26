import { describe, it, expect } from 'vitest';
import {
  isDuplicateKeyPrefixError,
  translateProjectCreateError,
  DUPLICATE_KEY_PREFIX_MESSAGE,
} from './projectCreateError';

describe('isDuplicateKeyPrefixError', () => {
  it('detects a Postgres unique violation by code 23505', () => {
    expect(isDuplicateKeyPrefixError({ code: '23505', message: 'duplicate key' })).toBe(true);
  });

  it('ignores other Postgres error codes', () => {
    expect(isDuplicateKeyPrefixError({ code: '42501', message: 'not authorized' })).toBe(false);
    expect(isDuplicateKeyPrefixError({ code: '23503', message: 'fk violation' })).toBe(false);
  });

  it('is safe against null / undefined / non-objects', () => {
    expect(isDuplicateKeyPrefixError(null)).toBe(false);
    expect(isDuplicateKeyPrefixError(undefined)).toBe(false);
    expect(isDuplicateKeyPrefixError('boom')).toBe(false);
    expect(isDuplicateKeyPrefixError({})).toBe(false);
  });
});

describe('translateProjectCreateError', () => {
  it('maps a 23505 to the duplicate-key message', () => {
    expect(translateProjectCreateError({ code: '23505', message: 'x' })).toBe(
      DUPLICATE_KEY_PREFIX_MESSAGE,
    );
  });

  it('maps the staff gate (42501) to an authorization message', () => {
    const msg = translateProjectCreateError({ code: '42501', message: 'not authorized' });
    expect(msg).toMatch(/permiss|autoriza/i);
  });

  it('falls back to the raw message for unknown errors', () => {
    expect(translateProjectCreateError({ message: 'something odd' })).toBe('something odd');
  });

  it('falls back to a generic message when there is no message', () => {
    expect(translateProjectCreateError(null)).toMatch(/erro/i);
    expect(translateProjectCreateError({})).toMatch(/erro/i);
  });
});
