import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ExternalLink, Swords, BookOpen, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  clientId?: string;
}

const PERGUNTAS_ALINHAMENTO: { key: string; label: string; placeholder?: string }[] = [
  { key: 'q1', label: 'Quantas pessoas atuam diretamente em vendas?' },
  { key: 'q2', label: 'O time é composto por vendedores internos (CLT), representantes externos, ambos?' },
  { key: 'q3', label: 'Existe o papel de um líder/gerente/coordenador do time de vendas?' },
  { key: 'q4', label: 'Qual o tempo médio de casa da equipe comercial?' },
  { key: 'q5', label: 'Qual o valor médio de uma venda (R$)?' },
  { key: 'q6', label: 'Tem um produto/serviço estrela que representa boa parte do faturamento?' },
  { key: 'q7', label: 'Quantos novos contratos/clientes entram por mês, em média?' },
  { key: 'q8', label: 'Qual o faturamento médio mensal da operação comercial?' },
  { key: 'q9', label: 'Utilizam algum CRM atualmente? Se sim, qual?' },
];

type AlinhamentoData = Record<string, string>;

function emptyAnswers(): AlinhamentoData {
  return Object.fromEntries(PERGUNTAS_ALINHAMENTO.map(p => [p.key, '']));
}

export default function WarRoomSection({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [openAlinhamento, setOpenAlinhamento] = useState(false);
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [open3, setOpen3] = useState(false);
  const [answers, setAnswers] = useState<AlinhamentoData>(emptyAnswers());

  const { data: stored } = useQuery({
    queryKey: ['client-alinhamento-inicial', clientId],
    queryFn: async (): Promise<AlinhamentoData | null> => {
      if (!clientId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('clients')
        .select('alinhamento_inicial')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return (data?.alinhamento_inicial ?? null) as AlinhamentoData | null;
    },
    enabled: !!clientId,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (stored) {
      setAnswers({ ...emptyAnswers(), ...stored });
    }
  }, [stored]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('clientId obrigatório');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('clients')
        .update({ alinhamento_inicial: answers })
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Alinhamento inicial salvo');
      queryClient.invalidateQueries({ queryKey: ['client-alinhamento-inicial', clientId] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar', { description: err.message });
    },
  });

  const filledCount = PERGUNTAS_ALINHAMENTO.filter(p => (answers[p.key] || '').trim().length > 0).length;
  const allFilled = filledCount === PERGUNTAS_ALINHAMENTO.length;

  return (
    <div className="space-y-4">
      <Separator />

      <div className="flex items-center gap-2">
        <Swords size={18} className="text-primary" />
        <h3 className="text-base font-semibold">Condução das War Rooms</h3>
      </div>

      {/* ALINHAMENTO INICIAL — em cima de WAR #1 */}
      <div className="border-l-4 border-violet-500 rounded-lg bg-card shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setOpenAlinhamento(!openAlinhamento)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-violet-500 text-violet-500">
              ETAPA INICIAL
            </Badge>
            <span className="font-medium text-sm">ALINHAMENTO INICIAL</span>
            {clientId && filledCount > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 ml-2',
                  allFilled
                    ? 'border-success/50 text-success'
                    : 'border-warning/40 text-warning',
                )}
              >
                {allFilled ? <CheckCircle2 size={10} className="mr-1" /> : null}
                {filledCount}/{PERGUNTAS_ALINHAMENTO.length}
              </Badge>
            )}
          </div>
          <span className="text-muted-foreground text-xs">{openAlinhamento ? '▲' : '▼'}</span>
        </button>

        {openAlinhamento && (
          <div className="px-4 pb-4 space-y-4 text-sm">
            <div className="space-y-1.5 text-muted-foreground">
              <p className="font-medium text-foreground">Condução Alinhamento inicial:</p>
              <p>• Recepção e Objetivo da reunião.</p>
              <p>• Alinhamento: O que falaremos nessa reunião.</p>
            </div>

            <Separator />

            {!clientId && (
              <p className="text-xs text-muted-foreground italic">
                Abra esta seção dentro do card de um cliente para preencher e salvar as respostas.
              </p>
            )}

            {clientId && (
              <div className="space-y-3">
                {PERGUNTAS_ALINHAMENTO.map((p, idx) => (
                  <div key={p.key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground leading-relaxed">
                      <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                      {p.label}
                    </Label>
                    <Textarea
                      rows={2}
                      value={answers[p.key] || ''}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [p.key]: e.target.value }))}
                      placeholder={p.placeholder || 'Resposta…'}
                      className="resize-none text-sm"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="gap-1.5"
                  >
                    <Save size={14} />
                    {saveMutation.isPending ? 'Salvando…' : 'Salvar Alinhamento inicial'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WAR #1 */}
      <div className="border-l-4 border-blue-500 rounded-lg bg-card shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setOpen1(!open1)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-blue-500 text-blue-500">
              WAR #1
            </Badge>
            <span className="font-medium text-sm">CONDUÇÃO WAR #1</span>
          </div>
          <span className="text-muted-foreground text-xs">{open1 ? '▲' : '▼'}</span>
        </button>

        {open1 && (
          <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">
            <p>• Recepção e Objetivo da reunião.</p>
            <p>• Alinhamento: O que é uma War #1</p>
            <p className="leading-relaxed">
              A war #1 é a primeira call comercial com o cliente, somente com os líderes, com o foco
              de entender os problemas, fortalezas e otimizar o desempenho comercial desde o
              primeiro dia.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span>Iniciar diagnóstico comercial WAR #1 no link:</span>
              <a
                href="https://paddockmilennials.lovable.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 underline underline-offset-2"
              >
                paddockmilennials.lovable.app
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* WAR #2 */}
      <div className="border-l-4 border-amber-500 rounded-lg bg-card shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setOpen2(!open2)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-500 text-amber-500">
              WAR #2
            </Badge>
            <span className="font-medium text-sm">CONDUÇÃO WAR #2</span>
          </div>
          <span className="text-muted-foreground text-xs">{open2 ? '▲' : '▼'}</span>
        </button>

        {open2 && (
          <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">
            <p>
              A War Room #2 é o treinamento completo para SDRs — CRM, técnicas de vendas, scripts
              e rotina diária de prospecção.
            </p>
            <Button
              variant="outline"
              className="gap-2 border-amber-500 text-amber-500 hover:bg-amber-500/10"
              onClick={() => window.open('/war-room-2', '_blank')}
            >
              <BookOpen size={16} />
              Abrir Treinamento WAR #2
              <ExternalLink size={14} />
            </Button>
          </div>
        )}
      </div>

      {/* WAR #3 */}
      <div className="border-l-4 border-emerald-500 rounded-lg bg-card shadow-sm">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setOpen3(!open3)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2 py-0.5 border-emerald-500 text-emerald-500">
              WAR #3
            </Badge>
            <span className="font-medium text-sm">CONDUÇAO WAR #3</span>
          </div>
          <span className="text-muted-foreground text-xs">{open3 ? '▲' : '▼'}</span>
        </button>

        {open3 && (
          <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground">
            <p>
              A War Room #3 é a sessão de feedback ao vivo — análise do CRM, dúvidas da equipe e
              direcionamento dos próximos passos.
            </p>
            <Button
              variant="outline"
              className="gap-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500/10"
              onClick={() => window.open('/war-room-3', '_blank')}
            >
              <BookOpen size={16} />
              Abrir Treinamento WAR #3
              <ExternalLink size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
