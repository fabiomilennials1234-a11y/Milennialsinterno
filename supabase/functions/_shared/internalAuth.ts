// Shared auth gate for the recording pipeline functions (transcribe-meeting,
// generate-meeting-ata, reconcile-recordings).
//
// These functions run with `verify_jwt = false` (see config.toml) because the
// internal/durable caller (reconcile-recordings cron) authenticates with the
// service-role SECRET key (`sb_secret_...`), which is NOT a JWT and is rejected
// by the gateway when verify_jwt is on (issue #70 gate-2 incident). With the
// gateway check disabled we MUST do all auth in code.
//
// Two accepted credentials:
//   1. A valid end-user JWT (validated via auth.getUser against the anon key).
//   2. The trusted internal caller, presenting the service-role key. We accept
//      BOTH the new secret format (`sb_secret_...`) and the legacy service-role
//      JWT, so a key rotation in either direction cannot silently break the
//      durability path again.

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Constant-time string compare to avoid leaking the secret via timing.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// True when the presented token is the trusted internal service-role caller.
// `legacyServiceJwt` is optional — pass the legacy SUPABASE_SERVICE_ROLE_KEY
// JWT if you still have it in the environment for transitional safety.
export function isServiceRoleCaller(
  token: string | null,
  serviceRoleKey: string,
  legacyServiceJwt?: string | null,
): boolean {
  if (!token) return false;
  if (serviceRoleKey && timingSafeEqual(token, serviceRoleKey)) return true;
  if (legacyServiceJwt && timingSafeEqual(token, legacyServiceJwt)) return true;
  return false;
}
