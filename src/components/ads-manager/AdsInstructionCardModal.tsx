import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BookOpen } from 'lucide-react';

interface InstructionContent {
  title: string;
  sections: {
    heading?: string;
    items: {
      text: string;
    }[];
  }[];
}

// Conteúdo fixo das instruções - texto simples para copiar e colar
const INSTRUCTION_CONTENT: Record<string, InstructionContent> = {
  'm1-2': {
    title: 'PÓS CALL 1, VOCÊ DEVE:',
    sections: [
      {
        items: [
          { text: '1 - Solicitar estruturação DO CRM ao GESTOR DE CRM' },
        ],
      },
      {
        heading: 'Enviar e anexar no grupo:',
        items: [
          { text: '2 - Enviar e anexar no grupo o link do drive para subir fotos e identidade visual: [DRIVE]' },
          { text: '3 - Link do acompanhamento comercial: [Link da Consultoria]' },
        ],
      },
    ],
  },
  'm2-2': {
    title: 'O que enviar junto a estratégia? (Usar a exata ordem):',
    sections: [
      {
        heading: '⚠️ LEMBRE: ANEXE NA DESCRICAO TUDO A BAIXO NO GRUPO DO CLIENTE.',
        items: [
          { text: 'Segue as copys para aprovar.' },
          { text: '[COPY ANÚNCIOS]' },
          { text: '[COPY LP OU SITE INSTITUCIONAL]' },
          { text: 'PDF do Marco' },
          { text: 'Link do mapa mental: [Link]' },
          { text: '[AUDIO Lembrando que ele precisa aprovar o material]' },
        ],
      },
    ],
  },
  'm3-2': {
    title: 'IMPORTANTE – NÃO ESQUECER',
    sections: [
      {
        items: [
          { text: 'Após brifar os criativos, avisar o cliente que os materiais já foram brifados e informar o prazo de entrega previsto (Data X).' },
        ],
      },
    ],
  },
};

interface AdsInstructionCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string | null;
  cardTitle: string;
}

export default function AdsInstructionCardModal({ 
  isOpen, 
  onClose, 
  cardId,
  cardTitle
}: AdsInstructionCardModalProps) {
  if (!cardId) return null;

  const content = INSTRUCTION_CONTENT[cardId];

  if (!content) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <BookOpen className="text-warning" size={20} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{cardTitle}</h2>
            </div>
            <p className="text-muted-foreground">Instruções não disponíveis para este card.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-warning/10 to-primary/10 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
              <BookOpen className="text-warning" size={24} />
            </div>
            <div>
              <span className="text-xs font-medium text-warning uppercase tracking-wider">Instruções</span>
              <h2 className="text-lg font-bold text-foreground">{cardTitle}</h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <h3 className="text-base font-bold text-foreground">{content.title}</h3>
          
          {content.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              {section.heading && (
                <h4 className="text-sm font-semibold text-foreground bg-muted/50 px-3 py-2 rounded-lg">
                  {section.heading}
                </h4>
              )}
              
              <div className="space-y-2 pl-1">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex flex-col gap-1">
                    <p className="text-sm text-foreground select-all cursor-text bg-muted/30 px-3 py-2 rounded-lg border border-subtle">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="p-3 bg-info/10 border border-info/20 rounded-xl">
            <p className="text-xs text-info font-medium">
              📋 Selecione o texto acima para copiar e colar onde precisar.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
