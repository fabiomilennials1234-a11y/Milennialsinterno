import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useCreateStrategyTemplate,
  getFieldsForPlatform,
  ICON_COLORS,
} from '@/hooks/useStrategyTemplates';

interface StrategyTemplateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLATFORM_OPTIONS = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)', emoji: '📘' },
  { value: 'google', label: 'Google Ads', emoji: '🔍' },
  { value: 'linkedin', label: 'LinkedIn Ads', emoji: '💼' },
];

export default function StrategyTemplateCreatorModal({
  isOpen,
  onClose,
}: StrategyTemplateCreatorModalProps) {
  const createTemplate = useCreateStrategyTemplate();

  const [platform, setPlatform] = useState('meta');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [howItWorks, setHowItWorks] = useState('');
  const [iconColor, setIconColor] = useState(ICON_COLORS[0].value);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const availableFields = getFieldsForPlatform(platform);

  const toggleField = (key: string) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const handlePlatformChange = (newPlatform: string) => {
    setPlatform(newPlatform);
    setSelectedFields([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome do modelo é obrigatório');
      return;
    }
    if (!description.trim()) {
      toast.error('Descrição do modelo é obrigatória');
      return;
    }

    const howItWorksItems = howItWorks
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    await createTemplate.mutateAsync({
      platform,
      name: name.trim(),
      description: description.trim(),
      how_it_works: howItWorksItems,
      icon_color: iconColor,
      visible_fields: selectedFields,
    });

    // Reset form
    setName('');
    setDescription('');
    setHowItWorks('');
    setSelectedFields([]);
    setIconColor(ICON_COLORS[0].value);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Criar Novo Modelo de Estratégia
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Este modelo ficará disponível para todos os usuários
              </p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-6">
            {/* Platform Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Plataforma *</Label>
              <div className="grid grid-cols-3 gap-3">
                {PLATFORM_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePlatformChange(opt.value)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left',
                      platform === opt.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do Modelo *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Millennials Webinar, Captação de Parceiros..."
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Descrição Curta *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Campanha para captação de leads via webinar"
              />
            </div>

            {/* How It Works */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Como Funciona (um item por linha)</Label>
              <Textarea
                value={howItWorks}
                onChange={(e) => setHowItWorks(e.target.value)}
                placeholder={"Campanha direcionada para...\nUtiliza formulário de cadastro\nLeads caem no CRM automaticamente"}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Cada linha vira um item na lista "Como funciona" do funil
              </p>
            </div>

            {/* Icon Color */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cor do Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setIconColor(color.value)}
                    className={cn(
                      'w-10 h-10 rounded-lg bg-gradient-to-br transition-all',
                      color.value,
                      iconColor === color.value
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                        : 'opacity-70 hover:opacity-100'
                    )}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Fields Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Campos do Modelo (além de Verba Mensal, que é padrão)
              </Label>
              <div className="space-y-2">
                {availableFields.map(field => (
                  <div
                    key={field.key}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-colors',
                      selectedFields.includes(field.key)
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{field.label}</span>
                      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                        {field.type === 'textarea' ? 'Texto longo' : field.type === 'switch' ? 'Sim/Não' : 'Texto'}
                      </span>
                    </div>
                    <Switch
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={createTemplate.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createTemplate.isPending} className="gap-2">
            {createTemplate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Criar Modelo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
