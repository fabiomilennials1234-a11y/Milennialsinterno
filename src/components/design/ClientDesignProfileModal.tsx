import { useState, useEffect } from 'react';
import { X, Loader2, Palette, Type, Eye, Link, Instagram, Globe, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpsertClientDesignProfile, type ClientDesignProfile } from '@/hooks/useClientDesignProfiles';

interface ClientDesignProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existing: ClientDesignProfile | null;
}

interface FormState {
  brand_colors: string;
  typography: string;
  visual_style: string;
  brand_manual_url: string;
  logo_url: string;
  instagram_handle: string;
  website_url: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  brand_colors: '',
  typography: '',
  visual_style: '',
  brand_manual_url: '',
  logo_url: '',
  instagram_handle: '',
  website_url: '',
  notes: '',
};

function profileToForm(profile: ClientDesignProfile | null): FormState {
  if (!profile) return EMPTY_FORM;
  return {
    brand_colors: profile.brand_colors ?? '',
    typography: profile.typography ?? '',
    visual_style: profile.visual_style ?? '',
    brand_manual_url: profile.brand_manual_url ?? '',
    logo_url: profile.logo_url ?? '',
    instagram_handle: profile.instagram_handle ?? '',
    website_url: profile.website_url ?? '',
    notes: profile.notes ?? '',
  };
}

/** Convert empty strings to null for DB upsert */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const FIELDS = [
  { key: 'brand_colors' as const, label: 'Cores da marca', type: 'text', placeholder: '#FF5500, #1A1A2E, #FAFAFA...', icon: Palette },
  { key: 'typography' as const, label: 'Tipografia', type: 'text', placeholder: 'Montserrat (titulos), Inter (corpo)...', icon: Type },
  { key: 'visual_style' as const, label: 'Estilo visual', type: 'text', placeholder: 'Minimalista, cores vibrantes, foto-realista...', icon: Eye },
  { key: 'brand_manual_url' as const, label: 'Manual de marca (link)', type: 'url', placeholder: 'https://drive.google.com/...', icon: Link },
  { key: 'logo_url' as const, label: 'Logo (link)', type: 'url', placeholder: 'https://drive.google.com/...', icon: Link },
  { key: 'instagram_handle' as const, label: '@ Instagram', type: 'text', placeholder: '@cliente', icon: Instagram },
  { key: 'website_url' as const, label: 'Site', type: 'url', placeholder: 'https://www.cliente.com.br', icon: Globe },
] as const;

export default function ClientDesignProfileModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  existing,
}: ClientDesignProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => profileToForm(existing));
  const upsert = useUpsertClientDesignProfile();

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
        brandColors: emptyToNull(form.brand_colors),
        typography: emptyToNull(form.typography),
        visualStyle: emptyToNull(form.visual_style),
        brandManualUrl: emptyToNull(form.brand_manual_url),
        logoUrl: emptyToNull(form.logo_url),
        instagramHandle: emptyToNull(form.instagram_handle),
        websiteUrl: emptyToNull(form.website_url),
        notes: emptyToNull(form.notes),
      },
      {
        onSuccess: () => {
          toast.success('Perfil de design salvo!');
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
              Perfil de Design
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

          {/* Notes — textarea, separate from the map */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <StickyNote size={15} className="text-muted-foreground" />
              Observacoes do designer
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Preferencias especiais, restricoes..."
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
