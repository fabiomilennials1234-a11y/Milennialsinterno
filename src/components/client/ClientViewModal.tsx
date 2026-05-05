import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  Building2, 
  DollarSign, 
  Target, 
  FileText,
  ExternalLink,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  StickyNote,
  AlertTriangle as AlertTriangleIcon
} from 'lucide-react';
import ClientNotesSection from './ClientNotesSection';
import ClientCallFormSection from './ClientCallFormSection';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import { useClientInfo, useClientCallForm, useSaveClientCallForm, useUpdateClientInfo, ClientCallForm } from '@/hooks/useClientCallForm';
import StrategyBuilderSection from '@/components/strategy/StrategyBuilderSection';
import MktplaceDiagnosticoSection from '@/components/mktplace/MktplaceDiagnosticoSection';
import OutboundStrategyBuilderSection from '@/components/outbound-strategy/OutboundStrategyBuilderSection';
import ResultsReportSection from '@/components/results-report/ResultsReportSection';
import ResultsReportCountdownBadge from '@/components/results-report/ResultsReportCountdownBadge';
import PaddockDiagnosticoSection from '@/components/comercial/PaddockDiagnosticoSection';
import PaddockDiagnosticoListSection from '@/components/comercial/PaddockDiagnosticoListSection';
import WarRoomSection from '@/components/comercial/WarRoomSection';
import CrmGerarTarefaSection from '@/components/gestor-crm/CrmGerarTarefaSection';
import ClientTierBadge, { ClientCreativesLimit } from '@/components/shared/ClientTierBadge';
import ClientCreativesHistory from '@/components/shared/ClientCreativesHistory';
import { PRODUCT_CONFIG, TorqueCRMProductBadges } from '@/components/shared/ProductBadges';
import ClientTagsList from '@/components/client-tags/ClientTagsList';
import ClientTagCountdownHero from '@/components/client-tags/ClientTagCountdownHero';
import { useClientTags } from '@/hooks/useClientTags';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ClientViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
}

const LINKS = {
  tiposVideos: 'https://www.figma.com/proto/nHb8ohFWe2chaaeYmNZWRa/Central-Swipe-File-Milennials?page-id=0%3A1&node-id=2-3&viewport=1345%2C-195%2C0.16&t=apqxeXuy7XuizXrt-1&scaling=min-zoom&content-scaling=fixed&starting-point-node-id=2%3A266',
  estrategias: 'https://drive.google.com/drive/folders/1YTtNJ7k2TyhgjDJscngf8gs2GqDzlHV0?usp=sharing',
  marcoCliente: 'https://drive.google.com/drive/folders/1IKZrSflht2JSWZ1KRfG-wMVqpI-hp6XM',
};

