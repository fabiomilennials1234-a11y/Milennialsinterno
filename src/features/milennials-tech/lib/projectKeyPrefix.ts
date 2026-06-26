// Pure mirror of the server contract for a project's issue-key prefix.
// The server (unique index on tech_projects.key_prefix) is the authority; this
// only sharpens UX so a user sees the problem before the round-trip.

/** 2-6 chars, must start with a letter, then letters or digits. Uppercase only. */
export const KEY_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

export type KeyPrefixError = 'empty' | 'format' | 'duplicate' | null;

/**
 * Validate a key prefix for format and uniqueness.
 * Does NOT uppercase — a lowercase value is a format error (the form uppercases
 * on input; this stays a faithful mirror of what the server stores).
 */
export function validateKeyPrefix(value: string, existingPrefixes: string[]): KeyPrefixError {
  const trimmed = value.trim();
  if (!trimmed) return 'empty';
  if (!KEY_PREFIX_PATTERN.test(trimmed)) return 'format';

  const upper = trimmed.toUpperCase();
  if (existingPrefixes.some((p) => p.toUpperCase() === upper)) return 'duplicate';

  return null;
}
