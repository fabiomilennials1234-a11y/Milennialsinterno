// Componente único que substitui 5 boards especializados duplicados.
// Recebe config descrevendo o que muda por domínio e renderiza tudo.
// Ver docs/operations/plan-consolidate-specialized-boards.md.

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Plus, User, ChevronDown, ChevronRight, MoreHorizontal,
  Archive, Trash2, Calendar, AlertTriangle, FileText, UserCircle, Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CardDetailModal from '@/components/kanban/CardDetailModal';
import { KanbanCard } from '@/hooks/useKanban';
import type { BaseCardInput, CardAttachmentInput } from '@/types/kanbanInput';
import type { UserRole } from '@/types/auth';
import { useKanbanActionPermissions } from '@/hooks/useKanbanActionPermissions';
import {
  archiveKanbanCard,
  createKanbanCard,
  deleteKanbanCard,
  moveKanbanCard,
} from '@/lib/kanbanCardOperations';
import { upsertKanbanBriefing, type KanbanBriefingType } from '@/lib/kanbanBriefingOperations';
import { createKanbanCardAttachment } from '@/lib/kanbanAttachmentOperations';

// ---------- Types ----------

export interface BoardPerson {
  user_id: string;
  name: string;
}

export interface BoardStatus {
  id: string;
  label: string;
  color: string; // ex: 'bg-blue-500' — classe Tailwind
}

export interface BoardColumn {
  id: string;
  title: string;
  position: number;
  board_id: string;
  color: string | null;
}

export interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  // O payload é específico por board mas todos estendem BaseCardInput.
  // Cada board passa seu modal; a assinatura aqui fica generic.
  onSubmit: (data: BaseCardInput & Record<string, unknown>, attachments?: CardAttachmentInput[]) => void;
  isLoading: boolean;
  // Nome padrão do prop de colunas varia (devColumns, editorColumns, etc).
  // Deixamos o componente-pai passar via spread no render.
  [key: string]: unknown;
}

export interface DelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  delayedCards: unknown[];
}

export type CardCreatorsMap = Record<string, { user_id: string; name: string } | undefined>;

export interface SpecializedBoardConfig {
  // Identidade
  boardSlugLike: string;                 // padrão `ilike` para achar o board (ex: '%dev%' ou slug direto)
  boardQueryKeyPrefix: string;           // ex: 'dev' — usado nas query keys
  cardType: string;                      // valor do kanban_cards.card_type
  fallbackStatus: string;                // status usado quando card não tem ou é inválido

  // Pessoas que geram colunas "BY X"
  personsRole: UserRole;                 // role que filtra usuários (ex: 'devs', 'designer')
  personsEmptyMessage: string;           // msg quando não há pessoas cadastradas

  // Statuses dentro de cada coluna
  statuses: readonly BoardStatus[];

  // Visual
  columnDotClass: string;                // ex: 'bg-info', 'bg-primary', 'bg-purple-500'

  // Card creators (todos têm variante própria — todas com mesma API)
  useCardCreators: (cardIds: string[]) => { data: CardCreatorsMap };

  // Atraso + justificativa (opcional; Atrizes não tem)
  delay?: {
    useDelayedCards: () => { data: unknown[] };
    useJustifications: (personName: string) => { data: Array<{ id: string; created_at: string; justification: string }> };
    DelayModal: React.ComponentType<DelayModalProps>;
    // Role que deve ver o modal ao abrir o board
    showModalForRole: UserRole;
  };

  // Notificação especial ao mover card (opcional).
  // Cobre Devs/Design/Video/Produtora — assinatura padrão.
  afterMoveNotification?: {
    targetStatus: string;                // ex: 'aguardando_aprovacao'
    useCreateNotification: () => {
      mutate: (args: {
        cardId: string;
        cardTitle: string;
        requesterId: string;
        requesterName: string;
      }) => void;
    };
  };

