import { useState, useEffect } from 'react';
import { X, Loader2, Film, Monitor, Youtube, Music, Link, Instagram, StickyNote, Gauge, Clapperboard } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpsertClientVideoProfile, type ClientVideoProfile } from '@/hooks/useClientVideoProfiles';

interface ClientVideoProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existing: ClientVideoProfile | null;
}

interface FormState {
  editing_style: string;
  video_format: string;
  resolution: string;
  youtube_channel: string;
  tiktok_handle: string;
  instagram_handle: string;
  pacing: string;
  music_style: string;
  intro_outro_url: string;
  reference_urls: string;
  brand_assets_url: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  editing_style: '',
  video_format: '',
  resolution: '',
  youtube_channel: '',
  tiktok_handle: '',
  instagram_handle: '',
  pacing: '',
  music_style: '',
  intro_outro_url: '',
  reference_urls: '',
  brand_assets_url: '',
  notes: '',
};

function profileToForm(profile: ClientVideoProfile | null): FormState {
  if (!profile) return EMPTY_FORM;
  return {
    editing_style: profile.editing_style ?? '',
    video_format: profile.video_format ?? '',
    resolution: profile.resolution ?? '',
    youtube_channel: profile.youtube_channel ?? '',
    tiktok_handle: profile.tiktok_handle ?? '',
    instagram_handle: profile.instagram_handle ?? '',
    pacing: profile.pacing ?? '',
    music_style: profile.music_style ?? '',
    intro_outro_url: profile.intro_outro_url ?? '',
    reference_urls: profile.reference_urls ?? '',
    brand_assets_url: profile.brand_assets_url ?? '',
    notes: profile.notes ?? '',
  };
}

/** Convert empty strings to null for DB upsert */
function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const FIELDS = [
  { key: 'editing_style' as const, label: 'Estilo de edicao', type: 'text', placeholder: 'Dinamico, clean, cinematografico...', icon: Clapperboard },
  { key: 'video_format' as const, label: 'Formatos de video', type: 'text', placeholder: 'Reels, YouTube, Stories, TikTok...', icon: Film },
  { key: 'resolution' as const, label: 'Resolucao padrao', type: 'text', placeholder: '1080p, 4K...', icon: Monitor },
  { key: 'pacing' as const, label: 'Ritmo preferido', type: 'text', placeholder: 'Rapido, moderado, lento...', icon: Gauge },
  { key: 'music_style' as const, label: 'Estilo de trilha/musica', type: 'text', placeholder: 'Lo-fi, corporativo, energetico...', icon: Music },
  { key: 'youtube_channel' as const, label: 'Canal YouTube', type: 'url', placeholder: 'https://youtube.com/@canal', icon: Youtube },
  { key: 'tiktok_handle' as const, label: '@ TikTok', type: 'text', placeholder: '@cliente', icon: Film },
  { key: 'instagram_handle' as const, label: '@ Instagram (Reels)', type: 'text', placeholder: '@cliente', icon: Instagram },
  { key: 'intro_outro_url' as const, label: 'Intro/Outro (link)', type: 'url', placeholder: 'https://drive.google.com/...', icon: Link },
  { key: 'reference_urls' as const, label: 'Videos de referencia (links)', type: 'url', placeholder: 'https://youtube.com/...', icon: Link },
  { key: 'brand_assets_url' as const, label: 'Assets da marca (link)', type: 'url', placeholder: 'https://drive.google.com/...', icon: Link },
] as const;

export default function ClientVideoProfileModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  existing,
}: ClientVideoProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => profileToForm(existing));
  const upsert = useUpsertClientVideoProfile();

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
        editingStyle: emptyToNull(form.editing_style),
        videoFormat: emptyToNull(form.video_format),
        resolution: emptyToNull(form.resolution),
        youtubeChannel: emptyToNull(form.youtube_channel),
        tiktokHandle: emptyToNull(form.tiktok_handle),
        instagramHandle: emptyToNull(form.instagram_handle),
        pacing: emptyToNull(form.pacing),
        musicStyle: emptyToNull(form.music_style),
        introOutroUrl: emptyToNull(form.intro_outro_url),
        referenceUrls: emptyToNull(form.reference_urls),
        brandAssetsUrl: emptyToNull(form.brand_assets_url),
        notes: emptyToNull(form.notes),
      },
      {
        onSuccess: () => {
          toast.success('Perfil de video salvo!');
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
              Perfil de Video
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
              Observacoes do editor
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
