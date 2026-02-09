import { useState } from 'react';
import { useClientDocumentation, useUpdateDocumentation } from '@/hooks/useAdsManager';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Calendar, Users } from 'lucide-react';
import AdsCardDetailModal from './AdsCardDetailModal';
import AdsCardDescriptionPreview from './AdsCardDescriptionPreview';

// Parse date string (YYYY-MM-DD) without timezone conversion issues
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // Local timezone, no UTC shift
}

interface Props {
  compact?: boolean;
}

interface DocEntry {
  id: string;
  clientId: string | null;
  clientName: string;
  metrics: string | null;
  actions_done: string | null;
  client_budget: string | null;
  created_at: string;
}

interface GroupedByDate {
  date: string;
  displayDate: string;
  entries: DocEntry[];
  previewContent: string;
}

export default function AdsDocumentacaoSection({ compact }: Props) {
  const { data: docs = [], isLoading } = useClientDocumentation();
  const updateDoc = useUpdateDocumentation();
  const [selectedDoc, setSelectedDoc] = useState<GroupedByDate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Group docs by DATE (one card per day with all clients moved that day)
  const docsByDate = docs.reduce((acc, doc) => {
    const dateKey = doc.documentation_date;
    const clientName = (doc as any).clients?.name || 'Cliente';
    
    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: dateKey,
        displayDate: format(parseDateString(dateKey), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        entries: [],
        previewContent: '',
      };
    }
    
    acc[dateKey].entries.push({
      id: doc.id,
      clientId: doc.client_id,
      clientName,
      metrics: doc.metrics,
      actions_done: doc.actions_done,
      client_budget: doc.client_budget,
      created_at: doc.created_at,
    });
    
    return acc;
  }, {} as Record<string, GroupedByDate>);

  // Build preview content for each date card
  Object.values(docsByDate).forEach(dateGroup => {
    const clientNames = dateGroup.entries.map(e => e.clientName);
    const uniqueClients = [...new Set(clientNames)];
    dateGroup.previewContent = `👥 ${uniqueClients.length} cliente${uniqueClients.length > 1 ? 's' : ''}: ${uniqueClients.slice(0, 3).join(', ')}${uniqueClients.length > 3 ? '...' : ''}`;
  });

  // Sort by date (newest first)
  const dateDocs = Object.values(docsByDate).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleDocClick = (doc: GroupedByDate) => {
    setSelectedDoc(doc);
    setIsModalOpen(true);
  };

  const handleSaveDoc = async (data: { description?: string }) => {
    if (selectedDoc && selectedDoc.entries.length > 0 && data.description !== undefined) {
      // Update the first entry (for now, keeping compatibility)
      const firstEntry = selectedDoc.entries[0];
      await updateDoc.mutateAsync({ id: firstEntry.id, actions_done: data.description });
    }
  };

  // Build full description for modal - grouped by client within the date
  const buildFullDescription = (dateDoc: GroupedByDate) => {
    // Group entries by client within this date
    const clientGroups: Record<string, DocEntry[]> = {};
    
    dateDoc.entries.forEach(entry => {
      const key = entry.clientId || 'general';
      if (!clientGroups[key]) {
        clientGroups[key] = [];
      }
      clientGroups[key].push(entry);
    });
    
    return Object.values(clientGroups).map(clientEntries => {
      const clientName = clientEntries[0].clientName;
      const sections = [`## 👤 ${clientName}`];
      
      clientEntries.forEach(entry => {
        const parts: string[] = [];
        if (entry.client_budget) parts.push(`💰 **Verba:** ${entry.client_budget}`);
        if (entry.metrics) parts.push(`📊 **Métricas:** ${entry.metrics}`);
        if (entry.actions_done) parts.push(`\n${entry.actions_done}`);
        if (parts.length > 0) {
          sections.push(parts.join('\n'));
        }
      });
      
      return sections.join('\n\n');
    }).join('\n\n---\n\n');
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const displayDocs = compact ? dateDocs.slice(0, 3) : dateDocs;

  return (
    <>
      <div className="space-y-3">
        {/* Docs List - One card per DATE */}
        <div className="space-y-2">
          {displayDocs.length === 0 ? (
            <div className="empty-state">
              <div className="w-16 h-16 mb-4 rounded-full bg-purple/10 flex items-center justify-center">
                <FileText className="w-7 h-7 text-purple" />
              </div>
              <p className="empty-state-title">Nenhum registro</p>
              <p className="empty-state-text">Mova um cliente no acompanhamento para documentar</p>
            </div>
          ) : (
            displayDocs.map(doc => (
              <div
                key={doc.date}
                onClick={() => handleDocClick(doc)}
                className="kanban-card p-4 group cursor-pointer hover:border-purple/50 transition-colors"
                style={{ borderLeft: '3px solid hsl(258 90% 66%)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-purple/20 flex items-center justify-center">
                    <Calendar size={12} className="text-purple" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {doc.displayDate}
                  </span>
                </div>
                
                <AdsCardDescriptionPreview
                  text={doc.previewContent || 'Sem descrição'}
                  className="mt-0 text-sm text-muted-foreground"
                />
                
                <div className="flex items-center gap-2 mt-2">
                  <Users size={12} className="text-purple" />
                  <p className="text-xs text-purple font-medium">
                    {doc.entries.length} registro{doc.entries.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card Detail Modal - Read Only */}
      <AdsCardDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={selectedDoc ? {
          id: selectedDoc.date,
          title: `📅 ${selectedDoc.displayDate}`,
          description: buildFullDescription(selectedDoc),
          createdAt: selectedDoc.entries[0]?.created_at,
        } : null}
        listName="Documentação"
        readOnly={true}
      />
    </>
  );
}
