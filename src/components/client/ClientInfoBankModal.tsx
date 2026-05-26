import { useState, useEffect } from 'react';
import { X, Loader2, Palette, Globe, Film, Code2, StickyNote, Type, Eye, Link, Instagram, Youtube, AtSign, Map } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useUpsertClientInfoBank,
  INFO_BANK_FIELDS,
  INFO_BANK_SECTIONS,
  type ClientInfoBankProfile,
  type InfoBankFieldDef,
} from '@/hooks/useClientInfoBank';

// ── Props ────────────────────────────────────────────────────

interface ClientInfoBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existing: ClientInfoBankProfile | null;
}

// ── Form state ───────────────────────────────────────────────

type FormState = Record<InfoBankFieldDef['key'], string>;

const EMPTY_FORM: FormState = Object.fromEntries(
  INFO_BANK_FIELDS.map((f) => [f.key, ''])
) as FormState;

function profileToForm(profile: ClientInfoBankProfile | null): FormState {
  if (!profile) return EMPTY_FORM;
  return Object.fromEntries(
    INFO_BANK_FIELDS.map((f) => [f.key, (profile as Record<string, string | null>)[f.key] ?? ''])
  ) as FormState;
}

/** Convert empty strings to null for DB upsert */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ── Section icons ────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  marca: <Palette size={14} />,
  presenca_digital: <Globe size={14} />,
  video: <Film size={14} />,
  dev: <Code2 size={14} />,
  geral: <StickyNote size={14} />,
};

const FIELD_ICONS: Partial<Record<InfoBankFieldDef['key'], React.ComponentType<{ size: number; className?: string }>>> = {
  brand_colors: Palette,
  typography: Type,
  visual_style: Eye,
  brand_manual_url: Link,
  logo_url: Link,
  website_url: Globe,
  instagram_handle: Instagram,
  youtube_channel: Youtube,
  tiktok_handle: AtSign,
  domain: Map,
  editing_style: Film,
  video_formats: Film,
  cms_platform: Code2,
  figma_url: Link,
  notes: StickyNote,
};

// ── Component ────────────────────────────────────────────────

export default function ClientInfoBankModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  existing,
}: ClientInfoBankModalProps) {
  const [form, setForm] = useState<FormState>(() => profileToForm(existing));
  const upsert = useUpsertClientInfoBank();

  useEffect(() => {
    if (isOpen) {
      setForm(profileToForm(existing));
    }
  }, [isOpen, existing]);

  const handleChange = (key: InfoBankFieldDef['key'], value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    upsert.mutate(
      {
        clientId,
        brandColors: emptyToNull(form.brand_colors),
        typography: emptyToNull(form.typography),
        visualStyle: emptyToNull(form.visual_style),
        brandManualUrl: emptyToNull(form.brand_manual_url),
        logoUrl: emptyToNull(form.logo_url),
        websiteUrl: emptyToNull(form.website_url),
        instagramHandle: emptyToNull(form.instagram_handle),
        youtubeChannel: emptyToNull(form.youtube_channel),
        tiktokHandle: emptyToNull(form.tiktok_handle),
        domain: emptyToNull(form.domain),
        editingStyle: emptyToNull(form.editing_style),
        videoFormats: emptyToNull(form.video_formats),
        cmsPlatform: emptyToNull(form.cms_platform),
        figmaUrl: emptyToNull(form.figma_url),
        notes: emptyToNull(form.notes),
      },
      {
        onSuccess: () => {
          toast.success('Banco de info do cliente salvo!');
          onClose();
        },
        onError: () => {
          toast.error('Erro ao salvar banco de info');
        },
      },
    );
  };

  const handleClose = () => {
    if (upsert.isPending) return;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl animate-scale-in border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              Banco de Info do Cliente
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={upsert.isPending}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-elegant">
          {INFO_BANK_SECTIONS.map((section) => {
            const sectionFields = INFO_BANK_FIELDS.filter((f) => f.section === section.key);
            if (sectionFields.length === 0) return null;

            return (
              <div key={section.key}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
                  <span className="text-primary">{SECTION_ICONS[section.key]}</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {section.label}
                  </h3>
                </div>

                <div className="space-y-4">
                  {sectionFields.map((field) => {
                    const FieldIcon = FIELD_ICONS[field.key];

                    if (field.type === 'textarea') {
                      return (
                        <div key={field.key} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {FieldIcon && <FieldIcon size={15} className="text-muted-foreground" />}
                            {field.label}
                          </label>
                          <textarea
                            value={form[field.key]}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            disabled={upsert.isPending}
                            rows={3}
                            className="input-apple resize-none"
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={field.key} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {FieldIcon && <FieldIcon size={15} className="text-muted-foreground" />}
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          value={form[field.key]}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          disabled={upsert.isPending}
                          className="input-apple"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              disabled={upsert.isPending}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-semibold uppercase text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {upsert.isPending && <Loader2 size={16} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
