// FIXTURE de teste do eslint-boundaries (#76 / ADR 0004).
// Este import FURA o barrel do módulo `cliente` (importa internals direto).
// O eslint-plugin-boundaries DEVE marcar este import como erro.
// O script `test:boundaries` inverte o exit code: ESPERA o erro.
// Não é código de produção.
import { clienteExiste } from "../cliente/lib/existe";

export const _fixture = clienteExiste;