  // Escape hatch para side-effects custom no move — usado por Atrizes,
  // que precisa buscar o nome do usuário atual antes de disparar a
  // notificação com payload estendido. Roda em adição ao update de posição.
  useCustomAfterMove?: () => (ctx: {
    card: KanbanCard;
    sourceStatus: string;
    destStatus: string;
    creator: { user_id: string; name: string } | undefined;
  }) => Promise<void>;

  // Modal de criação (componente do próprio board)
  CreateCardModal: React.ComponentType<CreateCardModalProps>;
  createModalColumnPropName: string;     // 'devColumns' | 'editorColumns' | ...
  createSuccessMessage: string;

  // Prop a passar no CardDetailModal para ativar flags específicos
  cardDetailFlags: Partial<{
    isDesignBoard: boolean;
    isVideoBoard: boolean;
    isProdutoraBoard: boolean;
    isDevBoard: boolean;
    isAtrizesBoard: boolean;
  }>;

  // Briefing (opcional). Para Devs é null; para Atrizes usa tabela não-tipada.
  briefing?: {
    tableName: string;                   // ex: 'design_briefings', 'atrizes_briefings'
    briefingType: KanbanBriefingType;    // valor aceito pela RPC upsert_kanban_briefing
    fields: string[];                    // nomes de colunas a serem gravadas
    untyped?: boolean;                   // se true, usa `as never` (atrizes_briefings)
  };

  // Attachments (opcional; só Devs)
  attachments?: {
    storageBucket: string;               // ex: 'card-attachments'
    attachmentsTable: string;            // ex: 'card_attachments'
    alsoCreateBriefing?: {               // Devs grava materials_url num briefing separado
      tableName: string;
      fieldFromPayload: string;          // ex: 'materials_url'
    };
  };

  // Callbacks opcionais para transformar o payload antes do insert
  mapPriority?: (priority: BaseCardInput['priority']) => string;

  // Labels customizáveis
  labels?: {
    noBoardMessage?: string;
  };
}

// ---------- Utils ----------

function sanitizeFileName(name: string): string {
  const noDiacritics = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = noDiacritics
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  return safe.length > 0 ? safe : 'file';
}

function isCardOverdue(card: KanbanCard): boolean {
  if (!card.due_date) return false;
  const dueDate = new Date(card.due_date);
  return isPast(dueDate) && !isToday(dueDate);
}

function getPersonNameFromJustificationColumn(title: string): string | null {
  const match = title.match(/JUSTIFICATIVA\s*\(([^)]+)\)/);
  return match ? match[1] : null;
}

// ---------- Main ----------

