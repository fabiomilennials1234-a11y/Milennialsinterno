import { useState, useCallback, useRef, type MouseEvent } from 'react';
import {
  ChevronDown,
  Upload,
  Download,
  Trash2,
  FileImage,
  FileVideo,
  FileText as FileTextIcon,
  File as FileIcon,
  Loader2,
  ImageIcon,
  Film,
  Palette,
  Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { downloadStorageFile } from '@/lib/storageUpload';
import {
  useClientInfoBankFiles,
  useUploadInfoBankFile,
  useDeleteInfoBankFile,
  useInfoBankFileSignedUrl,
  INFO_BANK_FILES_BUCKET,
  FILE_SECTIONS,
  MAX_FILE_SIZE,
  type InfoBankFileSection,
  type InfoBankFile,
} from '@/hooks/useClientInfoBankFiles';
import FileVersionDrawer from './FileVersionDrawer';

// ── Section icons ───────────────────────────────────────────

const SECTION_ICONS: Record<InfoBankFileSection, React.ReactNode> = {
  anuncios: <Megaphone size={14} />,
  criativos: <ImageIcon size={14} />,
  marca: <Palette size={14} />,
  videos: <Film size={14} />,
};

// ── Helpers ─────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return FileImage;
  if (contentType.startsWith('video/')) return FileVideo;
  if (contentType === 'application/pdf') return FileTextIcon;
  return FileIcon;
}

// ── File thumbnail ──────────────────────────────────────────

interface FileThumbnailProps {
  file: InfoBankFile;
  clientId: string;
  canDelete: boolean;
}

function FileThumbnail({ file, clientId, canDelete }: FileThumbnailProps) {
  const isImage = isImageType(file.content_type);
  const { data: signedUrl } = useInfoBankFileSignedUrl(isImage ? file.file_path : undefined);
  const Icon = getFileIcon(file.content_type);
  const deleteMutation = useDeleteInfoBankFile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      await downloadStorageFile(INFO_BANK_FILES_BUCKET, file.file_path, file.file_name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar arquivo');
    }
  }, [file.file_path, file.file_name]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync({ fileId: file.id, clientId });
      toast.success(`${file.file_name} removido`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover arquivo');
    } finally {
      setDeleteOpen(false);
    }
  }, [deleteMutation, file.id, file.file_name, clientId]);

  return (
    <div className="group relative rounded-lg border border-border bg-background hover:border-primary/30 transition-all overflow-hidden">
      {/* Action buttons — visible on hover */}
      <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md bg-background/90 backdrop-blur-sm border border-border p-1 hover:bg-primary hover:text-primary-foreground transition-colors"
          title="Baixar"
        >
          <Download size={12} />
        </button>

        {canDelete && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="rounded-md bg-background/90 backdrop-blur-sm border border-border p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                title="Remover"
              >
                <Trash2 size={12} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover arquivo</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{file.file_name}</strong> sera removido permanentemente. Essa acao nao pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className={cn(buttonVariants({ variant: 'destructive' }))}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin mr-1" />
                  ) : null}
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Preview area */}
      <div className="aspect-square flex items-center justify-center bg-muted/30 overflow-hidden">
        {isImage && signedUrl ? (
          <img
            src={signedUrl}
            alt={file.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon size={32} className="text-muted-foreground/50" />
        )}
      </div>

      {/* Info */}
      <div className="p-2 space-y-0.5">
        <div className="flex items-center gap-1">
          <p className="text-xs font-medium text-foreground truncate flex-1" title={file.file_name}>
            {file.file_name}
          </p>
          {file.version > 1 && (
            <button
              type="button"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                setVersionDrawerOpen(true);
              }}
              className="flex-shrink-0 text-[9px] font-mono font-bold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-colors"
              title="Ver historico de versoes"
            >
              v{file.version}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{formatFileSize(file.file_size)}</span>
          <span>{formatDate(file.created_at)}</span>
        </div>
      </div>

      {/* Version history drawer */}
      {file.version > 1 && (
        <FileVersionDrawer
          open={versionDrawerOpen}
          onOpenChange={setVersionDrawerOpen}
          clientId={file.client_id}
          section={file.section}
          fileName={file.file_name}
        />
      )}
    </div>
  );
}

// ── Drop zone + section ─────────────────────────────────────

interface SectionPanelProps {
  clientId: string;
  section: InfoBankFileSection;
  label: string;
}

function SectionPanel({ clientId, section, label }: SectionPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user, isAdminUser } = useAuth();
  const { data: files, isLoading } = useClientInfoBankFiles(clientId, section);
  const uploadMutation = useUploadInfoBankFile();

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesToUpload = Array.from(fileList);

      for (const file of filesToUpload) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} excede 500MB (${formatFileSize(file.size)})`);
          continue;
        }

        try {
          setUploadProgress(0);
          await uploadMutation.mutateAsync({
            clientId,
            section,
            file,
            onProgress: (pct) => setUploadProgress(pct),
          });
          toast.success(`${file.name} enviado`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
          toast.error(msg);
        } finally {
          setUploadProgress(null);
        }
      }
    },
    [clientId, section, uploadMutation],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles],
  );

  const fileCount = files?.length ?? 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors group">
        <span className="text-primary">{SECTION_ICONS[section]}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex-1 text-left">
          {label}
        </span>
        {fileCount > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {fileCount}
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            'text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 pb-4 space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              isDragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border/60 hover:border-primary/40 hover:bg-muted/30',
            )}
          >
            <Upload size={20} className={cn('text-muted-foreground', isDragOver && 'text-primary')} />
            <p className="text-xs text-muted-foreground text-center">
              {isDragOver ? 'Solte para enviar' : 'Arraste arquivos ou clique para selecionar'}
            </p>
            <p className="text-[10px] text-muted-foreground/60">Max 500MB por arquivo</p>

            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {/* Upload progress */}
          {uploadProgress !== null && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground text-right tabular-nums">
                {uploadProgress}%
              </p>
            </div>
          )}

          {/* File grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : fileCount > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {files!.map((file) => (
                <FileThumbnail
                  key={file.id}
                  file={file}
                  clientId={clientId}
                  canDelete={isAdminUser || file.uploaded_by === user?.id}
                />
              ))}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main panel ──────────────────────────────────────────────

interface InfoBankFilesPanelProps {
  clientId: string;
}

export default function InfoBankFilesPanel({ clientId }: InfoBankFilesPanelProps) {
  return (
    <div className="p-6 space-y-1">
      {FILE_SECTIONS.map(({ key, label }) => (
        <SectionPanel key={key} clientId={clientId} section={key} label={label} />
      ))}
    </div>
  );
}
