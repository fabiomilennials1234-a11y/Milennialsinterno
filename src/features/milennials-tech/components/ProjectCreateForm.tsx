import { useMemo, useState, type FormEvent } from 'react';
import { Building2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Contract types (engineer pairs against these)
// ---------------------------------------------------------------------------

export type ProjectCreateType = 'internal' | 'client';
export type ProjectCreatePriority = 'critical' | 'high' | 'medium' | 'low';

export interface ProjectCreateProfile {
  user_id: string;
  name: string;
}

export interface ProjectCreateValues {
  name: string;
  /** 2-6 chars, uppercased. Drives the issue key (e.g. AGS-1). */
  key_prefix: string;
  lead_id: string | null;
  type: ProjectCreateType;
  description: string | null;
  priority: ProjectCreatePriority;
}

export interface ProjectCreateFormProps {
  /** Lead options (engineer passes from useProfiles). */
  profiles: ProjectCreateProfile[];
  onSubmit: (values: ProjectCreateValues) => void;
  onCancel?: () => void;
  /** True while the create mutation is in-flight. */
  isSubmitting?: boolean;
  /**
   * Server-driven error for the key prefix (e.g. duplicate). Rendered inline.
   * Format errors are computed locally — pass this ONLY for collisions.
   */
  keyPrefixError?: string | null;
  /** Used by parent to clear a stale duplicate error when the prefix changes. */
  onKeyPrefixChange?: (value: string) => void;
  defaultValues?: Partial<ProjectCreateValues>;
  /** When true, renders the inline Cancel button (modal supplies its own footer otherwise). */
  showCancel?: boolean;
  /** id for the <form>, so an external footer can submit via form="…". */
  formId?: string;
}

// ---------------------------------------------------------------------------
// Style vocabulary (inherited from ProjectFormModal)
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const labelCls = 'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';
const errorCls = 'text-[11px] text-[var(--mtech-danger)] mt-1';
const hintCls = 'text-[11px] text-[var(--mtech-text-subtle)] mt-1';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';

const PRIORITY_LABEL: Record<ProjectCreatePriority, string> = {
  critical: 'Critica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
};

const KEY_FORMAT = /^[A-Z]{2,6}$/;
const NONE = '__none__';

function sanitizePrefix(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectCreateForm({
  profiles,
  onSubmit,
  onCancel,
  isSubmitting = false,
  keyPrefixError = null,
  onKeyPrefixChange,
  defaultValues,
  showCancel = false,
  formId,
}: ProjectCreateFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [keyPrefix, setKeyPrefix] = useState(defaultValues?.key_prefix ?? '');
  const [leadId, setLeadId] = useState<string | null>(defaultValues?.lead_id ?? null);
  const [type, setType] = useState<ProjectCreateType>(defaultValues?.type ?? 'internal');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [priority, setPriority] = useState<ProjectCreatePriority>(
    defaultValues?.priority ?? 'medium',
  );

  // Track which fields the user has interacted with — never shout errors on a pristine form.
  const [touched, setTouched] = useState<{ name?: boolean; key?: boolean }>({});

  const nameValid = name.trim().length >= 3;
  const keyFormatValid = KEY_FORMAT.test(keyPrefix);
  const keyError =
    touched.key && keyPrefix.length > 0 && !keyFormatValid
      ? 'Use 2 a 6 letras (A-Z), sem espacos.'
      : keyPrefixError ?? null;

  const canSubmit = nameValid && keyFormatValid && !keyPrefixError && !isSubmitting;

  const keyPreview = useMemo(() => {
    if (!keyFormatValid) return null;
    return [1, 2, 3].map((n) => `${keyPrefix}-${n}`);
  }, [keyFormatValid, keyPrefix]);

  function handlePrefix(raw: string) {
    const next = sanitizePrefix(raw);
    setKeyPrefix(next);
    onKeyPrefixChange?.(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ name: true, key: true });
    if (!nameValid || !keyFormatValid || keyPrefixError) return;
    onSubmit({
      name: name.trim(),
      key_prefix: keyPrefix,
      lead_id: leadId,
      type,
      description: description.trim() || null,
      priority,
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid gap-5" noValidate>
      {/* Identity block: name + key + live key preview, kept visually attached */}
      <div className="space-y-2">
      <div className="grid grid-cols-[1fr_140px] gap-3 items-start">
        <div className="space-y-1">
          <Label htmlFor="pc-name" className={labelCls}>
            Nome do projeto
          </Label>
          <Input
            id="pc-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="Ex: Portal do Cliente, App Agus..."
            className={inputCls}
            aria-invalid={touched.name && !nameValid}
            aria-describedby={touched.name && !nameValid ? 'pc-name-err' : undefined}
          />
          {touched.name && !nameValid && (
            <p id="pc-name-err" className={errorCls}>
              Minimo de 3 caracteres.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="pc-key" className={labelCls}>
            Chave
          </Label>
          <Input
            id="pc-key"
            value={keyPrefix}
            onChange={(e) => handlePrefix(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, key: true }))}
            placeholder="AGS"
            maxLength={6}
            autoCapitalize="characters"
            spellCheck={false}
            data-mono
            className={`${inputCls} uppercase tracking-[0.18em] font-medium ${
              keyError ? 'border-[var(--mtech-danger)]/60' : ''
            }`}
            aria-invalid={!!keyError}
            aria-describedby={keyError ? 'pc-key-err' : 'pc-key-hint'}
          />
        </div>
      </div>

      {/* Key preview / errors — full width under the identity row */}
      <div>
        {keyError ? (
          <p id="pc-key-err" className={errorCls}>
            {keyError}
          </p>
        ) : keyPreview ? (
          <div id="pc-key-hint" className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[var(--mtech-text-subtle)]">As tasks virao como</span>
            {keyPreview.map((k, i) => (
              <span
                key={k}
                data-mono
                className={`inline-flex items-center rounded-[var(--mtech-radius-sm)] px-1.5 py-0.5 text-[11px] font-medium border ${
                  i === 0
                    ? 'border-[var(--mtech-accent)]/35 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
                    : 'border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] text-[var(--mtech-text-muted)]'
                }`}
              >
                {k}
              </span>
            ))}
            <span className="text-[11px] text-[var(--mtech-text-subtle)]" data-mono>
              …
            </span>
          </div>
        ) : (
          <p id="pc-key-hint" className={hintCls}>
            2 a 6 letras. Vira o prefixo de toda task do projeto.
          </p>
        )}
      </div>
      </div>

      {/* Type — segmented control */}
      <div className="space-y-1.5">
        <Label className={labelCls}>Tipo</Label>
        <div
          role="radiogroup"
          aria-label="Tipo de projeto"
          className="grid grid-cols-2 gap-2"
        >
          {([
            { value: 'internal', label: 'Interno', icon: Lock },
            { value: 'client', label: 'Cliente', icon: Building2 },
          ] as const).map((opt) => {
            const active = type === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(opt.value)}
                className={`flex items-center justify-center gap-2 h-9 rounded-[var(--mtech-radius-sm)] border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mtech-input-focus)] ${
                  active
                    ? 'border-[var(--mtech-accent)]/40 bg-[var(--mtech-accent-muted)] text-[var(--mtech-accent)]'
                    : 'border-[var(--mtech-border)] bg-[var(--mtech-input-bg)] text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] hover:border-[var(--mtech-border-strong)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lead + Priority */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={labelCls}>Lead</Label>
          <Select
            value={leadId ?? NONE}
            onValueChange={(v) => setLeadId(v === NONE ? null : v)}
          >
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent className={`${selectContentCls} max-h-60`}>
              <SelectItem value={NONE}>Sem lead</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={labelCls}>Prioridade</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as ProjectCreatePriority)}
          >
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              {(Object.entries(PRIORITY_LABEL) as [ProjectCreatePriority, string][]).map(
                ([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description — optional */}
      <div className="space-y-1">
        <Label htmlFor="pc-desc" className={labelCls}>
          Descricao{' '}
          <span className="font-normal normal-case tracking-normal text-[var(--mtech-text-subtle)]">
            opcional
          </span>
        </Label>
        <Textarea
          id="pc-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contexto, objetivo, escopo..."
          rows={2}
          className={inputCls}
        />
      </div>

      {/* Inline footer (only when not driven by an external modal footer) */}
      {showCancel && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-[var(--mtech-text-muted)] hover:text-[var(--mtech-text)] h-9 px-4 text-sm"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="bg-[var(--mtech-accent)] text-black font-semibold hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 rounded-[var(--mtech-radius-sm)] h-9 px-5 text-sm"
          >
            {isSubmitting ? 'Criando...' : 'Criar projeto'}
          </Button>
        </div>
      )}
    </form>
  );
}
