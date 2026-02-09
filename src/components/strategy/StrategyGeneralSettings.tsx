import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { DollarSign, MapPin, Video } from 'lucide-react';

interface StrategyGeneralSettingsProps {
  minimumInvestment: number;
  setMinimumInvestment: (value: number) => void;
  recommendedInvestment: number;
  setRecommendedInvestment: (value: number) => void;
  adLocation: string;
  setAdLocation: (value: string) => void;
  useClientMaterial: boolean;
  setUseClientMaterial: (value: boolean) => void;
  clientMaterialDetails: string;
  setClientMaterialDetails: (value: string) => void;
}

export default function StrategyGeneralSettings({
  minimumInvestment,
  setMinimumInvestment,
  recommendedInvestment,
  setRecommendedInvestment,
  adLocation,
  setAdLocation,
  useClientMaterial,
  setUseClientMaterial,
  clientMaterialDetails,
  setClientMaterialDetails,
}: StrategyGeneralSettingsProps) {
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
            Investimento Mínimo (R$)
            <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            step="100"
            value={minimumInvestment || ''}
            onChange={(e) => setMinimumInvestment(Number(e.target.value))}
            placeholder="Ex: 1500"
            className={!minimumInvestment ? 'border-destructive/50' : ''}
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            Investimento Recomendado (R$)
            <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            step="100"
            value={recommendedInvestment || ''}
            onChange={(e) => setRecommendedInvestment(Number(e.target.value))}
            placeholder="Ex: 3000"
            className={!recommendedInvestment ? 'border-destructive/50' : ''}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          Localização dos Anúncios
          <span className="text-destructive">*</span>
        </Label>
        <Input
          value={adLocation}
          onChange={(e) => setAdLocation(e.target.value)}
          placeholder="Ex: Florianópolis e região, Santa Catarina, Brasil..."
          className={!adLocation?.trim() ? 'border-destructive/50' : ''}
          required
        />
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-info" />
            <div>
              <Label className="text-base font-semibold">Usar material do cliente?</Label>
              <p className="text-sm text-muted-foreground">
                Vamos utilizar vídeos ou materiais existentes do cliente para os anúncios
              </p>
            </div>
          </div>
          <Switch
            checked={useClientMaterial}
            onCheckedChange={setUseClientMaterial}
          />
        </div>

        {useClientMaterial && (
          <div className="space-y-2 mt-4 p-4 bg-info/5 rounded-lg border border-info/20">
            <Label>Quais materiais e em quais campanhas?</Label>
            <Textarea
              value={clientMaterialDetails}
              onChange={(e) => setClientMaterialDetails(e.target.value)}
              placeholder="Descreva quais vídeos/materiais do cliente serão utilizados e em quais funis/campanhas..."
              className="min-h-[100px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}
