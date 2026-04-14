import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  PaddockDiagnosticoFormData,
  PaddockDiagnosticoRecord,
  EMPTY_PADDOCK_FORM,
  useSavePaddockDiagnostico,
} from '@/hooks/usePaddockDiagnostico';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  editing?: PaddockDiagnosticoRecord;
}

// ── Helper: radio de 3 opcoes ──────────────────────────────────────
function Radio3({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={value || ''}
        onValueChange={onChange}
        className="flex gap-4"
      >
        {(['sim', 'parcialmente', 'nao'] as const).map((opt) => (
          <div key={opt} className="flex items-center gap-1.5">
            <RadioGroupItem value={opt} id={`${id}-${opt}`} />
            <Label htmlFor={`${id}-${opt}`} className="cursor-pointer text-sm capitalize">
              {opt === 'nao' ? 'Não' : opt === 'parcialmente' ? 'Parcialmente' : 'Sim'}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function Radio2({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={value || ''}
        onValueChange={onChange}
        className="flex gap-4"
      >
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="sim" id={`${id}-sim`} />
          <Label htmlFor={`${id}-sim`} className="cursor-pointer text-sm">Sim</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="nao" id={`${id}-nao`} />
          <Label htmlFor={`${id}-nao`} className="cursor-pointer text-sm">Não</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

// ── Bloco visual ───────────────────────────────────────────────────
function FormBlock({ title, number, children }: { title: string; number: number; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-4">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 text-xs flex items-center justify-center font-bold">
          {number}
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function PaddockDiagnosticoFormModal({ isOpen, onClose, clientId, clientName, editing }: Props) {
  const { user } = useAuth();
  const saveDiag = useSavePaddockDiagnostico();
  const [form, setForm] = useState<PaddockDiagnosticoFormData>({ ...EMPTY_PADDOCK_FORM });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (editing) {
      const f: any = { ...EMPTY_PADDOCK_FORM };
      for (const key of Object.keys(EMPTY_PADDOCK_FORM)) {
        const val = (editing as any)[key];
        if (val !== undefined && val !== null) {
          f[key] = val;
        }
      }
      setForm(f as PaddockDiagnosticoFormData);
    } else {
      setForm({
        ...EMPTY_PADDOCK_FORM,
        cliente_nome: clientName || '',
        responsavel_diagnostico: user?.name || '',
        data_consultoria: new Date().toISOString().slice(0, 10),
      });
    }
  }, [editing, clientName, user?.name]);

  const set = (field: keyof PaddockDiagnosticoFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    await saveDiag.mutateAsync({
      clientId,
      consultorId: user?.id || '',
      formData: form,
      diagnosticoId: editing?.id,
    });
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 !grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              {editing ? 'Editar Diagnóstico Comercial' : 'Novo Diagnóstico Comercial pós War #2'}
            </DialogTitle>
            <Button onClick={handleSave} disabled={saveDiag.isPending} className="gap-2">
              {saveDiag.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showSuccess ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {showSuccess ? 'Salvo!' : 'Salvar'}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 px-6 py-4">
          <div className="space-y-6 pb-6">
            {/* ── Bloco 0: Informacoes Gerais ── */}
            <FormBlock title="Informações Gerais" number={0}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label className="text-sm">Nome do cliente</Label><Input value={form.cliente_nome} onChange={(e) => set('cliente_nome', e.target.value)} /></div>
                <div><Label className="text-sm">Responsável pelo diagnóstico</Label><Input value={form.responsavel_diagnostico} onChange={(e) => set('responsavel_diagnostico', e.target.value)} /></div>
                <div><Label className="text-sm">Data da consultoria</Label><Input type="date" value={form.data_consultoria} onChange={(e) => set('data_consultoria', e.target.value)} /></div>
              </div>
            </FormBlock>

            {/* ── Bloco 1: Execução Real ── */}
            <FormBlock title="Execução Real (O time fez o que foi ensinado?)" number={1}>
              <div className="space-y-3">
                <Radio3 id="exec_batendo_50" label="O time está batendo pelo menos 50 tentativas de contato por dia?" value={form.exec_batendo_50} onChange={(v) => set('exec_batendo_50', v)} />
                <Radio3 id="exec_consistencia_diaria" label="Existe consistência diária ou os dias variam muito?" value={form.exec_consistencia_diaria} onChange={(v) => set('exec_consistencia_diaria', v)} />
                <Radio3 id="exec_comeca_pelo_crm" label="Os vendedores começam o dia pelo CRM ou por WhatsApp?" value={form.exec_comeca_pelo_crm} onChange={(v) => set('exec_comeca_pelo_crm', v)} />
                <Radio3 id="exec_blocos_ligacao" label="O time está fazendo blocos de ligação sem distração?" value={form.exec_blocos_ligacao} onChange={(v) => set('exec_blocos_ligacao', v)} />
                <Radio2 id="exec_volume_caiu" label="O volume caiu depois da War #2?" value={form.exec_volume_caiu} onChange={(v) => set('exec_volume_caiu', v)} />
                <Radio2 id="exec_alguem_nao_performa" label="Existe alguém no time que não está performando o mínimo?" value={form.exec_alguem_nao_performa} onChange={(v) => set('exec_alguem_nao_performa', v)} />
                <Radio3 id="exec_followup_diario" label="O time executa follow-up todos os dias ou deixa acumular?" value={form.exec_followup_diario} onChange={(v) => set('exec_followup_diario', v)} />
                <Radio2 id="exec_leads_sem_atividade" label="Leads estão ficando sem próxima atividade?" value={form.exec_leads_sem_atividade} onChange={(v) => set('exec_leads_sem_atividade', v)} />
              </div>
            </FormBlock>

            {/* ── Bloco 2: Uso do CRM ── */}
            <FormBlock title="Uso do CRM (Erros Reais)" number={2}>
              <div className="space-y-3">
                <Radio3 id="crm_movimentacao_correta" label="Os leads estão sendo movimentados corretamente no funil?" value={form.crm_movimentacao_correta} onChange={(v) => set('crm_movimentacao_correta', v)} />
                <Radio2 id="crm_leads_parados" label="Existem leads parados em etapas sem atualização?" value={form.crm_leads_parados} onChange={(v) => set('crm_leads_parados', v)} />
                <Radio3 id="crm_registra_interacoes" label="O time registra todas as interações no CRM?" value={form.crm_registra_interacoes} onChange={(v) => set('crm_registra_interacoes', v)} />
                <Radio3 id="crm_historico_completo" label="O histórico dos leads está completo ou vazio?" value={form.crm_historico_completo} onChange={(v) => set('crm_historico_completo', v)} />
                <Radio2 id="crm_whatsapp_fora" label="O time ainda usa WhatsApp por fora do CRM?" value={form.crm_whatsapp_fora} onChange={(v) => set('crm_whatsapp_fora', v)} />
                <Radio2 id="crm_erros_status" label='Existem erros de status (ex: marcar como desqualificado sem falar)?' value={form.crm_erros_status} onChange={(v) => set('crm_erros_status', v)} />
                <Radio3 id="crm_funil_realidade" label="O funil reflete a realidade ou está bagunçado?" value={form.crm_funil_realidade} onChange={(v) => set('crm_funil_realidade', v)} />
                <Radio3 id="crm_gestor_confia" label="O gestor consegue confiar nos dados do CRM?" value={form.crm_gestor_confia} onChange={(v) => set('crm_gestor_confia', v)} />
              </div>
              <div>
                <Label className="text-sm">Qual o principal erro no uso do CRM hoje?</Label>
                <Textarea rows={2} value={form.crm_principal_erro} onChange={(e) => set('crm_principal_erro', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 3: Abordagem Inicial ── */}
            <FormBlock title="Abordagem Inicial (Ligação)" number={3}>
              <div className="space-y-3">
                <Radio3 id="abord_liga_imediatamente" label="O time liga imediatamente quando o lead entra?" value={form.abord_liga_imediatamente} onChange={(v) => set('abord_liga_imediatamente', v)} />
                <Radio3 id="abord_tempo_resposta_5min" label="O tempo de resposta é menor que 5 minutos?" value={form.abord_tempo_resposta_5min} onChange={(v) => set('abord_tempo_resposta_5min', v)} />
                <Radio2 id="abord_comeca_whatsapp" label="Estão começando pelo WhatsApp ao invés de ligar?" value={form.abord_comeca_whatsapp} onChange={(v) => set('abord_comeca_whatsapp', v)} />
                <Radio3 id="abord_ligacoes_frequentes" label="As ligações estão sendo feitas com frequência?" value={form.abord_ligacoes_frequentes} onChange={(v) => set('abord_ligacoes_frequentes', v)} />
                <Radio3 id="abord_seguranca_falar" label="O time tem segurança ao falar ou trava?" value={form.abord_seguranca_falar} onChange={(v) => set('abord_seguranca_falar', v)} />
                <Radio3 id="abord_abertura_estruturada" label="Usam abertura estruturada ou improvisam?" value={form.abord_abertura_estruturada} onChange={(v) => set('abord_abertura_estruturada', v)} />
                <Radio3 id="abord_faz_perguntas" label="Fazem perguntas ou só apresentam solução?" value={form.abord_faz_perguntas} onChange={(v) => set('abord_faz_perguntas', v)} />
                <Radio2 id="abord_fala_mais_que_escuta" label="Falam mais do que escutam?" value={form.abord_fala_mais_que_escuta} onChange={(v) => set('abord_fala_mais_que_escuta', v)} />
              </div>
              <div>
                <Label className="text-sm">O que mais está errado nas ligações hoje?</Label>
                <Textarea rows={2} value={form.abord_erro_ligacoes} onChange={(e) => set('abord_erro_ligacoes', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 4: Qualificação ── */}
            <FormBlock title="Qualificação (SPIN + BANT)" number={4}>
              <div className="space-y-3">
                <Radio3 id="qual_perguntas_cenario" label="O time faz perguntas para entender o cenário do cliente?" value={form.qual_perguntas_cenario} onChange={(v) => set('qual_perguntas_cenario', v)} />
                <Radio3 id="qual_dor_real" label="Identifica dor real ou superficial?" value={form.qual_dor_real} onChange={(v) => set('qual_dor_real', v)} />
                <Radio3 id="qual_fala_decisor" label="Fala com decisor ou com qualquer pessoa?" value={form.qual_fala_decisor} onChange={(v) => set('qual_fala_decisor', v)} />
                <Radio3 id="qual_descobre_orcamento" label="Descobre orçamento ou ignora isso?" value={form.qual_descobre_orcamento} onChange={(v) => set('qual_descobre_orcamento', v)} />
                <Radio3 id="qual_entende_prazo" label="Entende o prazo do cliente?" value={form.qual_entende_prazo} onChange={(v) => set('qual_entende_prazo', v)} />
                <Radio2 id="qual_qualifica_ou_empurra" label="Está qualificando ou empurrando reunião?" value={form.qual_qualifica_ou_empurra} onChange={(v) => set('qual_qualifica_ou_empurra', v)} />
                <Radio2 id="qual_perde_tempo_ruins" label="Está perdendo tempo com leads ruins?" value={form.qual_perde_tempo_ruins} onChange={(v) => set('qual_perde_tempo_ruins', v)} />
                <Radio3 id="qual_diferencia_status" label='Diferencia "não atendeu" de "desqualificado"?' value={form.qual_diferencia_status} onChange={(v) => set('qual_diferencia_status', v)} />
              </div>
              <div>
                <Label className="text-sm">Onde o time mais erra na qualificação?</Label>
                <Textarea rows={2} value={form.qual_erro_qualificacao} onChange={(e) => set('qual_erro_qualificacao', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 5: Follow-up ── */}
            <FormBlock title="Follow-up" number={5}>
              <div className="space-y-3">
                <Radio3 id="follow_5_tentativas" label="O time faz pelo menos 5 tentativas por lead?" value={form.follow_5_tentativas} onChange={(v) => set('follow_5_tentativas', v)} />
                <Radio3 id="follow_multicanal" label="Usa mais de um canal (ligação + WhatsApp)?" value={form.follow_multicanal} onChange={(v) => set('follow_multicanal', v)} />
                <Radio3 id="follow_personalizado" label="Os follow-ups são personalizados ou genéricos?" value={form.follow_personalizado} onChange={(v) => set('follow_personalizado', v)} />
                <Radio2 id="follow_desiste_rapido" label="O time desiste rápido dos leads?" value={form.follow_desiste_rapido} onChange={(v) => set('follow_desiste_rapido', v)} />
                <Radio3 id="follow_padrao_dias" label="Existe padrão de dias (1,2,4,7,14)?" value={form.follow_padrao_dias} onChange={(v) => set('follow_padrao_dias', v)} />
                <Radio3 id="follow_revisita_antigos" label="Leads antigos estão sendo revisitados?" value={form.follow_revisita_antigos} onChange={(v) => set('follow_revisita_antigos', v)} />
                <Radio3 id="follow_registra_crm" label="O time registra follow-up no CRM?" value={form.follow_registra_crm} onChange={(v) => set('follow_registra_crm', v)} />
                <Radio3 id="follow_disciplina" label="Existe disciplina ou depende do vendedor?" value={form.follow_disciplina} onChange={(v) => set('follow_disciplina', v)} />
              </div>
              <div>
                <Label className="text-sm">Qual o maior erro no follow-up hoje?</Label>
                <Textarea rows={2} value={form.follow_erro_followup} onChange={(e) => set('follow_erro_followup', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 6: Conversão ── */}
            <FormBlock title="Conversão" number={6}>
              <div className="space-y-3">
                <Radio3 id="conv_agenda_reunioes" label="O time está conseguindo agendar reuniões?" value={form.conv_agenda_reunioes} onChange={(v) => set('conv_agenda_reunioes', v)} />
                <Radio3 id="conv_reunioes_qualificadas" label="As reuniões estão sendo qualificadas ou ruins?" value={form.conv_reunioes_qualificadas} onChange={(v) => set('conv_reunioes_qualificadas', v)} />
                <Radio2 id="conv_leads_somem" label="Leads somem depois do primeiro contato?" value={form.conv_leads_somem} onChange={(v) => set('conv_leads_somem', v)} />
                <Radio2 id="conv_objecao_recorrente" label="Existe objeção recorrente travando avanço?" value={form.conv_objecao_recorrente} onChange={(v) => set('conv_objecao_recorrente', v)} />
                <Radio3 id="conv_conduz_conversa" label="O time sabe conduzir a conversa?" value={form.conv_conduz_conversa} onChange={(v) => set('conv_conduz_conversa', v)} />
                <Radio3 id="conv_valor_ou_preco" label="O lead entende valor ou só preço?" value={form.conv_valor_ou_preco} onChange={(v) => set('conv_valor_ou_preco', v)} />
                <Radio2 id="conv_quebra_expectativa" label="Existe quebra de expectativa entre marketing e vendas?" value={form.conv_quebra_expectativa} onChange={(v) => set('conv_quebra_expectativa', v)} />
                <Radio3 id="conv_inicio_ou_fechamento" label="O problema está mais no início ou no fechamento?" value={form.conv_inicio_ou_fechamento} onChange={(v) => set('conv_inicio_ou_fechamento', v)} />
              </div>
              <div>
                <Label className="text-sm">Onde mais está travando a conversão?</Label>
                <Textarea rows={2} value={form.conv_erro_conversao} onChange={(e) => set('conv_erro_conversao', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 7: Disciplina e Rotina ── */}
            <FormBlock title="Disciplina e Rotina" number={7}>
              <div className="space-y-3">
                <Radio3 id="disc_rotina_clara" label="O time segue rotina diária clara?" value={form.disc_rotina_clara} onChange={(v) => set('disc_rotina_clara', v)} />
                <Radio3 id="disc_metas_individuais" label="Existe controle de metas individuais?" value={form.disc_metas_individuais} onChange={(v) => set('disc_metas_individuais', v)} />
                <Radio3 id="disc_mede_desempenho" label="O time mede o próprio desempenho?" value={form.disc_mede_desempenho} onChange={(v) => set('disc_mede_desempenho', v)} />
                <Radio3 id="disc_cobranca_gestor" label="Existe cobrança real do gestor?" value={form.disc_cobranca_gestor} onChange={(v) => set('disc_cobranca_gestor', v)} />
                <Radio3 id="disc_executa_sem_motivacao" label="O time executa mesmo sem motivação?" value={form.disc_executa_sem_motivacao} onChange={(v) => set('disc_executa_sem_motivacao', v)} />
                <Radio3 id="disc_consistencia" label="Existe consistência ou picos de esforço?" value={form.disc_consistencia} onChange={(v) => set('disc_consistencia', v)} />
                <Radio3 id="disc_sabe_o_que_fazer" label="O time sabe exatamente o que fazer todo dia?" value={form.disc_sabe_o_que_fazer} onChange={(v) => set('disc_sabe_o_que_fazer', v)} />
                <Radio3 id="disc_organizacao" label="Existe organização ou caos?" value={form.disc_organizacao} onChange={(v) => set('disc_organizacao', v)} />
              </div>
              <div>
                <Label className="text-sm">O que mais falta na rotina do time?</Label>
                <Textarea rows={2} value={form.disc_falta_rotina} onChange={(e) => set('disc_falta_rotina', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 8: Erros Críticos ── */}
            <FormBlock title="Erros Críticos (Baseado na War #2)" number={8}>
              <div className="space-y-3">
                <Radio2 id="erro_liga_pouco" label="O time ainda liga pouco?" value={form.erro_liga_pouco} onChange={(v) => set('erro_liga_pouco', v)} />
                <Radio2 id="erro_comeca_whatsapp" label="Ainda começa pelo WhatsApp?" value={form.erro_comeca_whatsapp} onChange={(v) => set('erro_comeca_whatsapp', v)} />
                <Radio2 id="erro_nao_registra" label="Não registra no CRM?" value={form.erro_nao_registra} onChange={(v) => set('erro_nao_registra', v)} />
                <Radio2 id="erro_fala_mais" label="Fala mais do que ouve?" value={form.erro_fala_mais} onChange={(v) => set('erro_fala_mais', v)} />
                <Radio2 id="erro_nao_investiga" label="Não investiga a dor?" value={form.erro_nao_investiga} onChange={(v) => set('erro_nao_investiga', v)} />
                <Radio2 id="erro_aceita_nao" label='Aceita "não tenho interesse" sem explorar?' value={form.erro_aceita_nao} onChange={(v) => set('erro_aceita_nao', v)} />
                <Radio2 id="erro_nao_agenda" label="Não agenda próximo passo?" value={form.erro_nao_agenda} onChange={(v) => set('erro_nao_agenda', v)} />
                <Radio2 id="erro_nao_segue" label="Não segue processo?" value={form.erro_nao_segue} onChange={(v) => set('erro_nao_segue', v)} />
              </div>
              <div>
                <Label className="text-sm">Qual erro mais está prejudicando o resultado hoje?</Label>
                <Textarea rows={2} value={form.erro_mais_prejudica} onChange={(e) => set('erro_mais_prejudica', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 9: Evolução Real ── */}
            <FormBlock title="Evolução Real Pós Treinamento" number={9}>
              <div className="space-y-3">
                <Radio3 id="evol_melhorou" label="O time melhorou depois da War #2?" value={form.evol_melhorou} onChange={(v) => set('evol_melhorou', v)} />
                <Radio3 id="evol_gestor_percebe" label="O gestor percebe evolução real?" value={form.evol_gestor_percebe} onChange={(v) => set('evol_gestor_percebe', v)} />
                <Radio3 id="evol_aplicou" label="O time aplicou o que foi ensinado?" value={form.evol_aplicou} onChange={(v) => set('evol_aplicou', v)} />
                <Radio3 id="evol_aumento_reunioes" label="Houve aumento de reuniões?" value={form.evol_aumento_reunioes} onChange={(v) => set('evol_aumento_reunioes', v)} />
                <Radio3 id="evol_qualidade_leads" label="Houve melhora na qualidade dos leads?" value={form.evol_qualidade_leads} onChange={(v) => set('evol_qualidade_leads', v)} />
                <Radio3 id="evol_mais_organizado" label="O time está mais organizado?" value={form.evol_mais_organizado} onChange={(v) => set('evol_mais_organizado', v)} />
                <Radio3 id="evol_crm_limpo" label="O CRM está mais limpo?" value={form.evol_crm_limpo} onChange={(v) => set('evol_crm_limpo', v)} />
                <Radio3 id="evol_processo_claro" label="O processo está mais claro?" value={form.evol_processo_claro} onChange={(v) => set('evol_processo_claro', v)} />
              </div>
              <div className="space-y-4">
                <div><Label className="text-sm font-medium">O que melhorou após a War #2?</Label><Textarea rows={3} value={form.evol_o_que_melhorou} onChange={(e) => set('evol_o_que_melhorou', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">O que NÃO melhorou?</Label><Textarea rows={3} value={form.evol_o_que_nao_melhorou} onChange={(e) => set('evol_o_que_nao_melhorou', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">Top 3 gargalos atuais</Label><Textarea rows={3} value={form.evol_top3_gargalos} onChange={(e) => set('evol_top3_gargalos', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">Top 3 ações imediatas</Label><Textarea rows={3} value={form.evol_top3_acoes} onChange={(e) => set('evol_top3_acoes', e.target.value)} /></div>
              </div>
            </FormBlock>

            {/* Botao salvar no rodape */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saveDiag.isPending} size="lg" className="gap-2">
                {saveDiag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'Atualizar Diagnóstico' : 'Salvar Diagnóstico'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
