import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RHVaga, useCreateRHAtividade, useMoveRHVaga } from '@/hooks/useRH';
import { useRHVagaPlataformas } from '@/hooks/useRHPlataformas';
import { useCreateRHTarefa } from '@/hooks/useRHTarefas';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Briefcase, DollarSign, FileText, Users, Globe, X } from 'lucide-react';


// Plataformas disponíveis para publicação
const PLATAFORMAS_DISPONIVEIS = [
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'meta', name: 'Meta (Facebook/Instagram)', icon: '📘' },
  { id: 'infojobs', name: 'InfoJobs', icon: '🔍' },
  { id: 'indeed', name: 'Indeed', icon: '🌐' },
  { id: 'catho', name: 'Catho', icon: '📋' },
  { id: 'vagas', name: 'Vagas.com', icon: '💻' },
  { id: 'gupy', name: 'Gupy', icon: '🚀' },
  { id: 'glassdoor', name: 'Glassdoor', icon: '🏢' },
  { id: 'trampos', name: 'Trampos.co', icon: '🎯' },
  { id: 'outro', name: 'Outro', icon: '➕' },
];

export interface PlataformaData {
  plataforma: string;
  budget: string;
  descricao: string;
  expectativa_curriculos: string;
  observacoes: string;
}

interface RegistrarVagaModalProps {
  vaga: RHVaga;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function RegistrarVagaModal({ vaga, isOpen, onClose, onComplete }: RegistrarVagaModalProps) {
  const { user } = useAuth();
  const { createPlataformas, isCreating, existingPlataformas } = useRHVagaPlataformas(vaga.id);
  const createAtividade = useCreateRHAtividade();
  const moveVaga = useMoveRHVaga();
  const createTarefa = useCreateRHTarefa();
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformData, setPlatformData] = useState<Record<string, PlataformaData>>({});

