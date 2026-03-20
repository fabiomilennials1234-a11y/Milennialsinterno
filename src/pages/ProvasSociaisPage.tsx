import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { useProvasSociais, type ProvaSocial } from '@/hooks/useProvasSociais';
import { useAuth } from '@/contexts/AuthContext';
import ProvaSocialModal from '@/components/provas-sociais/ProvaSocialModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Trophy,
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  TrendingUp,
  Users,
  MessageSquare,
  CalendarCheck,
  DollarSign,
  Target,
  Zap,
  Clock,
  Lightbulb,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value);
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const isVendas = (typeName: string): boolean => {
  return typeName.toLowerCase() === 'vendas';
};

const isFaturamento = (typeName: string): boolean => {
  return typeName.toLowerCase() === 'faturamento';
};

const getMetricConfig = (typeName: string): {
  icon: typeof TrendingUp;
  gradient: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
} => {
  const name = typeName.toLowerCase();
  switch (name) {
    case 'vendas':
      return {
        icon: DollarSign,
        gradient: 'from-emerald-500/20 to-emerald-600/10',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/15',
        borderColor: 'border-emerald-500/30',
      };
    case 'leads':
      return {
        icon: Users,
        gradient: 'from-blue-500/20 to-blue-600/10',
        textColor: 'text-blue-400',
        bgColor: 'bg-blue-500/15',
        borderColor: 'border-blue-500/30',
      };
    case 'mensagens':
      return {
        icon: MessageSquare,
        gradient: 'from-violet-500/20 to-violet-600/10',
        textColor: 'text-violet-400',
        bgColor: 'bg-violet-500/15',
        borderColor: 'border-violet-500/30',
      };
    case 'reuniões':
      return {
        icon: CalendarCheck,
        gradient: 'from-amber-500/20 to-amber-600/10',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-500/15',
        borderColor: 'border-amber-500/30',
      };
    case 'faturamento':
      return {
        icon: TrendingUp,
        gradient: 'from-emerald-500/20 to-emerald-600/10',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/15',
        borderColor: 'border-emerald-500/30',
      };
    case 'oportunidades':
      return {
        icon: Target,
        gradient: 'from-orange-500/20 to-orange-600/10',
        textColor: 'text-orange-400',
        bgColor: 'bg-orange-500/15',
        borderColor: 'border-orange-500/30',
      };
    default:
      return {
        icon: Zap,
        gradient: 'from-pink-500/20 to-pink-600/10',
        textColor: 'text-pink-400',
        bgColor: 'bg-pink-500/15',
        borderColor: 'border-pink-500/30',
      };
  }
};

const ALLOWED_ROLES = ['ceo', 'gestor_projetos', 'sucesso_cliente', 'consultor_comercial', 'financeiro'];

export default function ProvasSociaisPage() {
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<ProvaSocial | null>(null);
  const [detailData, setDetailData] = useState<ProvaSocial | null>(null);

  const { provas, isLoading, archiveProvaSocial, deleteProvaSocial } = useProvasSociais(showArchived);

  const hasAccess = user?.role && ALLOWED_ROLES.includes(user.role);

  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Sem permissão para acessar esta página.</p>
        </div>
      </MainLayout>
    );
  }

  const handleEdit = (prova: ProvaSocial) => {
    setEditData(prova);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditData(null);
    setModalOpen(true);
  };

  const handleArchive = (id: string) => {
    archiveProvaSocial.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta prova social?')) {
      deleteProvaSocial.mutate(id);
    }
  };

  const handleCardClick = (prova: ProvaSocial) => {
    setDetailData(prova);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Trophy size={24} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Provas Sociais</h1>
              <p className="text-sm text-muted-foreground">Cases de sucesso para uso comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <EyeOff size={16} className="mr-1.5" /> : <Eye size={16} className="mr-1.5" />}
              {showArchived ? 'Ocultar Arquivados' : 'Ver Arquivados'}
            </Button>
            <Button onClick={handleCreate}>
              <Plus size={16} className="mr-1.5" />
              Registrar Prova Social
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : provas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Trophy size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhuma prova social encontrada</p>
            <p className="text-sm mt-1">Registre seu primeiro case de sucesso</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {provas.map((prova) => (
              <div
                key={prova.id}
                className={cn(
                  'rounded-2xl border border-border bg-card p-6 space-y-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group',
                  prova.archived && 'opacity-60'
                )}
                onClick={() => handleCardClick(prova)}
              >
                {/* Card Header - Logo + Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {prova.client_logo_url ? (
                      <img
                        src={prova.client_logo_url}
                        alt={prova.client_name}
                        className="w-16 h-16 rounded-xl object-contain border-2 border-border shadow-sm bg-white p-1"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl shadow-sm">
                        {prova.client_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-foreground text-lg leading-tight">
                        {prova.client_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock size={13} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {prova.project_duration}
                        </p>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(prova); }}>
                        <Pencil size={14} className="mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {!prova.archived && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(prova.id); }}>
                          <Archive size={14} className="mr-2" />
                          Arquivar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleDelete(prova.id); }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Metrics - Gamified Blocks */}
                {prova.metrics.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {prova.metrics.map((m) => {
                      const config = getMetricConfig(m.type_name);
                      const Icon = config.icon;
                      const showCurrency = isVendas(m.type_name) || isFaturamento(m.type_name);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'rounded-xl border p-3.5 bg-gradient-to-br transition-transform hover:scale-[1.02]',
                            config.gradient,
                            config.borderColor
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={cn('p-1 rounded-md', config.bgColor)}>
                              <Icon size={13} className={config.textColor} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {m.type_name}
                            </span>
                          </div>
                          <p className={cn('text-xl font-bold tracking-tight', config.textColor)}>
                            {showCurrency ? formatCurrency(m.value) : formatNumber(m.value)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Strategy hint */}
                {prova.strategy_description && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Lightbulb size={12} className="text-primary/60 flex-shrink-0" />
                    <span className="truncate">Clique para ver a estratégia utilizada</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      <ProvaSocialModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditData(null);
        }}
        editData={editData}
      />

      {/* Modal de Detalhe */}
      <Dialog open={!!detailData} onOpenChange={(open) => { if (!open) setDetailData(null); }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          {detailData && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  {detailData.client_logo_url ? (
                    <img
                      src={detailData.client_logo_url}
                      alt={detailData.client_name}
                      className="w-20 h-20 rounded-xl object-contain border-2 border-border shadow-sm bg-white p-1"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-3xl shadow-sm">
                      {detailData.client_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <DialogTitle className="text-foreground text-xl">
                      {detailData.client_name}
                    </DialogTitle>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{detailData.project_duration}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Metrics Detail */}
              {detailData.metrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {detailData.metrics.map((m) => {
                    const config = getMetricConfig(m.type_name);
                    const Icon = config.icon;
                    const showCurrency = isVendas(m.type_name) || isFaturamento(m.type_name);
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'rounded-xl border p-4 bg-gradient-to-br',
                          config.gradient,
                          config.borderColor
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
                            <Icon size={15} className={config.textColor} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {m.type_name}
                          </span>
                        </div>
                        <p className={cn('text-2xl font-bold tracking-tight', config.textColor)}>
                          {showCurrency ? formatCurrency(m.value) : formatNumber(m.value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Strategy Description */}
              {detailData.strategy_description && (
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={18} className="text-primary" />
                    <h4 className="font-semibold text-foreground">Como foi feito?</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {detailData.strategy_description}
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
