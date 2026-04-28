import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GraduationCap, ExternalLink } from 'lucide-react';

interface ToolCard {
  id: string;
  title: string;
  description: string;
  links: { label: string; url: string }[];
}

const TOOLS: ToolCard[] = [
  {
    id: 'cursos_torque',
    title: 'Acessar Cursos Torque',
    description: 'Material de treinamento completo do Torque para gestores de CRM e clientes.',
    links: [
      {
        label: 'Curso [Torque] Gestor de CRM',
        url: 'https://drive.google.com/drive/folders/1q-QCOVMp_5KHTU7fDl8NcaUyZVn0LV4s?usp=sharing',
      },
      {
        label: 'Curso [Torque] Cliente',
        url: 'https://drive.google.com/drive/folders/16MwAKqqSqQ-PLfgW1bqd5YftXEuoUeZg?usp=sharing',
      },
    ],
  },
];

export default function CrmFerramentasProSection() {
  const [openTool, setOpenTool] = useState<ToolCard | null>(null);

  return (
    <>
      <div className="space-y-2">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setOpenTool(tool)}
            className="w-full text-left p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 hover:border-violet-500/40 transition-colors flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-md bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
              <GraduationCap size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{tool.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{tool.description}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!openTool} onOpenChange={(open) => { if (!open) setOpenTool(null); }}>
        <DialogContent className="max-w-md">
          {openTool && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap size={18} className="text-violet-400" />
                  {openTool.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">{openTool.description}</p>
                <div className="space-y-2">
                  {openTool.links.map(link => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:border-violet-500/40 hover:bg-muted/30 transition-colors group"
                    >
                      <span className="text-sm font-medium text-foreground">{link.label}</span>
                      <ExternalLink size={14} className="text-muted-foreground group-hover:text-violet-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
