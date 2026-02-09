import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ProToolContentViewProps {
  content: string;
}

// Regex to detect URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

async function copyToClipboard(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export default function ProToolContentView({ content }: ProToolContentViewProps) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sem conteúdo disponível
      </p>
    );
  }

  // Split content by URLs and render them as clickable links
  const parts = content.split(URL_REGEX);
  
  return (
    <div className="space-y-4">
      {parts.map((part, index) => {
        const isUrl = /^https?:\/\//.test(part);
        if (isUrl) {
          
          return (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const isInIframe = window.self !== window.top;

                // In preview, the app runs inside a sandboxed iframe.
                // New tabs opened from a sandboxed frame can inherit restrictions and some sites (ex: Google Drive)
                // may show ERR_BLOCKED_BY_RESPONSE. In this case, we prefer copying the link.
                void copyToClipboard(part).then((copied) => {
                  toast(
                    copied
                      ? (isInIframe
                          ? 'Link copiado. No preview pode bloquear; cole no navegador.'
                          : 'Link copiado.')
                      : 'Copie e cole o link no navegador.',
                  );
                });

                if (!isInIframe) {
                  window.open(part, '_blank');
                }
              }}
              className="group flex items-center gap-3 p-4 w-full text-left bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 border border-primary/20 hover:border-primary/40 rounded-xl transition-all duration-200 cursor-pointer"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 group-hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors">
                <ExternalLink size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Acessar Link
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {part.length > 60 ? `${part.substring(0, 60)}...` : part}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Copy size={14} className="text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
              </div>
            </button>
          );
        }
        
        // Regular text - preserve line breaks
        if (part.trim()) {
          return (
            <p key={index} className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
              {part}
            </p>
          );
        }
        
        return null;
      })}
    </div>
  );
}
