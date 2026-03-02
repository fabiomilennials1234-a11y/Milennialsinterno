import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { DollarSign, MapPin, Wrench, Users } from 'lucide-react';

interface OutboundStrategyGeneralSettingsProps {
  monthlyBudget: number;
  setMonthlyBudget: (value: number) => void;
  targetRegion: string;
  setTargetRegion: (value: string) => void;
  targetIcp: string;
  setTargetIcp: (value: string) => void;
  toolsUsed: string;
  setToolsUsed: (value: string) => void;
  useClientBase: boolean;
  setUseClientBase: (value: boolean) => void;
  clientBaseDetails: string;
  setClientBaseDetails: (value: string) => void;
}

export default function OutboundStrategyGeneralSettings({
  monthlyBudget,
  setMonthlyBudget,
  targetRegion,
  setTargetRegion,
  targetIcp,
  setTargetIcp,
  toolsUsed,
  setToolsUsed,
  useClientBase,
  setUseClientBase,
  clientBaseDetails,
  setClientBaseDetails,
}: OutboundStrategyGeneralSettingsProps) {
  return (
    <div className="space-y-4 p-5 bg-muted/30 rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-success" />
        <h3 className="text-lg font-semibold text-foreground">Configurações Gerais</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            Orçamento Mensal (R$)
            <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            step="100"
            value={monthlyBudget || ''}
            onChange={(e) => setMonthlyBudget(Number(e.target.value))}
            placeholder="Ex: 3000"
            className={!monthlyBudget ? 'border-destructive/50' : ''}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Região Alvo
            <span className="text-destructive">*</span>
          </Label>
          <Input
            value={targetRegion}
            onChange={(e) => setTargetRegion(e.target.value)}
            placeholder="Ex: Brasil, São Paulo, Sul do Brasil..."
            className={!targetRegion?.trim() ? 'border-destructive/50' : ''}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Perfil de Cliente Ideal (ICP)
          <span className="text-destructive">*</span>
        </Label>
        <Textarea
          value={targetIcp}
          onChange={(e) => setTargetIcp(e.target.value)}
          placeholder="Descreva o perfil ideal: cargo, porte da empresa, setor, faturamento, dores..."
          className={`min-h-[80px] ${!targetIcp?.trim() ? 'border-destructive/50' : ''}`}
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-muted-foreground" />
          Ferramentas Utilizadas
        </Label>
        <Input
          value={toolsUsed}
          onChange={(e) => setToolsUsed(e.target.value)}
          placeholder="Ex: Pipedrive, RD Station, Lemlist, PhoneTrack..."
        />
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-info" />
            <div>
              <Label className="text-base font-semibold">Cliente possui base de contatos?</Label>
              <p className="text-sm text-muted-foreground">
                O cliente já possui uma base de leads/contatos para trabalhar
              </p>
            </div>
          </div>
          <Switch
            checked={useClientBase}
            onCheckedChange={setUseClientBase}
          />
        </div>

        {useClientBase && (
          <div className="space-y-2 mt-4 p-4 bg-info/5 rounded-lg border border-info/20">
            <Label>Detalhes da Base</Label>
            <Textarea
              value={clientBaseDetails}
              onChange={(e) => setClientBaseDetails(e.target.value)}
              placeholder="Descreva a base: tamanho, qualidade, origem, formato (planilha, CRM, etc)..."
              className="min-h-[100px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
