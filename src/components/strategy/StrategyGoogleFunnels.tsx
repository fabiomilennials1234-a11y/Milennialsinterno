import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, DollarSign, Zap, Search, Monitor, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoogleStrategy } from '@/hooks/useClientStrategies';

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

interface StrategyGoogleFunnelsProps {
  pmax: GoogleStrategy;
  setPmax: (value: GoogleStrategy) => void;
  pesquisa: GoogleStrategy;
  setPesquisa: (value: GoogleStrategy) => void;
  display: GoogleStrategy;
  setDisplay: (value: GoogleStrategy) => void;
}

export default function StrategyGoogleFunnels({
  pmax,
  setPmax,
  pesquisa,
  setPesquisa,
  display,
  setDisplay,
}: StrategyGoogleFunnelsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔍</span>
        <h3 className="text-lg font-semibold text-foreground">Funis Google Ads</h3>
      </div>

      <div className="space-y-3">
        {/* Performance Max */}
        <FunnelCard
          title="Millennials Pmax"
          description="Performance Max - Campanha automatizada que otimiza em todos os canais do Google"
          icon={<Zap className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-red-500 to-yellow-500"
          enabled={pmax.enabled}
          setEnabled={(v) => setPmax({ ...pmax, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona a Performance Max:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Campanha automatizada pelo machine learning do Google</li>
                <li>Otimização automática em: Pesquisa, Display, YouTube, Gmail, Maps, Discovery</li>
                <li>Utiliza sinais de audiência e assets criativos fornecidos</li>
                <li>Ideal para e-commerces e geração de leads qualificados</li>
                <li>Requer um período de aprendizado de 2-4 semanas</li>
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
                value={pmax.budget || ''}
                onChange={(e) => setPmax({ ...pmax, budget: Number(e.target.value) })}
                placeholder="Ex: 3000"
              />
            </div>

            <div className="space-y-2">
              <Label>Palavras-Chave (Sinais de Audiência)</Label>
              <Textarea
                value={pmax.keywords || ''}
                onChange={(e) => setPmax({ ...pmax, keywords: e.target.value })}
                placeholder="Uma palavra-chave por linha..."
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Títulos dos Anúncios</Label>
                <Textarea
                  value={pmax.ad_titles || ''}
                  onChange={(e) => setPmax({ ...pmax, ad_titles: e.target.value })}
                  placeholder="Um título por linha (máx 30 caracteres cada)..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrições dos Anúncios</Label>
                <Textarea
                  value={pmax.ad_descriptions || ''}
                  onChange={(e) => setPmax({ ...pmax, ad_descriptions: e.target.value })}
                  placeholder="Uma descrição por linha (máx 90 caracteres cada)..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sitelinks</Label>
                <Textarea
                  value={pmax.sitelinks || ''}
                  onChange={(e) => setPmax({ ...pmax, sitelinks: e.target.value })}
                  placeholder="Formato: Título | URL | Descrição 1 | Descrição 2"
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Frases de Destaque (Callouts)</Label>
                <Textarea
                  value={pmax.callouts || ''}
                  onChange={(e) => setPmax({ ...pmax, callouts: e.target.value })}
                  placeholder="Uma frase por linha (máx 25 caracteres cada)..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </FunnelCard>

        {/* Rede de Pesquisa */}
        <FunnelCard
          title="Millennials Rede de Pesquisa"
          description="Anúncios na busca do Google para captar leads com alta intenção de compra"
          icon={<Search className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          enabled={pesquisa.enabled}
          setEnabled={(v) => setPesquisa({ ...pesquisa, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona a Rede de Pesquisa:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Anúncios aparecem quando usuários pesquisam palavras-chave específicas</li>
                <li>Alta intenção de compra - pessoa está ativamente buscando</li>
                <li>Controle total sobre palavras-chave, lances e segmentação</li>
                <li>Ideal para serviços e produtos com demanda existente</li>
                <li>Resultados mais rápidos que outras campanhas</li>
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
                value={pesquisa.budget || ''}
                onChange={(e) => setPesquisa({ ...pesquisa, budget: Number(e.target.value) })}
                placeholder="Ex: 2500"
              />
            </div>

            <div className="space-y-2">
              <Label>Palavras-Chave</Label>
              <Textarea
                value={pesquisa.keywords || ''}
                onChange={(e) => setPesquisa({ ...pesquisa, keywords: e.target.value })}
                placeholder="Uma palavra-chave por linha. Use [colchetes] para exata, &quot;aspas&quot; para frase..."
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Títulos dos Anúncios</Label>
                <Textarea
                  value={pesquisa.ad_titles || ''}
                  onChange={(e) => setPesquisa({ ...pesquisa, ad_titles: e.target.value })}
                  placeholder="Um título por linha (máx 30 caracteres cada)..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrições dos Anúncios</Label>
                <Textarea
                  value={pesquisa.ad_descriptions || ''}
                  onChange={(e) => setPesquisa({ ...pesquisa, ad_descriptions: e.target.value })}
                  placeholder="Uma descrição por linha (máx 90 caracteres cada)..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sitelinks</Label>
                <Textarea
                  value={pesquisa.sitelinks || ''}
                  onChange={(e) => setPesquisa({ ...pesquisa, sitelinks: e.target.value })}
                  placeholder="Formato: Título | URL | Descrição 1 | Descrição 2"
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Frases de Destaque (Callouts)</Label>
                <Textarea
                  value={pesquisa.callouts || ''}
                  onChange={(e) => setPesquisa({ ...pesquisa, callouts: e.target.value })}
                  placeholder="Uma frase por linha (máx 25 caracteres cada)..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </FunnelCard>

        {/* Display */}
        <FunnelCard
          title="Millennials Display"
          description="Banners visuais em sites parceiros do Google para remarketing e awareness"
          icon={<Monitor className="w-5 h-5 text-white" />}
          color="bg-gradient-to-br from-green-500 to-green-600"
          enabled={display.enabled}
          setEnabled={(v) => setDisplay({ ...display, enabled: v })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
              <strong>Como funciona a Rede de Display:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Anúncios visuais (banners, imagens, vídeos) em sites parceiros</li>
                <li>Alcance massivo - mais de 90% dos usuários de internet</li>
                <li>Excelente para remarketing e reconhecimento de marca</li>
                <li>Segmentação por interesses, tópicos, sites específicos ou audiências</li>
                <li>CPC geralmente mais baixo que pesquisa</li>
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
                value={display.budget || ''}
                onChange={(e) => setDisplay({ ...display, budget: Number(e.target.value) })}
                placeholder="Ex: 1500"
              />
            </div>

            <div className="space-y-2">
              <Label>Palavras-Chave / Tópicos de Segmentação</Label>
              <Textarea
                value={display.keywords || ''}
                onChange={(e) => setDisplay({ ...display, keywords: e.target.value })}
                placeholder="Palavras-chave, tópicos ou sites para segmentação..."
                className="min-h-[100px] font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Títulos dos Anúncios</Label>
                <Textarea
                  value={display.ad_titles || ''}
                  onChange={(e) => setDisplay({ ...display, ad_titles: e.target.value })}
                  placeholder="Um título por linha..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrições dos Anúncios</Label>
                <Textarea
                  value={display.ad_descriptions || ''}
                  onChange={(e) => setDisplay({ ...display, ad_descriptions: e.target.value })}
                  placeholder="Uma descrição por linha..."
                  className="min-h-[80px] font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Link dos Roteiros (Banners/Imagens)
                <span className="text-xs text-muted-foreground ml-auto">Máximo 4 roteiros</span>
              </Label>
              <Input
                value={display.scripts_url || ''}
                onChange={(e) => setDisplay({ ...display, scripts_url: e.target.value })}
                placeholder="Cole o link dos roteiros/banners aqui..."
              />
            </div>
          </div>
        </FunnelCard>
      </div>
    </div>
  );
}
