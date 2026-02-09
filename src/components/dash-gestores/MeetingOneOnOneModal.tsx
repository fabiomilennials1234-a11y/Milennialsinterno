import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMeetingsOneOnOne, MeetingFormData } from '@/hooks/useMeetingsOneOnOne';
import { useSquadManagers } from '@/hooks/useSquadManagers';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, X } from 'lucide-react';

interface MeetingOneOnOneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeetingOneOnOneModal({ open, onOpenChange }: MeetingOneOnOneModalProps) {
  const { user } = useAuth();
  const { challenges, createMeeting, addChallenge } = useMeetingsOneOnOne();
  const { data: managers = [], isLoading: isLoadingManagers } = useSquadManagers();
  
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [documentationUpToDate, setDocumentationUpToDate] = useState(false);
  const [correctMovement, setCorrectMovement] = useState(false);
  const [delayVideo, setDelayVideo] = useState(false);
  const [delayDesign, setDelayDesign] = useState(false);
  const [delaySite, setDelaySite] = useState(false);
  const [delayCRM, setDelayCRM] = useState(false);
  const [delayAutomation, setDelayAutomation] = useState(false);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [newChallenge, setNewChallenge] = useState('');
  const [observations, setObservations] = useState('');

  const resetForm = () => {
    setSelectedManager('');
    setDocumentationUpToDate(false);
    setCorrectMovement(false);
    setDelayVideo(false);
    setDelayDesign(false);
    setDelaySite(false);
    setDelayCRM(false);
    setDelayAutomation(false);
    setSelectedChallenges([]);
    setNewChallenge('');
    setObservations('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedManager) return;

    const manager = managers.find(m => m.user_id === selectedManager);
    if (!manager) return;

    const formData: MeetingFormData = {
      evaluated_manager_id: selectedManager,
      evaluated_manager_name: manager.name,
      documentation_up_to_date: documentationUpToDate,
      correct_client_movement: correctMovement,
      delay_video: delayVideo,
      delay_design: delayDesign,
      delay_site: delaySite,
      delay_crm: delayCRM,
      delay_automation: delayAutomation,
      main_challenges: selectedChallenges,
      general_observations: observations.trim() || null,
      meeting_date: new Date().toISOString().split('T')[0],
      created_by_name: user?.name || null,
    };

    await createMeeting.mutateAsync(formData);

    resetForm();
    onOpenChange(false);
  };

  const toggleChallenge = (challenge: string) => {
    setSelectedChallenges(prev => 
      prev.includes(challenge)
        ? prev.filter(c => c !== challenge)
        : [...prev, challenge]
    );
  };

  const handleAddNewChallenge = async () => {
    if (!newChallenge.trim()) return;
    
    await addChallenge.mutateAsync(newChallenge.trim());
    setSelectedChallenges(prev => [...prev, newChallenge.trim()]);
    setNewChallenge('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formulário de Reunião 1 a 1</DialogTitle>
          <DialogDescription>
            Registre a avaliação do gestor após a reunião individual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção do Gestor */}
          <div>
            <Label>Gestor Avaliado</Label>
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingManagers ? "Carregando..." : "Selecione o gestor"} />
              </SelectTrigger>
              <SelectContent>
                {managers.map(manager => (
                  <SelectItem key={manager.user_id} value={manager.user_id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes de Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="documentation"
                checked={documentationUpToDate}
                onCheckedChange={(checked) => setDocumentationUpToDate(checked as boolean)}
              />
              <Label htmlFor="documentation" className="font-normal">
                Documentação em dia?
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="movement"
                checked={correctMovement}
                onCheckedChange={(checked) => setCorrectMovement(checked as boolean)}
              />
              <Label htmlFor="movement" className="font-normal">
                Movimentação correta dos clientes?
              </Label>
            </div>
          </div>

          {/* Atrasos */}
          <div>
            <Label className="text-muted-foreground uppercase text-xs tracking-wider">
              Possui atrasos em:
            </Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delay-video"
                  checked={delayVideo}
                  onCheckedChange={(checked) => setDelayVideo(checked as boolean)}
                />
                <Label htmlFor="delay-video" className="font-normal text-sm">Vídeo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delay-design"
                  checked={delayDesign}
                  onCheckedChange={(checked) => setDelayDesign(checked as boolean)}
                />
                <Label htmlFor="delay-design" className="font-normal text-sm">Design</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delay-site"
                  checked={delaySite}
                  onCheckedChange={(checked) => setDelaySite(checked as boolean)}
                />
                <Label htmlFor="delay-site" className="font-normal text-sm">Site</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delay-crm"
                  checked={delayCRM}
                  onCheckedChange={(checked) => setDelayCRM(checked as boolean)}
                />
                <Label htmlFor="delay-crm" className="font-normal text-sm">CRM</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delay-automation"
                  checked={delayAutomation}
                  onCheckedChange={(checked) => setDelayAutomation(checked as boolean)}
                />
                <Label htmlFor="delay-automation" className="font-normal text-sm">Automação</Label>
              </div>
            </div>
          </div>

          {/* Desafios */}
          <div>
            <Label className="text-muted-foreground uppercase text-xs tracking-wider">
              Principais desafios da semana
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {challenges.map(challenge => (
                <Badge
                  key={challenge.id}
                  variant={selectedChallenges.includes(challenge.challenge_text) ? "default" : "outline"}
                  className="cursor-pointer transition-all"
                  onClick={() => toggleChallenge(challenge.challenge_text)}
                >
                  {challenge.challenge_text}
                  {selectedChallenges.includes(challenge.challenge_text) && (
                    <X className="w-3 h-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                placeholder="Adicionar novo desafio..."
                value={newChallenge}
                onChange={(e) => setNewChallenge(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewChallenge())}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={handleAddNewChallenge}
                disabled={!newChallenge.trim() || addChallenge.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="observations">Observações Gerais</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Anotações adicionais sobre a reunião..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMeeting.isPending || !selectedManager}>
              {createMeeting.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar Reunião
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
