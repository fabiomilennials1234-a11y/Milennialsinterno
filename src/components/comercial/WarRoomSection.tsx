import { useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Swords, BookOpen } from 'lucide-react';

export default function WarRoomSection() {
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [open3, setOpen3] = useState(false);

  return (
    <div className="space-y-4">
      <Separator />

      <div className="flex items-center gap-2">
        <Swords size={18} className="text-primary" />
        <h3 className="text-base font-semibold">Condução das War Rooms</h3>
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
