// Translation of tech_project_create RPC failures into user-facing copy.
// Pure + framework-free so the mapping is unit-testable without React/Supabase.

export const DUPLICATE_KEY_PREFIX_MESSAGE = 'Ja existe um projeto com essa chave. Escolha outra.';
const NOT_AUTHORIZED_MESSAGE = 'Voce nao tem permissao para criar projetos no Tech.';
const GENERIC_MESSAGE = 'Erro ao criar projeto.';

function errorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function errorMessage(error: unknown): string | null {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : null;
  }
  return null;
}

/** True when the failure is the unique-index collision on key_prefix (23505). */
export function isDuplicateKeyPrefixError(error: unknown): boolean {
  return errorCode(error) === '23505';
}

/** Map an RPC error to a stable, user-facing message. */
export function translateProjectCreateError(error: unknown): string {
  switch (errorCode(error)) {
    case '23505':
      return DUPLICATE_KEY_PREFIX_MESSAGE;
    case '42501': // tech_assert_staff: not authorized
    case '28000': // tech_assert_staff: auth required
      return NOT_AUTHORIZED_MESSAGE;
    default:
      return errorMessage(error) ?? GENERIC_MESSAGE;
  }
}
