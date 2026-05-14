import { ClientCombobox } from '@/components/ui/client-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Video, X, MonitorUp } from 'lucide-react';
import type { MeetingFolder } from '@/hooks/useRecordedMeetings';
import type { ClientComboboxItem } from '@/components/ui/client-combobox';

export interface RecordingSetupModalProps {
  title: string;
  onTitleChange: (v: string) => void;
  folderId: string;
  onFolderChange: (v: string) => void;
  clientId: string | null;
  onClientChange: (v: string | null) => void;
  folders: MeetingFolder[];
  clients: ClientComboboxItem[];
  clientsLoading: boolean;
  onStart: () => void;
  onClose: () => void;
}

export function RecordingSetupModal({
  title,
  onTitleChange,
  folderId,
  onFolderChange,
  clientId,
  onClientChange,
  folders,
  clients,
  clientsLoading,
  onStart,
  onClose,
}: RecordingSetupModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
              <MonitorUp size={20} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Gravar Reuniao</h3>
              <p className="text-xs text-muted-foreground">Capture tela e audio do sistema</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X size={16} />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">
              Titulo <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              placeholder="Ex: Reuniao semanal de equipe"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim() && folderId) {
                  onStart();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">
              Pasta <span className="text-destructive">*</span>
            </Label>
            <Select value={folderId} onValueChange={onFolderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar pasta..." />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {folders.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crie uma pasta em "Reunioes Gravadas" primeiro.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Cliente (opcional)</Label>
            <ClientCombobox
              value={clientId}
              onChange={(id) => onClientChange(id)}
              clients={clients}
              isLoading={clientsLoading}
              placeholder="Selecionar cliente..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onStart}
            disabled={!title.trim() || !folderId}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Video size={16} className="mr-2" />
            Iniciar Gravacao
          </Button>
        </div>
      </div>
    </div>
  );
}
