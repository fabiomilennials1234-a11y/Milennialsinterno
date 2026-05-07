import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ClientCombobox } from '@/components/ui/client-combobox';
import { Plus, X, Wand2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CRM_PRODUTOS_VALIDOS,
  CRM_PRODUTO_LABEL,
  CRM_PRODUTO_COLOR,
  CRM_PRODUCT_HIERARCHY,
  getHighestProduct,
  useCreateCrmConfiguracoes,
  type CrmProduto,
} from '@/hooks/useCrmKanban';
import { useAllActiveClients } from '@/hooks/useAllActiveClients';

// ========= Pipeline padrão compartilhado =========
const PIPELINE_PADRAO = [
  'Lead novo',
  'Contato 1 (Ligação)',
  'Contato 2 (WhatsApp)',
  'Contato 3 (WhatsApp)',
  'Contato 4 (Ligação)',
  'Qualificado',
  'Desqualificado',
  'Sem contato',
  'Agendado',
  'Compareceu',
  'Remarcar',
  'Proposta enviada',
  'Fechado',
  'Perdido',
];

// ======================= TIPOS =======================

interface CrmConfigFormData {
  pipeline_tipo: 'padrao' | 'personalizado';
  pipeline_customizado: string[];
  scripts: string[];
  observacoes: string;
}

const emptyFormData = (): CrmConfigFormData => ({
  pipeline_tipo: 'padrao',
  pipeline_customizado: [],
  scripts: [],
  observacoes: '',
});

// ========== PROPS ==========

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  gestorId: string;
  availableProdutos: CrmProduto[];
  onSuccess?: () => void;
}

// =================== COMPONENTE ===================

