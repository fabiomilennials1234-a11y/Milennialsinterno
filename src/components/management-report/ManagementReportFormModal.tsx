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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Loader2,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Package,
  TrendingUp,
  Lightbulb,
  Target,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCreateManagementReport,
  type ResponsavelAcao,
} from '@/hooks/useManagementReports';

// ─── Props ───────────────────────────────────────────────────────────

interface ManagementReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

// ─── Form state ──────────────────────────────────────────────────────

interface FormState {
  // Block 1 — Consolidacao
  campanhas_veiculadas: string;
  leads_gerados: string;
  cpl_medio: string;
  criativos_performance: string;
  entregas_extra_escopo: string;
  planejado_nao_executado: string;
  // Block 2 — Executivo
  maior_resultado_mes: string;
  principal_desafio: string;
  mudanca_estrategia: string;
  // Block 3 — Dica Gestao
  dica_eixo: string;
  dica_texto: string;
  dica_fonte: string;
  // Block 4 — Plano 30-60-90
  plano_30d: string;
  plano_60d: string;
  plano_90d: string;
  responsaveis_acoes: ResponsavelAcao[];
  // Block 5 — One-page
  investimento_total: string;
  leads_gerados_num: string;
  cpl_num: string;
  taxa_conversao: string;
  melhor_criativo_url: string;
  melhor_criativo_metrica: string;
  frase_destaque: string;
  proximo_passo: string;
  client_logo_url: string;
}

function createInitialState(): FormState {
  return {
    campanhas_veiculadas: '',
    leads_gerados: '',
    cpl_medio: '',
    criativos_performance: '',
    entregas_extra_escopo: '',
    planejado_nao_executado: '',
    maior_resultado_mes: '',
    principal_desafio: '',
    mudanca_estrategia: '',
    dica_eixo: '',
    dica_texto: '',
    dica_fonte: '',
    plano_30d: '',
    plano_60d: '',
    plano_90d: '',
    responsaveis_acoes: [],
    investimento_total: '',
    leads_gerados_num: '',
    cpl_num: '',
    taxa_conversao: '',
    melhor_criativo_url: '',
    melhor_criativo_metrica: '',
    frase_destaque: '',
    proximo_passo: '',
    client_logo_url: '',
  };
}

// ─── Zod schemas per block ───────────────────────────────────────────

const blockSchemas = {
  consolidacao: z.object({
    campanhas_veiculadas: z.string().min(1, 'Campanhas veiculadas obrigatorio'),
  }),
  executivo: z.object({
    maior_resultado_mes: z.string().min(1, 'Maior resultado do mes obrigatorio'),
  }),
  dica_gestao: z.object({
    dica_eixo: z.string().min(1, 'Eixo da dica obrigatorio'),
    dica_texto: z.string().min(1, 'Texto da dica obrigatorio'),
  }),
  plano_30_60_90: z.object({
    plano_30d: z.string().min(1, 'Plano de 30 dias obrigatorio'),
  }),
  one_page: z.object({}),
} as const;

// ─── Step definitions ────────────────────────────────────────────────

interface StepDef {
  id: string;
  label: string;
  icon: React.ElementType;
}

const ALL_STEPS: StepDef[] = [
  { id: 'consolidacao', label: 'Consolidacao', icon: Package },
  { id: 'executivo', label: 'Executivo', icon: TrendingUp },
  { id: 'dica_gestao', label: 'Dica de Gestao', icon: Lightbulb },
  { id: 'plano_30_60_90', label: 'Plano 30-60-90', icon: Target },
  { id: 'one_page', label: 'One-page', icon: FileText },
];

// ─── Validation helpers ──────────────────────────────────────────────

type BlockId = (typeof ALL_STEPS)[number]['id'];