  // Initialize with existing data if any
  React.useEffect(() => {
    if (existingPlataformas && existingPlataformas.length > 0) {
      const platforms = existingPlataformas.map(p => p.plataforma);
      setSelectedPlatforms(platforms);
      
      const dataMap: Record<string, PlataformaData> = {};
      existingPlataformas.forEach(p => {
        dataMap[p.plataforma] = {
          plataforma: p.plataforma,
          budget: p.budget?.toString() || '',
          descricao: p.descricao || '',
          expectativa_curriculos: p.expectativa_curriculos?.toString() || '',
          observacoes: p.observacoes || '',
        };
      });
      setPlatformData(dataMap);
    }
  }, [existingPlataformas]);

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        // Remove platform
        const newData = { ...platformData };
        delete newData[platformId];
        setPlatformData(newData);
        return prev.filter(p => p !== platformId);
      } else {
        // Add platform with default data
        setPlatformData(prev => ({
          ...prev,
          [platformId]: {
            plataforma: platformId,
            budget: '',
            descricao: '',
            expectativa_curriculos: '',
            observacoes: '',
          },
        }));
        return [...prev, platformId];
      }
    });
  };

  const updatePlatformData = (platformId: string, field: keyof PlataformaData, value: string) => {
    setPlatformData(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Selecione pelo menos uma plataforma');
      return;
    }

    // Validate that all platforms have required data
    for (const platformId of selectedPlatforms) {
      const data = platformData[platformId];
      if (!data?.descricao) {
        const platform = PLATAFORMAS_DISPONIVEIS.find(p => p.id === platformId);
        toast.error(`Preencha a descrição para ${platform?.name || platformId}`);
        return;
      }
    }

    try {
      // Save platforms
      const plataformasToSave = selectedPlatforms.map(platformId => {
        const data = platformData[platformId];
        const platformInfo = PLATAFORMAS_DISPONIVEIS.find(p => p.id === platformId);
        return {
          vaga_id: vaga.id,
          plataforma: platformInfo?.name || platformId,
          budget: data.budget ? parseFloat(data.budget.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
          descricao: data.descricao,
          expectativa_curriculos: data.expectativa_curriculos ? parseInt(data.expectativa_curriculos) : null,
          observacoes: data.observacoes || null,
        };
      });

      await createPlataformas(plataformasToSave);

      // Move vaga to next status
      await moveVaga.mutateAsync({
        id: vaga.id,
        status: 'vaga_registrada',
      });

      // Log activity
      await createAtividade.mutateAsync({
        vaga_id: vaga.id,
        user_id: user?.id,
        user_name: user?.name,
        action: 'Vaga registrada com plataformas',
        details: {
          plataformas: selectedPlatforms.map(p => PLATAFORMAS_DISPONIVEIS.find(pl => pl.id === p)?.name || p),
          total_budget: plataformasToSave.reduce((sum, p) => sum + (p.budget || 0), 0),
        },
      });

      // Create automated task "Publicar Campanha de Vaga"
      await createTarefa.mutateAsync({
        titulo: `Publicar Campanha: ${vaga.title}`,
        descricao: `Publique a campanha de recrutamento nas plataformas selecionadas: ${selectedPlatforms.map(p => PLATAFORMAS_DISPONIVEIS.find(pl => pl.id === p)?.name || p).join(', ')}`,
        vaga_id: vaga.id,
        prioridade: 'alta',
        tipo: 'publicar_campanha',
        created_by: user?.id,
        created_by_name: user?.name,
      });

      toast.success('Vaga registrada! Tarefa de publicação criada.');
      onComplete();
    } catch (error) {
      console.error('Error registering vaga:', error);
      toast.error('Erro ao registrar vaga');
    }
  };

  const getTotalBudget = () => {
    return selectedPlatforms.reduce((sum, platformId) => {
      const budget = platformData[platformId]?.budget;
      if (budget) {
        const value = parseFloat(budget.replace(/[^\d.,]/g, '').replace(',', '.'));
        return sum + (isNaN(value) ? 0 : value);
      }
      return sum;
    }, 0);
  };

  const getTotalExpectedCVs = () => {
    return selectedPlatforms.reduce((sum, platformId) => {
      const expectativa = platformData[platformId]?.expectativa_curriculos;
      if (expectativa) {
        return sum + parseInt(expectativa) || 0;
      }
      return sum;
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col" aria-describedby="registrar-vaga-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Registrar Vaga - {vaga.title}
          </DialogTitle>
          <p id="registrar-vaga-description" className="text-sm text-muted-foreground">
            Selecione as plataformas onde a vaga será publicada e defina o budget e descrição para cada uma
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 -mr-4" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          <div className="space-y-6 pb-4">
            {/* Platform Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Selecione as Plataformas
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {PLATAFORMAS_DISPONIVEIS.map((platform) => (
                  <div
                    key={platform.id}
                    onClick={() => handlePlatformToggle(platform.id)}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all
                      ${selectedPlatforms.includes(platform.id)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                      }
                    `}
                  >
                    <Checkbox
                      checked={selectedPlatforms.includes(platform.id)}
                      onCheckedChange={() => handlePlatformToggle(platform.id)}
                    />
                    <span className="text-lg">{platform.icon}</span>
                    <span className="text-sm font-medium truncate">{platform.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            {selectedPlatforms.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-accent/50 border-accent">
                  <CardContent className="p-4 flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Budget Total</p>
                      <p className="text-xl font-bold text-primary">
                        R$ {getTotalBudget().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-accent/50 border-accent">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Users className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Currículos Esperados</p>
                      <p className="text-xl font-bold text-primary">
                        {getTotalExpectedCVs()} candidatos
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Platform Details */}
            {selectedPlatforms.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Detalhes por Plataforma
                </Label>
                
                {selectedPlatforms.map((platformId) => {
                  const platform = PLATAFORMAS_DISPONIVEIS.find(p => p.id === platformId);
                  const data = platformData[platformId] || {};
                  
                  return (
                    <Card key={platformId} className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => handlePlatformToggle(platformId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>{platform?.icon}</span>
                          {platform?.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`budget-${platformId}`} className="text-sm">
                              Budget (R$)
                            </Label>
                            <Input
                              id={`budget-${platformId}`}
                              placeholder="Ex: 500,00"
                              value={(data as PlataformaData).budget || ''}
                              onChange={(e) => updatePlatformData(platformId, 'budget', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`expectativa-${platformId}`} className="text-sm">
                              Expectativa de Currículos
                            </Label>
                            <Input
                              id={`expectativa-${platformId}`}
                              type="number"
                              placeholder="Ex: 50"
                              value={(data as PlataformaData).expectativa_curriculos || ''}
                              onChange={(e) => updatePlatformData(platformId, 'expectativa_curriculos', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`descricao-${platformId}`} className="text-sm">
                            Descrição da Vaga para esta Plataforma *
                          </Label>
                          <Textarea
                            id={`descricao-${platformId}`}
                            placeholder="Descrição específica para esta plataforma..."
                            className="min-h-[80px]"
                            value={(data as PlataformaData).descricao || ''}
                            onChange={(e) => updatePlatformData(platformId, 'descricao', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`observacoes-${platformId}`} className="text-sm">
                            Observações
                          </Label>
                          <Input
                            id={`observacoes-${platformId}`}
                            placeholder="Notas adicionais..."
                            value={(data as PlataformaData).observacoes || ''}
                            onChange={(e) => updatePlatformData(platformId, 'observacoes', e.target.value)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {selectedPlatforms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Selecione pelo menos uma plataforma para continuar</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {selectedPlatforms.length > 0 && (
                <Badge variant="secondary">
                  {selectedPlatforms.length} plataforma{selectedPlatforms.length > 1 ? 's' : ''} selecionada{selectedPlatforms.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isCreating || moveVaga.isPending || selectedPlatforms.length === 0}
              >
                {(isCreating || moveVaga.isPending) ? 'Salvando...' : 'Registrar Vaga'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
