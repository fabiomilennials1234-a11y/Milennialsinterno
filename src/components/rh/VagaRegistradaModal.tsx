import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCreateRHVagaBriefing, useUpdateRHVagaBriefing, useRHVagaBriefing, RHVaga } from '@/hooks/useRH';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Briefcase, Calendar, Users } from 'lucide-react';

const briefingSchema = z.object({
  solicitado_por: z.string().min(1, 'Campo obrigatório'),
  area_squad: z.string().min(1, 'Campo obrigatório'),
  nome_vaga: z.string().min(1, 'Campo obrigatório'),
  quantidade_vagas: z.number().min(1, 'Mínimo 1 vaga'),
  modelo: z.enum(['presencial', 'hibrido', 'remoto']),
  cidade_uf: z.string().min(1, 'Campo obrigatório'),
  regime: z.enum(['clt', 'pj']),
  faixa_salarial: z.string().min(1, 'Campo obrigatório'),
  objetivo_vaga: z.string().min(1, 'Campo obrigatório'),
  principais_responsabilidades: z.string().min(1, 'Campo obrigatório'),
  requisitos_obrigatorios: z.string().min(1, 'Campo obrigatório'),
  requisitos_desejaveis: z.string().optional(),
  ferramentas_obrigatorias: z.string().min(1, 'Campo obrigatório'),
  nivel: z.enum(['junior', 'pleno', 'senior']),
  data_limite: z.string().min(1, 'Data limite é obrigatória'),
  observacoes: z.string().optional(),
});

type BriefingFormData = z.infer<typeof briefingSchema>;

