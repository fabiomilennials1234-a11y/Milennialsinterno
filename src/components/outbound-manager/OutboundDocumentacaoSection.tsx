import { useState } from 'react';
import { useOutboundClientDocumentation, useOutboundCreateDocumentation } from '@/hooks/useOutboundManager';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Calendar, Plus, MessageSquare, Lightbulb, ClipboardList, ChevronDown, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface Props {
  compact?: boolean;
}

export default function OutboundDocumentacaoSection({ compact }: Props) {
  const { data: docs = [], isLoading } = useOutboundClientDocumentation();
  const createDoc = useOutboundCreateDocumentation();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [showOlder, setShowOlder] = useState(false);

  const MAX_VISIBLE = 7;

  // Create form
  const [docDate, setDocDate] = useState('');
  const [comoFoiDia, setComoFoiDia] = useState('');
  const [oqueFezHoje, setOqueFezHoje] = useState('');
  const [oquemelhorar, setOqueMelhorar] = useState('');

  const handleOpenCreate = () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    setDocDate(today);
    setComoFoiDia('');
    setOqueFezHoje('');
    setOqueMelhorar('');
    setIsCreateModalOpen(true);
  };

  const handleCreate = async () => {
    if (!docDate) return;

    await createDoc.mutateAsync({
      metrics: comoFoiDia,
      actions_done: oqueFezHoje,
      client_budget: oquemelhorar,
    });

    setIsCreateModalOpen(false);
  };

  // Group docs by date
  const docsByDate = docs.reduce((acc, doc) => {
    const dateKey = doc.documentation_date;
    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: dateKey,
        displayDate: format(parseDateString(dateKey), "dd 'de' MMMM", { locale: ptBR }),
        entries: [],
      };
    }
    acc[dateKey].entries.push(doc);
    return acc;
  }, {} as Record<string, { date: string; displayDate: string; entries: any[] }>);

  const dateDocs = Object.values(docsByDate).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const recentDocs = dateDocs.slice(0, MAX_VISIBLE);
  const olderDocs = dateDocs.slice(MAX_VISIBLE);
  const hasOlder = olderDocs.length > 0;
  const displayDocs = compact ? dateDocs.slice(0, 3) : (showOlder ? dateDocs : recentDocs);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {displayDocs.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 mb-4 rounded-full bg-purple/10 flex items-center justify-center">
              <FileText className="w-7 h-7 text-purple" />
            </div>
            <p className="empty-state-title">Nenhum registro</p>
            <p className="empty-state-text">Registre como foi seu dia</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayDocs.map(dateGroup => {
              const entry = dateGroup.entries[0];
              const preview = entry?.metrics || entry?.actions_done || 'Sem descrição';

              return (
                <div
                  key={dateGroup.date}
                  onClick={() => {
                    setSelectedDoc(dateGroup);
                    setIsViewModalOpen(true);
                  }}
                  className="kanban-card p-4 group cursor-pointer hover:border-purple/50 transition-colors"
                  style={{ borderLeft: '3px solid hsl(258 90% 66%)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-purple/20 flex items-center justify-center">
                      <Calendar size={12} className="text-purple" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {dateGroup.displayDate}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>

                  {dateGroup.entries.length > 1 && (
                    <p className="text-[10px] text-purple font-medium mt-2">
                      {dateGroup.entries.length} registros neste dia
                    </p>
                  )}
                </div>
              );
            })}

            {/* Toggle older records */}
            {!compact && hasOlder && (
              <button
                onClick={() => setShowOlder(v => !v)}
                className="w-full p-2.5 text-xs text-muted-foreground hover:text-purple-400 hover:bg-purple-500/5 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Archive size={12} />
                {showOlder
                  ? 'Ocultar registros antigos'
                  : `Ver registros anteriores (${olderDocs.length})`
                }
                <ChevronDown size={12} className={cn('transition-transform', showOlder && 'rotate-180')} />
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleOpenCreate}
          className="w-full p-3 text-sm text-muted-foreground hover:text-purple hover:bg-purple/10 rounded-xl flex items-center gap-2 transition-colors border-2 border-dashed border-transparent hover:border-purple/30"
        >
          <Plus size={14} />
          <span>Registrar dia</span>
        </button>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => !open && setIsCreateModalOpen(false)}>
        <DialogContent className="max-w-md p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FileText className="text-purple-400" size={24} />
              </div>
              <div>
                <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                  Diário
                </span>
                <h2 className="text-lg font-bold text-foreground">Registro do Dia</h2>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar size={14} className="text-muted-foreground" />
                Data
              </label>
              <Input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="input-apple text-sm"
              />
            </div>

            {/* Question 1 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquare size={14} className="text-muted-foreground" />
                Como foi seu dia?
              </label>
              <Textarea
                value={comoFoiDia}
                onChange={(e) => setComoFoiDia(e.target.value)}
                placeholder="Descreva como foi o dia de trabalho..."
                className="input-apple text-sm min-h-[80px] resize-none"
              />
            </div>

            {/* Question 2 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList size={14} className="text-muted-foreground" />
                O que você fez hoje?
              </label>
              <Textarea
                value={oqueFezHoje}
                onChange={(e) => setOqueFezHoje(e.target.value)}
                placeholder="Liste as atividades realizadas..."
                className="input-apple text-sm min-h-[80px] resize-none"
              />
            </div>

            {/* Question 3 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lightbulb size={14} className="text-muted-foreground" />
                O que você acha que consegue melhorar?
              </label>
              <Textarea
                value={oquemelhorar}
                onChange={(e) => setOqueMelhorar(e.target.value)}
                placeholder="Pontos de melhoria para os próximos dias..."
                className="input-apple text-sm min-h-[80px] resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="text-sm">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!docDate || createDoc.isPending}
              className="btn-cta gap-2"
            >
              <Plus size={14} />
              {createDoc.isPending ? 'Salvando...' : 'Salvar Registro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={(open) => !open && setIsViewModalOpen(false)}>
        <DialogContent className="max-w-md p-0 gap-0 bg-card border-subtle overflow-hidden shadow-apple-lg">
          <div className="p-6 bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-b border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FileText className="text-purple-400" size={24} />
              </div>
              <div>
                <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                  Registro
                </span>
                <h2 className="text-lg font-bold text-foreground">
                  {selectedDoc?.displayDate}
                </h2>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {selectedDoc?.entries.map((entry: any, i: number) => (
              <div key={entry.id} className="space-y-3">
                {i > 0 && <hr className="border-subtle" />}

                {entry.metrics && (
                  <div>
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">
                      Como foi o dia
                    </p>
                    <p className="text-sm text-foreground bg-muted/30 px-3 py-2 rounded-lg whitespace-pre-wrap">
                      {entry.metrics}
                    </p>
                  </div>
                )}

                {entry.actions_done && (
                  <div>
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">
                      O que fez
                    </p>
                    <p className="text-sm text-foreground bg-muted/30 px-3 py-2 rounded-lg whitespace-pre-wrap">
                      {entry.actions_done}
                    </p>
                  </div>
                )}

                {entry.client_budget && (
                  <div>
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">
                      O que melhorar
                    </p>
                    <p className="text-sm text-foreground bg-muted/30 px-3 py-2 rounded-lg whitespace-pre-wrap">
                      {entry.client_budget}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {(!selectedDoc?.entries || selectedDoc.entries.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro neste dia.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
