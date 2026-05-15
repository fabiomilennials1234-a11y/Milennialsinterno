import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  CalendarDays,
  TrendingUp,
  ClipboardList,
  Target,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCreateCycleReport,
  type CreateCycleReportInput,
  type MarketplaceEntry,
  type Top5SkuEntry,
} from '@/hooks/useMktplaceCycleReports';

// ─── Props ───────────────────────────────────────────────────────────

interface CycleReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  reportType: 'consultoria' | 'gestao';
}

// ─── Form state ──────────────────────────────────────────────────────

interface FormState {
  // Block 1 — Identificacao
  cycle_start_date: string;
  cycle_end_date: string;
  reuniao_realizada: boolean;
  reuniao_data: string;
  reuniao_horario: string;
  // Block 2 — Performance
  marketplace_data: MarketplaceEntry[];
  // Block 3 — Execucao
  cumprimento_plano: 'tudo' | 'parcial' | 'nao' | '';
  cumprimento_detalhamento: string;
  dificuldades: string;
  top5_skus: Top5SkuEntry[];
  // Block 4 — Proximo Ciclo
  plano_proximo_ciclo: string;
  proxima_reuniao_data: string;
  proxima_reuniao_horario: string;
  skus_cadastrados_otimizados: string;
  skus_problematicos: string;
  acoes_executadas: string;
  // Block 5 — Ads (gestao only)
  verba_ads: string;
  acos_medio: string;
  tacos_medio: string;
  // Block 6 — Qualidade (gestao only)
  rms_abertas: string;
  rms_resolvidas: string;
  rms_em_aberto: string;
  plano_proximos_dias: string;
  variacao_faturamento_pct: string;
  variacao_pedidos_pct: string;
}

const INITIAL_MARKETPLACE_ROW: MarketplaceEntry = {
  marketplace: '',
  faturamento: 0,
  pedidos: 0,
  reputacao: '',
};

const INITIAL_SKU_ROW: Top5SkuEntry = {
  posicao: 1,
  sku: '',
  faturamento: 0,
  quantidade: 0,
};

function createInitialState(): FormState {
  return {
    cycle_start_date: '',
    cycle_end_date: '',
    reuniao_realizada: false,
    reuniao_data: '',
    reuniao_horario: '',
    marketplace_data: [{ ...INITIAL_MARKETPLACE_ROW }],
    cumprimento_plano: '',
    cumprimento_detalhamento: '',
    dificuldades: '',
    top5_skus: [],
    plano_proximo_ciclo: '',
    proxima_reuniao_data: '',
    proxima_reuniao_horario: '',
    skus_cadastrados_otimizados: '',
    skus_problematicos: '',
    acoes_executadas: '',
    verba_ads: '',
    acos_medio: '',
    tacos_medio: '',
    rms_abertas: '',
    rms_resolvidas: '',
    rms_em_aberto: '',
    plano_proximos_dias: '',
    variacao_faturamento_pct: '',
    variacao_pedidos_pct: '',
  };
}

// ─── Zod schemas per block ───────────────────────────────────────────

const blockSchemas = {
  identificacao: z.object({
    cycle_start_date: z.string().min(1, 'Data de inicio obrigatoria'),
    cycle_end_date: z.string().min(1, 'Data de fim obrigatoria'),
  }),
  performance: z.object({
    marketplace_data: z
      .array(
        z.object({
          marketplace: z.string().min(1, 'Nome do marketplace obrigatorio'),
          faturamento: z.number().min(0),
          pedidos: z.number().int().min(0),
          reputacao: z.string(),
          ticket_medio: z.number().optional(),
        }),
      )
      .min(1, 'Adicione pelo menos 1 marketplace'),
  }),
  execucao: z.object({
    cumprimento_plano: z.enum(['tudo', 'parcial', 'nao'], {
      required_error: 'Selecione o cumprimento do plano',
    }),
  }),
  proximo_ciclo: z.object({
    plano_proximo_ciclo: z.string().min(1, 'Plano do proximo ciclo obrigatorio'),
  }),
  ads: z.object({}),
  qualidade: z.object({}),
} as const;

// ─── Step definitions ────────────────────────────────────────────────

interface StepDef {
  id: string;
  label: string;
  icon: React.ElementType;
  gestaoOnly: boolean;
}

