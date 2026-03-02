import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, DollarSign, Star, CheckCircle2, XCircle, Gift } from 'lucide-react';

interface BonusItem {
  text: string;
  value: string;
  emoji: string;
}

const GAIN_ITEMS: BonusItem[] = [
  { text: 'Quantidade de Cliente: Todo cliente vale', value: '+ R$85', emoji: '🤑' },
  { text: 'Enviar Audio LEMAS Milennials toda segunda e sexta', value: '+ R$150/mes', emoji: '🤑' },
  { text: 'Todas as reunioes semanais com o Gestor de projetos realizadas', value: '+ R$150/mes', emoji: '🤑' },
];

const LOSS_ITEMS: BonusItem[] = [
  { text: 'Atrasar Tarefa', value: '- R$20', emoji: '❌' },
  { text: 'Prometer e nao entregar', value: '- R$20', emoji: '❌' },
  { text: 'Nao documentar dia', value: '- R$20', emoji: '❌' },
  { text: 'Nao documentar Reuniao', value: '- R$20', emoji: '❌' },
  { text: 'Nao enviar mensagem Diaria', value: '- R$20', emoji: '❌' },
  { text: 'Nao Justificar atraso Onboarding', value: '- R$20', emoji: '❌' },
  { text: 'Nao mover os clientes corretamente', value: '- R$50', emoji: '❌' },
];

export default function OutboundBonusSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">BONUS = + DINHEIRO</h3>
              <p className="text-xs text-muted-foreground">Conquiste mais com sua performance</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => setIsModalOpen(true)}
          className="kanban-card p-4 cursor-pointer transition-all hover:shadow-farol"
          style={{ borderLeft: '3px solid hsl(48 100% 50%)' }}
        >
          <div className="flex items-center gap-2.5">
            <Gift size={16} className="text-primary" />
            <h4 className="text-sm font-medium text-foreground">Tabela Bonus Milennials.</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-2 pl-6">Clique para ver as regras de bonus</p>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-subtle overflow-hidden max-h-[90vh] shadow-apple-lg">
          <DialogTitle className="sr-only">Tabela de Bonus Millennials</DialogTitle>
          <DialogDescription className="sr-only">Regras de ganho e perda de bonus</DialogDescription>

          <div className="p-6 border-b border-subtle bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <span className="inline-block text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md mb-1">Bonus Millennials</span>
                <h2 className="text-xl font-bold text-foreground">Tabela de Bonus</h2>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh] scrollbar-apple">
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">GANHO DE BONUS</h3>
                  <p className="text-xs text-muted-foreground">Millennials Rewards</p>
                </div>
                <div className="ml-auto"><Trophy className="w-6 h-6 text-amber-400" /></div>
              </div>
              <div className="space-y-2">
                {GAIN_ITEMS.map((item, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent p-3 transition-all hover:border-emerald-500/40 hover:from-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm text-foreground leading-tight">{item.text}</p></div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-500 whitespace-nowrap">{item.value}</span>
                        <span className="text-lg">{item.emoji}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
              <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">vs</span></div>
            </div>

            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">PERDA DE BONUS</h3>
                  <p className="text-xs text-muted-foreground">Invalida mediante aviso previo</p>
                </div>
                <div className="ml-auto"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
              </div>
              <div className="space-y-2">
                {LOSS_ITEMS.map((item, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent p-3 transition-all hover:border-red-500/40 hover:from-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><XCircle className="w-4 h-4 text-red-500" /></div>
                      <div className="flex-1 min-w-0"><p className="text-sm text-foreground leading-tight">{item.text}</p></div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="text-sm font-bold text-red-500 whitespace-nowrap">{item.value}</span>
                        <span className="text-lg">{item.emoji}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground"><strong className="text-amber-500">Importante:</strong> Tudo se invalida mediante aviso previo ao Gestor de Projetos</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="w-4 h-4 text-primary" />
              <span>Tabela de Bonus Millennials</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
