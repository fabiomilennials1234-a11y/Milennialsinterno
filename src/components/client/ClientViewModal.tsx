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
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ClientLabelSelector from '@/components/shared/ClientLabelSelector';
import { useClientInfo, useClientCallForm, useSaveClientCallForm, ClientCallForm } from '@/hooks/useClientCallForm';
import StrategyBuilderSection from '@/components/strategy/StrategyBuilderSection';
import { cn } from '@/lib/utils';

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
  const saveForm = useSaveClientCallForm();

  const canSetClientLabel = isCEO || isAdminUser || user?.role === 'sucesso_cliente';

  const [formData, setFormData] = useState<Partial<ClientCallForm> & { strategy_link?: string }>({
    historia_empresa: '',
    produto_servico: '',
    lista_produtos: '',
    cliente_ideal: '',
    dor_desejo: '',
    historico_marketing: '',
    site: '',
    comercial_existente: '',
    expectativas_30d: '',
    expectativas_3m: '',
    expectativas_6m: '',
    expectativas_1a: '',
    proposito: '',
    referencias: '',
    localizacao: '',
    acoes_pontuais: '',
    investimento: '',
    strategy_link: '',
  });

  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Load existing data when callForm changes
  useEffect(() => {
    if (callForm) {
      setFormData({
        historia_empresa: callForm.historia_empresa || '',
        produto_servico: callForm.produto_servico || '',
        lista_produtos: callForm.lista_produtos || '',
        cliente_ideal: callForm.cliente_ideal || '',
        dor_desejo: callForm.dor_desejo || '',
        historico_marketing: callForm.historico_marketing || '',
        site: callForm.site || '',
        comercial_existente: callForm.comercial_existente || '',
        expectativas_30d: callForm.expectativas_30d || '',
        expectativas_3m: callForm.expectativas_3m || '',
        expectativas_6m: callForm.expectativas_6m || '',
        expectativas_1a: callForm.expectativas_1a || '',
        proposito: callForm.proposito || '',
        referencias: callForm.referencias || '',
        localizacao: callForm.localizacao || '',
        acoes_pontuais: callForm.acoes_pontuais || '',
        investimento: callForm.investimento || '',
        strategy_link: (callForm as any).strategy_link || '',
      });
    }
  }, [callForm]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
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
              <ClientLabelBadge label={(clientInfo as any)?.client_label as ClientLabel} size="sm" />
            </div>
            <div className="flex items-center gap-2">
              {canSetClientLabel && (
                <ClientLabelSelector
                  clientId={clientId}
                  currentLabel={((clientInfo as any)?.client_label ?? null) as ClientLabel}
                />
              )}

              <Button
                onClick={handleSave}
                disabled={saveForm.isPending}
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
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 space-y-6">
              {/* Client Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Nicho</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {clientInfo?.niche || 'Não informado'}
                  </p>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-foreground">Investimento Previsto</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(clientInfo?.expected_investment || null)}
                  </p>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-info" />
                    <span className="text-sm font-semibold text-foreground">CNPJ</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {clientInfo?.cnpj || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* General Info */}
              {clientInfo?.general_info && (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      O que o gestor precisa saber sobre esse cliente?
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {clientInfo.general_info}
                  </p>
                </div>
              )}

              <Separator />

              {/* Call Form Fields */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Formulário da Call
                </h3>

                {/* Reminders - Not input fields */}
                <div className="bg-info/10 rounded-xl p-4 border border-info/30">
                  <h4 className="text-sm font-bold text-info mb-3 flex items-center gap-2">
                    💡 Lembrete - Primeiras coisas a fazer na Call:
                  </h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-info font-bold">1.</span>
                      <span><strong>Se apresentar</strong> - Diga seu nome e função na Millennials</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-info font-bold">2.</span>
                      <span><strong>Explicar o motivo da Call</strong> - Alinhamento, expectativas e próximos passos</span>
                    </li>
                  </ul>
                </div>

                {/* Perguntas principais */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Qual a História da Empresa?</Label>
                    <Textarea
                      placeholder="Conte a história da empresa do cliente..."
                      value={formData.historia_empresa || ''}
                      onChange={(e) => handleChange('historia_empresa', e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Qual o Produto/Serviço?</Label>
                    <Textarea
                      placeholder="Descreva os produtos ou serviços..."
                      value={formData.produto_servico || ''}
                      onChange={(e) => handleChange('produto_servico', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pediu a lista de produtos (Se não, porquê?)</Label>
                    <Input
                      placeholder="Sim/Não e justificativa..."
                      value={formData.lista_produtos || ''}
                      onChange={(e) => handleChange('lista_produtos', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Qual o Cliente Ideal?</Label>
                    <Textarea
                      placeholder="Descreva o cliente ideal..."
                      value={formData.cliente_ideal || ''}
                      onChange={(e) => handleChange('cliente_ideal', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Qual a Dor ou Desejo?</Label>
                    <Textarea
                      placeholder="Quais são as dores ou desejos do cliente..."
                      value={formData.dor_desejo || ''}
                      onChange={(e) => handleChange('dor_desejo', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Já fez Marketing? Quais melhor funcionaram? Porquê Parou?</Label>
                    <Textarea
                      placeholder="Histórico de marketing..."
                      value={formData.historico_marketing || ''}
                      onChange={(e) => handleChange('historico_marketing', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tem site?</Label>
                    <Input
                      placeholder="URL do site ou 'Não possui'..."
                      value={formData.site || ''}
                      onChange={(e) => handleChange('site', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Já tem Comercial? (Explicar sobre o acompanhamento comercial)</Label>
                    <Textarea
                      placeholder="Situação comercial atual..."
                      value={formData.comercial_existente || ''}
                      onChange={(e) => handleChange('comercial_existente', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                {/* Expectativas */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    Qual a sua expectativa daqui a... com a Millennials? (Alinhar expectativa)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>30 dias</Label>
                      <Textarea
                        placeholder="Expectativas para 30 dias..."
                        value={formData.expectativas_30d || ''}
                        onChange={(e) => handleChange('expectativas_30d', e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>3 meses</Label>
                      <Textarea
                        placeholder="Expectativas para 3 meses..."
                        value={formData.expectativas_3m || ''}
                        onChange={(e) => handleChange('expectativas_3m', e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>6 meses</Label>
                      <Textarea
                        placeholder="Expectativas para 6 meses..."
                        value={formData.expectativas_6m || ''}
                        onChange={(e) => handleChange('expectativas_6m', e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>1 ano</Label>
                      <Textarea
                        placeholder="Expectativas para 1 ano..."
                        value={formData.expectativas_1a || ''}
                        onChange={(e) => handleChange('expectativas_1a', e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Resto das perguntas */}
                <div className="space-y-4">
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <p className="text-sm font-semibold text-warning">
                      ⚡ Impor a Consultoria com a Equipe!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Qual o Propósito?</Label>
                    <Textarea
                      placeholder="Propósito do cliente..."
                      value={formData.proposito || ''}
                      onChange={(e) => handleChange('proposito', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quais as referências?</Label>
                    <Textarea
                      placeholder="Referências do cliente..."
                      value={formData.referencias || ''}
                      onChange={(e) => handleChange('referencias', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Qual a Localização?</Label>
                    <Input
                      placeholder="Cidade, Estado..."
                      value={formData.localizacao || ''}
                      onChange={(e) => handleChange('localizacao', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Vai fazer ações pontuais?</Label>
                    <Input
                      placeholder="Sim/Não e quais..."
                      value={formData.acoes_pontuais || ''}
                      onChange={(e) => handleChange('acoes_pontuais', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Qual o investimento?</Label>
                    <Input
                      placeholder="Valor do investimento..."
                      value={formData.investimento || ''}
                      onChange={(e) => handleChange('investimento', e.target.value)}
                    />
                  </div>
                </div>
              </div>

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

              {/* Client Notes Section - Shared between Gestor de Tráfego and Consultor Comercial */}
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
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
