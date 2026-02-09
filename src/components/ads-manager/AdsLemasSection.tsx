import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Quote, Sparkles, Mic, BookOpen, Heart, MessageSquare, Users, FileText, Lock, Link2, ChevronRight } from 'lucide-react';

interface Lema {
  number: string;
  text: string;
  icon: React.ReactNode;
}

const LEMAS: Lema[] = [
  {
    number: 'Primeiro',
    text: 'Jamais descumprirei um prazo que dei a um cliente, e se por algum motivo isso acontecer, eu o avisarei um dia antes.',
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    number: 'Segundo',
    text: 'O dinheiro do meu cliente é meu dinheiro. Sempre lembrarei que por trás de cada cliente existe um sonho, que também é meu.',
    icon: <Heart className="w-4 h-4" />,
  },
  {
    number: 'Terceiro',
    text: 'Sempre irei relatar ao meu gestor de projetos minhas ideias que acredito que possam melhorar a Milennials, além disso, sempre irei relatar o que está me incomodando, visando minha felicidade e de todos na equipe.',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    number: 'Quarto',
    text: 'Meu único e principal objetivo aqui é ser feliz, e se por algum dia eu não for, irei conversar com meu gestor.',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    number: 'Quinto',
    text: 'Nós somos a melhor equipe de Marketing do mundo, e hoje, amanhã e sempre irei provar isso para mim mesmo.',
    icon: <Users className="w-4 h-4" />,
  },
  {
    number: 'Sexto',
    text: 'Se um dia um cliente não me responder, eu o chamarei novamente no dia seguinte. Nenhum dos meus clientes ficará um dia sem um contato meu.',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    number: 'Sétimo',
    text: 'Não existe relatório sem vídeo explicando.',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    number: 'Oitavo',
    text: 'Sempre que precisar falar com alguém da equipe, irei falar nos grupos que possuo acesso. Jamais chamarei alguém da equipe no privado.',
    icon: <Lock className="w-4 h-4" />,
  },
  {
    number: 'Nono',
    text: 'Sempre anexarei na descrição de meus clientes o Dashboard, Link do drive e Link do documento de objeções + Chamarizes.',
    icon: <Link2 className="w-4 h-4" />,
  },
];

export default function AdsLemasSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        {/* Header Banner */}
        <div className="p-4 bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/30 rounded-xl relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">LEMAS MILLENNIALS</h3>
              <p className="text-xs text-muted-foreground">Nossos valores e princípios</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="kanban-card p-4 cursor-pointer transition-all hover:border-warning/50"
          style={{ borderLeft: '3px solid hsl(38 92% 50%)' }}
        >
          <div className="flex items-center gap-2.5">
            <Quote size={16} className="text-warning" />
            <h4 className="text-sm font-medium text-foreground">Quais os Lemas da Millennials?</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-2 pl-6">Clique para ver os 9 lemas</p>
        </div>
      </div>

      {/* Modal com design gamificado */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-subtle overflow-hidden max-h-[90vh] shadow-apple-lg">
          <DialogTitle className="sr-only">Lemas da Millennials</DialogTitle>
          <DialogDescription className="sr-only">Os 9 lemas e valores da equipe</DialogDescription>
          
          {/* Header */}
          <div className="p-6 border-b border-subtle bg-gradient-to-r from-warning/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning to-orange-500 flex items-center justify-center shadow-lg">
                <Quote className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="inline-block text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md mb-1">
                  Lemas Millennials
                </span>
                <h2 className="text-xl font-bold text-foreground">Os 9 Lemas da Millennials</h2>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh] scrollbar-apple">
            {/* Audio Instruction */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg flex-shrink-0">
                  <Mic className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Para ganho do Bônus</h3>
                  <p className="text-xs text-muted-foreground">Enviar Áudio lendo a mensagem abaixo</p>
                </div>
              </div>
            </div>

            {/* Introduction */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-info/10 to-transparent border border-info/20">
              <p className="text-sm text-foreground italic">
                "Me chamo <strong className="text-primary">[X]</strong> e irei repetir os lemas da Milennials."
              </p>
            </div>

            {/* Lemas List */}
            <div className="space-y-3">
              {LEMAS.map((lema, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-xl border border-warning/20 bg-gradient-to-r from-warning/5 to-transparent p-4 transition-all hover:border-warning/40 hover:from-warning/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-warning/20 to-orange-500/20 flex items-center justify-center border border-warning/30">
                      <span className="text-sm font-bold text-warning">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-warning uppercase tracking-wide">{lema.number}</span>
                        <div className="text-warning/60">{lema.icon}</div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{lema.text}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-warning/40 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-warning/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-4 h-4 text-warning" />
              <span>Lemas Millennials • Nossos valores e princípios</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
