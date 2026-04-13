import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DiagnosticoFormData,
  DiagnosticoRecord,
  EMPTY_FORM,
  useSaveDiagnostico,
} from '@/hooks/useMktplaceDiagnostico';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  editing?: DiagnosticoRecord;
}

// ── Helper: radio de 3 opções ──────────────────────────────────────
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
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
          {number}
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
}

export default function DiagnosticoFormModal({ isOpen, onClose, clientId, clientName, editing }: Props) {
  const { user } = useAuth();
  const saveDiag = useSaveDiagnostico();
  const [form, setForm] = useState<DiagnosticoFormData>({ ...EMPTY_FORM });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        cliente_nome: editing.cliente_nome || '',
        responsavel_diagnostico: editing.responsavel_diagnostico || '',
        data_consultoria: editing.data_consultoria || '',
        marketplace_principal: editing.marketplace_principal || '',
        outros_marketplaces: editing.outros_marketplaces || '',
        categoria_principal: editing.categoria_principal || '',
        ticket_medio: editing.ticket_medio != null ? String(editing.ticket_medio) : '',
        quantidade_skus: editing.quantidade_skus != null ? String(editing.quantidade_skus) : '',
        faturamento_atual: editing.faturamento_atual != null ? String(editing.faturamento_atual) : '',
        meta_faturamento: editing.meta_faturamento != null ? String(editing.meta_faturamento) : '',
        observacoes_gerais: editing.observacoes_gerais || '',
        operacao_organizada: editing.operacao_organizada as any,
        responsavel_interno: editing.responsavel_interno as any,
        responde_rapido: editing.responde_rapido as any,
        rotina_metricas: editing.rotina_metricas as any,
        depende_uma_pessoa: editing.depende_uma_pessoa as any,
        processo_claro: editing.processo_claro as any,
        obs_estrutura: editing.obs_estrutura || '',
        titulos_bons: editing.titulos_bons as any,
        descricoes_boas: editing.descricoes_boas as any,
        imagens_profissionais: editing.imagens_profissionais as any,
        padronizacao_visual: editing.padronizacao_visual as any,
        ficha_tecnica_completa: editing.ficha_tecnica_completa as any,
        cadastro_fraco: editing.cadastro_fraco as any,
        diferenciais_claros: editing.diferenciais_claros as any,
        obs_anuncios: editing.obs_anuncios || '',
        precos_competitivos: editing.precos_competitivos as any,
        entende_margem: editing.entende_margem as any,
        estrategia_precificacao: editing.estrategia_precificacao as any,
        acompanha_concorrentes: editing.acompanha_concorrentes as any,
        frete_impacta: editing.frete_impacta as any,
        obs_preco: editing.obs_preco || '',
        estoque_sincronizado: editing.estoque_sincronizado as any,
        ruptura_frequente: editing.ruptura_frequente as any,
        prazo_envio_bom: editing.prazo_envio_bom as any,
        logistica_prejudica: editing.logistica_prejudica as any,
        cancelamentos_falha: editing.cancelamentos_falha as any,
        obs_estoque: editing.obs_estoque || '',
        conversao_saudavel: editing.conversao_saudavel as any,
        acompanha_metricas_conv: editing.acompanha_metricas_conv as any,
        produtos_visita_convertem: editing.produtos_visita_convertem as any,
        potencial_mal_aproveitado: editing.potencial_mal_aproveitado as any,
        otimizacao_continua: editing.otimizacao_continua as any,
        obs_conversao: editing.obs_conversao || '',
        reputacao_saudavel: editing.reputacao_saudavel as any,
        atendimento_bom: editing.atendimento_bom as any,
        tempo_resposta_adequado: editing.tempo_resposta_adequado as any,
        muitas_reclamacoes: editing.muitas_reclamacoes as any,
        obs_reputacao: editing.obs_reputacao || '',
        usa_midia_paga: editing.usa_midia_paga as any,
        midia_estrategica: editing.midia_estrategica as any,
        estrategia_crescimento: editing.estrategia_crescimento as any,
        priorizacao_potencial: editing.priorizacao_potencial as any,
        plano_escalar: editing.plano_escalar as any,
        obs_crescimento: editing.obs_crescimento || '',
        principais_gargalos: editing.principais_gargalos || '',
        principais_oportunidades: editing.principais_oportunidades || '',
        corrigir_imediatamente: editing.corrigir_imediatamente || '',
        melhorar_medio_prazo: editing.melhorar_medio_prazo || '',
        gerar_faturamento_rapido: editing.gerar_faturamento_rapido || '',
        observacoes_finais: editing.observacoes_finais || '',
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        cliente_nome: clientName || '',
        responsavel_diagnostico: user?.name || '',
        data_consultoria: new Date().toISOString().slice(0, 10),
      });
    }
  }, [editing, clientName, user?.name]);

  const set = (field: keyof DiagnosticoFormData, value: any) => {
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
              {editing ? 'Editar Diagnóstico' : 'Novo Diagnóstico de MKT Place'}
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
            {/* ── Bloco 1: Informações Gerais ── */}
            <FormBlock title="Informações Gerais" number={1}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label className="text-sm">Nome do cliente</Label><Input value={form.cliente_nome} onChange={(e) => set('cliente_nome', e.target.value)} /></div>
                <div><Label className="text-sm">Responsável pelo diagnóstico</Label><Input value={form.responsavel_diagnostico} onChange={(e) => set('responsavel_diagnostico', e.target.value)} /></div>
                <div><Label className="text-sm">Data da consultoria</Label><Input type="date" value={form.data_consultoria} onChange={(e) => set('data_consultoria', e.target.value)} /></div>
                <div><Label className="text-sm">Marketplace principal</Label><Input placeholder="Ex: Mercado Livre, Amazon, Shopee..." value={form.marketplace_principal} onChange={(e) => set('marketplace_principal', e.target.value)} /></div>
                <div><Label className="text-sm">Outros marketplaces</Label><Input placeholder="Ex: Shopee, Magalu..." value={form.outros_marketplaces} onChange={(e) => set('outros_marketplaces', e.target.value)} /></div>
                <div><Label className="text-sm">Categoria principal</Label><Input value={form.categoria_principal} onChange={(e) => set('categoria_principal', e.target.value)} /></div>
                <div><Label className="text-sm">Ticket médio (R$)</Label><Input type="number" value={form.ticket_medio} onChange={(e) => set('ticket_medio', e.target.value)} /></div>
                <div><Label className="text-sm">Quantidade aprox. de SKUs</Label><Input type="number" value={form.quantidade_skus} onChange={(e) => set('quantidade_skus', e.target.value)} /></div>
                <div><Label className="text-sm">Faturamento atual (R$)</Label><Input type="number" value={form.faturamento_atual} onChange={(e) => set('faturamento_atual', e.target.value)} /></div>
                <div><Label className="text-sm">Meta de faturamento (R$)</Label><Input type="number" value={form.meta_faturamento} onChange={(e) => set('meta_faturamento', e.target.value)} /></div>
              </div>
              <div>
                <Label className="text-sm">Observações gerais da consultoria</Label>
                <Textarea rows={3} value={form.observacoes_gerais} onChange={(e) => set('observacoes_gerais', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 2: Estrutura da Operação ── */}
            <FormBlock title="Estrutura da Operação" number={2}>
              <div className="space-y-3">
                <Radio3 id="operacao_organizada" label="O cliente possui operação organizada no marketplace?" value={form.operacao_organizada} onChange={(v) => set('operacao_organizada', v)} />
                <Radio2 id="responsavel_interno" label="Existe responsável interno pela operação?" value={form.responsavel_interno} onChange={(v) => set('responsavel_interno', v)} />
                <Radio3 id="responde_rapido" label="O cliente responde rápido às demandas do marketplace?" value={form.responde_rapido} onChange={(v) => set('responde_rapido', v)} />
                <Radio3 id="rotina_metricas" label="O cliente tem rotina de acompanhamento de métricas?" value={form.rotina_metricas} onChange={(v) => set('rotina_metricas', v)} />
                <Radio2 id="depende_uma_pessoa" label="A operação depende de apenas uma pessoa?" value={form.depende_uma_pessoa} onChange={(v) => set('depende_uma_pessoa', v)} />
                <Radio3 id="processo_claro" label="Existe processo claro para cadastro, preço, estoque e atendimento?" value={form.processo_claro} onChange={(v) => set('processo_claro', v)} />
              </div>
              <div>
                <Label className="text-sm">Observações da estrutura da operação</Label>
                <Textarea rows={2} value={form.obs_estrutura} onChange={(e) => set('obs_estrutura', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 3: Cadastro e Qualidade dos Anúncios ── */}
            <FormBlock title="Cadastro e Qualidade dos Anúncios" number={3}>
              <div className="space-y-3">
                <Radio3 id="titulos_bons" label="Os títulos dos anúncios estão bons?" value={form.titulos_bons} onChange={(v) => set('titulos_bons', v)} />
                <Radio3 id="descricoes_boas" label="As descrições estão boas e persuasivas?" value={form.descricoes_boas} onChange={(v) => set('descricoes_boas', v)} />
                <Radio3 id="imagens_profissionais" label="As imagens estão profissionais?" value={form.imagens_profissionais} onChange={(v) => set('imagens_profissionais', v)} />
                <Radio3 id="padronizacao_visual" label="Os anúncios têm boa padronização visual?" value={form.padronizacao_visual} onChange={(v) => set('padronizacao_visual', v)} />
                <Radio3 id="ficha_tecnica_completa" label="Os produtos têm ficha técnica completa?" value={form.ficha_tecnica_completa} onChange={(v) => set('ficha_tecnica_completa', v)} />
                <Radio2 id="cadastro_fraco" label="Há produtos com cadastro fraco ou incompleto?" value={form.cadastro_fraco} onChange={(v) => set('cadastro_fraco', v)} />
                <Radio3 id="diferenciais_claros" label="Os anúncios têm diferenciais competitivos claros?" value={form.diferenciais_claros} onChange={(v) => set('diferenciais_claros', v)} />
              </div>
              <div>
                <Label className="text-sm">Principais problemas encontrados nos anúncios</Label>
                <Textarea rows={2} value={form.obs_anuncios} onChange={(e) => set('obs_anuncios', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 4: Preço e Competitividade ── */}
            <FormBlock title="Preço e Competitividade" number={4}>
              <div className="space-y-3">
                <Radio3 id="precos_competitivos" label="Os preços estão competitivos?" value={form.precos_competitivos} onChange={(v) => set('precos_competitivos', v)} />
                <Radio3 id="entende_margem" label="O cliente entende a margem por produto?" value={form.entende_margem} onChange={(v) => set('entende_margem', v)} />
                <Radio3 id="estrategia_precificacao" label="Existe estratégia de precificação?" value={form.estrategia_precificacao} onChange={(v) => set('estrategia_precificacao', v)} />
                <Radio3 id="acompanha_concorrentes" label="O cliente acompanha concorrentes?" value={form.acompanha_concorrentes} onChange={(v) => set('acompanha_concorrentes', v)} />
                <Radio3 id="frete_impacta" label="O frete impacta negativamente a conversão?" value={form.frete_impacta} onChange={(v) => set('frete_impacta', v)} />
              </div>
              <div>
                <Label className="text-sm">Observações sobre preço e competitividade</Label>
                <Textarea rows={2} value={form.obs_preco} onChange={(e) => set('obs_preco', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 5: Estoque e Logística ── */}
            <FormBlock title="Estoque e Logística" number={5}>
              <div className="space-y-3">
                <Radio3 id="estoque_sincronizado" label="O estoque está sincronizado corretamente?" value={form.estoque_sincronizado} onChange={(v) => set('estoque_sincronizado', v)} />
                <Radio2 id="ruptura_frequente" label="Há ruptura de estoque frequente?" value={form.ruptura_frequente} onChange={(v) => set('ruptura_frequente', v)} />
                <Radio3 id="prazo_envio_bom" label="O prazo de envio está bom?" value={form.prazo_envio_bom} onChange={(v) => set('prazo_envio_bom', v)} />
                <Radio3 id="logistica_prejudica" label="A logística está prejudicando a reputação?" value={form.logistica_prejudica} onChange={(v) => set('logistica_prejudica', v)} />
                <Radio3 id="cancelamentos_falha" label="Há cancelamentos por falha operacional?" value={form.cancelamentos_falha} onChange={(v) => set('cancelamentos_falha', v)} />
              </div>
              <div>
                <Label className="text-sm">Observações sobre estoque e logística</Label>
                <Textarea rows={2} value={form.obs_estoque} onChange={(e) => set('obs_estoque', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 6: Conversão e Performance ── */}
            <FormBlock title="Conversão e Performance" number={6}>
              <div className="space-y-3">
                <Radio3 id="conversao_saudavel" label="A taxa de conversão está saudável?" value={form.conversao_saudavel} onChange={(v) => set('conversao_saudavel', v)} />
                <Radio3 id="acompanha_metricas_conv" label="O cliente acompanha visitas, cliques e conversão?" value={form.acompanha_metricas_conv} onChange={(v) => set('acompanha_metricas_conv', v)} />
                <Radio3 id="produtos_visita_convertem" label="Os produtos com mais visita convertem bem?" value={form.produtos_visita_convertem} onChange={(v) => set('produtos_visita_convertem', v)} />
                <Radio2 id="potencial_mal_aproveitado" label="Há produtos com potencial mal aproveitado?" value={form.potencial_mal_aproveitado} onChange={(v) => set('potencial_mal_aproveitado', v)} />
                <Radio3 id="otimizacao_continua" label="Existe estratégia de otimização contínua?" value={form.otimizacao_continua} onChange={(v) => set('otimizacao_continua', v)} />
              </div>
              <div>
                <Label className="text-sm">Observações sobre conversão e performance</Label>
                <Textarea rows={2} value={form.obs_conversao} onChange={(e) => set('obs_conversao', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 7: Reputação e Atendimento ── */}
            <FormBlock title="Reputação e Atendimento" number={7}>
              <div className="space-y-3">
                <Radio3 id="reputacao_saudavel" label="A reputação da conta está saudável?" value={form.reputacao_saudavel} onChange={(v) => set('reputacao_saudavel', v)} />
                <Radio3 id="atendimento_bom" label="O atendimento ao cliente está bom?" value={form.atendimento_bom} onChange={(v) => set('atendimento_bom', v)} />
                <Radio3 id="tempo_resposta_adequado" label="O tempo de resposta está adequado?" value={form.tempo_resposta_adequado} onChange={(v) => set('tempo_resposta_adequado', v)} />
                <Radio3 id="muitas_reclamacoes" label="Há muitas reclamações, devoluções ou avaliações ruins?" value={form.muitas_reclamacoes} onChange={(v) => set('muitas_reclamacoes', v)} />
              </div>
              <div>
                <Label className="text-sm">Observações sobre reputação e atendimento</Label>
                <Textarea rows={2} value={form.obs_reputacao} onChange={(e) => set('obs_reputacao', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 8: Tráfego e Crescimento ── */}
            <FormBlock title="Tráfego e Crescimento" number={8}>
              <div className="space-y-3">
                <Radio2 id="usa_midia_paga" label="O cliente utiliza mídia paga no marketplace?" value={form.usa_midia_paga} onChange={(v) => set('usa_midia_paga', v)} />
                <Radio3 id="midia_estrategica" label="Utiliza mídia paga de forma estratégica?" value={form.midia_estrategica} onChange={(v) => set('midia_estrategica', v)} />
                <Radio3 id="estrategia_crescimento" label="Existe estratégia de crescimento dos produtos principais?" value={form.estrategia_crescimento} onChange={(v) => set('estrategia_crescimento', v)} />
                <Radio3 id="priorizacao_potencial" label="Existe priorização dos produtos com mais potencial?" value={form.priorizacao_potencial} onChange={(v) => set('priorizacao_potencial', v)} />
                <Radio3 id="plano_escalar" label="Há plano claro para escalar faturamento?" value={form.plano_escalar} onChange={(v) => set('plano_escalar', v)} />
              </div>
              <div>
                <Label className="text-sm">Observações sobre crescimento</Label>
                <Textarea rows={2} value={form.obs_crescimento} onChange={(e) => set('obs_crescimento', e.target.value)} />
              </div>
            </FormBlock>

            {/* ── Bloco 9: Prioridades ── */}
            <FormBlock title="Prioridades Definidas na Consultoria" number={9}>
              <div className="space-y-4">
                <div><Label className="text-sm font-medium">Principais gargalos encontrados</Label><Textarea rows={3} value={form.principais_gargalos} onChange={(e) => set('principais_gargalos', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">Principais oportunidades encontradas</Label><Textarea rows={3} value={form.principais_oportunidades} onChange={(e) => set('principais_oportunidades', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">O que deve ser corrigido imediatamente</Label><Textarea rows={3} value={form.corrigir_imediatamente} onChange={(e) => set('corrigir_imediatamente', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">O que pode ser melhorado no médio prazo</Label><Textarea rows={3} value={form.melhorar_medio_prazo} onChange={(e) => set('melhorar_medio_prazo', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">O que pode gerar mais faturamento rápido</Label><Textarea rows={3} value={form.gerar_faturamento_rapido} onChange={(e) => set('gerar_faturamento_rapido', e.target.value)} /></div>
                <div><Label className="text-sm font-medium">Observações finais do consultor</Label><Textarea rows={3} value={form.observacoes_finais} onChange={(e) => set('observacoes_finais', e.target.value)} /></div>
              </div>
            </FormBlock>

            {/* Botão salvar no rodapé */}
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
