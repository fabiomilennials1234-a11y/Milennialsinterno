import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNPSSurveyByToken, useSubmitNPSResponse } from '@/hooks/useNPSSurveys';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';

const responseSchema = z.object({
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

export default function PublicNPSPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: survey, isLoading, error } = useNPSSurveyByToken(token || '');
  const submitResponse = useSubmitNPSResponse();
  
  const [submitted, setSubmitted] = useState(false);
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

    const validationResult = responseSchema.safeParse({
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

    if (!survey) return;

    try {
      await submitResponse.mutateAsync({
        survey_id: survey.id,
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
      setSubmitted(true);
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-8 px-4">
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BarChart3 className="h-6 w-6 text-purple-600" />
              <CardTitle className="text-2xl text-purple-900">{survey.title}</CardTitle>
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
              onValueChange={(value) => setFormData({ ...formData, strategies_aligned: value as any })}
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
              onValueChange={(value) => setFormData({ ...formData, communication_rating: value as any })}
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
              onValueChange={(value) => setFormData({ ...formData, creatives_rating: value as any })}
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
              onValueChange={(value) => setFormData({ ...formData, creatives_represent_brand: value as any })}
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
    </div>
  );
}
