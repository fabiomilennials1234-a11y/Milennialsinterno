// Regras puras da conversão de concessão. Extraídas do ConverterConcessaoModal
// porque são matemática de dinheiro (comissão) e o gate do botão de submit —
// vale testar isoladas, sem montar o componente.

/** Taxa de comissão automática aplicada ao valor mensal acordado. */
export const COMMISSION_RATE = 0.07;

/**
 * Comissão automática sobre o valor mensal. Valores <= 0 ou não-numéricos → 0
 * (sem preview até o usuário informar valor válido).
 */
export function commissionPreview(monthlyValue: number): number {
  if (!Number.isFinite(monthlyValue) || monthlyValue <= 0) return 0;
  return monthlyValue * COMMISSION_RATE;
}

/**
 * O valor mensal informado é inválido? Só consideramos inválido quando o usuário
 * JÁ digitou algo (raw não-vazio) mas o número é <= 0. Campo vazio não é "erro" —
 * é estado inicial (o botão fica desabilitado por outro caminho).
 */
export function isMonthlyValueInvalid(raw: string): boolean {
  return raw !== '' && Number(raw) <= 0;
}

/**
 * Pode submeter a conversão? Exige valor mensal > 0 e um CS selecionado.
 */
export function canSubmitConversion(raw: string, csUserId: string): boolean {
  return raw !== '' && Number(raw) > 0 && csUserId !== '';
}
