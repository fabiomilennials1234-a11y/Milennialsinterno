import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, DollarSign, MessageSquare, FileText, Users, Mail, Star, TrendingUp, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MetaStrategy } from '@/hooks/useClientStrategies';

interface FunnelCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  children: React.ReactNode;
  color: string;
}

function FunnelCard({ title, description, icon, enabled, setEnabled, children, color }: FunnelCardProps) {
  const [isExpanded, setIsExpanded] = useState(enabled);

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      enabled ? 'border-primary bg-primary/5' : 'border-border bg-card'
    )}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{title}</h4>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => {
                  setEnabled(checked);
                  if (checked) setIsExpanded(true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </div>

      {isExpanded && enabled && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface StrategyMetaFunnelsProps {
  millennialsMensagem: MetaStrategy;
  setMillennialsMensagem: (value: MetaStrategy) => void;
  millennialsCadastro: MetaStrategy;
  setMillennialsCadastro: (value: MetaStrategy) => void;
  millennialsCall: MetaStrategy;
  setMillennialsCall: (value: MetaStrategy) => void;
  captacaoRepresentantes: MetaStrategy;
  setCaptacaoRepresentantes: (value: MetaStrategy) => void;
  captacaoSdr: MetaStrategy;
  setCaptacaoSdr: (value: MetaStrategy) => void;
  disparoEmail: MetaStrategy;
  setDisparoEmail: (value: MetaStrategy) => void;
  grupoVip: MetaStrategy;
  setGrupoVip: (value: MetaStrategy) => void;
  aumentoBase: MetaStrategy;
  setAumentoBase: (value: MetaStrategy) => void;
}

export default function StrategyMetaFunnels({
  millennialsMensagem,
  setMillennialsMensagem,
  millennialsCadastro,
  setMillennialsCadastro,
  millennialsCall,
  setMillennialsCall,
  captacaoRepresentantes,
  setCaptacaoRepresentantes,
  captacaoSdr,
  setCaptacaoSdr,
  disparoEmail,
  setDisparoEmail,
  grupoVip,
  setGrupoVip,
  aumentoBase,
  setAumentoBase,
}: StrategyMetaFunnelsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📘</span>
        <h3 className="text-lg font-semibold text-foreground">Funis Meta (Facebook/Instagram)</h3>
      </div>

      <div className="space-y-3">
        {/* Millennials Mensagem */}
        <FunnelCard
          title="Millennials Mensagem"
          description="Estratégia de mensagem com filtros fortes para gerar leads qualificados e extremamente filtrados"
          icon={<MessageSquare className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          enabled={millennialsMensagem.enabled}
          setEnabled={(v) => setMillennialsMensagem({ ...millennialsMensagem, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Campanha enviando ao WhatsApp/Direct</li>
                <li>Mensagem padrão configurada para o cliente</li>
                <li>Automação interna com filtro forte (CNPJ ou outro)</li>
                <li>Treinamentos comerciais para criação de scripts são essenciais</li>
                <li>Todos os Advantage+ serão desativados</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Verba Mensal (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={millennialsMensagem.budget || ''}
                  onChange={(e) => setMillennialsMensagem({ ...millennialsMensagem, budget: Number(e.target.value) })}
                  placeholder="Ex: 1500"
                />
              </div>
              <div className="space-y-2">
                <Label>Anúncio Nacional?</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={millennialsMensagem.is_national || false}
                    onCheckedChange={(v) => setMillennialsMensagem({ ...millennialsMensagem, is_national: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {millennialsMensagem.is_national ? 'Sim' : 'Não (citaremos região no criativo)'}
                  </span>
                </div>
              </div>
            </div>

            {!millennialsMensagem.is_national && (
              <div className="space-y-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
                <Label>Região do Anúncio</Label>
                <Input
                  value={millennialsMensagem.region || ''}
                  onChange={(e) => setMillennialsMensagem({ ...millennialsMensagem, region: e.target.value })}
                  placeholder="Ex: Florianópolis e região"
                />
                <p className="text-xs text-warning">
                  ⚠️ No criativo será citado obrigatoriamente: "Se você mora em {millennialsMensagem.region || '[região]'}..."
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensagem Padrão para Envio</Label>
              <Textarea
                value={millennialsMensagem.default_message || ''}
                onChange={(e) => setMillennialsMensagem({ ...millennialsMensagem, default_message: e.target.value })}
                placeholder="Ex: Olá! Vi seu anúncio e gostaria de saber mais sobre..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem Automática de Filtro</Label>
              <Textarea
                value={millennialsMensagem.auto_filter_message || ''}
                onChange={(e) => setMillennialsMensagem({ ...millennialsMensagem, auto_filter_message: e.target.value })}
                placeholder="Ex: Obrigado pelo contato! Para continuarmos, preciso do seu CNPJ..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={millennialsMensagem.scripts_url || ''}
                onChange={(e) => setMillennialsMensagem({ ...millennialsMensagem, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Millennials Cadastro */}
        <FunnelCard
          title="Millennials Cadastro"
          description="4 criativos com cadastro como filtro para curiosos, perguntando CNPJ de início"
          icon={<FileText className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-green-500 to-green-600"
          enabled={millennialsCadastro.enabled}
          setEnabled={(v) => setMillennialsCadastro({ ...millennialsCadastro, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>4 criativos de anúncios com botão "Obter Cotação"</li>
                <li>Cadastro como filtro - perguntamos CNPJ logo de início</li>
                <li>Pergunta anti-turista: "Você mora na Região X?"</li>
                <li>Todos os Advantage+ serão desativados</li>
                <li>Leads caem no CRM (do cliente ou criamos um gratuito)</li>
                <li>Automação de disparo automático para novos leads</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Verba Mensal (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={millennialsCadastro.budget || ''}
                  onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, budget: Number(e.target.value) })}
                  placeholder="Ex: 2000"
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente possui CRM?</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={millennialsCadastro.has_crm || false}
                    onCheckedChange={(v) => setMillennialsCadastro({ ...millennialsCadastro, has_crm: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {millennialsCadastro.has_crm ? 'Sim' : 'Não (criaremos um gratuito)'}
                  </span>
                </div>
              </div>
            </div>

            {millennialsCadastro.has_crm && (
              <div className="space-y-2">
                <Label>Qual CRM o cliente usa?</Label>
                <Input
                  value={millennialsCadastro.crm_name || ''}
                  onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, crm_name: e.target.value })}
                  placeholder="Ex: Pipedrive, HubSpot, RD Station..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensagem Inicial Automática</Label>
              <Textarea
                value={millennialsCadastro.initial_dispatch_message || ''}
                onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, initial_dispatch_message: e.target.value })}
                placeholder="Mensagem enviada automaticamente quando um novo lead se cadastra..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={millennialsCadastro.scripts_url || ''}
                onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>

            {/* Campos obrigatórios do cadastro */}
            <div className="p-3 bg-warning/10 rounded-lg border border-warning/20 space-y-4">
              <p className="text-sm font-semibold text-warning">Configuração do Formulário de Cadastro (obrigatório)</p>

              <div className="space-y-2">
                <Label>Título do Cadastro</Label>
                <Input
                  value={millennialsCadastro.cadastro_title || ''}
                  onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, cadastro_title: e.target.value })}
                  placeholder="Ex: Solicite sua Cotação Gratuita"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição do Cadastro</Label>
                <Textarea
                  value={millennialsCadastro.cadastro_description || ''}
                  onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, cadastro_description: e.target.value })}
                  placeholder="Ex: Preencha o formulário abaixo para receber uma cotação personalizada..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Perguntas do Formulário</Label>
                <Textarea
                  value={millennialsCadastro.cadastro_questions || ''}
                  onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, cadastro_questions: e.target.value })}
                  placeholder={"Ex:\n1. Qual seu CNPJ?\n2. Qual seu segmento de atuação?\n3. Qual o volume mensal de compras?"}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Página de Obrigado (Lead)
                  </Label>
                  <Input
                    value={millennialsCadastro.ty_page_lead || ''}
                    onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, ty_page_lead: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Página de Obrigado (Não Lead)
                  </Label>
                  <Input
                    value={millennialsCadastro.ty_page_non_lead || ''}
                    onChange={(e) => setMillennialsCadastro({ ...millennialsCadastro, ty_page_non_lead: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          </div>
        </FunnelCard>

        {/* Millennials Call */}
        <FunnelCard
          title="Millennials Call"
          description="Campanha para agendar reuniões diretamente na agenda do cliente"
          icon={<Users className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
          enabled={millennialsCall.enabled}
          setEnabled={(v) => setMillennialsCall({ ...millennialsCall, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Cliente se cadastra para agendar uma reunião (não só contato)</li>
                <li>Landing Page específica para o cadastro</li>
                <li>Cliente cria conta de call e conecta à própria agenda</li>
                <li>Reuniões marcadas vão direto para a agenda do cliente</li>
                <li>Treinamento comercial é ESSENCIAL para conversão</li>
              </ul>
            </div>

            <div className="p-3 bg-warning/10 rounded-lg text-sm text-warning border border-warning/20">
              <strong>⚠️ Por que treinamento comercial é importante:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Scripts de vendas bem estruturados aumentam conversão</li>
                <li>Preparo para objeções comuns dos leads</li>
                <li>Técnicas de fechamento para reuniões online</li>
                <li>Follow-up adequado pós-reunião</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Verba Mensal (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={millennialsCall.budget || ''}
                  onChange={(e) => setMillennialsCall({ ...millennialsCall, budget: Number(e.target.value) })}
                  placeholder="Ex: 2500"
                />
              </div>
              <div className="space-y-2">
                <Label>Link da Landing Page</Label>
                <Input
                  value={millennialsCall.lp_url || ''}
                  onChange={(e) => setMillennialsCall({ ...millennialsCall, lp_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={millennialsCall.scripts_url || ''}
                onChange={(e) => setMillennialsCall({ ...millennialsCall, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Captação de Representantes */}
        <FunnelCard
          title="Captação de Representantes"
          description="Campanha de cadastro para CRM de vagas de representantes comerciais"
          icon={<Users className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
          enabled={captacaoRepresentantes.enabled}
          setEnabled={(v) => setCaptacaoRepresentantes({ ...captacaoRepresentantes, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Campanha de cadastro enviando para CRM de vagas que criaremos</li>
                <li>Formulário com principais informações sobre o revendedor</li>
                <li>Anúncio cita a região para evitar representantes de fora</li>
                <li>Cadastro pergunta novamente a região (dupla verificação)</li>
                <li>Campanha roda por tempo indeterminado até taxa aceitável</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Verba Mensal (R$)
              </Label>
              <Input
                type="number"
                min="0"
                value={captacaoRepresentantes.budget || ''}
                onChange={(e) => setCaptacaoRepresentantes({ ...captacaoRepresentantes, budget: Number(e.target.value) })}
                placeholder="Ex: 1500"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={captacaoRepresentantes.scripts_url || ''}
                onChange={(e) => setCaptacaoRepresentantes({ ...captacaoRepresentantes, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Captação SDR + Treinamento */}
        <FunnelCard
          title="Captação de SDR + Treinamento Comercial"
          description="Vagas de SDR com treinamento comercial incluso após contratação"
          icon={<Users className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-teal-500 to-teal-600"
          enabled={captacaoSdr.enabled}
          setEnabled={(v) => setCaptacaoSdr({ ...captacaoSdr, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Campanha de cadastro para CRM de vagas</li>
                <li>Coleta informações do candidato a SDR</li>
                <li>Anúncio e cadastro citam a região</li>
                <li>Campanha roda até taxa aceitável de candidatos</li>
                <li>Após contratação, iniciamos o treinamento comercial</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Verba Mensal (R$)
              </Label>
              <Input
                type="number"
                min="0"
                value={captacaoSdr.budget || ''}
                onChange={(e) => setCaptacaoSdr({ ...captacaoSdr, budget: Number(e.target.value) })}
                placeholder="Ex: 1500"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={captacaoSdr.scripts_url || ''}
                onChange={(e) => setCaptacaoSdr({ ...captacaoSdr, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Disparo de Email */}
        <FunnelCard
          title="Disparo de E-mail para Base Antiga"
          description="Reativação de clientes antigos através de disparo de e-mail marketing"
          icon={<Mail className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-red-500 to-red-600"
          enabled={disparoEmail.enabled}
          setEnabled={(v) => setDisparoEmail({ ...disparoEmail, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Pegamos a base antiga de clientes</li>
                <li>Configuramos disparos com objetivo de reativá-los</li>
                <li>Sequência de e-mails estratégicos</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Verba Mensal (R$)
              </Label>
              <Input
                type="number"
                min="0"
                value={disparoEmail.budget || ''}
                onChange={(e) => setDisparoEmail({ ...disparoEmail, budget: Number(e.target.value) })}
                placeholder="Ex: 500"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros de Disparo
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={disparoEmail.scripts_url || ''}
                onChange={(e) => setDisparoEmail({ ...disparoEmail, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros de e-mail aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Grupo VIP */}
        <FunnelCard
          title="Millennials Grupo VIP"
          description="Campanha de mensagem direcionando para grupo exclusivo com disparo automático"
          icon={<Star className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-yellow-500 to-yellow-600"
          enabled={grupoVip.enabled}
          setEnabled={(v) => setGrupoVip({ ...grupoVip, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Campanha de mensagem com vídeo ou estático do grupo</li>
                <li>Ao enviar mensagem, recebe disparo com link do grupo</li>
                <li>Grupo exclusivo para engajamento e conversão</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Verba Mensal (R$)
              </Label>
              <Input
                type="number"
                min="0"
                value={grupoVip.budget || ''}
                onChange={(e) => setGrupoVip({ ...grupoVip, budget: Number(e.target.value) })}
                placeholder="Ex: 1000"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem de Boas-Vindas</Label>
              <Textarea
                value={grupoVip.welcome_message || ''}
                onChange={(e) => setGrupoVip({ ...grupoVip, welcome_message: e.target.value })}
                placeholder="Mensagem que será enviada dando boas-vindas..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem Padrão</Label>
              <Textarea
                value={grupoVip.default_message || ''}
                onChange={(e) => setGrupoVip({ ...grupoVip, default_message: e.target.value })}
                placeholder="Mensagem padrão configurada..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Resposta Automática</Label>
              <Textarea
                value={grupoVip.auto_response || ''}
                onChange={(e) => setGrupoVip({ ...grupoVip, auto_response: e.target.value })}
                placeholder="Resposta automática com link do grupo..."
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={grupoVip.scripts_url || ''}
                onChange={(e) => setGrupoVip({ ...grupoVip, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Aumento de Base */}
        <FunnelCard
          title="Millennials Aumento de Base"
          description="Tráfego para perfil usando conteúdos existentes do cliente"
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-pink-500 to-pink-600"
          enabled={aumentoBase.enabled}
          setEnabled={(v) => setAumentoBase({ ...aumentoBase, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Pegamos conteúdos existentes do cliente</li>
                <li>Rodamos em tráfego direcionando para o perfil</li>
                <li>Marcamos consultoria de produção de conteúdo com o cliente</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Verba Mensal (R$)
              </Label>
              <Input
                type="number"
                min="0"
                value={aumentoBase.budget || ''}
                onChange={(e) => setAumentoBase({ ...aumentoBase, budget: Number(e.target.value) })}
                placeholder="Ex: 800"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={aumentoBase.scripts_url || ''}
                onChange={(e) => setAumentoBase({ ...aumentoBase, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>
      </div>
    </div>
  );
}
