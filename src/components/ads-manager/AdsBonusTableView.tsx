import { TrendingUp, TrendingDown, Trophy, AlertTriangle, DollarSign, Star, CheckCircle2, XCircle } from 'lucide-react';

interface BonusItem {
  text: string;
  value: string;
  emoji: string;
}

const GAIN_ITEMS: BonusItem[] = [
  { text: 'Quantidade de Cliente: Todo cliente vale', value: '+ R$85', emoji: '🤑' },
  { text: 'Enviar Audio LEMAS Milennials toda segunda e sexta', value: '+ R$150/mês', emoji: '🤑' },
  { text: 'Todas as reuniões semanais com o Gestor de projetos realizadas', value: '+ R$150/mês', emoji: '🤑' },
];

const LOSS_ITEMS: BonusItem[] = [
  { text: 'Atrasar Tarefa', value: '- R$20', emoji: '❌' },
  { text: 'Prometer e não entregar', value: '- R$20', emoji: '❌' },
  { text: 'Não documentar dia', value: '- R$20', emoji: '❌' },
  { text: 'Não documentar Reunião', value: '- R$20', emoji: '❌' },
  { text: 'Não enviar mensagem Diária', value: '- R$20', emoji: '❌' },
  { text: 'Não Justificar atraso Onboarding', value: '- R$20', emoji: '❌' },
  { text: 'Não mover os clientes corretamente', value: '- R$50', emoji: '❌' },
];

export default function AdsBonusTableView() {
  return (
    <div className="space-y-6 py-2">
      {/* Gain Section */}
      <div className="relative">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">GANHO DE BÔNUS</h3>
            <p className="text-xs text-muted-foreground">Millennials Rewards</p>
          </div>
          <div className="ml-auto">
            <Trophy className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        {/* Gain Items */}
        <div className="space-y-2">
          {GAIN_ITEMS.map((item, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent p-3 transition-all hover:border-emerald-500/40 hover:from-emerald-500/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-tight">{item.text}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-500 whitespace-nowrap">{item.value}</span>
                  <span className="text-lg">{item.emoji}</span>
                </div>
              </div>
              {/* Progress bar decoration */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>

        {/* Total Potential */}
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-muted-foreground">Potencial máximo mensal</span>
            </div>
            <span className="text-sm font-bold text-emerald-500">+ R$385+</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground">vs</span>
        </div>
      </div>

      {/* Loss Section */}
      <div className="relative">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">PERDA DE BÔNUS</h3>
            <p className="text-xs text-muted-foreground">Invalida mediante aviso prévio</p>
          </div>
          <div className="ml-auto">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
        </div>

        {/* Loss Items */}
        <div className="space-y-2">
          {LOSS_ITEMS.map((item, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent p-3 transition-all hover:border-red-500/40 hover:from-red-500/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-tight">{item.text}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span className="text-sm font-bold text-red-500 whitespace-nowrap">{item.value}</span>
                  <span className="text-lg">{item.emoji}</span>
                </div>
              </div>
              {/* Progress bar decoration */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>

        {/* Warning Note */}
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              <strong className="text-amber-500">Importante:</strong> Tudo se invalida mediante aviso prévio ao Gestor de Projetos
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <DollarSign className="w-4 h-4 text-primary" />
        <span>Tabela de Bônus Millennials</span>
      </div>
    </div>
  );
}
