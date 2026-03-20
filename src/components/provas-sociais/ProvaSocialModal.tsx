import { useState, useEffect } from 'react';
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
import { X, Plus, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProvasSociais, uploadLogo, type ProvaSocialMetric } from '@/hooks/useProvasSociais';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProvaSocialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: {
    id: string;
    client_name: string;
    client_logo_url: string | null;
    project_duration: string;
    strategy_description: string | null;
    metrics: ProvaSocialMetric[];
  } | null;
}

interface MetricInput {
  id?: string;
  type_id: string;
  type_name: string;
  value: number;
}

export default function ProvaSocialModal({ open, onOpenChange, editData }: ProvaSocialModalProps) {
  const {
    types,
    createProvaSocial,
    updateProvaSocial,
    addMetric,
    updateMetric,
    removeMetric,
    createType,
  } = useProvasSociais();

  const [clientName, setClientName] = useState('');
  const [projectDuration, setProjectDuration] = useState('');
  const [strategyDescription, setStrategyDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricInput[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomType, setShowCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');

  const isEditing = !!editData;

  useEffect(() => {
    if (editData) {
      setClientName(editData.client_name);
      setProjectDuration(editData.project_duration);
      setStrategyDescription(editData.strategy_description || '');
      setLogoUrl(editData.client_logo_url);
      setLogoPreview(editData.client_logo_url);
      setMetrics(
        editData.metrics.map((m) => ({
          id: m.id,
          type_id: m.type_id,
          type_name: m.type_name,
          value: m.value,
        }))
      );
    } else {
      resetForm();
    }
  }, [editData, open]);

  const resetForm = () => {
    setClientName('');
    setProjectDuration('');
    setStrategyDescription('');
    setLogoUrl(null);
    setLogoFile(null);
    setLogoPreview(null);
    setMetrics([]);
    setSelectedTypeId('');
    setShowCustomType(false);
    setCustomTypeName('');
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddMetric = () => {
    if (!selectedTypeId) return;
    const type = types.find((t) => t.id === selectedTypeId);
    if (!type) return;
    if (metrics.some((m) => m.type_id === selectedTypeId)) return;
    setMetrics([...metrics, { type_id: type.id, type_name: type.name, value: 0 }]);
    setSelectedTypeId('');
  };

  const handleAddCustomType = async () => {
    if (!customTypeName.trim()) return;
    try {
      const result = await createType.mutateAsync(customTypeName.trim());
      setMetrics([...metrics, { type_id: result.id, type_name: result.name, value: 0 }]);
      setCustomTypeName('');
      setShowCustomType(false);
    } catch {
      // error handled in hook
    }
  };

  const handleRemoveMetric = (index: number) => {
    setMetrics(metrics.filter((_, i) => i !== index));
  };

  const handleMetricValueChange = (index: number, value: string) => {
    const updated = [...metrics];
    updated[index].value = Number(value) || 0;
    setMetrics(updated);
  };

  const handleSubmit = async () => {
    if (!clientName.trim() || !projectDuration.trim()) return;
    if (!strategyDescription.trim()) {
      toast.error('Preencha o campo "Como você fez isso?" antes de salvar.');
      return;
    }
    setIsSubmitting(true);

    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadLogo(logoFile);
      }

      if (isEditing && editData) {
        await updateProvaSocial.mutateAsync({
          id: editData.id,
          client_name: clientName.trim(),
          client_logo_url: finalLogoUrl,
          project_duration: projectDuration.trim(),
          strategy_description: strategyDescription.trim(),
        });

        const existingIds = editData.metrics.map((m) => m.id);
        const currentIds = metrics.filter((m) => m.id).map((m) => m.id!);

        for (const existingId of existingIds) {
          if (!currentIds.includes(existingId)) {
            await removeMetric.mutateAsync(existingId);
          }
        }

        for (const metric of metrics) {
          if (metric.id) {
            const original = editData.metrics.find((m) => m.id === metric.id);
            if (original && original.value !== metric.value) {
              await updateMetric.mutateAsync({ id: metric.id, value: metric.value });
            }
          }
        }

        for (const metric of metrics) {
          if (!metric.id) {
            await addMetric.mutateAsync({
              prova_social_id: editData.id,
              type_id: metric.type_id,
              type_name: metric.type_name,
              value: metric.value,
            });
          }
        }
      } else {
        await createProvaSocial.mutateAsync({
          client_name: clientName.trim(),
          client_logo_url: finalLogoUrl,
          project_duration: projectDuration.trim(),
          strategy_description: strategyDescription.trim(),
          metrics: metrics.map((m) => ({
            type_id: m.type_id,
            type_name: m.type_name,
            value: m.value,
          })),
        });
      }

      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error('Erro ao salvar prova social: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableTypes = types.filter((t) => !metrics.some((m) => m.type_id === t.id));

  const isFormValid = clientName.trim() && projectDuration.trim() && strategyDescription.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? 'Editar Prova Social' : 'Registrar Prova Social'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Logo Upload */}
          <div>
            <Label className="text-muted-foreground text-sm">Logo do Cliente</Label>
            <div className="flex items-center gap-3 mt-1.5">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Preview"
                  className="w-12 h-12 rounded-lg object-contain border border-border bg-white p-0.5"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground text-lg font-bold">
                  {clientName.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                  <Upload size={14} />
                  <span>Enviar logo</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
          </div>

          {/* Client Name */}
          <div>
            <Label className="text-muted-foreground text-sm">Nome do Cliente</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: Empresa XYZ"
              className="mt-1.5 bg-muted/30 border-border"
            />
          </div>

          {/* Project Duration */}
          <div>
            <Label className="text-muted-foreground text-sm">Duração do Projeto</Label>
            <Input
              value={projectDuration}
              onChange={(e) => setProjectDuration(e.target.value)}
              placeholder="Ex: 4 meses"
              className="mt-1.5 bg-muted/30 border-border"
            />
          </div>

          {/* Metrics */}
          <div>
            <Label className="text-muted-foreground text-sm">Métricas</Label>
            <div className="space-y-2 mt-1.5">
              {metrics.map((metric, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-sm text-foreground min-w-[100px]">{metric.type_name}</span>
                  <Input
                    type="number"
                    value={metric.value || ''}
                    onChange={(e) => handleMetricValueChange(index, e.target.value)}
                    className="flex-1 bg-muted/30 border-border"
                    placeholder="Valor"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMetric(index)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ))}

              {availableTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger className="flex-1 bg-muted/30 border-border">
                      <SelectValue placeholder="Selecione um tipo de métrica" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-border"
                    onClick={handleAddMetric}
                    disabled={!selectedTypeId}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
              )}

              {showCustomType ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="Nome do novo tipo"
                    className="flex-1 bg-muted/30 border-border"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomType()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    onClick={handleAddCustomType}
                    disabled={!customTypeName.trim()}
                  >
                    Criar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setShowCustomType(false);
                      setCustomTypeName('');
                    }}
                  >
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs"
                  onClick={() => setShowCustomType(true)}
                >
                  <Plus size={12} className="mr-1" />
                  Criar tipo personalizado
                </Button>
              )}
            </div>
          </div>

          {/* Strategy Description - Obrigatório */}
          <div>
            <Label className="text-muted-foreground text-sm">
              Como você fez isso? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={strategyDescription}
              onChange={(e) => setStrategyDescription(e.target.value)}
              placeholder="Descreva a estratégia usada para alcançar esses resultados. Ex: Estruturamos campanha no Meta Ads, criamos landing page, ativamos CRM..."
              className="mt-1.5 bg-muted/30 border-border min-h-[80px] resize-none"
            />
            {!strategyDescription.trim() && (
              <p className="text-xs text-muted-foreground mt-1">Campo obrigatório</p>
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Salvando...
              </>
            ) : isEditing ? (
              'Salvar Alterações'
            ) : (
              'Registrar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
