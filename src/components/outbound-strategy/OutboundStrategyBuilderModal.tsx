import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateOutboundStrategy,
  useUpdateOutboundStrategy,
  OutboundStrategy,
  ProspeccaoAtivaConfig,
  RemarketingBaseConfig,
} from '@/hooks/useOutboundStrategies';
import OutboundStrategyTypeSelector from './OutboundStrategyTypeSelector';
import OutboundProspeccaoAtivaConfig from './OutboundProspeccaoAtivaConfig';
import OutboundRemarketingBaseConfig from './OutboundRemarketingBaseConfig';
import OutboundStrategyGeneralSettings from './OutboundStrategyGeneralSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existingStrategy?: OutboundStrategy;
}

const defaultPA: ProspeccaoAtivaConfig = { enabled: false };
const defaultRB: RemarketingBaseConfig = { enabled: false };

export default function OutboundStrategyBuilderModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  existingStrategy,
}: Props) {
  const createStrategy = useCreateOutboundStrategy();
  const updateStrategy = useUpdateOutboundStrategy();

  // Type selections
  const [prospeccaoAtivaEnabled, setProspeccaoAtivaEnabled] = useState(existingStrategy?.prospeccao_ativa_enabled || false);
  const [remarketingBaseEnabled, setRemarketingBaseEnabled] = useState(existingStrategy?.remarketing_base_enabled || false);
  const [ambosEnabled, setAmbosEnabled] = useState(existingStrategy?.ambos_enabled || false);

  // General settings
  const [monthlyBudget, setMonthlyBudget] = useState<number>(existingStrategy?.monthly_budget || 0);
  const [targetRegion, setTargetRegion] = useState(existingStrategy?.target_region || '');
  const [targetIcp, setTargetIcp] = useState(existingStrategy?.target_icp || '');
  const [toolsUsed, setToolsUsed] = useState(existingStrategy?.tools_used || '');
  const [useClientBase, setUseClientBase] = useState(existingStrategy?.use_client_base || false);
  const [clientBaseDetails, setClientBaseDetails] = useState(existingStrategy?.client_base_details || '');

  // Prospecção Ativa sub-strategies
  const [paLinkedin, setPaLinkedin] = useState<ProspeccaoAtivaConfig>(existingStrategy?.pa_linkedin_prospecting || { ...defaultPA });
  const [paColdCalling, setPaColdCalling] = useState<ProspeccaoAtivaConfig>(existingStrategy?.pa_cold_calling || { ...defaultPA });
  const [paColdEmail, setPaColdEmail] = useState<ProspeccaoAtivaConfig>(existingStrategy?.pa_cold_email || { ...defaultPA });
  const [paWhatsapp, setPaWhatsapp] = useState<ProspeccaoAtivaConfig>(existingStrategy?.pa_whatsapp_outreach || { ...defaultPA });

  // Remarketing de Base sub-strategies
  const [rbEmail, setRbEmail] = useState<RemarketingBaseConfig>(existingStrategy?.rb_email_reactivation || { ...defaultRB });
  const [rbWhatsapp, setRbWhatsapp] = useState<RemarketingBaseConfig>(existingStrategy?.rb_whatsapp_nurturing || { ...defaultRB });
  const [rbUpsell, setRbUpsell] = useState<RemarketingBaseConfig>(existingStrategy?.rb_upsell_crosssell || { ...defaultRB });

  // Combined notes
  const [ambosCombinedNotes, setAmbosCombinedNotes] = useState(existingStrategy?.ambos_combined_notes || '');

  const isLoading = createStrategy.isPending || updateStrategy.isPending;

  const showProspeccao = prospeccaoAtivaEnabled || ambosEnabled;
  const showRemarketing = remarketingBaseEnabled || ambosEnabled;

  const validateForm = (): string | null => {
    if (!monthlyBudget || monthlyBudget <= 0) {
      return 'Orçamento Mensal é obrigatório';
    }
    if (!targetRegion || targetRegion.trim() === '') {
      return 'Região Alvo é obrigatória';
    }
    if (!targetIcp || targetIcp.trim() === '') {
      return 'Perfil de Cliente Ideal (ICP) é obrigatório';
    }

    if (!prospeccaoAtivaEnabled && !remarketingBaseEnabled && !ambosEnabled) {
      return 'Selecione pelo menos um tipo de estratégia';
    }

    if (showProspeccao) {
      const hasPA = paLinkedin.enabled || paColdCalling.enabled || paColdEmail.enabled || paWhatsapp.enabled;
      if (!hasPA) {
        return 'Selecione pelo menos uma sub-estratégia de Prospecção Ativa';
      }
    }

    if (showRemarketing) {
      const hasRB = rbEmail.enabled || rbWhatsapp.enabled || rbUpsell.enabled;
      if (!hasRB) {
        return 'Selecione pelo menos uma sub-estratégia de Remarketing de Base';
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error('Campos obrigatórios', { description: validationError });
      return;
    }

    const strategyData = {
      client_id: clientId,
      monthly_budget: monthlyBudget,
      target_region: targetRegion,
      target_icp: targetIcp,
      tools_used: toolsUsed || null,
      use_client_base: useClientBase,
      client_base_details: useClientBase ? clientBaseDetails : null,
      prospeccao_ativa_enabled: prospeccaoAtivaEnabled,
      remarketing_base_enabled: remarketingBaseEnabled,
      ambos_enabled: ambosEnabled,
      // Prospecção Ativa
      pa_linkedin_prospecting: showProspeccao && paLinkedin.enabled ? paLinkedin : null,
      pa_cold_calling: showProspeccao && paColdCalling.enabled ? paColdCalling : null,
      pa_cold_email: showProspeccao && paColdEmail.enabled ? paColdEmail : null,
      pa_whatsapp_outreach: showProspeccao && paWhatsapp.enabled ? paWhatsapp : null,
      // Remarketing de Base
      rb_email_reactivation: showRemarketing && rbEmail.enabled ? rbEmail : null,
      rb_whatsapp_nurturing: showRemarketing && rbWhatsapp.enabled ? rbWhatsapp : null,
      rb_upsell_crosssell: showRemarketing && rbUpsell.enabled ? rbUpsell : null,
      // Combined
      ambos_combined_notes: ambosEnabled ? ambosCombinedNotes : null,
    };

    if (existingStrategy) {
      await updateStrategy.mutateAsync({ id: existingStrategy.id, data: strategyData });
    } else {
      await createStrategy.mutateAsync(strategyData);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {existingStrategy ? 'Editar Estratégia Outbound' : 'Criar Estratégia Outbound'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Cliente: {clientName}
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* Type Selection */}
            <OutboundStrategyTypeSelector
              prospeccaoAtivaEnabled={prospeccaoAtivaEnabled}
              setProspeccaoAtivaEnabled={setProspeccaoAtivaEnabled}
              remarketingBaseEnabled={remarketingBaseEnabled}
              setRemarketingBaseEnabled={setRemarketingBaseEnabled}
              ambosEnabled={ambosEnabled}
              setAmbosEnabled={setAmbosEnabled}
            />

            {/* Prospecção Ativa Config */}
            {showProspeccao && (
              <OutboundProspeccaoAtivaConfig
                linkedinProspecting={paLinkedin}
                setLinkedinProspecting={setPaLinkedin}
                coldCalling={paColdCalling}
                setColdCalling={setPaColdCalling}
                coldEmail={paColdEmail}
                setColdEmail={setPaColdEmail}
                whatsappOutreach={paWhatsapp}
                setWhatsappOutreach={setPaWhatsapp}
              />
            )}

            {/* Remarketing de Base Config */}
            {showRemarketing && (
              <OutboundRemarketingBaseConfig
                emailReactivation={rbEmail}
                setEmailReactivation={setRbEmail}
                whatsappNurturing={rbWhatsapp}
                setWhatsappNurturing={setRbWhatsapp}
                upsellCrosssell={rbUpsell}
                setUpsellCrosssell={setRbUpsell}
              />
            )}

            {/* Combined Notes (only when Ambos) */}
            {ambosEnabled && (
              <div className="space-y-2 p-5 bg-purple-500/5 rounded-xl border border-purple-500/20">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <span className="text-lg">⚡</span>
                  Notas da Estratégia Combinada
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Descreva como as estratégias de Prospecção e Remarketing se complementam
                </p>
                <Textarea
                  value={ambosCombinedNotes}
                  onChange={(e) => setAmbosCombinedNotes(e.target.value)}
                  placeholder="Ex: Prospecção ativa gera novos leads, remarketing nutre os que não converteram..."
                  className="min-h-[100px]"
                />
              </div>
            )}

            {/* General Settings */}
            <OutboundStrategyGeneralSettings
              monthlyBudget={monthlyBudget}
              setMonthlyBudget={setMonthlyBudget}
              targetRegion={targetRegion}
              setTargetRegion={setTargetRegion}
              targetIcp={targetIcp}
              setTargetIcp={setTargetIcp}
              toolsUsed={toolsUsed}
              setToolsUsed={setToolsUsed}
              useClientBase={useClientBase}
              setUseClientBase={setUseClientBase}
              clientBaseDetails={clientBaseDetails}
              setClientBaseDetails={setClientBaseDetails}
            />
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Target className="w-4 h-4" />
            )}
            {existingStrategy ? 'Salvar Alterações' : 'Criar Estratégia'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