const formatCurrency = (value: number | null) => {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function ClientViewModal({ isOpen, onClose, clientId }: ClientViewModalProps) {
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: clientInfo, isLoading: clientLoading } = useClientInfo(clientId);
  const { data: callForm, isLoading: formLoading } = useClientCallForm(clientId);
  const { data: clientTags = [] } = useClientTags(clientId);

  // Hero: única tag ativa com cronômetro vivo (não expirada).
  const heroTag = clientTags.length === 1 && clientTags[0].expires_at && !clientTags[0].expired_at
    ? clientTags[0]
    : null;
  const saveForm = useSaveClientCallForm();
  const updateClientInfo = useUpdateClientInfo();

  const canSetClientLabel = isCEO || isAdminUser || user?.role === 'sucesso_cliente';

  // Buscar nomes dos responsáveis (Gestor, Treinador Comercial, MKT Place)
  const gestorId = clientInfo?.assigned_ads_manager;
  const treinadorId = clientInfo?.assigned_comercial;
  const mktplaceId = clientInfo?.assigned_mktplace;
  const responsibleIds = [gestorId, treinadorId, mktplaceId].filter(Boolean) as string[];

  const { data: responsibleNames = {} } = useQuery({
    queryKey: ['responsible-names', responsibleIds.join(',')],
    queryFn: async () => {
      if (responsibleIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', responsibleIds);
      const map: Record<string, string> = {};
      for (const p of data || []) {
        map[p.user_id] = p.name || 'Sem nome';
      }
      return map;
    },
    enabled: responsibleIds.length > 0,
  });

  const [clientInfoData, setClientInfoData] = useState({
    niche: '',
    expected_investment: '',
    cnpj: '',
    general_info: '',
  });

  const [formData, setFormData] = useState<Partial<ClientCallForm> & { strategy_link?: string }>({
    // Bloco 1
    historia_empresa: '',
    produto_servico: '',
    principais_produtos_margem: '',
    produto_carro_chefe: '',
    ticket_medio: '',
    margem_media: '',
    pedido_minimo: '',
    condicao_distribuidor_representante: '',
    lista_produtos: '',
    // Bloco 2
    cliente_ideal: '',
    decisor_compra_cliente: '',
    dor_desejo: '',
    diferencial_vs_concorrencia: '',
    maior_dor_empresa: '',
    concorrente_direto_n1: '',
    feiras_eventos_setor: '',
    // Bloco 3
    comercial_existente: '',
    representantes_comerciais_atual: '',
    captar_novos_representantes: '',
    tempo_ciclo_venda: '',
    tempo_resposta_lead: '',
    origem_clientes_atuais: '',
    recompra_frequencia: '',
    programa_indicacao: '',
    cnpjs_ativos: '',
    // Bloco 4
    historico_marketing: '',
    site: '',
    catalogo_fotos_videos: '',
    restricoes_comunicacao: '',
    // Bloco 5
    vende_marketplaces: '',
    marketplaces_ativos: '',
    faturamento_marketplaces: '',
    // Bloco 6
    foco_principal_empresa: '',
    objetivo_contratar_milennials: '',
    satisfacao_3_meses: '',
    expectativas_30d: '',
    expectativas_3m: '',
    expectativas_6m: '',
    expectativas_1a: '',
    // Bloco 7
    proposito: '',
    referencias: '',
    localizacao: '',
    ponto_focal_cliente: '',
    acoes_pontuais: '',
    investimento: '',
    strategy_link: '',
  });

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Load existing client info data
  useEffect(() => {
    if (clientInfo) {
      setClientInfoData({
        niche: clientInfo.niche || '',
        expected_investment: clientInfo.expected_investment != null ? String(clientInfo.expected_investment) : '',
        cnpj: clientInfo.cnpj || '',
        general_info: clientInfo.general_info || '',
      });
    }
  }, [clientInfo]);

  // Load existing data when callForm changes
  useEffect(() => {
    if (callForm) {
      setFormData({
        // Bloco 1
        historia_empresa: callForm.historia_empresa || '',
        produto_servico: callForm.produto_servico || '',
        principais_produtos_margem: callForm.principais_produtos_margem || '',
        produto_carro_chefe: callForm.produto_carro_chefe || '',
        ticket_medio: callForm.ticket_medio || '',
        margem_media: callForm.margem_media || '',
        pedido_minimo: callForm.pedido_minimo || '',
        condicao_distribuidor_representante: callForm.condicao_distribuidor_representante || '',
        lista_produtos: callForm.lista_produtos || '',
        // Bloco 2
        cliente_ideal: callForm.cliente_ideal || '',
        decisor_compra_cliente: callForm.decisor_compra_cliente || '',
        dor_desejo: callForm.dor_desejo || '',
        diferencial_vs_concorrencia: callForm.diferencial_vs_concorrencia || '',
        maior_dor_empresa: callForm.maior_dor_empresa || '',
        concorrente_direto_n1: callForm.concorrente_direto_n1 || '',
        feiras_eventos_setor: callForm.feiras_eventos_setor || '',
        // Bloco 3
        comercial_existente: callForm.comercial_existente || '',
        representantes_comerciais_atual: callForm.representantes_comerciais_atual || '',
        captar_novos_representantes: callForm.captar_novos_representantes || '',
        tempo_ciclo_venda: callForm.tempo_ciclo_venda || '',
        tempo_resposta_lead: callForm.tempo_resposta_lead || '',
        origem_clientes_atuais: callForm.origem_clientes_atuais || '',
        recompra_frequencia: callForm.recompra_frequencia || '',
        programa_indicacao: callForm.programa_indicacao || '',
        cnpjs_ativos: callForm.cnpjs_ativos || '',
        // Bloco 4
        historico_marketing: callForm.historico_marketing || '',
        site: callForm.site || '',
        catalogo_fotos_videos: callForm.catalogo_fotos_videos || '',
        restricoes_comunicacao: callForm.restricoes_comunicacao || '',
        // Bloco 5
        vende_marketplaces: callForm.vende_marketplaces || '',
        marketplaces_ativos: callForm.marketplaces_ativos || '',
        faturamento_marketplaces: callForm.faturamento_marketplaces || '',
        // Bloco 6
        foco_principal_empresa: callForm.foco_principal_empresa || '',
        objetivo_contratar_milennials: callForm.objetivo_contratar_milennials || '',
        satisfacao_3_meses: callForm.satisfacao_3_meses || '',
        expectativas_30d: callForm.expectativas_30d || '',
        expectativas_3m: callForm.expectativas_3m || '',
        expectativas_6m: callForm.expectativas_6m || '',
        expectativas_1a: callForm.expectativas_1a || '',
        // Bloco 7
        proposito: callForm.proposito || '',
        referencias: callForm.referencias || '',
        localizacao: callForm.localizacao || '',
        ponto_focal_cliente: callForm.ponto_focal_cliente || '',
        acoes_pontuais: callForm.acoes_pontuais || '',
        investimento: callForm.investimento || '',
        strategy_link: (callForm as any).strategy_link || '',
      });
    }
  }, [callForm]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClientInfoChange = (field: string, value: string) => {
    setClientInfoData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Save client info (niche, investment, cnpj, general_info)
    await updateClientInfo.mutateAsync({
      clientId,
      data: {
        niche: clientInfoData.niche || undefined,
        expected_investment: clientInfoData.expected_investment ? parseFloat(clientInfoData.expected_investment) : null,
        cnpj: clientInfoData.cnpj || undefined,
        general_info: clientInfoData.general_info || undefined,
      },
    });
    // Save call form data
    await saveForm.mutateAsync({ clientId, data: formData });
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const isLoading = clientLoading || formLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          {/* Overdue Invoice Alert Banner */}
          <OverdueInvoiceBadge 
            clientId={clientId} 
            className="w-full justify-center py-2 mb-3 rounded-lg text-sm" 
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {clientLoading ? 'Carregando...' : clientInfo?.name || 'Ver Cliente'}
                </DialogTitle>
                {clientInfo?.razao_social && (
                  <p className="text-sm text-muted-foreground">{clientInfo.razao_social}</p>
                )}
              </div>
              <ClientLabelBadge label={clientInfo?.client_label as ClientLabel} size="sm" />
              <ClientTierBadge clientId={clientId} />
              {mktplaceId && responsibleNames[mktplaceId] && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 gap-1 bg-purple-100 text-purple-800 border-purple-300"
                >
                  MKT Place • {responsibleNames[mktplaceId]}
                </Badge>
              )}
              <ResultsReportCountdownBadge clientId={clientId} />
            </div>
            <div className="flex items-center gap-2">
              {/* Stack de tags do cliente — sempre visível no header. */}
              {canSetClientLabel && (
                <ClientLabelSelector
                  clientId={clientId}
                  currentLabel={(clientInfo?.client_label ?? null) as ClientLabel}
                />
              )}

              <Button
                onClick={handleSave}
                disabled={saveForm.isPending || updateClientInfo.isPending}
                className="gap-2"
              >
                {saveForm.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : showSaveSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {showSaveSuccess ? 'Salvo!' : 'Salvar'}
              </Button>
            </div>
          </div>

          {/* Lista completa de tags do cliente — abaixo do título. */}
          {clientTags.length > 0 && (
            <ClientTagsList tags={clientTags} size="md" className="mt-2" />
          )}
        </DialogHeader>

        {/* Hero acima da ScrollArea quando há UMA E APENAS UMA tag ativa com cronômetro. */}
        {heroTag && (
          <div className="px-6 pt-4 shrink-0">
            <ClientTagCountdownHero tag={heroTag} />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 space-y-6">
              {/* Limite de criativos mensal */}
              <ClientCreativesLimit clientId={clientId} className="px-1" />

              {/* Historico de criativos */}
              <ClientCreativesHistory clientId={clientId} />

              {/* Produtos Inclusos */}
              {clientInfo?.contracted_products && clientInfo.contracted_products.length > 0 && (
                <div className="bg-muted/20 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Produtos Inclusos</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Growth sempre primeiro (se presente) */}
                    {clientInfo.contracted_products.includes('millennials-growth') && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        Millennials Growth
                        <span className="text-[10px] font-normal opacity-80">
                          • {gestorId && responsibleNames[gestorId] ? responsibleNames[gestorId] : 'Sem gestor'}
                        </span>
                      </span>
                    )}
                    {/* Paddock (sempre aparece se Growth está presente) */}
                    {(clientInfo.contracted_products.includes('millennials-growth') || clientInfo.contracted_products.includes('millennials-paddock')) && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-600 border-red-500/20">
                        Paddock
                        <span className="text-[10px] font-normal opacity-70">
                          • {treinadorId && responsibleNames[treinadorId] ? responsibleNames[treinadorId] : 'Sem treinador'}
                        </span>
                      </span>
                    )}
                    {/* MKT Place */}
                    {(clientInfo.contracted_products.includes('millennials-growth') || clientInfo.contracted_products.includes('gestor-mktplace')) && mktplaceId && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold bg-purple-500/10 text-purple-600 border-purple-500/20">
                        MKT Place
                        <span className="text-[10px] font-normal opacity-70">
                          • {responsibleNames[mktplaceId] || 'Sem consultor'}
                        </span>
                      </span>
                    )}
                    {/* Demais produtos (excluindo Growth e Paddock que já foram mostrados acima) */}
                    {clientInfo.contracted_products
                      .filter(slug => slug !== 'millennials-growth' && slug !== 'millennials-paddock')
                      .map(slug => {
                        const config = PRODUCT_CONFIG[slug];
                        if (!config) return null;
                        // Responsável por produto
                        const responsibleName: string | null = null;
                        return (
                          <span key={slug} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold", config.color)}>
                            {config.name}
                            {responsibleName && (
                              <span className="text-[10px] font-normal opacity-80">• {responsibleName}</span>
                            )}
                          </span>
                        );
                      })}
                  </div>
                  {/* Sub-produtos do Torque CRM (V8/Automation/Copilot) */}
                  {(clientInfo as any).torque_crm_products && (clientInfo as any).torque_crm_products.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Torque CRM — Produtos</p>
                      <TorqueCRMProductBadges products={(clientInfo as any).torque_crm_products} size="md" />
                    </div>
                  )}
                </div>
              )}

              {/* Client Info Cards - Editable */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Nicho</span>
                  </div>
                  <Input
                    placeholder="Ex: Bolos, Restaurantes..."
                    value={clientInfoData.niche}
                    onChange={(e) => handleClientInfoChange('niche', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-foreground">Investimento Previsto</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 2000.00"
                    value={clientInfoData.expected_investment}
                    onChange={(e) => handleClientInfoChange('expected_investment', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-info" />
                    <span className="text-sm font-semibold text-foreground">CNPJ</span>
                  </div>
                  <Input
                    placeholder="Ex: 18.137.576/0001-60"
                    value={clientInfoData.cnpj}
                    onChange={(e) => handleClientInfoChange('cnpj', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* General Info - Editable */}
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    O que o gestor precisa saber sobre esse cliente?
                  </span>
                </div>
                <Textarea
                  placeholder="Informações importantes sobre o cliente..."
                  value={clientInfoData.general_info}
                  onChange={(e) => handleClientInfoChange('general_info', e.target.value)}
                  className="min-h-[80px] text-sm"
                />
              </div>

              <Separator />

              {/* Formulário da Call — 7 blocos com chip-index sticky */}
              <ClientCallFormSection formData={formData} handleChange={handleChange} />

              <Separator />

              {/* IMPORTANT LINKS - At the end for showing in the meeting */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-warning/20 to-orange-500/20 rounded-xl p-5 border-2 border-warning/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-warning/30 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-warning">
                        ⚠️ LINKS OBRIGATÓRIOS - NÃO ESQUEÇA!
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Mostre esses links durante a reunião com o cliente
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <a
                      href={LINKS.tiposVideos}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-background hover:bg-muted rounded-xl border-2 border-warning/30 hover:border-warning transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-colors">
                        <ExternalLink className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">Tipos de Vídeos</span>
                        <span className="text-xs text-muted-foreground">Figma - Swipe File</span>
                      </div>
                    </a>

                    <a
                      href={LINKS.estrategias}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-background hover:bg-muted rounded-xl border-2 border-warning/30 hover:border-warning transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-colors">
                        <ExternalLink className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">Estratégias Prováveis</span>
                        <span className="text-xs text-muted-foreground">Google Drive</span>
                      </div>
                    </a>

                    <a
                      href={LINKS.marcoCliente}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-background hover:bg-muted rounded-xl border-2 border-warning/30 hover:border-warning transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center group-hover:bg-warning/30 transition-colors">
                        <ExternalLink className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">Marco do Cliente</span>
                        <span className="text-xs text-muted-foreground">Google Drive</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Client Notes Section - Shared between Gestor de Tráfego and Treinador Comercial */}
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-primary/5 to-info/5 rounded-xl p-5 border border-primary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <StickyNote className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        📝 Anotações e Comentários
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Notas do Gestor de Tráfego e comentários do Comercial
                      </p>
                    </div>
                  </div>

                  <ClientNotesSection clientId={clientId} />
                </div>
              </div>


              {/* Strategy Builder Section - Replaces old Mindmeister section */}
              {clientInfo && (
                <StrategyBuilderSection
                  clientId={clientId}
                  clientName={clientInfo.name}
                />
              )}

              {/* MKT Place Diagnóstico Section */}
              {clientInfo && (
                <MktplaceDiagnosticoSection
                  clientId={clientId}
                  clientName={clientInfo.name}
                />
              )}

              {/* Results Report Section */}
              {clientInfo && (
                <ResultsReportSection
                  clientId={clientId}
                  clientName={clientInfo.name}
                />
              )}

              {/* War Room Guides - only for Paddock clients */}
              {clientInfo && (clientInfo.contracted_products?.includes('millennials-growth') || clientInfo.contracted_products?.includes('millennials-paddock')) && (
                <WarRoomSection clientId={clientId} />
              )}

              {/* Paddock Diagnóstico Comercial Section - after War Rooms */}
              {clientInfo && (clientInfo.contracted_products?.includes('millennials-growth') || clientInfo.contracted_products?.includes('millennials-paddock')) && (
                <PaddockDiagnosticoSection
                  clientId={clientId}
                  clientName={clientInfo.name}
                />
              )}

              {/* Diagnóstico Comercial pós War #2 */}
              {clientInfo && (clientInfo.contracted_products?.includes('millennials-growth') || clientInfo.contracted_products?.includes('millennials-paddock')) && (
                <PaddockDiagnosticoListSection
                  clientId={clientId}
                  clientName={clientInfo.name}
                />
              )}

              {/* Gerar tarefa Gestor de CRM — só para clientes com Torque CRM contratado */}
              {clientInfo && clientInfo.contracted_products?.includes('torque-crm') && (
                <CrmGerarTarefaSection
                  clientId={clientId}
                  clientName={clientInfo.name}
                />
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
