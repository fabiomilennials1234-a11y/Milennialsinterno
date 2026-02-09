import { useState } from 'react';
import { 
  useClientContactHistory, 
  useRegisterContact,
  CSContactRecord,
} from '@/hooks/useSucessoCliente';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Users, 
  MoreHorizontal,
  Plus,
  Clock,
  User,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CSContactHistoryProps {
  clientId: string;
  clientName: string;
  canEdit?: boolean;
}

const CONTACT_TYPES = {
  call: { label: 'Ligação', icon: Phone, color: 'text-info' },
  email: { label: 'E-mail', icon: Mail, color: 'text-purple' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-success' },
  meeting: { label: 'Reunião', icon: Users, color: 'text-warning' },
  other: { label: 'Outro', icon: MoreHorizontal, color: 'text-muted-foreground' },
};

export default function CSContactHistory({ clientId, clientName, canEdit = false }: CSContactHistoryProps) {
  const { data: history = [], isLoading } = useClientContactHistory(clientId);
  const registerContact = useRegisterContact();

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [contactType, setContactType] = useState<keyof typeof CONTACT_TYPES>('call');
  const [notes, setNotes] = useState('');

  const handleRegister = () => {
    registerContact.mutate({
      clientId,
      contactType,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setIsRegisterOpen(false);
        setContactType('call');
        setNotes('');
      },
    });
  };

  const renderContactItem = (contact: CSContactRecord) => {
    const config = CONTACT_TYPES[contact.contact_type] || CONTACT_TYPES.other;
    const Icon = config.icon;

    return (
      <div key={contact.id} className="flex gap-3 py-2 border-b border-subtle last:border-0">
        <div className={cn("p-2 rounded-lg bg-muted/50 h-fit", config.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{config.label}</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <User className="h-3 w-3" />
            {contact.user_name}
          </div>
          {contact.notes && (
            <p className="text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded">
              {contact.notes}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          Histórico de Contatos
        </h4>
        {canEdit && (
          <Button 
            size="sm" 
            variant="outline" 
            className="h-7 text-xs"
            onClick={() => setIsRegisterOpen(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Registrar
          </Button>
        )}
      </div>

      {/* History list */}
      <div className="bg-muted/30 rounded-lg p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum contato registrado
          </p>
        ) : (
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {history.map(renderContactItem)}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Register Dialog */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Contato</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{clientName}</span>
            </div>

            <div>
              <Label>Tipo de Contato</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {Object.entries(CONTACT_TYPES).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant={contactType === key ? 'default' : 'outline'}
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-2"
                      onClick={() => setContactType(key as keyof typeof CONTACT_TYPES)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{config.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Resumo do contato..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegisterOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegister}
              disabled={registerContact.isPending}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