export default function CrmTarefaFormModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  gestorId,
  availableProdutos,
  onSuccess,
}: Props) {
  const createConfigs = useCreateCrmConfiguracoes();
  const { data: allClients = [], isLoading: isLoadingClients } = useAllActiveClients();

  const highestProduct = availableProdutos.length > 0 ? getHighestProduct(availableProdutos) : null;
  const [selected, setSelected] = useState<CrmProduto[]>(highestProduct ? [highestProduct] : []);
  const [currentClient, setCurrentClient] = useState<{ id: string; name: string }>(() => ({
    id: clientId,
    name: clientName,
  }));
  const [formData, setFormData] = useState<CrmConfigFormData>(emptyFormData);
  const [newPipelineItem, setNewPipelineItem] = useState('');

  const produtosKey = availableProdutos.slice().sort().join(',');

  useEffect(() => {
    setCurrentClient({ id: clientId, name: clientName });
    setFormData(emptyFormData());
    setNewPipelineItem('');
    const newHighest = availableProdutos.length > 0 ? getHighestProduct(availableProdutos) : null;
    setSelected(newHighest ? [newHighest] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientName, produtosKey]);

  const clientOptions = useMemo(
    () =>
      allClients.map(c => ({
        id: c.id,
        name: c.name,
        razao_social: c.razao_social ?? null,
      })),
    [allClients],
  );

  const handleClientChange = (id: string, name: string) => {
    setCurrentClient({ id, name });
  };

  const handleSubmit = async () => {
    if (!currentClient.id) {
      toast.error('Selecione o cliente');
      return;
    }
    if (selected.length === 0) {
      toast.error('Selecione ao menos um produto');
      return;
    }

    const finalProduto = getHighestProduct(selected);

    const formDataByProduto: Partial<Record<CrmProduto, Record<string, unknown>>> = {
      [finalProduto]: {
        pipeline_tipo: formData.pipeline_tipo,
        pipeline_customizado: formData.pipeline_customizado,
        scripts: formData.scripts.filter(s => s.trim() !== ''),
        observacoes: formData.observacoes,
      },
    };

    try {
      await createConfigs.mutateAsync({
        clientId: currentClient.id,
        clientName: currentClient.name,
        gestorId,
        produtos: [finalProduto],
        formDataByProduto,
      });
      onSuccess?.();
      onClose();
    } catch {
      // erro já tratado pelo hook
    }
  };

  const toggleProduto = (p: CrmProduto, checked: boolean) => {
    setSelected(prev => (checked ? [...prev, p] : prev.filter(x => x !== p)));
  };

  const saving = createConfigs.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={18} className="text-primary" />
            Gerar Tarefa — {currentClient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Seleção de cliente */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Cliente *</Label>
            <ClientCombobox
              value={currentClient.id}
              onChange={handleClientChange}
              clients={clientOptions}
              currentFallback={{ id: clientId, name: clientName }}
              isLoading={isLoadingClients}
              disabled={saving}
              placeholder="Selecionar cliente…"
              emptyMessage="Nenhum cliente ativo encontrado."
            />
            <p className="text-[11px] text-muted-foreground">
              Pré-selecionado a partir do cliente aberto. Troque caso queira gerar a tarefa para outro.
            </p>
          </div>

          {/* Seleção de produtos */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Produto a configurar</Label>
            {availableProdutos.length > 1 && highestProduct ? (
              <p className="text-xs text-muted-foreground">
                Cliente contratou {availableProdutos.map(p => CRM_PRODUTO_LABEL[p]).join(', ')}.
                Apenas <strong>{CRM_PRODUTO_LABEL[highestProduct]}</strong> sera configurado — seus steps ja incluem os de produtos inferiores.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cliente contratou: {availableProdutos.length > 0 ? availableProdutos.map(p => CRM_PRODUTO_LABEL[p]).join(', ') : 'nenhum'}.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {CRM_PRODUTOS_VALIDOS.map(p => {
                const isHighest = p === highestProduct;
                const available = availableProdutos.includes(p);
                const isLowerThanHighest = available && !isHighest && highestProduct != null && CRM_PRODUCT_HIERARCHY[p] < CRM_PRODUCT_HIERARCHY[highestProduct];
                const checked = selected.includes(p);
                return (
                  <div key={p} className="relative">
                    <label
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors text-sm font-medium ${
                        !available
                          ? 'opacity-40 cursor-not-allowed bg-muted/20'
                          : isLowerThanHighest
                            ? 'opacity-50 cursor-not-allowed bg-muted/10 border-border'
                            : checked
                              ? 'bg-primary/10 border-primary text-primary cursor-default'
                              : 'bg-background border-border hover:border-primary/50 cursor-pointer'
                      }`}
                    >
                      <Checkbox
                        checked={isHighest || checked}
                        disabled={!available || isLowerThanHighest || isHighest}
                        onCheckedChange={(c) => {
                          if (available && !isLowerThanHighest && !isHighest) toggleProduto(p, !!c);
                        }}
                      />
                      {CRM_PRODUTO_LABEL[p]}
                    </label>
                    {isLowerThanHighest && (
                      <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                        Incluso no {CRM_PRODUTO_LABEL[highestProduct!]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* =================== FORMULÁRIO UNIFICADO =================== */}
          {selected.length > 0 && (
            <div className="border rounded-xl p-5 bg-muted/5 border-border/60 space-y-5">
              <div className="flex items-center gap-2">
                <Badge className={`${CRM_PRODUTO_COLOR[getHighestProduct(selected)]} border`}>
                  {CRM_PRODUTO_LABEL[getHighestProduct(selected)]}
                </Badge>
                <span className="text-xs text-muted-foreground">Configuração do CRM</span>
              </div>

              {/* 1. Pipeline */}
              <PipelineEditor
                tipo={formData.pipeline_tipo}
                custom={formData.pipeline_customizado}
                newItem={newPipelineItem}
                onChangeNewItem={setNewPipelineItem}
                onTipoChange={(t) => setFormData(d => ({ ...d, pipeline_tipo: t }))}
                onAddCustom={(s) => setFormData(d => ({ ...d, pipeline_customizado: [...d.pipeline_customizado, s] }))}
                onRemoveCustom={(i) => setFormData(d => ({ ...d, pipeline_customizado: d.pipeline_customizado.filter((_, idx) => idx !== i) }))}
              />

              {/* 2. Scripts */}
              <ScriptsListEditor
                scripts={formData.scripts}
                onAdd={() => setFormData(d => ({ ...d, scripts: [...d.scripts, ''] }))}
                onChange={(i, v) => setFormData(d => ({ ...d, scripts: d.scripts.map((s, idx) => idx === i ? v : s) }))}
                onRemove={(i) => setFormData(d => ({ ...d, scripts: d.scripts.filter((_, idx) => idx !== i) }))}
              />

              {/* 3. Observações */}
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Observações</Label>
                <Textarea
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) => setFormData(d => ({ ...d, observacoes: e.target.value }))}
                  placeholder="Observações gerais sobre a configuração do CRM..."
                  className="resize-none"
                />
              </div>
            </div>
          )}

          {/* ========= Submit ========= */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || selected.length === 0} className="gap-2">
              {saving ? 'Gerando...' : (<><CheckCircle2 size={16} /> Gerar e criar cards</>)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== Subcomponentes =====================

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function PipelineEditor({ tipo, custom, newItem, onChangeNewItem, onTipoChange, onAddCustom, onRemoveCustom }: {
  tipo: 'padrao' | 'personalizado';
  custom: string[];
  newItem: string;
  onChangeNewItem: (v: string) => void;
  onTipoChange: (t: 'padrao' | 'personalizado') => void;
  onAddCustom: (s: string) => void;
  onRemoveCustom: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">Pipeline *</Label>
      <RadioGroup value={tipo} onValueChange={(v) => onTipoChange(v as 'padrao' | 'personalizado')} className="flex gap-4 mb-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="padrao" id="pipe-padrao" />
          <Label htmlFor="pipe-padrao" className="text-sm cursor-pointer">Padrão (14 etapas)</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="personalizado" id="pipe-custom" />
          <Label htmlFor="pipe-custom" className="text-sm cursor-pointer">Personalizado</Label>
        </div>
      </RadioGroup>

      {tipo === 'padrao' && (
        <div className="bg-muted/30 rounded-lg p-2.5 flex flex-wrap gap-1.5">
          {PIPELINE_PADRAO.map(s => (
            <Badge key={s} variant="outline" className="text-[10px] bg-background">{s}</Badge>
          ))}
        </div>
      )}

      {tipo === 'personalizado' && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Defina as etapas do pipeline personalizado</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da etapa"
              value={newItem}
              onChange={(e) => onChangeNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newItem.trim()) {
                  e.preventDefault();
                  onAddCustom(newItem.trim());
                  onChangeNewItem('');
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                if (newItem.trim()) {
                  onAddCustom(newItem.trim());
                  onChangeNewItem('');
                }
              }}
            >
              <Plus size={16} />
            </Button>
          </div>
          {custom.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {custom.map((s, idx) => (
                <Badge key={`${s}-${idx}`} className="gap-1.5 bg-primary/10 text-primary border-primary/30">
                  {s}
                  <button type="button" onClick={() => onRemoveCustom(idx)} className="hover:text-destructive transition-colors">
                    <X size={10} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScriptsListEditor({ scripts, onAdd, onChange, onRemove }: {
  scripts: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Scripts</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onAdd}
        >
          <Plus size={12} />
          Adicionar script
        </Button>
      </div>

      {scripts.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          Nenhum script adicionado. Clique em "Adicionar script" para começar.
        </p>
      )}

      <div className="space-y-3">
        {scripts.map((script, idx) => (
          <div key={idx} className="relative group">
            <FieldWrap label={`Script ${idx + 1}`}>
              <div className="relative">
                <Textarea
                  rows={3}
                  value={script}
                  onChange={(e) => onChange(idx, e.target.value)}
                  placeholder={`Conteúdo do script ${idx + 1}...`}
                  className="resize-none pr-8"
                />
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remover script"
                >
                  <X size={14} />
                </button>
              </div>
            </FieldWrap>
          </div>
        ))}
      </div>
    </div>
  );
}
