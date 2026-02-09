import { useState, useRef } from 'react';
import { 
  Paperclip, 
  Upload, 
  Loader2, 
  Trash2, 
  Download, 
  Video, 
  Image as ImageIcon,
  X,
  Play,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  CardAttachment,
  useUploadAttachment,
  useDeleteAttachment,
} from '@/hooks/useDesignKanban';
import { MAX_ATTACHMENTS_PER_CARD, getMaxFileSize, isAllowedFileType } from '@/hooks/useCardAttachments';

interface CardAttachmentsTabProps {
  cardId: string;
  attachments: CardAttachment[];
  isLoading: boolean;
  canDelete: boolean;
}

export default function CardAttachmentsTab({
  cardId,
  attachments,
  isLoading,
  canDelete,
}: CardAttachmentsTabProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CardAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  // Separate by type
  const images = attachments.filter(a => a.file_type?.startsWith('image/'));
  const videos = attachments.filter(a => a.file_type?.startsWith('video/'));
  const otherFiles = attachments.filter(a => 
    !a.file_type?.startsWith('image/') && !a.file_type?.startsWith('video/')
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check limit
    if (attachments.length + files.length > MAX_ATTACHMENTS_PER_CARD) {
      toast.error(`Máximo de ${MAX_ATTACHMENTS_PER_CARD} anexos por card. Você tem ${attachments.length} anexos.`);
      return;
    }

    for (const file of Array.from(files)) {
      // Check file type
      if (!isAllowedFileType(file.type)) {
        toast.error(`Tipo de arquivo não permitido: ${file.name}`);
        continue;
      }

      // Check file size (only for non-videos)
      if (!file.type.startsWith('video/')) {
        const maxSize = getMaxFileSize(file.type);
        if (file.size > maxSize) {
          const maxSizeMB = maxSize / (1024 * 1024);
          toast.error(`${file.name} é muito grande (máx ${maxSizeMB}MB)`);
          continue;
        }
      }

      try {
        await uploadAttachment.mutateAsync({
          cardId,
          file,
        });
        toast.success(`${file.name} enviado!`);
      } catch (error) {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    // Reset input
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachment: CardAttachment) => {
    try {
      await deleteAttachment.mutateAsync({
        attachmentId: attachment.id,
        cardId,
        fileUrl: attachment.file_url,
      });
      toast.success('Anexo removido!');
    } catch (error) {
      toast.error('Erro ao remover anexo');
    }
  };

  const handleDownload = async (attachment: CardAttachment) => {
    try {
      const response = await fetch(attachment.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const openImageLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openVideoModal = (video: CardAttachment) => {
    setSelectedVideo(video);
    setVideoModalOpen(true);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setLightboxIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    } else {
      setLightboxIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-b border-border pb-4">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          disabled={uploadAttachment.isPending || attachments.length >= MAX_ATTACHMENTS_PER_CARD}
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          multiple
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending || attachments.length >= MAX_ATTACHMENTS_PER_CARD}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed transition-colors",
            attachments.length >= MAX_ATTACHMENTS_PER_CARD
              ? "border-muted text-muted-foreground cursor-not-allowed"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-primary/50"
          )}
        >
          {uploadAttachment.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} />
          )}
          <span className="font-medium">
            {attachments.length >= MAX_ATTACHMENTS_PER_CARD 
              ? `Limite de ${MAX_ATTACHMENTS_PER_CARD} anexos atingido`
              : 'Enviar imagens ou vídeos (sem limite de tamanho para vídeos)'}
          </span>
        </button>
        <p className="text-center text-xs text-muted-foreground mt-2">
          {attachments.length} / {MAX_ATTACHMENTS_PER_CARD} anexos
        </p>
      </div>

      {/* Images Section */}
      {images.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <ImageIcon size={16} />
            Imagens ({images.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img, index) => (
              <div 
                key={img.id}
                className="group relative rounded-xl border border-border overflow-hidden bg-muted/30 aspect-square cursor-pointer"
                onClick={() => openImageLightbox(index)}
              >
                <img 
                  src={img.file_url} 
                  alt={img.file_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                
                {/* Actions Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
                  <p className="text-xs text-white truncate flex-1 mr-2">{img.file_name}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(img);
                      }}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white transition-colors"
                      title="Baixar"
                    >
                      <Download size={14} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAttachment(img);
                        }}
                        className="p-1.5 rounded-lg bg-danger/80 hover:bg-danger text-white transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {videos.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Video size={16} />
            Vídeos ({videos.length})
          </h4>
          <div className="space-y-2">
            {videos.map((video) => (
              <div 
                key={video.id}
                className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                {/* Video Thumbnail Placeholder */}
                <button
                  onClick={() => openVideoModal(video)}
                  className="relative w-20 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 hover:bg-muted/70 transition-colors overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40" />
                  <Play size={20} className="text-primary relative z-10" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{video.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {video.file_size ? `${(video.file_size / (1024 * 1024)).toFixed(1)} MB` : 'Vídeo'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openVideoModal(video)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Assistir"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(video)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Baixar"
                  >
                    <Download size={16} />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteAttachment(video)}
                      className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Files Section */}
      {otherFiles.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <FileText size={16} />
            Outros arquivos ({otherFiles.length})
          </h4>
          <div className="space-y-2">
            {otherFiles.map((file) => (
              <div 
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Paperclip size={18} className="text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.file_size ? `${(file.file_size / 1024).toFixed(0)} KB` : 'Arquivo'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(file)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Baixar"
                  >
                    <Download size={16} />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteAttachment(file)}
                      className="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {attachments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Paperclip size={40} className="mx-auto mb-3 opacity-50" />
          <p>Nenhum anexo ainda</p>
          <p className="text-xs mt-1">Clique acima para enviar imagens e vídeos</p>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxOpen && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
          >
            <X size={28} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('prev');
                }}
                className="absolute left-4 p-2 text-white/80 hover:text-white transition-colors z-10"
              >
                <ChevronLeft size={36} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox('next');
                }}
                className="absolute right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}

          <div 
            className="max-w-[90vw] max-h-[90vh] relative" 
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex].file_url}
              alt={images[lightboxIndex].file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 px-4 py-2 rounded-full">
              <span className="text-white/80 text-sm">
                {lightboxIndex + 1} / {images.length}
              </span>
              <button
                onClick={() => handleDownload(images[lightboxIndex])}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
              >
                <Download size={14} />
                Baixar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {videoModalOpen && selectedVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => setVideoModalOpen(false)}
        >
          <button
            onClick={() => setVideoModalOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
          >
            <X size={28} />
          </button>

          <div 
            className="w-full max-w-4xl mx-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={selectedVideo.file_url}
              controls
              autoPlay
              className="w-full max-h-[80vh] rounded-lg bg-black"
            />
            
            <div className="flex items-center justify-between mt-4 px-2">
              <p className="text-white text-sm truncate">{selectedVideo.file_name}</p>
              <button
                onClick={() => handleDownload(selectedVideo)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
              >
                <Download size={16} />
                Baixar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

