import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNPSSurveyByToken, useSubmitNPSResponse, useSubmitNPSTeamResponse } from '@/hooks/useNPSSurveys';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Loader2, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import { z } from 'zod';

// ---------- Client NPS Schema ----------

const clientResponseSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório').max(200),
  nps_score: z.number().min(0).max(10),
  score_reason: z.string().min(1, 'Este campo é obrigatório').max(2000),
  strategies_aligned: z.enum(['sim', 'parcialmente', 'nao']),
  communication_rating: z.enum(['excelente', 'bom', 'regular', 'ruim', 'outro']),
  communication_other: z.string().max(500).optional(),
  creatives_rating: z.enum(['excelente', 'bom', 'regular', 'ruim']),
  creatives_represent_brand: z.enum(['sim_totalmente', 'parcialmente', 'nao']),
  improvement_suggestions: z.string().min(1, 'Este campo é obrigatório').max(2000),
});

// ---------- Team NPS Schema ----------

const teamResponseSchema = z.object({
  experience_rating: z.number().min(1).max(5),
  efficiency_assessment: z.enum(['sim', 'parcialmente', 'nao']),
  positive_highlight: z.string().max(500).optional(),
  improvement_area: z.string().max(500).optional(),
  ideas_suggestions: z.string().max(3000).optional(),
  respondent_name: z.string().max(100).optional(),
});

// ---------- Experience Rating Labels ----------

const EXPERIENCE_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Boa',
  5: 'Excelente',
};

// ============================================================
// Team NPS Form
// ============================================================

