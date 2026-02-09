import { useState } from 'react';
import { 
  useCSActionManuals, 
  useCreateCSActionManual, 
  useUpdateCSActionManual,
  useDeleteCSActionManual,
  CSActionManual,
} from '@/hooks/useSucessoCliente';
import { useCSPermissions } from '@/hooks/useSucessoCliente';
import CSColumnScroll from './CSColumnScroll';
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
  Book, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function CSActionManualsColumn() {
  const { data: manuals = [], isLoading } = useCSActionManuals();
  const createManual = useCreateCSActionManual();
  const updateManual = useUpdateCSActionManual();
  const deleteManual = useDeleteCSActionManual();
  const { canEdit } = useCSPermissions();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingManual, setEditingManual] = useState<CSActionManual | null>(null);
  const [expandedManualId, setExpandedManualId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'general',
  });

  const resetForm = () => {
    setFormData({ title: '', description: '', content: '', category: 'general' });
  };

  const handleCreate = () => {
    createManual.mutate(formData, {
      onSuccess: () => {
        setIsCreateOpen(false);
        resetForm();
      },
    });
  };

  const handleUpdate = () => {
    if (editingManual) {
      updateManual.mutate({
        id: editingManual.id,
        ...formData,
      }, {
        onSuccess: () => {
          setEditingManual(null);
          resetForm();
        },
      });
    }
  };

  const handleEdit = (manual: CSActionManual) => {
    setFormData({
      title: manual.title,
      description: manual.description || '',
      content: manual.content,
      category: manual.category || 'general',
    });
    setEditingManual(manual);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover este manual?')) {
      deleteManual.mutate(id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedManualId(expandedManualId === id ? null : id);
  };

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle shadow-apple">
      {/* Header */}
      <div className="section-header section-header-purple">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Book size={18} className="text-white" />
            <h2 className="font-semibold text-white">Manual de Ações</h2>
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

      {/* Manual list */}
      <CSColumnScroll contentClassName="p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Carregando...</p>
            </div>
          ) : manuals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Book className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">Nenhum manual cadastrado</p>
              {canEdit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus size={14} className="mr-1" />
                  Criar primeiro manual
                </Button>
              )}
            </div>
          ) : (
            manuals.map(manual => (
              <Card key={manual.id} className="bg-muted/30 border-subtle">
                <CardContent className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => toggleExpand(manual.id)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-primary shrink-0" />
                        <h4 className="font-medium text-sm">{manual.title}</h4>
                        {expandedManualId === manual.id ? (
                          <ChevronUp size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={14} className="text-muted-foreground" />
                        )}
                      </div>
                      {manual.description && (
                        <p className="text-xs text-muted-foreground mt-1 ml-5">
                          {manual.description}
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
                          <DropdownMenuItem onClick={() => handleEdit(manual)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(manual.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Category badge */}
                  <Badge variant="outline" className="text-xs">
                    {manual.category}
                  </Badge>

                  {/* Expanded content */}
                  {expandedManualId === manual.id && (
                    <div className="mt-3 pt-3 border-t border-subtle">
                      <div className="prose prose-sm max-w-none text-sm text-muted-foreground whitespace-pre-wrap">
                        {manual.content}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
      </CSColumnScroll>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={isCreateOpen || !!editingManual} 
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingManual(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingManual ? 'Editar Manual' : 'Novo Manual de Ação'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Como lidar com cliente insatisfeito"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição do manual"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Categoria</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: atendimento, cobrança, suporte"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Conteúdo *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Descreva as ações e procedimentos..."
                className="mt-1 min-h-[200px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateOpen(false);
                setEditingManual(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={editingManual ? handleUpdate : handleCreate}
              disabled={!formData.title || !formData.content || createManual.isPending || updateManual.isPending}
            >
              {editingManual ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
