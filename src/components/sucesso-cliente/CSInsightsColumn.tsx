import { useState } from 'react';
import { 
  useCSInsights, 
  useCreateCSInsight, 
  useUpdateCSInsight,
  CSInsight,
  useCSPermissions,
} from '@/hooks/useSucessoCliente';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Lightbulb, 
  Plus, 
  MoreVertical, 
  Play, 
  CheckCircle,
  Archive,
  Flame,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  idea: { label: 'Ideia', color: 'bg-info/10 text-info border-info/20', icon: Lightbulb },
  in_progress: { label: 'Em Andamento', color: 'bg-warning/10 text-warning border-warning/20', icon: Play },
  done: { label: 'Concluído', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
  archived: { label: 'Arquivado', color: 'bg-muted text-muted-foreground', icon: Archive },
};

export default function CSInsightsColumn() {
  const { data: insights = [], isLoading } = useCSInsights();
  const createInsight = useCreateCSInsight();
  const updateInsight = useUpdateCSInsight();
  const { canEdit } = useCSPermissions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal' as 'normal' | 'urgent',
  });

  const resetForm = () => {
    setFormData({ title: '', description: '', priority: 'normal' });
  };

  const handleCreate = () => {
    createInsight.mutate(formData, {
      onSuccess: () => {
        setIsCreateOpen(false);
        resetForm();
      },
    });
  };

  const handleStatusChange = (insight: CSInsight, newStatus: CSInsight['status']) => {
    updateInsight.mutate({ id: insight.id, status: newStatus });
  };

  // Group by status
  const ideas = insights.filter(i => i.status === 'idea');
  const inProgress = insights.filter(i => i.status === 'in_progress');
  const done = insights.filter(i => i.status === 'done');

  const renderInsightCard = (insight: CSInsight) => {
    const config = STATUS_CONFIG[insight.status];
    const StatusIcon = config.icon;

    return (
      <Card 
        key={insight.id} 
        className={cn(
          "bg-card border-subtle",
          insight.priority === 'urgent' && "ring-1 ring-destructive/30"
        )}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {insight.priority === 'urgent' && (
                  <Flame className="h-4 w-4 text-destructive shrink-0" />
                )}
                <h4 className="font-medium text-sm truncate">{insight.title}</h4>
              </div>
              {insight.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {insight.description}
                </p>
              )}
            </div>
            
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {insight.status !== 'in_progress' && (
                    <DropdownMenuItem onClick={() => handleStatusChange(insight, 'in_progress')}>
                      <Play className="h-4 w-4 mr-2 text-warning" />
                      Iniciar
                    </DropdownMenuItem>
                  )}
                  {insight.status !== 'done' && (
                    <DropdownMenuItem onClick={() => handleStatusChange(insight, 'done')}>
                      <CheckCircle className="h-4 w-4 mr-2 text-success" />
                      Concluir
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleStatusChange(insight, 'archived')}>
                    <Archive className="h-4 w-4 mr-2 text-muted-foreground" />
                    Arquivar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={cn("text-xs", config.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(insight.created_at), { locale: ptBR })}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
      {/* Header */}
      <div className="section-header section-header-orange">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Lightbulb size={18} className="text-white" />
            <h2 className="font-semibold text-white">Melhorias & Insights</h2>
          </div>
          {canEdit && (
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-7 bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              Novo
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Carregando...</p>
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">Nenhum insight registrado</p>
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus size={14} className="mr-1" />
                  Criar primeiro insight
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Ideas */}
              {ideas.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Lightbulb className="h-3 w-3" />
                    Ideias ({ideas.length})
                  </h3>
                  <div className="space-y-2">
                    {ideas.map(renderInsightCard)}
                  </div>
                </div>
              )}

              {/* In Progress */}
              {inProgress.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Play className="h-3 w-3" />
                    Em Andamento ({inProgress.length})
                  </h3>
                  <div className="space-y-2">
                    {inProgress.map(renderInsightCard)}
                  </div>
                </div>
              )}

              {/* Done */}
              {done.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    Concluídos ({done.length})
                  </h3>
                  <div className="space-y-2">
                    {done.map(renderInsightCard)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              Novo Insight
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Automatizar follow-up de 7 dias"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva a ideia ou melhoria..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label>Prioridade</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={formData.priority === 'normal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 'normal' }))}
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  variant={formData.priority === 'urgent' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setFormData(prev => ({ ...prev, priority: 'urgent' }))}
                >
                  <Flame className="h-4 w-4 mr-1" />
                  Urgente
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!formData.title || createInsight.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
