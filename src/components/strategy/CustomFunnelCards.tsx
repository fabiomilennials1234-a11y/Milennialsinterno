import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, DollarSign, Sparkles, Trash2, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDeleteStrategyTemplate, getFieldsForPlatform } from '@/hooks/useStrategyTemplates';
import type { StrategyFunnelTemplate } from '@/hooks/useStrategyTemplates';

interface CustomFunnelData {
  enabled: boolean;
  budget: number;
  [key: string]: any;
}

interface FunnelCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  children: React.ReactNode;
  color: string;
  onDelete?: () => void;
  canDelete?: boolean;
}

function FunnelCard({ title, description, icon, enabled, setEnabled, children, color, onDelete, canDelete }: FunnelCardProps) {
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
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br', color)}>
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{title}</h4>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-medium">
                Personalizado
              </span>
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
        <div className="flex items-center gap-2">
          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Excluir modelo"
            >
              <Trash2 size={14} />
            </button>
          )}
          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </div>

      {isExpanded && enabled && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface CustomFunnelCardsProps {
  templates: StrategyFunnelTemplate[];
  customFunnels: Record<string, CustomFunnelData>;
  setCustomFunnels: (value: Record<string, CustomFunnelData>) => void;
}

export default function CustomFunnelCards({
  templates,
  customFunnels,
  setCustomFunnels,
}: CustomFunnelCardsProps) {
  const { isCEO } = useAuth();
  const deleteTemplate = useDeleteStrategyTemplate();

  if (templates.length === 0) return null;

  const getFunnelData = (templateId: string): CustomFunnelData => {
    return customFunnels[templateId] || { enabled: false, budget: 0 };
  };

  const updateFunnel = (templateId: string, data: Partial<CustomFunnelData>) => {
    const current = getFunnelData(templateId);
    setCustomFunnels({
      ...customFunnels,
      [templateId]: { ...current, ...data },
    });
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este modelo? Ele será removido de todas as estratégias futuras.')) return;
    await deleteTemplate.mutateAsync(templateId);
    // Remove from current custom funnels state
    const updated = { ...customFunnels };
    delete updated[templateId];
    setCustomFunnels(updated);
  };

  const allPlatformFields = (platform: string) => getFieldsForPlatform(platform);

  return (
    <>
      {templates.map(template => {
        const data = getFunnelData(template.id);
        const fields = allPlatformFields(template.platform);
        const visibleFields = fields.filter(f => template.visible_fields.includes(f.key));

        return (
          <FunnelCard
            key={template.id}
            title={template.name}
            description={template.description}
            icon={<Sparkles className="w-5 h-5 text-white" />}
            color={template.icon_color}
            enabled={data.enabled}
            setEnabled={(v) => updateFunnel(template.id, { enabled: v })}
            canDelete={isCEO}
            onDelete={() => handleDeleteTemplate(template.id)}
          >
            <div className="space-y-4">
              {/* How it works */}
              {template.how_it_works.length > 0 && (
                <div className="p-3 bg-info/10 rounded-lg text-sm text-info border border-info/20">
                  <strong>Como funciona:</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    {template.how_it_works.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Budget (always shown) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Verba Mensal (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={data.budget || ''}
                  onChange={(e) => updateFunnel(template.id, { budget: Number(e.target.value) })}
                  placeholder="Ex: 1500"
                />
              </div>

              {/* Dynamic fields based on template config */}
              {visibleFields.map(field => {
                if (field.type === 'switch') {
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label>{field.label}</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={data[field.key] || false}
                          onCheckedChange={(v) => updateFunnel(template.id, { [field.key]: v })}
                        />
                        <span className="text-sm text-muted-foreground">
                          {data[field.key] ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label>{field.label}</Label>
                      <Textarea
                        value={data[field.key] || ''}
                        onChange={(e) => updateFunnel(template.id, { [field.key]: e.target.value })}
                        placeholder={`Preencha ${field.label.toLowerCase()}...`}
                        className="min-h-[80px]"
                      />
                    </div>
                  );
                }

                // Default: text input
                return (
                  <div key={field.key} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {field.key.includes('url') || field.key.includes('link') ? <LinkIcon className="w-4 h-4" /> : null}
                      {field.label}
                    </Label>
                    <Input
                      value={data[field.key] || ''}
                      onChange={(e) => updateFunnel(template.id, { [field.key]: e.target.value })}
                      placeholder={`Preencha ${field.label.toLowerCase()}...`}
                    />
                  </div>
                );
              })}
            </div>
          </FunnelCard>
        );
      })}
    </>
  );
}
