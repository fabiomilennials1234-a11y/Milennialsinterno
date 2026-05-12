import { useState, useEffect } from 'react';
import { X, Loader2, Code2, Layers, Globe, Server, Link, Figma, BarChart3, FileText, StickyNote, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpsertClientDevProfile, type ClientDevProfile } from '@/hooks/useClientDevProfiles';

interface ClientDevProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existing: ClientDevProfile | null;
}

interface FormState {
  frontend_stack: string;
  css_framework: string;
  cms_platform: string;
  hosting_provider: string;
  domain: string;
  staging_url: string;
  repository_url: string;
  figma_url: string;
  analytics_id: string;
  api_docs_url: string;
  deploy_notes: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  frontend_stack: '',
  css_framework: '',
  cms_platform: '',
  hosting_provider: '',
  domain: '',
  staging_url: '',
  repository_url: '',
  figma_url: '',
  analytics_id: '',
  api_docs_url: '',
  deploy_notes: '',
  notes: '',
};

function profileToForm(profile: ClientDevProfile | null): FormState {
  if (!profile) return EMPTY_FORM;
  return {
    frontend_stack: profile.frontend_stack ?? '',
    css_framework: profile.css_framework ?? '',
    cms_platform: profile.cms_platform ?? '',
    hosting_provider: profile.hosting_provider ?? '',
    domain: profile.domain ?? '',
    staging_url: profile.staging_url ?? '',
    repository_url: profile.repository_url ?? '',
    figma_url: profile.figma_url ?? '',
    analytics_id: profile.analytics_id ?? '',
    api_docs_url: profile.api_docs_url ?? '',
    deploy_notes: profile.deploy_notes ?? '',
    notes: profile.notes ?? '',
  };
}

/** Convert empty strings to null for DB upsert */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const FIELDS = [
  { key: 'frontend_stack' as const, label: 'Stack frontend', type: 'text', placeholder: 'React, Next.js, Vue, WordPress...', icon: Code2 },
  { key: 'css_framework' as const, label: 'Framework CSS', type: 'text', placeholder: 'Tailwind, Bootstrap, Styled Components...', icon: Layers },
  { key: 'cms_platform' as const, label: 'CMS / Plataforma', type: 'text', placeholder: 'WordPress, Webflow, Shopify...', icon: Globe },
  { key: 'hosting_provider' as const, label: 'Hosting', type: 'text', placeholder: 'Vercel, Netlify, AWS, Hostinger...', icon: Server },
  { key: 'domain' as const, label: 'Dominio', type: 'text', placeholder: 'www.cliente.com.br', icon: Globe },
  { key: 'staging_url' as const, label: 'URL de staging', type: 'url', placeholder: 'https://staging.cliente.com.br', icon: Link },
  { key: 'repository_url' as const, label: 'Repositorio (GitHub/GitLab)', type: 'url', placeholder: 'https://github.com/org/repo', icon: Code2 },
  { key: 'figma_url' as const, label: 'Figma / Design System', type: 'url', placeholder: 'https://figma.com/file/...', icon: Figma },
  { key: 'analytics_id' as const, label: 'Google Analytics / GTM ID', type: 'text', placeholder: 'G-XXXXXXXXXX ou GTM-XXXXXX', icon: BarChart3 },
  { key: 'api_docs_url' as const, label: 'Documentacao de APIs', type: 'url', placeholder: 'https://docs.api.cliente.com', icon: FileText },
] as const;

export default function ClientDevProfileModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  existing,
}: ClientDevProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => profileToForm(existing));
  const upsert = useUpsertClientDevProfile();

  useEffect(() => {
    if (isOpen) {
      setForm(profileToForm(existing));
    }
  }, [isOpen, existing]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    upsert.mutate(
      {
        clientId,
        frontendStack: emptyToNull(form.frontend_stack),
        cssFramework: emptyToNull(form.css_framework),
        cmsPlatform: emptyToNull(form.cms_platform),
        hostingProvider: emptyToNull(form.hosting_provider),
        domain: emptyToNull(form.domain),
        stagingUrl: emptyToNull(form.staging_url),
        repositoryUrl: emptyToNull(form.repository_url),
        figmaUrl: emptyToNull(form.figma_url),
        analyticsId: emptyToNull(form.analytics_id),
        apiDocsUrl: emptyToNull(form.api_docs_url),
        deployNotes: emptyToNull(form.deploy_notes),
        notes: emptyToNull(form.notes),
      },
      {
        onSuccess: () => {
          toast.success('Perfil de desenvolvimento salvo!');
          onClose();
        },
        onError: () => {
          toast.error('Erro ao salvar perfil');
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
              Perfil de Desenvolvimento
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-elegant">
          {FIELDS.map(({ key, label, type, placeholder, icon: Icon }) => (
            <div key={key} className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon size={15} className="text-muted-foreground" />
                {label}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                disabled={upsert.isPending}
                className="input-apple"
              />
            </div>
          ))}

          {/* Deploy notes — textarea */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Rocket size={15} className="text-muted-foreground" />
              Instrucoes de deploy
            </label>
            <textarea
              value={form.deploy_notes}
              onChange={(e) => handleChange('deploy_notes', e.target.value)}
              placeholder="Como fazer deploy, comandos, ordem..."
              disabled={upsert.isPending}
              rows={3}
              className="input-apple resize-none"
            />
          </div>

          {/* Notes — textarea */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <StickyNote size={15} className="text-muted-foreground" />
              Observacoes do dev
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Preferencias especiais, restricoes, detalhes tecnicos..."
              disabled={upsert.isPending}
              rows={3}
              className="input-apple resize-none"
            />
          </div>

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
