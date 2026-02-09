import { useTaskDelayJustificationsByRole, useArchiveTaskDelayJustification, ROLE_LABELS } from '@/hooks/useTaskDelayNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Clock, FileWarning, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
interface Props {
  compact?: boolean;
  /** O cargo cujas justificativas serão exibidas. Default: 'gestor_ads' */
  role?: string;
}
export default function AdsJustificativaSection({
  compact,
  role = 'gestor_ads'
}: Props) {
  const {
    user
  } = useAuth();
  const isCEO = user?.role === 'ceo';

  // Buscar justificativas pelo cargo da página (não pelo usuário logado)
  const {
    data: justificationsByRole,
    isLoading
  } = useTaskDelayJustificationsByRole(role);
  const archiveMutation = useArchiveTaskDelayJustification();
  if (isLoading) {
    return <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>;
  }

  // Dados filtrados por cargo
  const activeJustifications = justificationsByRole?.active || [];
  const archivedJustifications = justificationsByRole?.archived || [];

  // Label do cargo para exibição
  const roleLabel = ROLE_LABELS[role] || role;
  if (compact) {
    const count = activeJustifications.length;
    return <div className="space-y-3">
        <div className={`p-3 rounded-lg text-center ${count > 0 ? 'bg-red-500/20' : 'bg-muted/30'}`}>
          <p className={`font-bold text-2xl ${count > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{count}</p>
          <p className="text-xs text-muted-foreground">Atrasos documentados</p>
        </div>
        {count > 0 && <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
            <AlertTriangle size={12} className="inline mr-1" />
            Atenção aos atrasos!
          </div>}
      </div>;
  }

  // Renderizar um item de justificativa
  const renderJustificationItem = (item: any, showArchiveButton: boolean, isArchived: boolean = false) => {
    const notification = item.notification;
    // Mostrar o nome do dono da tarefa (quem atrasou), não de quem justificou
    const taskOwnerName = notification?.task_owner_name || 'Usuário';
    const justifierName = item.profile?.name || 'Usuário';
    // Se quem justificou for diferente do dono da tarefa, mostrar ambos
    const showBothNames = notification?.task_owner_id !== item.user_id;
    
    return <div key={item.id} className={`p-3 rounded-lg ${isArchived ? 'bg-muted/30 border border-muted/50 opacity-70' : 'bg-red-500/5 border border-red-500/30'}`}>
        <div className="flex items-start gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isArchived ? 'bg-muted/50' : 'bg-red-500/20'}`}>
            <AlertTriangle size={12} className={isArchived ? 'text-muted-foreground' : 'text-red-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`font-medium text-sm ${isArchived ? 'text-muted-foreground' : 'text-red-300'}`}>
                  {notification?.task_title || 'Tarefa'}
                </p>
                {/* Mostrar nome do dono da tarefa (quem teve o atraso) */}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Responsável: {taskOwnerName}
                </p>
                {/* Se outra pessoa justificou, mostrar também */}
                {showBothNames && (
                  <p className="text-xs text-muted-foreground/70">
                    Justificado por: {justifierName}
                  </p>
                )}
              </div>
              
              {/* Botão de arquivar/desarquivar - só para CEO */}
              {showArchiveButton && isCEO && <Button size="sm" variant="ghost" className={`h-7 px-2 ${isArchived ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => archiveMutation.mutate({
              justificationId: item.id,
              archive: !isArchived
            })} disabled={archiveMutation.isPending} title={isArchived ? 'Restaurar' : 'Arquivar'}>
                  {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </Button>}
            </div>
            
            <div className="mt-2 p-2 bg-card/50 rounded border border-border/30">
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {item.justification}
              </p>
            </div>
            
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock size={10} />
              <span>
                {format(new Date(item.created_at), "dd/MM 'às' HH:mm", {
                locale: ptBR
              })}
              </span>
            </div>
          </div>
        </div>
      </div>;
  };

  // Empty state
  if (activeJustifications.length === 0 && archivedJustifications.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/30 flex items-center justify-center">
          <FileWarning className="text-muted-foreground" size={20} />
        </div>
        <p className="font-medium text-sm">Nenhuma justificativa </p>
        <p className="text-xs mt-1">Nenhum atraso documentado por {roleLabel}</p>
      </div>;
  }

  // CEO vê com abas (Ativas / Arquivadas)
  if (isCEO && archivedJustifications.length > 0) {
    return <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-3">
          <TabsTrigger value="active" className="text-xs">
            Ativas ({activeJustifications.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="text-xs">
            Arquivadas ({archivedJustifications.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {activeJustifications.length > 0 && <div className="p-2 bg-red-500/15 border border-red-500/40 rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-medium text-red-400">
                {activeJustifications.length} atraso(s) de {roleLabel}
              </span>
            </div>}
          <div className="space-y-2">
            {activeJustifications.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">Nenhuma justificativa ativa</p> : activeJustifications.map((item: any) => renderJustificationItem(item, true, false))}
          </div>
        </TabsContent>

        <TabsContent value="archived" className="space-y-3">
          <div className="space-y-2">
            {archivedJustifications.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">Nenhuma justificativa arquivada</p> : archivedJustifications.map((item: any) => renderJustificationItem(item, true, true))}
          </div>
        </TabsContent>
      </Tabs>;
  }

  // Lista simples (todos os usuários, CEO sem arquivadas ou não-CEO)
  return <div className="space-y-3">
      {activeJustifications.length > 0 && <div className="p-2 bg-red-500/15 border border-red-500/40 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="text-xs font-medium text-red-400">
            {activeJustifications.length} atraso(s) de {roleLabel}
          </span>
        </div>}
      <div className="space-y-2">
        {activeJustifications.map((item: any) => renderJustificationItem(item, true, false))}
      </div>
    </div>;
}