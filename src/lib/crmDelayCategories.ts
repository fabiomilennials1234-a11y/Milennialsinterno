export const DELAY_CATEGORIES = [
  { value: 'cliente_nao_respondeu', label: 'Cliente nao respondeu' },
  { value: 'problema_tecnico', label: 'Problema tecnico interno' },
  { value: 'dependencia_outra_area', label: 'Dependencia de outra area' },
  { value: 'reagendamento_cliente', label: 'Reagendamento do cliente' },
  { value: 'equipe_insuficiente', label: 'Equipe insuficiente' },
  { value: 'outro', label: 'Outro' },
] as const;

export type DelayCategory = typeof DELAY_CATEGORIES[number]['value'];