function TeamNPSForm({ surveyId, onSubmitted }: { surveyId: string; onSubmitted: () => void }) {
  const submitResponse = useSubmitNPSTeamResponse();

  const [formData, setFormData] = useState({
    experience_rating: null as number | null,
    efficiency_assessment: '' as 'sim' | 'parcialmente' | 'nao' | '',
    positive_highlight: '',
    improvement_area: '',
    ideas_suggestions: '',
    respondent_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationResult = teamResponseSchema.safeParse({
      ...formData,
      experience_rating: formData.experience_rating,
      respondent_name: formData.respondent_name || undefined,
      positive_highlight: formData.positive_highlight || undefined,
      improvement_area: formData.improvement_area || undefined,
      ideas_suggestions: formData.ideas_suggestions || undefined,
    });

    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    if (!formData.experience_rating) {
      setErrors({ experience_rating: 'Selecione uma nota' });
      return;
    }

    if (!formData.efficiency_assessment) {
      setErrors({ efficiency_assessment: 'Selecione uma opção' });
      return;
    }

    try {
      await submitResponse.mutateAsync({
        survey_id: surveyId,
        experience_rating: formData.experience_rating,
        efficiency_assessment: formData.efficiency_assessment,
        positive_highlight: formData.positive_highlight,
        improvement_area: formData.improvement_area,
        ideas_suggestions: formData.ideas_suggestions,
        respondent_name: formData.respondent_name || null,
      });
      onSubmitted();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-950 via-gray-900 to-gray-950 text-white">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <BarChart3 className="h-6 w-6 text-purple-300" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Sua experiência com a Milennials
          </CardTitle>
          <CardDescription className="text-gray-300 text-base mt-3 leading-relaxed">
            Queremos evoluir continuamente nossa operação, atendimento e resultados.
            Esse formulário leva menos de 1 minuto e sua opinião é essencial para
            melhorarmos sua experiência com a Milennials.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Q1: Experience Rating 1-5 */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-medium">
            Como você avalia sua experiência com a Milennials nos últimos 15 dias? <span className="text-red-600">*</span>
          </Label>
          <div className="mt-4 flex gap-3 justify-center flex-wrap">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setFormData({ ...formData, experience_rating: score })}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all min-w-[80px] ${
                  formData.experience_rating === score
                    ? 'bg-purple-600 border-purple-600 text-white shadow-lg scale-105'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                }`}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: score }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        formData.experience_rating === score
                          ? 'text-yellow-300 fill-yellow-300'
                          : 'text-yellow-500 fill-yellow-500'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium">{EXPERIENCE_LABELS[score]}</span>
              </button>
            ))}
          </div>
          {errors.experience_rating && (
            <p className="text-sm text-red-600 mt-2 text-center">{errors.experience_rating}</p>
          )}
        </CardContent>
      </Card>

      {/* Q2: Efficiency Assessment */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-medium">
            Você sente que estamos sendo rápidos e eficientes nas demandas do dia a dia? <span className="text-red-600">*</span>
          </Label>
          <RadioGroup
            className="mt-4 space-y-3"
            value={formData.efficiency_assessment}
            onValueChange={(value) => setFormData({ ...formData, efficiency_assessment: value as 'sim' | 'parcialmente' | 'nao' })}
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="sim" id="eff-sim" />
              <Label htmlFor="eff-sim" className="font-normal cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="parcialmente" id="eff-parcialmente" />
              <Label htmlFor="eff-parcialmente" className="font-normal cursor-pointer">Parcialmente</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="nao" id="eff-nao" />
              <Label htmlFor="eff-nao" className="font-normal cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
          {errors.efficiency_assessment && (
            <p className="text-sm text-red-600 mt-2">{errors.efficiency_assessment}</p>
          )}
        </CardContent>
      </Card>

      {/* Q3: Positive Highlight */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-medium">
            Qual foi o principal ponto positivo da experiência nesse período?
          </Label>
          <Input
            className="mt-3"
            placeholder="Ex: Atendimento, Agilidade, Criatividade, Resultados, Organização, Comunicação"
            value={formData.positive_highlight}
            onChange={(e) => setFormData({ ...formData, positive_highlight: e.target.value })}
            maxLength={500}
          />
        </CardContent>
      </Card>

      {/* Q4: Improvement Area */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-medium">
            Existe algo que poderíamos melhorar?
          </Label>
          <Input
            className="mt-3"
            placeholder="Sua resposta"
            value={formData.improvement_area}
            onChange={(e) => setFormData({ ...formData, improvement_area: e.target.value })}
            maxLength={500}
          />
        </CardContent>
      </Card>

      {/* Q5: Ideas / Suggestions */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-medium">
            Você teria alguma ideia, sugestão ou iniciativa que gostaria de ver na Milennials?
          </Label>
          <Textarea
            className="mt-3"
            placeholder="Compartilhe suas ideias aqui..."
            value={formData.ideas_suggestions}
            onChange={(e) => setFormData({ ...formData, ideas_suggestions: e.target.value })}
            rows={4}
            maxLength={3000}
          />
        </CardContent>
      </Card>

      {/* Optional Name */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base font-medium">
            Seu nome (opcional)
          </Label>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Se preferir, pode se identificar. Sua resposta continuará sendo tratada com confidencialidade.
          </p>
          <Input
            className="mt-1"
            placeholder="Seu nome"
            value={formData.respondent_name}
            onChange={(e) => setFormData({ ...formData, respondent_name: e.target.value })}
            maxLength={100}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-between items-center">
        <Button
          type="submit"
          size="lg"
          className="bg-purple-600 hover:bg-purple-700"
          disabled={submitResponse.isPending}
        >
          {submitResponse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Enviar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setFormData({
            experience_rating: null,
            efficiency_assessment: '',
            positive_highlight: '',
            improvement_area: '',
            ideas_suggestions: '',
            respondent_name: '',
          })}
        >
          Limpar formulário
        </Button>
      </div>

      {/* Footer */}
      <p className="text-xs text-center text-muted-foreground py-4">
        Pesquisa desenvolvida por Millennials B2B
      </p>
    </form>
  );
}

// ============================================================
// Client NPS Form (existing, preserved)
// ============================================================

function ClientNPSForm({ surveyId, surveyTitle, onSubmitted }: { surveyId: string; surveyTitle: string; onSubmitted: () => void }) {
  const submitResponse = useSubmitNPSResponse();

  const [formData, setFormData] = useState({
    company_name: '',
    nps_score: null as number | null,
    score_reason: '',
    strategies_aligned: '' as 'sim' | 'parcialmente' | 'nao' | '',
    communication_rating: '' as 'excelente' | 'bom' | 'regular' | 'ruim' | 'outro' | '',
    communication_other: '',
    creatives_rating: '' as 'excelente' | 'bom' | 'regular' | 'ruim' | '',
    creatives_represent_brand: '' as 'sim_totalmente' | 'parcialmente' | 'nao' | '',
    improvement_suggestions: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationResult = clientResponseSchema.safeParse({
      ...formData,
      nps_score: formData.nps_score,
      communication_other: formData.communication_other || undefined,
    });

    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    try {
      await submitResponse.mutateAsync({
        survey_id: surveyId,
        company_name: formData.company_name,
        nps_score: formData.nps_score!,
        score_reason: formData.score_reason,
        strategies_aligned: formData.strategies_aligned as 'sim' | 'parcialmente' | 'nao',
        communication_rating: formData.communication_rating as 'excelente' | 'bom' | 'regular' | 'ruim' | 'outro',
        communication_other: formData.communication_other || null,
        creatives_rating: formData.creatives_rating as 'excelente' | 'bom' | 'regular' | 'ruim',
        creatives_represent_brand: formData.creatives_represent_brand as 'sim_totalmente' | 'parcialmente' | 'nao',
        improvement_suggestions: formData.improvement_suggestions,
      });
      onSubmitted();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="text-center border-b">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 className="h-6 w-6 text-purple-600" />
            <CardTitle className="text-2xl text-purple-900">{surveyTitle}</CardTitle>
          </div>
          <CardDescription className="text-base space-y-2">
            <p className="font-medium text-foreground">
              Nosso compromisso é entregar sempre a melhor experiência e os melhores resultados possíveis.
            </p>
            <p>Por isso, queremos te ouvir.</p>
            <p>
              Sua resposta é rápida e muito importante para entendermos o que estamos fazendo bem
              e onde podemos evoluir no nosso trabalho com você.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Tempo estimado de preenchimento ~ 3min
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-red-600">* Indica uma pergunta obrigatória</p>
        </CardContent>
      </Card>

      {/* Company Name */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            Qual o nome da sua empresa? <span className="text-red-600">*</span>
          </Label>
          <Input
            className="mt-3"
            placeholder="Sua resposta"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            maxLength={200}
          />
          {errors.company_name && (
            <p className="text-sm text-red-600 mt-1">{errors.company_name}</p>
          )}
        </CardContent>
      </Card>

      {/* NPS Score */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            Em uma escala de 0 a 10, o quanto você indicaria nossa agência para um amigo ou colega? <span className="text-red-600">*</span>
          </Label>
          <div className="mt-4 flex justify-between gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setFormData({ ...formData, nps_score: score })}
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  formData.nps_score === score
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
          {errors.nps_score && (
            <p className="text-sm text-red-600 mt-2">{errors.nps_score}</p>
          )}
        </CardContent>
      </Card>

      {/* Score Reason */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            Qual foi o principal motivo da nota que você deu? <span className="text-red-600">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Seja o mais sincero(a) possível. <strong>Sua resposta é confidencial</strong> e nos ajuda
            diretamente a entender o que estamos fazendo bem e o que pode melhorar.
          </p>
          <Textarea
            placeholder="Sua resposta"
            value={formData.score_reason}
            onChange={(e) => setFormData({ ...formData, score_reason: e.target.value })}
            rows={4}
            maxLength={2000}
          />
          {errors.score_reason && (
            <p className="text-sm text-red-600 mt-1">{errors.score_reason}</p>
          )}
        </CardContent>
      </Card>

      {/* Strategies Aligned */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            As estratégias de tráfego estão alinhadas com os objetivos do seu negócio hoje? <span className="text-red-600">*</span>
          </Label>
          <RadioGroup
            className="mt-4 space-y-3"
            value={formData.strategies_aligned}
            onValueChange={(value) => setFormData({ ...formData, strategies_aligned: value as 'sim' | 'parcialmente' | 'nao' })}
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="sim" id="strategies-sim" />
              <Label htmlFor="strategies-sim" className="font-normal cursor-pointer">Sim</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="parcialmente" id="strategies-parcialmente" />
              <Label htmlFor="strategies-parcialmente" className="font-normal cursor-pointer">Parcialmente</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="nao" id="strategies-nao" />
              <Label htmlFor="strategies-nao" className="font-normal cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
          {errors.strategies_aligned && (
            <p className="text-sm text-red-600 mt-2">{errors.strategies_aligned}</p>
          )}
        </CardContent>
      </Card>

      {/* Communication Rating */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            Como você avalia nossa comunicação e acompanhamento no dia a dia? <span className="text-red-600">*</span>
          </Label>
          <RadioGroup
            className="mt-4 space-y-3"
            value={formData.communication_rating}
            onValueChange={(value) => setFormData({ ...formData, communication_rating: value as 'excelente' | 'bom' | 'regular' | 'ruim' | 'outro' })}
          >
            {['excelente', 'bom', 'regular', 'ruim'].map((rating) => (
              <div key={rating} className="flex items-center space-x-3">
                <RadioGroupItem value={rating} id={`comm-${rating}`} />
                <Label htmlFor={`comm-${rating}`} className="font-normal cursor-pointer capitalize">
                  {rating === 'excelente' ? 'Excelente' : rating === 'bom' ? 'Bom' : rating === 'regular' ? 'Regular' : 'Ruim'}
                </Label>
              </div>
            ))}
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="outro" id="comm-outro" />
              <Label htmlFor="comm-outro" className="font-normal cursor-pointer">Outro:</Label>
              <Input
                className="flex-1"
                placeholder=""
                value={formData.communication_other}
                onChange={(e) => setFormData({ ...formData, communication_other: e.target.value })}
                maxLength={500}
                disabled={formData.communication_rating !== 'outro'}
              />
            </div>
          </RadioGroup>
          {errors.communication_rating && (
            <p className="text-sm text-red-600 mt-2">{errors.communication_rating}</p>
          )}
        </CardContent>
      </Card>

      {/* Creatives Rating */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            Como você avalia os criativos (vídeos, artes e edições) desenvolvidos para suas campanhas? <span className="text-red-600">*</span>
          </Label>
          <RadioGroup
            className="mt-4 space-y-3"
            value={formData.creatives_rating}
            onValueChange={(value) => setFormData({ ...formData, creatives_rating: value as 'excelente' | 'bom' | 'regular' | 'ruim' })}
          >
            {['excelente', 'bom', 'regular', 'ruim'].map((rating) => (
              <div key={rating} className="flex items-center space-x-3">
                <RadioGroupItem value={rating} id={`creatives-${rating}`} />
                <Label htmlFor={`creatives-${rating}`} className="font-normal cursor-pointer capitalize">
                  {rating === 'excelente' ? 'Excelente' : rating === 'bom' ? 'Bom' : rating === 'regular' ? 'Regular' : 'Ruim'}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {errors.creatives_rating && (
            <p className="text-sm text-red-600 mt-2">{errors.creatives_rating}</p>
          )}
        </CardContent>
      </Card>

      {/* Creatives Represent Brand */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            Os criativos (vídeos, artes e edições) representam bem sua marca e ajudam a gerar resultados? <span className="text-red-600">*</span>
          </Label>
          <RadioGroup
            className="mt-4 space-y-3"
            value={formData.creatives_represent_brand}
            onValueChange={(value) => setFormData({ ...formData, creatives_represent_brand: value as 'sim_totalmente' | 'parcialmente' | 'nao' })}
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="sim_totalmente" id="brand-sim" />
              <Label htmlFor="brand-sim" className="font-normal cursor-pointer">Sim, totalmente</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="parcialmente" id="brand-parcialmente" />
              <Label htmlFor="brand-parcialmente" className="font-normal cursor-pointer">Parcialmente</Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="nao" id="brand-nao" />
              <Label htmlFor="brand-nao" className="font-normal cursor-pointer">Não</Label>
            </div>
          </RadioGroup>
          {errors.creatives_represent_brand && (
            <p className="text-sm text-red-600 mt-2">{errors.creatives_represent_brand}</p>
          )}
        </CardContent>
      </Card>

      {/* Improvement Suggestions */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-base">
            O que podemos melhorar para gerar mais resultados para você? <span className="text-red-600">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Fique à vontade para compartilhar sugestões, pontos de melhoria ou ajustes que
            você acredita que podem gerar mais resultados no seu negócio.
          </p>
          <Textarea
            placeholder="Sua resposta"
            value={formData.improvement_suggestions}
            onChange={(e) => setFormData({ ...formData, improvement_suggestions: e.target.value })}
            rows={4}
            maxLength={2000}
          />
          {errors.improvement_suggestions && (
            <p className="text-sm text-red-600 mt-1">{errors.improvement_suggestions}</p>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-between items-center">
        <Button
          type="submit"
          size="lg"
          className="bg-purple-600 hover:bg-purple-700"
          disabled={submitResponse.isPending}
        >
          {submitResponse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Enviar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setFormData({
            company_name: '',
            nps_score: null,
            score_reason: '',
            strategies_aligned: '',
            communication_rating: '',
            communication_other: '',
            creatives_rating: '',
            creatives_represent_brand: '',
            improvement_suggestions: '',
          })}
        >
          Limpar formulário
        </Button>
      </div>

      {/* Footer */}
      <p className="text-xs text-center text-muted-foreground py-4">
        Pesquisa desenvolvida por Millennials B2B
      </p>
    </form>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function PublicNPSPage() {
  const { token } = useParams<{ token: string }>();
  const { data: survey, isLoading, error } = useNPSSurveyByToken(token || '');
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Pesquisa não encontrada</h1>
            <p className="text-muted-foreground">
              Esta pesquisa não existe ou não está mais disponível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Obrigado!</h1>
            <p className="text-muted-foreground">
              Sua resposta foi enviada com sucesso. Agradecemos o seu feedback!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isTeamSurvey = survey.survey_type === 'team';

  return (
    <div className={`min-h-screen py-8 px-4 ${
      isTeamSurvey
        ? 'bg-gradient-to-b from-gray-950 via-purple-950/20 to-gray-950'
        : 'bg-gradient-to-b from-purple-50 to-white'
    }`}>
      {isTeamSurvey ? (
        <TeamNPSForm surveyId={survey.id} onSubmitted={() => setSubmitted(true)} />
      ) : (
        <ClientNPSForm surveyId={survey.id} surveyTitle={survey.title} onSubmitted={() => setSubmitted(true)} />
      )}
    </div>
  );
}
