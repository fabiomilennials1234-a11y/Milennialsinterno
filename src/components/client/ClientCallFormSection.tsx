import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';
import { ClientCallForm } from '@/hooks/useClientCallForm';

type FormDraft = Partial<ClientCallForm> & { strategy_link?: string };

type FieldType = 'input' | 'textarea';

interface FieldDef {
  key: keyof ClientCallForm;
  label: string;
  hint?: string;
  placeholder?: string;
  type: FieldType;
  minHeight?: number;
}

interface BlockDef {
  id: string;
  number: string;
  shortTitle: string;
  title: string;
  description: string;
  fields?: FieldDef[];
  customSlot?: 'expectativas-grid';
}

const BLOCKS: BlockDef[] = [
  {
    id: 'bloco-1',
    number: '01',
    shortTitle: 'Empresa',
    title: 'Empresa, Produto e Margem',
    description: 'Quem é a empresa, o que ela vende e onde está a margem.',
    fields: [
      {
        key: 'historia_empresa',
        label: 'Qual a História da Empresa?',
        hint: 'Como começou, anos de mercado e momento atual.',
        placeholder: 'Conte a história da empresa do cliente…',
        type: 'textarea',
        minHeight: 100,
      },
      {
        key: 'produto_servico',
        label: 'Qual o Produto/Serviço?',
        hint: 'Visão geral.',
        placeholder: 'Descreva os produtos ou serviços…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'principais_produtos_margem',
        label: 'Quais são os 3 principais produtos ou serviços?',
        hint: 'E qual deles tem maior margem.',
        placeholder: 'Liste os 3 principais e indique o de maior margem…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'produto_carro_chefe',
        label: 'Existe algum produto "carro chefe" ou produto de entrada para novos clientes?',
        placeholder: 'Descreva o carro chefe ou produto de entrada…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'ticket_medio',
        label: 'Qual o ticket médio de venda?',
        placeholder: 'Ex: R$ 1.500',
        type: 'input',
      },
      {
        key: 'margem_media',
        label: 'Qual a margem média por venda?',
        hint: '% ou faixa.',
        placeholder: 'Ex: 35% — 45%',
        type: 'input',
      },
      {
        key: 'pedido_minimo',
        label: 'Qual o pedido mínimo?',
        hint: 'Valor ou quantidade mínima.',
        placeholder: 'Ex: R$ 500 ou 10 unidades',
        type: 'input',
      },
      {
        key: 'condicao_distribuidor_representante',
        label: 'Tem condição comercial diferenciada para distribuidor ou representante?',
        placeholder: 'Descreva a condição diferenciada, se houver…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'lista_produtos',
        label: 'Pediu a lista de produtos?',
        hint: 'Se não, porquê?',
        placeholder: 'Sim/Não e justificativa…',
        type: 'input',
      },
    ],
  },
  {
    id: 'bloco-2',
    number: '02',
    shortTitle: 'Cliente',
    title: 'Cliente Ideal e Mercado',
    description: 'Quem compra, por que compra e contra quem vocês competem.',
    fields: [
      {
        key: 'cliente_ideal',
        label: 'Qual o Cliente Ideal?',
        hint: 'Porte, segmento, ticket médio do cliente.',
        placeholder: 'Descreva o cliente ideal…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'decisor_compra_cliente',
        label: 'Quem é o decisor da compra na empresa cliente?',
        hint: 'Dono, comprador, gestor de área.',
        placeholder: 'Ex: Dono / comprador da empresa cliente',
        type: 'input',
      },
      {
        key: 'dor_desejo',
        label: 'Qual a Dor ou Desejo do cliente final?',
        placeholder: 'Quais são as dores ou desejos do cliente…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'diferencial_vs_concorrencia',
        label: 'Por que um cliente escolhe comprar com vocês e não com a concorrência?',
        placeholder: 'O que diferencia a empresa do mercado…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'maior_dor_empresa',
        label: 'Qual a maior dor da empresa hoje?',
        hint: 'Operacional, comercial, financeira, equipe.',
        placeholder: 'Descreva a maior dor da empresa…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'concorrente_direto_n1',
        label: 'Quem é o concorrente direto número 1 e o que ele faz melhor que vocês?',
        placeholder: 'Concorrente principal e diferenciais dele…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'feiras_eventos_setor',
        label: 'A empresa participa de feiras ou eventos do setor? Quais?',
        placeholder: 'Liste feiras e eventos…',
        type: 'input',
      },
    ],
  },
  {
    id: 'bloco-3',
    number: '03',
    shortTitle: 'Comercial',
    title: 'Comercial e Operação',
    description: 'Como o comercial roda hoje, ciclo de venda, recompra e capilaridade.',
    fields: [
      {
        key: 'comercial_existente',
        label: 'Já tem Comercial?',
        hint: 'Quantos vendedores, processo, CRM, follow up.',
        placeholder: 'Situação comercial atual…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'representantes_comerciais_atual',
        label: 'A operação trabalha com representantes comerciais hoje?',
        hint: 'Quantos, pagamento, regiões.',
        placeholder: 'Descreva o modelo atual de representantes…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'captar_novos_representantes',
        label: 'Faz sentido captar novos representantes para escalar?',
        hint: 'Perfil ideal e regiões.',
        placeholder: 'Perfil ideal e regiões prioritárias…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'tempo_ciclo_venda',
        label: 'Qual o tempo médio do ciclo de venda?',
        hint: 'Do primeiro contato ao fechamento.',
        placeholder: 'Ex: 14 dias',
        type: 'input',
      },
      {
        key: 'tempo_resposta_lead',
        label: 'Qual o tempo de resposta ao lead hoje?',
        hint: 'Em minutos, horas ou dias.',
        placeholder: 'Ex: 2 horas',
        type: 'input',
      },
      {
        key: 'origem_clientes_atuais',
        label: 'De onde vem a maioria dos clientes atuais?',
        hint: 'Indicação, feira, site, frio, recompra.',
        placeholder: 'Descreva as principais fontes…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'recompra_frequencia',
        label: 'O cliente costuma comprar uma vez só ou tem recompra? Qual a frequência?',
        placeholder: 'Ex: Recompra mensal / trimestral',
        type: 'input',
      },
      {
        key: 'programa_indicacao',
        label: 'Tem programa de indicação ou bonificação para clientes atuais?',
        placeholder: 'Sim/Não e como funciona…',
        type: 'input',
      },
      {
        key: 'cnpjs_ativos',
        label: 'Quantos CNPJs ativos vocês têm na base hoje?',
        placeholder: 'Ex: 1.200',
        type: 'input',
      },
    ],
  },
  {
    id: 'bloco-4',
    number: '04',
    shortTitle: 'Marketing',
    title: 'Marketing e Presença Digital',
    description: 'O que já foi tentado, o que existe de material e o que não pode aparecer.',
    fields: [
      {
        key: 'historico_marketing',
        label: 'Já fez Marketing? Quais melhor funcionaram? Por que parou?',
        placeholder: 'Histórico de marketing…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'site',
        label: 'Tem site?',
        hint: 'URL ou "Não possui".',
        placeholder: 'URL do site ou "Não possui"…',
        type: 'input',
      },
      {
        key: 'catalogo_fotos_videos',
        label: 'Tem catálogo, fotos profissionais e vídeos?',
        hint: 'Se tiverem, após a reunião enviaremos um Drive para subirem todas as fotos, vídeos e materiais. É preciso subir tudo o quanto antes para iniciar a operação.',
        placeholder: 'Descreva o que existe de material…',
        type: 'textarea',
        minHeight: 100,
      },
      {
        key: 'restricoes_comunicacao',
        label: 'Existe alguma restrição de comunicação?',
        hint: 'Coisas que NÃO podem aparecer em anúncio: preço, processo, fotos de fábrica, etc.',
        placeholder: 'Liste restrições, se houver…',
        type: 'textarea',
        minHeight: 80,
      },
    ],
  },
  {
    id: 'bloco-5',
    number: '05',
    shortTitle: 'Marketplace',
    title: 'Marketplace',
    description: 'Presença em marketplaces e faturamento por canal.',
    fields: [
      {
        key: 'vende_marketplaces',
        label: 'A empresa vende ou quer vender em marketplaces hoje?',
        placeholder: 'Sim/Não e contexto…',
        type: 'input',
      },
      {
        key: 'marketplaces_ativos',
        label: 'Em quais marketplaces já vendem?',
        hint: 'ML, Amazon, Magalu, Shopee, B2W, etc.',
        placeholder: 'Liste marketplaces ativos…',
        type: 'input',
      },
      {
        key: 'faturamento_marketplaces',
        label: 'Qual o faturamento mensal por marketplace?',
        placeholder: 'Ex: ML R$ 80k / Amazon R$ 30k…',
        type: 'textarea',
        minHeight: 80,
      },
    ],
  },
  {
    id: 'bloco-6',
    number: '06',
    shortTitle: 'Foco',
    title: 'Foco, Objetivo e Expectativa',
    description: 'O que precisa acontecer para o projeto valer a pena.',
    fields: [
      {
        key: 'foco_principal_empresa',
        label: 'Qual o foco principal da empresa hoje?',
        hint: 'Captar novos, vender mais para a base, lançar produto, expandir região.',
        placeholder: 'Descreva o foco principal…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'objetivo_contratar_milennials',
        label: 'Qual o objetivo principal ao contratar a Milennials?',
        hint: 'O que precisa acontecer para o projeto valer a pena.',
        placeholder: 'Descreva o objetivo principal…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'satisfacao_3_meses',
        label: 'Além do aumento em vendas, o que deixaria você muito satisfeito em 3 meses de projeto?',
        hint: 'Processo organizado, time treinado, CRM rodando, presença digital.',
        placeholder: 'O que mais geraria satisfação aos 3 meses…',
        type: 'textarea',
        minHeight: 80,
      },
    ],
    customSlot: 'expectativas-grid',
  },
  {
    id: 'bloco-7',
    number: '07',
    shortTitle: 'Projeto',
    title: 'Projeto e Execução',
    description: 'Propósito, referências, ponto focal e investimento.',
    fields: [
      {
        key: 'proposito',
        label: 'Qual o Propósito?',
        hint: 'Propósito do cliente.',
        placeholder: 'Propósito do cliente…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'referencias',
        label: 'Quais as referências?',
        hint: 'Empresas referência: concorrentes diretos e inspirações de mercado, mesmo que de outro setor.',
        placeholder: 'Liste referências…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'localizacao',
        label: 'Qual a Localização?',
        hint: 'Cidade, Estado e área de atuação: local, regional, nacional, exporta.',
        placeholder: 'Ex: São Paulo/SP — atuação nacional',
        type: 'input',
      },
      {
        key: 'ponto_focal_cliente',
        label: 'Quem será o ponto focal do cliente para o projeto?',
        hint: 'Quem decide, quem aprova material, quem operacionaliza.',
        placeholder: 'Nome, função e responsabilidades…',
        type: 'textarea',
        minHeight: 80,
      },
      {
        key: 'acoes_pontuais',
        label: 'Vai fazer ações pontuais?',
        hint: 'Sim/Não e quais.',
        placeholder: 'Sim/Não e quais…',
        type: 'input',
      },
      {
        key: 'investimento',
        label: 'Qual o investimento?',
        hint: 'Verba mensal disponível APENAS para tráfego — separar do fee da Milennials.',
        placeholder: 'Ex: R$ 5.000/mês em tráfego',
        type: 'input',
      },
    ],
  },
];

