import { useState, useMemo } from 'react';
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
import { useClientsWithSales } from '@/hooks/useClientList';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, X, Search, Users, AlertCircle } from 'lucide-react';

interface MeetingOneOnOneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeetingOneOnOneModal({ open, onOpenChange }: MeetingOneOnOneModalProps) {
  const { user } = useAuth();
  const { challenges, createMeeting, addChallenge } = useMeetingsOneOnOne();
  const { data: managers = [], isLoading: isLoadingManagers } = useSquadManagers();
  const { data: allClients = [] } = useClientsWithSales();

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
  const [clientSearch, setClientSearch] = useState('');
  const [clientProblems, setClientProblems] = useState<Record<string, string>>({});

  // Active clients only (not archived, not churned)
  const activeClients = useMemo(() => {
    return allClients.filter(c => !c.archived && c.status !== 'churned');
  }, [allClients]);

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    const q = clientSearch.toLowerCase();
    return activeClients
      .filter(c => c.name.toLowerCase().includes(q) || c.razao_social?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [activeClients, clientSearch]);

  const selectedClientIds = Object.keys(clientProblems);

  const addClientProblem = (clientId: string) => {
    if (!clientProblems[clientId]) {
      setClientProblems(prev => ({ ...prev, [clientId]: '' }));
      setClientSearch('');
    }
  };

  const removeClientProblem = (clientId: string) => {
    setClientProblems(prev => {
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
  };

  const updateClientProblem = (clientId: string, text: string) => {
    setClientProblems(prev => ({ ...prev, [clientId]: text }));
  };

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
    setClientSearch('');
    setClientProblems({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedManager) return;

    const manager = managers.find(m => m.user_id === selectedManager);
    if (!manager) return;

    // Build client problems array with names
    const clientProblemsArray = Object.entries(clientProblems)
      .filter(([, text]) => text.trim())
      .map(([clientId, text]) => {
        const client = activeClients.find(c => c.id === clientId);
        return { clientId, clientName: client?.name || 'Cliente', problem: text.trim() };
      });

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
      client_problems: clientProblemsArray,
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

          {/* Clientes com Problemas */}
          <div>
            <Label className="text-muted-foreground uppercase text-xs tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Selecionar clientes com problemas
            </Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar cliente pelo nome..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-10"
              />
              {clientSearch.trim() && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredClients.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => addClientProblem(client.id)}
                      disabled={selectedClientIds.includes(client.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="truncate">{client.name}</span>
                      {selectedClientIds.includes(client.id) && (
                        <span className="text-xs text-muted-foreground ml-2">Já adicionado</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {clientSearch.trim() && filteredClients.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 p-3">
                  <p className="text-sm text-muted-foreground text-center">Nenhum cliente encontrado</p>
                </div>
              )}
            </div>

            {/* Selected clients with problem notes */}
            {selectedClientIds.length > 0 && (
              <div className="space-y-3 mt-3">
                {selectedClientIds.map(clientId => {
                  const client = activeClients.find(c => c.id === clientId);
                  return (
                    <div key={clientId} className="border border-orange-200 dark:border-orange-800 rounded-lg p-3 bg-orange-50/50 dark:bg-orange-900/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium">{client?.name || 'Cliente'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeClientProblem(clientId)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <Textarea
                        value={clientProblems[clientId] || ''}
                        onChange={(e) => updateClientProblem(clientId, e.target.value)}
                        placeholder="Descreva o problema encontrado com este cliente..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            )}
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
