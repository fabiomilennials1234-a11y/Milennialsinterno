import { useRef, useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { UserPlus, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import DepartmentTarefasSection from '@/components/department/DepartmentTarefasSection';

const COLUMNS = [
  { id: 'novo-cliente', title: 'Novos Clientes', icon: UserPlus, headerClass: 'section-header-green', iconColor: 'text-white' },
  { id: 'tarefas-diarias', title: 'Tarefas Diárias', icon: CheckSquare, headerClass: 'section-header-yellow', iconColor: 'text-foreground' },
];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function MktplaceNovoClienteSection() {
  const { user, isCEO, isAdminUser } = useAuth();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['mktplace-new-clients', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, monthly_value, mktplace_status, mktplace_entered_at, assigned_mktplace')
        .eq('mktplace_status', 'novo')
        .eq('archived', false)
        .not('assigned_mktplace', 'is', null)
        .order('mktplace_entered_at', { ascending: true });

      // Non-CEO users only see their assigned clients
      if (!isCEO && !isAdminUser) {
        query = query.eq('assigned_mktplace', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserPlus size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum cliente novo</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map(client => {
        const name = client.razao_social || client.name || 'Cliente';
        const products = (client.contracted_products as string[]) || [];
        const hasGestorMktplace = products.includes('gestor-mktplace');
        const label = hasGestorMktplace ? 'Gestão de MKT PLACE' : 'Consultoria de MKT PLACE';
        const labelColor = hasGestorMktplace
          ? 'bg-purple-500/10 text-purple-500 border-purple-500/30'
          : 'bg-blue-500/10 text-blue-500 border-blue-500/30';

        return (
          <Card key={client.id} className="border-subtle hover:shadow-apple-hover transition-shadow">
            <CardContent className="p-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm text-foreground line-clamp-2">{name}</h4>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${labelColor}`}>
                    {label}
                  </Badge>
                </div>
                {client.monthly_value && (
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(Number(client.monthly_value))}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function ConsultorMKTPlacePage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollButtons);
      checkScrollButtons();
      return () => container.removeEventListener('scroll', checkScrollButtons);
    }
  }, []);

  const allowedRoles = ['consultor_mktplace', 'consultor_comercial', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const renderColumnContent = (columnId: string) => {
    switch (columnId) {
      case 'novo-cliente':
        return <MktplaceNovoClienteSection />;
      case 'tarefas-diarias':
        return <DepartmentTarefasSection department="consultor_mktplace" type="daily" />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <div className="px-8 py-6 border-b border-subtle shrink-0">
          <h1 className="text-display text-foreground">Consultor(a) de MKT Place</h1>
          <p className="text-caption text-muted-foreground mt-1">Gestão de consultoria e acompanhamento de MKT Place</p>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {canScrollLeft && (
            <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => {
              scrollContainerRef.current?.scrollBy({ left: -380, behavior: 'smooth' });
            }}>
              <ChevronLeft size={18} className="text-muted-foreground" />
            </Button>
          )}
          {canScrollRight && (
            <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-apple-hover border border-subtle hover:bg-muted" onClick={() => {
              scrollContainerRef.current?.scrollBy({ left: 380, behavior: 'smooth' });
            }}>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Button>
          )}

          <div ref={scrollContainerRef} className="h-full overflow-x-auto overflow-y-hidden px-8 py-6 scrollbar-apple">
            <div className="flex gap-6 h-full pb-4" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map(column => {
                const Icon = column.icon;
                return (
                  <div key={column.id} className="w-[340px] h-full flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
                    <div className={`section-header ${column.headerClass}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={column.iconColor} />
                        <h2 className="font-semibold">{column.title}</h2>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-apple bg-card">
                      {renderColumnContent(column.id)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
