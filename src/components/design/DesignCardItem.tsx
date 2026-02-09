import { useState } from 'react';
import { Calendar, AlertTriangle, Image as ImageIcon, Video, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { KanbanCard } from '@/hooks/useKanban';
import { CardAttachment } from '@/hooks/useDesignKanban';
import { supabase } from '@/integrations/supabase/client';

interface DesignCardItemProps {
  card: KanbanCard;
  attachments: CardAttachment[];
  isOverdue: boolean;
  hasJustification: boolean;
  onClick: () => void;
  isDragging?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export default function DesignCardItem({
  card,
  attachments,
  isOverdue,
  hasJustification,
  onClick,
  isDragging = false,
}: DesignCardItemProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Separate images and videos
  const images = attachments.filter(a => a.file_type?.startsWith('image/'));
  const videos = attachments.filter(a => a.file_type?.startsWith('video/'));
  const otherFiles = attachments.filter(a => 
    !a.file_type?.startsWith('image/') && !a.file_type?.startsWith('video/')
  );

  // Show max 4 thumbnails
  const displayImages = images.slice(0, 4);
  const remainingImages = images.length - 4;

  const handleImageClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleDownload = async (e: React.MouseEvent, attachment: CardAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    
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
      console.error('Erro ao baixar arquivo:', error);
    }
  };

  const navigateLightbox = (e: React.MouseEvent, direction: 'prev' | 'next') => {
    e.stopPropagation();
    if (direction === 'prev') {
      setLightboxIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    } else {
      setLightboxIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          "bg-background rounded-lg border cursor-pointer",
          "hover:border-primary/50 hover:shadow-sm transition-all",
          isDragging && "rotate-2 scale-105 shadow-lg",
          isOverdue && !hasJustification ? "border-danger" : "border-border"
        )}
      >
        {/* Image Thumbnails Grid - Outside the card padding */}
        {displayImages.length > 0 && (
          <div className="relative">
            <div className={cn(
              "grid gap-0.5 overflow-hidden rounded-t-lg",
              displayImages.length === 1 && "grid-cols-1",
              displayImages.length === 2 && "grid-cols-2",
              displayImages.length === 3 && "grid-cols-3",
              displayImages.length >= 4 && "grid-cols-2"
            )}>
              {displayImages.map((img, index) => (
                <div
                  key={img.id}
                  className={cn(
                    "relative overflow-hidden cursor-pointer group",
                    displayImages.length === 1 && "aspect-video",
                    displayImages.length === 2 && "aspect-square",
                    displayImages.length === 3 && "aspect-square",
                    displayImages.length >= 4 && "aspect-square"
                  )}
                  onClick={(e) => handleImageClick(e, index)}
                >
                  <img
                    src={img.file_url}
                    alt={img.file_name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  
                  {/* Download button overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleDownload(e, img)}
                      className="p-1.5 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
                      title="Baixar imagem"
                    >
                      <Download size={14} className="text-foreground" />
                    </button>
                  </div>

                  {/* Remaining count overlay on last image */}
                  {index === 3 && remainingImages > 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">+{remainingImages}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Video & Other files indicator */}
            {(videos.length > 0 || otherFiles.length > 0) && (
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                {videos.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-black/70 rounded-full text-white text-[10px]">
                    <Video size={10} />
                    <span>{videos.length}</span>
                  </div>
                )}
                {otherFiles.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-black/70 rounded-full text-white text-[10px]">
                    <span>{otherFiles.length} arquivos</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No images but has videos indicator */}
        {images.length === 0 && videos.length > 0 && (
          <div className="p-2 bg-muted/50 rounded-t-lg border-b border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Video size={14} />
              <span>{videos.length} vídeo{videos.length > 1 ? 's' : ''} anexado{videos.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Card Content */}
        <div className="p-3">
          {/* Priority Badge - Destaque */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
              card.priority === 'urgent' 
                ? "bg-danger/20 text-danger border border-danger/30" 
                : "bg-info/20 text-info border border-info/30"
            )}>
              {card.priority === 'urgent' ? '🔥 Urgente' : 'Normal'}
            </span>
          </div>

          {/* Due Date Badge */}
          {card.due_date && (
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-medium mb-1.5",
              isOverdue && !hasJustification 
                ? "text-danger" 
                : isOverdue && hasJustification
                  ? "text-warning"
                  : "text-muted-foreground"
            )}>
              {isOverdue && !hasJustification ? (
                <AlertTriangle size={10} />
              ) : (
                <Calendar size={10} />
              )}
              {format(new Date(card.due_date), "dd/MM/yyyy")}
              {isOverdue && !hasJustification && (
                <span className="ml-1 text-[9px] uppercase">(Atrasado)</span>
              )}
            </div>
          )}
          
          <h4 className="font-medium text-sm text-foreground line-clamp-2">
            {card.title}
          </h4>

          {card.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {card.description}
            </p>
          )}

          {/* Attachment count summary */}
          {attachments.length > 0 && images.length === 0 && videos.length === 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <ImageIcon size={12} />
              <span>{attachments.length} anexo{attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(false);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X size={28} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => navigateLightbox(e, 'prev')}
                className="absolute left-4 p-2 text-white/80 hover:text-white transition-colors"
              >
                <ChevronLeft size={36} />
              </button>
              <button
                onClick={(e) => navigateLightbox(e, 'next')}
                className="absolute right-4 p-2 text-white/80 hover:text-white transition-colors"
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}

          <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightboxIndex]?.file_url}
              alt={images[lightboxIndex]?.file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <span className="text-white/80 text-sm">
                {lightboxIndex + 1} / {images.length}
              </span>
              <button
                onClick={(e) => handleDownload(e, images[lightboxIndex])}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
              >
                <Download size={16} />
                Baixar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
