/**
 * Supabase PostgrestError is a plain object { message, code, details, hint },
 * NOT an Error instance. `String(error)` produces "[object Object]" and
 * `instanceof Error` returns false. These helpers bridge the gap.
 */

interface PostgrestLikeError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function isPostgrestLikeError(value: unknown): value is PostgrestLikeError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as PostgrestLikeError).message === 'string'
  );
}

/**
 * Wrap a Supabase RPC error into a proper Error instance.
 * Preserves code/details/hint as enumerable properties for debugging.
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (isPostgrestLikeError(err)) {
    const wrapped = new Error(err.message);
    if (err.code) (wrapped as Error & { code?: string }).code = err.code;
    if (err.details) (wrapped as Error & { details?: string }).details = err.details;
    if (err.hint) (wrapped as Error & { hint?: string }).hint = err.hint;
    return wrapped;
  }
  return new Error(String(err));
}

/**
 * Extract a human-readable message from any thrown value.
 * Works with Error instances, Supabase PostgrestError objects, and primitives.
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (isPostgrestLikeError(err)) return err.message;
  return String(err);
}
