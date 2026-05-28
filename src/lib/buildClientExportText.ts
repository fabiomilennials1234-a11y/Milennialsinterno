import type { ClientInfo, ClientCallForm } from '@/hooks/useClientCallForm';
import { PRODUCT_CONFIG, TORQUE_CRM_SUBPRODUCT_CONFIG } from '@/components/shared/ProductBadges';

interface ClientTagLike {
  name: string;
  expired_at?: string | null;
}

interface ClientLinkLike {
  label: string;
  url: string;
}

export interface ClientExportParams {
  clientInfo: ClientInfo | null;
  callForm: ClientCallForm | null;
  clientTags: ClientTagLike[];
  responsibleNames: Record<string, string>;
  clientLinks: ClientLinkLike[];
}

const LABEL_MAP: Record<string, string> = {
  otimo: 'Ótimo',
  bom: 'Bom',
  medio: 'Médio',
  ruim: 'Ruim',
};

function formatCurrency(value: number | null | undefined): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Append a labeled line only when value is non-empty. */
function line(label: string, value: string | null | undefined): string {
  if (!value || !value.trim()) return '';
  return `- **${label}:** ${value.trim()}\n`;
}

/**
 * Field definitions per block — mirrors ClientCallFormSection BLOCKS.
 * Kept here as a flat map to avoid coupling to the UI component.
 */
const CALL_FORM_FIELDS: { block: string; key: keyof ClientCallForm; label: string }[] = [
  // 01 — Empresa, Produto e Margem
  { block: '01 — Empresa, Produto e Margem', key: 'historia_empresa', label: 'História da Empresa' },
  { block: '01 — Empresa, Produto e Margem', key: 'produto_servico', label: 'Produto/Serviço' },
  { block: '01 — Empresa, Produto e Margem', key: 'beneficios_produto', label: 'Benefícios do Produto' },
  { block: '01 — Empresa, Produto e Margem', key: 'principais_produtos_margem', label: '3 Principais Produtos (Margem)' },
  { block: '01 — Empresa, Produto e Margem', key: 'produto_carro_chefe', label: 'Produto Carro-Chefe' },
  { block: '01 — Empresa, Produto e Margem', key: 'ticket_medio', label: 'Ticket Médio' },
  { block: '01 — Empresa, Produto e Margem', key: 'margem_media', label: 'Margem Média' },
  { block: '01 — Empresa, Produto e Margem', key: 'pedido_minimo', label: 'Pedido Mínimo' },
  { block: '01 — Empresa, Produto e Margem', key: 'condicao_distribuidor_representante', label: 'Condição Distribuidor/Representante' },
  { block: '01 — Empresa, Produto e Margem', key: 'lista_produtos', label: 'Lista de Produtos' },
  // 02 — Cliente Ideal e Mercado
  { block: '02 — Cliente Ideal e Mercado', key: 'cliente_ideal', label: 'Cliente Ideal' },
  { block: '02 — Cliente Ideal e Mercado', key: 'decisor_compra_cliente', label: 'Decisor de Compra' },
  { block: '02 — Cliente Ideal e Mercado', key: 'dor_desejo', label: 'Dor/Desejo do Cliente' },
  { block: '02 — Cliente Ideal e Mercado', key: 'diferencial_vs_concorrencia', label: 'Diferencial vs Concorrência' },
  { block: '02 — Cliente Ideal e Mercado', key: 'maior_dor_empresa', label: 'Maior Dor da Empresa' },
  { block: '02 — Cliente Ideal e Mercado', key: 'concorrente_direto_n1', label: 'Concorrente Direto #1' },
  { block: '02 — Cliente Ideal e Mercado', key: 'feiras_eventos_setor', label: 'Feiras/Eventos do Setor' },
  // 03 — Comercial e Operação
  { block: '03 — Comercial e Operação', key: 'comercial_existente', label: 'Comercial Existente' },
  { block: '03 — Comercial e Operação', key: 'representantes_comerciais_atual', label: 'Representantes Comerciais' },
  { block: '03 — Comercial e Operação', key: 'captar_novos_representantes', label: 'Captar Novos Representantes' },
  { block: '03 — Comercial e Operação', key: 'tempo_ciclo_venda', label: 'Tempo Ciclo de Venda' },
  { block: '03 — Comercial e Operação', key: 'tempo_resposta_lead', label: 'Tempo de Resposta ao Lead' },
  { block: '03 — Comercial e Operação', key: 'origem_clientes_atuais', label: 'Origem dos Clientes Atuais' },
  { block: '03 — Comercial e Operação', key: 'recompra_frequencia', label: 'Recompra/Frequência' },
  { block: '03 — Comercial e Operação', key: 'programa_indicacao', label: 'Programa de Indicação' },
  { block: '03 — Comercial e Operação', key: 'cnpjs_ativos', label: 'CNPJs Ativos na Base' },
  // 04 — Marketing e Presença Digital
  { block: '04 — Marketing e Presença Digital', key: 'historico_marketing', label: 'Histórico de Marketing' },
  { block: '04 — Marketing e Presença Digital', key: 'site', label: 'Site' },
  { block: '04 — Marketing e Presença Digital', key: 'catalogo_fotos_videos', label: 'Catálogo/Fotos/Vídeos' },
  { block: '04 — Marketing e Presença Digital', key: 'restricoes_comunicacao', label: 'Restrições de Comunicação' },
  // 05 — Marketplace
  { block: '05 — Marketplace', key: 'vende_marketplaces', label: 'Vende em Marketplaces' },
  { block: '05 — Marketplace', key: 'marketplaces_ativos', label: 'Marketplaces Ativos' },
  { block: '05 — Marketplace', key: 'faturamento_marketplaces', label: 'Faturamento por Marketplace' },
  // 06 — Foco, Objetivo e Expectativa
  { block: '06 — Foco, Objetivo e Expectativa', key: 'foco_principal_empresa', label: 'Foco Principal' },
  { block: '06 — Foco, Objetivo e Expectativa', key: 'objetivo_contratar_milennials', label: 'Objetivo ao Contratar a Millennials' },
  { block: '06 — Foco, Objetivo e Expectativa', key: 'satisfacao_3_meses', label: 'Satisfação em 3 Meses' },
  { block: '06 — Foco, Objetivo e Expectativa', key: 'expectativas_30d', label: 'Expectativa 30 dias' },
  { block: '06 — Foco, Objetivo e Expectativa', key: 'expectativas_3m', label: 'Expectativa 3 meses' },
  { block: '06 — Foco, Objetivo e Expectativa', key: 'expectativas_6m', label: 'Expectativa 6 meses' },
  { block: '06 — Foco, Objetivo e Expectativa', key: 'expectativas_1a', label: 'Expectativa 1 ano' },
  // 07 — Projeto e Execução
  { block: '07 — Projeto e Execução', key: 'proposito', label: 'Propósito' },
  { block: '07 — Projeto e Execução', key: 'referencias', label: 'Referências' },
  { block: '07 — Projeto e Execução', key: 'localizacao', label: 'Localização' },
  { block: '07 — Projeto e Execução', key: 'ponto_focal_cliente', label: 'Ponto Focal do Cliente' },
  { block: '07 — Projeto e Execução', key: 'acoes_pontuais', label: 'Ações Pontuais' },
  { block: '07 — Projeto e Execução', key: 'investimento', label: 'Investimento em Tráfego' },
];

