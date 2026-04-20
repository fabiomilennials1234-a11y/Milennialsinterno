// CORS helper with origin allowlist.
//
// Configure allowed origins via the ALLOWED_ORIGINS edge-function secret
// (comma-separated list). Example:
//
//   supabase secrets set ALLOWED_ORIGINS="https://app.milennials.com.br,https://staging.milennials.com.br,http://localhost:5173"
//
// If ALLOWED_ORIGINS is unset, falls back to local dev origins only —
// production requests will be rejected until you configure the secret.

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw) return DEFAULT_ORIGINS
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
}

const BASE_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = getAllowedOrigins()
  if (origin && allowed.includes(origin)) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }
  // No matching origin: omit Allow-Origin so the browser blocks the response.
  return { ...BASE_HEADERS }
}

// Backward-compat: legacy call sites that import `corsHeaders` directly.
// Prefer buildCorsHeaders(req) in new code — it returns per-request headers.
export const corsHeaders = {
  ...BASE_HEADERS,
  'Access-Control-Allow-Origin': DEFAULT_ORIGINS[0],
}
