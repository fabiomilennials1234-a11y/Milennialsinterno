import { useState, useRef } from 'react';
import { FileText, Upload, Loader2, ImageIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useCreateResultsReport } from '@/hooks/useClientResultsReports';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

interface FormData {
  actionsLast30Days: string;
  achievements: string;
  trafficResults: string;
  keyMetrics: string;
  topCampaign: string;
  improvementPoints: string;
  next30Days: string;
  nextSteps: string;
}

const INITIAL_FORM: FormData = {
  actionsLast30Days: '',
  achievements: '',
  trafficResults: '',
  keyMetrics: '',
  topCampaign: '',
  improvementPoints: '',
  next30Days: '',
  nextSteps: '',
};

const FIELDS: { key: keyof FormData; label: string; placeholder: string }[] = [
  { key: 'actionsLast30Days', label: 'Ações realizadas nos últimos 30 dias', placeholder: 'Descreva as ações executadas...' },
  { key: 'achievements', label: 'Conquistas importantes', placeholder: 'Número de leads, vendas, mensagens...' },
  { key: 'trafficResults', label: 'Resultados detalhados de tráfego pago', placeholder: 'Investimento, CPL, CPA, ROAS...' },
  { key: 'keyMetrics', label: 'Principais métricas de desempenho', placeholder: 'Métricas mais relevantes do período...' },
  { key: 'topCampaign', label: 'Campanha Top 1', placeholder: 'Descreva a campanha de melhor resultado...' },
  { key: 'improvementPoints', label: 'Pontos a melhorar', placeholder: 'O que precisa ser ajustado...' },
  { key: 'next30Days', label: 'O que faremos nos próximos 30 dias', placeholder: 'Plano de ação...' },
  { key: 'nextSteps', label: 'Próximos passos', placeholder: 'Ações imediatas...' },
];

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ACCEPTED_LOGO_TYPES = [...ACCEPTED_IMAGE_TYPES, 'image/svg+xml'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface SectionImageState {
  file: File | null;
  preview: string | null;
  uploadedUrl: string | null;
  status: UploadStatus;
  errorMessage: string | null;
}

const INITIAL_IMAGE_STATE: SectionImageState = {
  file: null,
  preview: null,
  uploadedUrl: null,
  status: 'idle',
  errorMessage: null,
};

function validateFile(file: File, acceptedTypes: string[]): string | null {
  if (!acceptedTypes.includes(file.type)) {
    return `Formato inválido (${file.name}). Use ${acceptedTypes.map(t => t.split('/')[1]).join(', ').toUpperCase()}.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 5MB.`;
  }
  if (file.size === 0) {
    return 'Arquivo vazio ou corrompido.';
  }
  return null;
}

export default function ResultsReportBuilderModal({ open, onClose, clientId, clientName }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [logoState, setLogoState] = useState<SectionImageState>(INITIAL_IMAGE_STATE);
  const [sectionImages, setSectionImages] = useState<Record<keyof FormData, SectionImageState>>(
    () => Object.fromEntries(FIELDS.map(f => [f.key, { ...INITIAL_IMAGE_STATE }])) as Record<keyof FormData, SectionImageState>
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const sectionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const createReport = useCreateResultsReport();
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';

  // --- Validation ---
  const textsValid = FIELDS.every(f => form[f.key].trim().length > 0);
  const logoReady = logoState.status === 'success' && !!logoState.uploadedUrl;
  const allSectionImagesReady = FIELDS.every(f => sectionImages[f.key].status === 'success' && !!sectionImages[f.key].uploadedUrl);
  const anyUploading = logoState.status === 'uploading' || FIELDS.some(f => sectionImages[f.key].status === 'uploading');
  const canSubmit = textsValid && logoReady && allSectionImagesReady && !anyUploading && !isSubmitting;

  // --- Upload helper ---
  async function uploadFile(file: File, path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  // --- Logo handlers ---
  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateFile(file, ACCEPTED_LOGO_TYPES);
    if (validationError) {
      setLogoState({ ...INITIAL_IMAGE_STATE, status: 'error', errorMessage: validationError });
      toast.error(validationError);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoState(prev => ({ ...prev, file, preview: ev.target?.result as string, status: 'idle', errorMessage: null }));
    };
    reader.readAsDataURL(file);
    // Auto-upload
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/report-logos/${clientId}/${Date.now()}.${ext}`;
    setLogoState(prev => ({ ...prev, file, status: 'uploading', errorMessage: null }));
    uploadFile(file, path)
      .then(url => setLogoState(prev => ({ ...prev, uploadedUrl: url, status: 'success', errorMessage: null })))
      .catch(() => {
        setLogoState(prev => ({ ...prev, status: 'error', errorMessage: 'Não foi possível enviar a logo. Tente novamente.' }));
        toast.error('Falha ao enviar a logo. Tente novamente.');
      });
  }

  function removeLogo() {
    setLogoState(INITIAL_IMAGE_STATE);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  // --- Section image handlers ---
  function handleSectionImageSelect(key: keyof FormData, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateFile(file, ACCEPTED_IMAGE_TYPES);
    if (validationError) {
      setSectionImages(prev => ({ ...prev, [key]: { ...INITIAL_IMAGE_STATE, status: 'error', errorMessage: validationError } }));
      toast.error(validationError);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSectionImages(prev => ({ ...prev, [key]: { ...prev[key], preview: ev.target?.result as string } }));
    };
    reader.readAsDataURL(file);
    // Auto-upload
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/report-images/${clientId}/${key}/${Date.now()}.${ext}`;
    setSectionImages(prev => ({ ...prev, [key]: { ...prev[key], file, status: 'uploading', errorMessage: null } }));
    uploadFile(file, path)
      .then(url => setSectionImages(prev => ({ ...prev, [key]: { ...prev[key], uploadedUrl: url, status: 'success', errorMessage: null } })))
      .catch(() => {
        setSectionImages(prev => ({ ...prev, [key]: { ...prev[key], status: 'error', errorMessage: 'Falha no upload da imagem. Tente novamente.' } }));
        toast.error(`Falha ao enviar imagem da seção "${FIELDS.find(f => f.key === key)?.label}".`);
      });
  }

  function removeSectionImage(key: keyof FormData) {
    setSectionImages(prev => ({ ...prev, [key]: { ...INITIAL_IMAGE_STATE } }));
    const input = sectionInputRefs.current[key];
    if (input) input.value = '';
  }

  // --- Submit ---
  async function handleSubmit() {
    if (!canSubmit) return;

    // Final validation
    if (!logoState.uploadedUrl) {
      toast.error('A logo é obrigatória para criar o relatório.');
      return;
    }
    for (const field of FIELDS) {
      if (!sectionImages[field.key].uploadedUrl) {
        toast.error(`Imagem obrigatória não enviada na seção "${field.label}".`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const sectionImageUrls: Record<string, string[]> = {};
      for (const field of FIELDS) {
        sectionImageUrls[field.key] = [sectionImages[field.key].uploadedUrl!];
      }

      await createReport.mutateAsync({
        clientId,
        clientName,
        actionsLast30Days: form.actionsLast30Days,
        achievements: form.achievements,
        trafficResults: form.trafficResults,
        keyMetrics: form.keyMetrics,
        topCampaign: form.topCampaign,
        improvementPoints: form.improvementPoints,
        next30Days: form.next30Days,
        nextSteps: form.nextSteps,
        clientLogoUrl: logoState.uploadedUrl!,
        sectionImages: sectionImageUrls,
      });

      // Reset only on success
      setForm(INITIAL_FORM);
      setLogoState(INITIAL_IMAGE_STATE);
      setSectionImages(Object.fromEntries(FIELDS.map(f => [f.key, { ...INITIAL_IMAGE_STATE }])) as Record<keyof FormData, SectionImageState>);
      onClose();
    } catch {
      // Error already handled by mutation's onError
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (isSubmitting) return;
    setForm(INITIAL_FORM);
    setLogoState(INITIAL_IMAGE_STATE);
    setSectionImages(Object.fromEntries(FIELDS.map(f => [f.key, { ...INITIAL_IMAGE_STATE }])) as Record<keyof FormData, SectionImageState>);
    if (logoInputRef.current) logoInputRef.current.value = '';
    onClose();
  }

  // --- Missing items summary ---
  const missingItems: string[] = [];
  if (!logoReady) missingItems.push('Logo do cliente');
  FIELDS.forEach(f => {
    if (!form[f.key].trim()) missingItems.push(`Texto: ${f.label}`);
    if (sectionImages[f.key].status !== 'success') missingItems.push(`Imagem: ${f.label}`);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            Criar Relatório de Resultados
          </DialogTitle>
          <DialogDescription>
            Relatório de resultados dos últimos 30 dias para <strong>{clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Logo upload — OBRIGATÓRIO */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Upload size={14} />
              Logo do cliente <span className="text-destructive">*</span>
            </Label>
            {logoState.preview ? (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <img src={logoState.preview} alt="Logo" className="w-12 h-12 rounded-lg object-cover border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{logoState.file?.name}</p>
                  <StatusIndicator status={logoState.status} errorMessage={logoState.errorMessage} successText="Logo enviada" />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeLogo} disabled={isSubmitting}>
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-destructive/30 rounded-lg hover:border-primary/40 transition-colors flex flex-col items-center gap-2 text-muted-foreground"
              >
                <ImageIcon size={24} />
                <span className="text-sm">Clique para fazer upload <span className="text-destructive">(obrigatório)</span></span>
                <span className="text-xs">PNG, JPG, SVG ou WebP (máx. 5MB)</span>
              </button>
            )}
            {logoState.status === 'error' && logoState.errorMessage && !logoState.preview && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{logoState.errorMessage}</p>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoSelect}
            />
          </div>

          {/* Report fields + section images */}
          {FIELDS.map(({ key, label, placeholder }) => {
            const imgState = sectionImages[key];
            return (
              <div key={key} className="space-y-2 p-4 rounded-lg border border-subtle bg-muted/20">
                {/* Text */}
                <Label className="text-sm font-medium">
                  {label} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={form[key]}
                  onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="min-h-[80px] resize-none"
                />

                {/* Section image */}
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mt-2">
                  <ImageIcon size={12} />
                  Imagem desta seção <span className="text-destructive">*</span>
                </Label>
                {imgState.preview ? (
                  <div className="flex items-center gap-3 p-2 bg-card rounded-lg border">
                    <img src={imgState.preview} alt={`Imagem ${label}`} className="w-16 h-12 rounded object-cover border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{imgState.file?.name}</p>
                      <StatusIndicator status={imgState.status} errorMessage={imgState.errorMessage} successText="Imagem enviada" />
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSectionImage(key)} disabled={isSubmitting}>
                      <X size={12} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => sectionInputRefs.current[key]?.click()}
                    className="w-full p-3 border border-dashed border-destructive/20 rounded-lg hover:border-primary/30 transition-colors flex items-center gap-2 text-muted-foreground text-xs"
                  >
                    <Upload size={14} />
                    <span>Enviar imagem <span className="text-destructive">(obrigatório)</span></span>
                    <span className="ml-auto text-[10px]">PNG, JPG, WebP (máx. 5MB)</span>
                  </button>
                )}
                {imgState.status === 'error' && imgState.errorMessage && !imgState.preview && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{imgState.errorMessage}</p>
                )}
                <input
                  ref={el => { sectionInputRefs.current[key] = el; }}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => handleSectionImageSelect(key, e)}
                />
              </div>
            );
          })}

          {/* Summary of missing items */}
          {missingItems.length > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-xs font-medium text-warning mb-1">Itens pendentes para criar o relatório:</p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                {missingItems.slice(0, 5).map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
                {missingItems.length > 5 && (
                  <li>• e mais {missingItems.length - 5} item(ns)...</li>
                )}
              </ul>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <><Loader2 size={14} className="mr-2 animate-spin" /> Gerando relatório...</>
            ) : anyUploading ? (
              <><Loader2 size={14} className="mr-2 animate-spin" /> Aguardando uploads...</>
            ) : (
              'Gerar Relatório'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusIndicator({ status, errorMessage, successText }: { status: UploadStatus; errorMessage: string | null; successText: string }) {
  if (status === 'uploading') return <p className="text-[10px] text-primary flex items-center gap-1"><Loader2 size={10} className="animate-spin" />Enviando...</p>;
  if (status === 'success') return <p className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 size={10} />{successText}</p>;
  if (status === 'error') return <p className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle size={10} />{errorMessage || 'Erro no upload'}</p>;
  return null;
}
