import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, DollarSign, Briefcase, FileText, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinkedInStrategy } from '@/hooks/useClientStrategies';

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

interface StrategyLinkedInFunnelsProps {
  vagas: LinkedInStrategy;
  setVagas: (value: LinkedInStrategy) => void;
  cadastro: LinkedInStrategy;
  setCadastro: (value: LinkedInStrategy) => void;
}

export default function StrategyLinkedInFunnels({
  vagas,
  setVagas,
  cadastro,
  setCadastro,
}: StrategyLinkedInFunnelsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">💼</span>
        <h3 className="text-lg font-semibold text-foreground">Funis LinkedIn Ads</h3>
      </div>

      <div className="space-y-3">
        {/* Vagas */}
        <FunnelCard
          title="Millennials Vagas"
          description="Campanhas de divulgação de vagas para atrair talentos qualificados"
          icon={<Briefcase className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-blue-600 to-blue-800"
          enabled={vagas.enabled}
          setEnabled={(v) => setVagas({ ...vagas, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funcionam as Campanhas de Vagas no LinkedIn:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Anúncios direcionados para profissionais qualificados</li>
                <li>Segmentação por cargo, experiência, habilidades e localização</li>
                <li>Formatos: Single Image, Carousel, Video</li>
                <li>CTA direcionando para página de candidatura ou formulário Lead Gen</li>
                <li><strong>Investimento mínimo recomendado:</strong> R$ 50/dia (≈ R$ 1.500/mês)</li>
              </ul>
            </div>

            <div className="p-3 bg-warning/10 rounded-lg text-sm text-warning border border-warning/20">
              <strong>⚠️ Criativos recomendados:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Imagens do ambiente de trabalho</li>
                <li>Vídeos de depoimentos de colaboradores</li>
                <li>Carrossel mostrando benefícios da vaga</li>
                <li>Formato 1:1 ou 1.91:1 para melhor performance</li>
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
                value={vagas.budget || ''}
                onChange={(e) => setVagas({ ...vagas, budget: Number(e.target.value) })}
                placeholder="Mínimo recomendado: R$ 1.500"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={vagas.scripts_url || ''}
                onChange={(e) => setVagas({ ...vagas, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>

        {/* Cadastro */}
        <FunnelCard
          title="Millennials Cadastro"
          description="Lead Gen Forms para capturar leads B2B qualificados"
          icon={<FileText className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-blue-700 to-indigo-800"
          enabled={cadastro.enabled}
          setEnabled={(v) => setCadastro({ ...cadastro, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funcionam as Campanhas de Cadastro no LinkedIn:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Lead Gen Forms nativos - preenchimento automático de dados</li>
                <li>Altíssima taxa de conversão por reduzir fricção</li>
                <li>Leads B2B extremamente qualificados (decisores)</li>
                <li>Segmentação precisa por cargo, empresa, setor, tamanho</li>
                <li><strong>Investimento mínimo recomendado:</strong> R$ 75/dia (≈ R$ 2.250/mês)</li>
              </ul>
            </div>

            <div className="p-3 bg-warning/10 rounded-lg text-sm text-warning border border-warning/20">
              <strong>⚠️ Criativos recomendados:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Cases de sucesso em imagem única</li>
                <li>Estatísticas relevantes para o público-alvo</li>
                <li>Vídeos curtos (15-30s) com proposta de valor clara</li>
                <li>E-books, whitepapers ou webinars como isca</li>
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
                value={cadastro.budget || ''}
                onChange={(e) => setCadastro({ ...cadastro, budget: Number(e.target.value) })}
                placeholder="Mínimo recomendado: R$ 2.250"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={cadastro.scripts_url || ''}
                onChange={(e) => setCadastro({ ...cadastro, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros aqui..."
              />
            </div>
          </div>
        </FunnelCard>
      </div>
    </div>
  );
}