interface Props {
  formData: FormDraft;
  handleChange: (field: string, value: string) => void;
}

export default function ClientCallFormSection({ formData, handleChange }: Props) {
  const [activeBlock, setActiveBlock] = useState<string>(BLOCKS[0].id);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveBlock(visible[0].target.id);
        }
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    BLOCKS.forEach((b) => {
      const el = container.querySelector<HTMLElement>(`#${b.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="space-y-0">
      {/* Header da seção */}
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4" />
        Formulário da Call
      </h3>

      {/* Chip-index sticky */}
      <nav
        className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-8 bg-background/70 backdrop-blur-xl border-b border-border/60"
        aria-label="Navegação dos blocos do formulário"
      >
        <ul className="flex items-center gap-1 overflow-x-auto">
          {BLOCKS.map((b) => {
            const active = activeBlock === b.id;
            return (
              <li key={b.id}>
                <a
                  href={`#${b.id}`}
                  data-active={active}
                  className="group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground hover:text-foreground transition-colors data-[active=true]:text-foreground data-[active=true]:bg-foreground/[0.06] whitespace-nowrap"
                >
                  <span className="font-mono text-[10px] tabular-nums opacity-60 group-hover:opacity-100 group-data-[active=true]:opacity-100">
                    {b.number}
                  </span>
                  <span>{b.shortTitle}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Lembrete */}
      <div className="rounded-xl border border-info/20 bg-info/[0.04] p-5 mb-8">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-info mb-3">
          Lembrete · Primeiras coisas a fazer na call
        </h4>
        <ul className="space-y-2 text-sm text-foreground/90">
          <li className="flex gap-3">
            <span className="font-mono text-xs text-info/70 mt-0.5 tabular-nums">01</span>
            <span>
              <strong className="font-semibold">Se apresentar</strong> — diga seu nome e função na Millennials
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-xs text-info/70 mt-0.5 tabular-nums">02</span>
            <span>
              <strong className="font-semibold">Explicar o motivo da call</strong> — alinhamento, expectativas e próximos passos
            </span>
          </li>
        </ul>
      </div>

      {/* Blocos */}
      {BLOCKS.map((block, idx) => (
        <div key={block.id}>
          {/* Divisor entre Bloco 6 e Bloco 7 */}
          {idx === 6 && (
            <div className="my-12 flex items-center gap-4">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-warning/50 to-warning/50" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-warning whitespace-nowrap">
                ⚡ Impor a consultoria com a equipe
              </p>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-warning/50 to-warning/50" />
            </div>
          )}

          <div id={block.id} className="scroll-mt-24 pt-2 pb-12">
            <header className="flex items-baseline gap-5 mb-8 pb-5 border-b border-border/40">
              <span className="font-mono text-5xl font-medium tabular-nums text-muted-foreground/40 leading-none tracking-tight select-none">
                {block.number}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-foreground tracking-tight leading-tight">
                  {block.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {block.description}
                </p>
              </div>
            </header>

            <div className="space-y-5">
              {block.fields?.map((field) => (
                <FieldRow
                  key={field.key as string}
                  field={field}
                  value={(formData[field.key] as string | null | undefined) ?? ''}
                  onChange={(v) => handleChange(field.key as string, v)}
                />
              ))}

              {block.customSlot === 'expectativas-grid' && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-medium text-foreground">
                    Expectativa daqui a… com a Millennials
                  </h4>
                  <p className="text-xs text-muted-foreground">Alinhar expectativa em 4 horizontes.</p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ExpectativaField
                      label="30 dias"
                      value={formData.expectativas_30d ?? ''}
                      onChange={(v) => handleChange('expectativas_30d', v)}
                    />
                    <ExpectativaField
                      label="3 meses"
                      value={formData.expectativas_3m ?? ''}
                      onChange={(v) => handleChange('expectativas_3m', v)}
                    />
                    <ExpectativaField
                      label="6 meses"
                      value={formData.expectativas_6m ?? ''}
                      onChange={(v) => handleChange('expectativas_6m', v)}
                    />
                    <ExpectativaField
                      label="1 ano"
                      value={formData.expectativas_1a ?? ''}
                      onChange={(v) => handleChange('expectativas_1a', v)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

interface FieldRowProps {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}

function FieldRow({ field, value, onChange }: FieldRowProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium text-foreground/90 leading-snug">
        {field.label}
      </Label>
      {field.hint && (
        <p className="text-[12px] text-muted-foreground -mt-1 leading-relaxed">{field.hint}</p>
      )}
      {field.type === 'textarea' ? (
        <Textarea
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={field.minHeight ? { minHeight: field.minHeight } : undefined}
        />
      ) : (
        <Input
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

interface ExpectativaFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ExpectativaField({ label, value, onChange }: ExpectativaFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium text-foreground/90">{label}</Label>
      <Textarea
        placeholder={`Expectativas para ${label}…`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 60 }}
      />
    </div>
  );
}
