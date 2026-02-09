import React, { useState, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  Plus, 
  ChevronDown,
  ChevronRight,
  Calendar,
  Users,
  TrendingUp,
  Award,
  UserPlus,
  LogOut,
  Cake,
  PartyPopper,
  GraduationCap,
  Heart,
  Briefcase,
  Star,
  User,
  Clock,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  JORNADA_STATUSES,
  useTeamMembers,
  useUpcomingDates,
  useJornadaDashboardStats,
  getJornadaStatusLabel,
} from '@/hooks/useRHJornadaEquipe';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Icon mapping for statuses
const STATUS_ICONS: Record<string, React.ElementType> = {
  onboarding: UserPlus,
  integracao: Users,
  desenvolvimento: TrendingUp,
  promocao: Award,
  datas_comemorativas: Calendar,
  desligamento: LogOut,
};

// Event type icons
const EVENT_ICONS: Record<string, React.ElementType> = {
  birthday: Cake,
  work_anniversary: PartyPopper,
  promotion: Award,
  training: GraduationCap,
  recognition: Star,
  salary_increase: TrendingUp,
};

// Check permissions
function useJornadaPermissions() {
  const { user } = useAuth();
  const role = user?.role;
  
  return {
    canCreate: role === 'ceo' || role === 'gestor_projetos',
    canMove: role === 'ceo' || role === 'gestor_projetos',
    canEdit: role === 'ceo',
    isViewOnly: role !== 'ceo' && role !== 'gestor_projetos',
  };
}

// Team member card component
interface TeamMemberCardProps {
  member: {
    id: string;
    name: string;
    role: string;
    hire_date?: string;
    status: string;
  };
  index: number;
}

function TeamMemberCard({ member, index }: TeamMemberCardProps) {
  const tenureText = useMemo(() => {
    if (!member.hire_date) return 'Data não informada';
    
    const hireDate = new Date(member.hire_date);
    const years = differenceInYears(new Date(), hireDate);
    const months = differenceInMonths(new Date(), hireDate) % 12;
    
    if (years > 0) {
      return `${years} ano${years > 1 ? 's' : ''} ${months > 0 ? `e ${months} meses` : ''}`;
    }
    return `${months} mês${months > 1 ? 'es' : ''}`;
  }, [member.hire_date]);
  
  return (
    <Draggable draggableId={member.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-card border rounded-xl p-3 cursor-pointer transition-all",
            "hover:shadow-md hover:border-primary/30",
            snapshot.isDragging && "shadow-lg rotate-2 scale-105"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{member.name}</h4>
              <p className="text-xs text-muted-foreground truncate">{member.role}</p>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{tenureText}</span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {member.status === 'active' ? 'Ativo' : member.status}
            </Badge>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// Column component
interface ColumnProps {
  status: typeof JORNADA_STATUSES[number];
  items: any[];
  renderCard: (item: any, index: number) => React.ReactNode;
  canAddCard?: boolean;
  onAddCard?: () => void;
}

function Column({ status, items, renderCard, canAddCard, onAddCard }: ColumnProps) {
  const [isOpen, setIsOpen] = useState(true);
  const IconComponent = STATUS_ICONS[status.id] || Users;

  return (
    <div className="flex-shrink-0 w-80 bg-muted/30 rounded-xl border border-border/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div 
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl"
            style={{ borderLeft: `4px solid ${status.color}` }}
          >
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <IconComponent className="w-4 h-4" style={{ color: status.color }} />
              <h3 className="font-semibold text-sm">{status.label}</h3>
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </div>
            {canAddCard && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); onAddCard?.(); }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <Droppable droppableId={status.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "p-2 min-h-[100px] space-y-2 transition-colors",
                  snapshot.isDraggingOver && "bg-primary/5"
                )}
              >
                {items.map((item, index) => renderCard(item, index))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Upcoming date card
interface UpcomingDateCardProps {
  date: {
    id: string;
    title: string;
    date_type: string;
    event_date: string;
  };
  index: number;
}

function UpcomingDateCard({ date, index }: UpcomingDateCardProps) {
  const IconComponent = EVENT_ICONS[date.date_type] || Calendar;
  
  return (
    <Draggable draggableId={date.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 rounded-xl p-3 transition-all",
            "hover:shadow-md hover:border-warning/40",
            snapshot.isDragging && "shadow-lg rotate-2 scale-105"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
              <IconComponent className="w-4 h-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{date.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(date.event_date), "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// Main Kanban component
export default function RHJornadaEquipeKanban() {
  const permissions = useJornadaPermissions();
  const { data: members = [], isLoading } = useTeamMembers();
  const upcomingDates = useUpcomingDates();
  const stats = useJornadaDashboardStats();

  // Organize members by status (simplified - all active members in desenvolvimento)
  const membersByStatus = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    JORNADA_STATUSES.forEach(status => {
      grouped[status.id] = [];
    });
    
    // Put active members in desenvolvimento by default
    members.forEach(member => {
      if (member.status === 'onboarding') {
        grouped['onboarding'].push(member);
      } else {
        grouped['desenvolvimento'].push(member);
      }
    });
    
    // Add upcoming dates to datas_comemorativas
    grouped['datas_comemorativas'] = upcomingDates;
    
    return grouped;
  }, [members, upcomingDates]);

  const handleDragEnd = async (result: DropResult) => {
    // Handle drag and drop - future implementation
    console.log('Drag result:', result);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Stats */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Jornada da Equipe</h1>
            <p className="text-sm text-muted-foreground">Gestão do ciclo de vida dos colaboradores</p>
          </div>
          {permissions.canCreate && (
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Evento
            </Button>
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                  <p className="text-xs text-muted-foreground">Total Equipe</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-success" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeMembers}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-info" />
                <div>
                  <p className="text-2xl font-bold">{stats.onboardingMembers}</p>
                  <p className="text-xs text-muted-foreground">Em Onboarding</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-2xl font-bold">{stats.upcomingEvents}</p>
                  <p className="text-xs text-muted-foreground">Eventos Próximos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-secondary/50 to-secondary/30 border-secondary">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-secondary-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.averageTenure}</p>
                  <p className="text-xs text-muted-foreground">Média Meses</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kanban Board */}
      <ScrollArea className="flex-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="p-4 flex gap-4 min-w-max">
            {JORNADA_STATUSES.map(status => (
              <Column
                key={status.id}
                status={status}
                items={membersByStatus[status.id] || []}
                renderCard={(item, index) => {
                  if (status.id === 'datas_comemorativas') {
                    return <UpcomingDateCard key={item.id} date={item} index={index} />;
                  }
                  return <TeamMemberCard key={item.id} member={item} index={index} />;
                }}
                canAddCard={permissions.canCreate && status.id !== 'datas_comemorativas'}
              />
            ))}
          </div>
        </DragDropContext>
      </ScrollArea>

      {/* Future improvements notice */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <span className="font-medium text-foreground">Melhorias Futuras:</span>
            {' '}Plano de carreira detalhado, feedback 360°, PDI (Plano de Desenvolvimento Individual), 
            gestão de benefícios, pesquisa de clima, 1:1 tracking, metas e OKRs pessoais.
          </div>
        </div>
      </div>
    </div>
  );
}
