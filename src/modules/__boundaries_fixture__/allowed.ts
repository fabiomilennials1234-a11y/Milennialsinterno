// FIXTURE de teste do eslint-boundaries (#76 / ADR 0004).
// Import LEGÍTIMO: atravessa o módulo `cliente` PELO barrel (index.ts).
// O eslint-plugin-boundaries DEVE permitir (sem erro). É o contra-exemplo do
// `violation.ts` — prova que a regra não é overzealous.
import { clienteExiste } from "../cliente";

export const _allowed = clienteExiste;
