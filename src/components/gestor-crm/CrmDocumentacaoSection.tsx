import { useState } from 'react';
import { useCrmDocumentation } from '@/hooks/useCrmKanban';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface DocEntry {
  id: string;
  client_id: string | null;
  clientName: string;
  falou_com_cliente: string | null;
  falou_justificativa: string | null;
  fez_algo_novo: string | null;
  fez_algo_justificativa: string | null;
  fez_algo_descricao: string | null;
  combinado: string | null;
  combinado_descricao: string | null;
  combinado_prazo: string | null;
  combinado_justificativa: string | null;
}

interface GroupedByDate {
  date: string;
  displayDate: string;
  entries: DocEntry[];
}

/**
 * Coluna "Documentação do dia" do Gestor de CRM.
 * Agrupa registros de crm_daily_documentation por data, mostrando
 * todas as respostas de acompanhamento preenchidas pelo gestor ao
 * arrastar clientes entre dias (seg-sex).
 */
export default function CrmDocumentacaoSection() {
  const { data: docs = [], isLoading } = useCrmDocumentation();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    );
  }

  // Agrupa por data
  const docsByDate: Record<string, GroupedByDate> = {};
  docs.forEach((doc: any) => {
    const dateKey = doc.documentation_date;
    const clientName = doc.clients?.razao_social || doc.clients?.name || 'Cliente';

    if (!docsByDate[dateKey]) {
      docsByDate[dateKey] = {
        date: dateKey,
        displayDate: format(parseDateString(dateKey), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        entries: [],
      };
    }

    docsByDate[dateKey].entries.push({
      id: doc.id,
      client_id: doc.client_id,
      clientName,
      falou_com_cliente: doc.falou_com_cliente,
      falou_justificativa: doc.falou_justificativa,
      fez_algo_novo: doc.fez_algo_novo,
      fez_algo_justificativa: doc.fez_algo_justificativa,
      fez_algo_descricao: doc.fez_algo_descricao,
      combinado: doc.combinado,
      combinado_descricao: doc.combinado_descricao,
      combinado_prazo: doc.combinado_prazo,
      combinado_justificativa: doc.combinado_justificativa,
    });
  });

  const dateDocs = Object.values(docsByDate).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (dateDocs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma documentação registrada</p>
        <p className="text-[10px] mt-1 opacity-70">Arraste um cliente entre dias no Acompanhamento</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dateDocs.map(dateGroup => {
        const isExpanded = expandedDate === dateGroup.date;
        const uniqueClients = [...new Set(dateGroup.entries.map(e => e.clientName))];

        return (
          <Card key={dateGroup.date} className="border-subtle">
            <CardContent className="p-0">
              {/* Cabeçalho de data */}
              <button
                className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-xl"
                onClick={() => setExpandedDate(isExpanded ? null : dateGroup.date)}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-sm font-medium">{dateGroup.displayDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {uniqueClients.length} {uniqueClients.length === 1 ? 'cliente' : 'clientes'}
                  </Badge>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {/* Entradas expandidas */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                  {dateGroup.entries.map(entry => (
                    <div key={entry.id} className="p-2.5 bg-muted/30 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{entry.clientName}</span>
                      </div>

                      {/* Falou com cliente */}
                      {entry.falou_com_cliente && (
                        <div className="text-[10px]">
                          <span className="text-muted-foreground">Falou com o cliente: </span>
                          <span className={entry.falou_com_cliente === 'sim' ? 'text-success' : 'text-destructive'}>
                            {entry.falou_com_cliente === 'sim' ? 'Sim' : 'Não'}
                          </span>
                          {entry.falou_justificativa && (
                            <p className="text-muted-foreground mt-0.5 italic">"{entry.falou_justificativa}"</p>
                          )}
                        </div>
                      )}

                      {/* Fez algo novo */}
                      {entry.fez_algo_novo && (
                        <div className="text-[10px]">
                          <span className="text-muted-foreground">Fez algo novo: </span>
                          <span className={entry.fez_algo_novo === 'sim' ? 'text-success' : 'text-destructive'}>
                            {entry.fez_algo_novo === 'sim' ? 'Sim' : 'Não'}
                          </span>
                          {entry.fez_algo_descricao && (
                            <p className="text-foreground mt-0.5">"{entry.fez_algo_descricao}"</p>
                          )}
                          {entry.fez_algo_justificativa && (
                            <p className="text-muted-foreground mt-0.5 italic">"{entry.fez_algo_justificativa}"</p>
                          )}
                        </div>
                      )}

                      {/* Combinado */}
                      {entry.combinado && (
                        <div className="text-[10px]">
                          <span className="text-muted-foreground">Combinado: </span>
                          <span className={entry.combinado === 'sim' ? 'text-success' : 'text-destructive'}>
                            {entry.combinado === 'sim' ? 'Sim' : 'Não'}
                          </span>
                          {entry.combinado_descricao && (
                            <p className="text-foreground mt-0.5">"{entry.combinado_descricao}"</p>
                          )}
                          {entry.combinado_prazo && (
                            <p className="text-muted-foreground mt-0.5">
                              Prazo: {format(parseDateString(entry.combinado_prazo), 'dd/MM/yyyy')}
                            </p>
                          )}
                          {entry.combinado_justificativa && (
                            <p className="text-muted-foreground mt-0.5 italic">"{entry.combinado_justificativa}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
