import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Rocket, Plus, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateStrategy, useUpdateStrategy, ClientStrategy } from '@/hooks/useClientStrategies';
import { useStrategyTemplates } from '@/hooks/useStrategyTemplates';
import StrategyPlatformSelector from './StrategyPlatformSelector';
import StrategyMetaFunnels from './StrategyMetaFunnels';
import StrategyGoogleFunnels from './StrategyGoogleFunnels';
import StrategyLinkedInFunnels from './StrategyLinkedInFunnels';
import StrategyGeneralSettings from './StrategyGeneralSettings';
import CustomFunnelCards from './CustomFunnelCards';
import StrategyTemplateCreatorModal from './StrategyTemplateCreatorModal';
import StrategyProfileBlocks from './StrategyProfileBlocks';

interface StrategyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existingStrategy?: ClientStrategy;
}

export default function StrategyBuilderModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  existingStrategy,
}: StrategyBuilderModalProps) {
  const { isCEO } = useAuth();
  const createStrategy = useCreateStrategy();
  const updateStrategy = useUpdateStrategy();

  // Custom templates
  const { data: allTemplates = [] } = useStrategyTemplates();
  const [showTemplateCreator, setShowTemplateCreator] = useState(false);

  // Platform selections
  const [metaEnabled, setMetaEnabled] = useState(existingStrategy?.meta_enabled || false);
  const [googleEnabled, setGoogleEnabled] = useState(existingStrategy?.google_enabled || false);
  const [linkedinEnabled, setLinkedinEnabled] = useState(existingStrategy?.linkedin_enabled || false);

  // General settings
  const [minimumInvestment, setMinimumInvestment] = useState<number>(existingStrategy?.minimum_investment || 0);
  const [recommendedInvestment, setRecommendedInvestment] = useState<number>(existingStrategy?.recommended_investment || 0);
  const [adLocation, setAdLocation] = useState(existingStrategy?.ad_location || '');
  const [useClientMaterial, setUseClientMaterial] = useState(existingStrategy?.use_client_material || false);
  const [clientMaterialDetails, setClientMaterialDetails] = useState(existingStrategy?.client_material_details || '');

  // Profile blocks
  const [profileBio, setProfileBio] = useState(existingStrategy?.profile_bio || { is_good: true });
  const [profileDestaques, setProfileDestaques] = useState(existingStrategy?.profile_destaques || { is_good: true });
  const [profilePosts, setProfilePosts] = useState(existingStrategy?.profile_posts || { is_good: true });
  const [profileLpSite, setProfileLpSite] = useState(existingStrategy?.profile_lp_site || { is_good: true });

  // Meta funnels
  const [metaMillennialsMensagem, setMetaMillennialsMensagem] = useState(existingStrategy?.meta_millennials_mensagem || { enabled: false, budget: 0 });
  const [metaMillennialsCadastro, setMetaMillennialsCadastro] = useState(existingStrategy?.meta_millennials_cadastro || { enabled: false, budget: 0 });
  const [metaMillennialsCall, setMetaMillennialsCall] = useState(existingStrategy?.meta_millennials_call || { enabled: false, budget: 0 });
  const [metaCaptacaoRepresentantes, setMetaCaptacaoRepresentantes] = useState(existingStrategy?.meta_captacao_representantes || { enabled: false, budget: 0 });
  const [metaCaptacaoSdr, setMetaCaptacaoSdr] = useState(existingStrategy?.meta_captacao_sdr || { enabled: false, budget: 0 });
  const [metaDisparoEmail, setMetaDisparoEmail] = useState(existingStrategy?.meta_disparo_email || { enabled: false, budget: 0 });
  const [metaGrupoVip, setMetaGrupoVip] = useState(existingStrategy?.meta_grupo_vip || { enabled: false, budget: 0 });
  const [metaAumentoBase, setMetaAumentoBase] = useState(existingStrategy?.meta_aumento_base || { enabled: false, budget: 0 });
  const [metaSiteCadastro, setMetaSiteCadastro] = useState(existingStrategy?.meta_site_cadastro || { enabled: false, budget: 0 });

  // Google funnels
  const [googlePmax, setGooglePmax] = useState(existingStrategy?.google_pmax || { enabled: false, budget: 0 });
  const [googlePesquisa, setGooglePesquisa] = useState(existingStrategy?.google_pesquisa || { enabled: false, budget: 0 });
  const [googleDisplay, setGoogleDisplay] = useState(existingStrategy?.google_display || { enabled: false, budget: 0 });

  // LinkedIn funnels
  const [linkedinVagas, setLinkedinVagas] = useState(existingStrategy?.linkedin_vagas || { enabled: false, budget: 0 });
  const [linkedinCadastro, setLinkedinCadastro] = useState(existingStrategy?.linkedin_cadastro || { enabled: false, budget: 0 });

  // Custom funnels (keyed by template_id)
  const [customFunnels, setCustomFunnels] = useState<Record<string, { enabled: boolean; budget: number; [key: string]: any }>>(
    (existingStrategy as any)?.custom_funnels || {}
  );

  const isLoading = createStrategy.isPending || updateStrategy.isPending;

  // Filter templates by enabled platforms
  const metaTemplates = allTemplates.filter(t => t.platform === 'meta');
  const googleTemplates = allTemplates.filter(t => t.platform === 'google');
  const linkedinTemplates = allTemplates.filter(t => t.platform === 'linkedin');

  const handleNewModelClick = () => {
    if (!isCEO) {
      toast.error('Sem permissão', {
        description: 'Você não possui permissão para criar novos modelos',
      });
      return;
    }
    setShowTemplateCreator(true);
  };

  const validateForm = (): string | null => {
    if (!minimumInvestment || minimumInvestment <= 0) {
      return 'Investimento Mínimo é obrigatório';
    }
    if (!recommendedInvestment || recommendedInvestment <= 0) {
      return 'Investimento Recomendado é obrigatório';
    }
    if (!adLocation || adLocation.trim() === '') {
      return 'Localização dos Anúncios é obrigatória';
    }

    if (!metaEnabled && !googleEnabled && !linkedinEnabled) {
      return 'Selecione pelo menos uma plataforma';
    }

    // Millennials Cadastro: campos obrigatórios quando habilitado
    if (metaEnabled && metaMillennialsCadastro.enabled) {
      if (!metaMillennialsCadastro.cadastro_title?.trim()) {
        return 'Título do Cadastro é obrigatório para Millennials Cadastro';
      }
      if (!metaMillennialsCadastro.cadastro_description?.trim()) {
        return 'Descrição do Cadastro é obrigatória para Millennials Cadastro';
      }
      if (!metaMillennialsCadastro.cadastro_questions?.trim()) {
        return 'Perguntas do Formulário são obrigatórias para Millennials Cadastro';
      }
      if (!metaMillennialsCadastro.ty_page_lead?.trim()) {
        return 'Página de Obrigado para Lead é obrigatória para Millennials Cadastro';
      }
      if (!metaMillennialsCadastro.ty_page_non_lead?.trim()) {
        return 'Página de Obrigado para Não Lead é obrigatória para Millennials Cadastro';
      }
    }

    // Site -> Cadastro: campos obrigatórios quando habilitado
    if (metaEnabled && metaSiteCadastro.enabled) {
      if (!metaSiteCadastro.cadastro_title?.trim()) {
        return 'Título do Cadastro é obrigatório para Site -> Cadastro';
      }
      if (!metaSiteCadastro.cadastro_description?.trim()) {
        return 'Descrição do Cadastro é obrigatória para Site -> Cadastro';
      }
      if (!metaSiteCadastro.cadastro_questions?.trim()) {
        return 'Perguntas do Formulário são obrigatórias para Site -> Cadastro';
      }
      if (!metaSiteCadastro.ty_page_lead?.trim()) {
        return 'Página de Obrigado para Lead é obrigatória para Site -> Cadastro';
      }
      if (!metaSiteCadastro.ty_page_non_lead?.trim()) {
        return 'Página de Obrigado para Não Lead é obrigatória para Site -> Cadastro';
      }
    }

    // Check if at least one funnel is active per enabled platform (include custom funnels)
    if (metaEnabled) {
      const hasBuiltInMeta =
        metaMillennialsMensagem.enabled ||
        metaMillennialsCadastro.enabled ||
        metaMillennialsCall.enabled ||
        metaCaptacaoRepresentantes.enabled ||
        metaCaptacaoSdr.enabled ||
        metaDisparoEmail.enabled ||
        metaGrupoVip.enabled ||
        metaAumentoBase.enabled ||
        metaSiteCadastro.enabled;
      const hasCustomMeta = metaTemplates.some(t => customFunnels[t.id]?.enabled);

      if (!hasBuiltInMeta && !hasCustomMeta) {
        return 'Selecione pelo menos um funil de Meta Ads';
      }
    }

    if (googleEnabled) {
      const hasBuiltInGoogle = googlePmax.enabled || googlePesquisa.enabled || googleDisplay.enabled;
      const hasCustomGoogle = googleTemplates.some(t => customFunnels[t.id]?.enabled);
      if (!hasBuiltInGoogle && !hasCustomGoogle) {
        return 'Selecione pelo menos um funil de Google Ads';
      }
    }

    if (linkedinEnabled) {
      const hasBuiltInLinkedIn = linkedinVagas.enabled || linkedinCadastro.enabled;
      const hasCustomLinkedIn = linkedinTemplates.some(t => customFunnels[t.id]?.enabled);
      if (!hasBuiltInLinkedIn && !hasCustomLinkedIn) {
        return 'Selecione pelo menos um funil de LinkedIn Ads';
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

    // Only include enabled custom funnels in save data
    const enabledCustomFunnels: Record<string, any> = {};
    for (const [templateId, data] of Object.entries(customFunnels)) {
      if (data.enabled) {
        enabledCustomFunnels[templateId] = data;
      }
    }

    const strategyData = {
      client_id: clientId,
      minimum_investment: minimumInvestment,
      recommended_investment: recommendedInvestment,
      ad_location: adLocation,
      use_client_material: useClientMaterial,
      client_material_details: useClientMaterial ? clientMaterialDetails : null,
      meta_enabled: metaEnabled,
      google_enabled: googleEnabled,
      linkedin_enabled: linkedinEnabled,
      meta_millennials_mensagem: metaEnabled && metaMillennialsMensagem.enabled ? metaMillennialsMensagem : null,
      meta_millennials_cadastro: metaEnabled && metaMillennialsCadastro.enabled ? metaMillennialsCadastro : null,
      meta_millennials_call: metaEnabled && metaMillennialsCall.enabled ? metaMillennialsCall : null,
      meta_captacao_representantes: metaEnabled && metaCaptacaoRepresentantes.enabled ? metaCaptacaoRepresentantes : null,
      meta_captacao_sdr: metaEnabled && metaCaptacaoSdr.enabled ? metaCaptacaoSdr : null,
      meta_disparo_email: metaEnabled && metaDisparoEmail.enabled ? metaDisparoEmail : null,
      meta_grupo_vip: metaEnabled && metaGrupoVip.enabled ? metaGrupoVip : null,
      meta_aumento_base: metaEnabled && metaAumentoBase.enabled ? metaAumentoBase : null,
      meta_site_cadastro: metaEnabled && metaSiteCadastro.enabled ? metaSiteCadastro : null,
      google_pmax: googleEnabled && googlePmax.enabled ? googlePmax : null,
      google_pesquisa: googleEnabled && googlePesquisa.enabled ? googlePesquisa : null,
      google_display: googleEnabled && googleDisplay.enabled ? googleDisplay : null,
      linkedin_vagas: linkedinEnabled && linkedinVagas.enabled ? linkedinVagas : null,
      linkedin_cadastro: linkedinEnabled && linkedinCadastro.enabled ? linkedinCadastro : null,
      custom_funnels: enabledCustomFunnels,
      profile_bio: profileBio,
      profile_destaques: profileDestaques,
      profile_posts: profilePosts,
      profile_lp_site: profileLpSite,
    };

    if (existingStrategy) {
      await updateStrategy.mutateAsync({ id: existingStrategy.id, data: strategyData });
    } else {
      await createStrategy.mutateAsync(strategyData);
    }
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {existingStrategy ? 'Editar Estratégia' : 'Criar Estratégia de Funis'}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {clientName}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewModelClick}
                className="gap-2 text-xs"
              >
                {isCEO ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                Adicionar novo modelo
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 space-y-6">
              {/* Platform Selection */}
              <StrategyPlatformSelector
                metaEnabled={metaEnabled}
                setMetaEnabled={setMetaEnabled}
                googleEnabled={googleEnabled}
                setGoogleEnabled={setGoogleEnabled}
                linkedinEnabled={linkedinEnabled}
                setLinkedinEnabled={setLinkedinEnabled}
              />

              {/* Meta Funnels */}
              {metaEnabled && (
                <div className="space-y-3">
                  <StrategyMetaFunnels
                    millennialsMensagem={metaMillennialsMensagem}
                    setMillennialsMensagem={setMetaMillennialsMensagem}
                    millennialsCadastro={metaMillennialsCadastro}
                    setMillennialsCadastro={setMetaMillennialsCadastro}
                    millennialsCall={metaMillennialsCall}
                    setMillennialsCall={setMetaMillennialsCall}
                    captacaoRepresentantes={metaCaptacaoRepresentantes}
                    setCaptacaoRepresentantes={setMetaCaptacaoRepresentantes}
                    captacaoSdr={metaCaptacaoSdr}
                    setCaptacaoSdr={setMetaCaptacaoSdr}
                    disparoEmail={metaDisparoEmail}
                    setDisparoEmail={setMetaDisparoEmail}
                    grupoVip={metaGrupoVip}
                    setGrupoVip={setMetaGrupoVip}
                    aumentoBase={metaAumentoBase}
                    setAumentoBase={setMetaAumentoBase}
                    siteCadastro={metaSiteCadastro}
                    setSiteCadastro={setMetaSiteCadastro}
                  />
                  {metaTemplates.length > 0 && (
                    <CustomFunnelCards
                      templates={metaTemplates}
                      customFunnels={customFunnels}
                      setCustomFunnels={setCustomFunnels}
                    />
                  )}
                </div>
              )}

              {/* Google Funnels */}
              {googleEnabled && (
                <div className="space-y-3">
                  <StrategyGoogleFunnels
                    pmax={googlePmax}
                    setPmax={setGooglePmax}
                    pesquisa={googlePesquisa}
                    setPesquisa={setGooglePesquisa}
                    display={googleDisplay}
                    setDisplay={setGoogleDisplay}
                  />
                  {googleTemplates.length > 0 && (
                    <CustomFunnelCards
                      templates={googleTemplates}
                      customFunnels={customFunnels}
                      setCustomFunnels={setCustomFunnels}
                    />
                  )}
                </div>
              )}

              {/* LinkedIn Funnels */}
              {linkedinEnabled && (
                <div className="space-y-3">
                  <StrategyLinkedInFunnels
                    vagas={linkedinVagas}
                    setVagas={setLinkedinVagas}
                    cadastro={linkedinCadastro}
                    setCadastro={setLinkedinCadastro}
                  />
                  {linkedinTemplates.length > 0 && (
                    <CustomFunnelCards
                      templates={linkedinTemplates}
                      customFunnels={customFunnels}
                      setCustomFunnels={setCustomFunnels}
                    />
                  )}
                </div>
              )}

              {/* General Settings */}
              <StrategyGeneralSettings
                minimumInvestment={minimumInvestment}
                setMinimumInvestment={setMinimumInvestment}
                recommendedInvestment={recommendedInvestment}
                setRecommendedInvestment={setRecommendedInvestment}
                adLocation={adLocation}
                setAdLocation={setAdLocation}
                useClientMaterial={useClientMaterial}
                setUseClientMaterial={setUseClientMaterial}
                clientMaterialDetails={clientMaterialDetails}
                setClientMaterialDetails={setClientMaterialDetails}
              />

              {/* Profile Assessment Blocks */}
              <StrategyProfileBlocks
                bio={profileBio}
                setBio={setProfileBio}
                destaques={profileDestaques}
                setDestaques={setProfileDestaques}
                posts={profilePosts}
                setPosts={setProfilePosts}
                lpSite={profileLpSite}
                setLpSite={setProfileLpSite}
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
                <Rocket className="w-4 h-4" />
              )}
              {existingStrategy ? 'Salvar Alterações' : 'Criar Estratégia'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Creator Modal (CEO only) */}
      <StrategyTemplateCreatorModal
        isOpen={showTemplateCreator}
        onClose={() => setShowTemplateCreator(false)}
      />
    </>
  );
}
