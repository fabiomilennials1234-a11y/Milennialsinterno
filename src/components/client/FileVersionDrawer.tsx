import { Download, FileImage, FileVideo, FileText as FileTextIcon, File as FileIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  useFileVersionHistory,
  INFO_BANK_FILES_BUCKET,
  type InfoBankFile,
  type InfoBankFileSection,
} from '@/hooks/useClientInfoBankFiles';

// ── Helpers ─────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return FileImage;
  if (contentType.startsWith('video/')) return FileVideo;
  if (contentType === 'application/pdf') return FileTextIcon;
  return FileIcon;
}

async function downloadFile(file: InfoBankFile) {
  try {
    const { data, error } = await supabase.storage
      .from(INFO_BANK_FILES_BUCKET)
      .createSignedUrl(file.file_path, 60);

    if (error) throw error;

    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = file.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    toast.error('Erro ao baixar arquivo');
  }
}

// ── Version row ─────────────────────────────────────────────

function VersionRow({ file, isCurrent }: { file: InfoBankFile; isCurrent: boolean }) {
  const Icon = getFileIcon(file.content_type);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
        isCurrent
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-background hover:bg-muted/30',
      )}
    >
      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md bg-muted/50">
        <Icon size={18} className="text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-foreground">
            v{file.version}
          </span>
          {isCurrent && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              Atual
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{formatFileSize(file.file_size)}</span>
          <span className="text-border">|</span>
          <span>{formatDateTime(file.created_at)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => downloadFile(file)}
        className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={`Download v${file.version}`}
      >
        <Download size={14} />
      </button>
    </div>
  );
}

// ── Drawer ──────────────────────────────────────────────────

interface FileVersionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  section: InfoBankFileSection;
  fileName: string;
}

export default function FileVersionDrawer({
  open,
  onOpenChange,
  clientId,
  section,
  fileName,
}: FileVersionDrawerProps) {
  const { data: versions, isLoading } = useFileVersionHistory(
    open ? clientId : undefined,
    open ? section : undefined,
    open ? fileName : undefined,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold">Historico de versoes</SheetTitle>
          <SheetDescription className="text-xs truncate" title={fileName}>
            {fileName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : versions && versions.length > 0 ? (
            versions.map((file) => (
              <VersionRow
                key={file.id}
                file={file}
                isCurrent={file.replaced_by === null}
              />
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-12">
              Nenhuma versao encontrada
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