interface VagaRegistradaModalProps {
  vaga: RHVaga;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function VagaRegistradaModal({ vaga, isOpen, onClose, onComplete }: VagaRegistradaModalProps) {
  const { user } = useAuth();
  const { data: existingBriefing } = useRHVagaBriefing(vaga.id);
  const createBriefing = useCreateRHVagaBriefing();
  const updateBriefing = useUpdateRHVagaBriefing();

  const form = useForm<BriefingFormData>({
    resolver: zodResolver(briefingSchema),
    defaultValues: {
      solicitado_por: existingBriefing?.solicitado_por || user?.name || '',
      area_squad: existingBriefing?.area_squad || '',
      nome_vaga: existingBriefing?.nome_vaga || vaga.title || '',
      quantidade_vagas: existingBriefing?.quantidade_vagas || 1,
      modelo: (existingBriefing?.modelo?.toLowerCase() as 'presencial' | 'hibrido' | 'remoto') || 'remoto',
      cidade_uf: existingBriefing?.cidade_uf || '',
      regime: (existingBriefing?.regime?.toLowerCase() as 'clt' | 'pj') || 'clt',
      faixa_salarial: existingBriefing?.faixa_salarial || '',
      objetivo_vaga: existingBriefing?.objetivo_vaga || '',
      principais_responsabilidades: existingBriefing?.principais_responsabilidades || '',
      requisitos_obrigatorios: existingBriefing?.requisitos_obrigatorios || '',
      requisitos_desejaveis: existingBriefing?.requisitos_desejaveis || '',
      ferramentas_obrigatorias: existingBriefing?.ferramentas_obrigatorias || '',
      nivel: (existingBriefing?.nivel?.toLowerCase().replace('ú', 'u').replace('ê', 'e') as 'junior' | 'pleno' | 'senior') || 'pleno',
      data_limite: existingBriefing?.data_limite || '',
      observacoes: existingBriefing?.observacoes || '',
    },
  });

  // Reset form when existingBriefing changes
  React.useEffect(() => {
    if (existingBriefing) {
      form.reset({
        solicitado_por: existingBriefing.solicitado_por || user?.name || '',
        area_squad: existingBriefing.area_squad || '',
        nome_vaga: existingBriefing.nome_vaga || vaga.title || '',
        modelo: (existingBriefing.modelo?.toLowerCase() as 'presencial' | 'hibrido' | 'remoto') || 'remoto',
        cidade_uf: existingBriefing.cidade_uf || '',
        regime: (existingBriefing.regime?.toLowerCase() as 'clt' | 'pj') || 'clt',
        faixa_salarial: existingBriefing.faixa_salarial || '',
        objetivo_vaga: existingBriefing.objetivo_vaga || '',
        principais_responsabilidades: existingBriefing.principais_responsabilidades || '',
        requisitos_obrigatorios: existingBriefing.requisitos_obrigatorios || '',
        requisitos_desejaveis: existingBriefing.requisitos_desejaveis || '',
        ferramentas_obrigatorias: existingBriefing.ferramentas_obrigatorias || '',
        nivel: (existingBriefing.nivel?.toLowerCase().replace('ú', 'u').replace('ê', 'e') as 'junior' | 'pleno' | 'senior') || 'pleno',
        data_limite: existingBriefing.data_limite || '',
        observacoes: existingBriefing.observacoes || '',
      });
    }
  }, [existingBriefing, form, user?.name, vaga.title]);

  const handleSubmit = async (data: BriefingFormData) => {
    try {
      const briefingData = {
        vaga_id: vaga.id,
        solicitado_por: data.solicitado_por,
        area_squad: data.area_squad,
        nome_vaga: data.nome_vaga,
        quantidade_vagas: data.quantidade_vagas,
        modelo: data.modelo === 'presencial' ? 'Presencial' : data.modelo === 'hibrido' ? 'Híbrido' : 'Remoto',
        cidade_uf: data.cidade_uf,
        regime: data.regime === 'clt' ? 'CLT' : 'PJ',
        faixa_salarial: data.faixa_salarial,
        objetivo_vaga: data.objetivo_vaga,
        principais_responsabilidades: data.principais_responsabilidades,
        requisitos_obrigatorios: data.requisitos_obrigatorios,
        requisitos_desejaveis: data.requisitos_desejaveis || null,
        ferramentas_obrigatorias: data.ferramentas_obrigatorias,
        nivel: data.nivel === 'junior' ? 'Júnior' : data.nivel === 'pleno' ? 'Pleno' : 'Sênior',
        data_limite: data.data_limite,
        observacoes: data.observacoes || null,
      };

      if (existingBriefing) {
        await updateBriefing.mutateAsync({
          id: existingBriefing.id,
          ...briefingData,
        });
      } else {
        await createBriefing.mutateAsync(briefingData);
      }

      toast.success('Briefing preenchido com sucesso!');
      onComplete();
    } catch (error) {
      console.error('Error saving briefing:', error);
      toast.error('Erro ao salvar briefing');
    }
  };

  const modeloLabels = {
    presencial: 'Presencial',
    hibrido: 'Híbrido',
    remoto: 'Remoto',
  };

  const regimeLabels = {
    clt: 'CLT',
    pj: 'PJ',
  };

  const nivelLabels = {
    junior: 'Júnior',
    pleno: 'Pleno',
    senior: 'Sênior',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Preencher Briefing da Vaga
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os detalhes da vaga para registrá-la oficialmente
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome_vaga"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Vaga *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Desenvolvedor Frontend" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="solicitado_por"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Solicitado por *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do solicitante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="area_squad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Área / Squad *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Tecnologia / Squad Alpha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location & Model */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(modeloLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cidade_uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade/UF *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: São Paulo/SP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(regimeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Salary & Level */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="faixa_salarial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Faixa Salarial *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: R$ 5.000 - R$ 8.000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(nivelLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_limite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Data Limite *
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Objective */}
            <FormField
              control={form.control}
              name="objetivo_vaga"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo da Vaga *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o objetivo principal desta contratação..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Responsibilities */}
            <FormField
              control={form.control}
              name="principais_responsabilidades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Principais Responsabilidades *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Liste as principais responsabilidades do cargo..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Requirements */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requisitos_obrigatorios"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requisitos Obrigatórios *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Liste os requisitos obrigatórios..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requisitos_desejaveis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requisitos Desejáveis</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Liste os requisitos desejáveis..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tools */}
            <FormField
              control={form.control}
              name="ferramentas_obrigatorias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ferramentas Obrigatórias *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: React, TypeScript, Node.js, Git" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações Adicionais</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais sobre a vaga..."
                      className="min-h-[60px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createBriefing.isPending || updateBriefing.isPending}>
                {(createBriefing.isPending || updateBriefing.isPending) ? 'Salvando...' : 'Salvar Briefing'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
