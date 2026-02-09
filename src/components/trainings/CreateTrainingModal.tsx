import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateTraining, useUpdateTraining, Training, ROLE_OPTIONS, WEEKDAY_OPTIONS } from '@/hooks/useTrainings';
import { GraduationCap, Clock, Calendar, Users, Repeat } from 'lucide-react';

interface CreateTrainingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTraining?: Training | null;
}

export default function CreateTrainingModal({
  open,
  onOpenChange,
  editingTraining,
}: CreateTrainingModalProps) {
  const [title, setTitle] = useState(editingTraining?.title || '');
  const [description, setDescription] = useState(editingTraining?.description || '');
  const [classTime, setClassTime] = useState(editingTraining?.class_time || '');
  const [classDate, setClassDate] = useState(editingTraining?.class_date?.split('T')[0] || '');
  const [isRecurring, setIsRecurring] = useState(editingTraining?.is_recurring || false);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(editingTraining?.recurrence_days || []);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(editingTraining?.allowed_roles || []);

  const createTraining = useCreateTraining();
  const updateTraining = useUpdateTraining();

  const handleSubmit = async () => {
    if (!title.trim()) return;

    const trainingData = {
      title: title.trim(),
      description: description.trim() || undefined,
      class_time: classTime || undefined,
      class_date: classDate ? new Date(classDate).toISOString() : undefined,
      is_recurring: isRecurring,
      recurrence_days: isRecurring ? recurrenceDays : undefined,
      allowed_roles: allowedRoles.length > 0 ? allowedRoles : undefined,
    };

    try {
      if (editingTraining) {
        await updateTraining.mutateAsync({ id: editingTraining.id, ...trainingData });
      } else {
        await createTraining.mutateAsync(trainingData);
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving training:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClassTime('');
    setClassDate('');
    setIsRecurring(false);
    setRecurrenceDays([]);
    setAllowedRoles([]);
  };

  const toggleRecurrenceDay = (day: string) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleRole = (role: string) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const isLoading = createTraining.isPending || updateTraining.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
            {editingTraining ? 'Editar Treinamento' : 'Novo Treinamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Título do Treinamento *
            </Label>
            <Input
              id="title"
              placeholder="Ex: Onboarding de Novos Colaboradores"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição
            </Label>
            <Textarea
              id="description"
              placeholder="Descreva o conteúdo do treinamento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Horário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Horário da Aula
              </Label>
              <Input
                type="time"
                value={classTime}
                onChange={(e) => setClassTime(e.target.value)}
                className="h-11"
              />
            </div>

            {!isRecurring && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Data da Aula
                </Label>
                <Input
                  type="date"
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                  className="h-11"
                />
              </div>
            )}
          </div>

          {/* Aula Recorrente */}
          <div className="space-y-4 p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                <Label className="text-sm font-medium">Aula Recorrente</Label>
              </div>
              <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground">
                  Selecione os dias da semana
                </Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={recurrenceDays.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleRecurrenceDay(day.value)}
                      className="text-xs"
                    >
                      {day.label.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cargos Permitidos */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Quem pode participar?
            </Label>
            <p className="text-xs text-muted-foreground">
              Se nenhum cargo for selecionado, todos poderão participar
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((role) => (
                <div
                  key={role.value}
                  className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleRole(role.value)}
                >
                  <Checkbox
                    checked={allowedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <span className="text-sm">{role.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isLoading}>
            {isLoading ? 'Salvando...' : editingTraining ? 'Atualizar' : 'Criar Treinamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