const ALL_STEPS: StepDef[] = [
  { id: 'identificacao', label: 'Identificacao', icon: CalendarDays, gestaoOnly: false },
  { id: 'performance', label: 'Performance', icon: TrendingUp, gestaoOnly: false },
  { id: 'execucao', label: 'Execucao', icon: ClipboardList, gestaoOnly: false },
  { id: 'proximo_ciclo', label: 'Proximo Ciclo', icon: Target, gestaoOnly: false },
  { id: 'ads', label: 'Ads', icon: Megaphone, gestaoOnly: true },
  { id: 'qualidade', label: 'Qualidade', icon: ShieldCheck, gestaoOnly: true },
];

// ─── Validation helpers ──────────────────────────────────────────────

type BlockId = (typeof ALL_STEPS)[number]['id'];

function validateBlock(blockId: BlockId, form: FormState): string | null {
  switch (blockId) {
    case 'identificacao': {
      const result = blockSchemas.identificacao.safeParse({
        cycle_start_date: form.cycle_start_date,
        cycle_end_date: form.cycle_end_date,
      });
      if (!result.success) return result.error.issues[0].message;
      if (form.cycle_end_date < form.cycle_start_date) {
        return 'Data de fim deve ser posterior a data de inicio';
      }
      if (form.reuniao_realizada && !form.reuniao_data) {
        return 'Data da reuniao obrigatoria quando reuniao foi realizada';
      }
      return null;
    }
    case 'performance': {
      const result = blockSchemas.performance.safeParse({
        marketplace_data: form.marketplace_data,
      });
      if (!result.success) return result.error.issues[0].message;
      return null;
    }
    case 'execucao': {
      if (!form.cumprimento_plano) return 'Selecione o cumprimento do plano';
      const result = blockSchemas.execucao.safeParse({
        cumprimento_plano: form.cumprimento_plano,
      });
      if (!result.success) return result.error.issues[0].message;
      if (
        (form.cumprimento_plano === 'parcial' || form.cumprimento_plano === 'nao') &&
        !form.cumprimento_detalhamento.trim()
      ) {
        return 'Detalhamento obrigatorio quando cumprimento parcial ou nao';
      }
      return null;
    }
    case 'proximo_ciclo': {
      const result = blockSchemas.proximo_ciclo.safeParse({
        plano_proximo_ciclo: form.plano_proximo_ciclo,
      });
      if (!result.success) return result.error.issues[0].message;
      return null;
    }
    case 'ads':
    case 'qualidade':
      return null;
    default:
      return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────

export default function CycleReportFormModal({
  isOpen,
  onClose,
  clientId,
  reportType,
}: CycleReportFormModalProps) {
  const [form, setForm] = useState<FormState>(createInitialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [blockErrors, setBlockErrors] = useState<Record<string, string | null>>({});
  const [validatedBlocks, setValidatedBlocks] = useState<Set<string>>(new Set());
  const createReport = useCreateCycleReport();

  const steps = useMemo(
    () => ALL_STEPS.filter((s) => !s.gestaoOnly || reportType === 'gestao'),
    [reportType],
  );

  const activeStep = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // ── Field updater ──

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear error for the block containing this field on change
    setBlockErrors((prev) => ({ ...prev, [activeStep.id]: null }));
  }, [activeStep.id]);

  // ── Navigation ──

  const goNext = useCallback(() => {
    const error = validateBlock(activeStep.id, form);
    if (error) {
      setBlockErrors((prev) => ({ ...prev, [activeStep.id]: error }));
      return;
    }
    setBlockErrors((prev) => ({ ...prev, [activeStep.id]: null }));
    setValidatedBlocks((prev) => new Set(prev).add(activeStep.id));
    if (!isLastStep) setCurrentStep((s) => s + 1);
  }, [activeStep.id, form, isLastStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const goToStep = useCallback(
    (idx: number) => {
      // Allow going back freely; going forward requires validation of current
      if (idx < currentStep) {
        setCurrentStep(idx);
        return;
      }
      // Validate all blocks up to target
      for (let i = currentStep; i < idx; i++) {
        const err = validateBlock(steps[i].id, form);
        if (err) {
          setBlockErrors((prev) => ({ ...prev, [steps[i].id]: err }));
          setCurrentStep(i);
          return;
        }
        setValidatedBlocks((prev) => new Set(prev).add(steps[i].id));
      }
      setCurrentStep(idx);
    },
    [currentStep, form, steps],
  );

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    // Validate last block
    const error = validateBlock(activeStep.id, form);
    if (error) {
      setBlockErrors((prev) => ({ ...prev, [activeStep.id]: error }));
      return;
    }

    const payload: CreateCycleReportInput = {
      client_id: clientId,
      report_type: reportType,
      cycle_start_date: form.cycle_start_date,
      cycle_end_date: form.cycle_end_date,
      reuniao_realizada: form.reuniao_realizada,
      reuniao_data: form.reuniao_data || undefined,
      reuniao_horario: form.reuniao_horario || undefined,
      marketplace_data: form.marketplace_data,
      cumprimento_plano: form.cumprimento_plano as 'tudo' | 'parcial' | 'nao',
      cumprimento_detalhamento: form.cumprimento_detalhamento || undefined,
      dificuldades: form.dificuldades || undefined,
      top5_skus: form.top5_skus.length > 0 ? form.top5_skus : undefined,
      plano_proximo_ciclo: form.plano_proximo_ciclo || undefined,
      proxima_reuniao_data: form.proxima_reuniao_data || undefined,
      proxima_reuniao_horario: form.proxima_reuniao_horario || undefined,
      skus_cadastrados_otimizados: form.skus_cadastrados_otimizados || undefined,
      skus_problematicos: form.skus_problematicos || undefined,
      acoes_executadas: form.acoes_executadas || undefined,
    };

    if (reportType === 'gestao') {
      payload.verba_ads = form.verba_ads ? Number(form.verba_ads) : undefined;
      payload.acos_medio = form.acos_medio ? Number(form.acos_medio) : undefined;
      payload.tacos_medio = form.tacos_medio ? Number(form.tacos_medio) : undefined;
      payload.rms_abertas = form.rms_abertas ? Number(form.rms_abertas) : undefined;
      payload.rms_resolvidas = form.rms_resolvidas ? Number(form.rms_resolvidas) : undefined;
      payload.rms_em_aberto = form.rms_em_aberto ? Number(form.rms_em_aberto) : undefined;
      payload.plano_proximos_dias = form.plano_proximos_dias || undefined;
      payload.variacao_faturamento_pct = form.variacao_faturamento_pct
        ? Number(form.variacao_faturamento_pct)
        : undefined;
      payload.variacao_pedidos_pct = form.variacao_pedidos_pct
        ? Number(form.variacao_pedidos_pct)
        : undefined;
    }

    await createReport.mutateAsync(payload);
    setForm(createInitialState());
    setCurrentStep(0);
    setBlockErrors({});
    setValidatedBlocks(new Set());
    onClose();
  }, [activeStep.id, clientId, createReport, form, onClose, reportType]);

  // ── Reset on close ──

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setForm(createInitialState());
        setCurrentStep(0);
        setBlockErrors({});
        setValidatedBlocks(new Set());
        onClose();
      }
    },
    [onClose],
  );

  // ── Marketplace table helpers ──

  const addMarketplaceRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      marketplace_data: [...prev.marketplace_data, { ...INITIAL_MARKETPLACE_ROW }],
    }));
  }, []);

  const removeMarketplaceRow = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      marketplace_data: prev.marketplace_data.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateMarketplaceRow = useCallback(
    (idx: number, field: keyof MarketplaceEntry, value: string | number) => {
      setForm((prev) => {
        const updated = [...prev.marketplace_data];
        updated[idx] = { ...updated[idx], [field]: value };
        return { ...prev, marketplace_data: updated };
      });
      setBlockErrors((prev) => ({ ...prev, performance: null }));
    },
    [],
  );

  // ── Top5 SKU table helpers ──

  const addSkuRow = useCallback(() => {
    setForm((prev) => {
      if (prev.top5_skus.length >= 5) return prev;
      return {
        ...prev,
        top5_skus: [
          ...prev.top5_skus,
          { ...INITIAL_SKU_ROW, posicao: prev.top5_skus.length + 1 },
        ],
      };
    });
  }, []);

  const removeSkuRow = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      top5_skus: prev.top5_skus
        .filter((_, i) => i !== idx)
        .map((row, i) => ({ ...row, posicao: i + 1 })),
    }));
  }, []);

  const updateSkuRow = useCallback(
    (idx: number, field: keyof Top5SkuEntry, value: string | number) => {
      setForm((prev) => {
        const updated = [...prev.top5_skus];
        updated[idx] = { ...updated[idx], [field]: value };
        return { ...prev, top5_skus: updated };
      });
    },
    [],
  );

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Relatorio de Ciclo
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Preencha os blocos do relatorio para o ciclo atual
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'ml-auto text-[10px] px-2 py-0.5',
                reportType === 'gestao'
                  ? 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                  : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
              )}
            >
              {reportType === 'gestao' ? 'Gestao' : 'Consultoria'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* ── Stepper sidebar ── */}
          <nav className="w-56 shrink-0 border-r border-border bg-muted/30 py-4 px-3 hidden md:block">
            <ol className="space-y-1">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === currentStep;
                const isCompleted = validatedBlocks.has(step.id);
                const hasError = !!blockErrors[step.id];

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => goToStep(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : isCompleted
                            ? 'text-emerald-400 hover:bg-muted/50'
                            : hasError
                              ? 'text-destructive hover:bg-destructive/5'
                              : 'text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : isCompleted
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : hasError
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                      </div>
                      <span className="text-xs font-medium truncate">{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* ── Mobile step indicator ── */}
          <div className="md:hidden border-b border-border px-4 py-2 flex items-center gap-2 shrink-0 w-full absolute top-[72px] bg-background z-10">
            {steps.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => goToStep(idx)}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors',
                  idx === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : validatedBlocks.has(step.id)
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {idx + 1}
              </button>
            ))}
            <span className="ml-2 text-xs font-medium text-foreground">{activeStep.label}</span>
          </div>

          {/* ── Block content ── */}
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1">
              <div className="p-6 md:p-8 space-y-6 md:mt-0 mt-10">
                {/* Error banner */}
                {blockErrors[activeStep.id] && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                    {blockErrors[activeStep.id]}
                  </div>
                )}

                {activeStep.id === 'identificacao' && (
                  <BlockIdentificacao form={form} reportType={reportType} updateField={updateField} />
                )}
                {activeStep.id === 'performance' && (
                  <BlockPerformance
                    rows={form.marketplace_data}
                    onAdd={addMarketplaceRow}
                    onRemove={removeMarketplaceRow}
                    onUpdate={updateMarketplaceRow}
                  />
                )}
                {activeStep.id === 'execucao' && (
                  <BlockExecucao
                    form={form}
                    updateField={updateField}
                    skuRows={form.top5_skus}
                    onAddSku={addSkuRow}
                    onRemoveSku={removeSkuRow}
                    onUpdateSku={updateSkuRow}
                  />
                )}
                {activeStep.id === 'proximo_ciclo' && (
                  <BlockProximoCiclo form={form} updateField={updateField} />
                )}
                {activeStep.id === 'ads' && (
                  <BlockAds form={form} updateField={updateField} />
                )}
                {activeStep.id === 'qualidade' && (
                  <BlockQualidade form={form} updateField={updateField} />
                )}
              </div>
            </ScrollArea>

            {/* ── Footer buttons ── */}
            <div className="border-t border-border px-6 py-4 flex items-center justify-between shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={goPrev}
                disabled={currentStep === 0}
                className="gap-1.5"
              >
                <ChevronLeft size={14} />
                Anterior
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {currentStep + 1} / {steps.length}
              </div>

              {isLastStep ? (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={createReport.isPending}
                  className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {createReport.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Enviar Relatorio
                </Button>
              ) : (
                <Button size="sm" onClick={goNext} className="gap-1.5">
                  Proximo
                  <ChevronRight size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Block Components ────────────────────────────────────────────────

function SectionCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Block 1: Identificacao ──

function BlockIdentificacao({
  form,
  reportType,
  updateField,
}: {
  form: FormState;
  reportType: 'consultoria' | 'gestao';
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Identificacao do Ciclo">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Tipo:</Label>
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            reportType === 'gestao'
              ? 'border-blue-500/30 text-blue-400'
              : 'border-emerald-500/30 text-emerald-400',
          )}
        >
          {reportType === 'gestao' ? 'Gestao' : 'Consultoria'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Inicio do ciclo">
          <Input
            type="date"
            value={form.cycle_start_date}
            onChange={(e) => updateField('cycle_start_date', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="Fim do ciclo">
          <Input
            type="date"
            value={form.cycle_end_date}
            onChange={(e) => updateField('cycle_end_date', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={form.reuniao_realizada}
            onCheckedChange={(checked) => updateField('reuniao_realizada', checked)}
            id="reuniao-switch"
          />
          <Label htmlFor="reuniao-switch" className="text-sm cursor-pointer">
            Reuniao realizada com o cliente
          </Label>
        </div>

        {form.reuniao_realizada && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-1 border-l-2 border-primary/20 ml-1">
            <FieldGroup label="Data da reuniao">
              <Input
                type="date"
                value={form.reuniao_data}
                onChange={(e) => updateField('reuniao_data', e.target.value)}
                className="h-9 text-sm"
              />
            </FieldGroup>
            <FieldGroup label="Horario">
              <Input
                type="time"
                value={form.reuniao_horario}
                onChange={(e) => updateField('reuniao_horario', e.target.value)}
                className="h-9 text-sm"
              />
            </FieldGroup>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Block 2: Performance ──

function BlockPerformance({
  rows,
  onAdd,
  onRemove,
  onUpdate,
}: {
  rows: MarketplaceEntry[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: keyof MarketplaceEntry, value: string | number) => void;
}) {
  return (
    <SectionCard title="Performance por Marketplace">
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Marketplace {idx + 1}
              </span>
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(idx)}
                  className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <FieldGroup label="Marketplace">
                <Input
                  placeholder="Ex: Amazon, Mercado Livre"
                  value={row.marketplace}
                  onChange={(e) => onUpdate(idx, 'marketplace', e.target.value)}
                  className="h-8 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Faturamento (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={row.faturamento || ''}
                  onChange={(e) => onUpdate(idx, 'faturamento', Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Pedidos">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={row.pedidos || ''}
                  onChange={(e) => onUpdate(idx, 'pedidos', Number(e.target.value))}
                  className="h-8 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Reputacao">
                <Input
                  placeholder="Ex: Verde, Amarelo"
                  value={row.reputacao}
                  onChange={(e) => onUpdate(idx, 'reputacao', e.target.value)}
                  className="h-8 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Ticket Medio" hint="Opcional">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={row.ticket_medio ?? ''}
                  onChange={(e) =>
                    onUpdate(idx, 'ticket_medio', e.target.value ? Number(e.target.value) : 0)
                  }
                  className="h-8 text-sm"
                />
              </FieldGroup>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="gap-1.5 text-xs"
      >
        <Plus size={12} />
        Adicionar marketplace
      </Button>
    </SectionCard>
  );
}

// ── Block 3: Execucao ──

function BlockExecucao({
  form,
  updateField,
  skuRows,
  onAddSku,
  onRemoveSku,
  onUpdateSku,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  skuRows: Top5SkuEntry[];
  onAddSku: () => void;
  onRemoveSku: (idx: number) => void;
  onUpdateSku: (idx: number, field: keyof Top5SkuEntry, value: string | number) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Cumprimento do Plano">
        <FieldGroup label="O plano do ciclo anterior foi cumprido?">
          <RadioGroup
            value={form.cumprimento_plano}
            onValueChange={(v) =>
              updateField('cumprimento_plano', v as FormState['cumprimento_plano'])
            }
            className="flex gap-4"
          >
            {[
              { value: 'tudo', label: 'Sim, tudo' },
              { value: 'parcial', label: 'Parcialmente' },
              { value: 'nao', label: 'Nao' },
            ].map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`cump-${opt.value}`} />
                <Label htmlFor={`cump-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </FieldGroup>

        {(form.cumprimento_plano === 'parcial' || form.cumprimento_plano === 'nao') && (
          <FieldGroup label="Detalhamento">
            <Textarea
              placeholder="Explique o que foi ou nao foi cumprido..."
              value={form.cumprimento_detalhamento}
              onChange={(e) => updateField('cumprimento_detalhamento', e.target.value)}
              className="min-h-[80px] text-sm"
            />
          </FieldGroup>
        )}

        <FieldGroup label="Dificuldades encontradas" hint="Opcional">
          <Textarea
            placeholder="Descreva as dificuldades do ciclo..."
            value={form.dificuldades}
            onChange={(e) => updateField('dificuldades', e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </FieldGroup>
      </SectionCard>

      <SectionCard title="Top 5 SKUs">
        {skuRows.length > 0 && (
          <div className="space-y-2">
            {skuRows.map((row, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/50 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    #{row.posicao}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveSku(idx)}
                    className="h-5 w-5 p-0 text-destructive/70 hover:text-destructive"
                  >
                    <Trash2 size={10} />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FieldGroup label="SKU">
                    <Input
                      placeholder="Codigo do SKU"
                      value={row.sku}
                      onChange={(e) => onUpdateSku(idx, 'sku', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="Faturamento (R$)">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      value={row.faturamento || ''}
                      onChange={(e) => onUpdateSku(idx, 'faturamento', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </FieldGroup>
                  <FieldGroup label="Quantidade">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={row.quantidade || ''}
                      onChange={(e) => onUpdateSku(idx, 'quantidade', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </FieldGroup>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onAddSku}
          disabled={skuRows.length >= 5}
          className="gap-1.5 text-xs"
        >
          <Plus size={12} />
          Adicionar SKU {skuRows.length > 0 && `(${skuRows.length}/5)`}
        </Button>
      </SectionCard>
    </div>
  );
}

// ── Block 4: Proximo Ciclo ──

function BlockProximoCiclo({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Planejamento do Proximo Ciclo">
      <FieldGroup label="Plano do proximo ciclo">
        <Textarea
          placeholder="Descreva o plano de acao para o proximo ciclo..."
          value={form.plano_proximo_ciclo}
          onChange={(e) => updateField('plano_proximo_ciclo', e.target.value)}
          className="min-h-[100px] text-sm"
        />
      </FieldGroup>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Proxima reuniao — data" hint="Opcional">
          <Input
            type="date"
            value={form.proxima_reuniao_data}
            onChange={(e) => updateField('proxima_reuniao_data', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="Proxima reuniao — horario" hint="Opcional">
          <Input
            type="time"
            value={form.proxima_reuniao_horario}
            onChange={(e) => updateField('proxima_reuniao_horario', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="SKUs cadastrados / otimizados" hint="Opcional">
        <Textarea
          placeholder="Liste os SKUs que foram cadastrados ou otimizados..."
          value={form.skus_cadastrados_otimizados}
          onChange={(e) => updateField('skus_cadastrados_otimizados', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="SKUs problematicos" hint="Opcional">
        <Textarea
          placeholder="Liste os SKUs com problemas..."
          value={form.skus_problematicos}
          onChange={(e) => updateField('skus_problematicos', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Acoes executadas" hint="Opcional">
        <Textarea
          placeholder="Descreva as acoes executadas no ciclo..."
          value={form.acoes_executadas}
          onChange={(e) => updateField('acoes_executadas', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>
    </SectionCard>
  );
}

// ── Block 5: Ads (gestao only) ──

function BlockAds({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Dados de Ads">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldGroup label="Verba de Ads (R$)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            value={form.verba_ads}
            onChange={(e) => updateField('verba_ads', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="ACOS Medio (%)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            value={form.acos_medio}
            onChange={(e) => updateField('acos_medio', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="TACOS Medio (%)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            value={form.tacos_medio}
            onChange={(e) => updateField('tacos_medio', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
      </div>
    </SectionCard>
  );
}

// ── Block 6: Qualidade (gestao only) ──

function BlockQualidade({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Indicadores de Qualidade">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldGroup label="RMs abertas" hint="Opcional">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={form.rms_abertas}
            onChange={(e) => updateField('rms_abertas', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="RMs resolvidas" hint="Opcional">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={form.rms_resolvidas}
            onChange={(e) => updateField('rms_resolvidas', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="RMs em aberto" hint="Opcional">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={form.rms_em_aberto}
            onChange={(e) => updateField('rms_em_aberto', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Plano proximos dias" hint="Opcional">
        <Textarea
          placeholder="Descreva o plano para os proximos dias..."
          value={form.plano_proximos_dias}
          onChange={(e) => updateField('plano_proximos_dias', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Variacao faturamento (%)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.variacao_faturamento_pct}
            onChange={(e) => updateField('variacao_faturamento_pct', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="Variacao pedidos (%)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.variacao_pedidos_pct}
            onChange={(e) => updateField('variacao_pedidos_pct', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
      </div>
    </SectionCard>
  );
}