export function buildClientExportText(params: ClientExportParams): string {
  const { clientInfo, callForm, clientTags, responsibleNames, clientLinks } = params;
  const parts: string[] = [];

  // --- Header ---
  const name = clientInfo?.name || 'Cliente sem nome';
  parts.push(`# ${name}`);
  if (clientInfo?.razao_social) {
    parts.push(`*${clientInfo.razao_social}*`);
  }
  parts.push('');

  // --- Dados da Empresa ---
  const empresaLines = [
    line('CNPJ', clientInfo?.cnpj),
    line('Nicho', clientInfo?.niche),
    line('Investimento Previsto', formatCurrency(clientInfo?.expected_investment)),
    line('Informações Gerais', clientInfo?.general_info),
  ].filter(Boolean);

  if (empresaLines.length > 0) {
    parts.push('## Dados da Empresa');
    parts.push(empresaLines.join(''));
  }

  // --- Produtos Contratados ---
  const products = clientInfo?.contracted_products;
  if (products && products.length > 0) {
    parts.push('## Produtos Contratados');
    for (const slug of products) {
      const productName = PRODUCT_CONFIG[slug]?.name || slug;
      let responsibleSuffix = '';

      if (slug === 'millennials-growth' && clientInfo?.assigned_ads_manager) {
        const gestorName = responsibleNames[clientInfo.assigned_ads_manager];
        if (gestorName) responsibleSuffix = ` (Gestor: ${gestorName})`;
      }
      if ((slug === 'millennials-paddock' || slug === 'millennials-growth') && clientInfo?.assigned_comercial) {
        const treinadorName = responsibleNames[clientInfo.assigned_comercial];
        if (treinadorName && slug === 'millennials-paddock') {
          responsibleSuffix = ` (Treinador: ${treinadorName})`;
        }
      }
      if (slug === 'gestor-mktplace' && clientInfo?.assigned_mktplace) {
        const mktplaceName = responsibleNames[clientInfo.assigned_mktplace];
        if (mktplaceName) responsibleSuffix = ` (Consultor: ${mktplaceName})`;
      }

      parts.push(`- ${productName}${responsibleSuffix}`);
    }

    // Torque CRM sub-products
    const torqueProducts = clientInfo?.torque_crm_products;
    if (torqueProducts && torqueProducts.length > 0) {
      const subNames = torqueProducts
        .map(s => TORQUE_CRM_SUBPRODUCT_CONFIG[s]?.name || s)
        .join(', ');
      parts.push(`- Torque CRM Produtos: ${subNames}`);
    }
    parts.push('');
  }

  // --- Etiqueta ---
  if (clientInfo?.client_label) {
    parts.push('## Etiqueta');
    parts.push(`${LABEL_MAP[clientInfo.client_label] || clientInfo.client_label}`);
    parts.push('');
  }

  // --- Tags Ativas ---
  const activeTags = clientTags.filter(t => !t.expired_at);
  if (activeTags.length > 0) {
    parts.push('## Tags Ativas');
    for (const tag of activeTags) {
      parts.push(`- ${tag.name}`);
    }
    parts.push('');
  }

  // --- Links ---
  if (clientLinks.length > 0) {
    parts.push('## Links');
    for (const link of clientLinks) {
      parts.push(`- [${link.label}](${link.url})`);
    }
    parts.push('');
  }

  // --- Formulário da Call (blocos 01-07) ---
  if (callForm) {
    let currentBlock = '';

    for (const field of CALL_FORM_FIELDS) {
      const value = callForm[field.key];
      if (!value || (typeof value === 'string' && !value.trim())) continue;

      if (field.block !== currentBlock) {
        currentBlock = field.block;
        parts.push(`## ${currentBlock}`);
      }

      parts.push(`- **${field.label}:** ${String(value).trim()}`);
    }
    parts.push('');
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