function validateBlock(blockId: BlockId, form: FormState): string | null {
  switch (blockId) {
    case 'consolidacao': {
      const result = blockSchemas.consolidacao.safeParse({
        campanhas_veiculadas: form.campanhas_veiculadas,
      });
      if (!result.success) return result.error.issues[0].message;
      return null;
    }
    case 'executivo': {
      const result = blockSchemas.executivo.safeParse({
        maior_resultado_mes: form.maior_resultado_mes,
      });
      if (!result.success) return result.error.issues[0].message;
      return null;
    }
    case 'dica_gestao': {
      const result = blockSchemas.dica_gestao.safeParse({
        dica_eixo: form.dica_eixo,
        dica_texto: form.dica_texto,
      });
      if (!result.success) return result.error.issues[0].message;
      return null;
    }
    case 'plano_30_60_90': {
      const result = blockSchemas.plano_30_60_90.safeParse({
        plano_30d: form.plano_30d,
      });
      if (!result.success) return result.error.issues[0].message;
      return null;
    }
    case 'one_page':
      return null;
    default:
      return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────

export default function ManagementReportFormModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: ManagementReportFormModalProps) {
  const [form, setForm] = useState<FormState>(createInitialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [blockErrors, setBlockErrors] = useState<Record<string, string | null>>({});
  const [validatedBlocks, setValidatedBlocks] = useState<Set<string>>(new Set());
  const createReport = useCreateManagementReport();

  const steps = ALL_STEPS;
  const activeStep = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // ── Field updater ──

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      if (idx < currentStep) {
        setCurrentStep(idx);
        return;
      }
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
    const error = validateBlock(activeStep.id, form);
    if (error) {
      setBlockErrors((prev) => ({ ...prev, [activeStep.id]: error }));
      return;
    }

    const referenceMonth = new Date().toISOString().slice(0, 7);

    await createReport.mutateAsync({
      client_id: clientId,
      reference_month: referenceMonth,
      // Block 1
      campanhas_veiculadas: form.campanhas_veiculadas || null,
      leads_gerados: form.leads_gerados || null,
      cpl_medio: form.cpl_medio || null,
      criativos_performance: form.criativos_performance || null,
      entregas_extra_escopo: form.entregas_extra_escopo || null,
      planejado_nao_executado: form.planejado_nao_executado || null,
      // Block 2
      maior_resultado_mes: form.maior_resultado_mes || null,
      principal_desafio: form.principal_desafio || null,
      mudanca_estrategia: form.mudanca_estrategia || null,
      // Block 3
      dica_eixo: form.dica_eixo || null,
      dica_texto: form.dica_texto || null,
      dica_fonte: form.dica_fonte || null,
      // Block 4
      plano_30d: form.plano_30d || null,
      plano_60d: form.plano_60d || null,
      plano_90d: form.plano_90d || null,
      responsaveis_acoes: form.responsaveis_acoes.length > 0 ? form.responsaveis_acoes : null,
      // Block 5
      investimento_total: form.investimento_total ? Number(form.investimento_total) : null,
      leads_gerados_num: form.leads_gerados_num ? Number(form.leads_gerados_num) : null,
      cpl_num: form.cpl_num ? Number(form.cpl_num) : null,
      taxa_conversao: form.taxa_conversao ? Number(form.taxa_conversao) : null,
      melhor_criativo_url: form.melhor_criativo_url || null,
      melhor_criativo_metrica: form.melhor_criativo_metrica || null,
      frase_destaque: form.frase_destaque || null,
      proximo_passo: form.proximo_passo || null,
      client_logo_url: form.client_logo_url || null,
    });

    setForm(createInitialState());
    setCurrentStep(0);
    setBlockErrors({});
    setValidatedBlocks(new Set());
    onClose();
  }, [activeStep.id, clientId, createReport, form, onClose]);

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

  // ── Responsaveis table helpers ──

  const addResponsavelRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      responsaveis_acoes: [...prev.responsaveis_acoes, { acao: '', responsavel: 'Milennials' }],
    }));
  }, []);

  const removeResponsavelRow = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      responsaveis_acoes: prev.responsaveis_acoes.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateResponsavelRow = useCallback(
    (idx: number, field: keyof ResponsavelAcao, value: string) => {
      setForm((prev) => {
        const updated = [...prev.responsaveis_acoes];
        updated[idx] = { ...updated[idx], [field]: value };
        return { ...prev, responsaveis_acoes: updated };
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
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Relatorio de Gestao
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {clientName} — {new Date().toISOString().slice(0, 7)}
              </DialogDescription>
            </div>
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
            <div className="flex-1 overflow-y-auto scrollbar-apple">
              <div className="p-6 md:p-8 space-y-6 md:mt-0 mt-10">
                {blockErrors[activeStep.id] && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                    {blockErrors[activeStep.id]}
                  </div>
                )}

                {activeStep.id === 'consolidacao' && (
                  <BlockConsolidacao form={form} updateField={updateField} />
                )}
                {activeStep.id === 'executivo' && (
                  <BlockExecutivo form={form} updateField={updateField} />
                )}
                {activeStep.id === 'dica_gestao' && (
                  <BlockDicaGestao form={form} updateField={updateField} />
                )}
                {activeStep.id === 'plano_30_60_90' && (
                  <BlockPlano306090
                    form={form}
                    updateField={updateField}
                    rows={form.responsaveis_acoes}
                    onAddRow={addResponsavelRow}
                    onRemoveRow={removeResponsavelRow}
                    onUpdateRow={updateResponsavelRow}
                  />
                )}
                {activeStep.id === 'one_page' && (
                  <BlockOnePage form={form} updateField={updateField} />
                )}
              </div>
            </div>

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
                  className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
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

// ── Block 1: Consolidacao ──

function BlockConsolidacao({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Consolidacao das Entregas do Mes">
      <FieldGroup label="Campanhas veiculadas">
        <Textarea
          placeholder="Descreva as campanhas veiculadas no mes..."
          value={form.campanhas_veiculadas}
          onChange={(e) => updateField('campanhas_veiculadas', e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Leads gerados" hint="Opcional">
        <Textarea
          placeholder="Descreva os leads gerados..."
          value={form.leads_gerados}
          onChange={(e) => updateField('leads_gerados', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="CPL medio" hint="Opcional">
        <Textarea
          placeholder="Descreva o CPL medio..."
          value={form.cpl_medio}
          onChange={(e) => updateField('cpl_medio', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Criativos e performance" hint="Opcional">
        <Textarea
          placeholder="Descreva a performance dos criativos..."
          value={form.criativos_performance}
          onChange={(e) => updateField('criativos_performance', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Entregas extra escopo" hint="Opcional">
        <Textarea
          placeholder="Entregas realizadas fora do escopo contratual..."
          value={form.entregas_extra_escopo}
          onChange={(e) => updateField('entregas_extra_escopo', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Planejado e nao executado" hint="Opcional">
        <Textarea
          placeholder="O que foi planejado mas nao executado..."
          value={form.planejado_nao_executado}
          onChange={(e) => updateField('planejado_nao_executado', e.target.value)}
          className="min-h-[60px] text-sm"
        />
      </FieldGroup>
    </SectionCard>
  );
}

// ── Block 2: Executivo ──

function BlockExecutivo({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Relatorio Executivo">
      <FieldGroup label="Maior resultado do mes" hint="1 frase objetiva">
        <Input
          placeholder="Ex: Aumento de 32% nos leads qualificados"
          value={form.maior_resultado_mes}
          onChange={(e) => updateField('maior_resultado_mes', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Principal desafio" hint="Opcional">
        <Textarea
          placeholder="Descreva o principal desafio enfrentado..."
          value={form.principal_desafio}
          onChange={(e) => updateField('principal_desafio', e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Mudanca de estrategia" hint="Opcional">
        <Textarea
          placeholder="Houve mudanca de estrategia? Descreva..."
          value={form.mudanca_estrategia}
          onChange={(e) => updateField('mudanca_estrategia', e.target.value)}
          className="min-h-[80px] text-sm"
        />
      </FieldGroup>
    </SectionCard>
  );
}

// ── Block 3: Dica de Gestao ──

const EIXO_OPTIONS = [
  { value: 'pessoas', label: 'Pessoas' },
  { value: 'estrategia', label: 'Estrategia' },
  { value: 'processos', label: 'Processos' },
  { value: 'gestao', label: 'Gestao' },
  { value: 'cultura', label: 'Cultura' },
] as const;

function BlockDicaGestao({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="Dica de Gestao">
      <FieldGroup label="Eixo da dica">
        <RadioGroup
          value={form.dica_eixo}
          onValueChange={(v) => updateField('dica_eixo', v)}
          className="flex flex-wrap gap-4"
        >
          {EIXO_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`eixo-${opt.value}`} />
              <Label htmlFor={`eixo-${opt.value}`} className="text-sm cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </FieldGroup>

      <FieldGroup label="Texto da dica">
        <Textarea
          placeholder="Escreva a dica de gestao para o cliente..."
          value={form.dica_texto}
          onChange={(e) => updateField('dica_texto', e.target.value)}
          className="min-h-[100px] text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Fonte" hint="Opcional — livro, artigo, referencia">
        <Input
          placeholder="Ex: 'Os 7 Habitos das Pessoas Altamente Eficazes'"
          value={form.dica_fonte}
          onChange={(e) => updateField('dica_fonte', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>
    </SectionCard>
  );
}

// ── Block 4: Plano 30-60-90 ──

function BlockPlano306090({
  form,
  updateField,
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  rows: ResponsavelAcao[];
  onAddRow: () => void;
  onRemoveRow: (idx: number) => void;
  onUpdateRow: (idx: number, field: keyof ResponsavelAcao, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Plano de Acao 30-60-90 dias">
        <FieldGroup label="Proximos 30 dias">
          <Textarea
            placeholder="O que sera feito nos proximos 30 dias..."
            value={form.plano_30d}
            onChange={(e) => updateField('plano_30d', e.target.value)}
            className="min-h-[80px] text-sm"
          />
        </FieldGroup>

        <FieldGroup label="Proximos 60 dias" hint="Opcional">
          <Textarea
            placeholder="O que sera feito nos proximos 60 dias..."
            value={form.plano_60d}
            onChange={(e) => updateField('plano_60d', e.target.value)}
            className="min-h-[80px] text-sm"
          />
        </FieldGroup>

        <FieldGroup label="Proximos 90 dias" hint="Opcional">
          <Textarea
            placeholder="O que sera feito nos proximos 90 dias..."
            value={form.plano_90d}
            onChange={(e) => updateField('plano_90d', e.target.value)}
            className="min-h-[80px] text-sm"
          />
        </FieldGroup>
      </SectionCard>

      <SectionCard title="Responsaveis pelas Acoes">
        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/50 bg-muted/20 p-3 flex items-start gap-3"
              >
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Descricao da acao..."
                    value={row.acao}
                    onChange={(e) => onUpdateRow(idx, 'acao', e.target.value)}
                    className="h-8 text-sm"
                  />
                  <RadioGroup
                    value={row.responsavel}
                    onValueChange={(v) => onUpdateRow(idx, 'responsavel', v)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Cliente" id={`resp-cliente-${idx}`} />
                      <Label htmlFor={`resp-cliente-${idx}`} className="text-xs cursor-pointer">
                        Cliente
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Milennials" id={`resp-milennials-${idx}`} />
                      <Label htmlFor={`resp-milennials-${idx}`} className="text-xs cursor-pointer">
                        Milennials
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveRow(idx)}
                  className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive shrink-0 mt-1"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onAddRow}
          className="gap-1.5 text-xs"
        >
          <Plus size={12} />
          Adicionar acao
        </Button>
      </SectionCard>
    </div>
  );
}

// ── Block 5: One-page ──

function BlockOnePage({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <SectionCard title="One-page — Resumo Visual">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Investimento total (R$)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            value={form.investimento_total}
            onChange={(e) => updateField('investimento_total', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="Leads gerados (numero)" hint="Opcional">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={form.leads_gerados_num}
            onChange={(e) => updateField('leads_gerados_num', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="CPL (R$)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="0.00"
            value={form.cpl_num}
            onChange={(e) => updateField('cpl_num', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
        <FieldGroup label="Taxa de conversao (%)" hint="Opcional">
          <Input
            type="number"
            step="0.01"
            min={0}
            max={100}
            placeholder="0.00"
            value={form.taxa_conversao}
            onChange={(e) => updateField('taxa_conversao', e.target.value)}
            className="h-9 text-sm"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Melhor criativo — URL" hint="Opcional — link da imagem ou video">
        <Input
          placeholder="https://..."
          value={form.melhor_criativo_url}
          onChange={(e) => updateField('melhor_criativo_url', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Melhor criativo — metrica" hint="Opcional">
        <Input
          placeholder="Ex: 3.2% CTR, 150 leads"
          value={form.melhor_criativo_metrica}
          onChange={(e) => updateField('melhor_criativo_metrica', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Frase destaque" hint="Opcional — headline para o one-page">
        <Input
          placeholder="Ex: Melhor mes da historia!"
          value={form.frase_destaque}
          onChange={(e) => updateField('frase_destaque', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Proximo passo" hint="Opcional">
        <Input
          placeholder="Ex: Dobrar investimento no canal X"
          value={form.proximo_passo}
          onChange={(e) => updateField('proximo_passo', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>

      <FieldGroup label="Logo do cliente — URL" hint="Opcional — link da logo">
        <Input
          placeholder="https://..."
          value={form.client_logo_url}
          onChange={(e) => updateField('client_logo_url', e.target.value)}
          className="h-9 text-sm"
        />
      </FieldGroup>
    </SectionCard>
  );
}
