const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  if (origin) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }
  return { ...BASE_HEADERS }
}

export const corsHeaders = {
  ...BASE_HEADERS,
  'Access-Control-Allow-Origin': '*',
}