export default function SpecializedKanbanBoard({ config }: { config: SpecializedBoardConfig }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  // -------- Hooks opcionais --------
  // Sempre precisamos chamar Hooks na mesma ordem. Usamos passthrough controlado:
  // para delay, se config.delay não existe, usamos um stub que retorna vazio.
  const delayedCards = config.delay
    ? (config.delay.useDelayedCards().data ?? [])
    : [];
  const createNotificationMutation = config.afterMoveNotification
    ? config.afterMoveNotification.useCreateNotification()
    : null;

  const customAfterMove = config.useCustomAfterMove ? config.useCustomAfterMove() : null;

  // Abre modal de atraso automaticamente para role configurada.
  useEffect(() => {
    if (!config.delay) return;
    if (delayedCards.length > 0 && user?.role === config.delay.showModalForRole) {
      setIsDelayModalOpen(true);
    }
  }, [delayedCards.length, user?.role, config.delay]);

  // -------- Board --------
  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: [`${config.boardQueryKeyPrefix}-board`],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .ilike('slug', config.boardSlugLike)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const actionPermissions = useKanbanActionPermissions(board?.id);
  const canCreate = actionPermissions.permissions.canCreate;
  const canMove = actionPermissions.permissions.canMove;
  const canArchive = actionPermissions.permissions.canArchive || actionPermissions.permissions.canDelete;

  // -------- Pessoas --------
  // Usa RPC `list_users_by_role_for_page` em vez de SELECT direto em
  // `user_roles` — a RPC valida `can_access_page_data(_role, _page_slug)`
  // no DB, então um user com page_grant (ex: Maycon -> 'design') consegue
  // listar designers sem precisar de policy aberta em user_roles.
  // page_slug é derivado da role do board (devs -> 'devs', designer -> 'design',
  // editor -> 'editor-video'). Erro 42501 (sem grant) cai num fallback vazio.
  const personsPageSlug = useMemo(() => {
    const map: Record<string, string> = {
      devs: 'devs',
      designer: 'design',
      editor: 'editor-video',
      editor_video: 'editor-video',
      produtora: 'produtora',
      atrizes: 'produtora',
    };
    return map[config.personsRole] ?? config.boardQueryKeyPrefix;
  }, [config.personsRole, config.boardQueryKeyPrefix]);

  const { data: persons = [], isLoading: isPersonsLoading } = useQuery({
    queryKey: [`all-${config.boardQueryKeyPrefix}-persons`, config.personsRole, personsPageSlug],
    queryFn: async (): Promise<BoardPerson[]> => {
      // RPC ainda não tipada — cast defensivo até o regen pós-migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('list_users_by_role_for_page', {
        _role: config.personsRole,
        _page_slug: personsPageSlug,
      });
      if (error) {
        // 42501 = insufficient_privilege (sem grant). Não derruba o board —
        // SpecializedKanbanBoard já mostra "personsEmptyMessage" se vazio.
        if ((error as { code?: string }).code === '42501') return [];
        throw error;
      }
      type Row = { user_id: string; name: string | null };
      return ((data ?? []) as Row[]).map((r) => ({
        user_id: r.user_id,
        name: r.name ?? '',
      }));
    },
  });

  // -------- Columns --------
  const { data: columns = [], isLoading: isColumnsLoading } = useQuery({
    queryKey: [`${config.boardQueryKeyPrefix}-columns`, board?.id],
    queryFn: async (): Promise<BoardColumn[]> => {
      if (!board?.id) return [];
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as BoardColumn[];
    },
    enabled: !!board?.id,
  });

  // -------- Cards --------
  const { data: cards = [] } = useQuery({
    queryKey: [`${config.boardQueryKeyPrefix}-cards`, board?.id],
    queryFn: async (): Promise<KanbanCard[]> => {
      if (!board?.id) return [];
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('board_id', board.id)
        .eq('archived', false)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as KanbanCard[];
    },
    enabled: !!board?.id,
  });

  // Creators map por card
  const cardIds = cards.map(c => c.id);
  const { data: cardCreators = {} } = config.useCardCreators(cardIds);

  // -------- Sync colunas por pessoa --------
  const ensureColumnsMutation = useMutation({
    mutationFn: async () => {
      if (!board?.id || persons.length === 0) return;

      const { data: currentColumns } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id);
      const existingTitles = (currentColumns || []).map(c => c.title);
      let position = (currentColumns || []).length;

      for (const person of persons) {
        const columnTitle = `BY ${person.name.toUpperCase()}`;
        const justificationTitle = `JUSTIFICATIVA (${person.name.toUpperCase()})`;

        if (!existingTitles.includes(columnTitle)) {
          const { data: existingCol } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', board.id)
            .eq('title', columnTitle)
            .maybeSingle();
          if (!existingCol) {
            await supabase.from('kanban_columns').insert({
              board_id: board.id,
              title: columnTitle,
              position: position++,
              color: 'primary',
            });
          }
        }

        if (!existingTitles.includes(justificationTitle)) {
          const { data: existingJustCol } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', board.id)
            .eq('title', justificationTitle)
            .maybeSingle();
          if (!existingJustCol) {
            await supabase.from('kanban_columns').insert({
              board_id: board.id,
              title: justificationTitle,
              position: position++,
              color: 'danger',
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`${config.boardQueryKeyPrefix}-columns`, board?.id],
      });
    },
  });

  const [syncKey, setSyncKey] = useState('');
  useEffect(() => {
    if (persons.length === 0) return;
    const newSyncKey = `${board?.id}-${persons.map(p => p.user_id).sort().join(',')}`;
    if (board?.id && newSyncKey !== syncKey && !ensureColumnsMutation.isPending) {
      setSyncKey(newSyncKey);
      ensureColumnsMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, persons]);

  // -------- Mutations de card --------

  const moveCardMutation = useMutation({
    mutationFn: async ({
      cardId, columnId, status, position,
    }: { cardId: string; columnId: string; status?: string; position: number }) => {
      await moveKanbanCard({
        cardId,
        destinationColumnId: columnId,
        newPosition: position,
        destinationStatus: status ?? null,
      });
    },
    onMutate: async ({ cardId, columnId, status, position }) => {
      const key = [`${config.boardQueryKeyPrefix}-cards`, board?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previousCards = queryClient.getQueryData<KanbanCard[]>(key);
      queryClient.setQueryData<KanbanCard[]>(key, (old) => {
        if (!old) return old;
        return old.map(card =>
          card.id === cardId
            ? { ...card, column_id: columnId, status: status || card.status, position }
            : card
        );
      });
      return { previousCards };
    },
    onError: (_err, _variables, context) => {
      const key = [`${config.boardQueryKeyPrefix}-cards`, board?.id];
      if (context?.previousCards) {
        queryClient.setQueryData(key, context.previousCards);
      }
      toast.error('Erro ao mover card');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`${config.boardQueryKeyPrefix}-cards`, board?.id],
      });
    },
  });

  const archiveCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      await archiveKanbanCard(cardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`${config.boardQueryKeyPrefix}-cards`, board?.id],
      });
      toast.success('Card arquivado com sucesso');
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      await deleteKanbanCard(cardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`${config.boardQueryKeyPrefix}-cards`, board?.id],
      });
      toast.success('Card excluído com sucesso');
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (data: BaseCardInput & Record<string, unknown>) => {
      if (!board?.id || !data.column_id) {
        throw new Error('Board ou coluna não encontrados');
      }

      const priority = config.mapPriority
        ? config.mapPriority(data.priority)
        : (data.priority || 'normal');

      const newCard = await createKanbanCard({
        boardId: board.id,
        columnId: String(data.column_id),
        title: String(data.title),
        description: typeof data.description === 'string' ? data.description : null,
        priority: String(priority),
        dueDate: typeof data.due_date === 'string' ? data.due_date : null,
        assignedTo: null,
        tags: null,
        status: typeof data.status === 'string' ? data.status : config.fallbackStatus,
        cardType: config.cardType,
        clientId: null,
      });

      // Briefing estruturado (Atrizes/Design/Video/Produtora)
      const briefingData = (data.briefing || null) as Record<string, unknown> | null;
      if (config.briefing && briefingData && newCard) {
        const payload: Record<string, string | null> = {};
        for (const field of config.briefing.fields) {
          payload[field] = (briefingData[field] as string | undefined) || null;
        }
        await upsertKanbanBriefing(newCard.id, config.briefing.briefingType, payload);
      }

      // Attachments (Devs)
      if (config.attachments && newCard) {
        const materials = (data[config.attachments.alsoCreateBriefing?.fieldFromPayload ?? ''] as string | undefined);
        if (config.attachments.alsoCreateBriefing && materials) {
          await upsertKanbanBriefing(newCard.id, 'dev', {
            [config.attachments.alsoCreateBriefing.fieldFromPayload]: materials,
          });
        }

        const attachments = (data.attachments as CardAttachmentInput[] | undefined) || [];
        for (const att of attachments) {
          try {
            const safeName = sanitizeFileName(att.name);
            const filePath = `${newCard.id}/${Date.now()}_${safeName}`;
            const { error: uploadError } = await supabase.storage
              .from(config.attachments.storageBucket)
              .upload(filePath, att.file, { upsert: false, contentType: att.type || undefined });
            if (uploadError) {
              console.error('Error uploading attachment:', uploadError);
              continue;
            }
            const { data: publicUrlData } = supabase.storage
              .from(config.attachments.storageBucket)
              .getPublicUrl(filePath);
            await createKanbanCardAttachment({
              cardId: newCard.id,
              fileName: att.name,
              fileUrl: publicUrlData.publicUrl,
              fileType: att.type,
              fileSize: att.size,
            });
          } catch (err) {
            console.error('Exception during attachment upload:', err);
          }
        }
      }

      return newCard;
    },
    onSuccess: (newCard) => {
      queryClient.invalidateQueries({
        queryKey: [`${config.boardQueryKeyPrefix}-cards`, board?.id],
      });
      if (newCard && config.attachments) {
        queryClient.invalidateQueries({ queryKey: ['card-attachments', newCard.id] });
      }
      toast.success(config.createSuccessMessage);
      setIsCreateModalOpen(false);
      setSelectedColumnId(null);
      setIsCreating(false);
    },
    onError: (error) => {
      console.error('Error creating card:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error('Erro ao criar demanda', { description: msg });
      setIsCreating(false);
    },
  });

  // -------- Handlers --------

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (!canMove) {
      toast.error('Você não tem permissão para mover cards');
      return;
    }

    const { draggableId, source, destination } = result;
    const [columnId, statusId] = destination.droppableId.split(':');
    const [, sourceStatus] = source.droppableId.split(':');

    moveCardMutation.mutate({
      cardId: draggableId,
      columnId,
      status: statusId,
      position: destination.index,
    });

    // Notificação opcional ao entrar num status alvo
    if (
      config.afterMoveNotification &&
      statusId === config.afterMoveNotification.targetStatus &&
      sourceStatus !== config.afterMoveNotification.targetStatus &&
      createNotificationMutation
    ) {
      const card = cards.find(c => c.id === draggableId);
      const creator = cardCreators[draggableId];
      if (card && creator) {
        createNotificationMutation.mutate({
          cardId: draggableId,
          cardTitle: card.title,
          requesterId: creator.user_id,
          requesterName: creator.name,
        });
      }
    }

    // Escape hatch — Atrizes faz um workflow custom aqui.
    if (customAfterMove) {
      const card = cards.find(c => c.id === draggableId);
      if (card) {
        void customAfterMove({
          card,
          sourceStatus,
          destStatus: statusId,
          creator: cardCreators[draggableId],
        });
      }
    }
  };

  const handleCreateCard = (columnId: string) => {
    if (!canCreate) {
      toast.error('Você não tem permissão para criar cards');
      return;
    }
    setSelectedColumnId(columnId);
    setIsCreateModalOpen(true);
  };

  const handleCardClick = (card: KanbanCard) => {
    setSelectedCard(card);
    setIsDetailModalOpen(true);
  };

  const handleCreateSubmit = (
    data: BaseCardInput & Record<string, unknown>,
    attachments?: CardAttachmentInput[]
  ) => {
    setIsCreating(true);
    createCardMutation.mutate({
      ...data,
      column_id: (data.column_id as string | undefined) || selectedColumnId || undefined,
      ...(attachments ? { attachments } : {}),
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // -------- Derived --------

  // Set de nomes (uppercase) das pessoas ATIVAS no role do board.
  // Usado para filtrar colunas BY-* / JUSTIFICATIVA (*) cujo dono nao
  // existe mais em public.profiles + user_roles. Sem isso, colunas
  // orfas de users removidos continuam visiveis indefinidamente.
  const activePersonNames = useMemo(() => {
    return new Set(persons.map(p => p.name.toUpperCase()));
  }, [persons]);

  const personColumns = columns.filter(c => {
    if (!c.title.startsWith('BY ')) return false;
    if (c.title.startsWith('JUSTIFICATIVA')) return false;
    const personName = c.title.replace(/^BY\s+/, '').trim();
    return activePersonNames.has(personName);
  });

  const justificationColumns = columns.filter(c => {
    if (!c.title.startsWith('JUSTIFICATIVA (')) return false;
    const match = c.title.match(/^JUSTIFICATIVA\s*\(([^)]+)\)/);
    const personName = match ? match[1].trim() : '';
    return activePersonNames.has(personName);
  });

  const personColumnsForModal = personColumns.map(c => ({ id: c.id, title: c.title }));

  const cardsByColumnAndStatus = useMemo(() => {
    const statusIds = new Set(config.statuses.map(s => s.id));
    const buckets: Record<string, Record<string, KanbanCard[]>> = {};
    for (const card of cards) {
      if (!buckets[card.column_id]) {
        buckets[card.column_id] = {};
        for (const s of config.statuses) buckets[card.column_id][s.id] = [];
      }
      const status = card.status && statusIds.has(card.status) ? card.status : config.fallbackStatus;
      buckets[card.column_id][status].push(card);
    }
    return buckets;
  }, [cards, config.statuses, config.fallbackStatus]);

  const getCardsForColumn = (columnId: string) => {
    return cardsByColumnAndStatus[columnId] || config.statuses.reduce((acc, s) => {
      acc[s.id] = [];
      return acc;
    }, {} as Record<string, KanbanCard[]>);
  };

  // -------- Estados de carregamento --------

  const isLoading = isBoardLoading || isPersonsLoading || isColumnsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>{config.labels?.noBoardMessage ?? 'Nenhum quadro encontrado'}</p>
      </div>
    );
  }

  if (personColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>{config.personsEmptyMessage}</p>
      </div>
    );
  }

  // -------- Render --------

  const CreateCardModal = config.CreateCardModal;
  const DelayModal = config.delay?.DelayModal;

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-apple">
          {personColumns.map((column) => {
            const cardsByStatus = getCardsForColumn(column.id);
            const totalCards = Object.values(cardsByStatus).flat().length;
            const displayTitle = column.title.replace(/^BY\s+/i, '');

            return (
              <div
                key={column.id}
                className="kanban-column w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden"
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.columnDotClass)} />
                    <User size={13} className="text-muted-foreground/70 shrink-0" strokeWidth={2.25} />
                    <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-foreground truncate">
                      {displayTitle}
                    </h3>
                    <span className="text-[12px] font-medium text-muted-foreground/70 tabular-nums ml-0.5">
                      {totalCards}
                    </span>
                    {canCreate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto text-muted-foreground/60 hover:text-foreground"
                        onClick={() => handleCreateCard(column.id)}
                      >
                        <Plus size={14} />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-apple">
                  {config.statuses.map((status) => {
                    const statusCards = cardsByStatus[status.id] || [];
                    const isCollapsed = collapsedSections[`${column.id}:${status.id}`];

                    return (
                      <div key={status.id} className="border-b border-border/40 last:border-b-0">
                        <button
                          onClick={() => toggleSection(`${column.id}:${status.id}`)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={13} className="text-muted-foreground/70 shrink-0" />
                          ) : (
                            <ChevronDown size={13} className="text-muted-foreground/70 shrink-0" />
                          )}
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', status.color)} />
                          <span className="text-[12px] font-medium text-foreground/80">{status.label}</span>
                          <span className="ml-auto text-[11px] font-medium text-muted-foreground/70 tabular-nums">
                            {statusCards.length}
                          </span>
                        </button>

                        {!isCollapsed && (
                          <Droppable droppableId={`${column.id}:${status.id}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  'px-3 pb-3 space-y-2 min-h-[60px] transition-colors',
                                  snapshot.isDraggingOver && 'kanban-droppable-active'
                                )}
                              >
                                {statusCards.map((card, cardIndex) => (
                                  <Draggable
                                    key={card.id}
                                    draggableId={card.id}
                                    index={cardIndex}
                                    isDragDisabled={!canMove}
                                  >
                                    {(provided, snapshot) => {
                                      const overdue = isCardOverdue(card);
                                      const hasJustification = card.justification;
                                      return (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          onClick={() => handleCardClick(card)}
                                          className={cn(
                                            'kanban-card group p-3.5 bg-card rounded-xl border cursor-pointer',
                                            snapshot.isDragging && 'kanban-card-dragging',
                                            overdue && !hasJustification ? 'border-danger/60' : 'border-border'
                                          )}
                                        >
                                          <div className="flex items-center gap-1.5 mb-2 min-h-[16px]">
                                            {card.priority === 'urgent' && (
                                              <Flag
                                                size={12}
                                                strokeWidth={2.5}
                                                fill="currentColor"
                                                className="text-danger"
                                              />
                                            )}
                                            {card.due_date && (
                                              <div
                                                className={cn(
                                                  'flex items-center gap-1 text-[11px] font-medium tabular-nums',
                                                  overdue && !hasJustification
                                                    ? 'text-danger'
                                                    : overdue && hasJustification
                                                      ? 'text-warning'
                                                      : 'text-muted-foreground/80'
                                                )}
                                              >
                                                {overdue && !hasJustification ? (
                                                  <AlertTriangle size={11} strokeWidth={2.25} />
                                                ) : (
                                                  <Calendar size={11} strokeWidth={2.25} />
                                                )}
                                                {format(new Date(card.due_date), 'dd MMM', { locale: ptBR })}
                                              </div>
                                            )}
                                            {cardCreators[card.id] && (
                                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 truncate">
                                                <UserCircle size={11} strokeWidth={2.25} />
                                                <span className="truncate">{cardCreators[card.id]!.name}</span>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground leading-[1.35] line-clamp-2">
                                              {card.title}
                                            </h4>
                                            {canArchive && (
                                              <DropdownMenu>
                                                <DropdownMenuTrigger
                                                  asChild
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <MoreHorizontal size={14} />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (!canArchive) {
                                                        toast.error('Você não tem permissão para arquivar cards');
                                                        return;
                                                      }
                                                      archiveCardMutation.mutate(card.id);
                                                    }}
                                                  >
                                                    <Archive size={14} className="mr-2" />
                                                    Arquivar
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (!canArchive) {
                                                        toast.error('Você não tem permissão para excluir cards');
                                                        return;
                                                      }
                                                      deleteCardMutation.mutate(card.id);
                                                    }}
                                                    className="text-danger"
                                                  >
                                                    <Trash2 size={14} className="mr-2" />
                                                    Excluir
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {justificationColumns.map((column) => {
            const personName = getPersonNameFromJustificationColumn(column.title);
            if (!config.delay || !personName) return null;
            return (
              <JustificationColumn
                key={column.id}
                column={column}
                personName={personName}
                useJustifications={config.delay.useJustifications}
              />
            );
          })}
        </div>
      </DragDropContext>

      <CreateCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedColumnId(null);
        }}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        {...{ [config.createModalColumnPropName]: personColumnsForModal }}
      />

      {selectedCard && (
        <CardDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedCard(null);
          }}
          card={selectedCard}
          boardId={board?.id}
          {...config.cardDetailFlags}
        />
      )}

      {DelayModal && (
        <DelayModal
          isOpen={isDelayModalOpen}
          onClose={() => setIsDelayModalOpen(false)}
          delayedCards={delayedCards}
        />
      )}
    </>
  );
}

// ---------- Justification Column ----------

function JustificationColumn({
  column,
  personName,
  useJustifications,
}: {
  column: BoardColumn;
  personName: string;
  useJustifications: (name: string) => {
    data: Array<{ id: string; created_at: string; justification: string }>;
  };
}) {
  const { data: justifications = [] } = useJustifications(personName);
  const displayTitle = column.title.replace(/JUSTIFICATIVA\s*\(([^)]+)\)/i, '$1');

  return (
    <div className="kanban-column w-[300px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-danger shrink-0" strokeWidth={2.25} />
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground truncate">
            Justificativa · {displayTitle}
          </h3>
          <span className="text-[11px] font-medium text-muted-foreground/80 tabular-nums">
            {justifications.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple">
        {justifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 select-none">
            <div className="w-8 h-8 rounded-lg border border-dashed border-border mb-2" />
            <p className="text-[11px]">Nenhuma justificativa</p>
          </div>
        ) : (
          justifications.map((j) => (
            <div key={j.id} className="p-3 bg-danger/5 rounded-xl border border-danger/20">
              <p className="text-[11px] text-muted-foreground mb-1 tabular-nums">
                {format(new Date(j.created_at), 'dd MMM, HH:mm', { locale: ptBR })}
              </p>
              <p className="text-[13px] text-foreground leading-[1.45]">{j.justification}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
